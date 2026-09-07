package com.wanda.netops.common;

import com.wanda.netops.security.AuthService;
import jakarta.servlet.http.HttpSession;

import java.util.Map;

public final class SessionUser {
    private SessionUser() {}
    @SuppressWarnings("unchecked")
    public static Map<String, Object> get(HttpSession session) { return (Map<String, Object>) session.getAttribute(AuthService.SESSION_USER); }
    public static String name(HttpSession session) { return String.valueOf(get(session).get("username")); }
    public static void requireWritable(HttpSession session) {
        if ("只读用户".equals(get(session).get("role"))) throw new SecurityException("只读用户不能修改数据");
    }
    public static void requireAdmin(HttpSession session) {
        if (!"管理员".equals(get(session).get("role"))) throw new SecurityException("需要管理员权限");
    }
}
