import { expect, test } from "@playwright/test";

function installStaffSessionScript() {
  // e2e 直接在浏览器里写入 staff 会话，确保点击链路覆盖真实路由与真实组件交互。
  window.localStorage.setItem("session_token", "sess_staff_manage_123");
  window.localStorage.setItem("session_context", JSON.stringify({
    permissions: ["activity:manage"],
    role: "staff",
    user_profile: null
  }));
}

function installNormalSessionScript() {
  // 普通用户流和 staff 流分开建会话，避免一个场景里的权限状态串到另一个场景。
  window.localStorage.setItem("session_token", "sess_checkin_123");
  window.localStorage.setItem("session_context", JSON.stringify({
    permissions: [],
    role: "normal",
    user_profile: null
  }));
}

test("staff manage page refreshes code through a real browser click", async ({ page }) => {
  await page.addInitScript(installStaffSessionScript);

  // 同一个 action_type 返回两次不同动态码，用来锁住“真点刷新按钮后确实发起了第二次请求”。
  let checkinCodeRequestCount = 0;

  await page.route("**/api/web/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;

    if (route.request().method() === "GET" && pathname === "/api/web/activities/act_101") {
      await route.fulfill({
        json: {
          activity_id: "act_101",
          activity_title: "校园志愿活动",
          activity_type: "志愿",
          start_time: "2026-03-10 09:00:00",
          location: "本部操场",
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
          checkout_count: 3,
          status: "success"
        }
      });
      return;
    }

    if (route.request().method() === "GET" && pathname === "/api/web/staff/activities/act_101/roster") {
      await route.fulfill({
        json: {
          activity_id: "act_101",
          activity_title: "校园志愿活动",
          items: [],
          status: "success"
        }
      });
      return;
    }

    if (route.request().method() === "GET" && pathname === "/api/web/activities/act_101/code-session") {
      const actionType = searchParams.get("action_type");

      if (actionType === "checkin") {
        checkinCodeRequestCount += 1;
        await route.fulfill({
          json: {
            action_type: "checkin",
            activity_id: "act_101",
            checkin_count: 18,
            checkout_count: 3,
            code: checkinCodeRequestCount === 1 ? "483920" : "111222",
            expires_at: 4_102_444_800_000,
            expires_in_ms: 4_000,
            server_time_ms: 4_102_444_796_000,
            status: "success"
          }
        });
        return;
      }

      if (actionType === "checkout") {
        await route.fulfill({
          json: {
            action_type: "checkout",
            activity_id: "act_101",
            checkin_count: 18,
            checkout_count: 3,
            code: "654321",
            expires_at: 4_102_444_900_000,
            expires_in_ms: 5_000,
            server_time_ms: 4_102_444_895_000,
            status: "success"
          }
        });
        return;
      }
    }

    throw new Error(`Unhandled route: ${route.request().method()} ${url.pathname}${url.search}`);
  });

  await page.goto("/staff/activities/act_101/manage");

  await expect(page.getByRole("heading", { name: "活动管理" })).toBeVisible();
  await expect(page.getByText("483920")).toBeVisible();

  await page.getByRole("button", { name: "立即刷新" }).click();
  await expect(page.getByText("111222")).toBeVisible();

});

test("checkin flow submits through a real browser click instead of jsdom fallback dispatch", async ({ page }) => {
  await page.addInitScript(installNormalSessionScript);

  // 这里只拦截当前用例真正依赖的接口，保证断言聚焦在“输入 + 点击 + 提交结果”主链路。
  await page.route("**/api/web/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (route.request().method() === "GET" && pathname === "/api/web/activities/act_101") {
      await route.fulfill({
        json: {
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
          checkout_count: 3,
          status: "success"
        }
      });
      return;
    }

    if (route.request().method() === "POST" && pathname === "/api/web/activities/act_101/code-consume") {
      await expect(route.request().postDataJSON()).toEqual({
        action_type: "checkin",
        code: "123456"
      });
      await route.fulfill({
        json: {
          action_type: "checkin",
          activity_id: "act_101",
          activity_title: "校园志愿活动",
          message: "提交成功",
          server_time_ms: 1_773_104_400_000,
          status: "success"
        }
      });
      return;
    }

    throw new Error(`Unhandled route: ${route.request().method()} ${url.pathname}${url.search}`);
  });

  await page.goto("/activities/act_101/checkin");

  await page.getByPlaceholder("输入 6 位码…").fill("12ab34 56");
  await page.getByRole("button", { name: "提交签到码" }).click();

  await expect(page.getByRole("heading", { name: "签到结果" })).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
  await expect(page.getByText("校园志愿活动")).toBeVisible();
});
