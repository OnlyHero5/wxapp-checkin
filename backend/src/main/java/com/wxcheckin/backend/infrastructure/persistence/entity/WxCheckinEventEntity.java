package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Immutable check-in/checkout event journal.
 */
@Entity
@Table(name = "wx_checkin_event")
public class WxCheckinEventEntity {

  @Id
  @Column(name = "record_id", length = 64)
  private String recordId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private WxUserAuthExtEntity user;

  @Column(name = "activity_id", nullable = false, length = 64)
  private String activityId;

  @Column(name = "action_type", nullable = false, length = 16)
  private String actionType;

  @Column(name = "slot", nullable = false)
  private Long slot;

  @Column(name = "nonce", nullable = false, length = 128)
  private String nonce;

  @Column(name = "in_grace_window", nullable = false)
  private Boolean inGraceWindow;

  @Column(name = "submitted_at", nullable = false)
  private Instant submittedAt;

  @Column(name = "server_time", nullable = false)
  private Long serverTime;

  @Column(name = "qr_payload", nullable = false, length = 255)
  private String qrPayload;

  public String getRecordId() {
    return recordId;
  }

  public void setRecordId(String recordId) {
    this.recordId = recordId;
  }

  public WxUserAuthExtEntity getUser() {
    return user;
  }

  public void setUser(WxUserAuthExtEntity user) {
    this.user = user;
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

  public Boolean getInGraceWindow() {
    return inGraceWindow;
  }

  public void setInGraceWindow(Boolean inGraceWindow) {
    this.inGraceWindow = inGraceWindow;
  }

  public Instant getSubmittedAt() {
    return submittedAt;
  }

  public void setSubmittedAt(Instant submittedAt) {
    this.submittedAt = submittedAt;
  }

  public Long getServerTime() {
    return serverTime;
  }

  public void setServerTime(Long serverTime) {
    this.serverTime = serverTime;
  }

  public String getQrPayload() {
    return qrPayload;
  }

  public void setQrPayload(String qrPayload) {
    this.qrPayload = qrPayload;
  }
}
