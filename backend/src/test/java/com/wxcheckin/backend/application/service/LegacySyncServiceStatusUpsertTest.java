package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 回归目标：锁定 `wx_user_activity_status` 的唯一键竞态补偿。
 *
 * <p>真实联调里会出现两个同步入口并发命中同一 `(user_id, activity_id)`：
 * - 普通用户首次进列表触发的 on-demand sync
 * - 定时 `syncFromLegacy()` pull
 *
 * <p>当前实现是“先查再插”，如果两个事务几乎同时看到“还没有 status”，
 * 第二个事务在 `save()` 时会撞唯一键。这里直接模拟这一瞬间：
 * - 第一次查询：查不到
 * - 第一次保存：抛唯一键冲突
 * - 冲突后应该重读已有记录并补写字段，而不是把整次同步打回滚
 */
@ExtendWith(MockitoExtension.class)
class LegacySyncServiceStatusUpsertTest {

  @Mock
  private OutboxRelayService outboxRelayService;

  @Mock
  private JdbcTemplate jdbcTemplate;

  @Mock
  private WxActivityProjectionRepository activityRepository;

  @Mock
  private WxUserAuthExtRepository userRepository;

  @Mock
  private WxUserActivityStatusRepository statusRepository;

  private LegacySyncService legacySyncService;

  @BeforeEach
  void setUp() {
    legacySyncService = new LegacySyncService(
        new AppProperties(),
        outboxRelayService,
        jdbcTemplate,
        activityRepository,
        userRepository,
        statusRepository
    );
  }

  @Test
  void shouldRetryWithExistingStatusWhenInsertHitsUniqueConstraint() throws Exception {
    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setLegacyUserId(11L);
    ReflectionTestUtils.setField(user, "id", 11L);

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_103");
    activity.setLegacyActivityId(103);

    WxUserActivityStatusEntity existingStatus = new WxUserActivityStatusEntity();
    existingStatus.setUser(user);
    existingStatus.setActivityId("legacy_act_103");
    existingStatus.setRegistered(false);
    existingStatus.setStatus("none");

    when(activityRepository.findByLegacyActivityId(103)).thenReturn(Optional.of(activity));
    when(statusRepository.findByUserIdAndActivityId(11L, "legacy_act_103"))
        .thenReturn(Optional.empty())
        .thenReturn(Optional.of(existingStatus));
    when(statusRepository.save(any(WxUserActivityStatusEntity.class)))
        .thenThrow(new DataIntegrityViolationException("duplicate key"))
        .thenAnswer((invocation) -> invocation.getArgument(0));

    Object legacyApplyRow = buildLegacyApplyRow(103, 0, false, false);

    assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(
        legacySyncService,
        "upsertUserStatus",
        user,
        List.of(legacyApplyRow)
    ));

    assertEquals(true, existingStatus.getRegistered());
    assertEquals("none", existingStatus.getStatus());
    verify(statusRepository, times(2)).findByUserIdAndActivityId(11L, "legacy_act_103");
    verify(statusRepository, times(2)).save(any(WxUserActivityStatusEntity.class));
  }

  private Object buildLegacyApplyRow(
      int legacyActivityId,
      int applyState,
      boolean checkIn,
      boolean checkOut
  ) throws Exception {
    Class<?> rowClass = Class.forName("com.wxcheckin.backend.application.service.LegacySyncService$LegacyApplyRow");
    Constructor<?> constructor = rowClass.getDeclaredConstructor();
    constructor.setAccessible(true);
    Object row = constructor.newInstance();
    setField(rowClass, row, "legacyActivityId", legacyActivityId);
    setField(rowClass, row, "applyState", applyState);
    setField(rowClass, row, "checkIn", checkIn);
    setField(rowClass, row, "checkOut", checkOut);
    return row;
  }

  private void setField(Class<?> rowClass, Object row, String fieldName, Object value) throws Exception {
    Field field = rowClass.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(row, value);
  }
}
