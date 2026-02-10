package com.wxcheckin.backend.api.error;

/**
 * Business-layer exception mapped to contract-level response payloads.
 *
 * <p>Per API specification, business failures still return HTTP 200 while
 * conveying status via JSON fields ({@code status/message/error_code}).</p>
 */
public class BusinessException extends RuntimeException {
  private final String status;
  private final String errorCode;

  public BusinessException(String status, String message) {
    this(status, message, null);
  }

  public BusinessException(String status, String message, String errorCode) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }

  public String getStatus() {
    return status;
  }

  public String getErrorCode() {
    return errorCode;
  }
}
