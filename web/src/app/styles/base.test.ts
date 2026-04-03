import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readAppStyles() {
  return fs.readdirSync(import.meta.dirname)
    .filter((fileName) => fileName.endsWith(".css"))
    .sort()
    .map((fileName) => fs.readFileSync(path.resolve(import.meta.dirname, fileName), "utf8"))
    .join("\n");
}

const baseCss = readAppStyles();

describe("base.css", () => {
  it("keeps the app shell anchored on project-owned classes even when component-library selectors appear inside scoped regions", () => {
    expect(baseCss).toMatch(/\.mobile-page__bento-rail/);
    expect(baseCss).toMatch(/\.activity-meta-panel/);
    expect(baseCss).toMatch(/\.staff-manage-workbench/);
    expect(baseCss).toMatch(/\.profile-page__card/);
  });

  it("pins the business nav with project-owned shell rules instead of relying only on component-library fixed behavior", () => {
    expect(baseCss).toMatch(/\.app-business-shell\s*\{[^}]*padding-bottom:/);
    expect(baseCss).toMatch(/\.app-business-nav\s*\{[^}]*position:\s*fixed;/);
    expect(baseCss).toMatch(/\.app-business-nav__bar\s*\{[^}]*width:\s*min\(100%,/);
  });
});
