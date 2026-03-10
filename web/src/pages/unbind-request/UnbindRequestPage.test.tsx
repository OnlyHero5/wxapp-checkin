import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { UnbindRequestPage } from "./UnbindRequestPage";

const staffApiMocks = vi.hoisted(() => ({
  createUnbindReview: vi.fn()
}));

vi.mock("../../features/staff/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/staff/api")>();
  return {
    ...actual,
    createUnbindReview: staffApiMocks.createUnbindReview
  };
});

function renderUnbindRequestPage() {
  render(
    <MemoryRouter initialEntries={["/unbind-request"]}>
      <Routes>
        <Route path="/unbind-request" element={<UnbindRequestPage />} />
        <Route path="/activities" element={<h1>活动列表已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UnbindRequestPage", () => {
  beforeEach(() => {
    saveAuthSession({
      role: "normal",
      session_token: "sess_unbind_123"
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("submits an unbind request and returns to activities", async () => {
    const user = userEvent.setup();
    staffApiMocks.createUnbindReview.mockResolvedValue({
      review_id: "rev_123",
      status: "success"
    });

    renderUnbindRequestPage();

    await user.type(screen.getByLabelText("解绑原因"), "更换手机");
    await user.type(screen.getByLabelText("新设备说明"), "iPhone 16");
    await user.click(screen.getByRole("button", { name: "提交解绑申请" }));

    await waitFor(() => {
      expect(staffApiMocks.createUnbindReview).toHaveBeenCalledWith({
        reason: "更换手机",
        requested_new_binding_hint: "iPhone 16"
      });
    });
    expect(screen.getByRole("heading", { name: "活动列表已打开" })).toBeInTheDocument();
  });
});
