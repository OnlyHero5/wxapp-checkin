package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "web_unbind_review")
public class WebUnbindReviewEntity {

  @Id
  @Column(name = "review_id", length = 64)
  private String reviewId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private WxUserAuthExtEntity user;

  @Column(name = "status", nullable = false, length = 16)
  private String status;

  @Column(name = "reason", nullable = false, length = 255)
  private String reason;

  @Column(name = "requested_new_binding_hint", length = 255)
  private String requestedNewBindingHint;

  @Column(name = "review_comment", length = 255)
  private String reviewComment;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "reviewer_user_id")
  private WxUserAuthExtEntity reviewer;

  @Column(name = "submitted_at", nullable = false)
  private Instant submittedAt;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

  public String getReviewId() {
    return reviewId;
  }

  public void setReviewId(String reviewId) {
    this.reviewId = reviewId;
  }

  public WxUserAuthExtEntity getUser() {
    return user;
  }

  public void setUser(WxUserAuthExtEntity user) {
    this.user = user;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getReason() {
    return reason;
  }

  public void setReason(String reason) {
    this.reason = reason;
  }

  public String getRequestedNewBindingHint() {
    return requestedNewBindingHint;
  }

  public void setRequestedNewBindingHint(String requestedNewBindingHint) {
    this.requestedNewBindingHint = requestedNewBindingHint;
  }

  public String getReviewComment() {
    return reviewComment;
  }

  public void setReviewComment(String reviewComment) {
    this.reviewComment = reviewComment;
  }

  public WxUserAuthExtEntity getReviewer() {
    return reviewer;
  }

  public void setReviewer(WxUserAuthExtEntity reviewer) {
    this.reviewer = reviewer;
  }

  public Instant getSubmittedAt() {
    return submittedAt;
  }

  public void setSubmittedAt(Instant submittedAt) {
    this.submittedAt = submittedAt;
  }

  public Instant getReviewedAt() {
    return reviewedAt;
  }

  public void setReviewedAt(Instant reviewedAt) {
    this.reviewedAt = reviewedAt;
  }
}
