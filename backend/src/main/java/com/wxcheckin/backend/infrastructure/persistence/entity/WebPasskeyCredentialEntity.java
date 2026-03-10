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
 * Passkey 凭据表保存“浏览器已经注册过什么凭据”。
 *
 * 当前实现不做生产级密码学验签，但仍然要把：
 * - `credentialId`
 * - `rawCredentialId`
 * - 注册时的 `clientDataJson/attestationObject`
 * 持久化下来，确保后续升级到正式验签时不会再次返工表结构。
 */
@Entity
@Table(
    name = "web_passkey_credential",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_web_passkey_credential_id", columnNames = "credential_id"),
        @UniqueConstraint(name = "uk_web_passkey_binding_active", columnNames = {"binding_id", "active"})
    }
)
public class WebPasskeyCredentialEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id")
  private WxUserAuthExtEntity user;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "binding_id")
  private WebBrowserBindingEntity binding;

  @Column(name = "credential_id", nullable = false, length = 255)
  private String credentialId;

  @Column(name = "raw_credential_id", nullable = false, length = 255)
  private String rawCredentialId;

  @Column(name = "active", nullable = false)
  private Boolean active = true;

  @Column(name = "attestation_object", columnDefinition = "TEXT")
  private String attestationObject;

  @Column(name = "client_data_json", columnDefinition = "TEXT")
  private String clientDataJson;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "last_used_at")
  private Instant lastUsedAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

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

  public Long getId() {
    return id;
  }

  public WxUserAuthExtEntity getUser() {
    return user;
  }

  public void setUser(WxUserAuthExtEntity user) {
    this.user = user;
  }

  public WebBrowserBindingEntity getBinding() {
    return binding;
  }

  public void setBinding(WebBrowserBindingEntity binding) {
    this.binding = binding;
  }

  public String getCredentialId() {
    return credentialId;
  }

  public void setCredentialId(String credentialId) {
    this.credentialId = credentialId;
  }

  public String getRawCredentialId() {
    return rawCredentialId;
  }

  public void setRawCredentialId(String rawCredentialId) {
    this.rawCredentialId = rawCredentialId;
  }

  public Boolean getActive() {
    return active;
  }

  public void setActive(Boolean active) {
    this.active = active;
  }

  public String getAttestationObject() {
    return attestationObject;
  }

  public void setAttestationObject(String attestationObject) {
    this.attestationObject = attestationObject;
  }

  public String getClientDataJson() {
    return clientDataJson;
  }

  public void setClientDataJson(String clientDataJson) {
    this.clientDataJson = clientDataJson;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Instant getLastUsedAt() {
    return lastUsedAt;
  }

  public void setLastUsedAt(Instant lastUsedAt) {
    this.lastUsedAt = lastUsedAt;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }

  public void setRevokedAt(Instant revokedAt) {
    this.revokedAt = revokedAt;
  }
}
