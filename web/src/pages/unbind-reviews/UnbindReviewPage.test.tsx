import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { UnbindReviewPage } from "./UnbindReviewPage";

const reviewApiMocks = vi.hoisted(() => ({
  approveUnbindReview: vi.fn(),
  getUnbindReviews: vi.fn(),
  rejectUnbindReview: vi.fn()
}));

vi.mock("../../features/staff/api", () => ({
  approveUnbindReview: reviewApiMocks.approveUnbindReview,
  getUnbindReviews: reviewApiMocks.getUnbindReviews,
  rejectUnbindReview: reviewApiMocks.rejectUnbindReview
}));

function renderUnbindReviewPage() {
  render(
    <MemoryRouter initialEntries={["/staff/unbind-reviews"]}>
      <Routes>
        <Route path="/staff/unbind-reviews" element={<UnbindReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UnbindReviewPage", () => {
  beforeEach(() => {
    saveAuthSession({
      permissions: ["unbind:review"],
      role: "staff",
      session_token: "sess_review_123"
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearSession();
  });

  it("loads pending reviews and supports switching review status", async () => {
    const user = userEvent.setup();
    reviewApiMocks.getUnbindReviews
      .mockResolvedValueOnce({
        items: [
          {
            reason: "更换手机",
            review_id: "rev_101",
            status: "pending",
            student_id: "2025000021",
            submitted_at: "2026-03-09 10:00:00",
            user_name: "王敏"
          }
        ],
        status: "success"
      })
      .mockResolvedValueOnce({
        items: [
          {
            reason: "旧设备损坏",
            review_id: "rev_202",
            review_comment: "确认已更换设备",
            reviewer_name: "刘洋",
            status: "approved",
            student_id: "2025000022",
            submitted_at: "2026-03-09 11:00:00",
            user_name: "张雪"
          }
        ],
        status: "success"
      });

    renderUnbindReviewPage();

    expect(await screen.findByRole("heading", { name: "解绑审核" })).toBeInTheDocument();
    expect(screen.getByText("王敏")).toBeInTheDocument();

    await user.click(screen.getByText("已通过"));

    expect(await screen.findByText("张雪")).toBeInTheDocument();
    expect(reviewApiMocks.getUnbindReviews).toHaveBeenLastCalledWith({
      status: "approved"
    });
  });

  it("approves pending reviews and refreshes the list", async () => {
    const user = userEvent.setup();
    reviewApiMocks.getUnbindReviews
      .mockResolvedValueOnce({
        items: [
          {
            reason: "更换手机",
            review_id: "rev_101",
            status: "pending",
            student_id: "2025000021",
            submitted_at: "2026-03-09 10:00:00",
            user_name: "王敏"
          }
        ],
        status: "success"
      })
      .mockResolvedValueOnce({
        items: [],
        status: "success"
      });
    reviewApiMocks.approveUnbindReview.mockResolvedValue({
      message: "审批通过",
      review_id: "rev_101",
      status: "success"
    });

    renderUnbindReviewPage();

    expect(await screen.findByText("王敏")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "通过" }));
    await user.click(screen.getByRole("button", { name: "确认通过" }));

    expect(reviewApiMocks.approveUnbindReview).toHaveBeenCalledWith("rev_101", {
      review_comment: "确认已更换设备"
    });
    expect(await screen.findByText("当前状态暂无记录。")).toBeInTheDocument();
  });
});
