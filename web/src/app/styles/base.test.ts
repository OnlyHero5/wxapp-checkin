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
  it("styles shared app shells through project-owned classes instead of TDesign internal selectors", () => {
    expect(baseCss).not.toMatch(/\.t-[a-z0-9_-]+/i);
  });
});
