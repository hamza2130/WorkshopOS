// Renders docs/diagrams/*.mmd to PNG next to each source, using an installed Chrome or Edge.
// Usage: npm run docs:diagrams            (all)
//        npm run docs:diagrams -- job-status-machine   (one or more by name)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const browser = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!browser) {
  console.error("No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH to a Chromium-based browser.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "mmdc-"));
const puppeteerConfig = join(tmp, "puppeteer.json");
const mermaidConfig = join(tmp, "mermaid.json");
writeFileSync(puppeteerConfig, JSON.stringify({ executablePath: browser, args: ["--no-sandbox"] }));
writeFileSync(
  mermaidConfig,
  JSON.stringify({
    theme: "base",
    themeVariables: {
      fontFamily: "Segoe UI, Helvetica, Arial, sans-serif",
      fontSize: "15px",
      primaryColor: "#eef4fb",
      primaryBorderColor: "#1f5fa8",
      primaryTextColor: "#17324f",
      secondaryColor: "#f6f7f9",
      tertiaryColor: "#ffffff",
      lineColor: "#5b6b7d",
      clusterBkg: "#fbfcfd",
      clusterBorder: "#c9d3de",
    },
    flowchart: { curve: "basis", padding: 16, wrappingWidth: 260 },
    sequence: { wrap: true, width: 180, messageFontSize: 14, noteFontSize: 13, actorFontSize: 14 },
    er: { fontSize: 13 },
  }),
);

const dir = "docs/diagrams";
const only = process.argv.slice(2);
const sources = readdirSync(dir)
  .filter((f) => f.endsWith(".mmd"))
  .filter((f) => only.length === 0 || only.includes(basename(f, ".mmd")));

const cli = join("node_modules", "@mermaid-js", "mermaid-cli", "src", "cli.js");
for (const file of sources) {
  const input = join(dir, file);
  const output = join(dir, file.replace(/\.mmd$/, ".png"));
  execFileSync(
    process.execPath,
    [cli, "-i", input, "-o", output, "-p", puppeteerConfig, "-c", mermaidConfig, "-b", "white", "-s", "2", "-q"],
    { stdio: "inherit" },
  );
  console.log(`rendered ${output}`);
}
