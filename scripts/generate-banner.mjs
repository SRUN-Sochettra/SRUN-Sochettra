// scripts/generate-banner.mjs
import fs from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const ANILIST_USER = "scarletsages";
const KHMER_GREETING = "សួស្ដី";
const DISPLAY_NAME = "Srun Sochettra";

// Personality content — edit these freely
const QUOTE = "\u201CPeople die when they are killed.\u201D";
const QUOTE_ATTR = "\u2014 Shirou Emiya, Fate/Stay Night";
const TAGLINE = "Writes code. Watches anime. Is an egg.";

// No public API for any of these — hardcoded
const CURRENTLY_PLAYING = ["Magic Chess", "eFootball", "Football Manager"];

const octo = new Octokit({ auth: process.env.GH_TOKEN });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const THEMES = {
  dark: {
    bgStart: "#0a0a0f",
    bgEnd: "#15121f",
    glow: "#a855f7",
    glowOpacity: 0.16,
    glow2: "#f59e0b",
    glow2Opacity: 0.10,
    textPrimary: "#fafaf9",
    textSecondary: "#d6d3d1",
    textTertiary: "#a8a29e",
    textMuted: "#57534e",
    accent: "#f59e0b",
    khmerColor: "#fbbf24",
    rule: "#292524",
    ruleStrong: "#3f3a31",
    grainOpacity: 0.04,
  },
  light: {
    bgStart: "#fafaf9",
    bgEnd: "#f1efed",
    glow: "#a855f7",
    glowOpacity: 0.07,
    glow2: "#f59e0b",
    glow2Opacity: 0.05,
    textPrimary: "#1c1917",
    textSecondary: "#44403c",
    textTertiary: "#78716c",
    textMuted: "#a8a29e",
    accent: "#d97706",
    khmerColor: "#b45309",
    rule: "#e7e5e4",
    ruleStrong: "#d6d3d1",
    grainOpacity: 0.025,
  },
};

// ------------------------------------------------------------------
// Font embed
// ------------------------------------------------------------------
async function fetchGoogleWoff2(family, weight, blockMatcher) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(url, { headers: { "User-Agent": UA } });
  if (!cssRes.ok) throw new Error(`CSS fetch failed: ${family}`);
  const css = await cssRes.text();
  const blocks = css.split("@font-face").slice(1);
  const block = blockMatcher
    ? blocks.find((b) => blockMatcher.test(b)) || blocks[0]
    : blocks[0];
  const urlMatch = block.match(/url\(([^)]+\.woff2)\)/);
  if (!urlMatch) throw new Error(`No woff2 URL: ${family}`);
  const fontRes = await fetch(urlMatch[1]);
  if (!fontRes.ok) throw new Error(`Font download failed: ${family}`);
  return Buffer.from(await fontRes.arrayBuffer());
}

async function getEmbeddedFont(family, weight, chars, blockMatcher = null) {
  try {
    const fontBuf = await fetchGoogleWoff2(family, weight, blockMatcher);
    const subset = await subsetFont(fontBuf, chars, { targetFormat: "woff2" });
    return subset.toString("base64");
  } catch (err) {
    console.warn(`${family} (${weight}) embed failed:`, err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Utils
// ------------------------------------------------------------------
function fmtRel(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function fmtDateUpper(d) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).toUpperCase();
}

// ------------------------------------------------------------------
// Data fetchers
// ------------------------------------------------------------------
async function getCurrentAnime() {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($name: String) {
          MediaListCollection(userName: $name, type: ANIME, status: CURRENT) {
            lists {
              entries {
                progress
                updatedAt
                media {
                  title { english romaji }
                  episodes
                }
              }
            }
          }
        }`,
        variables: { name: ANILIST_USER },
      }),
    });
    if (!res.ok) {
      console.warn("AniList HTTP", res.status);
      return null;
    }
    const j = await res.json();
    const entries = j.data?.MediaListCollection?.lists?.flatMap((l) => l.entries) || [];
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const e = entries[0];
    return {
      title: e.media.title.english || e.media.title.romaji || "Unknown",
      progress: e.progress ?? 0,
      total: e.media.episodes || null,
    };
  } catch (err) {
    console.warn("AniList fetch failed:", err.message);
    return null;
  }
}

async function getStats() {
  const events = await octo.paginate(
    octo.activity.listPublicEventsForUser,
    { username: USER, per_page: 30 },
    (res) => res.data
  );

  let latestPush = null;
  for (const e of events) {
    if (e.type === "PushEvent") { latestPush = e; break; }
  }

  let lastCommit = null;
  let lastShipped = null;

  if (latestPush) {
    const sha = latestPush.payload?.head?.slice(0, 7);
    const fullName = latestPush.repo.name;
    const repoName = fullName.includes("/") ? fullName.split("/")[1] : fullName;

    if (sha) {
      lastCommit = { sha, date: new Date(latestPush.created_at) };
    }

    let lang = "—";
    try {
      const { data: repo } = await octo.repos.get({ owner: USER, repo: repoName });
      lang = repo.language || "—";
    } catch (err) {
      console.warn(`repo lookup failed for ${repoName}:`, err.message);
    }

    lastShipped = {
      name: repoName,
      lang,
      when: fmtRel(latestPush.created_at),
    };
  }

  return {
    lastCommit,
    lastShipped,
    updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// Renderers
// ------------------------------------------------------------------
function renderAnime(anime, x, y, theme) {
  if (!anime) {
    return `<text x="${x}" y="${y}" class="sans" fill="${theme.textTertiary}" font-size="14" font-style="italic">Between shows</text>`;
  }
  const title = clip(anime.title, 36);
  const metaParts = [];
  if (anime.progress != null && anime.progress > 0) {
    metaParts.push(anime.total ? `Ep ${anime.progress} / ${anime.total}` : `Ep ${anime.progress}`);
  }
  metaParts.push("via AniList");
  const meta = metaParts.join("  ·  ");
  return `
    <text x="${x}" y="${y}" class="sans" fill="${theme.textPrimary}" font-size="15" font-weight="600">${esc(title)}</text>
    <text x="${x}" y="${y + 20}" class="mono" fill="${theme.textTertiary}" font-size="10" letter-spacing="0.05em">${esc(meta)}</text>
  `;
}

function renderLastShipped(last, x, y, theme) {
  if (!last) {
    return `<text x="${x}" y="${y}" class="sans" fill="${theme.textTertiary}" font-size="14" font-style="italic">Nothing recent</text>`;
  }
  return `
    <text x="${x}" y="${y}" class="sans" fill="${theme.textPrimary}" font-size="15" font-weight="600">${esc(clip(last.name, 30))}</text>
    <text x="${x}" y="${y + 20}" class="mono" fill="${theme.textTertiary}" font-size="10" letter-spacing="0.05em">${esc(`${last.lang}  ·  ${last.when}`)}</text>
  `;
}

// ------------------------------------------------------------------
// Main SVG
// ------------------------------------------------------------------
function renderSvg(s, anime, fonts, themeName) {
  const t = THEMES[themeName];
  const { khmer: khmerB64, display: displayB64 } = fonts;

  const fontFaces = `<style type="text/css"><![CDATA[
    ${khmerB64 ? `@font-face { font-family: 'KhmerEmbed'; font-weight: 700; src: url(data:font/woff2;base64,${khmerB64}) format('woff2'); }` : ""}
    ${displayB64 ? `@font-face { font-family: 'DisplayEmbed'; font-weight: 700; src: url(data:font/woff2;base64,${displayB64}) format('woff2'); }` : ""}
  ]]></style>`;

  const khmerFamily = khmerB64
    ? "'KhmerEmbed', 'Noto Serif Khmer', serif"
    : "'Noto Serif Khmer', 'Khmer OS', serif";

  const displayFamily = displayB64
    ? "'DisplayEmbed', 'Fraunces', 'Playfair Display', Georgia, serif"
    : "'Fraunces', 'Playfair Display', Georgia, serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 380" width="1280" height="380" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Srun Sochettra — personal banner (${themeName})">
  <defs>
    ${fontFaces}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bgStart}"/>
      <stop offset="100%" stop-color="${t.bgEnd}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.15" cy="0.2" r="0.5">
      <stop offset="0%" stop-color="${t.accent}" stop-opacity="${t.glow2Opacity}"/>
      <stop offset="100%" stop-color="${t.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.8" r="0.55">
      <stop offset="0%" stop-color="${t.glow}" stop-opacity="${t.glowOpacity}"/>
      <stop offset="100%" stop-color="${t.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${t.grainOpacity} 0"/>
    </filter>
    <style type="text/css"><![CDATA[
      .mono { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
      .sans { font-family: 'Inter', 'Helvetica Neue', system-ui, -apple-system, sans-serif; }
      .display { font-family: ${displayFamily}; font-weight: 700; }
      .khmer { font-family: ${khmerFamily}; font-weight: 700; }
    ]]></style>
  </defs>

  <!-- Background -->
  <rect width="1280" height="380" fill="url(#bg)"/>
  <rect width="1280" height="380" fill="url(#glow1)"/>
  <rect width="1280" height="380" fill="url(#glow2)"/>
  <rect width="1280" height="380" filter="url(#grain)" opacity="0.9"/>

  <!-- Top frame -->
  <line x1="64" y1="40" x2="1216" y2="40" stroke="${t.rule}" stroke-width="1"/>
  <rect x="64" y="38" width="36" height="3" fill="${t.accent}" rx="1.5"/>

  <text x="64" y="68" class="mono" fill="${t.textTertiary}" font-size="11" letter-spacing="0.3em" opacity="0.85">
    PHNOM PENH  ·  CAMBODIA
  </text>
  <text x="1216" y="68" text-anchor="end" class="mono" fill="${t.textMuted}" font-size="10" letter-spacing="0.1em" opacity="0.8">refreshed ${esc(s.updatedAt)}</text>

  <!-- ===== LEFT: persona ===== -->
  <text x="64" y="148" class="khmer" fill="${t.khmerColor}" font-size="72">${KHMER_GREETING}</text>

  <text x="64" y="218" class="display" fill="${t.textPrimary}" font-size="56" letter-spacing="-0.025em">
    ${DISPLAY_NAME}
  </text>

  <!-- Editorial rule -->
  <g transform="translate(64, 236)">
    <rect x="0" y="0" width="22" height="3" fill="${t.accent}" rx="1.5"/>
    <rect x="28" y="1" width="100" height="1" fill="${t.ruleStrong}"/>
  </g>

  <!-- Quote -->
  <text x="64" y="272" class="sans" fill="${t.textSecondary}" font-size="15" font-style="italic">${esc(QUOTE)}</text>
  <text x="64" y="293" class="mono" fill="${t.textTertiary}" font-size="11" letter-spacing="0.05em">${esc(QUOTE_ATTR)}</text>

  <!-- Tagline -->
  <text x="64" y="335" class="sans" fill="${t.textPrimary}" font-size="16" font-weight="500">${esc(TAGLINE)}</text>

  <!-- Vertical separator -->
  <line x1="780" y1="100" x2="780" y2="340" stroke="${t.rule}" stroke-width="1"/>

  <!-- ===== RIGHT: currently ===== -->
  <text x="810" y="130" class="mono" fill="${t.textSecondary}" font-size="10" font-weight="700" letter-spacing="0.25em">NOW WATCHING</text>
  ${renderAnime(anime, 810, 156, t)}

  <text x="810" y="212" class="mono" fill="${t.textSecondary}" font-size="10" font-weight="700" letter-spacing="0.25em">NOW PLAYING</text>
  <text x="810" y="238" class="sans" fill="${t.textPrimary}" font-size="15" font-weight="600">${esc(CURRENTLY_PLAYING.join("  ·  "))}</text>

  <text x="810" y="290" class="mono" fill="${t.textSecondary}" font-size="10" font-weight="700" letter-spacing="0.25em">LAST SHIPPED</text>
  ${renderLastShipped(s.lastShipped, 810, 316, t)}

  <!-- Bottom rule + tiny BUILD signature -->
  <line x1="64" y1="358" x2="1216" y2="358" stroke="${t.rule}" stroke-width="1" opacity="0.6"/>
  ${s.lastCommit?.sha
    ? `<text x="64" y="374" class="mono" fill="${t.textMuted}" font-size="9" letter-spacing="0.2em" opacity="0.75">BUILD · ${esc(s.lastCommit.sha)} · ${esc(fmtDateUpper(s.lastCommit.date))}</text>`
    : ""}
</svg>
`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const [stats, anime, khmerB64, displayB64] = await Promise.all([
  getStats(),
  getCurrentAnime(),
  getEmbeddedFont("Noto Serif Khmer", "700", KHMER_GREETING, /U\+1780/i),
  getEmbeddedFont("Fraunces", "700", DISPLAY_NAME + " Sochettra Srun"),
]);

const fonts = { khmer: khmerB64, display: displayB64 };

await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/banner-dark.svg", renderSvg(stats, anime, fonts, "dark"));
await fs.writeFile("assets/banner-light.svg", renderSvg(stats, anime, fonts, "light"));

console.log("banners generated.");
console.log("anime:", anime);
console.log("lastShipped:", stats.lastShipped);
console.log("lastCommit:", stats.lastCommit);
console.log("khmer embedded:", !!khmerB64);
console.log("display embedded:", !!displayB64);