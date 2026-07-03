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

const ANILIST_USER = "scarletsages";

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// External card URLs — proven, ready-made services
// ------------------------------------------------------------------

// github-readme-stats: pin cards, stats card, waka card, top langs
// Using tokyonight theme (widely used, matches your banner palette)
const GRS_THEME_DARK = "tokyonight";
const GRS_THEME_LIGHT = "default";

function pinCardUrl(repo, theme) {
  const q = [
    `username=${USER}`,
    `repo=${encodeURIComponent(repo)}`,
    `theme=${theme}`,
    `hide_border=true`,
    `show_owner=false`,
    `border_radius=8`,
  ].join("&");
  return `https://github-readme-stats.vercel.app/api/pin/?${q}`;
}

function statsCardUrl(theme) {
  const q = [
    `username=${USER}`,
    `theme=${theme}`,
    `hide_border=true`,
    `include_all_commits=true`,
    `count_private=true`,
    `show_icons=true`,
    `rank_icon=github`,
    `border_radius=8`,
  ].join("&");
  return `https://github-readme-stats.vercel.app/api?${q}`;
}

function topLangsUrl(theme) {
  const q = [
    `username=${USER}`,
    `theme=${theme}`,
    `hide_border=true`,
    `layout=compact`,
    `langs_count=8`,
    `border_radius=8`,
  ].join("&");
  return `https://github-readme-stats.vercel.app/api/top-langs/?${q}`;
}

function wakaCardUrl(theme) {
  const q = [
    `username=${USER}`,
    `theme=${theme}`,
    `hide_border=true`,
    `layout=compact`,
    `langs_count=8`,
    `border_radius=8`,
  ].join("&");
  return `https://github-readme-stats.vercel.app/api/wakatime?${q}`;
}

// github-readme-streak-stats
function streakCardUrl(theme) {
  const q = [
    `user=${USER}`,
    `theme=${theme}`,
    `hide_border=true`,
    `border_radius=8`,
  ].join("&");
  return `https://streak-stats.demolab.com/?${q}`;
}

// github-profile-trophy
function trophyUrl(theme) {
  const q = [
    `username=${USER}`,
    `theme=${theme}`,
    `no-frame=true`,
    `column=6`,
    `margin-w=15`,
    `margin-h=15`,
  ].join("&");
  return `https://github-profile-trophy.vercel.app/?${q}`;
}

// github-readme-activity-graph (Ashutosh00710)
function activityGraphUrl(theme) {
  const q = [
    `username=${USER}`,
    `theme=${theme}`,
    `hide_border=true`,
    `bg_color=00000000`,
    `area=true`,
    `radius=8`,
  ].join("&");
  return `https://github-readme-activity-graph.vercel.app/graph?${q}`;
}

// ------------------------------------------------------------------
// Tag builders
// ------------------------------------------------------------------
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);

const IMG = (src, alt, attrs = "") =>
  `${LT}img src="${escAttr(src)}" alt="${escAttr(alt)}"${attrs ? " " + attrs : ""} /${GT}`;

const A = (href, inner) =>
  `${LT}a href="${escAttr(href)}"${GT}${inner}${LT}/a${GT}`;

const PICTURE = (dark, light, altText, imgAttrs = `width="100%"`) => [
  `${LT}picture${GT}`,
  `  ${LT}source media="(prefers-color-scheme: dark)" srcset="${escAttr(dark)}" /${GT}`,
  `  ${LT}source media="(prefers-color-scheme: light)" srcset="${escAttr(light)}" /${GT}`,
  `  ${IMG(dark, altText, imgAttrs)}`,
  `${LT}/picture${GT}`,
].join("\n");

const meta = (t) => `${LT}sub${GT}${escText(t)}${LT}/sub${GT}`;

// ------------------------------------------------------------------
// String helpers
// ------------------------------------------------------------------
function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
function escText(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function replaceBlock(md, key, content) {
  const re = new RegExp(
    `(<!--\\s*START:${key}\\s*-->)[\\s\\S]*?(<!--\\s*END:${key}\\s*-->)`
  );
  return md.replace(re, (_m, start, end) => `${start}\n${content}\n${end}`);
}

function fmtRelative(iso) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1y ago" : `${years}y ago`;
}

function fmtNum(n) { return new Intl.NumberFormat("en-US").format(n); }
function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

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
// Data — minimal, only for preview lines
// ------------------------------------------------------------------
let _reposCache = null;
async function getAllRepos() {
  if (_reposCache) return _reposCache;
  try {
    const { data } = await octo.repos.listForUser({
      username: USER,
      sort: "pushed",
      per_page: 20,
    });
    _reposCache = data;
    return data;
  } catch (err) {
    console.warn("repos fetch failed:", err.message);
    _reposCache = [];
    return _reposCache;
  }
}

let _profileCache = null;
async function getProfile() {
  if (_profileCache) return _profileCache;
  try {
    const { data } = await octo.users.getByUsername({ username: USER });
    _profileCache = data;
    return data;
  } catch (err) {
    console.warn("profile fetch failed:", err.message);
    _profileCache = {};
    return _profileCache;
  }
}

let _commitsLastYearCache = null;
async function getCommitsLastYear() {
  if (_commitsLastYearCache !== null) return _commitsLastYearCache;
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
    _commitsLastYearCache =
      (c?.totalCommitContributions || 0) + (c?.restrictedContributionsCount || 0);
    return _commitsLastYearCache;
  } catch (err) {
    console.warn("commits query failed:", err.message);
    _commitsLastYearCache = 0;
    return 0;
  }
}

let _anilistCurrentCache = null;
async function getAnilistCurrent() {
  if (_anilistCurrentCache !== null) return _anilistCurrentCache;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($name: String) {
          MediaListCollection(userName: $name, type: ANIME, status: CURRENT) {
            lists { entries {
              progress
              updatedAt
              media {
                title { english romaji }
                coverImage { medium }
                siteUrl
              }
            } }
          }
        }`,
        variables: { name: ANILIST_USER },
      }),
    });
    if (!res.ok) { _anilistCurrentCache = false; return null; }
    const j = await res.json();
    const entries = j.data?.MediaListCollection?.lists?.flatMap((l) => l.entries) || [];
    if (entries.length === 0) { _anilistCurrentCache = false; return null; }
    entries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const e = entries[0];
    _anilistCurrentCache = {
      title: e.media.title.english || e.media.title.romaji || "Unknown",
      cover: e.media.coverImage?.medium || null,
      url:   e.media.siteUrl || null,
    };
    return _anilistCurrentCache;
  } catch (err) {
    console.warn("anilist current fetch failed:", err.message);
    _anilistCurrentCache = false;
    return null;
  }
}

// ------------------------------------------------------------------
// Renderers
// ------------------------------------------------------------------
function renderBanner() {
  return PICTURE(
    "./assets/banner-dark.svg",
    "./assets/banner-light.svg",
    "Srun Sochettra"
  );
}

async function renderBio() {
  const p = await getProfile();
  if (!p.bio || !p.bio.trim()) return "";
  return `${LT}br/${GT}${LT}sub${GT}${LT}i${GT}${escText(p.bio.trim())}${LT}/i${GT}${LT}/sub${GT}`;
}

function renderMetricsCard(path, alt) {
  return `${LT}div align="center"${GT}${IMG(path, alt, `width="100%"`)}${LT}/div${GT}`;
}

function renderExternalCard(darkUrl, lightUrl, alt) {
  const picture = PICTURE(darkUrl, lightUrl, alt, "");
  return `${LT}div align="center"${GT}${picture}${LT}/div${GT}`;
}

// ------------------------------------------------------------------
// Preview lines
// ------------------------------------------------------------------
async function renderWorkPreview() {
  const repos = await getAllRepos();
  const latest = repos.find((r) => !r.fork);
  if (!latest) return "";
  const parts = [
    escText(latest.name),
    latest.language ? escText(latest.language) : null,
    escText(fmtRelative(latest.pushed_at)),
  ].filter(Boolean);
  return `${LT}sub${GT}last commit → ${parts.join(" · ")}${LT}/sub${GT}`;
}

async function renderStatsPreview() {
  const count = await getCommitsLastYear();
  return `${LT}sub${GT}${fmtNum(count)} commits · past year${LT}/sub${GT}`;
}

async function renderLifePreview() {
  const current = await getAnilistCurrent();
  if (!current) return `${LT}sub${GT}between shows${LT}/sub${GT}`;
  const thumb = current.cover
    ? IMG(current.cover, current.title, `height="18" align="middle"`)
    : "";
  const title = current.url
    ? A(current.url, escText(clip(current.title, 40)))
    : escText(clip(current.title, 40));
  return `${LT}sub${GT}now watching →${thumb}${title}${LT}/sub${GT}`;
}

// ------------------------------------------------------------------
// Selected Work — pin cards, 2x3 grid
// ------------------------------------------------------------------
function renderPins() {
  const cards = PINNED_ORDER.map((repo) => {
    const darkUrl  = pinCardUrl(repo, GRS_THEME_DARK);
    const lightUrl = pinCardUrl(repo, GRS_THEME_LIGHT);
    const repoUrl  = `https://github.com/${USER}/${repo}`;
    const picture = PICTURE(darkUrl, lightUrl, repo, "");
    return A(repoUrl, picture);
  });

  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2));

  const trs = rows.map((row) => {
    const rowCells = row.map((c) =>
      `${LT}td width="50%" align="center"${GT}${c}${LT}/td${GT}`
    );
    while (rowCells.length < 2) rowCells.push(`${LT}td width="50%"${GT}${LT}/td${GT}`);
    return `${LT}tr${GT}${rowCells.join("")}${LT}/tr${GT}`;
  });

  return `${LT}table role="presentation"${GT}${LT}tbody${GT}${trs.join("")}${LT}/tbody${GT}${LT}/table${GT}`;
}

// ------------------------------------------------------------------
// WORK dropdown — 100% ready-made
// Layout: stats card + waka card side-by-side, then pins, then top langs
// ------------------------------------------------------------------
function renderWork() {
  const pins = renderPins();

  const statsDark  = statsCardUrl(GRS_THEME_DARK);
  const statsLight = statsCardUrl(GRS_THEME_LIGHT);
  const wakaDark   = wakaCardUrl(GRS_THEME_DARK);
  const wakaLight  = wakaCardUrl(GRS_THEME_LIGHT);

  const statsPic = PICTURE(statsDark, statsLight, "GitHub stats", "");
  const wakaPic  = PICTURE(wakaDark,  wakaLight,  "WakaTime stats", "");

  const topRow = [
    `${LT}table role="presentation" width="100%"${GT}${LT}tbody${GT}`,
    `${LT}tr${GT}`,
    `${LT}td width="50%" align="center" valign="top"${GT}${statsPic}${LT}/td${GT}`,
    `${LT}td width="50%" align="center" valign="top"${GT}${wakaPic}${LT}/td${GT}`,
    `${LT}/tr${GT}`,
    `${LT}/tbody${GT}${LT}/table${GT}`,
  ].join("\n");

  const langsDark  = topLangsUrl(GRS_THEME_DARK);
  const langsLight = topLangsUrl(GRS_THEME_LIGHT);
  const topLangs = renderExternalCard(langsDark, langsLight, "Top languages");

  const activityMetric = renderMetricsCard("./assets/metrics-activity.svg", "Activity");

  return `${topRow}\n\n${pins}\n\n${topLangs}\n\n${activityMetric}`;
}

// ------------------------------------------------------------------
// LIFE dropdown — 100% lowlighter
// ------------------------------------------------------------------
function renderLife() {
  const anilist = renderMetricsCard("./assets/metrics-anilist.svg", "AniList");
  const social  = renderMetricsCard("./assets/metrics-social.svg",  "Stars and people");

  return `${anilist}\n\n${social}`;
}

// ------------------------------------------------------------------
// STATS dropdown — lowlighter iso + activity graph + streak + trophy + followup
// ------------------------------------------------------------------
function renderStats() {
  const iso = renderMetricsCard("./assets/metrics-iso.svg", "Contribution isocalendar");

  const graphDark  = activityGraphUrl("react-dark");
  const graphLight = activityGraphUrl("minimal");
  const graph = renderExternalCard(graphDark, graphLight, "Activity graph");

  const streakDark  = streakCardUrl("tokyonight");
  const streakLight = streakCardUrl("default");
  const streak = renderExternalCard(streakDark, streakLight, "Commit streak stats");

  const trophyDark  = trophyUrl("tokyonight");
  const trophyLight = trophyUrl("flat");
  const trophy = renderExternalCard(trophyDark, trophyLight, "Achievement trophies");

  const followup = renderMetricsCard("./assets/metrics-followup.svg", "Follow-ups and calendar");

  return `${iso}\n\n${graph}\n\n${streak}\n\n${trophy}\n\n${followup}`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [
  bioHtml,
  workPreview, statsPreview, lifePreview,
] = await Promise.all([
  renderBio(),
  renderWorkPreview(),
  renderStatsPreview(),
  renderLifePreview(),
]);
const bannerHtml = renderBanner();
const workHtml   = renderWork();
const statsHtml  = renderStats();
const lifeHtml   = renderLife();

let out = tpl;
out = replaceBlock(out, "BANNER",         bannerHtml);
out = replaceBlock(out, "BIO",            bioHtml);
out = replaceBlock(out, "WORK",           workHtml);
out = replaceBlock(out, "STATS",          statsHtml);
out = replaceBlock(out, "LIFE",           lifeHtml);
out = replaceBlock(out, "WORK_PREVIEW",   workPreview);
out = replaceBlock(out, "STATS_PREVIEW",  statsPreview);
out = replaceBlock(out, "LIFE_PREVIEW",   lifePreview);

const HASHED_SVGS = [
  "assets/banner-dark.svg",
  "assets/banner-light.svg",
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
