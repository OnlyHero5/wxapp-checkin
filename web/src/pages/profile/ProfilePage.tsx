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
  // 个人中心继续只消费本地会话快照，避免为了展示资料额外发请求。
  const sessionProfile = getSessionProfileSnapshot();
  const userProfile = sessionProfile.user_profile ?? {};

  function handleLogout() {
    // 退出登录要先清本地会话，再回公共入口，避免业务壳层残留旧状态。
    clearSession();
    navigate("/login");
  }

  return (
    <MobilePage
      description="查看当前登录信息，并安全退出当前会话。"
      eyebrow="个人中心"
      tone="brand"
      title="我的"
    >
      {/* 资料摘要卡只负责“我是谁、我现在能做什么”，不要把危险动作继续塞回同一块信息卡。 */}
      <section className="profile-page__card" data-panel-tone="brand">
        <header className="profile-page__hero">
          <p className="profile-page__eyebrow">账户信息</p>
          <div className="profile-page__hero-copy">
            <h2 className="profile-page__title">{userProfile.name || "当前会话"}</h2>
            <p className="profile-page__description">{resolveRoleHint(sessionProfile.role, sessionProfile.permissions)}</p>
          </div>
        </header>
        <div className="profile-page__field-list">
          {profileFields.map((field) => (
            <div className="profile-page__field-row" key={field.key}>
              {/* 字段行沿用固定顺序，避免不同入口写入快照时造成资料阅读路径跳动。 */}
              <span className="profile-page__field-label">{field.label}</span>
              <span className="profile-page__field-value">{userProfile[field.key] || field.emptyText}</span>
            </div>
          ))}
        </div>
      </section>
      {/* 退出登录单独放到动作卡，避免资料确认与会话终止操作混在一个视觉块里。 */}
      <section className="profile-page__actions" data-panel-tone="brand">
        <p className="profile-page__actions-title">会话操作</p>
        <p className="profile-page__actions-description">退出后会清空当前本地会话，并回到公共登录入口。</p>
        <AppButton onClick={handleLogout}>退出登录</AppButton>
      </section>
    </MobilePage>
  );
}
