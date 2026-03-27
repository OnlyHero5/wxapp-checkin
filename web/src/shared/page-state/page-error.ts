/**
 * 页面层最常见的错误翻译规则非常简单：
 * - 如果已经是带 message 的 Error，就直接复用；
 * - 否则退回当前页面自己的兜底文案。
 *
 * 统一放在共享层后，页面 hook 不再重复维护同一段判断。
 */
export function resolvePageErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
