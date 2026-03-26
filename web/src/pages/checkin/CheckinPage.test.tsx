import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/http/errors";
import { clearSession, setSession } from "../../shared/session/session-store";
import { CheckinPage } from "./CheckinPage";
import { CheckoutPage } from "../checkout/CheckoutPage";

const activitiesApiMocks = vi.hoisted(() => ({
  consumeActivityCode: vi.fn(),
  getActivityDetail: vi.fn()
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    consumeActivityCode: activitiesApiMocks.consumeActivityCode,
    getActivityDetail: activitiesApiMocks.getActivityDetail
  };
});

function AttendanceRouteHarness({ nextPath }: { nextPath?: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (nextPath) {
      navigate(nextPath);
    }
  }, [navigate, nextPath]);

  return (
    <Routes>
      <Route path="/activities/:activityId/checkin" element={<CheckinPage />} />
      <Route path="/activities/:activityId/checkout" element={<CheckoutPage />} />
      <Route path="/activities/:activityId" element={<h1>详情页已打开</h1>} />
    </Routes>
  );
}

function AttendanceTestApp({ initialPath, nextPath }: { initialPath: string; nextPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AttendanceRouteHarness nextPath={nextPath} />
    </MemoryRouter>
  );
}

function renderAttendancePage(path: string) {
  return render(<AttendanceTestApp initialPath={path} />);
}

describe("CheckinPage", () => {
  beforeEach(() => {
    setSession("sess_checkin_123");
    activitiesApiMocks.getActivityDetail.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      activity_type: "志愿",
      start_time: "2026-03-10 09:00:00",
      location: "本部操场",
      description: "负责现场秩序维护",
      progress_status: "ongoing",
      support_checkin: true,
      support_checkout: true,
      can_checkin: true,
      can_checkout: true,
      my_registered: true,
      my_checked_in: false,
      my_checked_out: false,
      checkin_count: 18,
      checkout_count: 3
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("submits a six-digit numeric checkin code and shows the success result", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.consumeActivityCode.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      action_type: "checkin",
      message: "提交成功",
      server_time_ms: 1760000004300
    });

    renderAttendancePage("/activities/act_101/checkin");

    const input = await screen.findByPlaceholderText("输入6位码");
    const submitButton = screen.getByRole("button", { name: "提交签到码" });

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
    expect(input.closest(".t-input")).toBeInTheDocument();
    expect(input.closest(".t-form")).toBeInTheDocument();
    expect(screen.getByText("请在当前活动下输入 6 位动态验证码")).toBeInTheDocument();
    expect(submitButton).toHaveClass("app-button--accent-checkin");
    expect(submitButton).toBeDisabled();

    await user.type(input, "12ab34 56");
    expect(input).toHaveValue(123456);
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(activitiesApiMocks.consumeActivityCode).toHaveBeenCalledWith("act_101", {
        action_type: "checkin",
        code: "123456"
      });
    });
    expect(screen.getByRole("heading", { name: "签到结果" })).toBeInTheDocument();
    expect(screen.getByText("提交成功").closest(".t-result")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();
    expect(screen.getByText("提交成功")).toBeInTheDocument();
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回活动详情" })).toBeInTheDocument();
  });

  it("shows a clear error message for expired codes", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.consumeActivityCode.mockRejectedValue(
      new ApiError("服务端错误", {
        code: "expired",
        status: "forbidden"
      })
    );

    renderAttendancePage("/activities/act_101/checkin");

    await user.type(await screen.findByPlaceholderText("输入6位码"), "123456");
    await user.click(screen.getByRole("button", { name: "提交签到码" }));

    expect(await screen.findByText("验证码已过期，请重新输入最新验证码")).toBeInTheDocument();
  });

  it("renders checkout copy and submits checkout codes", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.consumeActivityCode.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      action_type: "checkout",
      message: "签退提交成功",
      server_time_ms: 1760000005300
    });

    renderAttendancePage("/activities/act_101/checkout");

    expect(await screen.findByRole("heading", { name: "活动签退" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkout");
    expect(screen.getByPlaceholderText("输入6位码").closest(".t-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入6位码").closest(".t-form")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回活动详情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交签退码" })).toHaveClass("app-button--accent-checkout");
    await user.type(screen.getByPlaceholderText("输入6位码"), "654321");
    await user.click(screen.getByRole("button", { name: "提交签退码" }));

    await waitFor(() => {
      expect(activitiesApiMocks.consumeActivityCode).toHaveBeenCalledWith("act_101", {
        action_type: "checkout",
        code: "654321"
      });
    });
    expect(screen.getByRole("heading", { name: "签退结果" })).toBeInTheDocument();
  });

  it("resets the previous result state when switching to another activity route", async () => {
    const user = userEvent.setup();
    let resolveSecondDetail: ((value: unknown) => void) | undefined;
    activitiesApiMocks.getActivityDetail
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        progress_status: "ongoing",
        can_checkin: true,
        can_checkout: true,
        my_registered: true,
        my_checked_in: false,
        my_checked_out: false
      })
      .mockImplementationOnce(() => {
        return new Promise((resolve) => {
          resolveSecondDetail = resolve;
        });
      });
    activitiesApiMocks.consumeActivityCode.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      action_type: "checkin",
      message: "提交成功"
    });

    const view = renderAttendancePage("/activities/act_101/checkin");

    await user.type(await screen.findByPlaceholderText("输入6位码"), "123456");
    await user.click(screen.getByRole("button", { name: "提交签到码" }));

    expect(await screen.findByRole("heading", { name: "签到结果" })).toBeInTheDocument();
    expect(screen.getByText("提交成功")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();

    view.rerender(<AttendanceTestApp initialPath="/activities/act_101/checkin" nextPath="/activities/act_202/checkin" />);

    expect(screen.getByRole("heading", { name: "活动签到" })).toBeInTheDocument();
    expect(screen.getByText("活动信息加载中...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "签到结果" })).not.toBeInTheDocument();
    expect(screen.queryByText("提交成功")).not.toBeInTheDocument();
    expect(screen.queryByText("校园志愿活动")).not.toBeInTheDocument();

    resolveSecondDetail?.({
      activity_id: "act_202",
      activity_title: "创新论坛",
      progress_status: "ongoing",
      can_checkin: true,
      can_checkout: false,
      my_registered: true,
      my_checked_in: false,
      my_checked_out: false
    });

    expect(await screen.findByText("创新论坛")).toBeInTheDocument();
  });
});
