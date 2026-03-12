#!/usr/bin/env node
/**
 * Profile Scraper — a1.gallery, Awwwards Directory, Awwwards Jury
 * Outputs Lever.co / Juicebox.ai compatible CSVs
 *
 * Usage:
 *   node scrape.mjs --source all|a1|dir|jury [--max-pages N] [--headless] [--skip-profiles]
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// ─── CLI Args ────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const SOURCE = getArg('source', 'all');
const MAX_PAGES = parseInt(getArg('max-pages', '999'), 10);
const HEADLESS = args.includes('--headless');
const SKIP_PROFILES = args.includes('--skip-profiles');
const DELAY = 1500; // ms between page loads

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

// ─── Social Link Filters ────────────────────────────────
// These prevent capturing site-owned links (Awwwards footer, share buttons)
function isAwwwardsSocial(url) {
  const lower = url.toLowerCase();
  return (
    lower.includes('/awwwards') ||
    lower.includes('/shareArticle') ||
    lower.includes('/intent/tweet') ||
    lower.includes('share?url=')
  );
}

function isLinkedinProfile(url) {
  return url.includes('linkedin.com/in/') && !isAwwwardsSocial(url);
}

function isTwitterProfile(url) {
  const lower = url.toLowerCase();
  return (
    (lower.includes('twitter.com/') || lower.includes('x.com/')) &&
    !isAwwwardsSocial(lower) &&
    !lower.includes('twitter.com/awwwards') &&
    !lower.includes('x.com/awwwards')
  );
}

function isInstagramProfile(url) {
  const lower = url.toLowerCase();
  return (
    lower.includes('instagram.com/') &&
    !lower.includes('instagram.com/awwwards')
  );
}

// ─── Name Splitter ───────────────────────────────────────
function splitName(full) {
  if (!full) return { first: '', last: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// ─── Dedup by Name ───────────────────────────────────────
function dedup(profiles) {
  const map = new Map();
  for (const p of profiles) {
    const key = (p.fullName || '').toLowerCase().trim();
    if (!key) continue;
    if (map.has(key)) {
      const existing = map.get(key);
      // merge: keep non-empty values, prefer newer
      for (const [k, v] of Object.entries(p)) {
        if (v && (!existing[k] || existing[k] === '')) existing[k] = v;
      }
    } else {
      map.set(key, { ...p });
    }
  }
  return [...map.values()];
}

// ─── CSV Export (Lever/Juicebox compatible) ──────────────
const CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Full Name',
  'Email',
  'Title',
  'Location',
  'LinkedIn URL',
  'Twitter URL',
  'Instagram URL',
  'Website',
  'Profile URL',
  'Source',
];

function escapeCSV(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportCSV(profiles, filename) {
  const rows = [CSV_HEADERS.join(',')];
  for (const p of profiles) {
    const { first, last } = splitName(p.fullName);
    rows.push(
      [
        first,
        last,
        p.fullName || '',
        p.email || '',
        p.title || '',
        p.location || '',
        p.linkedin || '',
        p.twitter || '',
        p.instagram || '',
        p.website || '',
        p.profileUrl || '',
        p.source || '',
      ]
        .map(escapeCSV)
        .join(',')
    );
  }
  const path = resolve(process.cwd(), filename);
  writeFileSync(path, rows.join('\n'), 'utf-8');
  console.log(`  ✓ Wrote ${profiles.length} profiles → ${path}`);
}

function exportJSON(profiles, filename) {
  const path = resolve(process.cwd(), filename);
  writeFileSync(path, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log(`  ✓ Wrote ${profiles.length} profiles → ${path}`);
}

// ═══════════════════════════════════════════════════════════
// 1. A1 Gallery  — infinite scroll
// ═══════════════════════════════════════════════════════════
async function scrapeA1Gallery(browser) {
  console.log('\n🎨 Scraping a1.gallery/profiles ...');
  const page = await browser.newPage();
  await page.goto('https://www.a1.gallery/profiles', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await sleep(3000);

  // Infinite scroll — keep scrolling until no new items
  let prevCount = 0;
  let stableRounds = 0;
  while (stableRounds < 5) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
    const count = await page.$$eval(
      '.profiles-item-wrapper',
      (els) => els.length
    );
    console.log(`  scroll: ${count} profiles loaded`);
    if (count === prevCount) stableRounds++;
    else stableRounds = 0;
    prevCount = count;
  }

  // Extract profile data from listing
  const profiles = await page.$$eval('.profiles-item-wrapper', (wrappers) =>
    wrappers.map((w) => {
      const nameEl = w.querySelector('h2, h3, .heading-style-h4');
      const name = nameEl?.textContent?.trim() || '';
      const link = w.querySelector('a[href*="/creator/"]');
      const profileUrl = link ? link.href : '';
      const text = w.textContent || '';

      // Social links within the card
      const anchors = [...w.querySelectorAll('a[href]')];
      const linkedin =
        anchors.find((a) => a.href.includes('linkedin.com/in/'))?.href || '';
      const twitter =
        anchors.find(
          (a) =>
            (a.href.includes('twitter.com/') || a.href.includes('x.com/')) &&
            !a.href.includes('awwwards')
        )?.href || '';
      const instagram =
        anchors.find(
          (a) =>
            a.href.includes('instagram.com/') &&
            !a.href.includes('awwwards')
        )?.href || '';
      const website =
        anchors.find(
          (a) =>
            !a.href.includes('a1.gallery') &&
            !a.href.includes('linkedin') &&
            !a.href.includes('twitter') &&
            !a.href.includes('x.com') &&
            !a.href.includes('instagram') &&
            a.href.startsWith('http')
        )?.href || '';

      return {
        fullName: name,
        email: '',
        title: '',
        location: '',
        linkedin,
        twitter,
        instagram,
        website,
        profileUrl,
        source: 'a1.gallery',
      };
    })
  );

  // Visit individual profiles for bios/location (optional)
  if (!SKIP_PROFILES) {
    let visited = 0;
    for (const p of profiles) {
      if (!p.profileUrl) continue;
      try {
        await page.goto(p.profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await sleep(1000);
        const details = await page.evaluate(() => {
          const bio =
            document.querySelector('.creator-bio, .bio, [class*="bio"]')
              ?.textContent?.trim() || '';
          const loc =
            document.querySelector(
              '.creator-location, [class*="location"]'
            )?.textContent?.trim() || '';
          const title =
            document.querySelector('.creator-title, [class*="title"]')
              ?.textContent?.trim() || '';

          // Social links on profile page
          const anchors = [...document.querySelectorAll('a[href]')];
          const linkedin =
            anchors.find((a) => a.href.includes('linkedin.com/in/'))?.href ||
            '';
          const twitter =
            anchors.find(
              (a) =>
                (a.href.includes('twitter.com/') ||
                  a.href.includes('x.com/')) &&
                !a.href.includes('awwwards')
            )?.href || '';
          const instagram =
            anchors.find(
              (a) =>
                a.href.includes('instagram.com/') &&
                !a.href.includes('awwwards')
            )?.href || '';

          return { bio, loc, title, linkedin, twitter, instagram };
        });

        if (details.loc && !p.location) p.location = details.loc;
        if (details.title && !p.title) p.title = details.title;
        if (details.linkedin && !p.linkedin) p.linkedin = details.linkedin;
        if (details.twitter && !p.twitter) p.twitter = details.twitter;
        if (details.instagram && !p.instagram) p.instagram = details.instagram;
        visited++;
        if (visited % 20 === 0)
          console.log(`  visited ${visited}/${profiles.length} profiles`);
      } catch (e) {
        // skip failed profile visits
      }
      await sleep(DELAY);
    }
    console.log(`  visited ${visited} individual profiles`);
  }

  await page.close();
  console.log(`  ✓ a1.gallery: ${profiles.length} profiles`);
  return profiles;
}

// ═══════════════════════════════════════════════════════════
// 2. Awwwards Directory — paginated (.card-directory cards)
// ═══════════════════════════════════════════════════════════
async function scrapeAwwwardsDirectory(browser) {
  console.log('\n📂 Scraping Awwwards Directory (freelance) ...');
  const page = await browser.newPage();
  const allProfiles = [];
  let pageNum = 1;

  while (pageNum <= MAX_PAGES) {
    const url = `https://www.awwwards.com/directory/freelance/?page=${pageNum}`;
    console.log(`  page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      // Dismiss cookie banner if present
      try {
        const rejectBtn = await page.$('button:has-text("Reject"), button:has-text("reject")');
        if (rejectBtn) await rejectBtn.click();
      } catch (e) {}

      // Check if page has cards
      const cards = await page.$$('.js-ajax-entries > li');
      if (cards.length === 0) {
        console.log(`  no cards found on page ${pageNum}, stopping`);
        break;
      }

      // Extract data from listing cards
      const pageProfiles = await page.$$eval(
        '.js-ajax-entries > li',
        (items) =>
          items.map((li) => {
            const text = li.textContent.replace(/\s+/g, ' ').trim();
            const profileLink = li.querySelector('a')?.href || '';
            const allLinks = [...li.querySelectorAll('a')];

            // Name: second link usually has the person/agency name
            const nameLink = allLinks.find(
              (a) =>
                a.textContent.trim().length > 1 &&
                a.href.includes('awwwards.com/') &&
                !a.href.includes('/directory')
            );
            // Clean name: collapse whitespace, strip "PRO" badge text
            const rawName = nameLink?.textContent?.replace(/\s+/g, ' ').trim() || '';
            const fullName = rawName.replace(/\s*PRO\s*$/, '').trim();

            // Location: extract from card text pattern "Location XXXX Website"
            const locMatch = text.match(/Location\s+(.+?)\s+Website/);
            const location = locMatch ? locMatch[1].trim() : '';

            // Website: extract from card text pattern "Website xxxx.com"
            const websiteLink = allLinks.find(
              (a) =>
                a.href &&
                !a.href.includes('awwwards.com') &&
                a.href.startsWith('http')
            );
            const website = websiteLink?.href || '';

            return {
              fullName,
              email: '',
              title: '',
              location,
              linkedin: '',
              twitter: '',
              instagram: '',
              website,
              profileUrl: profileLink,
              source: 'awwwards_directory',
            };
          })
      );

      allProfiles.push(...pageProfiles);
      console.log(
        `  page ${pageNum}: ${pageProfiles.length} cards (total: ${allProfiles.length})`
      );

      // Check if there's a next page
      const hasNext = await page.$('.pagination__next, a[href*="page=' + (pageNum + 1) + '"]');
      if (!hasNext) {
        console.log(`  no next page after ${pageNum}, stopping`);
        break;
      }

      pageNum++;
      await sleep(DELAY);
    } catch (e) {
      // 404 or error means we've gone past the last page
      console.log(`  page ${pageNum} failed (${e.message}), stopping`);
      break;
    }
  }

  // Visit individual profiles for social links
  if (!SKIP_PROFILES) {
    let visited = 0;
    for (const p of allProfiles) {
      if (!p.profileUrl) continue;
      try {
        await page.goto(p.profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await sleep(1000);

        const details = await page.evaluate(() => {
          const anchors = [...document.querySelectorAll('a[href]')];

          function isAwwSocial(u) {
            const l = u.toLowerCase();
            return (
              l.includes('/awwwards') ||
              l.includes('/shareArticle') ||
              l.includes('/intent/tweet') ||
              l.includes('share?url=')
            );
          }

          const linkedin =
            anchors.find(
              (a) => a.href.includes('linkedin.com/in/') && !isAwwSocial(a.href)
            )?.href || '';
          const twitter =
            anchors.find((a) => {
              const h = a.href.toLowerCase();
              return (
                (h.includes('twitter.com/') || h.includes('x.com/')) &&
                !isAwwSocial(h) &&
                !h.includes('twitter.com/awwwards') &&
                !h.includes('x.com/awwwards')
              );
            })?.href || '';
          const instagram =
            anchors.find((a) => {
              const h = a.href.toLowerCase();
              return (
                h.includes('instagram.com/') &&
                !h.includes('instagram.com/awwwards')
              );
            })?.href || '';

          // Try to get location from profile page
          const bodyText = document.body.innerText || '';
          const locMatch = bodyText.match(
            /(?:^|\n)([\w\s]+)\s*-\s*([\w\s]+?)(?:\n|$)/m
          );
          const location = locMatch
            ? (locMatch[1].trim() + ' - ' + locMatch[2].trim())
            : '';

          return { linkedin, twitter, instagram, location };
        });

        if (details.linkedin) p.linkedin = details.linkedin;
        if (details.twitter) p.twitter = details.twitter;
        if (details.instagram) p.instagram = details.instagram;
        if (details.location && !p.location) p.location = details.location;

        visited++;
        if (visited % 25 === 0)
          console.log(
            `  visited ${visited}/${allProfiles.length} directory profiles`
          );
      } catch (e) {
        // skip
      }
      await sleep(DELAY);
    }
    console.log(`  visited ${visited} individual directory profiles`);
  }

  await page.close();
  console.log(`  ✓ Awwwards Directory: ${allProfiles.length} profiles`);
  return allProfiles;
}

// ═══════════════════════════════════════════════════════════
// 3. Awwwards Jury — paginated (.card-jury cards)
// ═══════════════════════════════════════════════════════════
async function scrapeAwwwardsJury(browser) {
  console.log('\n🏛️  Scraping Awwwards Jury 2025 ...');
  const page = await browser.newPage();
  const allProfiles = [];
  let pageNum = 1;

  while (pageNum <= MAX_PAGES) {
    const url = `https://www.awwwards.com/jury/2025/?page=${pageNum}`;
    console.log(`  page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      // Dismiss cookie banner
      try {
        const rejectBtn = await page.$('button:has-text("Reject"), button:has-text("reject")');
        if (rejectBtn) await rejectBtn.click();
      } catch (e) {}

      const cards = await page.$$('.card-jury');
      if (cards.length === 0) {
        console.log(`  no jury cards on page ${pageNum}, stopping`);
        break;
      }

      const pageProfiles = await page.$$eval('.card-jury', (cards) =>
        cards.map((card) => {
          const text = card.textContent.replace(/\s+/g, ' ').trim();
          const link = card.querySelector('a')?.href || '';

          // Parse: "Name Location Role Website"
          // Name is first, then Location, then role, then website
          const nameEl = card.querySelector(
            '.card-jury__name, h2, h3, [class*="name"]'
          );
          const fullName = nameEl?.textContent?.trim() || '';

          const locEl = card.querySelector(
            '.card-jury__location, [class*="location"]'
          );
          const location = locEl?.textContent?.trim() || '';

          const roleEl = card.querySelector(
            '.card-jury__role, [class*="role"], [class*="position"]'
          );
          const title = roleEl?.textContent?.trim() || '';

          const websiteEl = card.querySelector(
            'a[href]:not([href*="awwwards"])'
          );
          const website = websiteEl?.href || '';

          return {
            fullName,
            email: '',
            title,
            location,
            linkedin: '',
            twitter: '',
            instagram: '',
            website,
            profileUrl: link,
            source: 'awwwards_jury',
          };
        })
      );

      allProfiles.push(...pageProfiles);
      console.log(
        `  page ${pageNum}: ${pageProfiles.length} cards (total: ${allProfiles.length})`
      );

      const hasNext = await page.$('.pagination__next, a[href*="page=' + (pageNum + 1) + '"]');
      if (!hasNext) {
        console.log(`  no next page after ${pageNum}, stopping`);
        break;
      }

      pageNum++;
      await sleep(DELAY);
    } catch (e) {
      console.log(`  page ${pageNum} failed (${e.message}), stopping`);
      break;
    }
  }

  // Visit individual jury profiles for social links
  if (!SKIP_PROFILES) {
    let visited = 0;
    for (const p of allProfiles) {
      if (!p.profileUrl) continue;
      try {
        await page.goto(p.profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await sleep(1000);

        const details = await page.evaluate(() => {
          const anchors = [...document.querySelectorAll('a[href]')];

          function isAwwSocial(u) {
            const l = u.toLowerCase();
            return (
              l.includes('/awwwards') ||
              l.includes('/shareArticle') ||
              l.includes('/intent/tweet') ||
              l.includes('share?url=')
            );
          }

          const linkedin =
            anchors.find(
              (a) => a.href.includes('linkedin.com/in/') && !isAwwSocial(a.href)
            )?.href || '';
          const twitter =
            anchors.find((a) => {
              const h = a.href.toLowerCase();
              return (
                (h.includes('twitter.com/') || h.includes('x.com/')) &&
                !isAwwSocial(h) &&
                !h.includes('twitter.com/awwwards') &&
                !h.includes('x.com/awwwards')
              );
            })?.href || '';
          const instagram =
            anchors.find((a) => {
              const h = a.href.toLowerCase();
              return (
                h.includes('instagram.com/') &&
                !h.includes('instagram.com/awwwards')
              );
            })?.href || '';

          return { linkedin, twitter, instagram };
        });

        if (details.linkedin) p.linkedin = details.linkedin;
        if (details.twitter) p.twitter = details.twitter;
        if (details.instagram) p.instagram = details.instagram;

        visited++;
        if (visited % 25 === 0)
          console.log(
            `  visited ${visited}/${allProfiles.length} jury profiles`
          );
      } catch (e) {
        // skip
      }
      await sleep(DELAY);
    }
    console.log(`  visited ${visited} individual jury profiles`);
  }

  await page.close();
  console.log(`  ✓ Awwwards Jury: ${allProfiles.length} profiles`);
  return allProfiles;
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🚀 Profile Scraper — ${today}`);
  console.log(`   Source: ${SOURCE} | Max pages: ${MAX_PAGES} | Headless: ${HEADLESS} | Skip profiles: ${SKIP_PROFILES}\n`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const allProfiles = [];

  try {
    if (SOURCE === 'all' || SOURCE === 'a1') {
      const a1 = await scrapeA1Gallery(browser);
      allProfiles.push(...a1);
      exportCSV(a1, `profiles_a1.gallery_${today}.csv`);
    }

    if (SOURCE === 'all' || SOURCE === 'dir') {
      const dir = await scrapeAwwwardsDirectory(browser);
      allProfiles.push(...dir);
      exportCSV(dir, `profiles_awwwards_directory_${today}.csv`);
    }

    if (SOURCE === 'all' || SOURCE === 'jury') {
      const jury = await scrapeAwwwardsJury(browser);
      allProfiles.push(...jury);
      exportCSV(jury, `profiles_awwwards_jury_${today}.csv`);
    }

    // Combined + deduped
    const unique = dedup(allProfiles);
    console.log(
      `\n📊 Total: ${allProfiles.length} raw → ${unique.length} unique profiles`
    );
    exportCSV(unique, `profiles_${today}.csv`);
    exportJSON(unique, `profiles_${today}.json`);
  } finally {
    await browser.close();
  }

  console.log('\n✅ Done!\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
