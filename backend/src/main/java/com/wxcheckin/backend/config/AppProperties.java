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
  private final SyncProperties sync = new SyncProperties();

  public SessionProperties getSession() {
    return session;
  }

  public QrProperties getQr() {
    return qr;
  }

  public WechatProperties getWechat() {
    return wechat;
  }

  public SyncProperties getSync() {
    return sync;
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
}
