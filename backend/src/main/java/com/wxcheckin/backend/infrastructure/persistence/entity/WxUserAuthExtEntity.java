package com.wxcheckin.backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Extension user table that stores cross-channel identity/auth fields.
 *
 * <p>This keeps the legacy user schema unchanged and satisfies OCP by adding
 * new capabilities in an isolated table.</p>
 */
@Entity
@Table(name = "wx_user_auth_ext")
public class WxUserAuthExtEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "legacy_user_id")
  private Long legacyUserId;

  @Column(name = "wx_identity", nullable = false, length = 128, unique = true)
  private String wxIdentity;

  @Column(name = "wx_token", length = 255)
  private String wxToken;

  @Column(name = "token_ciphertext", length = 512)
  private String tokenCiphertext;

  @Column(name = "token_expires_at")
  private Instant tokenExpiresAt;

  @Column(name = "student_id", length = 32)
  private String studentId;

  @Column(name = "name", length = 64)
  private String name;

  /**
   * Web 端账号密码登录的密码哈希（bcrypt），不保存明文。
   *
   * 说明：
   * - 本项目的 Web 访问形态要求支持 HTTP + 内网 IP + 端口，因此不能依赖 Passkey/WebAuthn；
   * - 密码默认值是业务约束（统一为 123），但落库时只允许保存 hash。
   */
  @Column(name = "password_hash", length = 255)
  private String passwordHash;

  /**
   * 是否强制用户修改密码。
   *
   * 该字段允许为 null：
   * - 兼容历史数据（早期只有小程序登录时并不存在密码字段）
   * - 由服务端在首次 Web 登录时初始化为 true，并在改密成功后置为 false
   */
  @Column(name = "must_change_password")
  private Boolean mustChangePassword;

  @Column(name = "password_updated_at")
  private Instant passwordUpdatedAt;

  @Column(name = "department", length = 128)
  private String department;

  @Column(name = "club", length = 128)
  private String club;

  @Column(name = "avatar_url", length = 512)
  private String avatarUrl;

  @Column(name = "social_score", nullable = false)
  private Integer socialScore = 0;

  @Column(name = "lecture_score", nullable = false)
  private Integer lectureScore = 0;

  @Column(name = "role_code", nullable = false, length = 16)
  private String roleCode = "normal";

  @Column(name = "permissions_json", nullable = false, columnDefinition = "TEXT")
  private String permissionsJson = "[]";

  @Column(name = "registered", nullable = false)
  private Boolean registered = false;

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

  public Long getId() {
    return id;
  }

  public Long getLegacyUserId() {
    return legacyUserId;
  }

  public void setLegacyUserId(Long legacyUserId) {
    this.legacyUserId = legacyUserId;
  }

  public String getWxIdentity() {
    return wxIdentity;
  }

  public void setWxIdentity(String wxIdentity) {
    this.wxIdentity = wxIdentity;
  }

  public String getWxToken() {
    return wxToken;
  }

  public void setWxToken(String wxToken) {
    this.wxToken = wxToken;
  }

  public String getTokenCiphertext() {
    return tokenCiphertext;
  }

  public void setTokenCiphertext(String tokenCiphertext) {
    this.tokenCiphertext = tokenCiphertext;
  }

  public Instant getTokenExpiresAt() {
    return tokenExpiresAt;
  }

  public void setTokenExpiresAt(Instant tokenExpiresAt) {
    this.tokenExpiresAt = tokenExpiresAt;
  }

  public String getStudentId() {
    return studentId;
  }

  public void setStudentId(String studentId) {
    this.studentId = studentId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public Boolean getMustChangePassword() {
    return mustChangePassword;
  }

  public void setMustChangePassword(Boolean mustChangePassword) {
    this.mustChangePassword = mustChangePassword;
  }

  public Instant getPasswordUpdatedAt() {
    return passwordUpdatedAt;
  }

  public void setPasswordUpdatedAt(Instant passwordUpdatedAt) {
    this.passwordUpdatedAt = passwordUpdatedAt;
  }

  public String getDepartment() {
    return department;
  }

  public void setDepartment(String department) {
    this.department = department;
  }

  public String getClub() {
    return club;
  }

  public void setClub(String club) {
    this.club = club;
  }

  public String getAvatarUrl() {
    return avatarUrl;
  }

  public void setAvatarUrl(String avatarUrl) {
    this.avatarUrl = avatarUrl;
  }

  public Integer getSocialScore() {
    return socialScore;
  }

  public void setSocialScore(Integer socialScore) {
    this.socialScore = socialScore;
  }

  public Integer getLectureScore() {
    return lectureScore;
  }

  public void setLectureScore(Integer lectureScore) {
    this.lectureScore = lectureScore;
  }

  public String getRoleCode() {
    return roleCode;
  }

  public void setRoleCode(String roleCode) {
    this.roleCode = roleCode;
  }

  public String getPermissionsJson() {
    return permissionsJson;
  }

  public void setPermissionsJson(String permissionsJson) {
    this.permissionsJson = permissionsJson;
  }

  public Boolean getRegistered() {
    return registered;
  }

  public void setRegistered(Boolean registered) {
    this.registered = registered;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
