// scripts/update-readme.mjs
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

const PINNED = new Set([
  "EggScan",
  "Research-AI",
  "HyperspaceOS",
  "Khmer-Banking",
  "Spring-Boot---API-Blog",
  "RPI---RFID-Access-Control-System",
]);

const ANIME_LIST = [
  { name: "SNAFU",             search: "Yahari Ore no Seishun Love Comedy wa Machigatteiru" },
  { name: "Bunny Girl Senpai", search: "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai" },
  { name: "Saiki K.",          search: "Saiki Kusuo no Psi-nan" },
  { name: "Attack on Titan",   search: "Shingeki no Kyojin" },
  { name: "Rewrite",           search: "Rewrite" },
];

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// Angle-bracket constants — the chat renderer eats literal HTML tags
// on paste, so we build every tag from char codes. Verify these two
// lines are present in your pasted file before running.
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

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function escText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function fmtHM(seconds) {
  if (!seconds || seconds < 60) return `${Math.round(seconds || 0)} sec`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
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
// 2-col metrics row (row A of every dropdown)
// ------------------------------------------------------------------
function renderMetricsRow(leftPath, leftAlt, rightPath, rightAlt) {
  const leftImg  = IMG(leftPath,  leftAlt,  `width="100%"`);
  const rightImg = IMG(rightPath, rightAlt, `width="100%"`);
  return [
    `${LT}table${GT}`,
    `${LT}tr${GT}`,
    `${LT}td width="50%" align="center" valign="top"${GT}${leftImg}${LT}/td${GT}`,
    `${LT}td width="50%" align="center" valign="top"${GT}${rightImg}${LT}/td${GT}`,
    `${LT}/tr${GT}`,
    `${LT}/table${GT}`,
  ].join("\n");
}

// ------------------------------------------------------------------
// Coder (Row A + Row B: activity | waka)
// ------------------------------------------------------------------
async function renderCoder() {
  const [activity, waka] = await Promise.all([getActivity(), getWaka()]);
  const rowA = renderMetricsRow(
    "./assets/metrics-languages.svg", "Languages",
    "./assets/metrics-activity.svg",  "Activity"
  );
  const rowB = [
    `${LT}table${GT}`,
    `${LT}tr${GT}`,
    `${LT}td width="55%" valign="top"${GT}`,
    `${LT}b${GT}Recent activity${LT}/b${GT}${LT}br/${GT}${LT}br/${GT}`,
    activity,
    `${LT}/td${GT}`,
    `${LT}td width="45%" valign="top"${GT}`,
    `${LT}b${GT}Last 7 days on WakaTime${LT}/b${GT}${LT}br/${GT}${LT}br/${GT}`,
    waka,
    `${LT}/td${GT}`,
    `${LT}/tr${GT}`,
    `${LT}/table${GT}`,
  ].join("\n");
  return `${rowA}\n\n${rowB}`;
}

// ------------------------------------------------------------------
// Person (Row A + Row B: anime cover strip)
// ------------------------------------------------------------------
async function renderPerson() {
  const animeMd = await getAnimeStrip();
  const rowA = renderMetricsRow(
    "./assets/metrics-anilist.svg", "AniList",
    "./assets/metrics-social.svg",  "Stars and people"
  );
  const rowB = [
    `${LT}b${GT}Top anime, in order${LT}/b${GT}`,
    ``,
    animeMd,
  ].join("\n");
  return `${rowA}\n\n${rowB}`;
}

// ------------------------------------------------------------------
// Numbers (Row A only)
// ------------------------------------------------------------------
function renderNumbers() {
  return renderMetricsRow(
    "./assets/metrics-iso.svg",      "Contribution isocalendar",
    "./assets/metrics-followup.svg", "Follow-ups and calendar"
  );
}

// ------------------------------------------------------------------
// Anime covers — fixed width so 5 fit without scroll
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
      url: m.siteUrl,
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
    const label = `${LT}br/${GT}${LT}sub${GT}${LT}b${GT}${escText(a.name)}${LT}/b${GT}${LT}/sub${GT}`;
    if (!r) {
      return `${LT}td align="center" width="20%"${GT}${label}${LT}/td${GT}`;
    }
    const img = IMG(r.cover, a.name, `width="130"`);
    const clickable = A(r.url, img);
    return `${LT}td align="center" width="20%"${GT}${clickable}${label}${LT}/td${GT}`;
  });
  return `${LT}table${GT}\n${LT}tr${GT}\n${cells.join("\n")}\n${LT}/tr${GT}\n${LT}/table${GT}`;
}

// ------------------------------------------------------------------
// Recent activity — HTML list, links via <a>
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
    return `${LT}i${GT}No recent activity outside pinned projects.${LT}/i${GT}`;
  }

  const items = recent.map((r) => {
    const desc = r.description?.trim() || `${LT}i${GT}no description${LT}/i${GT}`;
    const descHtml = r.description?.trim() ? escText(desc) : desc;
    const lang = r.language
      ? ` ${LT}code${GT}${escText(r.language)}${LT}/code${GT}`
      : "";
    const link = A(r.html_url, `${LT}b${GT}${escText(r.name)}${LT}/b${GT}`);
    return [
      `${LT}li${GT}`,
      `${link}${lang}`,
      `${LT}br/${GT}${LT}sub${GT}${descHtml} · Pushed ${escText(fmtDate(r.pushed_at))}${LT}/sub${GT}`,
      `${LT}/li${GT}`,
    ].join("");
  });

  return `${LT}ul${GT}\n${items.join("\n")}\n${LT}/ul${GT}`;
}

// ------------------------------------------------------------------
// WakaTime — dense HTML card
// ------------------------------------------------------------------
async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return `${LT}i${GT}Connect a WakaTime account to populate this section.${LT}/i${GT}`;
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
    return `${LT}i${GT}WakaTime fetch failed.${LT}/i${GT}`;
  }
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const daily = data.human_readable_daily_average || fmtHM(data.daily_average || 0);
  const best  = data.best_day
    ? `${fmtShortDate(data.best_day.date)} · ${fmtHM(data.best_day.total_seconds)}`
    : null;

  const pill = (name, val) =>
    `${LT}code${GT}${escText(name)}${LT}/code${GT} ${LT}sub${GT}${escText(val)}${LT}/sub${GT}`;

  const langs = (data.languages || [])
    .slice(0, 6)
    .map((l) => pill(l.name, `${l.percent.toFixed(1)}%`))
    .join(" · ");

  const editors = (data.editors || [])
    .slice(0, 4)
    .map((e) => pill(e.name, `${e.percent.toFixed(0)}%`))
    .join(" · ");

  const projects = (data.projects || [])
    .slice(0, 4)
    .map((p) => pill(p.name, fmtHM(p.total_seconds)))
    .join(" · ");

  const br2 = `${LT}br/${GT}${LT}br/${GT}`;
  const section = (label, body) =>
    `${LT}b${GT}${label}${LT}/b${GT}${LT}br/${GT}${body}`;

  const parts = [];
  parts.push(`${LT}b${GT}Total coded:${LT}/b${GT} ${escText(total)}`);
  parts.push(
    `${LT}sub${GT}Daily avg · ${escText(daily)}` +
    (best ? ` &nbsp;·&nbsp; Best day · ${escText(best)}` : "") +
    `${LT}/sub${GT}`
  );
  if (langs)    parts.push(section("Languages", langs));
  if (editors)  parts.push(section("Editors",   editors));
  if (projects) parts.push(section("Projects",  projects));

  return parts.join(br2);
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [coderHtml, personHtml] = await Promise.all([
  renderCoder(),
  renderPerson(),
]);
const numbersHtml = renderNumbers();
const bannerHtml  = renderBanner();

const ts =
  new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "BANNER",    bannerHtml);
out = replaceBlock(out, "CODER",     coderHtml);
out = replaceBlock(out, "PERSON",    personHtml);
out = replaceBlock(out, "NUMBERS",   numbersHtml);
out = replaceBlock(out, "TIMESTAMP", ts);

// --- Content-hashed cache-bust for locally-generated SVGs ---
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