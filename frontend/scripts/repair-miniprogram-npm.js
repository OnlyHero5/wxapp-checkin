"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const miniprogramNpmDir = path.join(projectRoot, "miniprogram_npm");
const tdesignSource = path.join(
  projectRoot,
  "node_modules",
  "tdesign-miniprogram",
  "miniprogram_dist"
);
const tdesignTarget = path.join(miniprogramNpmDir, "tdesign-miniprogram");

function fail(message) {
  console.error(`[repair:miniprogram-npm] ${message}`);
  process.exit(1);
}

function copyDirRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) {
    fail(`source is not a directory: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function normalizeJsonWithoutBom(filePath) {
  const raw = fs.readFileSync(filePath);
  const startsWithUtf8Bom =
    raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const content = startsWithUtf8Bom ? raw.slice(3).toString("utf8") : raw.toString("utf8");
  JSON.parse(content);
  fs.writeFileSync(filePath, content, "utf8");
}

function validateJsonFiles(dirPath) {
  const invalidFiles = [];
  let checkedCount = 0;

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.name.endsWith(".json")) {
        continue;
      }
      checkedCount += 1;
      try {
        JSON.parse(fs.readFileSync(absolutePath, "utf8"));
      } catch (error) {
        invalidFiles.push({ absolutePath, error: String(error) });
      }
    }
  }

  walk(dirPath);

  if (invalidFiles.length > 0) {
    const detail = invalidFiles
      .map((item) => `${item.absolutePath}\n  ${item.error}`)
      .join("\n");
    fail(`JSON validation failed for ${invalidFiles.length} file(s):\n${detail}`);
  }

  return checkedCount;
}

if (!fs.existsSync(tdesignSource)) {
  fail(`missing source package directory: ${tdesignSource}. Run "npm install" in frontend first.`);
}

fs.mkdirSync(miniprogramNpmDir, { recursive: true });
fs.rmSync(tdesignTarget, { recursive: true, force: true });
copyDirRecursive(tdesignSource, tdesignTarget);

const loadingJsonPath = path.join(tdesignTarget, "loading", "loading.json");
if (fs.existsSync(loadingJsonPath)) {
  normalizeJsonWithoutBom(loadingJsonPath);
}

const checkedCount = validateJsonFiles(tdesignTarget);
console.log(
  `[repair:miniprogram-npm] repaired ${path.relative(projectRoot, tdesignTarget)} and validated ${checkedCount} JSON files.`
);
