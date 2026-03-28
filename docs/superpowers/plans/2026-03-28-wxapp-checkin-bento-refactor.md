# Wxapp Checkin Bento Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `wxapp-checkin/web` 重构为统一的纵向便当布局，并修复名单异常状态、自愈流程与批量修正逻辑。

**Architecture:** 先把名单异常识别、状态归一化与“设为已签退”单命令 patch 收口到纯函数与共享自愈 helper，再把这套口径接入 `StaffManagePage` 与 `ActivityRosterPage`。随后重写 `MobilePage`、`ActivityMetaPanel` 与页面样式骨架，让活动列表、详情、staff、登录、签到、签退、我的页都围绕同一套单列便当主卡工作。

**Tech Stack:** React 18、TypeScript、React Router 7、TDesign Mobile React、Vitest、Testing Library、CSS variables

---

## File Map

- Create: `web/src/features/staff/attendance-roster-state.ts`
  责任：归一化 `checked_in / checked_out`、识别异常成员、把动作枚举映射成后端可接受的单命令 patch。
- Create: `web/src/features/staff/attendance-roster-state.test.ts`
  责任：锁住“已签退必然已签到”“异常成员识别”“单命令 patch”三条核心规则。
- Create: `web/src/features/staff/attendance-roster-self-heal.ts`
  责任：读取 roster、自动修复异常成员、返回是否需要刷新。
- Create: `web/src/features/staff/attendance-roster-self-heal.test.ts`
  责任：锁住自动自愈请求体与重复刷新行为。
- Modify: `web/src/features/staff/activity-roster-actions.ts`
  责任：改为复用共享 patch resolver，而不是继续直接拼双布尔组合。
- Modify: `web/src/features/staff/api.ts`
  责任：补齐自愈 helper 所需的输入输出类型注释，不改接口路径。
- Modify: `web/src/pages/activity-roster/use-activity-roster-page-state.ts`
  责任：接入异常扫描、自愈、规范化名单与批量链路禁用。
- Modify: `web/src/pages/staff-manage/use-staff-manage-state.ts`
  责任：接入管理页异常自愈，确保动态码页也不会基于脏状态继续操作。
- Modify: `web/src/shared/ui/MobilePage.tsx`
  责任：升级为全站纵向便当骨架。
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
  责任：从三段 `CellGroup` 改为单容器多分区主卡。
- Modify: `web/src/shared/ui/activity-meta-panel/row-builders.ts`
  责任：从“按 CellGroup 分组”改成“按主卡分区建模”。
- Modify: `web/src/app/styles/tokens.css`
  责任：补全便当布局主卡、次卡、动作带、状态豆腐块 token。
- Modify: `web/src/app/styles/page-shell.css`
  责任：统一全站首块、内容带、单列便当节奏。
- Modify: `web/src/app/styles/staff-page.css`
  责任：重排动态码、批量条、名单卡、滑动动作宽度。
- Modify: `web/src/features/activities/components/ActivityCard.tsx`
  责任：落实“一活动一主卡”。
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
  责任：改成“活动主卡 + 动作带 + 辅助块”。
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
  责任：变成动态码工作台主卡。
- Modify: `web/src/features/staff/components/AttendanceRosterList.tsx`
  责任：消费规范名单状态，保留 `SwipeCell`，但动作完全看规范态。
- Modify: `web/src/features/staff/components/AttendanceBatchActionBar.tsx`
  责任：改成更明确的 summary + action 便当条。
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
  责任：摘要卡 + 批量修正卡 + 名单信息带。
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
  责任：摘要次卡 + 动态码主卡 + 危险动作卡。
- Modify: `web/src/features/auth/components/AccountLoginForm.tsx`
  责任：将登录表单收进统一主卡/动作带节奏。
- Modify: `web/src/features/attendance/components/AttendanceActionDetailSection.tsx`
  责任：将签到/签退输入页从 `CellGroup` 过渡到便当主卡。
- Modify: `web/src/features/attendance/components/AttendanceActionResultView.tsx`
  责任：将结果态并入同一套便当页面。
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/checkout/CheckoutPage.tsx`
- Modify: `web/src/pages/profile/ProfilePage.tsx`
  责任：让剩余正式页面都落到统一便当骨架。
- Test: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.actions.test.tsx`
- Test: `web/src/shared/ui/ActivityMetaPanel.test.tsx`
- Test: `web/src/shared/ui/MobilePage.test.tsx`
- Test: `web/src/features/activities/components/ActivityCard.test.tsx`
- Test: `web/src/pages/activities/ActivitiesPage.rendering.test.tsx`
- Test: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`
- Test: `web/src/pages/login/LoginPage.test.tsx`
- Test: `web/src/pages/profile/ProfilePage.test.tsx`

## Task 1: 收口名单规范状态与单命令 patch

**Files:**
- Create: `web/src/features/staff/attendance-roster-state.ts`
- Create: `web/src/features/staff/attendance-roster-state.test.ts`
- Modify: `web/src/features/staff/activity-roster-actions.ts`
- Test: `web/src/features/staff/activity-roster-actions.test.ts`

- [ ] **Step 1: Write the failing state-machine tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildAttendanceAdjustmentPatch,
  collectAnomalousRosterUserIds,
  normalizeRosterItem
} from "./attendance-roster-state";

describe("attendance-roster-state", () => {
  it("treats checked-out members as checked-in even when backend flags are dirty", () => {
    const normalized = normalizeRosterItem({
      user_id: 12,
      student_id: "2025000012",
      name: "异常成员",
      checked_in: false,
      checked_out: true,
      checkin_time: "",
      checkout_time: "2026-03-10 10:10"
    });

    expect(normalized.checked_in).toBe(true);
    expect(normalized.checked_out).toBe(true);
    expect(normalized.normalized_state).toBe("checked_out");
    expect(normalized.is_data_anomalous).toBe(true);
  });

  it("collects only dirty checked-out members for self-heal", () => {
    expect(
      collectAnomalousRosterUserIds([
        { user_id: 1, student_id: "1", name: "A", checked_in: false, checked_out: false, checkin_time: "", checkout_time: "" },
        { user_id: 2, student_id: "2", name: "B", checked_in: false, checked_out: true, checkin_time: "", checkout_time: "2026-03-10 10:10" }
      ])
    ).toEqual([2]);
  });

  it("maps set_checked_out to a single-field patch so the backend does not reject it", () => {
    expect(buildAttendanceAdjustmentPatch("set_checked_out")).toEqual({
      checked_out: true
    });
    expect(buildAttendanceAdjustmentPatch("clear_checked_out")).toEqual({
      checked_out: false
    });
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/staff/attendance-roster-state.test.ts src/features/staff/activity-roster-actions.test.ts`  
Expected: FAIL with `Cannot find module './attendance-roster-state'` and/or assertion mismatch because `activity-roster-actions.ts` still returns dual-boolean patches.

- [ ] **Step 3: Write the minimal normalization helper**

```ts
import type { ActivityRosterItem } from "./api";
import type { AttendanceActionKey } from "./components/AttendanceBatchActionBar";

export type NormalizedRosterState = "not_checked" | "checked_in" | "checked_out";

export type NormalizedRosterItem = ActivityRosterItem & {
  is_data_anomalous: boolean;
  normalized_state: NormalizedRosterState;
};

export const normalizeRosterItem = (item: ActivityRosterItem): NormalizedRosterItem => {
  const isDataAnomalous = item.checked_out && !item.checked_in;
  const checkedIn = item.checked_in || item.checked_out;
  const checkedOut = item.checked_out;

  return {
    ...item,
    checked_in: checkedIn,
    checked_out: checkedOut,
    is_data_anomalous: isDataAnomalous,
    normalized_state: checkedOut ? "checked_out" : checkedIn ? "checked_in" : "not_checked"
  };
};

export const collectAnomalousRosterUserIds = (items: ActivityRosterItem[]) =>
  items.filter((item) => item.checked_out && !item.checked_in).map((item) => item.user_id);

export const buildAttendanceAdjustmentPatch = (action: AttendanceActionKey) => {
  switch (action) {
    case "set_checked_in":
      return { checked_in: true };
    case "clear_checked_in":
      return { checked_in: false };
    case "set_checked_out":
      return { checked_out: true };
    case "clear_checked_out":
      return { checked_out: false };
  }
};
```

- [ ] **Step 4: Update the existing action resolver to reuse the helper**

```ts
import { buildAttendanceAdjustmentPatch } from "./attendance-roster-state";

export function resolveAttendanceActionPayload(action: AttendanceActionKey): AttendanceActionPayload {
  switch (action) {
    case "set_checked_in":
      return { patch: buildAttendanceAdjustmentPatch(action), reason: "设为已签到" };
    case "clear_checked_in":
      return { patch: buildAttendanceAdjustmentPatch(action), reason: "设为未签到" };
    case "set_checked_out":
      return { patch: buildAttendanceAdjustmentPatch(action), reason: "设为已签退" };
    case "clear_checked_out":
      return { patch: buildAttendanceAdjustmentPatch(action), reason: "设为未签退" };
  }
}
```

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/staff/attendance-roster-state.test.ts src/features/staff/activity-roster-actions.test.ts`  
Expected: PASS with all assertions green.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/features/staff/attendance-roster-state.ts \
  web/src/features/staff/attendance-roster-state.test.ts \
  web/src/features/staff/activity-roster-actions.ts \
  web/src/features/staff/activity-roster-actions.test.ts
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 收口名单规范状态与命令 patch"
```

## Task 2: 接入管理页与名单页异常自愈

**Files:**
- Create: `web/src/features/staff/attendance-roster-self-heal.ts`
- Create: `web/src/features/staff/attendance-roster-self-heal.test.ts`
- Modify: `web/src/pages/activity-roster/use-activity-roster-page-state.ts`
- Modify: `web/src/pages/staff-manage/use-staff-manage-state.ts`
- Test: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx`

- [ ] **Step 1: Write the failing self-heal tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { ensureRosterConsistency } from "./attendance-roster-self-heal";

describe("attendance-roster-self-heal", () => {
  it("repairs dirty checked-out members by sending set_checked_out once", async () => {
    const getActivityRoster = vi.fn().mockResolvedValue({
      items: [
        { user_id: 9, student_id: "9", name: "异常成员", checked_in: false, checked_out: true, checkin_time: "", checkout_time: "2026-03-10 10:10" }
      ]
    });
    const adjustAttendanceStates = vi.fn().mockResolvedValue({ status: "success" });

    await ensureRosterConsistency({
      activityId: "act_101",
      adjustAttendanceStates,
      getActivityRoster
    });

    expect(adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
      user_ids: [9],
      patch: { checked_out: true },
      reason: "自动修复异常签退状态"
    });
  });
});
```

```tsx
it("self-heals dirty checkout members before keeping roster actions enabled", async () => {
  staffApiMocks.getActivityRoster
    .mockResolvedValueOnce({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      items: [
        {
          user_id: 12,
          student_id: "2025000012",
          name: "异常成员",
          checked_in: false,
          checked_out: true,
          checkin_time: "",
          checkout_time: "2026-03-10 10:10"
        }
      ]
    })
    .mockResolvedValueOnce({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      items: [
        {
          user_id: 12,
          student_id: "2025000012",
          name: "异常成员",
          checked_in: true,
          checked_out: true,
          checkin_time: "2026-03-10 09:05",
          checkout_time: "2026-03-10 10:10"
        }
      ]
    });

  renderActivityRosterPage();

  await waitFor(() => {
    expect(staffApiMocks.adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
      user_ids: [12],
      patch: { checked_out: true },
      reason: "自动修复异常签退状态"
    });
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/staff/attendance-roster-self-heal.test.ts src/pages/activity-roster/ActivityRosterPage.test.tsx src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx`  
Expected: FAIL because the self-heal helper does not exist and both hooks still trust dirty roster data.

- [ ] **Step 3: Create the shared self-heal helper**

```ts
import {
  adjustAttendanceStates as defaultAdjustAttendanceStates,
  getActivityRoster as defaultGetActivityRoster,
  type ActivityRosterResponse
} from "./api";
import { collectAnomalousRosterUserIds } from "./attendance-roster-state";

type EnsureRosterConsistencyResult = {
  didHeal: boolean;
  roster: ActivityRosterResponse;
};

export const ensureRosterConsistency = async ({
  activityId,
  adjustAttendanceStates = defaultAdjustAttendanceStates,
  getActivityRoster = defaultGetActivityRoster
}: {
  activityId: string;
  adjustAttendanceStates?: typeof defaultAdjustAttendanceStates;
  getActivityRoster?: typeof defaultGetActivityRoster;
}): Promise<EnsureRosterConsistencyResult> => {
  const roster = await getActivityRoster(activityId);
  const anomalousUserIds = collectAnomalousRosterUserIds(roster.items);

  if (anomalousUserIds.length === 0) {
    return { didHeal: false, roster };
  }

  await adjustAttendanceStates(activityId, {
    user_ids: anomalousUserIds,
    patch: { checked_out: true },
    reason: "自动修复异常签退状态"
  });

  return {
    didHeal: true,
    roster: await getActivityRoster(activityId)
  };
};
```

- [ ] **Step 4: Use the helper in both page hooks**

```ts
const loadRoster = useCallback(async (resetBeforeLoad: boolean) => {
  // ...
  const result = await ensureRosterConsistency({ activityId });
  setRoster({
    ...result.roster,
    items: result.roster.items.map(normalizeRosterItem)
  });
}, [activityId, navigate]);
```

```ts
const refreshPage = useCallback(async (options: RefreshOptions) => {
  setErrorMessage("");
  const healResult = await ensureRosterConsistency({ activityId }).catch((error) => {
    setErrorMessage(resolvePageErrorMessage(error, "活动管理信息加载失败，请稍后重试。"));
    return null;
  });

  await Promise.all([
    options.reloadDetail ? loadDetail(options.resetDetail) : Promise.resolve(),
    loadCodeSession(actionType, options.resetCodeSession)
  ]);

  if (healResult?.didHeal) {
    await Promise.all([loadDetail(false), loadCodeSession(actionType, true)]);
  }
}, [actionType, activityId, loadCodeSession, loadDetail]);
```

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/staff/attendance-roster-self-heal.test.ts src/pages/activity-roster/ActivityRosterPage.test.tsx src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx`  
Expected: PASS, including the new self-heal assertions.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/features/staff/attendance-roster-self-heal.ts \
  web/src/features/staff/attendance-roster-self-heal.test.ts \
  web/src/pages/activity-roster/use-activity-roster-page-state.ts \
  web/src/pages/staff-manage/use-staff-manage-state.ts \
  web/src/pages/activity-roster/ActivityRosterPage.test.tsx \
  web/src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 接入管理与名单异常状态自愈"
```

## Task 3: 重写共享便当骨架与单卡活动面板

**Files:**
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/shared/ui/MobilePage.test.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.test.tsx`
- Modify: `web/src/shared/ui/activity-meta-panel/row-builders.ts`
- Modify: `web/src/shared/ui/activity-meta-panel/row-builders.test.ts`
- Modify: `web/src/app/styles/tokens.css`
- Modify: `web/src/app/styles/page-shell.css`

- [ ] **Step 1: Write the failing shared UI tests**

```tsx
it("renders one activity card shell instead of three card groups", () => {
  const { container } = render(
    <ActivityMetaPanel
      counts={{ checkin: 12, checkout: 3 }}
      description="负责现场秩序维护"
      joinStatusText="已报名"
      locationText="本部操场"
      subtitle="志愿"
      timeText="2026-03-10 09:00:00"
      title="校园志愿活动"
    />
  );

  expect(container.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
  expect(container.querySelectorAll(".activity-meta-panel__section")).toHaveLength(3);
  expect(container.querySelectorAll(".activity-meta-panel").length).toBe(1);
});
```

```tsx
it("renders a masthead and bento content rail without nested faux card shells", () => {
  render(
    <MobilePage description="请先确认当前页面操作，再继续执行。" eyebrow="活动管理" title="动态签到">
      <p>当前为签到展示模式</p>
    </MobilePage>
  );

  expect(document.querySelector(".mobile-page__masthead")).toBeInTheDocument();
  expect(document.querySelector(".mobile-page__content-stack")).toBeInTheDocument();
  expect(document.querySelector(".mobile-page__bento-rail")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shared UI tests to verify they fail**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/shared/ui/ActivityMetaPanel.test.tsx src/shared/ui/MobilePage.test.tsx src/shared/ui/activity-meta-panel/row-builders.test.ts`  
Expected: FAIL because `ActivityMetaPanel` still renders `CellGroup` cards and `MobilePage` lacks the bento rail hooks.

- [ ] **Step 3: Rewrite `ActivityMetaPanel` around one outer card**

```tsx
export function ActivityMetaPanel(props: ActivityMetaPanelProps) {
  const { summary, details, metrics, actions } = buildActivityMetaSections(props);

  return (
    <article className={`activity-meta-panel activity-meta-panel--${props.tone ?? "default"}`} data-panel-tone={props.tone ?? "default"}>
      <header className="activity-meta-panel__section activity-meta-panel__section--hero">
        <div className="activity-meta-panel__title-block">
          <p className="activity-meta-panel__subtitle">{summary.subtitle}</p>
          <h2 className="activity-meta-panel__title">{props.title}</h2>
        </div>
        <div className="activity-meta-panel__status-slot">{summary.statusSlot}</div>
      </header>
      <section className="activity-meta-panel__section activity-meta-panel__section--details">{details}</section>
      {metrics.length > 0 ? <section className="activity-meta-panel__section activity-meta-panel__section--metrics">{metrics}</section> : null}
      {actions ? <footer className="activity-meta-panel__section activity-meta-panel__section--actions">{actions}</footer> : null}
    </article>
  );
}
```

- [ ] **Step 4: Upgrade `MobilePage` and CSS tokens to the single-column bento rail**

```tsx
export function MobilePage({ children, description, eyebrow, headerActions, layout = "compact", title, tone = "default" }: MobilePageProps) {
  return (
    <main className="mobile-page" data-page-layout={layout} data-page-tone={tone}>
      <div className="mobile-page__shell">
        <header className="mobile-page__masthead">...</header>
        <section className="mobile-page__content">
          <div className="mobile-page__content-stack mobile-page__bento-rail">{children}</div>
        </section>
      </div>
    </main>
  );
}
```

```css
.mobile-page__bento-rail {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}

.activity-meta-panel {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-xl);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-card);
}
```

- [ ] **Step 5: Run the shared UI tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/shared/ui/ActivityMetaPanel.test.tsx src/shared/ui/MobilePage.test.tsx src/shared/ui/activity-meta-panel/row-builders.test.ts`  
Expected: PASS with the single-card assertions green.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/shared/ui/MobilePage.tsx \
  web/src/shared/ui/MobilePage.test.tsx \
  web/src/shared/ui/ActivityMetaPanel.tsx \
  web/src/shared/ui/ActivityMetaPanel.test.tsx \
  web/src/shared/ui/activity-meta-panel/row-builders.ts \
  web/src/shared/ui/activity-meta-panel/row-builders.test.ts \
  web/src/app/styles/tokens.css \
  web/src/app/styles/page-shell.css
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 重写共享便当骨架与活动主卡"
```

## Task 4: 落实活动列表与详情页的一活动一主卡

**Files:**
- Modify: `web/src/features/activities/components/ActivityCard.tsx`
- Modify: `web/src/features/activities/components/ActivityCard.test.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.rendering.test.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Modify: `web/src/app/styles/page-shell.css`

- [ ] **Step 1: Add the failing activity-card regression tests**

```tsx
it("renders one article-level activity card per activity", () => {
  const { container } = render(
    <MemoryRouter>
      <ActivityCard activity={{ activity_id: "act_101", activity_title: "校园志愿活动", activity_type: "志愿", location: "本部操场", my_registered: true, progress_status: "ongoing", start_time: "2026-03-10 09:00:00" }} />
    </MemoryRouter>
  );

  expect(container.querySelectorAll("article.activity-meta-panel")).toHaveLength(1);
  expect(container.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
});
```

```tsx
it("keeps list rows to one main card per activity", async () => {
  renderActivitiesPage();
  expect(await screen.findByText("校园志愿活动")).toBeInTheDocument();
  expect(document.querySelectorAll("article.activity-meta-panel")).toHaveLength(2);
});
```

- [ ] **Step 2: Run the list/detail tests to verify they fail**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/activities/components/ActivityCard.test.tsx src/pages/activities/ActivitiesPage.rendering.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx`  
Expected: FAIL because the old panel still renders multiple card groups and the detail page still depends on the old grouping.

- [ ] **Step 3: Refactor `ActivityCard` to feed one panel with internal sections**

```tsx
export function ActivityCard({ activity, showManageEntry = false }: ActivityCardProps) {
  return (
    <ActivityMetaPanel
      counts={showManageEntry ? { checkin: activity.checkin_count, checkout: activity.checkout_count } : undefined}
      footer={
        <>
          <AppTextLink to={buildActivityDetailPath(activity.activity_id)}>查看详情</AppTextLink>
          {showManageEntry ? <AppTextLink to={buildActivityManagePath(activity.activity_id)}>进入管理</AppTextLink> : null}
        </>
      }
      joinStatusText={resolveJoinStatus(activity)}
      locationText={activity.location}
      statusSlot={<StatusTag status={resolveProgressStatus(activity)} />}
      subtitle={activity.activity_type}
      timeText={activity.start_time}
      tone={showManageEntry ? "staff" : "brand"}
      title={activity.activity_title}
    />
  );
}
```

- [ ] **Step 4: Refactor `ActivityDetailPage` to the same card + action rail shape**

```tsx
<MobilePage ...>
  <ActivityMetaPanel
    checkinTimeText={!isStaff ? detail.my_checkin_time : undefined}
    counts={isStaff ? { checkin: detail.checkin_count, checkout: detail.checkout_count } : undefined}
    checkoutTimeText={!isStaff ? detail.my_checkout_time : undefined}
    description={detail.description}
    footer={null}
    joinStatusText={resolveJoinStatus(detail)}
    locationText={detail.location}
    progressText={progressStatus === "completed" ? "已完成" : "进行中"}
    statusSlot={<StatusTag status={progressStatus} />}
    subtitle={detail.activity_type}
    timeText={detail.start_time}
    tone={detailTone}
    title={detail.activity_title}
  />
  <section className="detail-actions detail-actions--bento">...</section>
</MobilePage>
```

- [ ] **Step 5: Run the list/detail tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/features/activities/components/ActivityCard.test.tsx src/pages/activities/ActivitiesPage.rendering.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx`  
Expected: PASS, with no residual `.t-cell-group--card` assumptions.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/features/activities/components/ActivityCard.tsx \
  web/src/features/activities/components/ActivityCard.test.tsx \
  web/src/pages/activities/ActivitiesPage.tsx \
  web/src/pages/activities/ActivitiesPage.rendering.test.tsx \
  web/src/pages/activity-detail/ActivityDetailPage.tsx \
  web/src/pages/activity-detail/ActivityDetailPage.test.tsx \
  web/src/app/styles/page-shell.css
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 落实活动列表与详情主卡结构"
```

## Task 5: 重构管理页、名单页与滑动修正体验

**Files:**
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/features/staff/components/AttendanceBatchActionBar.tsx`
- Modify: `web/src/features/staff/components/AttendanceRosterList.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
- Modify: `web/src/app/styles/staff-page.css`
- Test: `web/src/pages/staff-manage/StaffManagePage.actions.test.tsx`
- Test: `web/src/features/staff/components/AttendanceBatchActionBar.test.tsx`
- Test: `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- Test: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`

- [ ] **Step 1: Add failing UI assertions for the new staff bento layout**

```tsx
it("shows the code hero as the only primary card on the manage page", async () => {
  renderStaffManagePage();

  expect(await screen.findByText("483920")).toBeInTheDocument();
  expect(document.querySelectorAll(".staff-code-panel__card")).toHaveLength(1);
  expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
});
```

```tsx
it("renders normalized checked-out members as checked-in plus checked-out chips", async () => {
  renderActivityRosterPage();

  expect(await screen.findByText("异常成员")).toBeInTheDocument();
  expect(screen.getAllByText("已签到").length).toBeGreaterThan(0);
  expect(screen.getAllByText("已签退").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the staff roster tests to verify they fail**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/pages/staff-manage/StaffManagePage.actions.test.tsx src/features/staff/components/DynamicCodePanel.test.tsx src/features/staff/components/AttendanceBatchActionBar.test.tsx src/pages/activity-roster/ActivityRosterPage.test.tsx`  
Expected: FAIL because the old staff layout and row rendering still rely on `CellGroup` cards and raw roster flags.

- [ ] **Step 3: Refactor `DynamicCodePanel` and `StaffManagePage` around one hero card**

```tsx
<section className="staff-panel__rail">
  <ActivityMetaPanel ... />
  <section className="staff-code-panel__card">
    <DynamicCodeHero ... />
  </section>
  <section className="staff-panel__stats-strip">...</section>
  <section className="staff-panel__danger-zone">
    <BulkCheckoutButton ... />
  </section>
</section>
```

- [ ] **Step 4: Refactor roster rows and batch bar to use normalized state**

```tsx
function resolveSwipeActions(item: NormalizedRosterItem, onSingleAction: AttendanceRosterListProps["onSingleAction"]) {
  return [
    item.normalized_state === "not_checked"
      ? { className: "attendance-roster-list__action attendance-roster-list__action--checkin", onClick: () => void onSingleAction(item.user_id, "set_checked_in"), text: "设为已签到" }
      : { className: "attendance-roster-list__action attendance-roster-list__action--reset", onClick: () => void onSingleAction(item.user_id, "clear_checked_in"), text: "设为未签到" },
    item.normalized_state === "checked_out"
      ? { className: "attendance-roster-list__action attendance-roster-list__action--reset", onClick: () => void onSingleAction(item.user_id, "clear_checked_out"), text: "设为未签退" }
      : { className: "attendance-roster-list__action attendance-roster-list__action--checkout", onClick: () => void onSingleAction(item.user_id, "set_checked_out"), text: "设为已签退" }
  ];
}
```

```tsx
<section className="attendance-batch-action-bar attendance-batch-action-bar--bento">
  <div className="attendance-batch-action-bar__summary">...</div>
  <div className="attendance-batch-action-bar__action">...</div>
</section>
```

- [ ] **Step 5: Run the staff roster tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/pages/staff-manage/StaffManagePage.actions.test.tsx src/features/staff/components/DynamicCodePanel.test.tsx src/features/staff/components/AttendanceBatchActionBar.test.tsx src/pages/activity-roster/ActivityRosterPage.test.tsx`  
Expected: PASS with the normalized status and single-hero assertions green.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/pages/staff-manage/StaffManagePage.tsx \
  web/src/features/staff/components/DynamicCodePanel.tsx \
  web/src/features/staff/components/AttendanceBatchActionBar.tsx \
  web/src/features/staff/components/AttendanceRosterList.tsx \
  web/src/pages/activity-roster/ActivityRosterPage.tsx \
  web/src/app/styles/staff-page.css \
  web/src/pages/staff-manage/StaffManagePage.actions.test.tsx \
  web/src/features/staff/components/DynamicCodePanel.test.tsx \
  web/src/features/staff/components/AttendanceBatchActionBar.test.tsx \
  web/src/pages/activity-roster/ActivityRosterPage.test.tsx
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 重构管理与名单便当工作台"
```

## Task 6: 收口登录、签到、签退、我的页剩余页面

**Files:**
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/features/auth/components/AccountLoginForm.tsx`
- Modify: `web/src/pages/login/LoginPage.test.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/checkout/CheckoutPage.tsx`
- Modify: `web/src/features/attendance/components/AttendanceActionDetailSection.tsx`
- Modify: `web/src/features/attendance/components/AttendanceActionResultView.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.test.tsx`
- Modify: `web/src/pages/profile/ProfilePage.tsx`
- Modify: `web/src/pages/profile/ProfilePage.test.tsx`
- Modify: `web/src/app/styles/page-shell.css`

- [ ] **Step 1: Add the failing page-level bento assertions**

```tsx
it("renders the login form inside one bento main card and one action rail", () => {
  renderLoginPage();

  expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  expect(document.querySelectorAll(".account-login-form__card")).toHaveLength(1);
});
```

```tsx
it("renders the checkin detail block as one bento card before the code form", async () => {
  renderAttendancePage("/activities/act_101/checkin");

  expect(await screen.findByText("校园志愿活动")).toBeInTheDocument();
  expect(document.querySelectorAll(".attendance-action-detail__card")).toHaveLength(1);
});
```

```tsx
it("renders profile summary and logout action as separate bento blocks", () => {
  renderProfilePage();

  expect(document.querySelectorAll(".profile-page__card")).toHaveLength(1);
  expect(document.querySelectorAll(".profile-page__actions")).toHaveLength(1);
});
```

- [ ] **Step 2: Run the remaining page tests to verify they fail**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/pages/login/LoginPage.test.tsx src/pages/checkin/CheckinPage.test.tsx src/pages/profile/ProfilePage.test.tsx`  
Expected: FAIL because the form/result components still use old `CellGroup` shells and lack the new bento hooks.

- [ ] **Step 3: Refactor the inner page components to use one main card each**

```tsx
<div className="stack-form account-login-form">
  <section className="account-login-form__card">
    <Form ...>...</Form>
  </section>
  {errorMessage ? <InlineNotice message={errorMessage} /> : null}
</div>
```

```tsx
<>
  <section className="attendance-action-detail__card">...</section>
  {actionAvailable ? <CodeInput ... /> : <AppEmptyState ... />}
</>
```

```tsx
<MobilePage ...>
  <section className="profile-page__card">
    <CellGroup theme="card" title="账户信息">...</CellGroup>
  </section>
  <section className="profile-page__actions">
    <AppButton onClick={handleLogout}>退出登录</AppButton>
  </section>
</MobilePage>
```

- [ ] **Step 4: Run the remaining page tests to verify they pass**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- src/pages/login/LoginPage.test.tsx src/pages/checkin/CheckinPage.test.tsx src/pages/profile/ProfilePage.test.tsx`  
Expected: PASS with the new bento class hooks present.

- [ ] **Step 5: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add \
  web/src/pages/login/LoginPage.tsx \
  web/src/features/auth/components/AccountLoginForm.tsx \
  web/src/pages/login/LoginPage.test.tsx \
  web/src/pages/checkin/CheckinPage.tsx \
  web/src/pages/checkout/CheckoutPage.tsx \
  web/src/features/attendance/components/AttendanceActionDetailSection.tsx \
  web/src/features/attendance/components/AttendanceActionResultView.tsx \
  web/src/pages/checkin/CheckinPage.test.tsx \
  web/src/pages/profile/ProfilePage.tsx \
  web/src/pages/profile/ProfilePage.test.tsx \
  web/src/app/styles/page-shell.css
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 收口登录签到与个人页便当布局"
```

## Task 7: 运行完整回归验证并整理最终提交

**Files:**
- Modify: `web/src/...`（仅修复 Task 1-6 跑出来的真实回归）
- Test: `web/package.json` scripts only

- [ ] **Step 1: Run the full unit test suite**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test`  
Expected: PASS with `vitest --run` exit code `0`.

- [ ] **Step 2: Run ESLint**

Run: `cd /home/psx/app/wxapp-checkin/web && npm run lint`  
Expected: PASS with `--max-warnings 0`.

- [ ] **Step 3: Run the production build**

Run: `cd /home/psx/app/wxapp-checkin/web && npm run build`  
Expected: PASS with TypeScript noEmit check + Vite build success.

- [ ] **Step 4: Fix only real regressions surfaced by the three commands**

```ts
// 只修测试、lint、build 报出的真实问题：
// - 丢失 import
// - 断言与新 DOM 不一致
// - 未使用变量
// - 样式类名漂移
// 不额外插入新的视觉需求或重构。
```

- [ ] **Step 5: Re-run all three verification commands**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web && npm test
cd /home/psx/app/wxapp-checkin/web && npm run lint
cd /home/psx/app/wxapp-checkin/web && npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add web
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 完成便当布局与状态自愈重构"
```
