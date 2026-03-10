package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * 浏览器绑定是 Web-only 认证链路的核心锚点。
 *
 * 维护时要注意两件事：
 * 1. 这里的 `bindingFingerprintHash` 当前承载“浏览器唯一标识”语义，
 *    在开发闭环里实际由前端生成并持久化，不是强安全指纹；
 * 2. 解绑审批通过后不能只删 session，还要把绑定状态打成 `unbound`，
 *    否则用户在新浏览器无法重新走绑定主链路。
 */
@Entity
@Table(
    name = "web_browser_binding",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_web_browser_binding_id", columnNames = "binding_id"),
        @UniqueConstraint(name = "uk_web_browser_binding_user_status", columnNames = {"user_id", "status"}),
        @UniqueConstraint(
            name = "uk_web_browser_binding_fingerprint_status",
            columnNames = {"binding_fingerprint_hash", "status"}
        )
    }
)
public class WebBrowserBindingEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "binding_id", nullable = false, length = 64)
  private String bindingId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private WxUserAuthExtEntity user;

  @Column(name = "binding_fingerprint_hash", nullable = false, length = 128)
  private String bindingFingerprintHash;

  @Column(name = "status", nullable = false, length = 16)
  private String status;

  @Column(name = "approved_unbind_review_id", length = 64)
  private String approvedUnbindReviewId;

  @Column(name = "revoked_reason", length = 255)
  private String revokedReason;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "last_seen_at", nullable = false)
  private Instant lastSeenAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @PrePersist
  public void prePersist() {
    Instant now = Instant.now();
    this.createdAt = now;
    this.updatedAt = now;
    this.lastSeenAt = now;
  }

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getBindingId() {
    return bindingId;
  }

  public void setBindingId(String bindingId) {
    this.bindingId = bindingId;
  }

  public WxUserAuthExtEntity getUser() {
    return user;
  }

  public void setUser(WxUserAuthExtEntity user) {
    this.user = user;
  }

  public String getBindingFingerprintHash() {
    return bindingFingerprintHash;
  }

  public void setBindingFingerprintHash(String bindingFingerprintHash) {
    this.bindingFingerprintHash = bindingFingerprintHash;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getApprovedUnbindReviewId() {
    return approvedUnbindReviewId;
  }

  public void setApprovedUnbindReviewId(String approvedUnbindReviewId) {
    this.approvedUnbindReviewId = approvedUnbindReviewId;
  }

  public String getRevokedReason() {
    return revokedReason;
  }

  public void setRevokedReason(String revokedReason) {
    this.revokedReason = revokedReason;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Instant getLastSeenAt() {
    return lastSeenAt;
  }

  public void setLastSeenAt(Instant lastSeenAt) {
    this.lastSeenAt = lastSeenAt;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }

  public void setRevokedAt(Instant revokedAt) {
    this.revokedAt = revokedAt;
  }
}
