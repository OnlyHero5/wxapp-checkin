package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 回归用例：关闭后台调度时，同步服务本身仍然必须存在。
 *
 * <p>维护原因：
 * - `LegacySyncService` / `OutboxRelayService` 既承担“被业务显式调用”的职责，
 *   也承担“被 @Scheduled 后台触发”的职责；
 * - 测试环境和某些运维场景需要关闭后台调度，但仍要保留手动调用能力；
 * - 如果把整个 bean 挂在 `app.sync.scheduler-enabled` 上，调用方会直接拿不到服务，
 *   隐式把“关闭调度”和“禁用服务”绑成同一个开关，后续很容易再引入并发或测试隔离问题。</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.scheduler-enabled=false"
})
class SyncServiceManualInvocationTest {

  @Autowired
  private LegacySyncService legacySyncService;

  @Autowired
  private OutboxRelayService outboxRelayService;

  @Test
  void shouldKeepSyncServicesAvailableForManualInvocationWhenSchedulerDisabled() {
    // 这里只校验“服务 bean 可拿到且可手动调用”，
    // 真实同步开关仍由各自 `enabled` 配置控制，测试 profile 下默认会走 no-op。
    assertNotNull(legacySyncService);
    assertNotNull(outboxRelayService);
    assertDoesNotThrow(legacySyncService::syncFromLegacy);
    assertDoesNotThrow(outboxRelayService::relayToLegacy);
  }
}
