import { requestJson } from "../../shared/http/client";

/**
 * Web 端登录/改密链路需要复用用户基本信息，
 * 因此把用户画像字段抽成独立类型，避免每个响应各写一份。
 */
export type UserProfile = {
  // 社团字段是可选信息，不是所有实名源都会稳定返回。
  club?: string;
  // 学院/部门用于后续详情展示或管理员判定，阶段性可能为空。
  department?: string;
  name: string;
  student_id: string;
};

/**
 * 账号密码登录输入。
 */
export type LoginInput = {
  student_id: string;
  password: string;
};

/**
 * 登录响应体（包含强制改密状态）。
 */
export type AuthSessionResponse = {
  message?: string;
  // 权限集会在管理员页继续使用，这里先保留字段。
  permissions?: string[];
  role?: string;
  session_expires_at?: number;
  session_token: string;
  status?: string;
  user_profile?: UserProfile;
  must_change_password?: boolean;
};

/**
 * 改密输入。
 */
export type ChangePasswordInput = {
  old_password: string;
  new_password: string;
};

/**
 * 改密响应体（只返回是否仍需强制改密）。
 */
export type ChangePasswordResponse = {
  message?: string;
  must_change_password?: boolean;
  status?: string;
};

// 下面几个方法只负责声明接口契约，不在此处掺杂页面导航或错误文案逻辑。
export function login(input: LoginInput) {
  return requestJson<AuthSessionResponse>("/auth/login", {
    body: input,
    method: "POST"
  });
}

export function changePassword(input: ChangePasswordInput) {
  return requestJson<ChangePasswordResponse>("/auth/change-password", {
    body: input,
    method: "POST"
  });
}
