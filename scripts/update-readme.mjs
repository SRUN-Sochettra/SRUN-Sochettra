// scripts/update-readme.mjs
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

const PINNED_ORDER = [
  "EggScan",
  "Research-AI",
  "HyperspaceOS",
  "Khmer-Banking",
  "Spring-Boot---API-Blog",
  "RPI---RFID-Access-Control-System",
];
const PINNED = new Set(PINNED_ORDER);

const ANIME_LIST = [
  { name: "SNAFU",             search: "Yahari Ore no Seishun Love Comedy wa Machigatteiru" },
  { name: "Bunny Girl Senpai", search: "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai" },
  { name: "Saiki K.",          search: "Saiki Kusuo no Psi-nan" },
  { name: "Attack on Titan",   search: "Shingeki no Kyojin" },
  { name: "Rewrite",           search: "Rewrite" },
];

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// HTML tag builders (LT/GT survive chat paste)
// ------------------------------------------------------------------
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);

const IMG = (src, alt, attrs = "") =>
  `${LT}img src="${escAttr(src)}" alt="${escAttr(alt)}"${attrs ? " " + attrs : ""} /${GT}`;

const A = (href, inner) =>
  `${LT}a href="${escAttr(href)}"${GT}${inner}${LT}/a${GT}`;

const PICTURE = (dark, light, altText) => [
  `${LT}picture${GT}`,
  `  ${LT}source media="(prefers-color-scheme: dark)" srcset="${escAttr(dark)}" /${GT}`,
  `  ${LT}source media="(prefers-color-scheme: light)" srcset="${escAttr(light)}" /${GT}`,
  `  ${IMG(dark, altText, `width="100%"`)}`,
  `${LT}/picture${GT}`,
].join("\n");

// Consistent editorial section label
const sectionLabel = (t) =>
  `${LT}sub${GT}${LT}code${GT}${escText(t)}${LT}/code${GT}${LT}/sub${GT}`;

// ------------------------------------------------------------------
// String helpers
// ------------------------------------------------------------------
function escAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function replaceBlock(md, key, content) {
  const re = new RegExp(
    `(<!--\\s*START:${key}\\s*-->)[\\s\\S]*?(<!--\\s*END:${key}\\s*-->)`
  );
  return md.replace(re, (_m, start, end) => `${start}\n${content}\n${end}`);
}

function fmtDate(iso) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

// Correction #3: consistent short units (s / m / h)
function fmtHM(seconds) {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtNum(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

async function hashFile(filepath) {
  try {
    const buf = await fs.readFile(filepath);
    return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch (err) {
    console.warn(`hashFile failed for ${filepath}:`, err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Banner
// ------------------------------------------------------------------
function renderBanner() {
  return PICTURE(
    "./assets/banner-dark.svg",
    "./assets/banner-light.svg",
    "Srun Sochettra"
  );
}

// ------------------------------------------------------------------
// Selected Work rail
// Correction #1: langDot removed. Language shown as <code> tag,
// which matches the mono voice used everywhere else.
// Correction #7: return null-safe empty string that collapses cleanly.
// ------------------------------------------------------------------
async function renderPins() {
  const results = await Promise.all(
    PINNED_ORDER.map(async (name) => {
      try {
        const { data } = await octo.repos.get({ owner: USER, repo: name });
        return {
          name: data.name,
          url:  data.html_url,
          desc: (data.description || "").trim(),
          lang: data.language || "",
          stars: data.stargazers_count || 0,
        };
      } catch (err) {
        console.warn(`pin fetch failed for ${name}:`, err.message);
        return null;
      }
    })
  );

  const projects = results.filter(Boolean);
  if (projects.length === 0) {
    return `${LT}sub${GT}${LT}i${GT}Selected work is loading…${LT}/i${GT}${LT}/sub${GT}`;
  }

  const cards = projects.map((p, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const idxHtml = `${LT}sub${GT}${LT}code${GT}${idx}${LT}/code${GT}${LT}/sub${GT}`;
    const title = A(p.url, `${LT}b${GT}${escText(p.name)}${LT}/b${GT}`);
    const desc = p.desc
      ? `${LT}sub${GT}${escText(p.desc)}${LT}/sub${GT}`
      : `${LT}sub${GT}${LT}i${GT}no description${LT}/i${GT}${LT}/sub${GT}`;

    const metaParts = [];
    if (p.lang)  metaParts.push(`${LT}code${GT}${escText(p.lang)}${LT}/code${GT}`);
    if (p.stars) metaParts.push(`★ ${fmtNum(p.stars)}`);
    const meta = metaParts.length
      ? `${LT}sub${GT}${metaParts.join(" &nbsp;·&nbsp; ")}${LT}/sub${GT}`
      : "";

    return [
      `${idxHtml} &nbsp; ${title}`,
      desc,
      meta,
    ].filter(Boolean).join(`${LT}br/${GT}`);
  });

  const rows = [];
  for (let i = 0; i < cards.length; i += 3) rows.push(cards.slice(i, i + 3));

  const trs = rows.map((row) => {
    const cells = row.map((c) =>
      `${LT}td valign="top" width="33%"${GT}${c}${LT}/td${GT}`
    );
    while (cells.length < 3) cells.push(`${LT}td width="33%"${GT}${LT}/td${GT}`);
    return `${LT}tr${GT}${cells.join("")}${LT}/tr${GT}`;
  });

  const label = sectionLabel(`SELECTED WORK  ·  ${projects.length} PROJECTS`);
  return `${label}\n\n${LT}table${GT}${trs.join("")}${LT}/table${GT}`;
}

// ------------------------------------------------------------------
// Full-width metrics card
// ------------------------------------------------------------------
function renderMetricsCard(path, alt) {
  return `${LT}div align="center"${GT}${IMG(path, alt, `width="100%"`)}${LT}/div${GT}`;
}

// ------------------------------------------------------------------
// Coder dropdown
// ------------------------------------------------------------------
async function renderCoder() {
  const [activity, waka] = await Promise.all([getActivity(), getWaka()]);

  const rowA = [
    `${LT}table${GT}`,
    `${LT}tr${GT}`,
    `${LT}td width="55%" valign="top"${GT}`,
    `${sectionLabel("RECENT ACTIVITY")}${LT}br/${GT}${LT}br/${GT}`,
    activity,
    `${LT}/td${GT}`,
    `${LT}td width="45%" valign="top"${GT}`,
    `${sectionLabel("LAST 7 DAYS · WAKATIME")}${LT}br/${GT}${LT}br/${GT}`,
    waka,
    `${LT}/td${GT}`,
    `${LT}/tr${GT}`,
    `${LT}/table${GT}`,
  ].join("\n");

  const langs     = renderMetricsCard("./assets/metrics-languages.svg", "Languages");
  const activity2 = renderMetricsCard("./assets/metrics-activity.svg",  "Activity");

  return `${rowA}\n\n${langs}\n\n${activity2}`;
}

// ------------------------------------------------------------------
// Person dropdown
// ------------------------------------------------------------------
async function renderPerson() {
  const animeMd = await getAnimeStrip();

  const anilist = renderMetricsCard("./assets/metrics-anilist.svg", "AniList");
  const social  = renderMetricsCard("./assets/metrics-social.svg",  "Stars and people");

  const rowB = [
    sectionLabel("TOP ANIME · IN ORDER"),
    ``,
    animeMd,
  ].join("\n");

  return `${anilist}\n\n${social}\n\n${rowB}`;
}

// ------------------------------------------------------------------
// Numbers dropdown
// Correction #2: no inline styles. Use <h3> for large numbers.
// Correction #6: <h3 align="center"> to guarantee centering.
// ------------------------------------------------------------------
async function renderNumbers() {
  const stats = await getProfileStats();

  const iso      = renderMetricsCard("./assets/metrics-iso.svg",      "Contribution isocalendar");
  const followup = renderMetricsCard("./assets/metrics-followup.svg", "Follow-ups and calendar");

  const stat = (value, label) =>
    `${LT}td align="center" width="25%"${GT}` +
    `${LT}sub${GT}${LT}code${GT}${escText(label.toUpperCase())}${LT}/code${GT}${LT}/sub${GT}` +
    `${LT}h3 align="center"${GT}${escText(value)}${LT}/h3${GT}` +
    `${LT}/td${GT}`;

  const rowB = [
    `${LT}table${GT}`,
    `${LT}tr${GT}`,
    stat(fmtNum(stats.publicRepos),      "Public repos"),
    stat(fmtNum(stats.commitsLastYear),  "Commits · 1y"),
    stat(fmtNum(stats.followers),        "Followers"),
    stat(fmtNum(stats.following),        "Following"),
    `${LT}/tr${GT}`,
    `${LT}/table${GT}`,
  ].join("\n");

  return `${iso}\n\n${followup}\n\n${rowB}`;
}

// ------------------------------------------------------------------
// Profile stats
// ------------------------------------------------------------------
async function getProfileStats() {
  const base = { publicRepos: 0, followers: 0, following: 0, commitsLastYear: 0 };
  try {
    const { data: u } = await octo.users.getByUsername({ username: USER });
    base.publicRepos = u.public_repos || 0;
    base.followers   = u.followers    || 0;
    base.following   = u.following    || 0;
  } catch (err) {
    console.warn("user profile fetch failed:", err.message);
  }
  try {
    const q = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
            restrictedContributionsCount
          }
        }
      }
    `;
    const g = await octo.graphql(q, { login: USER });
    const c = g?.user?.contributionsCollection;
    base.commitsLastYear =
      (c?.totalCommitContributions || 0) + (c?.restrictedContributionsCount || 0);
  } catch (err) {
    console.warn("contributions fetch failed:", err.message);
  }
  return base;
}

// ------------------------------------------------------------------
// Anime strip
// Correction #9: escape year for consistency.
// ------------------------------------------------------------------
async function getAnimeCover(searchTerm) {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($search: String) {
          Media(search: $search, type: ANIME) {
            title { english romaji }
            coverImage { large medium }
            startDate { year }
            siteUrl
          }
        }`,
        variables: { search: searchTerm },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const m = j.data?.Media;
    if (!m) return null;
    return {
      title: m.title.english || m.title.romaji,
      cover: m.coverImage.large || m.coverImage.medium,
      year:  m.startDate?.year || null,
      url:   m.siteUrl,
    };
  } catch (err) {
    console.warn(`anime search failed for "${searchTerm}":`, err.message);
    return null;
  }
}

async function getAnimeStrip() {
  const results = await Promise.all(ANIME_LIST.map((a) => getAnimeCover(a.search)));
  const cells = ANIME_LIST.map((a, i) => {
    const r = results[i];
    const rank = String(i + 1).padStart(2, "0");
    const rankHtml  = `${LT}sub${GT}${LT}code${GT}${rank}${LT}/code${GT}${LT}/sub${GT}`;
    const titleHtml = `${LT}b${GT}${escText(a.name)}${LT}/b${GT}`;
    const yearHtml  = r?.year
      ? `${LT}sub${GT}${escText(String(r.year))}${LT}/sub${GT}`
      : "";

    if (!r) {
      return [
        `${LT}td align="center" width="20%" valign="top"${GT}`,
        rankHtml,
        `${LT}br/${GT}`,
        titleHtml,
        `${LT}/td${GT}`,
      ].join("");
    }

    const img = IMG(r.cover, a.name, `width="140"`);
    return [
      `${LT}td align="center" width="20%" valign="top"${GT}`,
      `${A(r.url, img)}`,
      `${LT}br/${GT}`,
      `${rankHtml}${LT}br/${GT}`,
      `${titleHtml}${LT}br/${GT}`,
      yearHtml,
      `${LT}/td${GT}`,
    ].join("");
  });
  return `${LT}table${GT}\n${LT}tr${GT}\n${cells.join("\n")}\n${LT}/tr${GT}\n${LT}/table${GT}`;
}

// ------------------------------------------------------------------
// Recent activity
// Correction #1: language badge is now <code>, not dot+text.
// ------------------------------------------------------------------
async function getActivity() {
  const { data } = await octo.repos.listForUser({
    username: USER,
    sort: "pushed",
    per_page: 50,
  });

  const recent = data
    .filter((r) => !r.fork && !PINNED.has(r.name))
    .slice(0, 5);

  if (recent.length === 0) {
    return `${LT}sub${GT}${LT}i${GT}No recent activity outside pinned projects.${LT}/i${GT}${LT}/sub${GT}`;
  }

  const items = recent.map((r) => {
    const rawDesc = r.description?.trim();
    const descHtml = rawDesc
      ? escText(rawDesc)
      : `${LT}i${GT}no description${LT}/i${GT}`;
    const langBit = r.language
      ? ` ${LT}code${GT}${escText(r.language)}${LT}/code${GT}`
      : "";
    const link = A(r.html_url, `${LT}b${GT}${escText(r.name)}${LT}/b${GT}`);
    return [
      `${LT}li${GT}`,
      `${link}${langBit}`,
      `${LT}br/${GT}${LT}sub${GT}${descHtml} · ${escText(fmtDate(r.pushed_at))}${LT}/sub${GT}`,
      `${LT}/li${GT}`,
    ].join("");
  });

  return `${LT}ul${GT}\n${items.join("\n")}\n${LT}/ul${GT}`;
}

// ------------------------------------------------------------------
// WakaTime
// Correction #1: no dots — items rendered as clean rows.
// Correction #2: no inline style — uses <h3> for total.
// Correction #5: separator spacing standardized (&nbsp;·&nbsp; everywhere).
// Correction #8: <br/> after sectionLabel so the table breathes.
// ------------------------------------------------------------------
async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return `${LT}sub${GT}${LT}i${GT}Connect a WakaTime account to populate this section.${LT}/i${GT}${LT}/sub${GT}`;
  }
  const auth = Buffer.from(`${process.env.WAKATIME_API_KEY}:`).toString("base64");
  const res = await fetch(
    "https://wakatime.com/api/v1/users/current/stats/last_7_days",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    console.warn(`WakaTime ${res.status}: ${body}`);
    return `${LT}sub${GT}${LT}i${GT}WakaTime fetch failed.${LT}/i${GT}${LT}/sub${GT}`;
  }
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const daily = data.human_readable_daily_average || fmtHM(data.daily_average || 0);
  const best  = data.best_day
    ? `${fmtShortDate(data.best_day.date)}  ·  ${fmtHM(data.best_day.total_seconds)}`
    : null;

  function itemList(items, valueFn) {
    if (!items || items.length === 0) return "";
    const rows = items.map((it) => {
      return (
        `${LT}tr${GT}` +
        `${LT}td${GT}${LT}sub${GT}${escText(it.name)}${LT}/sub${GT}${LT}/td${GT}` +
        `${LT}td align="right"${GT}${LT}sub${GT}${escText(valueFn(it))}${LT}/sub${GT}${LT}/td${GT}` +
        `${LT}/tr${GT}`
      );
    });
    return `${LT}table${GT}${rows.join("")}${LT}/table${GT}`;
  }

  const langs    = itemList((data.languages || []).slice(0, 6), (l) => `${l.percent.toFixed(1)}%`);
  const editors  = itemList((data.editors   || []).slice(0, 4), (e) => `${e.percent.toFixed(0)}%`);
  const projects = itemList((data.projects  || []).slice(0, 4), (p) => fmtHM(p.total_seconds));

  const br2 = `${LT}br/${GT}${LT}br/${GT}`;

  const parts = [];
  parts.push(`${LT}h3${GT}${escText(total)}${LT}/h3${GT}${LT}sub${GT}total this week${LT}/sub${GT}`);
  parts.push(
    `${LT}sub${GT}Daily avg  ·  ${escText(daily)}` +
    (best ? `  &nbsp;·&nbsp;  Best day  ·  ${escText(best)}` : "") +
    `${LT}/sub${GT}`
  );
  if (langs)    parts.push(`${sectionLabel("LANGUAGES")}${LT}br/${GT}${langs}`);
  if (editors)  parts.push(`${sectionLabel("EDITORS")}${LT}br/${GT}${editors}`);
  if (projects) parts.push(`${sectionLabel("PROJECTS")}${LT}br/${GT}${projects}`);

  return parts.join(br2);
}

// ------------------------------------------------------------------
// Timestamp
// ------------------------------------------------------------------
function renderTimestamp() {
  const now = new Date();
  const nowStr = now.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${LT}sub${GT}${LT}code${GT}REFRESHED · ${escText(nowStr)}${LT}/code${GT}${LT}/sub${GT}`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [pinsHtml, coderHtml, personHtml, numbersHtml] = await Promise.all([
  renderPins(),
  renderCoder(),
  renderPerson(),
  renderNumbers(),
]);
const bannerHtml = renderBanner();
const tsHtml     = renderTimestamp();

let out = tpl;
out = replaceBlock(out, "BANNER",    bannerHtml);
out = replaceBlock(out, "PINS",      pinsHtml);
out = replaceBlock(out, "CODER",     coderHtml);
out = replaceBlock(out, "PERSON",    personHtml);
out = replaceBlock(out, "NUMBERS",   numbersHtml);
out = replaceBlock(out, "TIMESTAMP", tsHtml);

const HASHED_SVGS = [
  "assets/banner-dark.svg",
  "assets/banner-light.svg",
  "assets/metrics-languages.svg",
  "assets/metrics-activity.svg",
  "assets/metrics-anilist.svg",
  "assets/metrics-social.svg",
  "assets/metrics-iso.svg",
  "assets/metrics-followup.svg",
];

const hashes = await Promise.all(HASHED_SVGS.map(hashFile));

HASHED_SVGS.forEach((path, i) => {
  const hash = hashes[i];
  if (!hash) return;
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(\\?v=[a-z0-9]+)?`, "gi");
  out = out.replace(re, `${path}?v=${hash}`);
});

await fs.writeFile(OUTPUT, out);
console.log("README.md updated.");
console.log(
  "cache keys:",
  Object.fromEntries(HASHED_SVGS.map((p, i) => [p, hashes[i]]))
);