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

// Ordered logo sources to try for a domain: the website favicon first, then the
// logo.dev brand logo as a fallback.
export function logoSources(domain: string): string[] {
  if (!domain) return []
  return [faviconUrl(domain, 256), logoDevUrl(domain)]
}
