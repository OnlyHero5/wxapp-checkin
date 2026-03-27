import { Cell, CellGroup } from "tdesign-mobile-react";

export type ActivityMetaDetailRow = {
  label: string;
  value: string;
};

type ActivityMetaContentGroupsProps = {
  counts?: {
    expected?: number;
    checkin?: number;
    checkout?: number;
  };
  rows: ActivityMetaDetailRow[];
};

function resolveMetrics(counts?: ActivityMetaContentGroupsProps["counts"]) {
  if (!counts) {
    return [];
  }

  const expectedCount = counts.expected;
  const checkinCount = counts.checkin ?? 0;
  const checkoutCount = counts.checkout ?? 0;
  const totalCheckedIn = checkinCount + checkoutCount;

  return [
    expectedCount != null
      ? {
          label: "应到",
          value: `${expectedCount}`
        }
      : null,
    {
      label: "累计签到",
      value: `${totalCheckedIn}`
    },
    {
      label: "已签退",
      value: `${checkoutCount}`
    },
    {
      label: "未签退",
      value: `${checkinCount}`
    }
  ].filter(Boolean) as ActivityMetaDetailRow[];
}

export function ActivityMetaContentGroups({ counts, rows }: ActivityMetaContentGroupsProps) {
  const metrics = resolveMetrics(counts);

  return (
    <>
      {rows.length > 0 ? (
        <CellGroup theme="card" title="活动信息">
          {rows.map((row) => (
            <Cell key={row.label} align="top" note={row.value} title={row.label} />
          ))}
        </CellGroup>
      ) : null}
      {metrics.length > 0 ? (
        <CellGroup theme="card" title="统计">
          {metrics.map((metric) => (
            <Cell key={metric.label} note={metric.value} title={metric.label} />
          ))}
        </CellGroup>
      ) : null}
    </>
  );
}
