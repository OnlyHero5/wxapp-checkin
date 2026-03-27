import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "tdesign-mobile-react";
import { ActivityCard } from "../../features/activities/components/ActivityCard";
import { ActivitySectionsTabs } from "../../features/activities/components/ActivitySectionsTabs";
import { getActivities, type ActivitySummary } from "../../features/activities/api";
import { groupVisibleActivities } from "../../features/activities/view-model";
import { SessionExpiredError } from "../../shared/http/errors";
import { isStaffSession } from "../../shared/session/session-store";
import { AppButton } from "../../shared/ui/AppButton";
import { AppLoadingState } from "../../shared/ui/AppLoadingState";
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
  const [draftKeyword, setDraftKeyword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState("ongoing");
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

  function normalizeSearchKeyword(value: string) {
    return `${value}`.trim();
  }

  const buildActivityListInput = useCallback((targetPage: number, activeKeyword: string) => {
    const normalizedKeyword = normalizeSearchKeyword(activeKeyword);
    return {
      ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
      page: targetPage,
      page_size: pageSize
    };
  }, [pageSize]);

  /**
   * 列表加载逻辑独立成函数，而不是直接写在 `useEffect` 里，
   * 是为了让“首次加载”和“手动重试”共用同一套行为。
   */
  const loadFirstPage = useCallback(async (activeKeyword: string) => {
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
      const result = await getActivities(buildActivityListInput(1, activeKeyword));
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
      if (requestVersionRef.current === requestVersion) {
        setErrorMessage(resolveErrorMessage(error));
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [buildActivityListInput, navigate]);

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
      const result = await getActivities(buildActivityListInput(targetPage, keyword));
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
    void loadFirstPage(keyword);
  }, [keyword, loadFirstPage]);

  function applySearchKeyword(nextKeyword: string) {
    const normalizedKeyword = normalizeSearchKeyword(nextKeyword);
    setDraftKeyword(normalizedKeyword);
    setKeyword(normalizedKeyword);
  }

  const isStaff = isStaffSession();
  const eyebrow = isStaff ? "工作人员" : "普通用户";
  const description = isStaff
    ? "查看活动并进入管理页展示动态码、处理批量签退。"
    : "查看你当前可见的活动，并进入详情页继续签到或签退。";
  // 列表页作为业务态首页，需要先在页面壳层层面区分 staff / user，
  // 后续卡片、按钮和摘要块再沿着这个基线逐步细化。
  const pageTone = isStaff ? "staff" : "brand";
  // 页面只渲染分组结果，不再自己关心筛选和排序细节。
  // 普通用户把“已完成”重命名成“历史活动”，让历史参加记录更容易被扫到。
  const sections = groupVisibleActivities(activities, {
    allowAll: isStaff
  }).map((section) => {
    if (!isStaff && section.key === "completed") {
      return {
        ...section,
        title: "历史活动"
      };
    }
    return section;
  });
  useEffect(() => {
    // 分组来源固定，但仍然只在当前 key 失效时回落，避免刷新后把用户手动切换的页签强行重置。
    if (!sections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(sections[0]?.key ?? "ongoing");
    }
  }, [activeSectionKey, sections]);

  return (
    <MobilePage description={description} eyebrow={eyebrow} title="活动列表" tone={pageTone}>
      <section className="stack-form">
        {/* 搜索框直接复用 TDesign `Search`，避免为了“多一个输入框”又回到手写壳层。 */}
        <Search
          action="搜索"
          onActionClick={() => applySearchKeyword(draftKeyword)}
          onChange={(value) => setDraftKeyword(value)}
          onClear={() => applySearchKeyword("")}
          onSubmit={({ value }) => applySearchKeyword(value)}
          placeholder="搜索活动标题、地点、描述或ID"
          value={draftKeyword}
        />
      </section>
      {errorMessage ? (
        <section className="stack-form">
          <InlineNotice message={errorMessage} />
          <AppButton onClick={() => void loadFirstPage(keyword)} tone="secondary">
            重新加载
          </AppButton>
        </section>
      ) : null}
      {loading ? <AppLoadingState message="活动列表加载中..." /> : null}
      {!loading ? (
        <ActivitySectionsTabs
          activeSectionKey={activeSectionKey}
          onSectionChange={setActiveSectionKey}
          renderActivity={(activity) => (
            <ActivityCard activity={activity} key={activity.activity_id} showManageEntry={isStaff} />
          )}
          sections={sections}
        />
      ) : null}
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
