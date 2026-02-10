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
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Records every QR ticket issued by A-05 for audit and A-06 validation.
 */
@Entity
@Table(name = "wx_qr_issue_log")
public class WxQrIssueLogEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "activity_id", nullable = false, length = 64)
  private String activityId;

  @Column(name = "action_type", nullable = false, length = 16)
  private String actionType;

  @Column(name = "slot", nullable = false)
  private Long slot;

  @Column(name = "nonce", nullable = false, length = 128)
  private String nonce;

  @Column(name = "qr_payload", nullable = false, length = 255)
  private String qrPayload;

  @Column(name = "display_expire_at", nullable = false)
  private Long displayExpireAt;

  @Column(name = "accept_expire_at", nullable = false)
  private Long acceptExpireAt;

  @Column(name = "issued_at", nullable = false)
  private Instant issuedAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "issued_by_user_id")
  private WxUserAuthExtEntity issuedByUser;

  @PrePersist
  public void prePersist() {
    this.issuedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getActivityId() {
    return activityId;
  }

  public void setActivityId(String activityId) {
    this.activityId = activityId;
  }

  public String getActionType() {
    return actionType;
  }

  public void setActionType(String actionType) {
    this.actionType = actionType;
  }

  public Long getSlot() {
    return slot;
  }

  public void setSlot(Long slot) {
    this.slot = slot;
  }

  public String getNonce() {
    return nonce;
  }

  public void setNonce(String nonce) {
    this.nonce = nonce;
  }

  public String getQrPayload() {
    return qrPayload;
  }

  public void setQrPayload(String qrPayload) {
    this.qrPayload = qrPayload;
  }

  public Long getDisplayExpireAt() {
    return displayExpireAt;
  }

  public void setDisplayExpireAt(Long displayExpireAt) {
    this.displayExpireAt = displayExpireAt;
  }

  public Long getAcceptExpireAt() {
    return acceptExpireAt;
  }

  public void setAcceptExpireAt(Long acceptExpireAt) {
    this.acceptExpireAt = acceptExpireAt;
  }

  public WxUserAuthExtEntity getIssuedByUser() {
    return issuedByUser;
  }

  public void setIssuedByUser(WxUserAuthExtEntity issuedByUser) {
    this.issuedByUser = issuedByUser;
  }
}
