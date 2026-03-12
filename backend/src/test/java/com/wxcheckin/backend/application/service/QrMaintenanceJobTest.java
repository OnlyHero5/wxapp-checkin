package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxReplayGuardEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxReplayGuardRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import com.wxcheckin.backend.config.AppProperties;
import java.time.Clock;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.qr.replay-guard-retention-seconds=0"
})
class QrMaintenanceJobTest {

  @Autowired
  private QrMaintenanceJob qrMaintenanceJob;

  @Autowired
  private WxReplayGuardRepository replayGuardRepository;

  @Autowired
  private WxUserAuthExtRepository userRepository;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private Clock clock;

  @Autowired
  private AppProperties appProperties;

  @BeforeEach
  void prepare() {
    replayGuardRepository.deleteAll();
    userRepository.deleteAll();
    activityRepository.deleteAll();
  }

  @Test
  void cleanupShouldRemoveExpiredRowsAndKeepFreshOnes() {
    Instant now = Instant.now(clock);
    org.junit.jupiter.api.Assertions.assertEquals(0L, appProperties.getQr().getReplayGuardRetentionSeconds());

    seedRows(now);

    org.junit.jupiter.api.Assertions.assertEquals(2L, replayGuardRepository.count());

    qrMaintenanceJob.cleanupExpiredQrArtifacts();

    org.junit.jupiter.api.Assertions.assertEquals(1L, replayGuardRepository.count());
  }

  @Test
  void repositoryDeleteQueriesShouldWork() {
    Instant now = Instant.now(clock);
    seedRows(now);

    int replayDeleted = replayGuardRepository.deleteByExpiresAtBefore(now.plusSeconds(1_000_000L));

    org.junit.jupiter.api.Assertions.assertEquals(2, replayDeleted);
    org.junit.jupiter.api.Assertions.assertEquals(0L, replayGuardRepository.count());
  }

  private void seedRows(Instant now) {
    long nowMs = now.toEpochMilli();

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("act_cleanup_1");
    activity.setActivityTitle("Cleanup test");
    activity.setActivityType("test");
    activity.setStartTime(now.minusSeconds(60));
    activity.setEndTime(now.plusSeconds(60));
    activity.setLocation("room");
    activity.setDescription("desc");
    activity.setProgressStatus("ongoing");
    activity.setSupportCheckout(true);
    activity.setHasDetail(true);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(0);
    activity.setRotateSeconds(10);
    activity.setGraceSeconds(20);
    activity.setActive(true);
    activityRepository.save(activity);

    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setWxIdentity("wx_cleanup_user_1");
    userRepository.save(user);

    WxReplayGuardEntity oldGuard = new WxReplayGuardEntity();
    oldGuard.setUser(user);
    oldGuard.setActivityId(activity.getActivityId());
    oldGuard.setActionType("checkin");
    oldGuard.setSlot(1L);
    oldGuard.setExpiresAt(now.minusSeconds(1));
    replayGuardRepository.save(oldGuard);

    WxReplayGuardEntity newGuard = new WxReplayGuardEntity();
    newGuard.setUser(user);
    newGuard.setActivityId(activity.getActivityId());
    newGuard.setActionType("checkin");
    newGuard.setSlot(2L);
    newGuard.setExpiresAt(now.plusSeconds(60));
    replayGuardRepository.save(newGuard);
  }
}
