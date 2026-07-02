// Map a client/team name to its website domain, then pull the logo straight
// from that site's favicon. Shared by the project index, the internal report,
// and the public shared report.

export function teamToDomain(team: string): string {
  const name = (team || '').toLowerCase().trim()

  // Explicit overrides for names that don't map cleanly to "<firstword>.com".
  const overrides: Record<string, string> = {
    'dex screener': 'dexscreener.com',
  }
  if (overrides[name]) return overrides[name]

  // Academy roles → academyux.com
  if (name.includes('academy')) return 'academyux.com'

  // Use the first word as the domain (e.g. "Google DeepMind" → "google.com")
  const firstWord = name.split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') || ''
  return firstWord ? `${firstWord}.com` : ''
}

// Per-browser domain overrides set on the project index page (internal only).
export function getLogoOverride(team: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const overrides = JSON.parse(localStorage.getItem('logo-overrides') || '{}')
    return overrides[(team || '').toLowerCase().trim()] || null
  } catch {
    return null
  }
}

export function resolveLogoDomain(team: string): string {
  return getLogoOverride(team) || teamToDomain(team)
}

// The client's website favicon. Default to the largest size Google serves (256).
// Note: Google upscales to this size but returns whatever resolution the site
// actually ships, so small favicons still look soft — prefer logoDevUrl first.
export function faviconUrl(domain: string, size = 256): string {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`
}

// logo.dev serves crisp, high-resolution brand logos by domain (retina-doubled).
const LOGO_DEV_TOKEN = 'pk_MYqNmj5NQQSYUFupTGVUjQ'
export function logoDevUrl(domain: string, size = 128): string {
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=${size}&format=png&retina=true`
}

// Ordered logo sources to try for a domain: the crisp logo.dev brand logo
// first, then the website favicon as a fallback.
export function logoSources(domain: string): string[] {
  if (!domain) return []
  return [logoDevUrl(domain), faviconUrl(domain, 256)]
}

// ---- Server-side logo config (client_logos table via /api/logos) ----
// Uploaded logo wins over everything; a server domain override wins over the
// per-browser localStorage override, which wins over the name heuristic.

export type LogoSource = 'upload' | 'logodev' | 'favicon'

export interface LogoConfig {
  domain?: string | null
  logoUrl?: string | null // public URL of an uploaded logo
  source?: LogoSource | null // preferred source; null = auto (upload if present, else logo.dev → favicon)
}

export const teamKey = (team: string) => (team || '').toLowerCase().trim()

let logoMapPromise: Promise<Record<string, LogoConfig>> | null = null
export function fetchLogoMap(force = false): Promise<Record<string, LogoConfig>> {
  if (typeof window === 'undefined') return Promise.resolve({})
  if (!logoMapPromise || force) {
    logoMapPromise = fetch('/api/logos')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return logoMapPromise
}

export function logoSourcesFor(team: string, cfg?: LogoConfig | null): string[] {
  const domain = cfg?.domain || getLogoOverride(team) || teamToDomain(team)
  const upload = cfg?.logoUrl || null
  // Preferred source first; the rest stay as onError fallbacks.
  switch (cfg?.source) {
    case 'favicon':
      return domain ? [faviconUrl(domain, 256), logoDevUrl(domain)] : upload ? [upload] : []
    case 'logodev':
      return domain ? [logoDevUrl(domain), faviconUrl(domain, 256)] : upload ? [upload] : []
    case 'upload':
      return upload ? [upload, ...logoSources(domain)] : logoSources(domain)
    default:
      return upload ? [upload, ...logoSources(domain)] : logoSources(domain)
  }
}
