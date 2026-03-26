import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTextLink } from "./AppTextLink";

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
});
