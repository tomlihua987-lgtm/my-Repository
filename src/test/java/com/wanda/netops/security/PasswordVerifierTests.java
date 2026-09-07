package com.wanda.netops.security;

import org.junit.jupiter.api.Test;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordVerifierTests {
    @Test
    void verifiesAspNetCoreIdentityV3PasswordHashes() throws Exception {
        String password = "Compatible-Password-123!";
        byte[] salt = "0123456789abcdef".getBytes();
        int iterations = 10_000;
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        byte[] subkey = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        ByteBuffer payload = ByteBuffer.allocate(13 + salt.length + subkey.length).order(ByteOrder.BIG_ENDIAN);
        payload.put((byte) 1).putInt(1).putInt(iterations).putInt(salt.length).put(salt).put(subkey);
        String encoded = Base64.getEncoder().encodeToString(payload.array());
        assertTrue(PasswordVerifier.verifyAspNetIdentityV3(encoded, password));
        assertFalse(PasswordVerifier.verifyAspNetIdentityV3(encoded, "wrong"));
    }

    @Test
    void hashesNewPasswordsInTheCompatibleFormat() {
        String encoded=PasswordVerifier.hashAspNetIdentityV3("New-Password-123!");
        assertTrue(PasswordVerifier.verifyAspNetIdentityV3(encoded,"New-Password-123!"));
        assertFalse(PasswordVerifier.verifyAspNetIdentityV3(encoded,"wrong"));
    }
}
