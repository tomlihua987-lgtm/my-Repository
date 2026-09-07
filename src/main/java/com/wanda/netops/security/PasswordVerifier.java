package com.wanda.netops.security;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

final class PasswordVerifier {
    private PasswordVerifier() {}

    static boolean verifyAspNetIdentityV3(String encodedHash, String password) {
        try {
            byte[] payload = Base64.getDecoder().decode(encodedHash);
            if (payload.length < 14 || payload[0] != 1) return false;
            ByteBuffer header = ByteBuffer.wrap(payload).order(ByteOrder.BIG_ENDIAN);
            header.get();
            int prf = header.getInt();
            int iterations = header.getInt();
            int saltLength = header.getInt();
            if (saltLength < 8 || 13 + saltLength >= payload.length) return false;
            byte[] salt = Arrays.copyOfRange(payload, 13, 13 + saltLength);
            byte[] expected = Arrays.copyOfRange(payload, 13 + saltLength, payload.length);
            String algorithm = switch (prf) {
                case 0 -> "PBKDF2WithHmacSHA1";
                case 1 -> "PBKDF2WithHmacSHA256";
                case 2 -> "PBKDF2WithHmacSHA512";
                default -> throw new IllegalArgumentException("Unsupported password PRF");
            };
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, expected.length * 8);
            byte[] actual = SecretKeyFactory.getInstance(algorithm).generateSecret(spec).getEncoded();
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception ignored) {
            return false;
        }
    }

    static String hashAspNetIdentityV3(String password) {
        try {
            int iterations = 100_000;
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
            byte[] subkey = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            ByteBuffer payload = ByteBuffer.allocate(13 + salt.length + subkey.length).order(ByteOrder.BIG_ENDIAN);
            payload.put((byte) 1).putInt(1).putInt(iterations).putInt(salt.length).put(salt).put(subkey);
            return Base64.getEncoder().encodeToString(payload.array());
        } catch (Exception exception) {
            throw new IllegalStateException("Password hashing failed", exception);
        }
    }
}
