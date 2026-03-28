import { Search } from "tdesign-mobile-react";
import { ActivityCard } from "../../features/activities/components/ActivityCard";
import { ActivitySectionsTabs } from "../../features/activities/components/ActivitySectionsTabs";
import { AppLoadingState } from "../../shared/ui/AppLoadingState";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { AppButton } from "../../shared/ui/AppButton";
import { useActivitiesPageState } from "./use-activities-page-state";

/**
 * 活动列表页是普通用户进入业务态后的首页。
 *
 * 页面文件现在只保留渲染职责：
 * 1. 绑定组件库搜索框和分段 tabs
 * 2. 把 hook 给出的状态投影成页面结构
 * 3. 避免再把分页和并发保护细节混在 JSX 里
 */
export function ActivitiesPage() {
  const {
    activeSectionKey,
    applySearchKeyword,
    description,
    draftKeyword,
    errorMessage,
    eyebrow,
    hasMore,
    isStaff,
    loadMorePage,
    loading,
    loadingMore,
    pageTone,
    reloadPage,
    sections,
    setActiveSectionKey,
    setDraftKeyword
  } = useActivitiesPageState();

  return (
    <MobilePage description={description} eyebrow={eyebrow} title="活动列表" tone={pageTone}>
      <section className="stack-form">
        {/* 搜索框直接复用 TDesign `Search`，避免为了“多一个输入框”又回到手写壳层。 */}
        <Search
          action="搜索"
          className="activities-page__search"
          onActionClick={() => applySearchKeyword(draftKeyword)}
          onChange={(value) => setDraftKeyword(value)}
          onClear={() => applySearchKeyword("")}
          onSubmit={({ value }) => applySearchKeyword(value)}
          placeholder="搜索活动标题、地点、描述或ID"
          value={draftKeyword}
        />
      </section>
      {errorMessage ? (
        <section className="stack-form activities-page__feedback">
          <InlineNotice message={errorMessage} />
          <AppButton onClick={() => void reloadPage()} tone="secondary">
            重新加载
          </AppButton>
        </section>
      ) : null}
      {loading ? <AppLoadingState message="活动列表加载中..." /> : null}
      {!loading ? (
        <ActivitySectionsTabs
          activeSectionKey={activeSectionKey}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMorePage()}
          onSectionChange={setActiveSectionKey}
          renderActivity={(activity) => (
            <ActivityCard activity={activity} key={activity.activity_id} showManageEntry={isStaff} />
          )}
          sections={sections}
        />
      ) : null}
    </MobilePage>
  );
}
