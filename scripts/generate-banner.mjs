import fs from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const KHMER_GREETING = "សួស្ដី";
const DISPLAY_NAME = "Srun Sochettra";

const octo = new Octokit({ auth: process.env.GH_TOKEN });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

// ------------------------------------------------------------------
// Themes
// ------------------------------------------------------------------
const THEMES = {
  dark: {
    bgStart: "#0a0a0f",
    bgEnd: "#1a1625",
    glow: "#a855f7",
    glowOpacity: 0.18,
    glow2: "#f59e0b",
    glow2Opacity: 0.1,
    textPrimary: "#fafaf9",
    textSecondary: "#a8a29e",
    textTertiary: "#78716c",
    textMuted: "#44403c",
    accent: "#f59e0b",
    khmerColor: "#fbbf24",
    rule: "#292524",
    cellEmpty: "#1c1917",
    cellLevels: ["#3b2a05", "#78520c", "#b8780f", "#f59e0b"],
    sparklineStroke: "#f59e0b",
    sparklineFillOpacity: 0.18,
    liveDot: "#22c55e",
    liveText: "#22c55e",
    shipDot: "#f59e0b",
  },
  light: {
    bgStart: "#fafaf9",
    bgEnd: "#f5f5f4",
    glow: "#a855f7",
    glowOpacity: 0.08,
    glow2: "#f59e0b",
    glow2Opacity: 0.06,
    textPrimary: "#1c1917",
    textSecondary: "#44403c",
    textTertiary: "#78716c",
    textMuted: "#a8a29e",
    accent: "#d97706",
    khmerColor: "#b45309",
    rule: "#e7e5e4",
    cellEmpty: "#e7e5e4",
    cellLevels: ["#fde68a", "#fcd34d", "#f59e0b", "#d97706"],
    sparklineStroke: "#d97706",
    sparklineFillOpacity: 0.18,
    liveDot: "#16a34a",
    liveText: "#15803d",
    shipDot: "#d97706",
  },
};

// ------------------------------------------------------------------
// Font fetch + embed (generic)
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
    console.warn(`${family} embed failed:`, err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Utils
// ------------------------------------------------------------------
function fmtRel(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
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

function clip(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function ymdUTC(d) {
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------
// Stats via GraphQL (real contribution data)
// ------------------------------------------------------------------
async function getContributionMap() {
  const today = new Date();
  const to = new Date(today.getTime() + 86400000).toISOString();
  const from = new Date(today.getTime() - 365 * 86400000).toISOString();

  const data = await octo.graphql(
    `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { date contributionCount }
            }
          }
        }
      }
    }`,
    { login: USER, from, to }
  );

  const perDay = {};
  for (const w of data.user.contributionsCollection.contributionCalendar.weeks) {
    for (const d of w.contributionDays) perDay[d.date] = d.contributionCount;
  }
  return perDay;
}

async function getStats() {
  const perDay = await getContributionMap();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let commitsThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    commitsThisWeek += perDay[ymdUTC(d)] ?? 0;
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    if ((perDay[ymdUTC(d)] ?? 0) > 0) streak++;
    else if (i === 0) continue;
    else break;
  }

  const events = await octo.paginate(
    octo.activity.listPublicEventsForUser,
    { username: USER, per_page: 100 },
    (res) => res.data
  );
  const weekAgo = today.getTime() - 6 * 86400000;
  const reposTouched = new Set();
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = new Date(e.created_at).getTime();
    if (t >= weekAgo) reposTouched.add(e.repo.name);
  }

  // 12-week heatmap
  const heatmap = [];
  const HEATMAP_DAYS = 84;
  const firstDayOffset = HEATMAP_DAYS - 1;
  for (let col = 0; col < 12; col++) {
    const week = [];
    for (let row = 0; row < 7; row++) {
      const offset = firstDayOffset - (col * 7 + row);
      const d = new Date(today.getTime() - offset * 86400000);
      week.push(perDay[ymdUTC(d)] ?? 0);
    }
    heatmap.push(week);
  }

  // 30-day sparkline
  const sparkline = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    sparkline.push(perDay[ymdUTC(d)] ?? 0);
  }

  const { data: repos } = await octo.repos.listForUser({
    username: USER,
    sort: "pushed",
    per_page: 10,
  });
  const recent = repos
    .filter((r) => !r.fork)
    .slice(0, 3)
    .map((r) => ({
      name: r.name,
      lang: r.language || "—",
      when: fmtRel(r.pushed_at),
    }));

  const { data: user } = await octo.users.getByUsername({ username: USER });

  const total12w = heatmap.flat().reduce((a, b) => a + b, 0);
  const maxDay = Math.max(0, ...heatmap.flat());

  return {
    commitsThisWeek,
    reposTouchedCount: reposTouched.size,
    streak,
    recent,
    totalRepos: user.public_repos,
    heatmap,
    sparkline,
    total12w,
    maxDay,
    updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// Renderers
// ------------------------------------------------------------------
function renderHeatmap(heatmap, maxDay, theme) {
  const x0 = 820;
  const y0 = 92;
  const cell = 20;
  const gap = 5;
  const rows = 7;
  const cols = 12;
  const levels = theme.cellLevels;

  let cells = "";
  heatmap.forEach((week, col) => {
    week.forEach((count, row) => {
      const x = x0 + col * (cell + gap);
      const y = y0 + row * (cell + gap);
      let fill = theme.cellEmpty;
      if (count > 0 && maxDay > 0) {
        const intensity = count / maxDay;
        if (intensity > 0.66) fill = levels[3];
        else if (intensity > 0.4) fill = levels[2];
        else if (intensity > 0.2) fill = levels[1];
        else fill = levels[0];
      }
      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${fill}"/>`;
    });
  });

  const cellsBottom = y0 + rows * cell + (rows - 1) * gap;
  const legendY = cellsBottom + 14;
  let legend = `<text x="${x0}" y="${legendY + 10}" class="mono" fill="${theme.textTertiary}" font-size="10">Less</text>`;
  const legendStart = x0 + 32;
  for (let i = 0; i < 5; i++) {
    const fill = i === 0 ? theme.cellEmpty : theme.cellLevels[i - 1];
    legend += `<rect x="${legendStart + i * 15}" y="${legendY}" width="12" height="12" rx="2" fill="${fill}"/>`;
  }
  legend += `<text x="${legendStart + 5 * 15 + 4}" y="${legendY + 10}" class="mono" fill="${theme.textTertiary}" font-size="10">More</text>`;
  return cells + legend;
}

function renderSparkline(values, theme) {
  const x0 = 820;
  const y0 = 322;
  const w = 396;
  const h = 40;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [x0 + i * step, y0 + h - (v / max) * h]);

  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    path += ` C ${px + step / 2} ${py}, ${x - step / 2} ${y}, ${x} ${y}`;
  }
  const area = `${path} L ${x0 + w} ${y0 + h} L ${x0} ${y0 + h} Z`;
  const last = pts[pts.length - 1];

  return `
    <path d="${area}" fill="${theme.sparklineStroke}" opacity="${theme.sparklineFillOpacity}"/>
    <path d="${path}" stroke="${theme.sparklineStroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${theme.sparklineStroke}"/>
  `;
}

function renderShips(recent, theme) {
  if (!recent.length) {
    return `<text x="820" y="420" class="mono" fill="${theme.textTertiary}" font-size="11">No recent ships</text>`;
  }
  let y = 420;
  return recent
    .map((r) => {
      const block = `
    <circle cx="826" cy="${y - 4}" r="3" fill="${theme.shipDot}"/>
    <text x="838" y="${y}" class="sans" fill="${theme.textPrimary}" font-size="13" font-weight="600">${esc(clip(r.name, 28))}</text>
    <text x="1216" y="${y}" text-anchor="end" class="mono" fill="${theme.textTertiary}" font-size="11">${esc(r.lang)} · ${esc(r.when)}</text>`;
      y += 22;
      return block;
    })
    .join("");
}

// ------------------------------------------------------------------
// Main SVG
// ------------------------------------------------------------------
function renderSvg(s, fonts, themeName) {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 500" width="1280" height="500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Srun Sochettra — live banner (${themeName})">
  <defs>
    ${fontFaces}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bgStart}"/>
      <stop offset="100%" stop-color="${t.bgEnd}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.15" cy="0.2" r="0.5">
      <stop offset="0%" stop-color="${t.glow2}" stop-opacity="${t.glow2Opacity}"/>
      <stop offset="100%" stop-color="${t.glow2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.8" r="0.55">
      <stop offset="0%" stop-color="${t.glow}" stop-opacity="${t.glowOpacity}"/>
      <stop offset="100%" stop-color="${t.glow}" stop-opacity="0"/>
    </radialGradient>
    <style type="text/css"><![CDATA[
      .mono { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
      .sans { font-family: 'Inter', 'Helvetica Neue', system-ui, -apple-system, sans-serif; }
      .display { font-family: ${displayFamily}; font-weight: 700; }
      .khmer { font-family: ${khmerFamily}; font-weight: 700; }
      @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      .live { animation: pulse 2s ease-in-out infinite; }
    ]]></style>
  </defs>

  <rect width="1280" height="500" fill="url(#bg)"/>
  <rect width="1280" height="500" fill="url(#glow1)"/>
  <rect width="1280" height="500" fill="url(#glow2)"/>

  <!-- ============ LEFT HERO ============ -->
  <text x="64" y="70" class="mono" fill="${t.accent}" font-size="12" letter-spacing="0.25em" opacity="0.9">
    BACKEND · AI · FINTECH · CAMBODIA
  </text>

  <text x="64" y="180" class="khmer" fill="${t.khmerColor}" font-size="86">${KHMER_GREETING}</text>

  <text x="64" y="270" class="display" fill="${t.textPrimary}" font-size="72" letter-spacing="-0.02em">
    ${DISPLAY_NAME}
  </text>

  <rect x="64" y="288" width="80" height="3" fill="${t.accent}" rx="1.5"/>

  <text x="64" y="326" class="sans" fill="${t.textSecondary}" font-size="20" font-weight="400">
    Building software that matters in Cambodia.
  </text>

  <text x="64" y="354" class="sans" fill="${t.textTertiary}" font-size="14">
    Backend &amp; Full-Stack Developer  ·  Phnom Penh  ·  ${s.totalRepos} repos
  </text>

  <text x="64" y="400" class="mono" font-size="13" xml:space="preserve"><tspan fill="${t.textTertiary}">commits/7d</tspan> <tspan fill="${t.textPrimary}" font-weight="700">${s.commitsThisWeek}</tspan>   <tspan fill="${t.textMuted}">·</tspan>   <tspan fill="${t.textTertiary}">streak</tspan> <tspan fill="${t.textPrimary}" font-weight="700">${s.streak}d</tspan> 🔥   <tspan fill="${t.textMuted}">·</tspan>   <tspan fill="${t.textTertiary}">active in</tspan> <tspan fill="${t.textPrimary}" font-weight="700">${s.reposTouchedCount}</tspan> <tspan fill="${t.textTertiary}">repo${s.reposTouchedCount === 1 ? "" : "s"}</tspan></text>

  <g transform="translate(64, 460)">
    <circle class="live" cx="5" cy="5" r="4.5" fill="${t.liveDot}"/>
    <text x="18" y="10" class="mono" fill="${t.liveText}" font-size="11" font-weight="700" letter-spacing="0.2em">LIVE</text>
    <text x="60" y="10" class="mono" fill="${t.textTertiary}" font-size="11">·  refreshed ${esc(s.updatedAt)}</text>
  </g>

  <line x1="790" y1="60" x2="790" y2="470" stroke="${t.rule}" stroke-width="1"/>

  <!-- ============ RIGHT DATA ============ -->
  <text x="820" y="76" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">12 WEEKS OF SHIPPING</text>
  <text x="1216" y="76" text-anchor="end" class="mono" fill="${t.textTertiary}" font-size="11">${s.total12w} contributions</text>
  ${renderHeatmap(s.heatmap, s.maxDay, t)}

  <text x="820" y="308" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">DAILY · 30D</text>
  <text x="1216" y="308" text-anchor="end" class="mono" fill="${t.textTertiary}" font-size="11">peak ${s.maxDay}/day</text>
  ${renderSparkline(s.sparkline, t)}

  <text x="820" y="396" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">LATEST SHIPS</text>
  ${renderShips(s.recent, t)}
</svg>
`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const [stats, khmerB64, displayB64] = await Promise.all([
  getStats(),
  getEmbeddedFont("Noto Serif Khmer", "700", KHMER_GREETING, /U\+1780/i),
  getEmbeddedFont("Fraunces", "700", DISPLAY_NAME),
]);

const fonts = { khmer: khmerB64, display: displayB64 };

await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/banner-dark.svg", renderSvg(stats, fonts, "dark"));
await fs.writeFile("assets/banner-light.svg", renderSvg(stats, fonts, "light"));

console.log("banners generated.");
console.log("khmer embedded:", !!khmerB64);
console.log("display embedded:", !!displayB64);
console.log("stats:", { ...stats, heatmap: undefined, sparkline: undefined });