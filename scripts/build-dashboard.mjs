#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const siteDir = process.argv[2] || "site";
const dataDir = path.join(siteDir, "data");

const STATUSES = ["passed", "failed", "broken", "skipped", "unknown"];
const STATUS_COLORS = {
  passed: "#22c55e",
  failed: "#ef4444",
  broken: "#f59e0b",
  skipped: "#a1a1aa",
  unknown: "#71717a",
};

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

function extractStats(summary) {
  if (!summary) return null;
  const stat = summary.statistic ?? summary.stats ?? summary;
  return {
    passed: num(stat.passed, summary.passed),
    failed: num(stat.failed, summary.failed),
    broken: num(stat.broken, summary.broken),
    skipped: num(stat.skipped, summary.skipped),
    unknown: num(stat.unknown, summary.unknown),
    total: num(stat.total, summary.total),
  };
}

function worstStatus(summary, stats) {
  if (summary?.status) return summary.status;
  if (!stats) return "unknown";
  if (stats.failed > 0) return "failed";
  if (stats.broken > 0) return "broken";
  if (stats.total > 0) return "passed";
  return "unknown";
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

function donut(stats) {
  const total = stats?.total ?? 0;
  if (!total) {
    return {
      pct: "—",
      gradient: "var(--track)",
    };
  }
  const passed = stats.passed ?? 0;
  let acc = 0;
  const stops = [];
  for (const status of STATUSES) {
    const count = stats[status] ?? 0;
    if (count <= 0) continue;
    const from = (acc / total) * 100;
    acc += count;
    const to = (acc / total) * 100;
    stops.push(`${STATUS_COLORS[status]} ${from.toFixed(2)}% ${to.toFixed(2)}%`);
  }
  return {
    pct: `${Math.round((passed / total) * 100)}%`,
    gradient: stops.length ? `conic-gradient(from -90deg, ${stops.join(", ")})` : "var(--track)",
  };
}

function icon(name) {
  const icons = {
    new: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 1.5l1.55 4.02L13.6 7l-3.1 1.48L8 12.5 6.45 8.48 3.4 7l3.05-1.48z"/></svg>`,
    flaky: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 6.5a4 4 0 108 0 4 4 0 00-8 0zM8.6 2.2l1-1.2M9.9 2.6l.8-1M6.5 2.9L6.2 1.7" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
    retry: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9 1L2.5 9.5H7L6 15l6.5-8.5H8z"/></svg>`,
  };
  return icons[name] ?? "";
}

function metaItem(name, count, tooltip) {
  return `<span class="meta-item" title="${esc(tooltip)}">${icon(name)}<span>${count > 0 ? Math.min(count, 999) : "-"}</span></span>`;
}

function statItem(status, count) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const color = STATUS_COLORS[status] ?? "var(--text-muted)";
  return `<span class="stat"><span class="stat-count" style="color:${color}">${count}</span><span class="stat-label">${label}</span></span>`;
}

const projects = fs.existsSync(dataDir)
  ? fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  : [];

const cards = projects
  .map((project) => {
    const meta = readJson(path.join(dataDir, project, "meta.json")) ?? {};
    const summary = readJson(
      path.join(siteDir, project, "latest", "summary.json"),
    );
    const stats = extractStats(summary);
    const status = worstStatus(summary, stats);
    const createdAt = num(summary?.createdAt, meta.timestamp);
    const duration = num(summary?.duration);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const { pct, gradient } = donut(stats);
    const source = meta.sourceRepo || meta.project || project;
    const statsRow = stats
      ? [
          `<span class="stat"><span class="stat-count">${stats.total}</span><span class="stat-label">Total</span></span>`,
          ...STATUSES.filter((s) => (stats[s] ?? 0) > 0).map((s) =>
            statItem(s, stats[s]),
          ),
        ].join("")
      : "";

    return {
      createdAt,
      html: `<article class="card">
      <div class="row">
        <div class="content">
          <div class="header">
            <code class="source">${esc(source)}</code>
            <h2 class="title"><a class="card-link" href="${esc(project)}/latest/">${esc(project)}</a></h2>
            ${createdAt ? `<time class="created" datetime="${new Date(createdAt).toISOString()}">${esc(formatDate(createdAt))}</time>` : ""}
            <p class="status-line">
              <span class="status status-${esc(status)}">${esc(statusLabel)}</span>
              <span class="in">in <b>${esc(formatDuration(duration))}</b></span>
            </p>
          </div>
          <div class="meta">
            ${metaItem("new", summary?.newTests?.length ?? 0, `${summary?.newTests?.length ?? 0} new tests`)}
            ${metaItem("flaky", summary?.flakyTests?.length ?? 0, `${summary?.flakyTests?.length ?? 0} flaky tests`)}
            ${metaItem("retry", summary?.retryTests?.length ?? 0, `${summary?.retryTests?.length ?? 0} retry tests`)}
          </div>
        </div>
        <div class="pie">
          <div class="donut" style="background:${gradient}"><span>${pct}</span></div>
        </div>
      </div>
      <div class="stats">${statsRow}</div>
      <div class="card-footer">
        <span>${meta.buildNumber != null ? "Build #" + esc(meta.buildNumber) : ""}</span>
        ${meta.runUrl ? `<a class="ci" href="${esc(meta.runUrl)}" target="_blank" rel="noreferrer">CI run ↗</a>` : ""}
      </div>
    </article>`,
    };
  })
  .sort((a, b) => b.createdAt - a.createdAt);

const body = cards.length
  ? `<div class="showcase">\n${cards.map((c) => c.html).join("\n")}\n</div>`
  : `<div class="empty"><p>No projects published yet.</p></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>Allure Test Reports</title>
<style>
  :root {
    color-scheme: light dark;
    --page-bg: #f6f7f9;
    --card-bg: #ffffff;
    --border: #e6e7eb;
    --text: #16181d;
    --text-secondary: #6b7280;
    --text-muted: #9aa0aa;
    --track: #e6e7eb;
    --shadow-small: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1);
    --shadow-raised: 0 4px 12px rgba(16,24,40,.14);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page-bg: #0f1012;
      --card-bg: #1b1c20;
      --border: #2b2d33;
      --text: #f2f3f5;
      --text-secondary: #a1a7b0;
      --text-muted: #7a808a;
      --track: #2b2d33;
      --shadow-small: 0 1px 2px rgba(0,0,0,.4);
      --shadow-raised: 0 6px 18px rgba(0,0,0,.5);
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page-bg); color: var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .container { max-width: 940px; margin: 0 auto; padding: 16px 16px 40px; min-height: 100vh;
    display: flex; flex-direction: column; gap: 16px; }
  header.page { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
  .mark { width: 32px; height: 32px; flex: 0 0 auto; }
  header.page h1 { font-size: 1.15rem; margin: 0; }
  header.page .sub { color: var(--text-secondary); font-size: .82rem; margin-top: 2px; }
  .showcase { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: 8px; margin-bottom: 24px; }
  .card { position: relative; display: flex; flex-direction: column; justify-content: space-between;
    gap: 16px; min-height: 200px; padding: 16px; background: var(--card-bg);
    border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-small);
    transition: box-shadow .2s ease-out, transform .2s ease-in, border-color .2s ease-out; }
  .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-raised); }
  .card-link { color: var(--text); text-decoration: none; }
  .card-link::after { content: ""; position: absolute; inset: 0; z-index: 0; }
  .row { display: flex; flex-direction: row; justify-content: space-between; flex-grow: 1; }
  .content { display: flex; flex-direction: column; justify-content: space-between; gap: 16px;
    padding-right: 16px; min-width: 0; }
  .header { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .source { color: var(--text-muted); font-size: .72rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font-size: 1rem; margin: 3px 0 0; word-break: break-word; }
  .created { color: var(--text-secondary); font-size: .78rem; }
  .status-line { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--text-secondary); font-size: .82rem; }
  .status { display: inline-block; padding: .08rem .5rem; border-radius: 999px; font-size: .72rem;
    font-weight: 600; color: #fff; }
  .status-passed { background: ${STATUS_COLORS.passed}; }
  .status-failed { background: ${STATUS_COLORS.failed}; }
  .status-broken { background: ${STATUS_COLORS.broken}; }
  .status-skipped { background: ${STATUS_COLORS.skipped}; }
  .status-unknown { background: ${STATUS_COLORS.unknown}; }
  .meta { display: flex; align-items: center; gap: 16px; color: var(--text-secondary); font-size: .8rem; margin-top: auto; }
  .meta-item { display: inline-flex; align-items: center; gap: 4px; }
  .meta-item svg { color: var(--text-muted); }
  .pie { flex-shrink: 0; width: 90px; padding-top: 8px; }
  .donut { position: relative; width: 90px; height: 90px; border-radius: 50%;
    display: grid; place-items: center; }
  .donut::before { content: ""; position: absolute; inset: 12px; border-radius: 50%; background: var(--card-bg); }
  .donut span { position: relative; font-size: .95rem; font-weight: 600; }
  .stats { display: flex; flex-wrap: wrap; align-items: center; column-gap: 16px; row-gap: 8px;
    margin-top: auto; font-size: .82rem; }
  .stat { display: inline-flex; align-items: baseline; gap: 4px; }
  .stat-count { font-weight: 600; font-variant-numeric: tabular-nums; }
  .stat-label { color: var(--text-secondary); }
  .card-footer { display: flex; align-items: center; justify-content: space-between;
    padding-top: 10px; border-top: 1px solid var(--border); font-size: .76rem; color: var(--text-secondary); }
  .ci { position: relative; z-index: 1; color: inherit; }
  .amark-dot { transform-box: fill-box; }
  .empty { padding: 3rem 0; text-align: center; color: var(--text-secondary); }
  footer.page { margin-top: auto; font-size: .78rem; color: var(--text-muted); text-align: center; }
</style>
</head>
<body>
<div class="container">
  <header class="page">
    <svg class="mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle class="amark-dot" cx="24" cy="8" r="4" fill="${STATUS_COLORS.passed}"/>
      <circle class="amark-dot" cx="8" cy="8" r="4" fill="${STATUS_COLORS.failed}"/>
      <circle class="amark-dot" cx="8" cy="24" r="4" fill="${STATUS_COLORS.broken}"/>
      <circle class="amark-dot" cx="24" cy="24" r="4" fill="#8b5cf6"/>
    </svg>
    <div>
      <h1>Test Reports</h1>
      <div class="sub">Allure Report 3 · ${projects.length} project${projects.length === 1 ? "" : "s"}</div>
    </div>
  </header>
  ${body}
  <footer class="page">Updated ${new Date().toISOString()} · refreshes automatically on each publish</footer>
</div>
</body>
</html>
`;

fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "index.html"), html);
console.log(
  `Dashboard written (${projects.length} project${projects.length === 1 ? "" : "s"})`,
);
