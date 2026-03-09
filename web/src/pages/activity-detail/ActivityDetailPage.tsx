import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getActivityDetail, type ActivityDetail } from "../../features/activities/api";
import {
  resolveCanCheckin,
  resolveCanCheckout,
  resolveJoinStatus,
  resolveProgressStatus
} from "../../features/activities/view-model";
import { SessionExpiredError } from "../../shared/http/errors";
import { MobilePage } from "../../shared/ui/MobilePage";

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
  const navigate = useNavigate();
  // 详情页完全依赖路径参数里的 activityId 决定要查询哪条活动。
  const { activityId = "" } = useParams();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // 用 active 标记避免组件卸载后异步请求仍然回写 state。
    let active = true;

    /**
     * 详情加载没有抽到共享 hook，是因为当前阶段它只服务这个页面，
     * 且错误处理与跳转策略仍然高度贴近页面语义。
     * 如果后续 staff 管理页也要复用，再抽共享 hook 更合适。
     */
    async function loadDetail() {
      setErrorMessage("");

      try {
        const result = await getActivityDetail(activityId);
        if (active) {
          setDetail(result);
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          navigate("/login");
          return;
        }
        if (active) {
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
      <MobilePage eyebrow="活动详情" title="活动详情">
        {errorMessage ? <p className="form-error">{errorMessage}</p> : <p>活动详情加载中...</p>}
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

  return (
    <MobilePage eyebrow="活动详情" title={detail.activity_title}>
      <section className="detail-panel">
        {/* 详情页的字段顺序按“先确认活动，再确认自己状态，再确认统计”组织。 */}
        {detail.description ? <p>{detail.description}</p> : null}
        {detail.start_time ? <p>时间：{detail.start_time}</p> : null}
        {detail.location ? <p>地点：{detail.location}</p> : null}
        <p>当前状态：{progressStatus === "completed" ? "已完成" : "进行中"}</p>
        <p>我的状态：{resolveJoinStatus(detail)}</p>
        <p>
          统计：签到 {detail.checkin_count ?? 0} / 签退 {detail.checkout_count ?? 0}
        </p>
      </section>
      <section className="stack-form">
        {/* 签到和签退入口互相独立显示，避免用一个按钮切来切去造成误操作。 */}
        {canCheckin ? (
          <Link className="primary-link" to={`/activities/${detail.activity_id}/checkin`}>
            去签到
          </Link>
        ) : null}
        {canCheckout ? (
          <Link className="secondary-link" to={`/activities/${detail.activity_id}/checkout`}>
            去签退
          </Link>
        ) : null}
        {/* 两个动作都不可用时，也明确告诉用户是“当前状态不允许”，而不是页面坏了。 */}
        {!canCheckin && !canCheckout ? <p>当前状态下暂无可执行动作。</p> : null}
      </section>
    </MobilePage>
  );
}
