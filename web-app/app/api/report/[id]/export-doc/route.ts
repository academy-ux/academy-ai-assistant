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
    phoneScreen: LeverCandidate[]
    interviewing: LeverCandidate[]
    portfolio: LeverCandidate[]
    applied: LeverCandidate[]
    clientPassed: LeverCandidate[]
    withdrew: LeverCandidate[]
}

function groupCandidates(candidates: LeverCandidate[]): CandidateGroups {
    const groups: CandidateGroups = {
        presenting: [], phoneScreen: [], interviewing: [], portfolio: [],
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
        else if (stage.includes('phone screen') || stage.includes('phone_screen')) groups.phoneScreen.push(c)
        else if (stage.includes('present') || stage.includes('client') || stage.includes('offer')) groups.presenting.push(c)
        else if (stage.includes('new') || stage.includes('applicant') || stage.includes('applied') || stage.includes('lead')) return
        else groups.applied.push(c)
    })

    return groups
}

interface CandidateLinks {
    linkedin: string | null
    portfolio: string | null
    otherLinks: { label: string; url: string }[]
}

function getCandidateLinks(c: LeverCandidate): CandidateLinks {
    let linkedin: string | null = null
    let portfolio: string | null = null
    const otherLinks: { label: string; url: string }[] = []

    for (const link of c.links || []) {
        const url = typeof link === 'string' ? link : link.url
        if (!url) continue
        const lower = url.toLowerCase()

        if (lower.includes('linkedin.com')) {
            if (!linkedin) linkedin = url
        } else if (lower.includes('github.com')) {
            otherLinks.push({ label: 'GitHub', url })
        } else if (lower.includes('dribbble.com')) {
            otherLinks.push({ label: 'Dribbble', url })
        } else if (lower.includes('behance.net')) {
            otherLinks.push({ label: 'Behance', url })
        } else if (lower.includes('instagram.com')) {
            otherLinks.push({ label: 'Instagram', url })
        } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
            otherLinks.push({ label: 'X', url })
        } else if (lower.includes('read.cv')) {
            otherLinks.push({ label: 'Read.cv', url })
        } else if (!portfolio) {
            portfolio = url
        } else {
            // Try to derive a label from the domain
            try {
                const domain = new URL(url).hostname.replace('www.', '')
                otherLinks.push({ label: domain, url })
            } catch {
                otherLinks.push({ label: 'Link', url })
            }
        }
    }
    return { linkedin, portfolio, otherLinks }
}

// ─── Fingerprinting ─────────────────────────────────────────────

function simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash).toString(36)
}

// Bump STYLE_VERSION to force re-render of all candidates on next sync
const STYLE_VERSION = 2

function candidateFingerprint(c: LeverCandidate, opts: { pitch?: string; password?: string; experience?: string }): string {
    return simpleHash([
        `v${STYLE_VERSION}`,
        c.name, c.headline || '', typeof c.location === 'string' ? c.location : '',
        (c.links || []).map(l => l.url).join(','),
        opts.pitch || '', opts.password || '', opts.experience || '',
    ].join('|'))
}

// ─── Document Builder ────────────────────────────────────────────

class DocBuilder {
    requests: any[] = []
    idx: number
    private _rangeStarts = new Map<string, number>()

    constructor(startIdx = 1) {
        this.idx = startIdx
    }

    startRange(name: string) {
        this._rangeStarts.set(name, this.idx)
        return this
    }

    endRange(name: string) {
        const start = this._rangeStarts.get(name)
        if (start !== undefined) {
            this.requests.push({
                createNamedRange: {
                    name,
                    range: { startIndex: start, endIndex: this.idx }
                }
            })
            this._rangeStarts.delete(name)
        }
        return this
    }

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

    linkInline(label: string, url: string) {
        this.styledText(' | ', {
            foregroundColor: { color: { rgbColor: COLORS.warmGray } },
            fontSize: { magnitude: PT.bodyText, unit: 'PT' },
            italic: false,
            underline: false,
        }, 'foregroundColor,fontSize,italic,underline')
        const start = this.idx
        this.text(label)
        this.requests.push({
            updateTextStyle: {
                range: { startIndex: start, endIndex: this.idx },
                textStyle: {
                    link: { url },
                    foregroundColor: { color: { rgbColor: COLORS.link } },
                    fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                    weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                    italic: false,
                    underline: true,
                },
                fields: 'link,foregroundColor,fontSize,weightedFontFamily,italic,underline',
            }
        })
        return this
    }

    candidateEntry(c: LeverCandidate, opts?: { pitch?: string; password?: string; experience?: string }) {
        const { linkedin, portfolio, otherLinks } = getCandidateLinks(c)
        const location = typeof c.location === 'string' ? c.location : ''
        const headline = c.headline || ''

        // ── Single line: **Name** — Headline | LinkedIn | Portfolio | ... ──
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

        if (headline) {
            this.styledText(` — ${headline}`, {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,weightedFontFamily,italic,underline')
        }

        if (linkedin) this.linkInline('LinkedIn', linkedin)
        if (portfolio) this.linkInline('Portfolio', portfolio)
        for (const link of otherLinks) this.linkInline(link.label, link.url)

        if (opts?.password) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,italic,underline')
            this.styledText('PW: ', {
                bold: true,
                foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                italic: false,
                underline: false,
            }, 'bold,foregroundColor,fontSize,weightedFontFamily,italic,underline')
            this.styledText(opts.password, {
                foregroundColor: { color: { rgbColor: COLORS.body } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,weightedFontFamily,italic,underline')
        }

        if (location) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,italic,underline')
            this.styledText('Location: ', {
                bold: true,
                foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                italic: false,
                underline: false,
            }, 'bold,foregroundColor,fontSize,weightedFontFamily,italic,underline')
            this.styledText(location, {
                foregroundColor: { color: { rgbColor: COLORS.body } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,weightedFontFamily,italic,underline')
        }

        if (opts?.experience) {
            this.styledText(' | ', {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,italic,underline')
            this.styledText('Experience: ', {
                bold: true,
                foregroundColor: { color: { rgbColor: COLORS.charcoal } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 700 },
                italic: false,
                underline: false,
            }, 'bold,foregroundColor,fontSize,weightedFontFamily,italic,underline')
            this.styledText(opts.experience, {
                foregroundColor: { color: { rgbColor: COLORS.body } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                weightedFontFamily: { fontFamily: FONTS.body, weight: 400 },
                italic: false,
                underline: false,
            }, 'foregroundColor,fontSize,weightedFontFamily,italic,underline')
        }

        this.newline()

        // If no pitch, add bottom border to the name line itself
        if (!opts?.pitch) {
            this.paragraphStyle(lineStart, {
                spaceAbove: { magnitude: 12, unit: 'PT' },
                spaceBelow: { magnitude: 8, unit: 'PT' },
                borderBottom: {
                    color: { color: { rgbColor: COLORS.divider } },
                    width: { magnitude: 0.5, unit: 'PT' },
                    padding: { magnitude: 4, unit: 'PT' },
                    dashStyle: 'SOLID',
                },
            }, 'spaceAbove,spaceBelow,borderBottom')
        } else {
            this.paragraphStyle(lineStart, {
                spaceAbove: { magnitude: 12, unit: 'PT' },
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
                    textStyle: { fontSize: { magnitude: 4, unit: 'PT' }, italic: false, underline: false },
                    fields: 'fontSize,italic,underline',
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
                        italic: false,
                        underline: false,
                    },
                    fields: 'fontSize,weightedFontFamily,foregroundColor,italic,underline',
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
        const { linkedin, portfolio, otherLinks } = getCandidateLinks(c)
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

        if (linkedin) this.linkInline('LinkedIn', linkedin)
        if (portfolio) this.linkInline('Portfolio', portfolio)
        for (const link of otherLinks) this.linkInline(link.label, link.url)
        if (location) {
            this.styledText(' | ', { foregroundColor: { color: { rgbColor: COLORS.warmGray } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
            this.styledText('Location: ', { bold: true, foregroundColor: { color: { rgbColor: COLORS.charcoal } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, weightedFontFamily: { fontFamily: FONTS.body, weight: 700 }, underline: false }, 'bold,foregroundColor,fontSize,weightedFontFamily,underline')
            this.styledText(location, { foregroundColor: { color: { rgbColor: COLORS.body } }, fontSize: { magnitude: PT.bodyText, unit: 'PT' }, underline: false }, 'foregroundColor,fontSize,underline')
        }
        if (reason) {
            this.styledText(` (${reason})`, {
                foregroundColor: { color: { rgbColor: COLORS.warmGray } },
                fontSize: { magnitude: PT.bodyText, unit: 'PT' },
                italic: false,
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
                    italic: false,
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

function buildDocContent(b: DocBuilder, projectTitle: string, groups: CandidateGroups, pitchMap: Map<string, string>, passwordMap: Map<string, string>, experienceMap: Map<string, string>) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    b.documentMargins()
    b.brandHeader(LOGO_URL)
    b.title(projectTitle || 'Candidate Presentation')
    b.subtitle(`Updated: ${today}`)

    const sections: { key: string; heading: string; candidates: LeverCandidate[]; type: 'presenting' | 'standard' | 'archived' }[] = [
        { key: 'interviewing', heading: 'Client Interview', candidates: groups.interviewing, type: 'standard' },
        { key: 'presenting', heading: 'Presenting', candidates: groups.presenting, type: 'presenting' },
        { key: 'portfolio', heading: 'Portfolio Interview', candidates: groups.portfolio, type: 'standard' },
        { key: 'phoneScreen', heading: 'Phone Screen', candidates: groups.phoneScreen, type: 'standard' },
        { key: 'applied', heading: 'In Review', candidates: groups.applied, type: 'standard' },
        { key: 'clientPassed', heading: 'Client Passed', candidates: groups.clientPassed, type: 'archived' },
        { key: 'withdrew', heading: 'Withdrew', candidates: groups.withdrew, type: 'archived' },
    ]

    for (const section of sections) {
        b.sectionHeading(section.heading)
        b.startRange(`section__${section.key}__body`)

        if (section.candidates.length === 0) {
            b.emptyState('No candidates in this stage.')
        } else {
            for (const c of section.candidates) {
                const pw = c.email ? passwordMap.get(c.email) : undefined
                const exp = c.email ? experienceMap.get(c.email) : undefined
                const opts = {
                    pitch: section.type === 'presenting' ? pitchMap.get(c.id) : undefined,
                    password: pw,
                    experience: exp,
                }
                const hash = candidateFingerprint(c, opts)

                b.startRange(`candidate__${c.id}__${hash}`)
                if (section.type === 'archived') b.archivedEntry(c)
                else b.candidateEntry(c, opts)
                b.endRange(`candidate__${c.id}__${hash}`)
            }
        }

        b.endRange(`section__${section.key}__body`)
    }
}

// ─── Surgical Sync (comment-preserving) ─────────────────────────

interface ExistingCandidateRange {
    rangeId: string
    start: number
    end: number
    hash: string
}

interface CandidateSyncData {
    c: LeverCandidate
    sectionKey: string
    type: 'presenting' | 'standard' | 'archived'
    opts: { pitch?: string; password?: string; experience?: string }
    hash: string
}

const SECTION_DEFS: { key: string; groupKey: keyof CandidateGroups }[] = [
    { key: 'interviewing', groupKey: 'interviewing' },
    { key: 'presenting', groupKey: 'presenting' },
    { key: 'portfolio', groupKey: 'portfolio' },
    { key: 'phoneScreen', groupKey: 'phoneScreen' },
    { key: 'applied', groupKey: 'applied' },
    { key: 'clientPassed', groupKey: 'clientPassed' },
    { key: 'withdrew', groupKey: 'withdrew' },
]

const SECTION_TYPE: Record<string, 'presenting' | 'standard' | 'archived'> = {
    interviewing: 'standard',
    presenting: 'presenting',
    portfolio: 'standard',
    phoneScreen: 'standard',
    applied: 'standard',
    clientPassed: 'archived',
    withdrew: 'archived',
}

/**
 * Attempt a surgical sync that preserves Google Doc comments on unchanged candidates.
 * Returns true if successful, false if the doc lacks named ranges (old format → fall back).
 */
async function syncDocSurgical(
    docsApi: any,
    documentId: string,
    groups: CandidateGroups,
    pitchMap: Map<string, string>,
    passwordMap: Map<string, string>,
    experienceMap: Map<string, string>,
): Promise<boolean> {
    // 1. Read existing document and its named ranges
    const doc = await docsApi.documents.get({ documentId })
    const namedRangesMap: Record<string, any> = doc.data.namedRanges || {}

    // Parse candidate ranges (candidate__{id}__{hash})
    const existingCandidates = new Map<string, ExistingCandidateRange>()
    // Parse section body ranges (section__{key}__body)
    const sectionBodies = new Map<string, { rangeId: string; start: number; end: number }>()

    for (const [name, data] of Object.entries(namedRangesMap)) {
        const nrs = data.namedRanges || []
        const nr = nrs[0]
        const r = nr?.ranges?.[0]
        if (!r) continue

        const candidateMatch = name.match(/^candidate__(.+?)__(.+)$/)
        if (candidateMatch) {
            existingCandidates.set(candidateMatch[1], {
                rangeId: nr.namedRangeId,
                start: r.startIndex,
                end: r.endIndex,
                hash: candidateMatch[2],
            })
            continue
        }

        const sectionMatch = name.match(/^section__(.+?)__body$/)
        if (sectionMatch) {
            sectionBodies.set(sectionMatch[1], {
                rangeId: nr.namedRangeId,
                start: r.startIndex,
                end: r.endIndex,
            })
        }
    }

    // No named ranges → old-format doc, caller should fall back to clear-and-rebuild
    if (existingCandidates.size === 0 && sectionBodies.size === 0) return false

    // 2. Build fingerprints for all current candidates
    const currentCandidates: CandidateSyncData[] = []

    for (const def of SECTION_DEFS) {
        const type = SECTION_TYPE[def.key]
        for (const c of groups[def.groupKey]) {
            const pw = c.email ? passwordMap.get(c.email) : undefined
            const exp = c.email ? experienceMap.get(c.email) : undefined
            const pitch = type === 'presenting' ? pitchMap.get(c.id) : undefined
            const opts = { pitch, password: pw, experience: exp }
            const hash = candidateFingerprint(c, opts)
            currentCandidates.push({ c, sectionKey: def.key, type, opts, hash })
        }
    }

    const currentById = new Map(currentCandidates.map(cc => [cc.c.id, cc]))

    // 3. Diff: unchanged / updated / added / removed
    const toUpdate: CandidateSyncData[] = []
    const toAdd: CandidateSyncData[] = []
    const rangesToDelete: { rangeId: string; start: number; end: number }[] = []

    for (const cc of currentCandidates) {
        const existing = existingCandidates.get(cc.c.id)
        if (!existing) {
            toAdd.push(cc)
        } else if (existing.hash !== cc.hash) {
            toUpdate.push(cc)
            rangesToDelete.push(existing) // old content will be removed
        }
        // else: unchanged → skip, comments preserved
    }

    for (const [id, range] of existingCandidates) {
        if (!currentById.has(id)) {
            rangesToDelete.push(range) // candidate removed entirely
        }
    }

    // Nothing changed → done
    if (toUpdate.length === 0 && toAdd.length === 0 && rangesToDelete.length === 0) {
        return true
    }

    // If every candidate needs updating (e.g. style version bump), fall back to
    // full clear-and-rebuild — surgical sync can corrupt the doc when it deletes
    // all content and tries to re-insert into destroyed section ranges.
    const unchangedCount = existingCandidates.size - toUpdate.length - (rangesToDelete.length - toUpdate.length)
    if (unchangedCount === 0 && existingCandidates.size > 0) {
        console.log(`[Sync] All ${existingCandidates.size} candidates changed — falling back to full rebuild`)
        return false
    }

    console.log(`[Sync] Surgical: ${toUpdate.length} updated, ${toAdd.length} added, ${rangesToDelete.length - toUpdate.length} removed, ${unchangedCount} unchanged`)

    // 4. PASS 1 — Delete changed/removed candidate ranges (back-to-front so indices stay valid)
    if (rangesToDelete.length > 0) {
        const sorted = [...rangesToDelete].sort((a, b) => b.start - a.start)
        const deleteRequests: any[] = []
        for (const range of sorted) {
            deleteRequests.push({ deleteNamedRange: { namedRangeId: range.rangeId } })
            if (range.end > range.start) {
                deleteRequests.push({
                    deleteContentRange: {
                        range: { startIndex: range.start, endIndex: range.end }
                    }
                })
            }
        }
        await docsApi.documents.batchUpdate({
            documentId,
            requestBody: { requests: deleteRequests },
        })
    }

    // 5. PASS 2 — Insert new/updated candidates
    const toInsert = [...toUpdate, ...toAdd]
    if (toInsert.length > 0) {
        // Re-read doc to get updated indices after deletions
        const updatedDoc = await docsApi.documents.get({ documentId })
        const updatedRangesMap: Record<string, any> = updatedDoc.data.namedRanges || {}

        // Re-parse section body ranges with fresh indices
        const freshSectionBodies = new Map<string, { start: number; end: number }>()
        for (const [name, data] of Object.entries(updatedRangesMap)) {
            const match = name.match(/^section__(.+?)__body$/)
            if (!match) continue
            const nr = data.namedRanges?.[0]
            const r = nr?.ranges?.[0]
            if (r) freshSectionBodies.set(match[1], { start: r.startIndex, end: r.endIndex })
        }

        // Group insertions by section
        const insertBySec = new Map<string, CandidateSyncData[]>()
        for (const cc of toInsert) {
            const list = insertBySec.get(cc.sectionKey) || []
            list.push(cc)
            insertBySec.set(cc.sectionKey, list)
        }

        // Build insertion requests per section, back-to-front by section position
        const sectionEntries = [...insertBySec.entries()]
            .map(([key, candidates]) => ({ key, candidates, body: freshSectionBodies.get(key) }))
            .filter(s => s.body)
            .sort((a, b) => b.body!.end - a.body!.end)

        const allInsertRequests: any[] = []

        for (const sec of sectionEntries) {
            // Insert at end of section body — just before the body's end index
            // The section body range includes existing candidates + any empty state text
            const insertAt = sec.body!.end
            const mini = new DocBuilder(insertAt)

            for (const cc of sec.candidates) {
                mini.startRange(`candidate__${cc.c.id}__${cc.hash}`)
                if (cc.type === 'archived') mini.archivedEntry(cc.c)
                else mini.candidateEntry(cc.c, cc.opts)
                mini.endRange(`candidate__${cc.c.id}__${cc.hash}`)
            }

            allInsertRequests.push(...mini.requests)
        }

        if (allInsertRequests.length > 0) {
            await docsApi.documents.batchUpdate({
                documentId,
                requestBody: { requests: allInsertRequests },
            })
        }
    }

    // 6. Handle sections that became empty (add empty state) or gained candidates (remove empty state)
    // Re-read one more time to handle empty state transitions
    const finalDoc = await docsApi.documents.get({ documentId })
    const finalRangesMap: Record<string, any> = finalDoc.data.namedRanges || {}

    const emptyStateRequests: any[] = []

    for (const def of SECTION_DEFS) {
        const sectionHasCandidates = groups[def.groupKey].length > 0
        const bodyRange = (() => {
            const data = finalRangesMap[`section__${def.key}__body`]
            const nr = data?.namedRanges?.[0]
            return nr?.ranges?.[0]
        })()
        if (!bodyRange) continue

        // Check if any candidate named ranges exist within this section body
        const hasCandidateRanges = [...Object.keys(finalRangesMap)].some(name => {
            if (!name.startsWith('candidate__')) return false
            const nr = finalRangesMap[name]?.namedRanges?.[0]
            const r = nr?.ranges?.[0]
            return r && r.startIndex >= bodyRange.startIndex && r.endIndex <= bodyRange.endIndex
        })

        // If section body has content but no candidates and no empty state → needs empty state
        // We approximate by checking if the body range is "small" (just whitespace) and has no candidates
        if (!sectionHasCandidates && !hasCandidateRanges) {
            const bodyLength = bodyRange.endIndex - bodyRange.startIndex
            // If body is very small (< 10 chars, likely just whitespace), inject empty state
            if (bodyLength < 10) {
                const mini = new DocBuilder(bodyRange.startIndex)
                mini.emptyState('No candidates in this stage.')
                emptyStateRequests.push(...mini.requests)
            }
        }
    }

    if (emptyStateRequests.length > 0) {
        await docsApi.documents.batchUpdate({
            documentId,
            requestBody: { requests: emptyStateRequests },
        })
    }

    return true
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
        const { projectTitle, forceNew } = body

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

        // Collect all emails once for subsequent lookups
        const allEmails = candidates.map(c => c.email).filter(Boolean) as string[]

        // 4. Fetch cached years of experience from Supabase
        const experienceMap = new Map<string, string>()
        if (allEmails.length > 0) {
            const { data: profiles } = await supabase
                .from('candidate_profiles')
                .select('candidate_email, years_of_experience')
                .in('candidate_email', allEmails)
            for (const p of profiles || []) {
                if (p.years_of_experience) {
                    try {
                        const exp = JSON.parse(p.years_of_experience)
                        if (exp.relevantYears !== undefined || exp.totalYears !== undefined) {
                            const years = exp.relevantYears ?? exp.totalYears
                            experienceMap.set(p.candidate_email, `${years} yrs${exp.summary ? ` — ${exp.summary}` : ''}`)
                        }
                    } catch { /* not JSON, skip */ }
                }
            }
        }

        // 5. Fetch portfolio passwords
        const passwordMap = new Map<string, string>()
        if (allEmails.length > 0) {
            const { data: passwords } = await supabase
                .from('candidate_passwords')
                .select('candidate_email, password')
                .in('candidate_email', allEmails)
            for (const p of passwords || []) {
                if (p.password) passwordMap.set(p.candidate_email, p.password)
            }
        }

        // 6. Scan Lever notes & emails for passwords not yet in our DB
        const leverKey = process.env.LEVER_API_KEY
        if (leverKey) {
            const leverAuth = `Basic ${Buffer.from(leverKey + ':').toString('base64')}`
            const BATCH_SIZE = 5
            for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
                const batch = candidates.slice(i, i + BATCH_SIZE)
                await Promise.allSettled(batch.map(async (c) => {
                    if (!c.email || passwordMap.has(c.email)) return

                    // Fetch notes and emails in parallel for this candidate
                    const [notesRes, emailsRes] = await Promise.allSettled([
                        fetch(`https://api.lever.co/v1/opportunities/${c.id}/notes`, {
                            headers: { 'Authorization': leverAuth, 'Content-Type': 'application/json' }
                        }),
                        fetch(`https://api.lever.co/v1/opportunities/${c.id}/emails`, {
                            headers: { 'Authorization': leverAuth, 'Content-Type': 'application/json' }
                        }),
                    ])

                    const textsToScan: string[] = []

                    if (notesRes.status === 'fulfilled' && notesRes.value.ok) {
                        const notesData = await notesRes.value.json()
                        for (const note of notesData.data || []) {
                            const text = (note.text || '').replace(/<[^>]*>/g, ' ')
                            if (text.trim()) textsToScan.push(text)
                        }
                    }

                    if (emailsRes.status === 'fulfilled' && emailsRes.value.ok) {
                        const emailsData = await emailsRes.value.json()
                        for (const email of emailsData.data || []) {
                            const subject = email.subject || ''
                            const body = (email.strippedText || email.text || '').replace(/<[^>]*>/g, ' ')
                            if (subject.trim()) textsToScan.push(subject)
                            if (body.trim()) textsToScan.push(body)
                        }
                    }

                    // Scan for password patterns
                    const pwPattern = /(?:password|passcode|pw|pass)\s*(?:is|:|=|–|-|—)\s*["']?([^\s"',;]{2,64})["']?/i
                    for (const text of textsToScan) {
                        const match = text.match(pwPattern)
                        if (match?.[1]) {
                            passwordMap.set(c.email, match[1])
                            // Persist to Supabase for future exports
                            await supabase
                                .from('candidate_passwords')
                                .upsert({
                                    candidate_email: c.email,
                                    password: match[1],
                                    updated_at: new Date().toISOString(),
                                }, { onConflict: 'candidate_email' })
                            break
                        }
                    }
                }))
            }
        }

        // 7. Set up Google APIs
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: token.accessToken as string })
        const docsApi = google.docs({ version: 'v1', auth })
        const drive = google.drive({ version: 'v3', auth })

        // 8. Check for existing doc (sync mode)
        // Force new doc creation to recover from corrupted sync
        let documentId: string | null = null
        if (!forceNew) {
            documentId = await findExistingDoc(drive, postingId)
        }
        // TEMP: Always create fresh to fix corrupted docs
        documentId = null
        let synced = false

        if (documentId) {
            // Try surgical sync first (preserves comments on unchanged candidates)
            const surgicalOk = await syncDocSurgical(
                docsApi, documentId, groups, pitchMap, passwordMap, experienceMap,
            )

            if (surgicalOk) {
                synced = true
                console.log(`[Export] Surgical sync completed for doc ${documentId}`)
            } else {
                // Fallback: clear and rebuild (old doc without named ranges)
                await clearDocContent(docsApi, documentId)
                synced = true
                console.log(`[Export] Fallback clear-and-rebuild for doc ${documentId}`)

                const b = new DocBuilder()
                buildDocContent(b, projectTitle, groups, pitchMap, passwordMap, experienceMap)
                await docsApi.documents.batchUpdate({
                    documentId,
                    requestBody: { requests: b.requests },
                })
            }
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

            // Build and apply content with named ranges
            const b = new DocBuilder()
            buildDocContent(b, projectTitle, groups, pitchMap, passwordMap, experienceMap)
            await docsApi.documents.batchUpdate({
                documentId,
                requestBody: { requests: b.requests },
            })
        }

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
    } catch (error: any) {
        console.error('[Export Doc] Error:', error)
        // Detect expired / revoked Google OAuth tokens
        const status = error?.code || error?.response?.status
        const errMsg = error?.message || error?.response?.data?.error_description || ''
        if (status === 401 || /invalid.credentials|token.*expired|token.*revoked/i.test(errMsg)) {
            return NextResponse.json(
                { error: 'Your Google session has expired. Please sign out and sign back in.', code: 'TOKEN_EXPIRED' },
                { status: 401 }
            )
        }
        const message = error instanceof Error ? error.message : 'Failed to export document'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
