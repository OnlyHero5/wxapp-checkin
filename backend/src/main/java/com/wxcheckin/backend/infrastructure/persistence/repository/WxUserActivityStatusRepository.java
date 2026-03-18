package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WxUserActivityStatusRepository extends JpaRepository<WxUserActivityStatusEntity, Long> {
  Optional<WxUserActivityStatusEntity> findByUserIdAndActivityId(Long userId, String activityId);

  List<WxUserActivityStatusEntity> findByUserId(Long userId);

  boolean existsByUserId(Long userId);

  List<WxUserActivityStatusEntity> findByUserIdAndActivityIdIn(Long userId, List<String> activityIds);

  @Query(
      """
          select s from WxUserActivityStatusEntity s
          join fetch s.user u
          where s.activityId = :activityId
            and s.registered = true
          order by u.studentId asc, u.id asc
          """
  )
  List<WxUserActivityStatusEntity> findRegisteredByActivityIdOrderByStudentId(@Param("activityId") String activityId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from WxUserActivityStatusEntity s where s.user.id = :userId and s.activityId = :activityId")
  Optional<WxUserActivityStatusEntity> lockByUserIdAndActivityId(@Param("userId") Long userId, @Param("activityId") String activityId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from WxUserActivityStatusEntity s where s.activityId = :activityId and s.status = :status")
  List<WxUserActivityStatusEntity> lockByActivityIdAndStatus(
      @Param("activityId") String activityId,
      @Param("status") String status
  );

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
          select s from WxUserActivityStatusEntity s
          join fetch s.user u
          where s.activityId = :activityId
            and s.registered = true
            and u.id in :userIds
          order by u.id asc
          """
  )
  List<WxUserActivityStatusEntity> lockRegisteredByActivityIdAndUserIds(
      @Param("activityId") String activityId,
      @Param("userIds") List<Long> userIds
  );
}
