package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;

/**
 * 防止仓库重新引入“可直接重建 legacy(suda_union) 库”的危险脚本。
 *
 * <p>维护意图：
 * - 该类校验的是“仓库治理边界”，不是业务逻辑；
 * - 一旦这类脚本重新进入 `wxapp-checkin/backend/scripts`，测试必须第一时间失败；
 * - 这样可以把“误把危险运维能力留在仓库里”的风险，提前挡在 CI / 本地回归阶段。</p>
 */
class LegacyDatabaseDangerousScriptRemovalTest {

  @Test
  void shouldNotKeepLegacyResetOrCrossProjectDestructiveScriptsInBackendRepository() {
    // 约定：Surefire 工作目录是 backend 模块根目录，因此这里直接从当前目录定位 scripts。
    Path backendDir = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();

    // 这些脚本一旦存在，就意味着仓库仍保留“可重建 legacy 库”的危险入口。
    assertScriptAbsent(backendDir.resolve("scripts/reset-suda-union-test-data.sh"));
    assertScriptAbsent(backendDir.resolve("scripts/run-3projects-integration-e2e.sh"));
    assertScriptAbsent(backendDir.resolve("scripts/run-3projects-integration-full-flow-e2e.sh"));
  }

  private static void assertScriptAbsent(Path scriptPath) {
    assertFalse(Files.exists(scriptPath), "dangerous legacy script must be removed: " + scriptPath);
  }
}
