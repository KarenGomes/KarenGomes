// generate-stats.js
// Busca os SVGs do github-readme-stats e salva localmente no repositório.
// Roda via GitHub Actions — nunca depende do serviço estar no ar no momento
// em que alguém visita seu perfil, pois os arquivos ficam salvos no repo.

import fetch from "node-fetch";
import { writeFileSync } from "fs";

const USERNAME = process.env.USERNAME || "KarenGomes";

// Parâmetros visuais — mesmas cores do seu README
const SHARED_PARAMS =
  "theme=tokyonight&hide_border=true&title_color=2c6975&icon_color=68b2a0&text_color=ffffff&bg_color=0d1117";

const STATS_URL = `https://github-readme-stats.vercel.app/api?username=${USERNAME}&show_icons=true&${SHARED_PARAMS}`;
const LANGS_URL  = `https://github-readme-stats.vercel.app/api/top-langs/?username=${USERNAME}&layout=compact&langs_count=8&${SHARED_PARAMS}`;

async function fetchSVG(url, filename) {
  console.log(`Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      // Token ajuda a evitar rate limit da API do GitHub usada internamente
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status} ${res.statusText}`);
  }

  const svg = await res.text();

  // Valida que realmente veio um SVG e não uma página de erro
  if (!svg.trim().startsWith("<svg")) {
    throw new Error(`Response for ${filename} does not look like an SVG:\n${svg.slice(0, 200)}`);
  }

  writeFileSync(filename, svg, "utf-8");
  console.log(`✅ Saved ${filename}`);
}

(async () => {
  try {
    await fetchSVG(STATS_URL, "stats.svg");
    await fetchSVG(LANGS_URL, "languages.svg");
    console.log("Done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();