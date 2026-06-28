import fs from "node:fs/promises";
import { Octokit } from "@octokit/rest";

const USER = "SRUN-Sochettra";
const TEMPLATE = "README.template.md";
const OUTPUT = "README.md";

// Repos already curated in "Selected Projects" — skip them in the dynamic list
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

// --- Recent non-pinned repo activity ---
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

// --- WakaTime weekly stats ---
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

// --- AI-generated short "Now" line ---
async function getNow(activityMd) {
  if (!process.env.GROQ_API_KEY) {
    return "Shipping backend APIs, AI tools, and fintech workflows.";
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content:
            "Write ONE concise sentence (max 22 words) in first person describing what this developer is currently working on, based on their recent repo pushes. No emojis, no hype words, no marketing tone, no 'currently working on' opener. Plain, direct, peer-level.",
        },
        { role: "user", content: activityMd },
      ],
    }),
  });
  if (!res.ok) return "Shipping backend APIs, AI tools, and fintech workflows.";
  const j = await res.json();
  return (
    j.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") ||
    "Shipping backend APIs, AI tools, and fintech workflows."
  );
}

// --- AI-generated paragraph: "What I'm Building Right Now" ---
async function getBuilding(activityMd) {
  if (!process.env.GROQ_API_KEY) {
    return "_AI summary not configured. Set `GROQ_API_KEY` in repo secrets to enable this section._";
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Write 2-3 sentences in first person describing what this developer is actively building, based on their recent repos. Connect the threads — find the theme across projects. No emojis, no marketing tone, no hype words, no 'currently working on' or 'I am excited' openers. Direct, peer-level, like writing to another engineer.",
        },
        { role: "user", content: activityMd },
      ],
    }),
  });
  if (!res.ok) return "_AI summary unavailable._";
  const j = await res.json();
  return (
    j.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") ||
    "_No response from AI._"
  );
}

// --- Main ---
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

await fs.writeFile(OUTPUT, out);
console.log("README.md updated.");