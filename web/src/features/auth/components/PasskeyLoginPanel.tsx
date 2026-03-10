import { AppButton } from "../../../shared/ui/AppButton";
import { InlineNotice } from "../../../shared/ui/InlineNotice";

/**
 * 登录面板本身不关心 challenge、assertion 或错误码细节。
 * 它只负责：
 * 1. 告知当前环境支持 Passkey
 * 2. 渲染错误提示
 * 3. 提供一个明确的“开始登录”按钮
 */
type PasskeyLoginPanelProps = {
  errorMessage?: string;
  onSubmit: () => Promise<void> | void;
  pending?: boolean;
};

export function PasskeyLoginPanel({
  errorMessage,
  onSubmit,
  pending = false
}: PasskeyLoginPanelProps) {
  return (
    <section className="stack-form">
      {/* 这段说明是为了减少用户对“为什么没有账号密码框”的疑惑。 */}
      <p>当前浏览器已满足 Passkey 基线，可以直接完成身份验证并进入活动页。</p>
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      <AppButton loading={pending} onClick={() => void onSubmit()}>
        使用 Passkey 登录
      </AppButton>
    </section>
  );
}
