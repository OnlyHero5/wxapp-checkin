package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.WebUnbindReviewActionResponse;
import com.wxcheckin.backend.api.dto.WebUnbindReviewCreateResponse;
import com.wxcheckin.backend.api.dto.WebUnbindReviewItemDto;
import com.wxcheckin.backend.api.dto.WebUnbindReviewListResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebAdminAuditLogEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebBrowserBindingEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyCredentialEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebUnbindReviewEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebAdminAuditLogRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebBrowserBindingRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebPasskeyCredentialRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebUnbindReviewRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UnbindReviewService {

  private static final String ACTIVE_STATUS = "active";
  private static final String UNBOUND_STATUS = "unbound";

  private final SessionService sessionService;
  private final WebUnbindReviewRepository reviewRepository;
  private final WebBrowserBindingRepository browserBindingRepository;
  private final WebPasskeyCredentialRepository credentialRepository;
  private final WebAdminAuditLogRepository auditLogRepository;
  private final WxSessionRepository sessionRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final Clock clock;

  public UnbindReviewService(
      SessionService sessionService,
      WebUnbindReviewRepository reviewRepository,
      WebBrowserBindingRepository browserBindingRepository,
      WebPasskeyCredentialRepository credentialRepository,
      WebAdminAuditLogRepository auditLogRepository,
      WxSessionRepository sessionRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.reviewRepository = reviewRepository;
    this.browserBindingRepository = browserBindingRepository;
    this.credentialRepository = credentialRepository;
    this.auditLogRepository = auditLogRepository;
    this.sessionRepository = sessionRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.clock = clock;
  }

  @Transactional
  public WebUnbindReviewCreateResponse create(
      String sessionToken,
      String browserBindingKey,
      String reason,
      String requestedNewBindingHint
  ) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken, browserBindingKey);
    String normalizedReason = normalize(reason);
    if (normalizedReason.isEmpty()) {
      throw new BusinessException("invalid_param", "reason 不能为空");
    }
    // 只有当前仍存在活跃绑定的用户才有“申请解绑”的业务意义，
    // 否则重复提交只会制造无效审核记录。
    requireActiveBinding(principal.user());

    WebUnbindReviewEntity review = new WebUnbindReviewEntity();
    review.setReviewId("rev_" + tokenGenerator.newNonce());
    review.setUser(principal.user());
    review.setReason(normalizedReason);
    review.setRequestedNewBindingHint(normalize(requestedNewBindingHint));
    review.setStatus("pending");
    review.setSubmittedAt(Instant.now(clock));
    reviewRepository.save(review);

    return new WebUnbindReviewCreateResponse(
        "success",
        "解绑申请已提交",
        review.getReviewId(),
        review.getStatus(),
        review.getSubmittedAt().toEpochMilli()
    );
  }

  @Transactional(readOnly = true)
  public WebUnbindReviewListResponse list(String sessionToken, String browserBindingKey, String status) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken, browserBindingKey);
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可查看解绑审核");
    }
    String normalizedStatus = normalize(status);
    if (normalizedStatus.isEmpty()) {
      normalizedStatus = "pending";
    }
    if (!List.of("pending", "approved", "rejected").contains(normalizedStatus)) {
      throw new BusinessException("invalid_param", "status 仅支持 pending/approved/rejected");
    }

    List<WebUnbindReviewItemDto> items = reviewRepository.findByStatusOrderBySubmittedAtDesc(normalizedStatus).stream()
        .map(this::toItem)
        .toList();
    return new WebUnbindReviewListResponse("success", "解绑审核列表获取成功", items);
  }

  @Transactional
  public WebUnbindReviewActionResponse approve(
      String sessionToken,
      String browserBindingKey,
      String reviewId,
      String reviewComment
  ) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken, browserBindingKey);
    requireStaff(principal);
    WebUnbindReviewEntity review = loadPendingReview(reviewId);
    WebBrowserBindingEntity binding = requireActiveBinding(review.getUser());
    WebPasskeyCredentialEntity credential = credentialRepository.findByBinding_IdAndActiveTrue(binding.getId())
        .orElse(null);

    review.setStatus("approved");
    review.setReviewComment(normalize(reviewComment));
    review.setReviewedAt(Instant.now(clock));
    review.setReviewer(principal.user());
    reviewRepository.save(review);

    // 审批通过的真正业务含义不是“审核记录状态变了”，
    // 而是“旧浏览器以后不能再继续登录或停留在业务态”。
    binding.setStatus(UNBOUND_STATUS);
    binding.setApprovedUnbindReviewId(review.getReviewId());
    binding.setRevokedReason(normalize(reviewComment));
    binding.setRevokedAt(Instant.now(clock));
    browserBindingRepository.save(binding);

    if (credential != null) {
      credential.setActive(false);
      credential.setRevokedAt(Instant.now(clock));
      credentialRepository.save(credential);
    }

    sessionRepository.deleteByUser_Id(review.getUser().getId());
    writeAuditLog(principal.user(), review.getUser(), review, "unbind_review_approved");
    return new WebUnbindReviewActionResponse("success", "审批通过", review.getReviewId(), review.getStatus());
  }

  @Transactional
  public WebUnbindReviewActionResponse reject(
      String sessionToken,
      String browserBindingKey,
      String reviewId,
      String reviewComment
  ) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken, browserBindingKey);
    requireStaff(principal);
    WebUnbindReviewEntity review = loadPendingReview(reviewId);
    review.setStatus("rejected");
    review.setReviewComment(normalize(reviewComment));
    review.setReviewedAt(Instant.now(clock));
    review.setReviewer(principal.user());
    reviewRepository.save(review);
    writeAuditLog(principal.user(), review.getUser(), review, "unbind_review_rejected");
    return new WebUnbindReviewActionResponse("success", "审批拒绝", review.getReviewId(), review.getStatus());
  }

  private WebBrowserBindingEntity requireActiveBinding(WxUserAuthExtEntity user) {
    return browserBindingRepository.findByUser_IdAndStatus(user.getId(), ACTIVE_STATUS)
        .orElseThrow(() -> new BusinessException("forbidden", "当前账号没有可解绑的活跃浏览器绑定"));
  }

  private void requireStaff(SessionPrincipal principal) {
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可处理解绑审核");
    }
  }

  private WebUnbindReviewEntity loadPendingReview(String reviewId) {
    WebUnbindReviewEntity review = reviewRepository.findById(normalize(reviewId))
        .orElseThrow(() -> new BusinessException("invalid_param", "解绑审核记录不存在"));
    // 审核动作只允许处理 pending，避免“重复点通过/拒绝”把历史结果冲掉。
    if (!"pending".equalsIgnoreCase(review.getStatus())) {
      throw new BusinessException("invalid_param", "当前审核记录已处理");
    }
    return review;
  }

  private WebUnbindReviewItemDto toItem(WebUnbindReviewEntity review) {
    WxUserAuthExtEntity user = review.getUser();
    WxUserAuthExtEntity reviewer = review.getReviewer();
    return new WebUnbindReviewItemDto(
        review.getReviewId(),
        review.getStatus(),
        user == null ? "" : normalize(user.getName()),
        user == null ? "" : normalize(user.getStudentId()),
        review.getReason(),
        review.getRequestedNewBindingHint(),
        review.getReviewComment(),
        reviewer == null ? "" : normalize(reviewer.getName()),
        review.getSubmittedAt() == null ? null : review.getSubmittedAt().toEpochMilli()
    );
  }

  private void writeAuditLog(
      WxUserAuthExtEntity operator,
      WxUserAuthExtEntity targetUser,
      WebUnbindReviewEntity review,
      String actionType
  ) {
    WebAdminAuditLogEntity log = new WebAdminAuditLogEntity();
    log.setAuditId("audit_" + tokenGenerator.newNonce());
    log.setOperatorUser(operator);
    log.setTargetUser(targetUser);
    log.setActionType(actionType);
    log.setTargetType("unbind_review");
    log.setTargetId(review.getReviewId());
    log.setPayloadJson(jsonCodec.writeMap(Map.of(
        "review_id", review.getReviewId(),
        "review_status", review.getStatus(),
        "student_id", targetUser == null ? "" : normalize(targetUser.getStudentId()),
        "review_comment", normalize(review.getReviewComment())
    )));
    auditLogRepository.save(log);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
