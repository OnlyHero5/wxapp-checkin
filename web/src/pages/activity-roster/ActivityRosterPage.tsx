import { useParams } from "react-router-dom";
import { buildActivityDetailPath } from "../../features/activities/api";
import { MobilePage } from "../../shared/ui/MobilePage";
import { PageBottomNav } from "../../shared/ui/PageBottomNav";

/**
 * 参会名单页先提供最小壳层，把 staff 的“进入名单”导航链路固定下来。
 *
 * 后续真正的名单查询、批量修正和刷新逻辑都在这个页面继续扩展；
 * 当前阶段故意不提前引入业务状态，避免把“路由是否打通”和“名单接口是否可用”混成同一个调试面。
 */
export function ActivityRosterPage() {
  const { activityId = "" } = useParams();

  return (
    <MobilePage
      bottomNav={(
        <PageBottomNav
          items={[
            { label: "活动列表", to: "/activities" },
            { label: "活动详情", to: buildActivityDetailPath(activityId) },
            { active: true, label: "参会名单", to: `/staff${buildActivityDetailPath(activityId)}/roster` }
          ]}
        />
      )}
      description="查看当前活动的已报名成员，并在后续执行签到签退修正。"
      eyebrow="工作人员"
      title="参会名单"
    >
      {/* 这里先保留最小文案占位，后续接入真实名单数据时仍沿用同一页面壳层。 */}
      <p>参会名单加载中...</p>
    </MobilePage>
  );
}
