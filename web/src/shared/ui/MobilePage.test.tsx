import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

function readAppStyles() {
  const stylesDir = path.resolve(import.meta.dirname, "../../app/styles");
  return fs.readdirSync(stylesDir)
    .filter((fileName) => fileName.endsWith(".css"))
    .sort()
    .map((fileName) => fs.readFileSync(path.join(stylesDir, fileName), "utf8"))
    .join("\n");
}

const baseCss = readAppStyles();

describe("MobilePage", () => {
  it("renders a masthead and bento content rail without nested faux card shells", () => {
    render(
      <MobilePage description="请先确认当前页面操作，再继续执行。" eyebrow="活动管理" title="动态签到">
        <p>当前为签到展示模式</p>
      </MobilePage>
    );

    expect(document.querySelector(".app-surface")).toBeNull();
    expect(document.querySelector(".mobile-page__masthead")).toBeInTheDocument();
    expect(document.querySelector(".mobile-page__content-stack")).toBeInTheDocument();
    expect(document.querySelector(".mobile-page__bento-rail")).toBeInTheDocument();
    expect(screen.getByText("活动管理").closest(".mobile-page__eyebrow")).toBeInTheDocument();
  });

  it("defaults to compact layout while keeping the tone hook", () => {
    render(
      <MobilePage tone="checkin" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "compact");
  });

  it("writes the explicit showcase layout hook for responsive display pages", () => {
    render(
      <MobilePage layout="showcase-auto" tone="staff" title="活动管理">
        <p>当前动态码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "showcase-auto");
  });

  it("renders header actions through the component-library navbar right slot", () => {
    render(
      <MobilePage
        headerActions={<a href="/activities/act_101">返回活动详情</a>}
        title="活动管理"
      >
        <p>当前动态码</p>
      </MobilePage>
    );

    const actionLink = screen.getByRole("link", { name: "返回活动详情" });

    expect(document.querySelector(".t-navbar")).not.toBeNull();
    expect(actionLink.closest(".t-navbar__right")).toBeInTheDocument();
  });

  it("keeps the page shell top-aligned so short pages do not stretch into tall blank panels", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    const main = screen.getByRole("main");
    const shell = main.querySelector(".mobile-page__shell");

    expect(baseCss).toMatch(/\.mobile-page\s*\{[^}]*align-items:\s*flex-start;/);
    expect(shell).not.toBeNull();
    expect(baseCss).toMatch(/\.mobile-page__shell\s*\{[^}]*align-content:\s*start;/);
    expect(baseCss).toMatch(/\.mobile-page__bento-rail\s*\{/);
  });

  it("pins the bento rail to a shrinkable single column so form pages cannot overflow horizontally", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(baseCss).toMatch(/\.mobile-page__bento-rail\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  it("keeps shared single-column containers shrinkable instead of relying on ad-hoc shells", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(baseCss).toMatch(/\.stack-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(baseCss).toMatch(/\.activity-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  it("defines dedicated bento rail and single-card tokens in the shared styles", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(baseCss).toMatch(/--app-bento-rail-gap:/);
    expect(baseCss).toMatch(/--app-bento-panel-padding:/);
    expect(baseCss).toMatch(/--app-bento-panel-shadow:/);
  });
});
