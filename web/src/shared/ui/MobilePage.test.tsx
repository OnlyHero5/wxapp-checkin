import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

const baseCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../app/styles/base.css"),
  "utf8"
);

describe("MobilePage", () => {
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

  it("wraps header actions in a dedicated slot for narrow-screen overflow control", () => {
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

  it("keeps the page shell top-aligned so short pages do not stretch into tall blank cards", () => {
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
  });

  it("pins the content grid to a shrinkable single column so form pages cannot overflow horizontally", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(baseCss).toMatch(/\.mobile-page__content\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });

  it("keeps shared single-column containers shrinkable instead of relying on ad-hoc form wrappers", () => {
    render(
      <MobilePage eyebrow="动态验证码" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(baseCss).toMatch(/\.stack-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(baseCss).toMatch(/\.activity-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  });
});
