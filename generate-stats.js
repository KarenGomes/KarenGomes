// generate-stats.js
// Gera os SVGs de estatísticas diretamente da API GraphQL do GitHub.
// Zero dependência de serviços de terceiros (github-readme-stats, etc.)

import { writeFileSync } from "fs";

const USERNAME  = process.env.USERNAME  || "KarenGomes";
const GH_TOKEN  = process.env.GITHUB_TOKEN;

if (!GH_TOKEN) {
  console.error("❌ GITHUB_TOKEN não definido.");
  process.exit(1);
}

// ─── GitHub GraphQL query ──────────────────────────────────────────────────

async function ghQuery(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent":   "readme-stats-generator",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// ─── Fetch user stats ──────────────────────────────────────────────────────

async function fetchStats() {
  const data = await ghQuery(`
    query($login: String!) {
      user(login: $login) {
        name
        repositories(
          ownerAffiliations: OWNER
          isFork: false
          first: 100
          privacy: PUBLIC
        ) {
          nodes {
            stargazerCount
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name color } }
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
        }
        followers { totalCount }
      }
    }
  `, { login: USERNAME });

  const user  = data.user;
  const repos = user.repositories.nodes;
  const cc    = user.contributionsCollection;

  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);

  // Aggregate language bytes
  const langMap = {};
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      langMap[name] = (langMap[name] || { bytes: 0, color: edge.node.color });
      langMap[name].bytes += edge.size;
    }
  }

  const totalBytes = Object.values(langMap).reduce((s, l) => s + l.bytes, 0);

  const languages = Object.entries(langMap)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 8)
    .map(([name, { bytes, color }]) => ({
      name,
      color: color || "#858585",
      percent: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
    }));

  return {
    name:      user.name || USERNAME,
    commits:   cc.totalCommitContributions,
    prs:       cc.totalPullRequestContributions,
    issues:    cc.totalIssueContributions,
    reviews:   cc.totalPullRequestReviewContributions,
    stars:     totalStars,
    followers: user.followers.totalCount,
    languages,
  };
}

// ─── SVG: Stats card ──────────────────────────────────────────────────────

function buildStatsCard(s) {
  const bg    = "#0d1117";
  const title = "#2c6975";
  const icon  = "#68b2a0";
  const text  = "#c9d1d9";
  const sub   = "#8b949e";
  const border = "#21262d";

  const rows = [
    { icon: "★", label: "Total Stars Earned",    value: s.stars },
    { icon: "⬆", label: "Total Commits (2024–25)", value: s.commits },
    { icon: "↗", label: "Total PRs",              value: s.prs },
    { icon: "◎", label: "Total Issues",            value: s.issues },
    { icon: "♺", label: "PR Reviews",              value: s.reviews },
    { icon: "◉", label: "Followers",               value: s.followers },
  ];

  const rowH  = 28;
  const startY = 78;
  const W = 380, H = startY + rows.length * rowH + 20;

  const rowsSVG = rows.map((r, i) => {
    const y = startY + i * rowH;
    return `
    <g transform="translate(0,${y})">
      <text x="22" y="13" font-size="14" fill="${icon}" font-family="sans-serif">${r.icon}</text>
      <text x="42" y="13" font-size="13" fill="${text}" font-family="sans-serif">${r.label}</text>
      <text x="${W - 20}" y="13" font-size="13" fill="${title}" font-family="sans-serif" text-anchor="end" font-weight="bold">${r.value.toLocaleString()}</text>
    </g>`;
  }).join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" rx="12" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <g transform="translate(18,24)">
    <text x="0" y="0" font-size="15" font-weight="bold" fill="${title}" font-family="sans-serif">
      📊 ${escXml(s.name)}'s GitHub Stats
    </text>
  </g>
  <line x1="18" y1="42" x2="${W - 18}" y2="42" stroke="${border}" stroke-width="1"/>
  ${rowsSVG}
</svg>`;
}

// ─── SVG: Languages card ──────────────────────────────────────────────────

function buildLangsCard(languages) {
  const bg    = "#0d1117";
  const title = "#2c6975";
  const text  = "#c9d1d9";
  const sub   = "#8b949e";
  const border = "#21262d";

  const W = 380;
  const barY = 62, barH = 10, barW = W - 36;
  const legendRowH = 24;
  const legendStart = barY + barH + 20;
  const H = legendStart + Math.ceil(languages.length / 2) * legendRowH + 18;

  // Colour bar segments
  let barX = 18;
  const segments = languages.map(l => {
    const w = (l.percent / 100) * barW;
    const seg = `<rect x="${barX.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" rx="0" fill="${l.color}"/>`;
    barX += w;
    return seg;
  });

  // Legend items (2 columns)
  const legend = languages.map((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 18 : W / 2 + 6;
    const y = legendStart + row * legendRowH;
    return `
    <circle cx="${x + 6}" cy="${y + 9}" r="6" fill="${l.color}"/>
    <text x="${x + 18}" y="${y + 13}" font-size="12" fill="${text}" font-family="sans-serif">${escXml(l.name)}</text>
    <text x="${col === 0 ? W/2 - 6 : W - 18}" y="${y + 13}" font-size="12" fill="${sub}" font-family="sans-serif" text-anchor="end">${l.percent.toFixed(1)}%</text>`;
  }).join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" rx="12" fill="${bg}" stroke="${border}" stroke-width="1"/>
  <g transform="translate(18,24)">
    <text x="0" y="0" font-size="15" font-weight="bold" fill="${title}" font-family="sans-serif">
      💻 Most Used Languages
    </text>
  </g>
  <line x1="18" y1="42" x2="${W - 18}" y2="42" stroke="${border}" stroke-width="1"/>
  <!-- bar -->
  <rect x="18" y="${barY}" width="${barW}" height="${barH}" rx="5" fill="#21262d"/>
  <clipPath id="bar-clip">
    <rect x="18" y="${barY}" width="${barW}" height="${barH}" rx="5"/>
  </clipPath>
  <g clip-path="url(#bar-clip)">${segments.join("")}</g>
  <!-- legend -->
  ${legend}
</svg>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Main ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`🔍 Fetching stats for ${USERNAME} via GitHub GraphQL API…`);
    const stats = await fetchStats();
    console.log(`  ✔ Stars: ${stats.stars} | Commits: ${stats.commits} | PRs: ${stats.prs}`);
    console.log(`  ✔ Languages: ${stats.languages.map(l => l.name).join(", ")}`);

    const statsSVG = buildStatsCard(stats);
    const langsSVG = buildLangsCard(stats.languages);

    writeFileSync("stats.svg", statsSVG, "utf-8");
    console.log("✅ Saved stats.svg");

    writeFileSync("languages.svg", langsSVG, "utf-8");
    console.log("✅ Saved languages.svg");

    console.log("Done! 🎉");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();