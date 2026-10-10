#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const siteDir = process.argv[2] || "site";
const dataDir = path.join(siteDir, "data");

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function num(...candidates) {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function extractCounts(summary) {
  if (!summary) return null;
  const stat = summary.statistic ?? summary.stats ?? summary;
  return {
    passed: num(stat.passed, summary.passed),
    failed: num(stat.failed, summary.failed),
    broken: num(stat.broken, summary.broken),
    skipped: num(stat.skipped, summary.skipped),
    unknown: num(stat.unknown, summary.unknown),
    total: num(stat.total, summary.total),
    durationMs: num(summary.time?.duration, summary.duration, stat.duration),
  };
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

function formatAge(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(counts) {
  if (!counts) return `<span class="badge unknown">unknown</span>`;
  if (counts.failed + counts.broken > 0)
    return `<span class="badge fail">fail</span>`;
  if (counts.total > 0) return `<span class="badge pass">pass</span>`;
  return `<span class="badge unknown">unknown</span>`;
}

const projects = fs.existsSync(dataDir)
  ? fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  : [];

const rows = projects.map((project) => {
  const meta =
    readJson(path.join(dataDir, project, "meta.json")) ?? { project };
  const summary = readJson(
    path.join(siteDir, project, "latest", "summary.json"),
  );
  const counts = extractCounts(summary);
  const c = counts ?? {};
  return `<tr>
      <td><a href="${esc(project)}/latest/">${esc(project)}</a></td>
      <td>${statusBadge(counts)}</td>
      <td class="num">${c.passed ?? "—"}</td>
      <td class="num">${c.failed ?? "—"}</td>
      <td class="num">${c.broken ?? "—"}</td>
      <td class="num">${c.skipped ?? "—"}</td>
      <td class="num">${c.total ?? "—"}</td>
      <td>${esc(formatDuration(c.durationMs))}</td>
      <td class="num">${meta.buildNumber != null ? "#" + esc(meta.buildNumber) : "—"}</td>
      <td>${esc(formatAge(meta.timestamp))}</td>
      <td>${meta.runUrl ? `<a href="${esc(meta.runUrl)}">CI run ↗</a>` : "—"}</td>
    </tr>`;
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>Allure Test Reports</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem auto; max-width: 70rem; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
  th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid rgba(128,128,128,.35); }
  th { font-weight: 600; white-space: nowrap; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  a { color: inherit; }
  .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.8rem; color: #fff; }
  .badge.pass { background: #2da44e; }
  .badge.fail { background: #cf222e; }
  .badge.unknown { background: #6e7781; }
  footer { margin-top: 1.5rem; font-size: 0.8rem; opacity: 0.7; }
</style>
</head>
<body>
<h1>Allure Test Reports</h1>
${
  rows.length === 0
    ? "<p>No projects published yet.</p>"
    : `<table>
  <thead><tr>
    <th>Project</th><th>Status</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Broken</th><th class="num">Skipped</th><th class="num">Total</th><th>Duration</th><th class="num">Build</th><th>Last run</th><th>Source</th>
  </tr></thead>
  <tbody>
${rows.join("\n")}
  </tbody>
</table>`
}
<footer>Generated ${new Date().toISOString()} · Allure Report 3 · data refreshes on each publish</footer>
</body>
</html>
`;

fs.writeFileSync(path.join(siteDir, "index.html"), html);
console.log(`Dashboard written (${projects.length} project${projects.length === 1 ? "" : "s"})`);
