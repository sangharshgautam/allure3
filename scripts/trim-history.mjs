#!/usr/bin/env node
"use strict";

import fs from "node:fs";

const file = process.argv[2];
const keep = Math.max(1, parseInt(process.argv[3], 10) || 30);

if (!file) {
  console.error("Usage: trim-history.mjs <history.jsonl> [keep]");
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`History file not found: ${file}`);
  process.exit(1);
}

const lines = fs
  .readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

const trimmed = lines.slice(-keep);
fs.writeFileSync(file, trimmed.length ? trimmed.join("\n") + "\n" : "");

console.log(`history.jsonl: kept ${trimmed.length}/${lines.length} runs`);
