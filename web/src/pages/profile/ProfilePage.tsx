import { useNavigate } from "react-router-dom";
import {
  clearSession,
  getSessionProfileSnapshot
} from "../../shared/session/session-store";
import { AppButton } from "../../shared/ui/AppButton";
import { MobilePage } from "../../shared/ui/MobilePage";

const profileFields = [
  {
    emptyText: "未同步姓名",
    key: "name",
    label: "姓名"
  },
  {
    emptyText: "未同步学号",
    key: "student_id",
    label: "学号"
  },
  {
    emptyText: "未同步院系",
    key: "department",
    label: "院系"
  },
  {
    emptyText: "未同步社团",
    key: "club",
    label: "社团"
  }
] as const;

function resolveRoleHint(role: string, permissions: string[]) {
  // 角色提示不追求完整罗列权限，只回答“我当前能走哪类业务链路”。
  if (role === "staff" || permissions.includes("activity:manage")) {
    return "当前身份：工作人员，可进入活动管理、名单修正等后台链路。";
  }
  return "当前身份：普通用户，可查看活动详情并完成签到签退。";
}

export function ProfilePage() {
  const navigate = useNavigate();
  // 个人中心第一版只消费登录时已经落到本地的会话快照，避免新开额外请求。
  const sessionProfile = getSessionProfileSnapshot();
  const userProfile = sessionProfile.user_profile ?? {};

  function handleChangePassword() {
    // 先复用现有改密页能力，后续再放开为完整的自助改密入口。
    navigate("/change-password");
  }

  function handleLogout() {
    // 退出登录要先清本地会话，再回公共入口，避免业务壳层残留旧状态。
    clearSession();
    navigate("/login");
  }

  return (
    <MobilePage
      description="查看当前登录信息，并处理密码维护或安全退出。"
      eyebrow="个人中心"
      title="我的"
    >
      <section className="profile-summary-card">
        <p className="profile-role-hint">{resolveRoleHint(sessionProfile.role, sessionProfile.permissions)}</p>
        <div className="profile-summary-list">
          {profileFields.map((field) => (
            <article className="profile-summary-item" key={field.key}>
              <p className="profile-summary-label">{field.label}</p>
              <p className="profile-summary-value">{userProfile[field.key] || field.emptyText}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="profile-actions-card">
        {/* 两个动作都保留大按钮，是为了在手机端降低误触和寻找成本。 */}
        <AppButton onClick={handleChangePassword} tone="secondary">
          修改密码
        </AppButton>
        <AppButton onClick={handleLogout}>退出登录</AppButton>
      </section>
    </MobilePage>
  );
}
