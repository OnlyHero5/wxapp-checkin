package com.wxcheckin.backend.application.service;

import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Reads legacy user identifiers without introducing hard dependency on legacy schema.
 */
@Service
public class LegacyUserLookupService {

  private final JdbcTemplate jdbcTemplate;

  public LegacyUserLookupService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public Optional<Long> findLegacyUserIdByStudentId(String studentId) {
    String normalized = studentId == null ? "" : studentId.trim();
    if (normalized.isEmpty()) {
      return Optional.empty();
    }
    try {
      List<Long> result = jdbcTemplate.query(
          "SELECT id FROM suda_user WHERE username = ? LIMIT 1",
          (rs, rowNum) -> rs.getLong("id"),
          normalized
      );
      return result.stream().findFirst();
    } catch (DataAccessException ex) {
      // Legacy table may not exist in all environments.
      return Optional.empty();
    }
  }
}
