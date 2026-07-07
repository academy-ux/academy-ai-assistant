import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { fetchCandidatesForPosting, fetchPosting, LeverCandidate } from '@/lib/lever'
import { supabase } from '@/lib/supabase'

// Contact-sheet export: one row per candidate who has *ever* been on the
// posting — every stage, leads through hired, including archived — with the
// details a recruiter needs to reach out: name, email, LinkedIn, portfolio,
// and the portfolio password (design portfolios are frequently gated).

const HEADERS = ['Full Name', 'Email', 'LinkedIn', 'Portfolio', 'Portfolio Password', 'Stage', 'Status'] as const

type Row = [string, string, string, string, string, string, string]

function normalizeLinks(links: LeverCandidate['links']): string[] {
    return (links || [])
        .map(l => (typeof l === 'string' ? l : l?.url))
        .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
        .map(u => u.trim())
}

function isLinkedIn(url: string): boolean {
    return /(^|\.)linkedin\.com/i.test(url)
}

// The portfolio is the first non-LinkedIn link. We surface known design hosts
// (Dribbble/Behance/Notion) ahead of generic links so a candidate's actual
// work sample wins over an incidental link (e.g. a shared Google Doc).
const PORTFOLIO_HOST_PRIORITY = ['dribbble.com', 'behance.net', 'notion.', 'framer.', 'webflow.io', 'cargo.', 'squarespace.']

function pickPortfolio(links: string[]): string {
    const candidates = links.filter(u => !isLinkedIn(u))
    if (!candidates.length) return ''
    const preferred = candidates.find(u => PORTFOLIO_HOST_PRIORITY.some(h => u.toLowerCase().includes(h)))
    return preferred || candidates[0]
}

// Mirror the share route's password resolution: prefer the stored value, fall
// back to a "password"/"passcode" answer in the Lever application questions.
function passwordFromAnswers(answers: LeverCandidate['answers']): string {
    const hit = (answers || []).find((a: any) => {
        const q = String(a?.text || '').toLowerCase()
        const v = typeof a?.value === 'string' ? a.value.trim() : ''
        return v && !/^https?:\/\//i.test(v) && (q.includes('password') || q.includes('passcode'))
    })
    return hit?.value ? String(hit.value).trim() : ''
}

async function findExistingSheet(drive: any, postingId: string): Promise<string | null> {
    try {
        const res = await drive.files.list({
            q: `appProperties has { key='academyPostingId' and value='${postingId}' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })
        return res.data.files?.[0]?.id || null
    } catch {
        return null
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const token = await getToken({ req: request })
        if (!token?.accessToken) {
            return NextResponse.json({ error: 'Unauthorized — please sign in again' }, { status: 401 })
        }

        const postingId = params.id

        // 1. Everyone on the posting, every stage, archived included.
        const [candidates, posting] = await Promise.all([
            fetchCandidatesForPosting(postingId),
            fetchPosting(postingId).catch(() => null),
        ])

        if (!candidates.length) {
            return NextResponse.json({ error: 'No candidates found for this role.' }, { status: 404 })
        }

        // 2. Resolve stored portfolio passwords by email in one query.
        const emails = Array.from(new Set(candidates.map(c => c.email).filter((e): e is string => !!e)))
        const passwordByEmail = new Map<string, string>()
        if (emails.length) {
            const { data } = await supabase
                .from('candidate_passwords')
                .select('candidate_email, password')
                .in('candidate_email', emails)
            for (const row of (data || []) as any[]) {
                if (row.password) passwordByEmail.set(row.candidate_email, row.password)
            }
        }

        // 3. Build the rows. Sort by stage then name for a scannable sheet.
        const rows: Row[] = candidates
            .map((c): Row => {
                const links = normalizeLinks(c.links)
                const linkedin = links.find(isLinkedIn) || ''
                const portfolio = pickPortfolio(links)
                const password =
                    (c.email ? passwordByEmail.get(c.email) : '') ||
                    passwordFromAnswers(c.answers) ||
                    ''
                return [
                    c.name || '',
                    c.email || '',
                    linkedin,
                    portfolio,
                    password,
                    c.stage || '',
                    c.archivedAt ? 'Archived' : 'Active',
                ]
            })
            .sort((a, b) => (a[5] || '').localeCompare(b[5] || '') || (a[0] || '').localeCompare(b[0] || ''))

        const values = [HEADERS as unknown as string[], ...rows]

        // 4. Auth + Google clients (drive.file scope covers app-created files).
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const drive = google.drive({ version: 'v3', auth })
        const sheets = google.sheets({ version: 'v4', auth })

        const title = `${posting?.text || 'Candidates'} — Contact Export`

        // Reuse an existing export for this posting so the link stays stable.
        let spreadsheetId = await findExistingSheet(drive, postingId)
        let sheetId = 0

        if (spreadsheetId) {
            const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
            sheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0
            // Clear stale rows before rewriting.
            await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${meta.data.sheets?.[0]?.properties?.title || 'Sheet1'}` })
        } else {
            const file = await drive.files.create({
                requestBody: {
                    name: title,
                    mimeType: 'application/vnd.google-apps.spreadsheet',
                    appProperties: { academyPostingId: postingId },
                },
                fields: 'id',
            })
            spreadsheetId = file.data.id!
            const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
            sheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0
        }

        // 5. Write values.
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'A1',
            valueInputOption: 'RAW',
            requestBody: { values },
        })

        // 6. Format: bold + frozen header, sensible column widths.
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                            fields: 'gridProperties.frozenRowCount',
                        },
                    },
                    {
                        repeatCell: {
                            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: { bold: true },
                                    backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                        },
                    },
                    {
                        autoResizeDimensions: {
                            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: HEADERS.length },
                        },
                    },
                ],
            },
        })

        return NextResponse.json({
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
            spreadsheetId,
            count: rows.length,
        })
    } catch (error: any) {
        console.error('[Export Sheet] error:', error)
        const msg = error?.message || 'Export failed'
        const status = error?.code === 401 || /invalid.credentials|token.*expired|token.*revoked/i.test(msg) ? 401 : 500
        return NextResponse.json(
            { error: status === 401 ? 'Google session expired — please sign out and back in.' : msg },
            { status }
        )
    }
}
