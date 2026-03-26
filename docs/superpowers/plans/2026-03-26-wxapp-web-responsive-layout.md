# wxapp-checkin Web 响应式布局改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复普通用户页面在不同手机尺寸下的溢出问题，并让管理员动态六码页在同一 URL 下自动切换为电脑大屏展示模式。

**Architecture:** 继续复用现有 `MobilePage`、`StaffManagePage`、`DynamicCodePanel` 组件树，不新增路由、不新增后端接口，只通过稳定的布局钩子和 CSS 断点完成模式切换。普通用户页默认保持 `compact` 手机窄栏，管理员页单独切到 `showcase-auto`，再由 `base.css` 在 `1024px+` 下启用桌面展示布局。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、Testing Library、ESLint、TDesign Mobile React、全局 CSS

---

## 文件结构与职责

- `web/src/shared/ui/MobilePage.tsx`
  - 新增页面布局模式类型与 `data-page-layout` 钩子。
  - 保持现有 `tone`、`headerActions`、`bottomNav` 接口不变。
- `web/src/shared/ui/MobilePage.test.tsx`
  - 锁定默认 `compact` 布局与显式 `showcase-auto` 布局钩子。
- `web/src/pages/staff-manage/StaffManagePage.tsx`
  - 让管理员页显式使用 `layout="showcase-auto"`。
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`
  - 锁定管理员页会输出桌面展示布局钩子，避免回退成普通手机壳。
- `web/src/features/staff/components/DynamicCodePanel.tsx`
  - 输出桌面展示态需要的 hero / stats / actions / controls 结构钩子。
  - 在组件层补“当前签到码 / 当前签退码”的语义标签和无数据占位码。
- `web/src/features/staff/components/DynamicCodePanel.test.tsx`
  - 锁定展示区结构、占位码、次级操作区。
- `web/src/app/styles/base.css`
  - 收口手机端防溢出规则。
  - 在 `showcase-auto` 布局下为管理员页添加 `1024px+` 桌面展示样式。

## 任务拆分原则

- 不改接口层，不动 `features/staff/api.ts` 和 `features/activities/api.ts`。
- 不新增 React 布局状态机，断点切换全部交给 CSS。
- 先锁定 DOM 契约，再写最小实现，再做 CSS 展开，最后跑全量验证。
- 每个任务完成后立刻提交，保持 `wxapp-checkin` 子仓库工作区干净。

### Task 1: 给公共页面壳层补布局模式契约

**Files:**
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/shared/ui/MobilePage.test.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Tests:**
- `web/src/shared/ui/MobilePage.test.tsx`
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`

- [ ] **Step 1: 先写失败测试，锁定布局钩子**

在 `web/src/shared/ui/MobilePage.test.tsx` 改成下面这组断言，先让“默认 compact + 显式 showcase-auto”都落到测试里：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

describe("MobilePage", () => {
  it("defaults to compact layout while keeping the tone hook", () => {
    render(
      <MobilePage tone="checkin" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "compact");
  });

  it("writes the explicit showcase layout hook for responsive display pages", () => {
    render(
      <MobilePage layout="showcase-auto" tone="staff" title="活动管理">
        <p>当前动态码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "showcase-auto");
  });
});
```

然后在 `web/src/pages/staff-manage/StaffManagePage.test.tsx` 的首个用例里补一条管理员页断言：

```tsx
expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "showcase-auto");
```

- [ ] **Step 2: 运行测试，确认它们先失败**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test -- src/shared/ui/MobilePage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx
```

Expected:

- `MobilePage` 测试因为 `layout` prop 和 `data-page-layout` 不存在而失败。
- `StaffManagePage` 测试因为页面没有输出 `data-page-layout="showcase-auto"` 而失败。

- [ ] **Step 3: 写最小实现，让公共壳层具备布局模式**

先改 `web/src/shared/ui/MobilePage.tsx`，新增布局类型和属性，把 `main` 上的布局钩子落成真正的公共契约：

```tsx
import { ReactNode } from "react";
import type { VisualTone } from "./visual-tone";

export type MobilePageLayout = "compact" | "showcase-auto";

type MobilePageProps = {
  bottomNav?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  headerActions?: ReactNode;
  layout?: MobilePageLayout;
  tone?: VisualTone;
  title: string;
};

export function MobilePage({
  bottomNav,
  children,
  description,
  eyebrow,
  headerActions,
  layout = "compact",
  title,
  tone = "default"
}: MobilePageProps) {
  return (
    <main className="mobile-page" data-page-layout={layout} data-page-tone={tone}>
      <div className="mobile-page__shell">
        <section className="mobile-page__hero">
          <div className="mobile-page__hero-main">
            {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
            <header className="mobile-page__header">
              <h1>{title}</h1>
            </header>
            {description ? <p className="mobile-page__description">{description}</p> : null}
          </div>
          {headerActions ? <div className="mobile-page__hero-actions">{headerActions}</div> : null}
        </section>
        <section className="mobile-page__section">
          <div className="mobile-page__content">{children}</div>
        </section>
        {bottomNav ? <div className="mobile-page__bottom-nav">{bottomNav}</div> : null}
      </div>
    </main>
  );
}
```

再改 `web/src/pages/staff-manage/StaffManagePage.tsx`，只给管理员页显式接入展示模式：

```tsx
    <MobilePage
      eyebrow="工作人员"
      headerActions={(
        <Link className="text-link" to={buildActivityDetailPath(activityId)}>
          返回活动详情
        </Link>
      )}
      layout="showcase-auto"
      tone="staff"
      title="活动管理"
    >
```

同时在 `web/src/app/styles/base.css` 先补公共壳层和手机防溢出基础规则，避免后续桌面展示样式建立在脆弱基础上：

```css
.mobile-page__shell,
.mobile-page__hero,
.mobile-page__section,
.mobile-page__content,
.stack-form,
.activity-grid,
.activity-section,
.activity-meta-panel,
.activity-meta-panel__surface,
.code-input-shell,
.t-tabs,
.t-cell-group--card {
  min-width: 0;
}

@media (max-width: 359px) {
  .mobile-page {
    padding-left: 10px;
    padding-right: 10px;
  }

  .mobile-page__hero {
    gap: 12px;
    padding: 16px 14px 14px;
  }

  .mobile-page__section {
    padding: 16px 14px 18px;
  }

  .mobile-page__header h1 {
    font-size: 1.56rem;
  }

  .code-input {
    font-size: 1.5rem;
    letter-spacing: 0.22em;
  }

  .staff-code-panel__value {
    font-size: 2rem;
    letter-spacing: 0.18em;
  }
}

@media (min-width: 768px) {
  .mobile-page[data-page-layout="showcase-auto"] .mobile-page__shell {
    width: min(100%, 560px);
  }
}

@media (min-width: 1024px) {
  .mobile-page[data-page-layout="showcase-auto"] .mobile-page__shell {
    width: min(100%, 1120px);
  }
}
```

- [ ] **Step 4: 重新运行目标测试，确认布局契约生效**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test -- src/shared/ui/MobilePage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx
```

Expected:

- 2 个测试文件全部通过。
- 管理员页输出 `data-page-layout="showcase-auto"`。

- [ ] **Step 5: 提交这一层布局契约**

```bash
cd /home/psx/app/wxapp-checkin
git add \
  web/src/shared/ui/MobilePage.tsx \
  web/src/shared/ui/MobilePage.test.tsx \
  web/src/pages/staff-manage/StaffManagePage.tsx \
  web/src/pages/staff-manage/StaffManagePage.test.tsx \
  web/src/app/styles/base.css
git commit -m "fix(web): 标记管理员展示布局"
```

### Task 2: 给管理员动态码面板补桌面展示结构与样式

**Files:**
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Tests:**
- `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`

- [ ] **Step 1: 先写失败测试，锁定展示区结构和占位码**

把 `web/src/features/staff/components/DynamicCodePanel.test.tsx` 扩成下面两组用例：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicCodePanel } from "./DynamicCodePanel";

describe("DynamicCodePanel", () => {
  it("exposes stable staff tone hooks for the manage page", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("483920").closest(".staff-panel")).toHaveAttribute("data-panel-tone", "staff");
    expect(screen.getByText("483920").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.getByText("实时统计").closest(".staff-panel__stats")).toHaveAttribute("data-display-zone", "stats");
    expect(screen.getByRole("button", { name: "立即刷新" }).closest(".staff-panel__actions")).toHaveAttribute(
      "data-display-zone",
      "actions"
    );
    expect(screen.getByText("签到码").closest(".staff-panel__controls")).toHaveAttribute("data-display-zone", "controls");
  });

  it("renders a stable placeholder code and action label before the first code session arrives", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        actionType="checkout"
        codeSession={null}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("当前签退码")).toBeInTheDocument();
    expect(screen.getByText("------")).toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
  });
});
```

同时在 `web/src/pages/staff-manage/StaffManagePage.test.tsx` 首个用例里补一条，确保页面整合后还能拿到 hero 区：

```tsx
expect(screen.getByText("483920").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
```

- [ ] **Step 2: 运行测试，确认结构钩子还没实现**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test -- src/features/staff/components/DynamicCodePanel.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx
```

Expected:

- 因为 `data-display-zone`、`.staff-panel__stats`、`.staff-panel__actions`、`.staff-panel__controls` 尚不存在而失败。
- 因为组件没有输出“当前签退码”文案而失败。

- [ ] **Step 3: 写最小实现，补展示区结构和桌面样式**

先改 `web/src/features/staff/components/DynamicCodePanel.tsx`。第一处改动是在现有派生值附近新增动作标签：

```tsx
const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);
const actionLabel = actionType === "checkout" ? "当前签退码" : "当前签到码";
```

第二处改动是替换组件返回的 JSX，把结构重排成“控制区 / hero / 统计区 / 操作区”，但继续复用现有数据来源和刷新逻辑：

```tsx
return (
  <section className="staff-panel" data-panel-tone="staff">
    <div className="staff-panel__controls" data-display-zone="controls">
      <Tabs onChange={(value) => onActionChange(value as ActivityActionType)} value={actionType}>
        <TabPanel label="签到码" value="checkin" />
        <TabPanel label="签退码" value="checkout" />
      </Tabs>
    </div>

    <div className="staff-code-panel" data-display-zone="hero">
      <div className="staff-code-panel__glass">
        <p className="staff-code-panel__label">{actionLabel}</p>
        <p className="staff-code-panel__value">{codeSession?.code ?? "------"}</p>
        <p className="staff-code-panel__meta">
          {loading ? "动态码加载中..." : `剩余时间：${formatRemainingSeconds(remainingMs)}`}
        </p>
      </div>
    </div>

    <div className="staff-panel__stats" data-display-zone="stats">
      <CellGroup theme="card" title="实时统计">
        <Cell note={`${totalCheckedIn}`} title="签到人数" />
        <Cell note={`${checkoutCount}`} title="签退人数" />
        <Cell note={`${checkinCount}`} title="未签退人数" />
      </CellGroup>
    </div>

    <div className="staff-panel__actions" data-display-zone="actions">
      <AppButton accentTone="staff" onClick={onRefresh} tone="secondary">
        立即刷新
      </AppButton>
    </div>
  </section>
);
```

再改 `web/src/app/styles/base.css`，让手机态继续按当前阅读顺序堆叠，桌面态切成展示优先布局：

```css
.staff-panel,
.staff-panel__controls,
.staff-panel__stats,
.staff-panel__actions,
.staff-code-panel {
  min-width: 0;
}

.staff-code-panel__label {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--app-text-muted);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.staff-panel__stats,
.staff-panel__actions {
  display: grid;
}

@media (min-width: 1024px) {
  .mobile-page[data-page-layout="showcase-auto"] .mobile-page__hero {
    padding: 22px 24px 18px;
  }

  .mobile-page[data-page-layout="showcase-auto"] .mobile-page__section {
    padding: 24px 24px 28px;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-panel {
    grid-template-columns: minmax(0, 1fr) 280px;
    grid-template-areas:
      "tabs tabs"
      "hero hero"
      "stats actions";
    gap: 18px;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-panel__controls {
    grid-area: tabs;
    justify-self: center;
    width: min(100%, 360px);
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-code-panel {
    grid-area: hero;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-code-panel__glass {
    min-height: 360px;
    gap: 14px;
    padding: 42px 32px 36px;
    align-content: center;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-code-panel__value {
    font-size: clamp(4.8rem, 9vw, 7rem);
    letter-spacing: 0.34em;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-code-panel__meta {
    font-size: 1rem;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-panel__stats {
    grid-area: stats;
  }

  .mobile-page[data-page-layout="showcase-auto"] .staff-panel__actions {
    grid-area: actions;
    align-self: start;
  }
}
```

- [ ] **Step 4: 重新运行目标测试，确认桌面结构契约已就位**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test -- src/features/staff/components/DynamicCodePanel.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx
```

Expected:

- `DynamicCodePanel` 组件测试全部通过。
- `StaffManagePage` 页面测试仍通过，说明结构重排没有破坏现有加载、切换、倒计时逻辑。

- [ ] **Step 5: 提交管理员展示结构**

```bash
cd /home/psx/app/wxapp-checkin
git add \
  web/src/features/staff/components/DynamicCodePanel.tsx \
  web/src/features/staff/components/DynamicCodePanel.test.tsx \
  web/src/pages/staff-manage/StaffManagePage.test.tsx \
  web/src/app/styles/base.css
git commit -m "fix(web): 重排管理员大屏展示"
```

### Task 3: 做全量回归和断点验收

**Files:**
- Verify only: `web/src/shared/ui/MobilePage.tsx`
- Verify only: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Verify only: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Verify only: `web/src/app/styles/base.css`

**Tests:**
- `web/src/shared/ui/MobilePage.test.tsx`
- `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- `web/src/pages/checkin/CheckinPage.test.tsx`
- `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`

- [ ] **Step 1: 跑与本次改造直接相关的测试组**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test -- \
  src/shared/ui/MobilePage.test.tsx \
  src/features/staff/components/DynamicCodePanel.test.tsx \
  src/pages/staff-manage/StaffManagePage.test.tsx \
  src/pages/checkin/CheckinPage.test.tsx \
  src/pages/activity-detail/ActivityDetailPage.test.tsx
```

Expected:

- 上述 5 个测试文件全部 PASS。
- 签到页、签退页、活动详情页没有因为公共壳层布局钩子而回归。

- [ ] **Step 2: 跑全量单测**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm test
```

Expected:

- Vitest 全量通过，无新增失败。

- [ ] **Step 3: 跑 lint**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm run lint
```

Expected:

- ESLint 退出码为 `0`。
- 不出现新增未使用变量、错误类型断言或样式拼写问题。

- [ ] **Step 4: 跑 build**

Run:

```bash
cd /home/psx/app/wxapp-checkin/web
npm run build
```

Expected:

- TypeScript 检查通过。
- Vite 构建成功。

- [ ] **Step 5: 做手工断点巡检并确认工作区干净**

在可用的页面运行环境里打开以下 3 个路由，逐个检查 `320px`、`375px`、`430px`、`768px`、`1024px`、`1440px`：

```text
/activities
/activities/act_101/checkin
/staff/activities/act_101/manage
```

验收标准：

- 普通用户页在 `320px/375px/430px` 下不出现横向滚动。
- 普通用户页在 `1024px/1440px` 下仍保持窄栏居中，不被拉成桌面页。
- 管理员页在 `1024px/1440px` 下自动切成大屏展示态，动态六码位于页面中心且足够醒目。
- 管理员页仍能看到倒计时、三个统计数字、签到码/签退码切换和立即刷新按钮。

巡检结束后确认工作区状态：

```bash
cd /home/psx/app/wxapp-checkin
git status --short
```

Expected:

- `git status --short` 为空，说明 Task 1 和 Task 2 的提交已经把实现完全收口。

## 规格覆盖检查

- 普通用户页继续保持手机窄栏：Task 1 的 `MobilePage` 布局钩子和 CSS 断点负责。
- 手机端超窄屏防溢出：Task 1 的 `min-width: 0`、超窄屏 padding 与字号收敛负责。
- 管理员同一 URL 自动切大屏：Task 1 的 `layout="showcase-auto"` 接入和 Task 2 的桌面 CSS 负责。
- 电脑模式下的大号动态码、倒计时、三项统计、弱操作区：Task 2 负责。
- 回归验证：Task 3 负责。

## 执行备注

- 不要顺手重做 `MobilePage` 的视觉语言，只补布局和响应式边界。
- 不要把桌面展示态写成对所有页面生效的全局样式，必须挂在 `data-page-layout="showcase-auto"` 下。
- 不要为了桌面展示模式新增新的 React `useState` 或 `matchMedia` 状态机。
- `wxapp-checkin` 是唯一允许自动提交的子仓库；每次任务完成后都要立即提交，避免工作区脏状态累积。
