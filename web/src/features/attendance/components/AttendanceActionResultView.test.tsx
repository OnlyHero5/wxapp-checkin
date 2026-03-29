import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AttendanceActionResultView } from "./AttendanceActionResultView";

describe("AttendanceActionResultView", () => {
  it("renders the success result and back action inside the shared mobile page shell", () => {
    render(
      <MemoryRouter>
        <AttendanceActionResultView
          actionType="checkin"
          onBack={() => undefined}
          result={{
            action_type: "checkin",
            activity_id: "act_101",
            activity_title: "校园志愿活动",
            message: "提交成功",
            server_time_ms: 1760000004300
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "签到结果" })).toBeInTheDocument();
    expect(screen.getByText("提交成功").closest(".attendance-action-result__panel")).toBeInTheDocument();
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回活动详情" })).toBeInTheDocument();
  });
});
