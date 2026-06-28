import fs from "node:fs/promises";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const OUT = "assets/banner.svg";
const KHMER_GREETING = "សួស្ដី";

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// Bulletproof Khmer font: fetch Noto Serif Khmer, subset, base64 embed
// ------------------------------------------------------------------
async function getEmbeddedKhmerFont() {
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Serif+Khmer:wght@700&display=swap",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    if (!cssRes.ok) throw new Error("CSS fetch failed");
    const css = await cssRes.text();

    // Find the @font-face block that covers Khmer unicode range U+1780-17FF
    const blocks = css.split("@font-face").slice(1);
    const khmerBlock =
      blocks.find((b) => /U\+1780/i.test(b)) || blocks[blocks.length - 1];
    const urlMatch = khmerBlock.match(/url\(([^)]+\.woff2)\)/);
    if (!urlMatch) throw new Error("No woff2 URL found in CSS");

    const fontRes = await fetch(urlMatch[1]);
    if (!fontRes.ok) throw new Error("Font fetch failed");
    const fontBuf = Buffer.from(await fontRes.arrayBuffer());

    // Subset to only the characters we render
    const subset = await subsetFont(fontBuf, KHMER_GREETING, {
      targetFormat: "woff2",
    });
    return subset.toString("base64");
  } catch (err) {
    console.warn("Khmer font embedding failed, using fallback:", err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Stats from GitHub
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

function ymdUTC(d) {
  return d.toISOString().slice(0, 10);
}

async function getStats() {
  // Pull up to 300 events
  const events = await octo.paginate(
    octo.activity.listPublicEventsForUser,
    { username: USER, per_page: 100 },
    (res) => res.data
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = today.getTime() - 6 * 24 * 60 * 60 * 1000;

  // Build a per-day commit count map and a set of days with any push
  const perDay = {};
  const reposTouched = new Set();
  let commitsThisWeek = 0;

  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = new Date(e.created_at);
    const key = ymdUTC(t);
    const count = e.payload.commits?.length ?? 0;
    perDay[key] = (perDay[key] ?? 0) + count;

    if (t.getTime() >= weekAgo) {
      commitsThisWeek += count;
      reposTouched.add(e.repo.name);
    }
  }

  // Last 7 days bars (Mon..Sun ordering doesn't matter, just chronological)
  const bars = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = ymdUTC(d);
    bars.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
      count: perDay[key] ?? 0,
    });
  }

  // Current streak: consecutive days back from today with >=1 push
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = ymdUTC(d);
    if ((perDay[key] ?? 0) > 0) {
      streak++;
    } else {
      // allow today to be empty without breaking the streak
      if (i === 0) continue;
      break;
    }
  }

  // Most recent non-fork repo
  const { data: repos } = await octo.repos.listForUser({
    username: USER,
    sort: "pushed",
    per_page: 30,
  });
  const lastShip = repos.find((r) => !r.fork) ?? null;

  const { data: user } = await octo.users.getByUsername({ username: USER });

  return {
    commitsThisWeek,
    reposTouchedCount: reposTouched.size,
    streak,
    lastShipName: lastShip?.name ?? "—",
    lastShipWhen: lastShip ? fmtRel(lastShip.pushed_at) : "—",
    totalRepos: user.public_repos,
    bars,
    updatedAt:
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// SVG renderer
// ------------------------------------------------------------------
function renderBars(bars) {
  // Layout: bars area is 280x80, starting at x=940, y=205
  const W = 280;
  const H = 80;
  const x0 = 940;
  const y0 = 205;
  const barW = 28;
  const gap = (W - bars.length * barW) / (bars.length - 1);
  const maxCount = Math.max(1, ...bars.map((b) => b.count));

  return bars
    .map((b, i) => {
      const x = x0 + i * (barW + gap);
      const h = Math.max(2, Math.round((b.count / maxCount) * (H - 22)));
      const y = y0 + (H - 18) - h;
      const isHot = b.count >= maxCount * 0.7 && b.count > 0;
      const fill = b.count === 0 ? "#1e293b" : isHot ? "#f59e0b" : "#8b5cf6";
      const label = b.label;
      return `
    <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${fill}" opacity="0.9"/>
    <text x="${x + barW / 2}" y="${y0 + H - 4}" text-anchor="middle" class="mono" fill="#64748b" font-size="9">${label}</text>
    ${b.count > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" class="mono" fill="#cbd5e1" font-size="9">${b.count}</text>` : ""}`;
    })
    .join("");
}

function renderSvg(s, fontB64) {
  const lastShipLabel =
    s.lastShipName.length > 22
      ? s.lastShipName.slice(0, 20) + "…"
      : s.lastShipName;

  const fontFace = fontB64
    ? `<style type="text/css"><![CDATA[
      @font-face {
        font-family: 'KhmerEmbed';
        font-weight: 700;
        font-style: normal;
        src: url(data:font/woff2;base64,${fontB64}) format('woff2');
      }
    ]]></style>`
    : "";

  const khmerFontFamily = fontB64
    ? "'KhmerEmbed', 'Noto Serif Khmer', 'Khmer OS', serif"
    : "'Noto Serif Khmer', 'Khmer OS', serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 360" width="1280" height="360" role="img" aria-label="Srun Sochettra — live banner">
  <defs>
    ${fontFace}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" stroke-width="0.5" opacity="0.12"/>
    </pattern>
    <style type="text/css"><![CDATA[
      .mono { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
      .sans { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      .khmer { font-family: ${khmerFontFamily}; font-weight: 700; }
      @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      .live { animation: pulse 2s ease-in-out infinite; }
    ]]></style>
  </defs>

  <rect width="1280" height="360" fill="url(#bg)"/>
  <rect width="1280" height="360" fill="url(#grid)"/>
  <rect width="1280" height="360" fill="url(#glow)"/>
  <rect x="0" y="0" width="6" height="360" fill="url(#accent)"/>

  <!-- Lotus geometric mark -->
  <g transform="translate(50, 60)" opacity="0.18" stroke="#fbbf24" stroke-width="1.5" fill="none">
    <path d="M 0 0 L 28 -42 L 56 0 L 28 42 Z"/>
    <path d="M 28 -42 L 28 42"/>
    <path d="M 0 0 L 56 0"/>
    <circle cx="28" cy="0" r="6"/>
    <path d="M -10 14 Q 28 30 66 14"/>
  </g>

  <!-- Top tag -->
  <text x="125" y="58" class="mono" fill="#f59e0b" font-size="13" opacity="0.85" letter-spacing="0.15em">
    [ codify · solve · impact ]
  </text>

  <!-- Khmer + Latin name -->
  <text x="125" y="130" class="khmer" fill="#fbbf24" font-size="46">${KHMER_GREETING}</text>
  <text x="265" y="130" class="sans" fill="#64748b" font-size="40" font-weight="300">/</text>
  <text x="295" y="130" class="sans" fill="#f8fafc" font-size="44" font-weight="800" letter-spacing="-0.02em">
    Srun Sochettra
  </text>

  <!-- Tagline -->
  <text x="127" y="172" class="mono" fill="#cbd5e1" font-size="16" letter-spacing="0.05em">
    Building software that matters in <tspan fill="#fbbf24" font-weight="700">Cambodia</tspan> 🇰🇭
  </text>

  <text x="127" y="200" class="sans" fill="#94a3b8" font-size="13">
    Backend &amp; Full-Stack Developer  •  Phnom Penh
  </text>

  <!-- Focus pills -->
  <g transform="translate(127, 222)" class="sans" font-size="11" fill="#cbd5e1">
    <rect x="0" y="0" width="78" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="39" y="16" text-anchor="middle">Backend</text>
    <rect x="88" y="0" width="62" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="119" y="16" text-anchor="middle">AI Tools</text>
    <rect x="158" y="0" width="62" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="189" y="16" text-anchor="middle">Fintech</text>
    <rect x="228" y="0" width="98" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="277" y="16" text-anchor="middle">Web &amp; Mobile</text>
    <rect x="334" y="0" width="78" height="24" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="373" y="16" text-anchor="middle">Hardware</text>
  </g>

  <!-- LIVE indicator -->
  <g transform="translate(127, 270)">
    <circle class="live" cx="6" cy="6" r="5" fill="#22c55e"/>
    <text x="20" y="11" class="mono" fill="#22c55e" font-size="11" letter-spacing="0.2em">LIVE</text>
    <text x="62" y="11" class="mono" fill="#64748b" font-size="11">refreshed ${esc(s.updatedAt)}</text>
  </g>

  <!-- STATS STRIP (4 cards) -->
  <g transform="translate(127, 290)">
    <!-- Card 1: commits / 7d -->
    <rect x="0" y="0" width="155" height="56" rx="8" fill="#0b1224" stroke="#1e293b"/>
    <text x="12" y="20" class="mono" fill="#64748b" font-size="10" letter-spacing="0.1em">COMMITS / 7D</text>
    <text x="12" y="44" class="sans" fill="#f8fafc" font-size="22" font-weight="800">${s.commitsThisWeek}</text>
    <text x="50" y="44" class="mono" fill="#94a3b8" font-size="10">/ ${s.reposTouchedCount} repo${s.reposTouchedCount === 1 ? "" : "s"}</text>

    <!-- Card 2: streak -->
    <rect x="169" y="0" width="140" height="56" rx="8" fill="#0b1224" stroke="#1e293b"/>
    <text x="181" y="20" class="mono" fill="#64748b" font-size="10" letter-spacing="0.1em">STREAK</text>
    <text x="181" y="44" class="sans" fill="#f8fafc" font-size="22" font-weight="800">${s.streak}</text>
    <text x="220" y="44" class="mono" fill="#fbbf24" font-size="10">🔥 day${s.streak === 1 ? "" : "s"}</text>

    <!-- Card 3: last shipped -->
    <rect x="323" y="0" width="240" height="56" rx="8" fill="#0b1224" stroke="#1e293b"/>
    <text x="335" y="20" class="mono" fill="#64748b" font-size="10" letter-spacing="0.1em">LAST SHIPPED</text>
    <text x="335" y="40" class="sans" fill="#fbbf24" font-size="14" font-weight="700">${esc(lastShipLabel)}</text>
    <text x="335" y="52" class="mono" fill="#94a3b8" font-size="10">${esc(s.lastShipWhen)}</text>

    <!-- Card 4: total repos -->
    <rect x="577" y="0" width="120" height="56" rx="8" fill="#0b1224" stroke="#1e293b"/>
    <text x="589" y="20" class="mono" fill="#64748b" font-size="10" letter-spacing="0.1em">REPOS</text>
    <text x="589" y="44" class="sans" fill="#f8fafc" font-size="22" font-weight="800">${s.totalRepos}</text>
  </g>

  <!-- Live commit bar chart (right side) -->
  <g>
    <text x="940" y="135" class="mono" fill="#64748b" font-size="11" letter-spacing="0.15em">SHIPPING — LAST 7 DAYS</text>
    <text x="940" y="155" class="sans" fill="#f8fafc" font-size="13" font-weight="600">
      ${s.commitsThisWeek > 0 ? `${s.commitsThisWeek} commits` : "warming up"}
      <tspan fill="#94a3b8" font-weight="400" font-size="11"> · keeping the lights on</tspan>
    </text>
    <line x1="940" y1="172" x2="1220" y2="172" stroke="#1e293b" stroke-width="1"/>
    ${renderBars(s.bars)}
  </g>
</svg>
`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const [stats, fontB64] = await Promise.all([getStats(), getEmbeddedKhmerFont()]);
const svg = renderSvg(stats, fontB64);
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, svg);
console.log("banner.svg generated.");
console.log("Stats:", stats);
console.log("Khmer font embedded:", !!fontB64);