import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  buildActivityActionPath,
  buildActivityDetailPath,
  buildActivityManagePath,
  buildActivityRosterPath,
  getActivityDetail,
  type ActivityDetail
} from "../../features/activities/api";
import {
  resolveCanCheckin,
  resolveCanCheckout,
  resolveJoinStatus,
  resolveProgressStatus
} from "../../features/activities/view-model";
import { PasswordChangeRequiredError, SessionExpiredError } from "../../shared/http/errors";
import { isStaffSession } from "../../shared/session/session-store";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { AppButton } from "../../shared/ui/AppButton";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { PageBottomNav } from "../../shared/ui/PageBottomNav";
import { StatusTag } from "../../shared/ui/StatusTag";

/**
 * 详情页是普通用户动作决策的“闸门页”。
 *
 * 列表页不直接暴露签到/签退按钮，
 * 就是为了把最终是否能执行动作的判断集中在这里。
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "活动详情加载失败，请稍后重试。";
}

export function ActivityDetailPage() {
  const { activityId = "" } = useParams();

  // 路由参数变化时强制 remount，确保上一条活动的 state 不会漏进下一条活动。
  return <ActivityDetailPageContent activityId={activityId} key={activityId} />;
}

type ActivityDetailPageContentProps = {
  activityId: string;
};

function ActivityDetailPageContent({ activityId }: ActivityDetailPageContentProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // 详情页可能因为快速切路由或重试出现响应乱序，因此只接收最新版本。
  const requestVersionRef = useRef(0);

  useEffect(() => {
    // 用 active 标记避免组件卸载后异步请求仍然回写 state。
    let active = true;
    // 版本号和 active 配合使用：前者防乱序，后者防卸载后回写。
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    /**
     * 详情加载没有抽到共享 hook，是因为当前阶段它只服务这个页面，
     * 且错误处理与跳转策略仍然高度贴近页面语义。
     * 如果后续 staff 管理页也要复用，再抽共享 hook 更合适。
     */
    async function loadDetail() {
      setErrorMessage("");
      setDetail(null);

      try {
        const result = await getActivityDetail(activityId);
        if (active && requestVersionRef.current === requestVersion) {
          setDetail(result);
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          navigate("/login");
          return;
        }
        if (error instanceof PasswordChangeRequiredError) {
          navigate("/change-password");
          return;
        }
        if (active && requestVersionRef.current === requestVersion) {
          setErrorMessage(resolveErrorMessage(error));
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [activityId, navigate]);

  // 详情未加载完成前，也要保证页面结构稳定，并给用户一个返回入口。
  if (!detail) {
    return (
      <MobilePage
        bottomNav={(
          <PageBottomNav
            items={[
              { label: "活动列表", to: "/activities" },
              { active: true, label: "活动详情", to: buildActivityDetailPath(activityId) }
            ]}
          />
        )}
        eyebrow="活动详情"
        title="活动详情"
      >
        {errorMessage ? <InlineNotice message={errorMessage} /> : <p>活动详情加载中...</p>}
        <Link className="text-link" to="/activities">
          返回活动列表
        </Link>
      </MobilePage>
    );
  }

  // 两个动作的最终可执行性统一通过 view-model 推导。
  const progressStatus = resolveProgressStatus(detail);
  const canCheckin = resolveCanCheckin(detail);
  const canCheckout = resolveCanCheckout(detail);
  const isStaff = isStaffSession();

  return (
    <MobilePage
      bottomNav={(
        <PageBottomNav
          items={[
            { label: "活动列表", to: "/activities" },
            { active: true, label: "活动详情", to: buildActivityDetailPath(detail.activity_id) }
          ]}
        />
      )}
      description={isStaff ? "查看活动状态，并进入管理页展示动态码和批量操作。" : "先确认活动状态，再继续签到或签退。"}
      eyebrow="活动详情"
      title={detail.activity_title}
    >
      <ActivityMetaPanel
        checkinTimeText={!isStaff ? detail.my_checkin_time : undefined}
        counts={isStaff ? {
          checkin: detail.checkin_count,
          checkout: detail.checkout_count
        } : undefined}
        checkoutTimeText={!isStaff ? detail.my_checkout_time : undefined}
        description={detail.description}
        joinStatusText={resolveJoinStatus(detail)}
        locationText={detail.location}
        progressText={progressStatus === "completed" ? "已完成" : "进行中"}
        statusSlot={<StatusTag status={progressStatus} />}
        subtitle={detail.activity_type}
        timeText={detail.start_time}
        title={detail.activity_title}
        titleAs="p"
      />
      <section className="stack-form detail-actions">
        {isStaff ? (
          <>
            {/* staff 先分流到“发码管理”和“名单修正”两个入口，避免在单页里混放两类高频操作。 */}
            <AppButton onClick={() => navigate(buildActivityManagePath(detail.activity_id))}>进入管理</AppButton>
            <AppButton onClick={() => navigate(buildActivityRosterPath(detail.activity_id))} tone="secondary">
              参会名单
            </AppButton>
          </>
        ) : null}
        {/* 签到和签退入口互相独立显示，避免用一个按钮切来切去造成误操作。 */}
        {!isStaff && canCheckin ? (
          <AppButton onClick={() => navigate(buildActivityActionPath(detail.activity_id, "checkin"))}>去签到</AppButton>
        ) : null}
        {!isStaff && canCheckout ? (
          <AppButton onClick={() => navigate(buildActivityActionPath(detail.activity_id, "checkout"))} tone="secondary">
            去签退
          </AppButton>
        ) : null}
        {/* 两个动作都不可用时，也明确告诉用户是“当前状态不允许”，而不是页面坏了。 */}
        {!isStaff && !canCheckin && !canCheckout ? <p>当前状态下暂无可执行动作。</p> : null}
      </section>
    </MobilePage>
  );
}
