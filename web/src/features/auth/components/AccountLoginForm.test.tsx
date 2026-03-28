import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountLoginForm } from "./AccountLoginForm";

describe("AccountLoginForm", () => {
  it("keeps browser autofill semantics on top of the component library", () => {
    render(<AccountLoginForm onSubmit={vi.fn()} />);

    const studentIdInput = screen.getByPlaceholderText("请输入学号…");
    const passwordInput = screen.getByPlaceholderText("请输入密码…");

    expect(studentIdInput).toHaveAttribute("name", "student_id");
    expect(studentIdInput).toHaveAttribute("autocomplete", "username");
    expect(studentIdInput).toHaveAttribute("spellcheck", "false");
    expect(studentIdInput).toHaveAttribute("placeholder", "请输入学号…");

    expect(passwordInput).toHaveAttribute("name", "password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    expect(passwordInput).toHaveAttribute("spellcheck", "false");
    expect(passwordInput).toHaveAttribute("placeholder", "请输入密码…");
  });

  // 登录表单必须阻止浏览器原生 submit，
  // 否则移动端会把学号密码直接拼到 query string 里。
  it("prevents the native form submit from leaking credentials into the URL", async () => {
    const user = userEvent.setup();

    render(<AccountLoginForm onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("请输入学号…"), "20254227087");
    await user.type(screen.getByPlaceholderText("请输入密码…"), "123456");

    const form = document.querySelector("form");
    expect(form).not.toBeNull();

    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true
    });

    form?.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
  });
});
