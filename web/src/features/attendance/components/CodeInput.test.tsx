import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "./CodeInput";

describe("CodeInput", () => {
  it("uses input props that keep dynamic code semantics stable", () => {
    /**
     * 动态码不是普通数字：
     * - 允许前导 0
     * - 需要移动端数字键盘
     * - 适合浏览器一次性验证码自动填充
     */
    render(
      <CodeInput
        label="签到码"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitText="提交"
        value=""
      />
    );

    const input = screen.getByRole("textbox");

    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("name", "dynamic_code");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("spellcheck", "false");
  });
});
