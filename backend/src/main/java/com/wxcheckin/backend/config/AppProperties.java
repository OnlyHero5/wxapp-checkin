package com.wxcheckin.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Centralized configuration object for application-specific settings.
 *
 * <p>All custom knobs are mapped from {@code app.*} keys in YAML to keep
 * environment overrides explicit and Linux deployment friendly.</p>
 */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private final SessionProperties session = new SessionProperties();
  private final QrProperties qr = new QrProperties();
  private final WechatProperties wechat = new WechatProperties();
  private final LegacyProperties legacy = new LegacyProperties();
  private final SyncProperties sync = new SyncProperties();
  private final SecurityProperties security = new SecurityProperties();

  public SessionProperties getSession() {
    return session;
  }

  public QrProperties getQr() {
    return qr;
  }

  public WechatProperties getWechat() {
    return wechat;
  }

  public LegacyProperties getLegacy() {
    return legacy;
  }

  public SyncProperties getSync() {
    return sync;
  }

  public SecurityProperties getSecurity() {
    return security;
  }

  public static class SessionProperties {
    private long ttlSeconds = 7200;

    public long getTtlSeconds() {
      return ttlSeconds;
    }

    public void setTtlSeconds(long ttlSeconds) {
      this.ttlSeconds = ttlSeconds;
    }
  }

  public static class QrProperties {
    private int defaultRotateSeconds = 10;
    private int defaultGraceSeconds = 20;
    private long replayKeyTtlSeconds = 90;
    private String signingKey = "replace-with-a-strong-server-side-secret";
    private boolean issueLogEnabled = true;
    private boolean allowLegacyUnsigned = true;
    private long issueLogRetentionSeconds = 86400;
    private long replayGuardRetentionSeconds = 0;

    public int getDefaultRotateSeconds() {
      return defaultRotateSeconds;
    }

    public void setDefaultRotateSeconds(int defaultRotateSeconds) {
      this.defaultRotateSeconds = defaultRotateSeconds;
    }

    public int getDefaultGraceSeconds() {
      return defaultGraceSeconds;
    }

    public void setDefaultGraceSeconds(int defaultGraceSeconds) {
      this.defaultGraceSeconds = defaultGraceSeconds;
    }

    public long getReplayKeyTtlSeconds() {
      return replayKeyTtlSeconds;
    }

    public void setReplayKeyTtlSeconds(long replayKeyTtlSeconds) {
      this.replayKeyTtlSeconds = replayKeyTtlSeconds;
    }

    public String getSigningKey() {
      return signingKey;
    }

    public void setSigningKey(String signingKey) {
      this.signingKey = signingKey;
    }

    public boolean isIssueLogEnabled() {
      return issueLogEnabled;
    }

    public void setIssueLogEnabled(boolean issueLogEnabled) {
      this.issueLogEnabled = issueLogEnabled;
    }

    public boolean isAllowLegacyUnsigned() {
      return allowLegacyUnsigned;
    }

    public void setAllowLegacyUnsigned(boolean allowLegacyUnsigned) {
      this.allowLegacyUnsigned = allowLegacyUnsigned;
    }

    public long getIssueLogRetentionSeconds() {
      return issueLogRetentionSeconds;
    }

    public void setIssueLogRetentionSeconds(long issueLogRetentionSeconds) {
      this.issueLogRetentionSeconds = issueLogRetentionSeconds;
    }

    public long getReplayGuardRetentionSeconds() {
      return replayGuardRetentionSeconds;
    }

    public void setReplayGuardRetentionSeconds(long replayGuardRetentionSeconds) {
      this.replayGuardRetentionSeconds = replayGuardRetentionSeconds;
    }
  }

  public static class WechatProperties {
    private boolean enabled = false;
    private String appid = "";
    private String secret = "";
    private String jscode2sessionUrl = "https://api.weixin.qq.com/sns/jscode2session";

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public String getAppid() {
      return appid;
    }

    public void setAppid(String appid) {
      this.appid = appid;
    }

    public String getSecret() {
      return secret;
    }

    public void setSecret(String secret) {
      this.secret = secret;
    }

    public String getJscode2sessionUrl() {
      return jscode2sessionUrl;
    }

    public void setJscode2sessionUrl(String jscode2sessionUrl) {
      this.jscode2sessionUrl = jscode2sessionUrl;
    }
  }

  public static class LegacyProperties {
    private final LegacyDatasourceProperties datasource = new LegacyDatasourceProperties();

    public LegacyDatasourceProperties getDatasource() {
      return datasource;
    }
  }

  public static class LegacyDatasourceProperties {
    private String url = "";
    private String username = "";
    private String password = "";
    private String driverClassName = "com.mysql.cj.jdbc.Driver";

    public String getUrl() {
      return url;
    }

    public void setUrl(String url) {
      this.url = url;
    }

    public String getUsername() {
      return username;
    }

    public void setUsername(String username) {
      this.username = username;
    }

    public String getPassword() {
      return password;
    }

    public void setPassword(String password) {
      this.password = password;
    }

    public String getDriverClassName() {
      return driverClassName;
    }

    public void setDriverClassName(String driverClassName) {
      this.driverClassName = driverClassName;
    }
  }

  public static class SyncProperties {
    private final LegacySyncProperties legacy = new LegacySyncProperties();
    private final OutboxProperties outbox = new OutboxProperties();

    public LegacySyncProperties getLegacy() {
      return legacy;
    }

    public OutboxProperties getOutbox() {
      return outbox;
    }
  }

  public static class LegacySyncProperties {
    private boolean enabled = false;
    private long pullIntervalMs = 60000;

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public long getPullIntervalMs() {
      return pullIntervalMs;
    }

    public void setPullIntervalMs(long pullIntervalMs) {
      this.pullIntervalMs = pullIntervalMs;
    }
  }

  public static class OutboxProperties {
    private boolean enabled = false;
    private long relayIntervalMs = 10000;

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public long getRelayIntervalMs() {
      return relayIntervalMs;
    }

    public void setRelayIntervalMs(long relayIntervalMs) {
      this.relayIntervalMs = relayIntervalMs;
    }
  }

  public static class SecurityProperties {
    private final RegisterPayloadProperties registerPayload = new RegisterPayloadProperties();

    public RegisterPayloadProperties getRegisterPayload() {
      return registerPayload;
    }
  }

  public static class RegisterPayloadProperties {
    private boolean enabled = true;
    private long maxSkewSeconds = 300;
    private long nonceTtlSeconds = 600;

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public long getMaxSkewSeconds() {
      return maxSkewSeconds;
    }

    public void setMaxSkewSeconds(long maxSkewSeconds) {
      this.maxSkewSeconds = maxSkewSeconds;
    }

    public long getNonceTtlSeconds() {
      return nonceTtlSeconds;
    }

    public void setNonceTtlSeconds(long nonceTtlSeconds) {
      this.nonceTtlSeconds = nonceTtlSeconds;
    }
  }
}
