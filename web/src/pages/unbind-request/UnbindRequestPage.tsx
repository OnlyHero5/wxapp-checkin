import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUnbindReview } from "../../features/staff/api";
import { SessionExpiredError } from "../../shared/http/errors";
import { AppButton } from "../../shared/ui/AppButton";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";

function normalizeText(value: string) {
  return value.trim();
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "解绑申请提交失败，请稍后重试。";
}

/**
 * 普通用户解绑申请页只负责“发起申请”，不承担审核结果展示。
 *
 * 这页的设计刻意保持轻量：
 * - 当前浏览器为什么要解绑
 * - 新设备提示是什么
 * - 提交后回到活动列表等待管理员处理
 *
 * 这样可以避免还没做用户中心时，把解绑链路拆进多个业务页里四处漂移。
 */
export function UnbindRequestPage() {
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [requestedNewBindingHint, setRequestedNewBindingHint] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);

  const canSubmit = !!normalizeText(reason) && !pending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setPending(true);
    setErrorMessage("");

    try {
      await createUnbindReview({
        reason: normalizeText(reason),
        requested_new_binding_hint: normalizeText(requestedNewBindingHint)
      });
      navigate("/activities");
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <MobilePage eyebrow="普通用户" title="解绑申请">
      <p>如果你已更换手机或浏览器，请提交解绑申请，等待工作人员审核后再重新绑定。</p>
      <form className="stack-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>解绑原因</span>
          <textarea
            aria-label="解绑原因"
            onChange={(event) => setReason(event.target.value)}
            placeholder="例如：更换手机、旧设备损坏"
            rows={4}
            value={reason}
          />
        </label>
        <label className="field">
          <span>新设备说明</span>
          <input
            aria-label="新设备说明"
            onChange={(event) => setRequestedNewBindingHint(event.target.value)}
            placeholder="例如：iPhone 16 / Android Chrome"
            value={requestedNewBindingHint}
          />
        </label>
        {errorMessage ? <InlineNotice message={errorMessage} /> : null}
        <AppButton disabled={!canSubmit} loading={pending} type="submit">
          提交解绑申请
        </AppButton>
      </form>
    </MobilePage>
  );
}
