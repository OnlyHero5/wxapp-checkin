import { Fragment, ReactNode } from "react";
import { TabPanel, Tabs } from "tdesign-mobile-react";
import { AppEmptyState } from "../../../shared/ui/AppEmptyState";
import type { ActivitySummary } from "../api";

type ActivitySection = {
  items: ActivitySummary[];
  key: string;
  title: string;
};

type ActivitySectionsTabsProps = {
  activeSectionKey: string;
  onSectionChange: (value: string) => void;
  renderActivity: (activity: ActivitySummary) => ReactNode;
  sections: ActivitySection[];
};

export function ActivitySectionsTabs({
  activeSectionKey,
  onSectionChange,
  renderActivity,
  sections
}: ActivitySectionsTabsProps) {
  return (
    <Tabs
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
              <section className="activity-section" data-section-key={section.key}>
                {section.items.length > 0 ? (
                  <div className="activity-grid">
                    {section.items.map((activity) => (
                      <Fragment key={activity.activity_id}>{renderActivity(activity)}</Fragment>
                    ))}
                  </div>
                ) : (
                  <AppEmptyState message={`${section.title}暂无活动。`} />
            )}
          </section>
        </TabPanel>
      ))}
    </Tabs>
  );
}
