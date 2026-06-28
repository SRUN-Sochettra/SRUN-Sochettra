import fs from "node:fs/promises";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const KHMER_GREETING = "សួស្ដី";

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// Theme palettes
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
    textTertiary: "#525252",
    textMuted: "#404040",
    accent: "#f59e0b",
    accent2: "#ef4444",
    khmerColor: "#fbbf24",
    rule: "#292524",
    cellEmpty: "#1c1917",
    cellLevels: ["#3b2a05", "#78520c", "#b8780f", "#f59e0b"],
    sparklineStroke: "#f59e0b",
    sparklineFill: "#f59e0b",
    sparklineFillOpacity: 0.15,
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
    textSecondary: "#57534e",
    textTertiary: "#a8a29e",
    textMuted: "#d6d3d1",
    accent: "#d97706",
    accent2: "#b91c1c",
    khmerColor: "#b45309",
    rule: "#e7e5e4",
    cellEmpty: "#e7e5e4",
    cellLevels: ["#fde68a", "#fcd34d", "#f59e0b", "#d97706"],
    sparklineStroke: "#d97706",
    sparklineFill: "#d97706",
    sparklineFillOpacity: 0.18,
    liveDot: "#16a34a",
    liveText: "#15803d",
    shipDot: "#d97706",
  },
};

// ------------------------------------------------------------------
// Khmer font embed
// ------------------------------------------------------------------
async function getEmbeddedKhmerFont() {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Serif+Khmer:wght@700&display=swap",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (!cssRes.ok) throw new Error("CSS fetch failed");
    const css = await cssRes.text();
    const blocks = css.split("@font-face").slice(1);
    const khmerBlock =
      blocks.find((b) => /U\+1780/i.test(b)) || blocks[blocks.length - 1];
    const urlMatch = khmerBlock.match(/url\(([^)]+\.woff2)\)/);
    if (!urlMatch) throw new Error("No woff2 URL");
    const fontRes = await fetch(urlMatch[1]);
    if (!fontRes.ok) throw new Error("Font fetch failed");
    const fontBuf = Buffer.from(await fontRes.arrayBuffer());
    const subset = await subsetFont(fontBuf, KHMER_GREETING, {
      targetFormat: "woff2",
    });
    return subset.toString("base64");
  } catch (err) {
    console.warn("Khmer font embed failed:", err.message);
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
// Fetch stats
// ------------------------------------------------------------------
async function getStats() {
  const events = await octo.paginate(
    octo.activity.listPublicEventsForUser,
    { username: USER, per_page: 100 },
    (res) => res.data
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build per-day commit map from events
  const perDay = {};
  const reposTouched = new Set();

  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = new Date(e.created_at);
    const key = ymdUTC(t);
    const count = e.payload.commits?.length ?? 0;
    perDay[key] = (perDay[key] ?? 0) + count;
  }

  // This-week metrics
  const weekStart = today.getTime() - 6 * 86400000;
  let commitsThisWeek = 0;
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = new Date(e.created_at).getTime();
    if (t >= weekStart) {
      commitsThisWeek += e.payload.commits?.length ?? 0;
      reposTouched.add(e.repo.name);
    }
  }

  // Streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = ymdUTC(d);
    if ((perDay[key] ?? 0) > 0) {
      streak++;
    } else {
      if (i === 0) continue;
      break;
    }
  }

  // 12-week heatmap (84 days, 7 rows x 12 cols)
  // Columns = weeks (oldest left). Rows = days of week (Sun top → Sat bottom)
  // Align so the rightmost column ends on TODAY.
  const heatmap = [];
  const HEATMAP_DAYS = 84;
  const firstDayOffset = HEATMAP_DAYS - 1;
  for (let col = 0; col < 12; col++) {
    const week = [];
    for (let row = 0; row < 7; row++) {
      const offset = firstDayOffset - (col * 7 + row);
      const d = new Date(today.getTime() - offset * 86400000);
      const key = ymdUTC(d);
      week.push(perDay[key] ?? 0);
    }
    heatmap.push(week);
  }

  // 30-day sparkline data
  const sparkline = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    sparkline.push(perDay[ymdUTC(d)] ?? 0);
  }

  // Recent ships
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

  // Total commits across heatmap window
  const total12w = heatmap.flat().reduce((a, b) => a + b, 0);
  const maxDay = Math.max(...heatmap.flat());

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
    updatedAt:
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// Heatmap renderer
// ------------------------------------------------------------------
function renderHeatmap(heatmap, maxDay, theme) {
  const x0 = 820;
  const y0 = 95;
  const cell = 22;
  const gap = 5;
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

  // Legend
  const legendX = x0 + 12 * (cell + gap) - cell * 5 - gap * 4 - 35;
  const legendY = y0 + 7 * (cell + gap) + 12;
  let legend = `<text x="${x0}" y="${legendY + cell - 6}" class="mono" fill="${theme.textTertiary}" font-size="10">Less</text>`;
  for (let i = 0; i < 5; i++) {
    const fill = i === 0 ? theme.cellEmpty : theme.cellLevels[i - 1];
    legend += `<rect x="${x0 + 38 + i * (12 + 3)}" y="${legendY}" width="12" height="12" rx="2" fill="${fill}"/>`;
  }
  legend += `<text x="${x0 + 38 + 5 * 15 + 4}" y="${legendY + cell - 6}" class="mono" fill="${theme.textTertiary}" font-size="10">More</text>`;

  return cells + legend;
}

// ------------------------------------------------------------------
// Sparkline renderer (30-day daily commits)
// ------------------------------------------------------------------
function renderSparkline(values, theme) {
  const x0 = 820;
  const y0 = 290;
  const w = 396;
  const h = 50;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);

  const points = values.map((v, i) => {
    const x = x0 + i * step;
    const y = y0 + h - (v / max) * h;
    return [x, y];
  });

  // Smooth curve via cubic bezier
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [px, py] = points[i - 1];
    const cx1 = px + step / 2;
    const cx2 = x - step / 2;
    path += ` C ${cx1} ${py}, ${cx2} ${y}, ${x} ${y}`;
  }

  // Filled area
  const areaPath = `${path} L ${x0 + w} ${y0 + h} L ${x0} ${y0 + h} Z`;

  return `
    <path d="${areaPath}" fill="${theme.sparklineFill}" opacity="${theme.sparklineFillOpacity}"/>
    <path d="${path}" stroke="${theme.sparklineStroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${points[points.length - 1][0]}" cy="${points[points.length - 1][1]}" r="3.5" fill="${theme.sparklineStroke}"/>
  `;
}

// ------------------------------------------------------------------
// Latest ships renderer
// ------------------------------------------------------------------
function renderShips(recent, theme) {
  if (!recent.length) {
    return `<text x="820" y="382" class="mono" fill="${theme.textTertiary}" font-size="11">No recent ships</text>`;
  }
  let y = 378;
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
// Main SVG renderer
// ------------------------------------------------------------------
function renderSvg(s, fontB64, themeName) {
  const t = THEMES[themeName];
  const fontFace = fontB64
    ? `<style type="text/css"><![CDATA[
      @font-face {
        font-family: 'KhmerEmbed';
        font-weight: 700;
        src: url(data:font/woff2;base64,${fontB64}) format('woff2');
      }
    ]]></style>`
    : "";
  const khmerFontFamily = fontB64
    ? "'KhmerEmbed', 'Noto Serif Khmer', serif"
    : "'Noto Serif Khmer', 'Khmer OS', serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 460" width="1280" height="460" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Srun Sochettra — live banner (${themeName})">
  <defs>
    ${fontFace}
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
      .khmer { font-family: ${khmerFontFamily}; font-weight: 700; }
      @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      .live { animation: pulse 2s ease-in-out infinite; }
    ]]></style>
  </defs>

  <!-- Background -->
  <rect width="1280" height="460" fill="url(#bg)"/>
  <rect width="1280" height="460" fill="url(#glow1)"/>
  <rect width="1280" height="460" fill="url(#glow2)"/>

  <!-- ============ LEFT HERO ============ -->

  <!-- Tag -->
  <text x="64" y="70" class="mono" fill="${t.accent}" font-size="12" letter-spacing="0.25em" opacity="0.85">
    BACKEND · AI · FINTECH · CAMBODIA
  </text>

  <!-- Khmer greeting (large) -->
  <text x="64" y="180" class="khmer" fill="${t.khmerColor}" font-size="86">${KHMER_GREETING}</text>

  <!-- Latin name (huge, the hero) -->
  <text x="64" y="262" class="sans" fill="${t.textPrimary}" font-size="68" font-weight="800" letter-spacing="-0.035em">
    Srun Sochettra
  </text>

  <!-- Accent rule under name -->
  <rect x="64" y="280" width="80" height="3" fill="${t.accent}" rx="1.5"/>

  <!-- Tagline -->
  <text x="64" y="318" class="sans" fill="${t.textSecondary}" font-size="20" font-weight="400">
    Building software that matters in Cambodia.
  </text>

  <!-- Subline -->
  <text x="64" y="346" class="sans" fill="${t.textTertiary}" font-size="14">
    Backend &amp; Full-Stack Developer  ·  Phnom Penh  ·  ${s.totalRepos} repos
  </text>

  <!-- Inline metrics row -->
  <g transform="translate(64, 388)" class="mono" font-size="12">
    <text fill="${t.textTertiary}">commits/7d</text>
    <text x="76" fill="${t.textPrimary}" font-weight="700" font-size="14">${s.commitsThisWeek}</text>

    <text x="118" fill="${t.textMuted}">·</text>

    <text x="138" fill="${t.textTertiary}">streak</text>
    <text x="184" fill="${t.textPrimary}" font-weight="700" font-size="14">${s.streak}d</text>
    <text x="${184 + String(s.streak + "d").length * 8 + 4}" font-size="12">🔥</text>

    <text x="248" fill="${t.textMuted}">·</text>

    <text x="268" fill="${t.textTertiary}">active in</text>
    <text x="328" fill="${t.textPrimary}" font-weight="700" font-size="14">${s.reposTouchedCount}</text>
    <text x="${s.reposTouchedCount > 9 ? 350 : 340}" fill="${t.textTertiary}">repo${s.reposTouchedCount === 1 ? "" : "s"}</text>
  </g>

  <!-- LIVE indicator -->
  <g transform="translate(64, 422)">
    <circle class="live" cx="5" cy="5" r="4.5" fill="${t.liveDot}"/>
    <text x="18" y="10" class="mono" fill="${t.liveText}" font-size="11" font-weight="700" letter-spacing="0.2em">LIVE</text>
    <text x="60" y="10" class="mono" fill="${t.textTertiary}" font-size="11">·  refreshed ${esc(s.updatedAt)}</text>
  </g>

  <!-- Vertical separator -->
  <line x1="780" y1="60" x2="780" y2="420" stroke="${t.rule}" stroke-width="1"/>

  <!-- ============ RIGHT DATA ============ -->

  <!-- Section 1: 12-week heatmap -->
  <g>
    <text x="820" y="76" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">12 WEEKS OF SHIPPING</text>
    <text x="1216" y="76" text-anchor="end" class="mono" fill="${t.textTertiary}" font-size="11">${s.total12w} commits</text>
    ${renderHeatmap(s.heatmap, s.maxDay, t)}
  </g>

  <!-- Section 2: 30-day sparkline -->
  <g>
    <text x="820" y="276" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">DAILY COMMITS · 30D</text>
    <text x="1216" y="276" text-anchor="end" class="mono" fill="${t.textTertiary}" font-size="11">peak ${s.maxDay}/day</text>
    ${renderSparkline(s.sparkline, t)}
  </g>

  <!-- Section 3: Latest ships -->
  <g>
    <text x="820" y="362" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">LATEST SHIPS</text>
    ${renderShips(s.recent, t)}
  </g>
</svg>
`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const [stats, fontB64] = await Promise.all([getStats(), getEmbeddedKhmerFont()]);

await fs.mkdir("assets", { recursive: true });
await fs.writeFile("assets/banner-dark.svg", renderSvg(stats, fontB64, "dark"));
await fs.writeFile("assets/banner-light.svg", renderSvg(stats, fontB64, "light"));

console.log("banner-dark.svg + banner-light.svg generated.");
console.log("stats:", stats);
console.log("khmer font embedded:", !!fontB64);