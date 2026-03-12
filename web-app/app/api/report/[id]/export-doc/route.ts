export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { fetchCandidatesForPosting, LeverCandidate } from '@/lib/lever'
import { generatePitch, fetchJobDescription } from '@/lib/pitch'

const FOLDER_NAME = 'Academy Reports'

interface CandidateGroups {
    presenting: LeverCandidate[]
    interviewing: LeverCandidate[]
    portfolio: LeverCandidate[]
    applied: LeverCandidate[]
    clientPassed: LeverCandidate[]
    withdrew: LeverCandidate[]
}

function groupCandidates(candidates: LeverCandidate[]): CandidateGroups {
    const groups: CandidateGroups = {
        presenting: [],
        interviewing: [],
        portfolio: [],
        applied: [],
        clientPassed: [],
        withdrew: [],
    }

    candidates.forEach(c => {
        const stage = c.stage.toLowerCase()

        if (c.archivedAt) {
            const reason = (c.archivedReason || '').toLowerCase()
            if (reason.includes('withdrew') || reason.includes('withdraw') || reason.includes('declined')) {
                groups.withdrew.push(c)
            } else {
                groups.clientPassed.push(c)
            }
            return
        }

        if (stage === 'client interview') {
            groups.interviewing.push(c)
        } else if (stage === 'portfolio interview') {
            groups.portfolio.push(c)
        } else if (stage.includes('present') || stage.includes('client') || stage.includes('offer')) {
            groups.presenting.push(c)
        } else {
            groups.applied.push(c)
        }
    })

    return groups
}

function getCandidateLinks(c: LeverCandidate): { linkedin: string | null; portfolio: string | null } {
    let linkedin: string | null = null
    let portfolio: string | null = null

    for (const link of c.links || []) {
        const url = typeof link === 'string' ? link : link.url
        if (!url) continue
        if (url.includes('linkedin.com')) {
            linkedin = url
        } else if (!portfolio) {
            portfolio = url
        }
    }

    return { linkedin, portfolio }
}

function formatCandidateEntry(c: LeverCandidate): string {
    const { linkedin, portfolio } = getCandidateLinks(c)
    const parts = [c.name]
    if (linkedin) parts.push('LinkedIn')
    if (portfolio) parts.push('Portfolio')
    const location = typeof c.location === 'string' ? c.location : ''
    if (location) parts.push(`Location: ${location}`)
    return parts.join(' | ')
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = await getToken({ req: request })
        if (!token?.accessToken) {
            return NextResponse.json({ error: 'Unauthorized — please sign in again' }, { status: 401 })
        }

        const postingId = params.id
        const body = await request.json()
        const { projectTitle } = body

        // 1. Fetch candidates
        const candidates = await fetchCandidatesForPosting(postingId)
        const groups = groupCandidates(candidates)

        // 2. Fetch job description (for pitch generation)
        const jobDescription = await fetchJobDescription(postingId)

        // 3. Generate pitches for presenting candidates (in parallel)
        const pitchMap = new Map<string, string>()
        if (groups.presenting.length > 0) {
            const pitchPromises = groups.presenting.map(async (c) => {
                try {
                    const pitch = await generatePitch({
                        email: c.email || null,
                        candidateName: c.name,
                        jobDescription,
                    })
                    if (pitch) pitchMap.set(c.id, pitch)
                } catch (err) {
                    console.error(`[Export] Failed to generate pitch for ${c.name}:`, err)
                }
            })
            await Promise.all(pitchPromises)
        }

        // 4. Build document content
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const docs = google.docs({ version: 'v1', auth })
        const drive = google.drive({ version: 'v3', auth })

        // Create the document
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const docTitle = `Academy Candidate Presentation - ${projectTitle || 'Report'}`

        const doc = await docs.documents.create({
            requestBody: { title: docTitle },
        })
        const documentId = doc.data.documentId!

        // Build the document using batch update requests
        const requests: any[] = []
        let idx = 1 // Google Docs index starts at 1

        // Helper to insert text and advance index
        function insertText(text: string) {
            requests.push({
                insertText: { location: { index: idx }, text }
            })
            idx += text.length
        }

        function insertBoldText(text: string) {
            const start = idx
            insertText(text)
            requests.push({
                updateTextStyle: {
                    range: { startIndex: start, endIndex: idx },
                    textStyle: { bold: true },
                    fields: 'bold',
                }
            })
        }

        function insertHeading(text: string) {
            const start = idx
            insertText(text + '\n')
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: start, endIndex: idx },
                    paragraphStyle: { namedStyleType: 'HEADING_2' },
                    fields: 'namedStyleType',
                }
            })
        }

        function insertLink(text: string, url: string) {
            const start = idx
            insertText(text)
            requests.push({
                updateTextStyle: {
                    range: { startIndex: start, endIndex: idx },
                    textStyle: { link: { url } },
                    fields: 'link',
                }
            })
        }

        function insertHorizontalRule() {
            requests.push({
                insertSectionBreak: { location: { index: idx }, sectionType: 'CONTINUOUS' }
            })
            idx += 1
        }

        // --- Document Structure ---

        // Title
        const titleStart = idx
        insertText(`Academy Candidate Presentation - ${projectTitle || 'Report'}\n`)
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: titleStart, endIndex: idx },
                paragraphStyle: { namedStyleType: 'HEADING_1' },
                fields: 'namedStyleType',
            }
        })

        // Date
        insertText(`Updated: ${today}\n\n`)

        // --- Presenting Section ---
        insertHeading('Presenting')

        if (groups.presenting.length > 0) {
            for (const c of groups.presenting) {
                const { linkedin, portfolio } = getCandidateLinks(c)
                const location = typeof c.location === 'string' ? c.location : ''

                insertBoldText(c.name)
                if (linkedin) {
                    insertText(' | ')
                    insertLink('LinkedIn', linkedin)
                }
                if (portfolio) {
                    insertText(' | ')
                    insertLink('Portfolio', portfolio)
                }
                if (location) {
                    insertText(' | ')
                    insertBoldText('Location: ')
                    insertText(location)
                }
                insertText('\n')

                // Add pitch if available
                const pitch = pitchMap.get(c.id)
                if (pitch) {
                    insertText(pitch + '\n')
                }
                insertText('\n')
            }
        } else {
            insertText('No candidates currently presenting.\n\n')
        }

        // --- Interviewed + Interested Section ---
        insertHeading('Interviewed + Interested')

        const interviewed = [...groups.interviewing, ...groups.portfolio]
        if (interviewed.length > 0) {
            for (const c of interviewed) {
                const { linkedin, portfolio } = getCandidateLinks(c)
                const location = typeof c.location === 'string' ? c.location : ''

                insertText('• ')
                insertBoldText(c.name)
                if (linkedin) {
                    insertText(' | ')
                    insertLink('LinkedIn', linkedin)
                }
                if (portfolio) {
                    insertText(' | ')
                    insertLink('Portfolio', portfolio)
                }
                if (location) {
                    insertText(' | ')
                    insertBoldText('Location: ')
                    insertText(location)
                }
                insertText('\n\n')
            }
        } else {
            insertText('No candidates in this stage.\n\n')
        }

        // --- Applied / Interested Section ---
        insertHeading('Applied / Interested')

        if (groups.applied.length > 0) {
            for (const c of groups.applied) {
                const { linkedin, portfolio } = getCandidateLinks(c)
                const location = typeof c.location === 'string' ? c.location : ''

                insertText('• ')
                insertBoldText(c.name)
                if (linkedin) {
                    insertText(' | ')
                    insertLink('LinkedIn', linkedin)
                }
                if (portfolio) {
                    insertText(' | ')
                    insertLink('Portfolio', portfolio)
                }
                if (location) {
                    insertText(' | ')
                    insertBoldText('Location: ')
                    insertText(location)
                }
                insertText('\n\n')
            }
        } else {
            insertText('No candidates in this stage.\n\n')
        }

        // --- Client Passed Section ---
        insertHeading('Client Passed')

        if (groups.clientPassed.length > 0) {
            for (const c of groups.clientPassed) {
                const { linkedin, portfolio } = getCandidateLinks(c)
                const location = typeof c.location === 'string' ? c.location : ''

                insertText('• ')
                insertBoldText(c.name)
                if (linkedin) {
                    insertText(' | ')
                    insertLink('LinkedIn', linkedin)
                }
                if (portfolio) {
                    insertText(' | ')
                    insertLink('Portfolio', portfolio)
                }
                if (location) {
                    insertText(' | ')
                    insertBoldText('Location: ')
                    insertText(location)
                }
                const reason = c.archivedReason || ''
                if (reason) {
                    insertText(` (${reason})`)
                }
                insertText('\n\n')
            }
        } else {
            insertText('No candidates in this stage.\n\n')
        }

        // --- Withdrew Section ---
        insertHeading('Withdrew')

        if (groups.withdrew.length > 0) {
            for (const c of groups.withdrew) {
                const { linkedin, portfolio } = getCandidateLinks(c)
                const location = typeof c.location === 'string' ? c.location : ''

                insertText('• ')
                insertBoldText(c.name)
                if (linkedin) {
                    insertText(' | ')
                    insertLink('LinkedIn', linkedin)
                }
                if (portfolio) {
                    insertText(' | ')
                    insertLink('Portfolio', portfolio)
                }
                if (location) {
                    insertText(' | ')
                    insertBoldText('Location: ')
                    insertText(location)
                }
                const reason = c.archivedReason || ''
                if (reason) {
                    insertText(` (${reason})`)
                }
                insertText('\n\n')
            }
        } else {
            insertText('No candidates in this stage.\n\n')
        }

        // Apply all formatting
        await docs.documents.batchUpdate({
            documentId,
            requestBody: { requests },
        })

        // 5. Move to Academy Reports folder
        let folderId: string | null = null
        try {
            // Search for existing folder
            const folderSearch = await drive.files.list({
                q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id)',
                spaces: 'drive',
            })

            if (folderSearch.data.files && folderSearch.data.files.length > 0) {
                folderId = folderSearch.data.files[0].id!
            } else {
                // Create the folder
                const folder = await drive.files.create({
                    requestBody: {
                        name: FOLDER_NAME,
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                })
                folderId = folder.data.id!
            }

            // Move doc into folder
            const file = await drive.files.get({
                fileId: documentId,
                fields: 'parents',
            })
            const previousParents = (file.data.parents || []).join(',')
            await drive.files.update({
                fileId: documentId,
                addParents: folderId,
                removeParents: previousParents,
                fields: 'id, parents',
            })
        } catch (folderErr) {
            console.error('[Export] Failed to move to folder (non-fatal):', folderErr)
        }

        const docUrl = `https://docs.google.com/document/d/${documentId}/edit`

        return NextResponse.json({
            success: true,
            url: docUrl,
            documentId,
            stats: {
                presenting: groups.presenting.length,
                interviewed: groups.interviewing.length + groups.portfolio.length,
                applied: groups.applied.length,
                clientPassed: groups.clientPassed.length,
                withdrew: groups.withdrew.length,
                pitchesGenerated: pitchMap.size,
            }
        })
    } catch (error) {
        console.error('[Export Doc] Error:', error)
        const message = error instanceof Error ? error.message : 'Failed to export document'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
