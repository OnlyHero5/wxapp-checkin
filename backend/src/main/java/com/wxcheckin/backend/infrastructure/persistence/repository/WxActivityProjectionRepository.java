package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WxActivityProjectionRepository extends JpaRepository<WxActivityProjectionEntity, String> {
  List<WxActivityProjectionEntity> findByActiveTrueOrderByStartTimeDesc();

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
