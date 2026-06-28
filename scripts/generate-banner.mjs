import fs from "node:fs/promises";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import subsetFont from "subset-font";

const USER = "SRUN-Sochettra";
const OUT = "assets/banner.svg";
const KHMER_GREETING = "សួស្ដី";

const PINNED_LANG_HINT = {
  EggScan: "Java",
  "Research-AI": "TS",
  "Khmer-Banking": "TS",
  HyperspaceOS: "JS",
  "Spring-Boot---API-Blog": "Java",
  "RPI---RFID-Access-Control-System": "Py",
};

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// Embedded Khmer font
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

// Deterministic pseudo-random for constellation positions
function seedRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
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
  const weekAgo = today.getTime() - 6 * 24 * 60 * 60 * 1000;

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

  const bars = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = ymdUTC(d);
    bars.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
      count: perDay[key] ?? 0,
    });
  }

  // Current streak
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

  // Recent repos
  const { data: repos } = await octo.repos.listForUser({
    username: USER,
    sort: "pushed",
    per_page: 10,
  });
  const recent = repos.filter((r) => !r.fork).slice(0, 3).map((r) => ({
    name: r.name,
    lang: r.language || PINNED_LANG_HINT[r.name] || "—",
    when: fmtRel(r.pushed_at),
  }));

  const { data: user } = await octo.users.getByUsername({ username: USER });

  return {
    commitsThisWeek,
    reposTouchedCount: reposTouched.size,
    streak,
    recent,
    totalRepos: user.public_repos,
    bars,
    updatedAt:
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
}

// ------------------------------------------------------------------
// Renderers
// ------------------------------------------------------------------
function renderConstellation() {
  const rand = seedRand(42);
  const stars = [];
  for (let i = 0; i < 35; i++) {
    const x = Math.floor(rand() * 1280);
    const y = Math.floor(rand() * 420);
    const r = (rand() * 0.9 + 0.4).toFixed(2);
    const o = (rand() * 0.5 + 0.15).toFixed(2);
    stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`);
  }
  return stars.join("");
}

function renderBars(bars) {
  const W = 290;
  const H = 70;
  const x0 = 950;
  const y0 = 240;
  const barW = 28;
  const gap = (W - bars.length * barW) / (bars.length - 1);
  const maxCount = Math.max(1, ...bars.map((b) => b.count));

  return bars
    .map((b, i) => {
      const x = x0 + i * (barW + gap);
      const h = b.count === 0 ? 4 : Math.max(6, Math.round((b.count / maxCount) * (H - 24)));
      const y = y0 + (H - 16) - h;
      const isHot = b.count >= maxCount * 0.7 && b.count > 0;
      const fill = b.count === 0 ? "#1e293b" : isHot ? "#f59e0b" : "#8b5cf6";
      return `
    <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${fill}" opacity="0.92"/>
    <text x="${x + barW / 2}" y="${y0 + H - 2}" text-anchor="middle" class="mono" fill="#475569" font-size="9">${b.label}</text>
    ${b.count > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" class="mono" fill="#cbd5e1" font-size="9" font-weight="700">${b.count}</text>` : ""}`;
    })
    .join("");
}

function renderRecentShips(recent) {
  if (!recent.length) {
    return `<text x="950" y="170" class="mono" fill="#64748b" font-size="11">No recent ships</text>`;
  }
  const x0 = 950;
  let y = 156;
  return recent
    .map((r, i) => {
      const block = `
    <g transform="translate(${x0}, ${y})">
      <rect x="0" y="0" width="290" height="42" rx="6" fill="#0b1224" stroke="#1e293b"/>
      <circle cx="14" cy="21" r="3" fill="#22c55e"/>
      <text x="26" y="18" class="sans" fill="#f8fafc" font-size="13" font-weight="700">${esc(clip(r.name, 26))}</text>
      <text x="26" y="33" class="mono" fill="#64748b" font-size="10">${esc(r.lang)} · ${esc(r.when)}</text>
      <text x="278" y="22" text-anchor="end" class="mono" fill="#8b5cf6" font-size="9" letter-spacing="0.1em">#${i + 1}</text>
    </g>`;
      y += 50;
      return block;
    })
    .join("");
}

function renderSvg(s, fontB64) {
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 420" width="1280" height="420" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Srun Sochettra — live banner">
  <defs>
    ${fontFace}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0e1f"/>
      <stop offset="55%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#3b0764"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="60%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.4" r="0.6">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.85" r="0.4">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#6366f1" stroke-width="0.5" opacity="0.08"/>
    </pattern>
    <linearGradient id="nameGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#c4b5fd"/>
    </linearGradient>
    <linearGradient id="khmerGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <style type="text/css"><![CDATA[
      .mono { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; }
      .sans { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      .khmer { font-family: ${khmerFontFamily}; font-weight: 700; }
      @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.9; } }
      .live { animation: pulse 2s ease-in-out infinite; }
      .twinkle-a { animation: twinkle 4s ease-in-out infinite; }
      .twinkle-b { animation: twinkle 4s ease-in-out infinite; animation-delay: 1.5s; }
      .twinkle-c { animation: twinkle 4s ease-in-out infinite; animation-delay: 3s; }
    ]]></style>
  </defs>

  <!-- Background layers -->
  <rect width="1280" height="420" fill="url(#bg)"/>
  <g opacity="0.9">${renderConstellation()}</g>
  <rect width="1280" height="420" fill="url(#grid)"/>
  <rect width="1280" height="420" fill="url(#glow)"/>
  <rect width="1280" height="420" fill="url(#glow2)"/>
  <rect x="0" y="0" width="6" height="420" fill="url(#accentBar)"/>

  <!-- Decorative lotus mark, larger -->
  <g transform="translate(55, 70)" opacity="0.22" stroke="#fbbf24" stroke-width="1.5" fill="none">
    <path d="M 0 0 L 32 -48 L 64 0 L 32 48 Z"/>
    <path d="M 32 -48 L 32 48"/>
    <path d="M 0 0 L 64 0"/>
    <circle cx="32" cy="0" r="7"/>
    <path d="M -12 16 Q 32 36 76 16"/>
    <path d="M -8 -20 Q 32 -40 72 -20" opacity="0.6"/>
  </g>

  <!-- Subtle code-style decoration top right -->
  <g transform="translate(1080, 38)" class="mono" font-size="11" fill="#475569" opacity="0.55">
    <text y="0">const dev = {</text>
    <text x="12" y="16">name: <tspan fill="#fbbf24">'Sochettra'</tspan>,</text>
    <text x="12" y="32">from: <tspan fill="#22c55e">'KH'</tspan> 🇰🇭,</text>
    <text x="12" y="48">ships: <tspan fill="#8b5cf6">true</tspan>,</text>
    <text y="64">};</text>
  </g>

  <!-- Tag -->
  <text x="140" y="62" class="mono" fill="#f59e0b" font-size="13" opacity="0.9" letter-spacing="0.2em">
    [ codify · solve · impact ]
  </text>

  <!-- Khmer + Latin name (much bigger) -->
  <text x="140" y="150" class="khmer" fill="url(#khmerGrad)" font-size="62">${KHMER_GREETING}</text>
  <text x="328" y="150" class="sans" fill="#475569" font-size="56" font-weight="200">/</text>
  <text x="370" y="150" class="sans" fill="url(#nameGrad)" font-size="56" font-weight="800" letter-spacing="-0.025em">
    Srun Sochettra
  </text>

  <!-- Underline accent -->
  <line x1="140" y1="170" x2="280" y2="170" stroke="url(#accentBar)" stroke-width="2.5" opacity="0.8"/>

  <!-- Tagline -->
  <text x="140" y="200" class="mono" fill="#e2e8f0" font-size="17" letter-spacing="0.04em">
    Building software that matters in <tspan fill="#fbbf24" font-weight="700">Cambodia</tspan> 🇰🇭
  </text>

  <!-- Sub -->
  <text x="140" y="226" class="sans" fill="#94a3b8" font-size="14">
    Backend &amp; Full-Stack Developer  •  Phnom Penh  •  Always shipping
  </text>

  <!-- Focus pills -->
  <g transform="translate(140, 248)" class="sans" font-size="12" fill="#e2e8f0">
    <rect x="0" y="0" width="84" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="42" y="18" text-anchor="middle">Backend</text>
    <rect x="94" y="0" width="70" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="129" y="18" text-anchor="middle">AI Tools</text>
    <rect x="174" y="0" width="68" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="208" y="18" text-anchor="middle">Fintech</text>
    <rect x="252" y="0" width="106" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="305" y="18" text-anchor="middle">Web &amp; Mobile</text>
    <rect x="368" y="0" width="86" height="28" rx="14" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="411" y="18" text-anchor="middle">Hardware</text>
  </g>

  <!-- LIVE indicator -->
  <g transform="translate(140, 298)">
    <circle class="live" cx="6" cy="6" r="5" fill="#22c55e"/>
    <text x="20" y="11" class="mono" fill="#22c55e" font-size="12" letter-spacing="0.25em" font-weight="700">LIVE</text>
    <text x="68" y="11" class="mono" fill="#64748b" font-size="11">refreshed ${esc(s.updatedAt)}</text>
  </g>

  <!-- STATS STRIP (4 cards, bigger) -->
  <g transform="translate(140, 318)">
    <rect x="0" y="0" width="168" height="66" rx="10" fill="#0b1224" stroke="#1e293b" stroke-width="1.5"/>
    <text x="14" y="22" class="mono" fill="#64748b" font-size="10" letter-spacing="0.15em">COMMITS / 7D</text>
    <text x="14" y="50" class="sans" fill="#f8fafc" font-size="26" font-weight="800">${s.commitsThisWeek}</text>
    <text x="58" y="50" class="mono" fill="#94a3b8" font-size="11">/ ${s.reposTouchedCount} repo${s.reposTouchedCount === 1 ? "" : "s"}</text>

    <rect x="180" y="0" width="148" height="66" rx="10" fill="#0b1224" stroke="#1e293b" stroke-width="1.5"/>
    <text x="194" y="22" class="mono" fill="#64748b" font-size="10" letter-spacing="0.15em">STREAK</text>
    <text x="194" y="50" class="sans" fill="#f8fafc" font-size="26" font-weight="800">${s.streak}</text>
    <text x="234" y="50" class="mono" fill="#fbbf24" font-size="11" font-weight="700">🔥 day${s.streak === 1 ? "" : "s"}</text>

    <rect x="340" y="0" width="148" height="66" rx="10" fill="#0b1224" stroke="#1e293b" stroke-width="1.5"/>
    <text x="354" y="22" class="mono" fill="#64748b" font-size="10" letter-spacing="0.15em">PUBLIC REPOS</text>
    <text x="354" y="50" class="sans" fill="#f8fafc" font-size="26" font-weight="800">${s.totalRepos}</text>

    <rect x="500" y="0" width="160" height="66" rx="10" fill="#0b1224" stroke="#1e293b" stroke-width="1.5"/>
    <text x="514" y="22" class="mono" fill="#64748b" font-size="10" letter-spacing="0.15em">FOCUS</text>
    <text x="514" y="44" class="sans" fill="#fbbf24" font-size="14" font-weight="700">Fintech · AI · Edge</text>
    <text x="514" y="58" class="mono" fill="#64748b" font-size="9">for Cambodia 🇰🇭</text>
  </g>

  <!-- RIGHT COLUMN: Latest Ships -->
  <g>
    <text x="950" y="130" class="mono" fill="#94a3b8" font-size="11" letter-spacing="0.2em" font-weight="700">LATEST SHIPS</text>
    <line x1="950" y1="138" x2="1240" y2="138" stroke="#1e293b" stroke-width="1"/>
    ${renderRecentShips(s.recent)}
  </g>

  <!-- RIGHT BOTTOM: 7-day shipping graph -->
  <g>
    <text x="950" y="226" class="mono" fill="#94a3b8" font-size="11" letter-spacing="0.2em" font-weight="700">SHIPPING — 7D</text>
    <text x="1240" y="226" text-anchor="end" class="mono" fill="#64748b" font-size="10">${s.commitsThisWeek} commits</text>
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
console.log("banner.svg generated");
console.log("stats:", stats);
console.log("khmer font embedded:", !!fontB64);