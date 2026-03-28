import { Fragment, ReactNode } from "react";
import { List, TabPanel, Tabs } from "tdesign-mobile-react";
import { AppEmptyState } from "../../../shared/ui/AppEmptyState";
import type { ActivitySummary } from "../api";

type ActivitySection = {
  items: ActivitySummary[];
  key: string;
  title: string;
};

type ActivitySectionsTabsProps = {
  activeSectionKey: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSectionChange: (value: string) => void;
  renderActivity: (activity: ActivitySummary) => ReactNode;
  sections: ActivitySection[];
};

export function ActivitySectionsTabs({
  activeSectionKey,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onSectionChange,
  renderActivity,
  sections
}: ActivitySectionsTabsProps) {
  return (
    <Tabs
      className="activity-sections-tabs"
      onChange={(value) => onSectionChange(`${value}`)}
      spaceEvenly
      sticky
      stickyProps={{
        offsetTop: 12,
        zIndex: 2
      }}
      theme="line"
      value={activeSectionKey}
    >
      {sections.map((section) => (
        <TabPanel destroyOnHide={false} key={section.key} label={section.title} value={section.key}>
          <section className="activity-section activity-sections-tabs__panel" data-section-key={section.key}>
            <List
              asyncLoading={section.key === activeSectionKey && hasMore ? (loadingMore ? "loading" : "load-more") : undefined}
              className="activity-sections-tabs__list"
              onLoadMore={section.key === activeSectionKey ? onLoadMore : undefined}
            >
              {section.items.length > 0 ? (
                <div className="activity-grid">
                  {section.items.map((activity) => (
                    <Fragment key={activity.activity_id}>{renderActivity(activity)}</Fragment>
                  ))}
                </div>
              ) : (
                <AppEmptyState message={`${section.title}暂无活动。`} />
              )}
            </List>
          </section>
        </TabPanel>
      ))}
    </Tabs>
  );
}
