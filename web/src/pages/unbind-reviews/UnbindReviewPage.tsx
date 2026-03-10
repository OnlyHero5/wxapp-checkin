import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TabPanel, Tabs } from "tdesign-mobile-react";
import { UnbindReviewList } from "../../features/review/components/UnbindReviewList";
import {
  approveUnbindReview,
  getUnbindReviews,
  rejectUnbindReview,
  type UnbindReviewItem,
  type UnbindReviewStatus
} from "../../features/staff/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "解绑审核列表加载失败，请稍后重试。";
}

/**
 * 审核页负责：
 * 1. 按状态切换列表
 * 2. 承接 approve / reject
 * 3. 动作完成后刷新当前状态下的数据
 */
export function UnbindReviewPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<UnbindReviewStatus>("pending");
  const [items, setItems] = useState<UnbindReviewItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingReviewId, setPendingReviewId] = useState("");

  async function loadItems(nextStatus: UnbindReviewStatus) {
    setErrorMessage("");

    try {
      const result = await getUnbindReviews({
        status: nextStatus
      });
      setItems(result.items ?? []);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadItems(status);
  }, [status, navigate]);

  async function handleApprove(reviewId: string, input: { review_comment: string }) {
    setPendingReviewId(reviewId);

    try {
      await approveUnbindReview(reviewId, input);
      await loadItems(status);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPendingReviewId("");
    }
  }

  async function handleReject(reviewId: string, input: { review_comment: string }) {
    setPendingReviewId(reviewId);

    try {
      await rejectUnbindReview(reviewId, input);
      await loadItems(status);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPendingReviewId("");
    }
  }

  return (
    <MobilePage eyebrow="工作人员" title="解绑审核">
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      <Tabs onChange={(value) => setStatus(value as UnbindReviewStatus)} value={status}>
        <TabPanel label="待审核" value="pending" />
        <TabPanel label="已通过" value="approved" />
        <TabPanel label="已拒绝" value="rejected" />
      </Tabs>
      <UnbindReviewList
        items={items}
        onApprove={handleApprove}
        onReject={handleReject}
        pendingReviewId={pendingReviewId}
      />
    </MobilePage>
  );
}
