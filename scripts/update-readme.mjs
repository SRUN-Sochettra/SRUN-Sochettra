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

const ANILIST_USER = "scarletsages";

// ------------------------------------------------------------------
// External card themes — matches banner palette
// ------------------------------------------------------------------
const THEME_DARK = {
  bg: "0a0a0f",
  title: "58a6ff",
  text: "d6d3d1",
  icon: "3b82f6",
  border: "1e293b",
};
const THEME_LIGHT = {
  bg: "fafaf9",
  title: "0969da",
  text: "44403c",
  icon: "3b82f6",
  border: "e2e8f0",
};

function pinCardUrl(repo, t) {
  const q = [
    `username=${USER}`,
    `repo=${encodeURIComponent(repo)}`,
    `bg_color=${t.bg}`,
    `title_color=${t.title}`,
    `text_color=${t.text}`,
    `icon_color=${t.icon}`,
    `hide_border=true`,
    `show_owner=false`,
    `border_radius=8`,
  ].join("&");
  return `https://github-readme-stats.vercel.app/api/pin/?${q}`;
}

function streakCardUrl(t) {
  const q = [
    `user=${USER}`,
    `hide_border=true`,
    `background=${t.bg}`,
    `stroke=${t.bg}`,
    `ring=${t.title}`,
    `fire=${t.title}`,
    `currStreakLabel=${t.title}`,
    `sideLabels=${t.text}`,
    `dates=${t.text}`,
    `currStreakNum=${t.text}`,
    `sideNums=${t.text}`,
  ].join("&");
  return `https://streak-stats.demolab.com/?${q}`;
}

function trophyUrl(t) {
  const q = [
    `username=${USER}`,
    `theme=darkhub`,
    `no-frame=true`,
    `no-bg=true`,
    `column=6`,
    `margin-w=15`,
    `margin-h=15`,
    `title_color=${t.title}`,
  ].join("&");
  return `https://github-profile-trophy.vercel.app/?${q}`;
}

const octo = new Octokit({ auth: process.env.GH_TOKEN });

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

function fmtAbsolute(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtHM(seconds) {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
// Data caches
// ------------------------------------------------------------------
let _reposCache = null;
async function getAllRepos() {
  if (_reposCache) return _reposCache;
  try {
    const { data } = await octo.repos.listForUser({
      username: USER,
      sort: "pushed",
      per_page: 100,
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
                episodes
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
    entries.sort((a, b) => {
      const dt = (b.updatedAt || 0) - (a.updatedAt || 0);
      if (dt !== 0) return dt;
      const at = (a.media?.title?.english || a.media?.title?.romaji || "");
      const bt = (b.media?.title?.english || b.media?.title?.romaji || "");
      return at.localeCompare(bt);
    });
    const e = entries[0];
    _anilistCurrentCache = {
      title: e.media.title.english || e.media.title.romaji || "Unknown",
      cover: e.media.coverImage?.medium || null,
      url:   e.media.siteUrl || null,
      progress: e.progress || 0,
      total: e.media.episodes || null,
    };
    return _anilistCurrentCache;
  } catch (err) {
    console.warn("anilist current fetch failed:", err.message);
    _anilistCurrentCache = false;
    return null;
  }
}

let _wakaCache = null;
async function getWakaData() {
  if (_wakaCache) return _wakaCache;
  if (!process.env.WAKATIME_API_KEY) {
    _wakaCache = { available: false };
    return _wakaCache;
  }
  const auth = Buffer.from(`${process.env.WAKATIME_API_KEY}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };
  async function fetchStats(range) {
    const url = `https://wakatime.com/api/v1/users/current/stats/${range}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()).data;
  }
  try {
    const [d7, d14] = await Promise.all([
      fetchStats("last_7_days"),
      fetchStats("last_14_days"),
    ]);
    if (!d7) { _wakaCache = { available: false }; return _wakaCache; }
    let delta = null;
    if (d14) {
      const prev = (d14.total_seconds || 0) - (d7.total_seconds || 0);
      if (prev > 0) {
        delta = Math.round(((d7.total_seconds - prev) / prev) * 100);
      }
    }
    _wakaCache = { available: true, data: d7, delta };
    return _wakaCache;
  } catch (err) {
    console.warn("waka fetch failed:", err.message);
    _wakaCache = { available: false };
    return _wakaCache;
  }
}

// ------------------------------------------------------------------
// Banner + bio
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

// ------------------------------------------------------------------
// Full-width metrics card (local SVGs)
// ------------------------------------------------------------------
function renderMetricsCard(path, alt) {
  return `${LT}div align="center"${GT}${IMG(path, alt, `width="100%"`)}${LT}/div${GT}`;
}

// External card with dark/light picture
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
// Selected Work — themed pin cards, 2x3 grid
// ------------------------------------------------------------------
function renderPins() {
  const cards = PINNED_ORDER.map((repo) => {
    const darkUrl  = pinCardUrl(repo, THEME_DARK);
    const lightUrl = pinCardUrl(repo, THEME_LIGHT);
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
// WORK dropdown
// ------------------------------------------------------------------
async function renderWork() {
  const [activity, waka] = await Promise.all([
    getActivity(),
    getWaka(),
  ]);
  const pins = renderPins();

  const activityWakaRow = [
    `${LT}table role="presentation" width="100%"${GT}${LT}tbody${GT}`,
    `${LT}tr${GT}`,
    `${LT}td width="45%" valign="top"${GT}`,
    activity,
    `${LT}/td${GT}`,
    `${LT}td width="55%" valign="top"${GT}`,
    waka,
    `${LT}/td${GT}`,
    `${LT}/tr${GT}`,
    `${LT}/tbody${GT}${LT}/table${GT}`,
  ].join("\n");

  const langs = renderMetricsCard("./assets/metrics-languages.svg", "Languages");
  const activityMetric = renderMetricsCard("./assets/metrics-activity.svg", "Activity");

  return `${activityWakaRow}\n\n${pins}\n\n${langs}\n\n${activityMetric}`;
}

// ------------------------------------------------------------------
// LIFE dropdown
// ------------------------------------------------------------------
async function renderLife() {
  const animeMd = await getAnimeStrip();
  const anilist = renderMetricsCard("./assets/metrics-anilist.svg", "AniList");
  const social  = renderMetricsCard("./assets/metrics-social.svg",  "Stars and people");

  return `${anilist}\n\n${animeMd}\n\n${social}`;
}

// ------------------------------------------------------------------
// STATS dropdown — iso + streak + trophy + followup
// ------------------------------------------------------------------
function renderStats() {
  const iso = renderMetricsCard("./assets/metrics-iso.svg", "Contribution isocalendar");

  const streakDark  = streakCardUrl(THEME_DARK);
  const streakLight = streakCardUrl(THEME_LIGHT);
  const streak = renderExternalCard(streakDark, streakLight, "Commit streak stats");

  const trophyDark  = trophyUrl(THEME_DARK);
  const trophyLight = trophyUrl(THEME_LIGHT);
  const trophy = renderExternalCard(trophyDark, trophyLight, "Achievement trophies");

  const followup = renderMetricsCard("./assets/metrics-followup.svg", "Follow-ups and calendar");

  return `${iso}\n\n${streak}\n\n${trophy}\n\n${followup}`;
}

// ------------------------------------------------------------------
// Anime strip
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
            genres
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
      genres: (m.genres || []).slice(0, 2),
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
    const title = `${LT}b${GT}${escText(a.name)}${LT}/b${GT}`;
    const yearHtml = r?.year
      ? `${LT}sub${GT}${LT}code${GT}${escText(String(r.year))}${LT}/code${GT}${LT}/sub${GT}`
      : "";
    const genreHtml = r?.genres?.length
      ? `${LT}sub${GT}${escText(r.genres.join(", "))}${LT}/sub${GT}`
      : "";
    if (!r) {
      return `${LT}td align="center" width="20%" valign="top"${GT}${title}${LT}/td${GT}`;
    }
    const img = IMG(r.cover, a.name, `width="140"`);
    return [
      `${LT}td align="center" width="20%" valign="top"${GT}`,
      A(r.url, img),
      `${LT}br/${GT}${LT}br/${GT}`,
      title,
      yearHtml ? `${LT}br/${GT}${yearHtml}` : "",
      genreHtml ? `${LT}br/${GT}${genreHtml}` : "",
      `${LT}/td${GT}`,
    ].filter(Boolean).join("");
  });
  return `${LT}table role="presentation" width="100%"${GT}${LT}tbody${GT}${LT}tr${GT}\n${cells.join("\n")}\n${LT}/tr${GT}${LT}/tbody${GT}${LT}/table${GT}`;
}

// ------------------------------------------------------------------
// Recent activity
// ------------------------------------------------------------------
async function getActivity() {
  const repos = await getAllRepos();
  const recent = repos
    .filter((r) => !r.fork && !PINNED.has(r.name))
    .slice(0, 5);
  if (recent.length === 0) {
    return meta("No recent activity outside pinned projects.");
  }
  const items = recent.map((r) => {
    const rawDesc = r.description?.trim();
    const link = A(r.html_url, `${LT}b${GT}${escText(r.name)}${LT}/b${GT}`);
    const date = `${fmtRelative(r.pushed_at)} · ${fmtAbsolute(r.pushed_at)}`;
    const metaLine = rawDesc
      ? `${LT}sub${GT}${escText(clip(rawDesc, 75))} · ${escText(date)}${LT}/sub${GT}`
      : `${LT}sub${GT}${escText(date)}${LT}/sub${GT}`;
    return [
      `${LT}li${GT}`,
      link,
      `${LT}br/${GT}${metaLine}`,
      `${LT}/li${GT}`,
    ].join("");
  });
  return `${LT}ul${GT}\n${items.join("\n")}\n${LT}/ul${GT}`;
}

// ------------------------------------------------------------------
// WakaTime
// ------------------------------------------------------------------
async function getWaka() {
  const w = await getWakaData();
  if (!w.available) {
    return process.env.WAKATIME_API_KEY
      ? meta("WakaTime fetch failed.")
      : meta("Connect a WakaTime account to populate this section.");
  }
  const { data, delta } = w;

  const total = fmtHM(data.total_seconds || 0);
  const daily = fmtHM(data.daily_average || 0);
  const bestValue = data.best_day ? fmtHM(data.best_day.total_seconds) : "—";
  const bestLabel = data.best_day ? fmtAbsolute(data.best_day.date) : "best day";

  let deltaHtml = "";
  if (delta !== null && delta !== undefined) {
    const arrow = delta >= 0 ? "↑" : "↓";
    deltaHtml = `${LT}sub${GT}${arrow} ${Math.abs(delta)}% vs prev week${LT}/sub${GT}`;
  }

  const hero = [
    `${LT}sub${GT}this week${LT}/sub${GT}${LT}br/${GT}`,
    `${LT}h2${GT}${escText(total)}${LT}/h2${GT}`,
    deltaHtml || "",
  ].filter(Boolean).join("");

  const subStat = (value, label) =>
    `${LT}td align="center" width="50%"${GT}` +
    `${LT}sub${GT}${escText(label)}${LT}/sub${GT}` +
    `${LT}br/${GT}` +
    `${LT}b${GT}${escText(value)}${LT}/b${GT}` +
    `${LT}/td${GT}`;

  const subRow = [
    `${LT}table role="presentation" width="100%"${GT}${LT}tbody${GT}${LT}tr${GT}`,
    subStat(daily,     "daily avg"),
    subStat(bestValue, bestLabel),
    `${LT}/tr${GT}${LT}/tbody${GT}${LT}/table${GT}`,
  ].join("");

  function listCard(title, items, valueFn, numbered = false) {
    if (!items || items.length === 0) return "";
    const rows = items.map((it, i) => {
      const name = it.name.length > 12 ? it.name.slice(0, 11) + "…" : it.name;
      const prefix = numbered ? `${i + 1}.  ` : "";
      return (
        `${LT}tr${GT}` +
        `${LT}td${GT}${LT}sub${GT}${escText(prefix + name)}${LT}/sub${GT}${LT}/td${GT}` +
        `${LT}td align="right"${GT}${LT}sub${GT}${escText(valueFn(it))}${LT}/sub${GT}${LT}/td${GT}` +
        `${LT}/tr${GT}`
      );
    });
    return [
      `${LT}td valign="top" width="33%"${GT}`,
      `${LT}sub${GT}${escText(title)}${LT}/sub${GT}`,
      `${LT}br/${GT}`,
      `${LT}table role="presentation"${GT}${LT}tbody${GT}${rows.join("")}${LT}/tbody${GT}${LT}/table${GT}`,
      `${LT}/td${GT}`,
    ].join("");
  }

  const langs    = (data.languages || []).slice(0, 5);
  const editors  = (data.editors   || []).slice(0, 4);
  const projects = (data.projects  || []).slice(0, 4);

  const cardsRow = [
    `${LT}table role="presentation" width="100%"${GT}${LT}tbody${GT}${LT}tr${GT}`,
    listCard("languages", langs,    (l) => `${l.percent.toFixed(1)}%`),
    listCard("editors",   editors,  (e) => `${e.percent.toFixed(0)}%`),
    listCard("projects",  projects, (p) => fmtHM(p.total_seconds), true),
    `${LT}/tr${GT}${LT}/tbody${GT}${LT}/table${GT}`,
  ].join("");

  const br = `${LT}br/${GT}`;
  return `${hero}${br}${subRow}${br}${cardsRow}`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [
  bioHtml, workHtml, lifeHtml,
  workPreview, statsPreview, lifePreview,
] = await Promise.all([
  renderBio(),
  renderWork(),
  renderLife(),
  renderWorkPreview(),
  renderStatsPreview(),
  renderLifePreview(),
]);
const bannerHtml = renderBanner();
const statsHtml  = renderStats();

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
