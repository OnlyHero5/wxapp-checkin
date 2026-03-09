import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CodeInput } from "../../features/attendance/components/CodeInput";
import {
  consumeActivityCode,
  getActivityDetail,
  type ActivityActionType,
  type ActivityDetail,
  type CodeConsumeResponse
} from "../../features/activities/api";
import { formatServerTime, resolveCanCheckin, resolveCanCheckout } from "../../features/activities/view-model";
import { subscribePageVisible } from "../../shared/device/page-lifecycle";
import { ApiError, SessionExpiredError } from "../../shared/http/errors";
import { MobilePage } from "../../shared/ui/MobilePage";

/**
 * 这个文件把签到页和签退页的共性逻辑收敛到 `AttendanceActionPage`。
 *
 * 共性包括：
 * - 根据活动详情判断动作是否允许
 * - 输入 6 位动态码
 * - 提交 `/code-consume`
 * - 处理结果页
 * - 处理前后台切换后的刷新
 *
 * 只有动作类型、标题文案和按钮文案不同，因此抽成一个通用页面更稳。
 */
type AttendanceActionPageProps = {
  actionType: ActivityActionType;
};

function resolveActionTitle(actionType: ActivityActionType) {
  // 标题直接决定用户现在执行的是哪种动作，必须足够明确。
  return actionType === "checkout" ? "活动签退" : "活动签到";
}

function resolveInputLabel(actionType: ActivityActionType) {
  // label 同时用于可访问性和测试定位，因此单独抽函数保持稳定。
  return actionType === "checkout" ? "签退验证码" : "签到验证码";
}

function resolveSubmitText(actionType: ActivityActionType) {
  // 按钮文案和标题保持一致，降低误操作概率。
  return actionType === "checkout" ? "提交签退码" : "提交签到码";
}

function resolveResultTitle(actionType: ActivityActionType) {
  // 成功结果态与输入态区分标题，有助于用户确认“已经提交完成”。
  return actionType === "checkout" ? "签退结果" : "签到结果";
}

/**
 * 动态码提交失败时，页面需要把后端错误码翻译成用户能立即理解的中文提示。
 *
 * 当前优先覆盖三类高频场景：
 * - 错码
 * - 过期
 * - 重复提交
 */
function resolveConsumeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "invalid_code") {
      return "验证码错误，请重新确认";
    }
    if (error.code === "expired") {
      return "验证码已过期，请重新输入最新验证码";
    }
    if (error.code === "duplicate") {
      return "当前时段已提交，请勿重复操作";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "提交失败，请稍后重试。";
}

// 不把这段逻辑散落在 JSX 内，是为了让签到和签退两种动作统一复用。
function isActionAllowed(detail: ActivityDetail, actionType: ActivityActionType) {
  return actionType === "checkout" ? resolveCanCheckout(detail) : resolveCanCheckin(detail);
}

function AttendanceActionPage({ actionType }: AttendanceActionPageProps) {
  const navigate = useNavigate();
  const { activityId = "" } = useParams();
  // `code` 作为受控输入，便于统一做数字规整与按钮禁用判断。
  const [code, setCode] = useState("");
  // `detail` 决定当前页面显示什么活动、是否允许提交。
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  // `errorMessage` 是提交动作级错误；`pageError` 是页面初始化级错误。
  const [errorMessage, setErrorMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [pending, setPending] = useState(false);
  // 一旦提交成功，页面直接切到结果态，而不是停留在输入表单。
  const [result, setResult] = useState<CodeConsumeResponse | null>(null);

  /**
   * 为什么输入页也要拉详情，而不是只带着 `activityId` 直接提交？
   *
   * 原因有三：
   * 1. 输入页必须向用户持续展示活动标题，避免串活动；
   * 2. 是否允许签到/签退需要依赖最新状态，而不是只看 URL；
   * 3. 页面从后台切回来后，详情是最便宜、最可靠的刷新来源。
   */
  async function loadDetail() {
    if (!activityId) {
      // 路由参数缺失时，不再继续请求后端，直接停在页面级错误。
      setPageError("活动不存在");
      return;
    }

    setPageError("");

    try {
      const detailResult = await getActivityDetail(activityId);
      // 详情总是以最后一次请求结果覆盖，避免用户看到旧状态。
      setDetail(detailResult);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }

      setPageError(error instanceof Error && error.message ? error.message : "活动信息加载失败");
    }
  }

  useEffect(() => {
    // 首次进入页面先拉详情，确保动作合法性判断以后端最新状态为准。
    void loadDetail();

    return subscribePageVisible(() => {
      // 页面从后台切回前台时重新拉详情，避免用户拿着旧状态继续操作。
      void loadDetail();
    });
  }, [activityId, navigate]);

  /**
   * 提交流程刻意保持线性：
   * 1. 守卫当前动作是否允许
   * 2. 调 `code-consume`
   * 3. 成功切结果态 / 失败回错误文案
   *
   * 不在这里做复杂重试，是因为动态码本身时效很短，
   * 自动重试反而可能把“本来是错码”变成“过期码”。
   */
  async function handleSubmit() {
    // 如果详情还没就绪，或当前状态根本不允许这个动作，就不发送请求。
    if (!detail || !isActionAllowed(detail, actionType)) {
      return;
    }

    // 提交前不清空 code，是为了失败后用户可以基于原输入继续修正。
    setPending(true);
    setErrorMessage("");

    try {
      // code-consume 是普通用户主链路里最关键的业务请求。
      const consumeResult = await consumeActivityCode(activityId, {
        action_type: actionType,
        code
      });
      // 成功后切到结果态，表单不再显示，避免用户误以为还需要重复提交。
      setResult(consumeResult);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        navigate("/login");
        return;
      }

      setErrorMessage(resolveConsumeError(error));
    } finally {
      setPending(false);
    }
  }

  // 成功结果页与输入页拆成两个视觉状态，用户更容易确认“本次操作已经被服务端接受”。
  if (result) {
    return (
      <MobilePage eyebrow="提交完成" title={resolveResultTitle(actionType)}>
        <section className="detail-panel">
          {/* 结果页只保留最关键信息：结果、活动名、服务端时间。 */}
          <p>{result.message ?? "提交成功"}</p>
          <p>{result.activity_title}</p>
          {result.server_time_ms ? <p>服务器时间：{formatServerTime(result.server_time_ms)}</p> : null}
        </section>
        <Link className="text-link" to={`/activities/${activityId}`}>
          返回活动详情
        </Link>
      </MobilePage>
    );
  }

  return (
    <MobilePage eyebrow="动态验证码" title={resolveActionTitle(actionType)}>
      {/* 页面级错误一般出现在详情拉取失败阶段。 */}
      {pageError ? <p className="form-error">{pageError}</p> : null}
      {detail ? (
        <>
          {/* 详情头部在输入页重复出现，是为了降低“我现在在哪个活动下输入”的心智负担。 */}
          <section className="detail-panel">
            {/* 输入页必须始终展示活动标题，避免用户在多个活动间串码。 */}
            <p>{detail.activity_title}</p>
            {/* 时间和地点是辅助确认信息，帮助用户再次确认自己在正确活动下。 */}
            {detail.start_time ? <p>时间：{detail.start_time}</p> : null}
            {detail.location ? <p>地点：{detail.location}</p> : null}
          </section>
          {isActionAllowed(detail, actionType) ? (
            /* 真正的输入与提交行为下沉到 `CodeInput`，
             * 当前页面只保留动作语义和结果切换逻辑。 */
            <CodeInput
              errorMessage={errorMessage}
              label={resolveInputLabel(actionType)}
              onChange={setCode}
              onSubmit={handleSubmit}
              pending={pending}
              submitText={resolveSubmitText(actionType)}
              value={code}
            />
          ) : (
            // 即使用户通过错误链接进入，也要明确告诉他为什么不能提交。
            <p>当前状态下暂不可执行该动作，请先返回详情页确认活动状态。</p>
          )}
        </>
      ) : (
        <p>活动信息加载中...</p>
      )}
      <Link className="text-link" to={`/activities/${activityId}`}>
        返回活动详情
      </Link>
    </MobilePage>
  );
}

export function CheckinPage() {
  // 签到页只是把动作类型固定为 `checkin`。
  return <AttendanceActionPage actionType="checkin" />;
}

export { AttendanceActionPage };
