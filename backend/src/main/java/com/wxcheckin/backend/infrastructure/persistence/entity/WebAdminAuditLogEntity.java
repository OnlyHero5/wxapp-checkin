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
 * 管理员审计日志只记录“高权限动作发生了什么”。
 *
 * 本轮先覆盖解绑审批这条高风险路径，
 * 后续若要继续追批量签退或其他管理动作，可以复用同一张表继续扩展。
 */
@Entity
@Table(name = "web_admin_audit_log")
public class WebAdminAuditLogEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "audit_id", nullable = false, length = 64)
  private String auditId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "operator_user_id")
  private WxUserAuthExtEntity operatorUser;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "target_user_id")
  private WxUserAuthExtEntity targetUser;

  @Column(name = "action_type", nullable = false, length = 64)
  private String actionType;

  @Column(name = "target_type", nullable = false, length = 64)
  private String targetType;

  @Column(name = "target_id", nullable = false, length = 128)
  private String targetId;

  @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
  private String payloadJson;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  public void prePersist() {
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getAuditId() {
    return auditId;
  }

  public void setAuditId(String auditId) {
    this.auditId = auditId;
  }

  public WxUserAuthExtEntity getOperatorUser() {
    return operatorUser;
  }

  public void setOperatorUser(WxUserAuthExtEntity operatorUser) {
    this.operatorUser = operatorUser;
  }

  public WxUserAuthExtEntity getTargetUser() {
    return targetUser;
  }

  public void setTargetUser(WxUserAuthExtEntity targetUser) {
    this.targetUser = targetUser;
  }

  public String getActionType() {
    return actionType;
  }

  public void setActionType(String actionType) {
    this.actionType = actionType;
  }

  public String getTargetType() {
    return targetType;
  }

  public void setTargetType(String targetType) {
    this.targetType = targetType;
  }

  public String getTargetId() {
    return targetId;
  }

  public void setTargetId(String targetId) {
    this.targetId = targetId;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public void setPayloadJson(String payloadJson) {
    this.payloadJson = payloadJson;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
