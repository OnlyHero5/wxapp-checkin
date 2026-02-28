"use strict";

const { execSync } = require("child_process");
const path = require("path");

const allowed = new Set(["touristappid"]);
const repoRoot = path.resolve(__dirname, "..", "..");
const configs = [
  { label: "repo-root project.config.json", repoPath: "project.config.json" },
  { label: "frontend project.config.json", repoPath: "frontend/project.config.json" },
];

const violations = [];

function readIndexFile(repoPath) {
  try {
    return execSync(`git show :${repoPath}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const details = error && error.stderr ? String(error.stderr) : String(error);
    throw new Error(`${repoPath}: failed to read staged content via Git index\n  ${details}`);
  }
}

for (const config of configs) {
  let json;
  try {
    json = JSON.parse(readIndexFile(config.repoPath));
  } catch (error) {
    violations.push(`${config.label}: ${String(error)}`);
    continue;
  }

  if (!allowed.has(json.appid)) {
    violations.push(`${config.label}: unexpected appid (${config.repoPath})\n  ${String(json.appid)}`);
  }
}

if (violations.length > 0) {
  console.error("[no-public-wechat-appid] appid must not be committed (checks staged Git index).");
  for (const violation of violations) {
    console.error(violation);
  }
  console.error("Use `touristappid` in tracked config files, and keep your real appid out of Git history.");
  process.exit(1);
}

console.log("[no-public-wechat-appid] PASS");
