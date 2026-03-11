package com.wxcheckin.backend.e2e;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * 三项目联动端到端测试入口（按需启用）。
 *
 * <p>为什么用“脚本 + JUnit 包装”：
 * - 该用例需要启动两个 Spring Boot 服务并访问本地 MySQL/Redis，属于环境型集成测试；
 * - 直接放进默认 test suite 会拖慢反馈、并对开发机环境提出强依赖；
 * - 但在联调/发版前，我们仍需要一个“一键可复现 + 强断言”的自动化回归入口。</p>
 *
 * <p>启用方式：
 * - 设置环境变量：WXAPP_CHECKIN_E2E=1
 * - 然后执行：./mvnw test -Dtest=ThreeProjectsE2ETest</p>
 */
@EnabledIfEnvironmentVariable(named = "WXAPP_CHECKIN_E2E", matches = "(?i)true|1")
@Timeout(value = 20, unit = TimeUnit.MINUTES)
class ThreeProjectsE2ETest {

  @Test
  void shouldPassE2EWorkflowAgainstRealLegacySchema() throws Exception {
    // 约定：Surefire 的工作目录通常是模块根目录（wxapp-checkin/backend）。
    Path backendDir = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
    Path script = backendDir.resolve("scripts/run-3projects-integration-e2e.sh");
    assertTrue(Files.exists(script), "missing e2e script: " + script);

    ProcessBuilder processBuilder = new ProcessBuilder("bash", script.toString());
    processBuilder.directory(backendDir.toFile());
    // 直接继承 IO：让脚本输出与定位信息出现在 surefire 日志里，方便排障。
    processBuilder.inheritIO();

    Process process = processBuilder.start();
    int exitCode = process.waitFor();
    assertEquals(0, exitCode);
  }
}

