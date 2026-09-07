package com.wanda.netops.security;

import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "application", "wanda-netops-java");
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpSession session) {
        return authService.login(body.getOrDefault("username", ""), body.getOrDefault("password", ""), session);
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        return authService.current(session);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpSession session) {
        session.invalidate();
        return Map.of("ok", true);
    }

    @PostMapping("/change-password")
    public Map<String,Object> changePassword(@RequestBody Map<String,String> body,HttpSession session){authService.changePassword(body.get("currentPassword"),body.get("newPassword"),session);return Map.of("ok",true);}
}
