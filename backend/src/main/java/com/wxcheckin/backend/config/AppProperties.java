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
    private static final String DEFAULT_MYSQL_PORT = "3306";
    private static final String FIXED_JDBC_OPTIONS =
        "?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false";

    private String url = "";
    private String host = "";
    private String username = "";
    private String password = "";
    private String driverClassName = "com.mysql.cj.jdbc.Driver";

    public String getUrl() {
      return url;
    }

    public void setUrl(String url) {
      this.url = url;
    }

    public String getHost() {
      return host;
    }

    public void setHost(String host) {
      this.host = host;
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

    /**
     * legacy 连接优先兼容完整 JDBC；如果没有显式 URL，
     * 再把新口径 `SUDA_UNION_DB_HOST` 解析成固定 schema 的 JDBC 地址。
     */
    public String resolveJdbcUrl(String fallbackHost, String fallbackPort) {
      if (!isBlank(url)) {
        return url;
      }

      String address = resolveAddress(fallbackHost, fallbackPort);
      if (isBlank(address)) {
        return "";
      }
      return "jdbc:mysql://" + address + "/suda_union" + FIXED_JDBC_OPTIONS;
    }

    private String resolveAddress(String fallbackHost, String fallbackPort) {
      // 新口径允许用户把端口直接写进 host；
      // 若只写主机名，则仍按 legacy MySQL 默认端口 3306 兜底。
      if (!isBlank(host)) {
        return host.contains(":") ? host : host + ":" + DEFAULT_MYSQL_PORT;
      }

      // 演示模式没有显式 legacy 地址时，复用主库所在 MySQL 的地址，
      // 这样 prod profile 可以继续自动回退到 compose 内 demo `suda_union`。
      if (isBlank(fallbackHost)) {
        return "";
      }
      String port = isBlank(fallbackPort) ? DEFAULT_MYSQL_PORT : fallbackPort;
      return fallbackHost + ":" + port;
    }

    private boolean isBlank(String value) {
      return value == null || value.trim().isEmpty();
    }
  }

  public static class SyncProperties {
    /**
     * 是否允许后台定时任务自动运行。
     *
     * <p>注意这里控制的是“调度入口”，不是“服务能力”本身：
     * 即使关闭后台调度，业务代码和测试仍然应该能够手动调用
     * `LegacySyncService` / `OutboxRelayService` 来完成一次同步。</p>
     */
    private boolean schedulerEnabled = true;
    private final LegacySyncProperties legacy = new LegacySyncProperties();
    private final OutboxProperties outbox = new OutboxProperties();

    public boolean isSchedulerEnabled() {
      return schedulerEnabled;
    }

    public void setSchedulerEnabled(boolean schedulerEnabled) {
      this.schedulerEnabled = schedulerEnabled;
    }

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
