import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityCard } from "../../features/activities/components/ActivityCard";
import { getActivities, type ActivitySummary } from "../../features/activities/api";
import { groupVisibleActivities } from "../../features/activities/view-model";
import { SessionExpiredError } from "../../shared/http/errors";
import { MobilePage } from "../../shared/ui/MobilePage";

/**
 * 活动列表页是普通用户进入业务态后的首页。
 *
 * 这页最重要的责任不是“展示所有字段”，而是：
 * 1. 让用户一眼分清正在进行和已完成
 * 2. 让用户知道自己当前和活动的关系
 * 3. 把用户自然地引导到详情页继续操作
 */
function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "活动列表加载失败，请稍后重试。";
}

export function ActivitiesPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  /**
   * 列表加载逻辑独立成函数，而不是直接写在 `useEffect` 里，
   * 是为了让“首次加载”和“手动重试”共用同一套行为。
   */
  async function loadActivities() {
    // 每次重新加载都把页面切回“加载中 + 无错误”的干净状态。
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await getActivities();
      setActivities(result.activities ?? []);
    } catch (error) {
      // 一旦后端确认会话失效，列表页不继续停留，直接回登录入口。
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 首次进入列表页立即拉数据，不依赖用户手动触发。
    void loadActivities();
  }, []);

  // 页面只渲染分组结果，不再自己关心筛选和排序细节。
  const sections = groupVisibleActivities(activities);

  return (
    <MobilePage eyebrow="普通用户" title="活动列表">
      <p>查看你当前可见的活动，并进入详情页继续签到或签退。</p>
      {errorMessage ? (
        <section className="stack-form">
          <p className="form-error">{errorMessage}</p>
          <button className="secondary-button" onClick={() => void loadActivities()} type="button">
            重新加载
          </button>
        </section>
      ) : null}
      {loading ? <p>活动列表加载中...</p> : null}
      {sections.map((section) => (
        <section className="activity-section" key={section.key}>
          <header className="activity-section__header">
            {/* 标题来自统一 view-model，页面层不再自行判断该放什么文案。 */}
            <h2>{section.title}</h2>
          </header>
          {section.items.length > 0 ? (
            <div className="activity-grid">
              {section.items.map((activity) => (
                // 卡片组件负责单活动展示，列表页只保留分组与布局职责。
                <ActivityCard activity={activity} key={activity.activity_id} />
              ))}
            </div>
          ) : (
            <p className="empty-hint">{section.title}暂无活动。</p>
          )}
        </section>
      ))}
    </MobilePage>
  );
}
