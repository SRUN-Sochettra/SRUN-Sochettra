// scripts/update-readme.mjs
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

// Curated pins. Order = display order in the Selected work rail.
// Also used as a skip-list for the "Recent activity" section so pins
// don't double-appear.
const PINNED_ORDER = [
  "EggScan",
  "Research-AI",
  "HyperspaceOS",
  "Khmer-Banking",
  "Spring-Boot---API-Blog",
  "RPI---RFID-Access-Control-System",
];
const PINNED = new Set(PINNED_ORDER);

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

// Function replacer — prevents `$1`, `$&`, `$$` etc. in `content`
// from being interpreted as backreferences by String.prototype.replace.
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
// Selected work rail — pinned repos rendered as a 3×N table
// ------------------------------------------------------------------
async function getSelectedProjects() {
  const results = await Promise.all(
    PINNED_ORDER.map(async (name) => {
      try {
        const { data } = await octo.repos.get({ owner: USER, repo: name });
        return {
          name: data.name,
          url: data.html_url,
          desc: (data.description || "").trim(),
          lang: data.language || "",
        };
      } catch (err) {
        console.warn(`selected project ${name} unavailable:`, err.message);
        return null;
      }
    })
  );

  const projects = results.filter(Boolean);
  if (projects.length === 0) return "_No selected projects available._";

  // 3 cells per row; pad short rows with empty cells so the grid stays even.
  const rows = [];
  for (let i = 0; i < projects.length; i += 3) rows.push(projects.slice(i, i + 3));

  const rowHtml = rows
    .map((row) => {
      const cells = row.map((p) => {
        const desc = p.desc
          ? `<br/><sub>${escAttr(p.desc)}</sub>`
          : `<br/><sub><i>no description</i></sub>`;
        const lang = p.lang
          ? `<br/><sub><code>${escAttr(p.lang)}</code></sub>`
          : "";
        return `<td valign="top" width="33%"><a href="${escAttr(p.url)}"><b>${escAttr(p.name)}</b></a>${desc}${lang}</td>`;
      });
      while (cells.length < 3) cells.push(`<td width="33%"></td>`);
      return `  <tr>\n    ${cells.join("\n    ")}\n  </tr>`;
    })
    .join("\n");

  return `<table>\n${rowHtml}\n</table>`;
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
// Repo activity — non-pinned, most recent pushes
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

  if (recent.length === 0) return "_No recent activity outside pinned projects._";

  return recent
    .map((r) => {
      const desc = r.description?.trim() || "_no description_";
      const lang = r.language ? ` \`${r.language}\`` : "";
      return `- [**${r.name}**](${r.html_url})${lang} — ${desc}  \n  <sub>Pushed ${fmtDate(r.pushed_at)}</sub>`;
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

const [projects, activity, waka, animeTable] = await Promise.all([
  getSelectedProjects(),
  getActivity(),
  getWaka(),
  getFavoriteAnimeTable(),
]);

const ts =
  new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "PROJECTS", projects);
out = replaceBlock(out, "ACTIVITY", activity);
out = replaceBlock(out, "WAKA", waka);
out = replaceBlock(out, "ANIME", animeTable);
out = replaceBlock(out, "TIMESTAMP", ts);

// --- Content-hashed cache-bust for ALL locally-generated SVGs ---
const HASHED_SVGS = [
  "assets/banner-dark.svg",
  "assets/banner-light.svg",
  "assets/metrics-coder.svg",
  "assets/metrics-person.svg",
  "assets/metrics-data.svg",
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
console.log("selected projects:", PINNED_ORDER.length, "requested");
console.log(
  "cache keys:",
  Object.fromEntries(HASHED_SVGS.map((p, i) => [p, hashes[i]]))
);