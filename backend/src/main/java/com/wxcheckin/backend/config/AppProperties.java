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
  private final LegacyProperties legacy = new LegacyProperties();
  private final SyncProperties sync = new SyncProperties();
  private final RiskProperties risk = new RiskProperties();

  public SessionProperties getSession() {
    return session;
  }

  public QrProperties getQr() {
    return qr;
  }

  public LegacyProperties getLegacy() {
    return legacy;
  }

  public SyncProperties getSync() {
    return sync;
  }

  public RiskProperties getRisk() {
    return risk;
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
    private long replayKeyTtlSeconds = 90;
    private String signingKey = "replace-with-a-strong-server-side-secret";
    private long replayGuardRetentionSeconds = 0;

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

    public long getReplayGuardRetentionSeconds() {
      return replayGuardRetentionSeconds;
    }

    public void setReplayGuardRetentionSeconds(long replayGuardRetentionSeconds) {
      this.replayGuardRetentionSeconds = replayGuardRetentionSeconds;
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

  public static class RiskProperties {
    private final InvalidCodeProperties invalidCode = new InvalidCodeProperties();

    public InvalidCodeProperties getInvalidCode() {
      return invalidCode;
    }
  }

  public static class InvalidCodeProperties {
    private int maxAttemptsPerUser = 12;
    private int windowSeconds = 60;

    public int getMaxAttemptsPerUser() {
      return maxAttemptsPerUser;
    }

    public void setMaxAttemptsPerUser(int maxAttemptsPerUser) {
      this.maxAttemptsPerUser = maxAttemptsPerUser;
    }

    public int getWindowSeconds() {
      return windowSeconds;
    }

    public void setWindowSeconds(int windowSeconds) {
      this.windowSeconds = windowSeconds;
    }
  }
}
