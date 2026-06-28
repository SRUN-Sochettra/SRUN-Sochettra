import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

const PINNED = new Set([
  "EggScan",
  "Research-AI",
  "Khmer-Banking",
  "HyperspaceOS",
  "Spring-Boot---API-Blog",
  "RPI---RFID-Access-Control-System",
]);

const octo = new Octokit({ auth: process.env.GH_TOKEN });

function replaceBlock(md, key, content) {
  const re = new RegExp(`(<!--START:${key}-->)[\\s\\S]*?(<!--END:${key}-->)`);
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

async function getWaka() {
  if (!process.env.WAKATIME_API_KEY) {
    return "_Connect a WakaTime account to populate this section._";
  }
  const auth = Buffer.from(process.env.WAKATIME_API_KEY).toString("base64");
  const res = await fetch(
    "https://wakatime.com/api/v1/users/current/stats/last_7_days",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) return "_WakaTime fetch failed._";
  const { data } = await res.json();

  const total = data.human_readable_total || "0 hrs";
  const langs = (data.languages || [])
    .slice(0, 6)
    .map((l) => `\`${l.name} ${l.percent.toFixed(1)}%\``)
    .join(" · ");

  return `**Total coded:** ${total}\n\n${langs || "_No language data yet._"}`;
}

const tpl = await fs.readFile(TEMPLATE, "utf8");

const activity = await getActivity();
const waka = await getWaka();

const ts =
  new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 16) + " UTC";

let out = tpl;
out = replaceBlock(out, "ACTIVITY", activity);
out = replaceBlock(out, "WAKA", waka);
out = replaceBlock(out, "TIMESTAMP", ts);

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