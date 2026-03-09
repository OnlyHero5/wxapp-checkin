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
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      <button className="primary-button" disabled={pending} onClick={() => void onSubmit()} type="button">
        {/* 登录态切换快时，按钮文案是唯一稳定的反馈入口。 */}
        {pending ? "登录中..." : "使用 Passkey 登录"}
      </button>
    </section>
  );
}
