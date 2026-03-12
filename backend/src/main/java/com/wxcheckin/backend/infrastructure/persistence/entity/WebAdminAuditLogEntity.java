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
 * Web 管理员高风险操作审计表（对应表：{@code web_admin_audit_log}）。
 *
 * <p>当前 Web-only 版本最典型的高风险动作是“一键全部签退”。该动作会批量变更用户状态并触发 outbox 回写，
 * 因此必须在服务端保留一条“操作级”审计记录，便于后续追溯：
 *
 * <ul>
 *   <li>是谁（operator）在什么时间执行的</li>
 *   <li>对哪个业务目标（target_type/target_id）执行的</li>
 *   <li>带了什么参数（payload_json）</li>
 * </ul>
 *
 * <p>注意：事件流水（wx_checkin_event）是“用户级动作”，而本表是“管理员操作级动作”，两者语义不同。</p>
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
}

