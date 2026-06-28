// scripts/generate-banner.mjs
import fs from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const KHMER_GREETING = "សួស្ដី";
const DISPLAY_NAME = "Srun Sochettra";

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
    accentSoft: "#fbbf24",
    khmerColor: "#fbbf24",
    rule: "#292524",
    ruleStrong: "#3f3a31",
    cellEmpty: "#1c1917",
    cellLevels: ["#3b2a05", "#78520c", "#b8780f", "#f59e0b"],
    sparklineStroke: "#f59e0b",
    sparklineFillOpacity: 0.18,
    liveDot: "#22c55e",
    liveText: "#22c55e",
    deltaUp: "#22c55e",
    deltaDown: "#ef4444",
    shipDot: "#f59e0b",
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
    accentSoft: "#b45309",
    khmerColor: "#b45309",
    rule: "#e7e5e4",
    ruleStrong: "#d6d3d1",
    cellEmpty: "#e7e5e4",
    cellLevels: ["#fde68a", "#fcd34d", "#f59e0b", "#d97706"],
    sparklineStroke: "#d97706",
    sparklineFillOpacity: 0.18,
    liveDot: "#16a34a",
    liveText: "#15803d",
    deltaUp: "#15803d",
    deltaDown: "#b91c1c",
    shipDot: "#d97706",
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
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function ymdUTC(d) { return d.toISOString().slice(0, 10); }

function fmtDateUpper(d) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).toUpperCase();
}

function fmtShortDate(d) {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

// ------------------------------------------------------------------
// Stats
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
            weeks { contributionDays { date contributionCount } }
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

async function getLanguageStats() {
  try {
    const data = await octo.graphql(
      `query($login: String!) {
        user(login: $login) {
          repositories(first: 50, ownerAffiliations: OWNER, isFork: false,
                       orderBy: {field: PUSHED_AT, direction: DESC}) {
            nodes {
              languages(first: 8, orderBy: {field: SIZE, direction: DESC}) {
                edges { size, node { name, color } }
              }
            }
          }
        }
      }`,
      { login: USER }
    );
    const totals = new Map();
    for (const repo of data.user.repositories.nodes) {
      for (const edge of repo.languages.edges) {
        const cur = totals.get(edge.node.name)
          || { bytes: 0, color: edge.node.color || "#8b8680" };
        cur.bytes += edge.size;
        totals.set(edge.node.name, cur);
      }
    }
    const total = [...totals.values()].reduce((s, v) => s + v.bytes, 0) || 1;
    return [...totals.entries()]
      .map(([name, v]) => ({ name, color: v.color, pct: (v.bytes / total) * 100, bytes: v.bytes }))
      .sort((a, b) => b.bytes - a.bytes);
  } catch (err) {
    console.warn("language stats failed:", err.message);
    return [];
  }
}

async function getStats() {
  const [perDay, languages] = await Promise.all([
    getContributionMap(),
    getLanguageStats(),
  ]);
  const langColorByName = new Map(languages.map((l) => [l.name, l.color]));

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let commitsThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    commitsThisWeek += perDay[ymdUTC(d)] ?? 0;
  }

  let commitsPrevWeek = 0;
  for (let i = 7; i < 14; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    commitsPrevWeek += perDay[ymdUTC(d)] ?? 0;
  }
  const commitsDelta = commitsThisWeek - commitsPrevWeek;

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
  const repoCommits = new Map();
  let latestPush = null;
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = new Date(e.created_at).getTime();
    if (!latestPush) latestPush = e;
    if (t >= weekAgo) {
      reposTouched.add(e.repo.name);
      const c = e.payload?.commits?.length || 1;
      repoCommits.set(e.repo.name, (repoCommits.get(e.repo.name) || 0) + c);
    }
  }

  // FOCUS: prefer non-profile repo (profile repo is just the readme bot)
  const profileRepoName = `${USER}/${USER}`;
  const nonProfileEntries = [...repoCommits.entries()].filter(([name]) => name !== profileRepoName);
  const focusEntries = nonProfileEntries.length > 0 ? nonProfileEntries : [...repoCommits.entries()];

  let focus = null;
  if (focusEntries.length > 0) {
    const [name, commits] = focusEntries.sort((a, b) => b[1] - a[1])[0];
    focus = {
      name: name.includes("/") ? name.split("/")[1] : name,
      commits,
    };
  }

  let lastCommit = null;
  if (latestPush) {
    const sha = latestPush.payload?.head?.slice(0, 7);
    if (sha) {
      lastCommit = { sha, date: new Date(latestPush.created_at) };
    }
  }

  const heatmap = [];
  const HEATMAP_DAYS = 84;
  const firstDayOffset = HEATMAP_DAYS - 1;
  for (let col = 0; col < 12; col++) {
    const week = [];
    for (let row = 0; row < 7; row++) {
      const offset = firstDayOffset - (col * 7 + row);
      const d = new Date(today.getTime() - offset * 86400000);
      week.push({ count: perDay[ymdUTC(d)] ?? 0, date: d });
    }
    heatmap.push(week);
  }

  const sparkline = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    sparkline.push(perDay[ymdUTC(d)] ?? 0);
  }
  const sparklineStart = new Date(today.getTime() - 29 * 86400000);
  const sparklineEnd = today;
  const sparkTotal = sparkline.reduce((a, b) => a + b, 0);
  const sparkAvg = sparkTotal / sparkline.length;

  const { data: repos } = await octo.repos.listForUser({
    username: USER, sort: "pushed", per_page: 10,
  });
  const recent = repos
    .filter((r) => !r.fork)
    .slice(0, 3)
    .map((r) => ({
      name: r.name,
      lang: r.language || "—",
      langColor: langColorByName.get(r.language) || "#8b8680",
      when: fmtRel(r.pushed_at),
    }));

  const { data: user } = await octo.users.getByUsername({ username: USER });

  const flatCounts = heatmap.flat().map((c) => c.count);
  const total12w = flatCounts.reduce((a, b) => a + b, 0);
  const maxDay = Math.max(0, ...flatCounts);
  const max30d = Math.max(0, ...sparkline);
  const activeDays = flatCounts.filter((c) => c > 0).length;

  return {
    commitsThisWeek,
    commitsPrevWeek,
    commitsDelta,
    reposTouchedCount: reposTouched.size,
    streak,
    recent,
    totalRepos: user.public_repos,
    heatmap,
    sparkline,
    sparklineStart,
    sparklineEnd,
    sparkTotal,
    sparkAvg,
    total12w,
    maxDay,
    max30d,
    activeDays,
    languages,
    focus,
    lastCommit,
    updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// Renderers
// ------------------------------------------------------------------
function renderHeatmap(heatmap, maxDay, theme) {
  const x0 = 845;
  const y0 = 100;
  const cell = 20;
  const gap = 5;
  const levels = theme.cellLevels;

  let out = "";

  let lastMonth = -1;
  heatmap.forEach((week, col) => {
    const midDay = week[3].date;
    const month = midDay.getMonth();
    if (month !== lastMonth) {
      const x = x0 + col * (cell + gap);
      out += `<text x="${x}" y="${y0 - 10}" class="mono" fill="${theme.textTertiary}" font-size="10">${MONTH_LABELS[month]}</text>`;
      lastMonth = month;
    }
  });

  const weekdayRows = { 1: "M", 3: "W", 5: "F" };
  for (const [row, label] of Object.entries(weekdayRows)) {
    const y = y0 + parseInt(row) * (cell + gap) + cell / 2 + 3;
    out += `<text x="${x0 - 14}" y="${y}" text-anchor="end" class="mono" fill="${theme.textTertiary}" font-size="9">${label}</text>`;
  }

  heatmap.forEach((week, col) => {
    week.forEach(({ count }, row) => {
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
      out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${fill}"/>`;
    });
  });

  return out;
}

function renderHeatmapLegend(theme) {
  const cell = 9;
  const gap = 3;
  const swatches = [theme.cellEmpty, ...theme.cellLevels];
  const totalSwatchW = swatches.length * (cell + gap) - gap;
  const y = 283;
  const yText = 291;
  const xEnd = 1216;
  const totalW = 28 + 8 + totalSwatchW + 8 + 28;
  const xStart = xEnd - totalW;

  let out = `<text x="${xStart}" y="${yText}" class="mono" fill="${theme.textTertiary}" font-size="10">Less</text>`;
  let cx = xStart + 36;
  for (const c of swatches) {
    out += `<rect x="${cx}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${c}"/>`;
    cx += cell + gap;
  }
  out += `<text x="${cx + 5}" y="${yText}" class="mono" fill="${theme.textTertiary}" font-size="10">More</text>`;
  return out;
}

function renderSparkline(values, avg, theme) {
  const x0 = 820;
  const y0 = 322;
  const w = 396;
  const h = 42;
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

  // Peak
  let peakIdx = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[peakIdx]) peakIdx = i;
  const peakPt = pts[peakIdx];
  const peakValue = values[peakIdx];

  // Avg line
  const avgY = y0 + h - (avg / max) * h;
  const avgLine = avg > 0
    ? `<line x1="${x0}" y1="${avgY}" x2="${x0 + w}" y2="${avgY}" stroke="${theme.textMuted}" stroke-width="0.5" stroke-dasharray="2,4" opacity="0.5"/>
       <text x="${x0 + w - 4}" y="${avgY - 4}" text-anchor="end" class="mono tnum" fill="${theme.textMuted}" font-size="8" letter-spacing="0.1em">AVG ${avg.toFixed(1)}</text>`
    : "";

  const baseline = `<line x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}" stroke="${theme.rule}" stroke-width="0.5"/>`;

  // Peak label position
  const labelX = Math.max(x0 + 10, Math.min(x0 + w - 10, peakPt[0]));
  const labelY = Math.max(y0 + 2, peakPt[1] - 8);

  return `
    ${baseline}
    ${avgLine}
    <path d="${area}" fill="url(#sparkFill)"/>
    <path d="${path}" stroke="${theme.sparklineStroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${peakPt[0]}" cy="${peakPt[1]}" r="4" fill="${theme.bgEnd}"/>
    <circle cx="${peakPt[0]}" cy="${peakPt[1]}" r="3" fill="${theme.sparklineStroke}"/>
    ${peakValue > 0
      ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" class="mono tnum" fill="${theme.textPrimary}" font-size="10" font-weight="700">${peakValue}</text>`
      : ""}
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
    <rect x="820" y="${y - 13}" width="3.5" height="15" fill="${esc(r.langColor)}" rx="1.5"/>
    <text x="834" y="${y}" class="sans" fill="${theme.textPrimary}" font-size="13" font-weight="600">${esc(clip(r.name, 28))}</text>
    <text x="1216" y="${y}" text-anchor="end" class="mono" fill="${theme.textTertiary}" font-size="11">${esc(r.lang)} · ${esc(r.when)}</text>`;
      y += 22;
      return block;
    })
    .join("");
}

function renderStatsGrid(s, theme) {
  const x0 = 64;
  const yLabel = 372;
  const yValue = 402;
  const colW = 130;

  const items = [
    {
      label: "COMMITS / 7D",
      mainValue: String(s.commitsThisWeek),
      unit: null,
      delta: s.commitsDelta,
      accent: false,
    },
    {
      label: "STREAK",
      mainValue: String(s.streak),
      unit: "d",
      accent: true,
    },
    {
      label: "ACTIVE REPOS",
      mainValue: String(s.reposTouchedCount),
      unit: null,
      accent: false,
    },
    {
      label: "TOTAL REPOS",
      mainValue: String(s.totalRepos),
      unit: null,
      accent: false,
    },
  ];

  let out = "";
  items.forEach((it, i) => {
    const x = x0 + i * colW;
    const valueColor = it.accent ? theme.accent : theme.textPrimary;

    out += `<text x="${x}" y="${yLabel}" class="mono" fill="${theme.textTertiary}" font-size="10" letter-spacing="0.18em">${esc(it.label)}</text>`;
    out += `<text x="${x}" y="${yValue}" class="display tnum" fill="${valueColor}" font-size="28">${esc(it.mainValue)}</text>`;

    // Approx display number width (Fraunces 28px ≈ 17px/digit)
    const valueWidth = it.mainValue.length * 17;

    // Unit suffix (e.g. "d" for streak)
    if (it.unit) {
      const unitX = x + valueWidth + 2;
      out += `<text x="${unitX}" y="${yValue}" class="mono" fill="${theme.textTertiary}" font-size="13" font-weight="600">${esc(it.unit)}</text>`;
    }

    // Inline delta (only for COMMITS/7D, only when non-zero)
    if (typeof it.delta === "number" && it.delta !== 0) {
      const up = it.delta > 0;
      const deltaColor = up ? theme.deltaUp : theme.deltaDown;
      const arrow = up ? "▲" : "▼";
      const deltaText = `${arrow}${Math.abs(it.delta)}`;
      const deltaX = x + valueWidth + 8;
      // Position slightly higher than baseline to optically center against tall numbers
      out += `<text x="${deltaX}" y="${yValue - 4}" class="mono tnum" fill="${deltaColor}" font-size="12" font-weight="700">${esc(deltaText)}</text>`;
    }
  });
  return out;
}

function renderLanguages(langs, theme) {
  if (!langs.length) return "";
  const x0 = 64;
  // Pushed down a touch — gives breathing room from stats grid above
  const barY = 448;
  const barW = 520;
  const barH = 6;

  const top = langs.slice(0, 5);
  const topTotal = top.reduce((s, l) => s + l.bytes, 0) || 1;

  let out = `<text x="${x0}" y="${barY - 12}" class="mono" fill="${theme.textSecondary}" font-size="10" font-weight="700" letter-spacing="0.2em">TOP LANGUAGES</text>`;

  let cursor = x0;
  top.forEach((l) => {
    const segW = (l.bytes / topTotal) * barW;
    out += `<rect x="${cursor}" y="${barY}" width="${segW}" height="${barH}" fill="${esc(l.color)}"/>`;
    cursor += segW;
  });
  out += `<rect x="${x0}" y="${barY}" width="${barW}" height="${barH}" rx="2" fill="none" stroke="${theme.rule}" stroke-width="0.5"/>`;

  const chips = langs.slice(0, 4);
  const yChip = barY + barH + 20;
  let cx = x0;
  for (const l of chips) {
    const label = `${l.name} ${l.pct.toFixed(0)}%`;
    out += `<circle cx="${cx + 4}" cy="${yChip - 4}" r="3.5" fill="${esc(l.color)}"/>`;
    out += `<text x="${cx + 14}" y="${yChip}" class="mono tnum" fill="${theme.textTertiary}" font-size="11">${esc(label)}</text>`;
    cx += 14 + label.length * 6.8 + 22;
  }

  return out;
}

function renderFooter(s, theme) {
  let out = "";

  if (s.lastCommit?.sha) {
    const dateStr = fmtDateUpper(s.lastCommit.date);
    const leftText = `BUILD · ${s.lastCommit.sha} · ${dateStr}`;
    out += `<text x="64" y="492" class="mono" fill="${theme.textMuted}" font-size="9" letter-spacing="0.2em" opacity="0.75">${esc(leftText)}</text>`;
  }

  if (s.focus) {
    const focusName = clip(s.focus.name, 24).toUpperCase();
    const noun = s.focus.commits === 1 ? "COMMIT" : "COMMITS";
    const rightText = `FOCUS · ${focusName} · ${s.focus.commits} ${noun}`;
    out += `<text x="1216" y="492" text-anchor="end" class="mono" fill="${theme.textMuted}" font-size="9" letter-spacing="0.2em" opacity="0.75">${esc(rightText)}</text>`;
  }

  return out;
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

  const sparkRange = `${fmtShortDate(s.sparklineStart)} → ${fmtShortDate(s.sparklineEnd)}`;

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
    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.sparklineStroke}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${t.sparklineStroke}" stop-opacity="0"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${t.grainOpacity} 0"/>
    </filter>
    <style type="text/css"><![CDATA[
      .mono { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
      .sans { font-family: 'Inter', 'Helvetica Neue', system-ui, -apple-system, sans-serif; }
      .display { font-family: ${displayFamily}; font-weight: 700; }
      .khmer { font-family: ${khmerFamily}; font-weight: 700; }
      .tnum { font-variant-numeric: tabular-nums; }
      @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      .live { animation: pulse 2s ease-in-out infinite; }
    ]]></style>
  </defs>

  <!-- Background -->
  <rect width="1280" height="500" fill="url(#bg)"/>
  <rect width="1280" height="500" fill="url(#glow1)"/>
  <rect width="1280" height="500" fill="url(#glow2)"/>
  <rect width="1280" height="500" filter="url(#grain)" opacity="0.9"/>

  <!-- ===== EDITORIAL TOP FRAME ===== -->
  <line x1="64" y1="40" x2="1216" y2="40" stroke="${t.rule}" stroke-width="1"/>
  <rect x="64" y="38" width="36" height="3" fill="${t.accent}" rx="1.5"/>

  <!-- Coords, LIVE, and refreshed all on one line — LIVE on far left side after coords, refreshed anchored right -->
  <text x="64" y="68" class="mono" fill="${t.textTertiary}" font-size="11" letter-spacing="0.3em" opacity="0.85">
    11.55°N · 104.93°E  ·  PHNOM PENH
  </text>

  <circle class="live" cx="440" cy="64" r="4" fill="${t.liveDot}"/>
  <text x="452" y="68" class="mono" fill="${t.liveText}" font-size="11" font-weight="700" letter-spacing="0.25em">LIVE</text>

  <text x="1216" y="68" text-anchor="end" class="mono tnum" fill="${t.textTertiary}" font-size="11">refreshed ${esc(s.updatedAt)}</text>

  <!-- ===== LEFT HERO ===== -->
  <text x="64" y="174" class="khmer" fill="${t.khmerColor}" font-size="86">${KHMER_GREETING}</text>

  <text x="64" y="256" class="display" fill="${t.textPrimary}" font-size="64" letter-spacing="-0.025em">
    ${DISPLAY_NAME}
  </text>

  <g transform="translate(64, 276)">
    <rect x="0" y="0" width="22" height="3" fill="${t.accent}" rx="1.5"/>
    <rect x="28" y="1" width="110" height="1" fill="${t.ruleStrong}"/>
  </g>

  <text x="64" y="312" class="sans" fill="${t.textSecondary}" font-size="20" font-weight="400">
    Building software that matters in Cambodia.
  </text>

  <text x="64" y="336" class="sans" fill="${t.textTertiary}" font-size="13" letter-spacing="0.02em">
    Backend &amp; Full-Stack Developer  ·  Phnom Penh
  </text>

  <!-- Stats grid -->
  ${renderStatsGrid(s, t)}

  <!-- Top languages -->
  ${renderLanguages(s.languages, t)}

  <!-- Vertical separator -->
  <line x1="790" y1="60" x2="790" y2="470" stroke="${t.rule}" stroke-width="1"/>

  <!-- ===== RIGHT DATA ===== -->
  <text x="820" y="76" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">12 WEEKS OF SHIPPING</text>
  <text x="1216" y="76" text-anchor="end" class="mono tnum" fill="${t.textTertiary}" font-size="11">${s.activeDays}/84 days · ${s.total12w} contributions</text>
  ${renderHeatmap(s.heatmap, s.maxDay, t)}
  ${renderHeatmapLegend(t)}

  <text x="820" y="308" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">DAILY · 30D</text>
  <text x="1216" y="308" text-anchor="end" class="mono tnum" fill="${t.textTertiary}" font-size="11">${esc(sparkRange)} · ${s.sparkTotal} commits · peak ${s.max30d}/day</text>
  ${renderSparkline(s.sparkline, s.sparkAvg, t)}

  <text x="820" y="396" class="mono" fill="${t.textSecondary}" font-size="11" font-weight="700" letter-spacing="0.2em">LATEST SHIPS</text>
  ${renderShips(s.recent, t)}

  <!-- Bottom editorial rule + signature footer -->
  <line x1="64" y1="478" x2="1216" y2="478" stroke="${t.rule}" stroke-width="1" opacity="0.6"/>
  ${renderFooter(s, t)}
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
console.log("stats:", {
  commitsThisWeek: stats.commitsThisWeek,
  commitsDelta: stats.commitsDelta,
  streak: stats.streak,
  activeDays: stats.activeDays,
  maxDay: stats.maxDay,
  max30d: stats.max30d,
  sparkAvg: stats.sparkAvg.toFixed(2),
  sparkTotal: stats.sparkTotal,
  total12w: stats.total12w,
  focus: stats.focus,
  lastCommit: stats.lastCommit && {
    sha: stats.lastCommit.sha,
    date: stats.lastCommit.date.toISOString(),
  },
  languages: stats.languages.slice(0, 5).map((l) => `${l.name} ${l.pct.toFixed(1)}%`),
});