import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityCard } from "../../features/activities/components/ActivityCard";
import { getActivities, type ActivitySummary } from "../../features/activities/api";
import { groupVisibleActivities } from "../../features/activities/view-model";
import { PasswordChangeRequiredError, SessionExpiredError } from "../../shared/http/errors";
import { isStaffSession } from "../../shared/session/session-store";
import { AppButton } from "../../shared/ui/AppButton";
import { InlineNotice } from "../../shared/ui/InlineNotice";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // 只认最后一次请求结果，避免手动重试时旧响应反写新状态。
  const requestVersionRef = useRef(0);

  const pageSize = 50;

  function mergeActivitiesById(previous: ActivitySummary[], incoming: ActivitySummary[]) {
    // 追加分页数据时做一次去重，避免并发刷新或后端数据变化导致重复渲染同一活动卡片。
    const map = new Map<string, ActivitySummary>();
    for (const item of previous) {
      map.set(item.activity_id, item);
    }
    for (const item of incoming) {
      map.set(item.activity_id, item);
    }
    return Array.from(map.values());
  }

  /**
   * 列表加载逻辑独立成函数，而不是直接写在 `useEffect` 里，
   * 是为了让“首次加载”和“手动重试”共用同一套行为。
   */
  async function loadFirstPage() {
    // 每次发起新请求都推进一个版本号，后返回的旧请求会被自动丢弃。
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    // 每次重新加载都把页面切回“加载中 + 无错误”的干净状态。
    setLoading(true);
    setLoadingMore(false);
    setErrorMessage("");
    setPage(1);
    setHasMore(false);

    try {
      const result = await getActivities({
        page: 1,
        page_size: pageSize
      });
      if (requestVersionRef.current === requestVersion) {
        setActivities(result.activities ?? []);
        setPage(result.page ?? 1);
        setHasMore(result.has_more ?? false);
      }
    } catch (error) {
      // 一旦后端确认会话失效，列表页不继续停留，直接回登录入口。
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      if (error instanceof PasswordChangeRequiredError) {
        navigate("/change-password");
        return;
      }
      if (requestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }

  async function loadMorePage() {
    if (loadingMore || loading || !hasMore) {
      return;
    }

    const targetPage = page + 1;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setLoadingMore(true);
    setErrorMessage("");

    try {
      const result = await getActivities({
        page: targetPage,
        page_size: pageSize
      });
      if (requestVersionRef.current === requestVersion) {
        setActivities((previous) => mergeActivitiesById(previous, result.activities ?? []));
        setPage(result.page ?? targetPage);
        setHasMore(result.has_more ?? false);
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
      if (requestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    // 首次进入列表页立即拉数据，不依赖用户手动触发。
    void loadFirstPage();
  }, []);

  const isStaff = isStaffSession();
  const eyebrow = isStaff ? "工作人员" : "普通用户";
  const description = isStaff
    ? "查看活动并进入管理页展示动态码、处理批量签退。"
    : "查看你当前可见的活动，并进入详情页继续签到或签退。";
  // 页面只渲染分组结果，不再自己关心筛选和排序细节。
  const sections = groupVisibleActivities(activities, {
    allowAll: isStaff
  });

  return (
    <MobilePage description={description} eyebrow={eyebrow} title="活动列表">
      {errorMessage ? (
        <section className="stack-form">
          <InlineNotice message={errorMessage} />
          <AppButton onClick={() => void loadFirstPage()} tone="secondary">
            重新加载
          </AppButton>
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
                <ActivityCard activity={activity} key={activity.activity_id} showManageEntry={isStaff} />
              ))}
            </div>
          ) : (
            <p className="empty-hint">{section.title}暂无活动。</p>
          )}
        </section>
      ))}
      {!loading && hasMore ? (
        <section className="stack-form">
          <AppButton disabled={loadingMore} loading={loadingMore} onClick={() => void loadMorePage()} tone="secondary">
            加载更多
          </AppButton>
        </section>
      ) : null}
    </MobilePage>
  );
}
