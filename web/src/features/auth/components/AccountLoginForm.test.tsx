import { render, screen } from "@testing-library/react";
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
});
