package com.wanda.netops.security;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {
    public static final String SESSION_USER = "netops.user";
    private final JdbcTemplate jdbc;

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> login(String username, String password, HttpSession session) {
        var users = jdbc.query("SELECT id,username,password_hash,role,must_change,display_name,enabled FROM users WHERE username=?", (rs, n) -> {
            Map<String, Object> user = new LinkedHashMap<>();
            user.put("id", rs.getLong("id"));
            user.put("username", rs.getString("username"));
            user.put("passwordHash", rs.getString("password_hash"));
            user.put("role", rs.getString("role"));
            user.put("mustChangePassword", rs.getInt("must_change") != 0);
            user.put("displayName", rs.getString("display_name"));
            user.put("enabled", rs.getInt("enabled") != 0);
            return user;
        }, username);
        if (users.isEmpty() || !Boolean.TRUE.equals(users.get(0).get("enabled"))
                || !PasswordVerifier.verifyAspNetIdentityV3((String) users.get(0).get("passwordHash"), password)) {
            throw new IllegalArgumentException("用户名或密码错误");
        }
        Map<String, Object> safeUser = new LinkedHashMap<>(users.get(0));
        safeUser.remove("passwordHash");
        safeUser.put("requireLogin", true);
        session.setAttribute(SESSION_USER, safeUser);
        return safeUser;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> current(HttpSession session) {
        return (Map<String, Object>) session.getAttribute(SESSION_USER);
    }

    public void changePassword(String currentPassword, String newPassword, HttpSession session) {
        Map<String,Object> user=current(session);
        if(newPassword==null||newPassword.length()<8)throw new IllegalArgumentException("新密码至少 8 位");
        String hash=jdbc.queryForObject("SELECT password_hash FROM users WHERE id=?",String.class,user.get("id"));
        if(hash==null||!PasswordVerifier.verifyAspNetIdentityV3(hash,currentPassword))throw new IllegalArgumentException("当前密码错误");
        jdbc.update("UPDATE users SET password_hash=?,must_change=0 WHERE id=?",PasswordVerifier.hashAspNetIdentityV3(newPassword),user.get("id"));
        user.put("mustChangePassword",false);
    }
}
