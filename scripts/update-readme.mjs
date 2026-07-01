// scripts/update-readme.mjs
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

// Skip-list so pinned repos don't double-appear under Recent activity
const PINNED = new Set([
  "EggScan",
  "Research-AI",
  "HyperspaceOS",
  "Khmer-Banking",
  "Spring-Boot---API-Blog",
  "RPI---RFID-Access-Control-System",
]);

// Top 5 anime — display name + AniList search term
const ANIME_LIST = [
  { name: "SNAFU",             search: "Yahari Ore no Seishun Love Comedy wa Machigatteiru" },
  { name: "Bunny Girl Senpai", search: "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai" },
  { name: "Saiki K.",          search: "Saiki Kusuo no Psi-nan" },
  { name: "Attack on Titan",   search: "Shingeki no Kyojin" },
  { name: "Rewrite",           search: "Rewrite" },
];

const octo = new Octokit({ auth: process.env.GH_TOKEN });

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Function replacer — prevents `$1`, `$&`, `$$` in content from being
// interpreted as backreferences by String.prototype.replace.
// Blank lines around the injected content so markdown inside <td>
// still renders correctly on GitHub.
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
// Anime covers (AniList)
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

async function getFavoriteAnimeTable() {
  const results = await Promise.all(ANIME_LIST.map((a) => getAnimeCover(a.search)));
  const cells = ANIME_LIST.map((a, i) => {
    const r = results[i];
    if (!r) {
      return `<td align="center" width="20%"><sub><b>${escHtml(a.name)}</b></sub></td>`;
    }
    const inner =
      `<a href="${escHtml(r.url)}">` +
      `<img src="${escHtml(r.cover)}" width="140" alt="${escHtml(a.name)}"/>` +
      `</a><br/><sub><b>${escHtml(a.name)}</b></sub>`;
    return `<td align="center" width="20%">${inner}</td>`;
  });
  return `<table>\n  <tr>\n    ${cells.join("\n    ")}\n  </tr>\n</table>`;
}

// ------------------------------------------------------------------
// Recent activity — HTML list (renders reliably inside <td>)
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

  if (recent.length === 0) return `<i>No recent activity outside pinned projects.</i>`;

  const items = recent.map((r) => {
    const desc = r.description?.trim() || "<i>no description</i>";
    const lang = r.language ? ` <code>${escHtml(r.language)}</code>` : "";
    return (
      `<li>` +
        `<a href="${escHtml(r.html_url)}"><b>${escHtml(r.name)}</b></a>${lang}` +
        `<br/><sub>${escHtml(desc)} · Pushed ${escHtml(fmtDate(r.pushed_at))}</sub>` +
      `</li>`
    );
  });

  return `<ul>\n  ${items.join("\n  ")}\n</ul>`;
}

// ------------------------------------------------------------------
// WakaTime — HTML (renders reliably inside <td>)
// ------------------------------------------------------------------
async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return `<i>Connect a WakaTime account to populate this section.</i>`;
  }
  // HTTP Basic auth spec = base64(user:pass). WakaTime expects base64(key:).
  const auth = Buffer.from(`${process.env.WAKATIME_API_KEY}:`).toString("base64");
  const res = await fetch(
    "https://wakatime.com/api/v1/users/current/stats/last_7_days",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    console.warn(`WakaTime ${res.status}: ${body}`);
    return `<i>WakaTime fetch failed.</i>`;
  }
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const langs = (data.languages || [])
    .slice(0, 6)
    .map((l) => `<code>${escHtml(l.name)} ${l.percent.toFixed(1)}%</code>`)
    .join(" · ");

  const langLine = langs || `<i>No language data yet.</i>`;
  return `<b>Total coded:</b> ${escHtml(total)}<br/><br/>${langLine}`;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const tpl = await fs.readFile(TEMPLATE, "utf8");

const [activity, waka, animeTable] = await Promise.all([
  getActivity(),
  getWaka(),
  getFavoriteAnimeTable(),
]);

const ts =
  new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "ACTIVITY", activity);
out = replaceBlock(out, "WAKA", waka);
out = replaceBlock(out, "ANIME", animeTable);
out = replaceBlock(out, "TIMESTAMP", ts);

// --- Content-hashed cache-bust for locally-generated SVGs ---
const HASHED_SVGS = [
  "assets/banner-dark.svg",
  "assets/banner-light.svg",
  "assets/metrics-coder.svg",
  "assets/metrics-person.svg",
  "assets/metrics-iso.svg",
  "assets/metrics-followup.svg",
  "assets/metrics-achievements.svg",
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