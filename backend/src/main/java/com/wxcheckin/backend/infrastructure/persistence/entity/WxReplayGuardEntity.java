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
 * Durable anti-replay key table for A-06 idempotency.
 */
@Entity
@Table(name = "wx_replay_guard")
public class WxReplayGuardEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private WxUserAuthExtEntity user;

  @Column(name = "activity_id", nullable = false, length = 64)
  private String activityId;

  @Column(name = "action_type", nullable = false, length = 16)
  private String actionType;

  @Column(name = "slot", nullable = false)
  private Long slot;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  public void prePersist() {
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
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

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant expiresAt) {
    this.expiresAt = expiresAt;
  }
}
