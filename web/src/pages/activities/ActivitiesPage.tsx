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
    activeSectionCount,
    activeSectionTitle,
    applySearchKeyword,
    description,
    draftKeyword,
    errorMessage,
    eyebrow,
    hasMore,
    isStaff,
    keyword,
    loadMorePage,
    loading,
    loadingMore,
    pageTone,
    reloadPage,
    sections,
    setActiveSectionKey,
    setDraftKeyword
  } = useActivitiesPageState();
  // 列表页只负责把活动数据投影成“每行一张主卡”。
  // 具体的单卡结构留给 `ActivityCard`，这里不要再额外包第二层视觉容器。
  const renderActivityCard = (activity: Parameters<typeof ActivityCard>[0]["activity"]) => (
    <ActivityCard activity={activity} key={activity.activity_id} showManageEntry={isStaff} />
  );

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
      <section aria-label="当前筛选结果" className="activities-page__summary">
        <div className="activities-page__summary-copy">
          <p className="activities-page__summary-label">当前分组</p>
          <h2 className="activities-page__summary-title">{activeSectionTitle}</h2>
          <p className="activities-page__summary-description">
            {keyword ? `已按“${keyword}”筛选，共 ${activeSectionCount} 场活动。` : `共 ${activeSectionCount} 场活动`}
          </p>
        </div>
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
          renderActivity={renderActivityCard}
          sections={sections}
        />
      ) : null}
    </MobilePage>
  );
}
