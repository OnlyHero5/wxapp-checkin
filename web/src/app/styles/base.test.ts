import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const baseCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "./base.css"),
  "utf8"
);

describe("base.css", () => {
  it("styles shared app shells through project-owned classes instead of TDesign internal selectors", () => {
    expect(baseCss).not.toMatch(/\.t-[a-z0-9_-]+/i);
  });
});
