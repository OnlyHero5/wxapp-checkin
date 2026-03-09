import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AppRoutes } from "./router";
import { clearSession, setSession } from "../shared/session/session-store";

vi.mock("../shared/device/browser-capability", () => ({
  detectBrowserCapability: () => ({
    hasCredentialManager: true,
    hasPasskeySupport: true,
    hasVisibilityLifecycle: true,
    hasWakeLock: false
  })
}));

vi.mock("../features/activities/api", () => ({
  getActivities: vi.fn().mockResolvedValue({
    activities: []
  })
}));

function renderPath(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe("AppRoutes", () => {
  afterEach(() => {
    clearSession();
  });

  it("redirects the root path to login when session is missing", () => {
    renderPath("/");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("renders the login shell at /login", () => {
    renderPath("/login");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("renders the bind shell at /bind", () => {
    renderPath("/bind");

    expect(screen.getByRole("heading", { name: "身份绑定" })).toBeInTheDocument();
  });

  it("renders the activities shell at /activities", async () => {
    setSession("sess_123");
    renderPath("/activities");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
  });

  it("redirects /activities to login when session is missing", () => {
    renderPath("/activities");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("redirects /login to activities when session exists", async () => {
    setSession("sess_123");
    renderPath("/login");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
  });
});
