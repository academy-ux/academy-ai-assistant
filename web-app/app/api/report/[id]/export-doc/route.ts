export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { google } from 'googleapis'
import { fetchCandidatesForPosting, LeverCandidate } from '@/lib/lever'
import { generatePitch, fetchJobDescription } from '@/lib/pitch'
import { supabase } from '@/lib/supabase'

const FOLDER_NAME = 'Academy Reports'

// ─── Design Tokens (Academy brand: academyux.com) ───────────────
// Neue Haas Grotesk Display → "Helvetica Neue" in Google Docs
// Palette: charcoal / sage / cream / warm gray
const COLORS = {
    black:      { red: 0.067, green: 0.067, blue: 0.067 },  // #111111
    charcoal:   { red: 0.153, green: 0.153, blue: 0.153 },  // #272727
    body:       { red: 0.34,  green: 0.34,  blue: 0.34  },  // #575757
    sage:       { red: 0.56,  green: 0.58,  blue: 0.53  },  // #8F937F — darkest olive
    warmGray:   { red: 0.68,  green: 0.69,  blue: 0.65  },  // #ADAFA6
    divider:    { red: 0.82,  green: 0.83,  blue: 0.80  },  // #D1D4CC
    cream:      { red: 0.93,  green: 0.90,  blue: 0.82  },  // #EDE6D2
    link:       { red: 0.102, green: 0.396, blue: 0.863 },  // #1A65DC — Google blue
}

const FONTS = { heading: 'Helvetica Neue', body: 'Helvetica Neue' }

const PT = {
    brand: 10,
    title: 24,
    subtitle: 10,
    sectionHead: 10,
    candidateName: 13,
    bodyText: 10,
    pitchText: 10,
    metaText: 10,
}

// ─── Candidate Grouping ──────────────────────────────────────────

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
        presenting: [], interviewing: [], portfolio: [],
        applied: [], clientPassed: [], withdrew: [],
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
        if (stage === 'client interview') groups.interviewing.push(c)
        else if (stage === 'portfolio interview') groups.portfolio.push(c)
        else if (stage.includes('present') || stage.includes('client') || stage.includes('offer')) groups.presenting.push(c)
        else groups.applied.push(c)
    })

    return groups
}

function getCandidateLinks(c: LeverCandidate): { linkedin: string | null; portfolio: string | null } {
    let linkedin: string | null = null
    let portfolio: string | null = null
    for (const link of c.links || []) {
        const url = typeof link === 'string' ? link : link.url
        if (!url) continue
        if (url.includes('linkedin.com')) linkedin = url
        else if (!portfolio) portfolio = url
    }
    return { linkedin, portfolio }
}

// ─── Document Builder ────────────────────────────────────────────

class DocBuilder {
    requests: any[] = []
    idx = 1

    text(content: string) {
        this.requests.push({ insertText: { location: { index: this.idx }, text: content } })
        this.idx += content.length
        return this
    }

    newline(count = 1) { return this.text('\n'.repeat(count)) }

    styledText(content: string, style: Record<string, any>, fields: string) {
        const start = this.idx
        this.text(content)
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: this.idx },
                textStyle: style, fields,
            }
        })
        return this
    }

    paragraphStyle(startIdx: number, style: Record<string, any>, fields: string) {
        this.requests.push({
            updateParagraphStyle: {
                range: { startIndex: startIdx, endIndex: this.idx },
                paragraphStyle: style, fields,
            }
        })
        return this
    }

    hr() {
        const start = this.idx
        this.text('\n')
        this.requests.push({
            updateParagraphStyle: {
                range: { startIndex: start, endIndex: this.idx },
                paragraphStyle: {
                    borderBottom: {
                        color: { color: { rgbColor: COLORS.divider } },
                        width: { magnitude: 0.5, unit: 'PT' },
                        padding: { magnitude: 8, unit: 'PT' },
                        dashStyle: 'SOLID',
                    },
                    spaceBelow: { magnitude: 12, unit: 'PT' },
                },
                fields: 'borderBottom,spaceBelow',
            }
        })
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: this.idx },
                textStyle: { fontSize: { magnitude: 1, unit: 'PT' } },
                fields: 'fontSize',
            }
        })
        return this
    }

    brandHeader(logoUrl?: string) {
        const start = this.idx
        if (logoUrl) {
            // Insert logo as inline image
            this.requests.push({
                insertInlineImage: {
                    location: { index: this.idx },
                    uri: logoUrl,
                    objectSize: {
                        height: { magnitude: 20, unit: 'PT' },
                        width: { magnitude: 88, unit: 'PT' },
                    },
                }
            })
            this.idx += 1 // inline image takes 1 index
        } else {
            // Fallback: text-based brand
            this.text('academy')
            this.requests.push({
                updateTextStyle: {
                    range: { startIndex: start, endIndex: start + 7 },
                    textStyle: {
                        fontSize: { magnitude: PT.brand, unit: 'PT' },
                        weightedFontFamily: { fontFamily: FONTS.heading, weight: 700 },
                        foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                    },
                    fields: 'fontSize,weightedFontFamily,foregroundColor',
                }
            })
        }
        this.newline()
        this.paragraphStyle(start, {
            spaceBelow: { magnitude: 32, unit: 'PT' },
        }, 'spaceBelow')
        return this
    }

    title(content: string) {
        const start = this.idx
        this.text(content)
        this.newline()
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: start + content.length },
                textStyle: {
                    fontSize: { magnitude: PT.title, unit: 'PT' },
                    weightedFontFamily: { fontFamily: FONTS.heading, weight: 500 },
                    foregroundColor: { color: { rgbColor: COLORS.black } },
                    underline: false,
                },
                fields: 'fontSize,weightedFontFamily,foregroundColor,underline',
            }
        })
        this.paragraphStyle(start, {
            spaceBelow: { magnitude: 2, unit: 'PT' },
            lineSpacing: 105,
        }, 'spaceBelow,lineSpacing')
        return this
    }

    subtitle(content: string) {
        const start = this.idx
        this.text(content)
        this.newline()
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: start + content.length },
                textStyle: {
                    fontSize: { magnitude: PT.subtitle, unit: 'PT' },
                    weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                    foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                    underline: false,
                },
                fields: 'fontSize,weightedFontFamily,foregroundColor,underline',
            }
        })
        this.paragraphStyle(start, {
            spaceBelow: { magnitude: 4, unit: 'PT' },
        }, 'spaceBelow')
        return this
    }

    sectionHeading(content: string) {
        const start = this.idx
        const upper = content.toUpperCase()
        this.text(upper)
        this.newline()
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: start + upper.length },
                textStyle: {
                    bold: false,
                    fontSize: { magnitude: PT.sectionHead, unit: 'PT' },
                    weightedFontFamily: { fontFamily: 'Fragment Mono', weight: 400 },
                    foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                    underline: false,
                },
                fields: 'bold,fontSize,weightedFontFamily,foregroundColor,underline',
            }
        })
        this.paragraphStyle(start, {
            spaceAbove: { magnitude: 32, unit: 'PT' },
            spaceBelow: { magnitude: 18, unit: 'PT' },
            borderBottom: {
                color: { color: { rgbColor: COLORS.divider } },
                width: { magnitude: 0.5, unit: 'PT' },
                padding: { magnitude: 4, unit: 'PT' },
                dashStyle: 'SOLID',
            },
        }, 'spaceAbove,spaceBelow,borderBottom')
        return this
    }

    candidateEntry(c: LeverCandidate, opts?: { pitch?: string }) {
        const { linkedin, portfolio } = getCandidateLinks(c)
        const location = typeof c.location === 'string' ? c.location : ''

        // ── Single line: **Name** | LinkedIn | Portfolio | **Location:** X ──
        const lineStart = this.idx

        // Bold name
        const nameStart = this.idx
        this.text(c.name)
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: nameStart, endIndex: this.idx },
                textStyle: {
                    bold: true,
                    fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                    weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                    foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                    underline: false,
                },
                fields: 'bold,fontSize,weightedFontFamily,foregroundColor,underline',
            }
        })

        if (linkedin) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                underline: false,
            }, 'foregroundColor,fontSize,underline')
            const ls = this.idx
            this.text('LinkedIn')
            this.requests.push({
                updateTextStyle: {
                    range: { startIndex: ls, endIndex: this.idx },
                    textStyle: {
                        link: { url: linkedin },
                        foregroundColor: { color: { rgbColor: COLORS.link } },
                        fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                        weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                        underline: true,
                    },
                    fields: 'link,foregroundColor,fontSize,weightedFontFamily,underline',
                }
            })
        }

        if (portfolio) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                underline: false,
            }, 'foregroundColor,fontSize,underline')
            const ps = this.idx
            this.text('Portfolio')
            this.requests.push({
                updateTextStyle: {
                    range: { startIndex: ps, endIndex: this.idx },
                    textStyle: {
                        link: { url: portfolio },
                        foregroundColor: { color: { rgbColor: COLORS.link } },
                        fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                        weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                        underline: true,
                    },
                    fields: 'link,foregroundColor,fontSize,weightedFontFamily,underline',
                }
            })
        }

        if (location) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                underline: false,
            }, 'foregroundColor,fontSize,underline')
            // Bold "Location:" label
            this.styledText('Location: ', {
                bold: true,
                foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                underline: false,
            }, 'bold,foregroundColor,fontSize,weightedFontFamily,underline')
            this.styledText(location, {
                foregroundColor: { color: { rgbColor: COLORS.body } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                underline: false,
            }, 'foregroundColor,fontSize,weightedFontFamily,underline')
        }

        this.newline()

        // If no pitch, add bottom border to the name line itself
        if (!opts?.pitch) {
            this.paragraphStyle(lineStart, {
                spaceAbove: { magnitude: 4, unit: 'PT' },
                spaceBelow: { magnitude: 4, unit: 'PT' },
                borderBottom: {
                    color: { color: { rgbColor: COLORS.divider } },
                    width: { magnitude: 0.5, unit: 'PT' },
                    padding: { magnitude: 4, unit: 'PT' },
                    dashStyle: 'SOLID',
                },
            }, 'spaceAbove,spaceBelow,borderBottom')
        } else {
            this.paragraphStyle(lineStart, {
                spaceAbove: { magnitude: 4, unit: 'PT' },
                spaceBelow: { magnitude: 4, unit: 'PT' },
            }, 'spaceAbove,spaceBelow')
        }

        // ── Pitch paragraph (only for presenting) — with blank line separator ──
        if (opts?.pitch) {
            // Empty line between name and pitch
            const blankStart = this.idx
            this.newline()
            this.paragraphStyle(blankStart, {
                spaceAbove: { magnitude: 0, unit: 'PT' },
                spaceBelow: { magnitude: 0, unit: 'PT' },
            }, 'spaceAbove,spaceBelow')
            this.requests.push({
                updateTextStyle: {
                    range: { startIndex: blankStart, endIndex: this.idx },
                    textStyle: { fontSize: { magnitude: 4, unit: 'PT' }, underline: false },
                    fields: 'fontSize,underline',
                }
            })
            const pitchStart = this.idx
            this.text(opts.pitch)
            this.newline()
            this.requests.push({
                updateTextStyle: {
                    range: { startIndex: pitchStart, endIndex: pitchStart + opts.pitch.length },
                    textStyle: {
                        fontSize: { magnitude: PT.pitchText, unit: 'PT' },
                        weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                        foregroundColor: { color: { rgbColor: COLORS.body } },
                        underline: false,
                    },
                    fields: 'fontSize,weightedFontFamily,foregroundColor,underline',
                }
            })
            this.paragraphStyle(pitchStart, {
                spaceBelow: { magnitude: 8, unit: 'PT' },
                lineSpacing: 130,
                borderBottom: {
                    color: { color: { rgbColor: COLORS.divider } },
                    width: { magnitude: 0.5, unit: 'PT' },
                    padding: { magnitude: 6, unit: 'PT' },
                    dashStyle: 'SOLID',
                },
            }, 'spaceBelow,lineSpacing,borderBottom')
        }

        return this
    }

    archivedEntry(c: LeverCandidate) {
        const { linkedin, portfolio } = getCandidateLinks(c)
        const location = typeof c.location === 'string' ? c.location : ''
        const reason = c.archivedReason || ''
        const lineStart = this.idx

        // ── Single line: **Name** | LinkedIn | Portfolio | **Location:** X *(reason)* ──
        const nameStart = this.idx
        this.text(c.name)
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: nameStart, endIndex: this.idx },
                textStyle: {
                    bold: true,
                    fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                    weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                    foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                    underline: false,
                },
                fields: 'bold,fontSize,weightedFontFamily,foregroundColor,underline',
            }
        })

        if (linkedin) {
            this.styledText(' | ', { foregroundColor: { color: { rgbColor: COLORS.warmGray } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
            const ls = this.idx
            this.text('LinkedIn')
            this.requests.push({ updateTextStyle: { range: { startIndex: ls, endIndex: this.idx }, textStyle: { link: { url: linkedin }, foregroundColor: { color: { rgbColor: COLORS.link } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: true }, fields: 'link,foregroundColor,fontSize,underline' } })
        }
        if (portfolio) {
            this.styledText(' | ', { foregroundColor: { color: { rgbColor: COLORS.warmGray } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
            const ps = this.idx
            this.text('Portfolio')
            this.requests.push({ updateTextStyle: { range: { startIndex: ps, endIndex: this.idx }, textStyle: { link: { url: portfolio }, foregroundColor: { color: { rgbColor: COLORS.link } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: true }, fields: 'link,foregroundColor,fontSize,underline' } })
        }
        if (location) {
            this.styledText(' | ', { foregroundColor: { color: { rgbColor: COLORS.warmGray } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
            this.styledText('Location: ', { bold: true, foregroundColor: { color: { rgbColor: COLORS.charcoal } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, weightedFontFamily: { fontFamily: FONTS.body, weight: 700 }, underline: false }, 'bold,foregroundColor,fontSize,weightedFontFamily,underline')
            this.styledText(location, { foregroundColor: { color: { rgbColor: COLORS.body } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
        }
        if (reason) {
            this.styledText(` (${reason})`, {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                italic: true,
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                underline: false,
            }, 'foregroundColor,fontSize,italic,weightedFontFamily,underline')
        }

        this.newline()
        this.paragraphStyle(lineStart, {
            spaceAbove: { magnitude: 4, unit: 'PT' },
            spaceBelow: { magnitude: 4, unit: 'PT' },
            borderBottom: {
                color: { color: { rgbColor: COLORS.divider } },
                width: { magnitude: 0.5, unit: 'PT' },
                padding: { magnitude: 4, unit: 'PT' },
                dashStyle: 'SOLID',
            },
        }, 'spaceAbove,spaceBelow,borderBottom')
        return this
    }

    emptyState(message: string) {
        const start = this.idx
        this.text(message)
        this.newline()
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: start + message.length },
                textStyle: {
                    italic: true,
                    fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                    foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                    weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                    underline: false,
                },
                fields: 'italic,fontSize,foregroundColor,weightedFontFamily,underline',
            }
        })
        this.paragraphStyle(start, {
            spaceAbove: { magnitude: 6, unit: 'PT' },
            spaceBelow: { magnitude: 6, unit: 'PT' },
        }, 'spaceAbove,spaceBelow')
        return this
    }

    documentMargins() {
        this.requests.push({
            updateDocumentStyle: {
                documentStyle: {
                    marginTop: { magnitude: 54, unit: 'PT' },
                    marginBottom: { magnitude: 54, unit: 'PT' },
                    marginLeft: { magnitude: 60, unit: 'PT' },
                    marginRight: { magnitude: 60, unit: 'PT' },
                },
                fields: 'marginTop,marginBottom,marginLeft,marginRight',
            }
        })
        return this
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function findExistingDoc(drive: any, postingId: string): Promise<string | null> {
    try {
        const res = await drive.files.list({
            q: `appProperties has { key='academyPostingId' and value='${postingId}' } and mimeType='application/vnd.google-apps.document' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
        })
        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id
        }
    } catch (err) {
        console.error('[Export] Failed to search for existing doc:', err)
    }
    return null
}

async function clearDocContent(docsApi: any, documentId: string) {
    // Get the doc to find its content length
    const doc = await docsApi.documents.get({ documentId })
    const body = doc.data.body
    if (!body?.content) return

    // Find the end index (last structural element before the trailing newline)
    const endIndex = body.content[body.content.length - 1]?.endIndex
    if (!endIndex || endIndex <= 2) return

    // Delete everything except the trailing newline
    await docsApi.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [{
                deleteContentRange: {
                    range: { startIndex: 1, endIndex: endIndex - 1 }
                }
            }]
        }
    })
}

async function ensureFolder(drive: any): Promise<string> {
    const folderSearch = await drive.files.list({
        q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
    })

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        return folderSearch.data.files[0].id
    }

    const folder = await drive.files.create({
        requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
    })
    return folder.data.id
}

const LOGO_URL = 'https://academy-ai-assistant.vercel.app/academy-logo-horizontal-3-1024x235.png'

function buildDocContent(b: DocBuilder, projectTitle: string, groups: CandidateGroups, pitchMap: Map<string, string>) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    b.documentMargins()
    b.brandHeader(LOGO_URL)
    b.title(projectTitle || 'Candidate Presentation')
    b.subtitle(`Updated: ${today}`)

    const sections: { heading: string; candidates: LeverCandidate[]; type: 'presenting' | 'standard' | 'archived' }[] = [
        { heading: 'Client Interview', candidates: groups.interviewing, type: 'standard' },
        { heading: 'Presenting', candidates: groups.presenting, type: 'presenting' },
        { heading: 'Portfolio Interview', candidates: groups.portfolio, type: 'standard' },
        { heading: 'Sourced', candidates: groups.applied, type: 'standard' },
        { heading: 'Client Passed', candidates: groups.clientPassed, type: 'archived' },
        { heading: 'Withdrew', candidates: groups.withdrew, type: 'archived' },
    ]

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i]
        b.sectionHeading(section.heading)
        if (section.candidates.length === 0) {
            b.emptyState('No candidates in this stage.')
            continue
        }
        for (const c of section.candidates) {
            if (section.type === 'presenting') b.candidateEntry(c, { pitch: pitchMap.get(c.id) })
            else if (section.type === 'archived') b.archivedEntry(c)
            else b.candidateEntry(c)
        }
    }
}

// ─── Route Handlers ─────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = await getToken({ req: request })
        if (!token?.accessToken) {
            return NextResponse.json({ exists: false })
        }

        const postingId = params.id
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const drive = google.drive({ version: 'v3', auth })

        const documentId = await findExistingDoc(drive, postingId)
        if (!documentId) {
            return NextResponse.json({ exists: false })
        }

        // Get folder info
        let folderId: string | null = null
        try {
            const file = await drive.files.get({ fileId: documentId, fields: 'parents' })
            folderId = file.data.parents?.[0] || null
        } catch (_) {}

        return NextResponse.json({
            exists: true,
            url: `https://docs.google.com/document/d/${documentId}/edit`,
            folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
            documentId,
        })
    } catch (error) {
        console.error('[Export Doc] Check error:', error)
        return NextResponse.json({ exists: false })
    }
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

        // 1. Fetch candidates & group
        const candidates = await fetchCandidatesForPosting(postingId)
        const groups = groupCandidates(candidates)

        // 2. Fetch job description
        const jobDescription = await fetchJobDescription(postingId)

        // 3. Generate pitches for presenting candidates (role-specific)
        const pitchMap = new Map<string, string>()
        if (groups.presenting.length > 0) {
            // Check for existing role-specific pitches
            const emails = groups.presenting.map(c => c.email).filter(Boolean) as string[]
            const { data: existingPitches } = emails.length > 0
                ? await supabase
                    .from('candidate_pitches')
                    .select('candidate_email, pitch')
                    .in('candidate_email', emails)
                    .eq('posting_id', postingId)
                : { data: [] }

            const existingMap = new Map(
                (existingPitches || []).map(p => [p.candidate_email, p.pitch])
            )

            // Fallback: check legacy pitches on candidate_profiles
            const missingEmails = emails.filter(e => !existingMap.has(e))
            if (missingEmails.length > 0) {
                const { data: legacyPitches } = await supabase
                    .from('candidate_profiles')
                    .select('candidate_email, pitch')
                    .in('candidate_email', missingEmails)
                for (const lp of legacyPitches || []) {
                    if (lp.pitch && lp.pitch.trim()) existingMap.set(lp.candidate_email, lp.pitch)
                }
            }

            await Promise.all(groups.presenting.map(async (c) => {
                try {
                    // Use cached role-specific pitch if available
                    const cached = c.email ? existingMap.get(c.email) : null
                    if (cached) {
                        pitchMap.set(c.id, cached)
                        return
                    }

                    const pitch = await generatePitch({
                        email: c.email || null,
                        candidateName: c.name,
                        jobDescription,
                    })
                    if (pitch) {
                        pitchMap.set(c.id, pitch)
                        // Persist to candidate_pitches for future use
                        if (c.email) {
                            await supabase
                                .from('candidate_pitches')
                                .upsert({
                                    candidate_email: c.email,
                                    posting_id: postingId,
                                    pitch,
                                    updated_at: new Date().toISOString(),
                                }, { onConflict: 'candidate_email,posting_id' })
                        }
                    }
                } catch (err) {
                    console.error(`[Export] Failed to generate pitch for ${c.name}:`, err)
                }
            }))
        }

        // 4. Set up Google APIs
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const docsApi = google.docs({ version: 'v1', auth })
        const drive = google.drive({ version: 'v3', auth })

        // 5. Check for existing doc (sync mode)
        let documentId = await findExistingDoc(drive, postingId)
        let synced = false

        if (documentId) {
            // Clear existing content and re-populate
            await clearDocContent(docsApi, documentId)
            synced = true
            console.log(`[Export] Syncing existing doc ${documentId}`)
        } else {
            // Create new doc
            const docTitle = `Academy Candidate Presentation — ${projectTitle || 'Report'}`
            const doc = await docsApi.documents.create({
                requestBody: { title: docTitle },
            })
            documentId = doc.data.documentId!

            // Tag with posting ID for future sync
            await drive.files.update({
                fileId: documentId,
                requestBody: { appProperties: { academyPostingId: postingId } },
            })
            console.log(`[Export] Created new doc ${documentId}`)
        }

        // 6. Build and apply content
        const b = new DocBuilder()
        buildDocContent(b, projectTitle, groups, pitchMap)

        await docsApi.documents.batchUpdate({
            documentId,
            requestBody: { requests: b.requests },
        })

        // 7. Move to folder (only for new docs)
        let folderId: string | null = null
        if (!synced) {
            try {
                folderId = await ensureFolder(drive)
                const file = await drive.files.get({ fileId: documentId, fields: 'parents' })
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
        } else {
            // Get existing folder ID for the response
            try {
                const file = await drive.files.get({ fileId: documentId, fields: 'parents' })
                folderId = file.data.parents?.[0] || null
            } catch (_) {}
        }

        const docUrl = `https://docs.google.com/document/d/${documentId}/edit`
        const folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null

        return NextResponse.json({
            success: true,
            synced,
            url: docUrl,
            folderUrl,
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
