package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Outbox events used to synchronize new-domain writes back to legacy systems.
 */
@Entity
@Table(name = "wx_sync_outbox")
public class WxSyncOutboxEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "aggregate_type", nullable = false, length = 64)
  private String aggregateType;

  @Column(name = "aggregate_id", nullable = false, length = 64)
  private String aggregateId;

  @Column(name = "event_type", nullable = false, length = 64)
  private String eventType;

  @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
  private String payloadJson;

  @Column(name = "status", nullable = false, length = 32)
  private String status = "pending";

  @Column(name = "available_at", nullable = false)
  private Instant availableAt;

  @Column(name = "processed_at")
  private Instant processedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  public void prePersist() {
    Instant now = Instant.now();
    this.createdAt = now;
    if (this.availableAt == null) {
      this.availableAt = now;
    }
  }

  public Long getId() {
    return id;
  }

  public String getAggregateType() {
    return aggregateType;
  }

  public void setAggregateType(String aggregateType) {
    this.aggregateType = aggregateType;
  }

  public String getAggregateId() {
    return aggregateId;
  }

  public void setAggregateId(String aggregateId) {
    this.aggregateId = aggregateId;
  }

  public String getEventType() {
    return eventType;
  }

  public void setEventType(String eventType) {
    this.eventType = eventType;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public void setPayloadJson(String payloadJson) {
    this.payloadJson = payloadJson;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Instant getAvailableAt() {
    return availableAt;
  }

  public void setAvailableAt(Instant availableAt) {
    this.availableAt = availableAt;
  }

  public Instant getProcessedAt() {
    return processedAt;
  }

  public void setProcessedAt(Instant processedAt) {
    this.processedAt = processedAt;
  }
}
