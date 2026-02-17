package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Denormalized activity view consumed directly by miniapp APIs.
 *
 * <p>This table can be synchronized from legacy activity tables without
 * coupling runtime APIs to old schema details.</p>
 */
@Entity
@Table(name = "wx_activity_projection")
public class WxActivityProjectionEntity {

  @Id
  @Column(name = "activity_id", length = 64)
  private String activityId;

  @Column(name = "legacy_activity_id")
  private Integer legacyActivityId;

  @Column(name = "activity_title", nullable = false, length = 255)
  private String activityTitle;

  @Column(name = "activity_type", nullable = false, length = 64)
  private String activityType;

  @Column(name = "start_time", nullable = false)
  private Instant startTime;

  @Column(name = "location", nullable = false, length = 255)
  private String location;

  @Column(name = "description", columnDefinition = "TEXT")
  private String description;

  @Column(name = "progress_status", nullable = false, length = 16)
  private String progressStatus;

  @Column(name = "support_checkout", nullable = false)
  private Boolean supportCheckout = true;

  @Column(name = "support_checkin", nullable = false)
  private Boolean supportCheckin = true;

  @Column(name = "has_detail", nullable = false)
  private Boolean hasDetail = true;

  @Column(name = "checkin_count", nullable = false)
  private Integer checkinCount = 0;

  @Column(name = "checkout_count", nullable = false)
  private Integer checkoutCount = 0;

  @Column(name = "rotate_seconds", nullable = false)
  private Integer rotateSeconds = 10;

  @Column(name = "grace_seconds", nullable = false)
  private Integer graceSeconds = 20;

  @Column(name = "active", nullable = false)
  private Boolean active = true;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  public void prePersist() {
    Instant now = Instant.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = Instant.now();
  }

  public String getActivityId() {
    return activityId;
  }

  public void setActivityId(String activityId) {
    this.activityId = activityId;
  }

  public Integer getLegacyActivityId() {
    return legacyActivityId;
  }

  public void setLegacyActivityId(Integer legacyActivityId) {
    this.legacyActivityId = legacyActivityId;
  }

  public String getActivityTitle() {
    return activityTitle;
  }

  public void setActivityTitle(String activityTitle) {
    this.activityTitle = activityTitle;
  }

  public String getActivityType() {
    return activityType;
  }

  public void setActivityType(String activityType) {
    this.activityType = activityType;
  }

  public Instant getStartTime() {
    return startTime;
  }

  public void setStartTime(Instant startTime) {
    this.startTime = startTime;
  }

  public String getLocation() {
    return location;
  }

  public void setLocation(String location) {
    this.location = location;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getProgressStatus() {
    return progressStatus;
  }

  public void setProgressStatus(String progressStatus) {
    this.progressStatus = progressStatus;
  }

  public Boolean getSupportCheckout() {
    return supportCheckout;
  }

  public void setSupportCheckout(Boolean supportCheckout) {
    this.supportCheckout = supportCheckout;
  }

  public Boolean getSupportCheckin() {
    return supportCheckin;
  }

  public void setSupportCheckin(Boolean supportCheckin) {
    this.supportCheckin = supportCheckin;
  }

  public Boolean getHasDetail() {
    return hasDetail;
  }

  public void setHasDetail(Boolean hasDetail) {
    this.hasDetail = hasDetail;
  }

  public Integer getCheckinCount() {
    return checkinCount;
  }

  public void setCheckinCount(Integer checkinCount) {
    this.checkinCount = checkinCount;
  }

  public Integer getCheckoutCount() {
    return checkoutCount;
  }

  public void setCheckoutCount(Integer checkoutCount) {
    this.checkoutCount = checkoutCount;
  }

  public Integer getRotateSeconds() {
    return rotateSeconds;
  }

  public void setRotateSeconds(Integer rotateSeconds) {
    this.rotateSeconds = rotateSeconds;
  }

  public Integer getGraceSeconds() {
    return graceSeconds;
  }

  public void setGraceSeconds(Integer graceSeconds) {
    this.graceSeconds = graceSeconds;
  }

  public Boolean getActive() {
    return active;
  }

  public void setActive(Boolean active) {
    this.active = active;
  }
}
