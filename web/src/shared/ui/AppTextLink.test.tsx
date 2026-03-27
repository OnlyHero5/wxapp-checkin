import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTextLink, shouldKeepBrowserNavigation } from "./AppTextLink";

describe("AppTextLink", () => {
  it("keeps an anchor href while navigating through react-router", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/from"]}>
        <Routes>
          <Route path="/from" element={<AppTextLink to="/target">查看详情</AppTextLink>} />
          <Route path="/target" element={<h1>目标页已打开</h1>} />
        </Routes>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "查看详情" });

    expect(link).toHaveAttribute("href", "/target");

    await user.click(link);

    expect(await screen.findByRole("heading", { name: "目标页已打开" })).toBeInTheDocument();
  });

  it("keeps browser-native modified-click behavior", () => {
    const link = document.createElement("a");

    expect(
      shouldKeepBrowserNavigation({
        altKey: false,
        button: 0,
        ctrlKey: false,
        currentTarget: link,
        metaKey: true,
        shiftKey: false
      })
    ).toBe(true);
  });

  it("keeps browser-native target handling", () => {
    const link = document.createElement("a");
    link.setAttribute("target", "_blank");

    expect(
      shouldKeepBrowserNavigation({
        altKey: false,
        button: 0,
        ctrlKey: false,
        currentTarget: link,
        metaKey: false,
        shiftKey: false
      })
    ).toBe(true);
  });
});
