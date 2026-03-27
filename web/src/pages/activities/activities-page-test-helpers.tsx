import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ActivitiesPage } from "./ActivitiesPage";

/**
 * 活动页测试辅助只负责两件事：
 * 1. 统一挂好路由壳，避免每个测试各自重复拼 `MemoryRouter`；
 * 2. 提供稳定的活动样例工厂，减少断言无关字段噪音。
 */
export function renderActivitiesPage() {
  render(
    <MemoryRouter initialEntries={["/activities"]}>
      <Routes>
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activities/:activityId" element={<h1>详情页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * 页面级测试大多只关心少数字段。
 * 这里收口默认样例，避免每个用例都重复铺满完整 DTO。
 */
export function createActivity(
  overrides: Partial<{
    activity_id: string;
    activity_title: string;
    activity_type: string;
    start_time: string;
    location: string;
    progress_status: string;
    support_checkin: boolean;
    support_checkout: boolean;
    my_registered: boolean;
    my_checked_in: boolean;
    my_checked_out: boolean;
    checkin_count: number;
    checkout_count: number;
  }> = {}
) {
  return {
    activity_id: "act_default_101",
    activity_title: "默认活动",
    activity_type: "活动",
    start_time: "2026-03-10 09:00:00",
    location: "独墅湖校区",
    progress_status: "ongoing",
    support_checkin: true,
    support_checkout: true,
    my_registered: true,
    my_checked_in: false,
    my_checked_out: false,
    checkin_count: 18,
    checkout_count: 3,
    ...overrides
  };
}
