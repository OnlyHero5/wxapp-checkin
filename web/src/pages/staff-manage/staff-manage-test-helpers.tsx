import { useState } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StaffManagePage } from "./StaffManagePage";

/**
 * staff 管理页测试需要频繁切活动、切路由。
 * 这里把渲染入口收口，避免每个测试再重复搭一遍路由壳。
 */
export function renderStaffManagePage() {
  render(
    <MemoryRouter initialEntries={["/staff/activities/act_101/manage"]}>
      <Routes>
        <Route path="/staff/activities/:activityId/manage" element={<StaffManagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * 同路由栈内切换活动是这页最容易出竞态的场景。
 * 测试里保留一个可控 harness，专门锁这类 remount 行为。
 */
export function renderStaffManagePageWithControlledRoute() {
  let switchToNextActivity: (() => void) | undefined;

  function ControlledRouteHarness() {
    const [pathname, setPathname] = useState("/staff/activities/act_101/manage");
    switchToNextActivity = () => {
      setPathname("/staff/activities/act_202/manage");
    };

    return (
      <MemoryRouter initialEntries={["/staff/activities/act_101/manage"]}>
        <Routes location={pathname}>
          <Route path="/staff/activities/:activityId/manage" element={<StaffManagePage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  render(<ControlledRouteHarness />);

  return {
    switchToNextActivity() {
      switchToNextActivity?.();
    }
  };
}

/**
 * 管理页大多数测试只关心少量字段。
 * 默认详情样例统一放在这里，避免每个用例重复复制完整响应。
 */
export function buildActivityDetail(activityId: string) {
  return {
    activity_id: activityId,
    activity_title: activityId === "act_202" ? "迎新引导活动" : "校园志愿活动",
    activity_type: "志愿",
    start_time: "2026-03-10 09:00:00",
    location: activityId === "act_202" ? "图书馆前广场" : "本部操场",
    description: "负责现场秩序维护",
    progress_status: "ongoing",
    support_checkin: true,
    support_checkout: true,
    can_checkin: false,
    can_checkout: false,
    my_registered: false,
    my_checked_in: false,
    my_checked_out: false,
    checkin_count: 18,
    checkout_count: 3
  };
}
