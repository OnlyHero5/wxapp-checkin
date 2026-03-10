import { useState } from "react";
import { Cell, CellGroup, Dialog } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";
import type { UnbindReviewItem } from "../../staff/api";

type ReviewActionState = {
  action: "approve" | "reject";
  review: UnbindReviewItem;
} | null;

type UnbindReviewListProps = {
  items: UnbindReviewItem[];
  pendingReviewId?: string;
  onApprove: (reviewId: string, input: { review_comment: string }) => Promise<void> | void;
  onReject: (reviewId: string, input: { review_comment: string }) => Promise<void> | void;
};

function resolveActionComment(action: "approve" | "reject") {
  return action === "approve" ? "确认已更换设备" : "信息不足，驳回";
}

function resolveActionTitle(action: "approve" | "reject") {
  return action === "approve" ? "确认通过" : "确认拒绝";
}

/**
 * 审核列表负责“列出谁、因为什么、现在是什么状态、我能做什么”，
 * 页面本身只保留筛选和刷新责任。
 */
export function UnbindReviewList({
  items,
  pendingReviewId,
  onApprove,
  onReject
}: UnbindReviewListProps) {
  const [actionState, setActionState] = useState<ReviewActionState>(null);

  async function handleConfirm() {
    if (!actionState) {
      return;
    }

    const payload = {
      review_comment: resolveActionComment(actionState.action)
    };
    if (actionState.action === "approve") {
      await onApprove(actionState.review.review_id, payload);
    } else {
      await onReject(actionState.review.review_id, payload);
    }
    setActionState(null);
  }

  if (items.length === 0) {
    return <p className="empty-hint">当前状态暂无记录。</p>;
  }

  return (
    <>
      <div className="review-list">
        {items.map((item) => {
          const isPending = item.status === "pending";
          const isSubmitting = pendingReviewId === item.review_id;

          return (
            <CellGroup key={item.review_id} theme="card" title={item.user_name ?? "待审核用户"}>
              <Cell note={item.student_id ?? "-"} title="学号" />
              <Cell note={item.status} title="状态" />
              <Cell description={item.reason ?? "未填写"} title="申请原因" />
              {item.requested_new_binding_hint ? <Cell description={item.requested_new_binding_hint} title="新设备提示" /> : null}
              {item.review_comment ? <Cell description={item.review_comment} title="审核备注" /> : null}
              {isPending ? (
                <div className="review-list__actions">
                  {/* 审核动作继续下沉到列表组件，避免页面层对单条记录做过多状态管理。 */}
                  <AppButton disabled={isSubmitting} onClick={() => setActionState({ action: "approve", review: item })}>
                    通过
                  </AppButton>
                  <AppButton disabled={isSubmitting} onClick={() => setActionState({ action: "reject", review: item })} tone="secondary">
                    拒绝
                  </AppButton>
                </div>
              ) : null}
            </CellGroup>
          );
        })}
      </div>
      <Dialog
        cancelBtn="取消"
        confirmBtn={actionState ? resolveActionTitle(actionState.action) : null}
        content={actionState ? `${actionState.review.user_name ?? "该用户"}的解绑申请将进入“${actionState.action === "approve" ? "通过" : "拒绝"}”状态。` : ""}
        onCancel={() => setActionState(null)}
        onClose={() => setActionState(null)}
        onConfirm={() => void handleConfirm()}
        title={actionState ? resolveActionTitle(actionState.action) : "解绑审核"}
        visible={!!actionState}
      />
    </>
  );
}
