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

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from WxUserActivityStatusEntity s where s.user.id = :userId and s.activityId = :activityId")
  Optional<WxUserActivityStatusEntity> lockByUserIdAndActivityId(@Param("userId") Long userId, @Param("activityId") String activityId);
}
