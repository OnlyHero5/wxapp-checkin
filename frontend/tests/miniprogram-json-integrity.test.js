"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "miniprogram_npm");

if (!fs.existsSync(root)) {
  console.error(
    "[miniprogram-json-integrity] missing frontend/miniprogram_npm. Run `npm run repair:miniprogram-npm` and then rebuild npm in WeChat DevTools."
  );
  process.exit(1);
}

const invalid = [];
let checked = 0;

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const filePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!entry.name.endsWith(".json")) {
      continue;
    }
    checked += 1;
    try {
      JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      invalid.push({ filePath, error: String(error) });
    }
  }
}

walk(root);

if (invalid.length > 0) {
  console.error(`[miniprogram-json-integrity] invalid JSON files: ${invalid.length}`);
  for (const item of invalid) {
    console.error(`${item.filePath}\n  ${item.error}`);
  }
  process.exit(1);
}

console.log(`[miniprogram-json-integrity] validated ${checked} JSON files under miniprogram_npm.`);
