import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

// Repos already curated in "Selected Projects" — skip in the dynamic list
const PINNED = new Set([
  "EggScan",
  "Research-AI",
  "Khmer-Banking",
  "HyperspaceOS",
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
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceBlock(md, key, content) {
  const re = new RegExp(`(<!--\\s*START:${key}\\s*-->)[\\s\\S]*?(<!--\\s*END:${key}\\s*-->)`);
  return md.replace(re, `$1\n${content}\n$2`);
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
      return `<td align="center" width="20%"><sub><b>${escAttr(a.name)}</b></sub></td>`;
    }
    return `<td align="center" width="20%"><a href="${escAttr(r.url)}"><img src="${escAttr(r.cover)}" width="140" alt="${escAttr(a.name)}"/></a><br/><sub><b>${escAttr(a.name)}</b></sub></td>`;
  });
  return `<table>\n  <tr>\n    ${cells.join("\n    ")}\n  </tr>\n</table>`;
}

// ------------------------------------------------------------------
// Repo activity (unchanged)
// ------------------------------------------------------------------
async function getActivity() {
  const { data } = await octo.repos.listForUser({
    username: USER,
    sort: "pushed",
    per_page: 20,
  });

  const recent = data
    .filter((r) => !r.fork && !PINNED.has(r.name))
    .slice(0, 5);

  if (recent.length === 0) return "_No recent activity outside pinned projects._";

  return recent
    .map((r) => {
      const desc = r.description?.trim() || "_no description_";
      const lang = r.language ? `\`${r.language}\`` : "";
      return `- **${r.html_url}** ${lang} — ${desc}  \n  <sub>Pushed ${fmtDate(r.pushed_at)}</sub>`;
    })
    .join("\n");
}

// ------------------------------------------------------------------
// WakaTime
// ------------------------------------------------------------------
async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return "_Connect a WakaTime account to populate this section._";
  }
  const auth = Buffer.from(process.env.WAKATIME_API_KEY).toString("base64");
  const res = await fetch(
    "https://wakatime.com/api/v1/users/current/stats/last_7_days",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    console.warn(`WakaTime ${res.status}: ${body}`);
    return "_WakaTime fetch failed._";
  }
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const langs = (data.languages || [])
    .slice(0, 6)
    .map((l) => `\`${l.name} ${l.percent.toFixed(1)}%\``)
    .join(" · ");

  return `**Total coded:** ${total}\n\n${langs || "_No language data yet._"}`;
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
  new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "ACTIVITY", activity);
out = replaceBlock(out, "WAKA", waka);
out = replaceBlock(out, "ANIME", animeTable);
out = replaceBlock(out, "TIMESTAMP", ts);

// --- Content-hashed cache-bust ---
const [darkHash, lightHash] = await Promise.all([
  hashFile("assets/banner-dark.svg"),
  hashFile("assets/banner-light.svg"),
]);

if (darkHash) {
  out = out.replace(
    /assets\/banner-dark\.svg(\?v=[a-z0-9]+)?/gi,
    `assets/banner-dark.svg?v=${darkHash}`
  );
}
if (lightHash) {
  out = out.replace(
    /assets\/banner-light\.svg(\?v=[a-z0-9]+)?/gi,
    `assets/banner-light.svg?v=${lightHash}`
  );
}

await fs.writeFile(OUTPUT, out);
console.log("README.md updated.");
console.log("banner cache keys:", { dark: darkHash, light: lightHash });
