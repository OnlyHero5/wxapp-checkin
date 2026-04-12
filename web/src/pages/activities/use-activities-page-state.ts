import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActivities, type ActivitySummary } from "../../features/activities/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { createRequestGuard } from "../../shared/page-state/request-guard";
import { isStaffSession } from "../../shared/session/session-store";
import {
  buildVisibleSections,
  mergeActivitiesById,
  normalizeSearchKeyword,
  resolveActivitiesErrorMessage,
  resolveActivitiesPageCopy
} from "./activities-page-helpers";

/**
 * 活动列表页的状态和请求流程都集中在这个 hook。
 *
 * 这样做有两个维护收益：
 * 1. 页面文件只保留“渲染什么”，不再混进分页和并发保护细节；
 * 2. 后续如果列表再接筛选项或 URL 同步，也只改这一层。
 */

export function useActivitiesPageState() {
  const navigate = useNavigate();
  const isStaff = isStaffSession();
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
  const requestGuardRef = useRef(createRequestGuard());

  const pageSize = 50;
  const { description, eyebrow, pageTone } = resolveActivitiesPageCopy(isStaff);

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
    const requestVersion = requestGuardRef.current.beginRequest();
    // 每次重新加载都把页面切回“加载中 + 无错误”的干净状态。
    setLoading(true);
    setLoadingMore(false);
    setErrorMessage("");
    setPage(1);
    setHasMore(false);

    try {
      const result = await getActivities(buildActivityListInput(1, activeKeyword));
      if (requestGuardRef.current.isCurrent(requestVersion)) {
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
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setErrorMessage(resolveActivitiesErrorMessage(error));
      }
    } finally {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setLoading(false);
      }
    }
  }, [buildActivityListInput, navigate]);

  const loadMorePage = useCallback(async () => {
    if (loadingMore || loading || !hasMore) {
      return;
    }

    const targetPage = page + 1;
    const requestVersion = requestGuardRef.current.beginRequest();
    setLoadingMore(true);
    setErrorMessage("");

    try {
      const result = await getActivities(buildActivityListInput(targetPage, keyword));
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setActivities((previous) => mergeActivitiesById(previous, result.activities ?? []));
        setPage(result.page ?? targetPage);
        setHasMore(result.has_more ?? false);
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setErrorMessage(resolveActivitiesErrorMessage(error));
      }
    } finally {
      if (requestGuardRef.current.isCurrent(requestVersion)) {
        setLoadingMore(false);
      }
    }
  }, [buildActivityListInput, hasMore, keyword, loading, loadingMore, navigate, page]);

  useEffect(() => {
    // 首次进入列表页立即拉数据，不依赖用户手动触发。
    void loadFirstPage(keyword);
  }, [keyword, loadFirstPage]);

  function applySearchKeyword(nextKeyword: string) {
    const normalizedKeyword = normalizeSearchKeyword(nextKeyword);
    setDraftKeyword(normalizedKeyword);
    setKeyword(normalizedKeyword);
  }

  const sections = buildVisibleSections(activities, isStaff);
  const activeSection = sections.find((section) => section.key === activeSectionKey) ?? sections[0];

  useEffect(() => {
    // 分组来源固定，但仍然只在当前 key 失效时回落，避免刷新后把用户手动切换的页签强行重置。
    if (!sections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(sections[0]?.key ?? "ongoing");
    }
  }, [activeSectionKey, sections]);

  const reloadPage = useCallback(async () => {
    await loadFirstPage(keyword);
  }, [keyword, loadFirstPage]);

  return {
    activeSectionKey,
    applySearchKeyword,
    description,
    draftKeyword,
    errorMessage,
    eyebrow,
    activeSectionCount: activeSection?.items.length ?? 0,
    activeSectionTitle: activeSection?.title ?? "活动",
    hasMore,
    isStaff,
    keyword,
    loadFirstPage,
    loadMorePage,
    loading,
    loadingMore,
    pageTone,
    reloadPage,
    sections,
    setActiveSectionKey,
    setDraftKeyword
  };
}
