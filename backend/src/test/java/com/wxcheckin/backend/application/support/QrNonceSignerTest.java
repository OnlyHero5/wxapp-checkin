package com.wxcheckin.backend.application.support;

import com.wxcheckin.backend.domain.model.ActionType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class QrNonceSignerTest {

  @Test
  void signAndVerify_success() {
    QrNonceSigner signer = new QrNonceSigner("test-signing-key");
    String randomPart = "aaaaaaaaaaaaaaaaaaaaaa"; // 22 chars (base64url-like)

    String nonce = signer.sign("act_1", ActionType.CHECKIN, 123L, randomPart);

    assertEquals(65, nonce.length(), "signed nonce should be random(22) + sig(43) = 65 chars");
    assertTrue(signer.isSigned(nonce));
    assertTrue(signer.verify("act_1", ActionType.CHECKIN, 123L, nonce));
  }

  @Test
  void verify_failsWhenActivityIdTampered() {
    QrNonceSigner signer = new QrNonceSigner("test-signing-key");
    String nonce = signer.sign("act_1", ActionType.CHECKIN, 123L, "aaaaaaaaaaaaaaaaaaaaaa");

    assertFalse(signer.verify("act_2", ActionType.CHECKIN, 123L, nonce));
  }

  @Test
  void verify_failsWhenSlotTampered() {
    QrNonceSigner signer = new QrNonceSigner("test-signing-key");
    String nonce = signer.sign("act_1", ActionType.CHECKIN, 123L, "aaaaaaaaaaaaaaaaaaaaaa");

    assertFalse(signer.verify("act_1", ActionType.CHECKIN, 124L, nonce));
  }

  @Test
  void verify_failsWhenActionTypeTampered() {
    QrNonceSigner signer = new QrNonceSigner("test-signing-key");
    String nonce = signer.sign("act_1", ActionType.CHECKIN, 123L, "aaaaaaaaaaaaaaaaaaaaaa");

    assertFalse(signer.verify("act_1", ActionType.CHECKOUT, 123L, nonce));
  }

  @Test
  void verify_failsWithWrongSigningKey() {
    String nonce = new QrNonceSigner("key-A")
        .sign("act_1", ActionType.CHECKIN, 123L, "aaaaaaaaaaaaaaaaaaaaaa");

    assertFalse(new QrNonceSigner("key-B").verify("act_1", ActionType.CHECKIN, 123L, nonce));
  }

  @Test
  void legacyNonce_isNotSignedAndDoesNotVerify() {
    QrNonceSigner signer = new QrNonceSigner("test-signing-key");
    String legacyNonce = "legacy_nonce_123";

    assertFalse(signer.isSigned(legacyNonce));
    assertFalse(signer.verify("act_1", ActionType.CHECKIN, 123L, legacyNonce));
  }
}

