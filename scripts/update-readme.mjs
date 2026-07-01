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

// Angle-bracket constants — used only for HTML tags that get eaten by
// the chat renderer if written literally (picture, source).
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function replaceBlock(md, key, content) {
  const re = new RegExp(
    `(<!--\\s*START:${key}\\s*-->)[\\s\\S]*?(<!--\\s*END:${key}\\s*-->)`
  );
  return md.replace(re, (_m, start, end) => `${start}\n\n${content}\n\n${end}`);
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

// Escape parens in a URL so it works inside markdown url
function mdUrl(u) {
  return String(u).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

// ------------------------------------------------------------------
// Banner (light/dark picture element)
// ------------------------------------------------------------------
function renderBanner() {
  const dark  = "./assets/banner-dark.svg";
  const light = "./assets/banner-light.svg";
  return [
    `${LT}picture${GT}`,
    `  ${LT}source media="(prefers-color-scheme: dark)" srcset="${dark}" /${GT}`,
    `  ${LT}source media="(prefers-color-scheme: light)" srcset="${light}" /${GT}`,
    `  ${LT}img src="${dark}" alt="Srun Sochettra" width="100%" /${GT}`,
    `${LT}/picture${GT}`,
  ].join("\n");
}

// ------------------------------------------------------------------
// Dropdown sections (2-col metrics + optional Row B)
// ------------------------------------------------------------------
function renderMetricsRow(leftPath, leftAlt, rightPath, rightAlt) {
  return [
    `<table>`,
    `<tr>`,
    `<td width="50%" align="center" valign="top">`,
    ``,
    `${mdUrl(leftPath)}`,
    ``,
    `</td>`,
    `<td width="50%" align="center" valign="top">`,
    ``,
    `${mdUrl(rightPath)}`,
    ``,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("\n");
}

function renderCoder(activityMd, wakaMd) {
  const rowA = renderMetricsRow(
    "./assets/metrics-languages.svg", "Languages",
    "./assets/metrics-activity.svg",  "Activity"
  );
  const rowB = [
    `<table>`,
    `<tr>`,
    `<td width="55%" valign="top">`,
    ``,
    `**Recent activity**`,
    ``,
    activityMd,
    ``,
    `</td>`,
    `<td width="45%" valign="top">`,
    ``,
    `**Last 7 days on WakaTime**`,
    ``,
    wakaMd,
    ``,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("\n");
  return `${rowA}\n\n${rowB}`;
}

function renderPerson(animeMd) {
  const rowA = renderMetricsRow(
    "./assets/metrics-anilist.svg", "AniList",
    "./assets/metrics-social.svg",  "Stars and people"
  );
  const rowB = `**Top anime, in order**\n\n${animeMd}`;
  return `${rowA}\n\n${rowB}`;
}

function renderNumbers() {
  return renderMetricsRow(
    "./assets/metrics-iso.svg",      "Contribution isocalendar",
    "./assets/metrics-followup.svg", "Follow-ups and calendar"
  );
}

// ------------------------------------------------------------------
// Anime covers — clickable images via nested markdown
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

async function getAnimeSection() {
  const results = await Promise.all(ANIME_LIST.map((a) => getAnimeCover(a.search)));

  const cells = ANIME_LIST.map((a, i) => {
    const r = results[i];
    const label = `<sub><b>${a.name}</b></sub>`;
    if (!r) {
      return `<td align="center" width="20%">${label}</td>`;
    }
    // Nested markdown: clickable image without typing <img> or <a>
    const clickableImg = `${mdUrl(r.cover)}](${mdUrl(r.url)})`;
    return [
      `<td align="center" width="20%">`,
      ``,
      clickableImg,
      ``,
      label,
      `</td>`,
    ].join("\n");
  });

  return `<table>\n<tr>\n${cells.join("\n")}\n</tr>\n</table>`;
}

// ------------------------------------------------------------------
// Recent activity — pure markdown list
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

  if (recent.length === 0) return `_No recent activity outside pinned projects._`;

  return recent.map((r) => {
    const desc = r.description?.trim() || "_no description_";
    const lang = r.language ? ` \`${r.language}\`` : "";
    return `- **${mdUrl(r.html_url)}**${lang}  \n  <sub>${desc} · Pushed ${fmtDate(r.pushed_at)}</sub>`;
  }).join("\n");
}

// ------------------------------------------------------------------
// WakaTime — dense markdown card
// ------------------------------------------------------------------
async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return `_Connect a WakaTime account to populate this section._`;
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
    return `_WakaTime fetch failed._`;
  }
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const daily = data.human_readable_daily_average || fmtHM(data.daily_average || 0);
  const best  = data.best_day
    ? `${fmtShortDate(data.best_day.date)} · ${fmtHM(data.best_day.total_seconds)}`
    : null;

  const langs = (data.languages || [])
    .slice(0, 6)
    .map((l) => `\`${l.name}\` <sub>${l.percent.toFixed(1)}%</sub>`)
    .join(" · ");

  const editors = (data.editors || [])
    .slice(0, 4)
    .map((e) => `\`${e.name}\` <sub>${e.percent.toFixed(0)}%</sub>`)
    .join(" · ");

  const projects = (data.projects || [])
    .slice(0, 4)
    .map((p) => `\`${p.name}\` <sub>${fmtHM(p.total_seconds)}</sub>`)
    .join(" · ");

  const lines = [];
  lines.push(`**Total coded:** ${total}`);
  lines.push(`<sub>Daily avg · ${daily}${best ? ` &nbsp;·&nbsp; Best day · ${best}` : ""}</sub>`);
  if (langs)    lines.push(`**Languages**  \n${langs}`);
  if (editors)  lines.push(`**Editors**  \n${editors}`);
  if (projects) lines.push(`**Projects**  \n${projects}`);

  return lines.join("\n\n");
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [activity, waka, animeMd] = await Promise.all([
  getActivity(),
  getWaka(),
  getAnimeSection(),
]);

const ts =
  new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "BANNER",    renderBanner());
out = replaceBlock(out, "CODER",     renderCoder(activity, waka));
out = replaceBlock(out, "PERSON",    renderPerson(animeMd));
out = replaceBlock(out, "NUMBERS",   renderNumbers());
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