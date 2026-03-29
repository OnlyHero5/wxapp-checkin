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
});
