package com.wxcheckin.backend.application.support;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Safe JSON utility wrapper used by persistence-backed JSON fields.
 */
@Component
public class JsonCodec {
  private final ObjectMapper objectMapper;

  public JsonCodec(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String writeList(List<String> value) {
    try {
      return objectMapper.writeValueAsString(value == null ? List.of() : value);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Cannot serialize permission list", ex);
    }
  }

  public List<String> readStringList(String json) {
    if (json == null || json.isBlank()) {
      return List.of();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<>() {
      });
    } catch (JsonProcessingException ex) {
      return List.of();
    }
  }

  public String writeMap(Map<String, Object> map) {
    try {
      return objectMapper.writeValueAsString(map == null ? Collections.emptyMap() : map);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Cannot serialize outbox payload", ex);
    }
  }

  public Map<String, Object> readMap(String json) {
    if (json == null || json.isBlank()) {
      return Collections.emptyMap();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<>() {
      });
    } catch (JsonProcessingException ex) {
      return Collections.emptyMap();
    }
  }
}
