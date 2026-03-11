package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.repository.query.Param;

public interface WxActivityProjectionRepository extends JpaRepository<WxActivityProjectionEntity, String> {
  List<WxActivityProjectionEntity> findByActiveTrueOrderByStartTimeDesc();

  Slice<WxActivityProjectionEntity> findByActiveTrueOrderByStartTimeDesc(Pageable pageable);

  @Query(
      """
          select a from WxActivityProjectionEntity a
          join WxUserActivityStatusEntity s on s.activityId = a.activityId
          where a.active = true
            and s.user.id = :userId
            and (s.registered = true or s.status <> 'none')
          order by a.startTime desc
          """
  )
  Slice<WxActivityProjectionEntity> findVisibleForUser(@Param("userId") Long userId, Pageable pageable);

  Optional<WxActivityProjectionEntity> findByActivityIdAndActiveTrue(String activityId);

  Optional<WxActivityProjectionEntity> findByLegacyActivityId(Integer legacyActivityId);

  @Modifying
  @Query(
      value = """
          UPDATE wx_activity_projection
          SET checkin_count = GREATEST(checkin_count + :checkinDelta, 0),
              checkout_count = GREATEST(checkout_count + :checkoutDelta, 0)
          WHERE activity_id = :activityId
          """,
      nativeQuery = true
  )
  int adjustCounts(
      @Param("activityId") String activityId,
      @Param("checkinDelta") int checkinDelta,
      @Param("checkoutDelta") int checkoutDelta
  );
}
