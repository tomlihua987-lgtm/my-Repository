package com.wanda.netops.security;

import com.wanda.netops.common.AuditService;
import com.wanda.netops.common.SessionUser;
import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    public UserController(JdbcTemplate jdbc, AuditService audit){this.jdbc=jdbc;this.audit=audit;}

    @GetMapping
    public List<Map<String,Object>> list(HttpSession session){SessionUser.requireAdmin(session);return jdbc.query("SELECT id,username,display_name,role,must_change,enabled,created_at FROM users ORDER BY id",(rs,n)->{Map<String,Object> m=new LinkedHashMap<>();m.put("id",rs.getLong("id"));m.put("username",rs.getString("username"));m.put("displayName",rs.getString("display_name"));m.put("role",rs.getString("role"));m.put("mustChangePassword",rs.getInt("must_change")!=0);m.put("enabled",rs.getInt("enabled")!=0);m.put("createdAt",rs.getString("created_at"));return m;});}

    @PostMapping @Transactional
    public Map<String,Object> create(@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireAdmin(session);String password=required(body,"password");if(password.length()<8)throw new IllegalArgumentException("密码至少 8 位");jdbc.update("INSERT INTO users(username,password_hash,role,must_change,created_at,display_name,enabled) VALUES(?,?,?,1,?,?,1)",required(body,"username"),PasswordVerifier.hashAspNetIdentityV3(password),required(body,"role"),now(),text(body,"displayName"));long id=jdbc.queryForObject("SELECT last_insert_rowid()",Long.class);audit.write(SessionUser.name(session),"创建用户","user",String.valueOf(id),null,Map.of("username",body.get("username")));return Map.of("id",id);}

    @PutMapping("/{id}") @Transactional
    public Map<String,Object> update(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireAdmin(session);jdbc.update("UPDATE users SET display_name=?,role=?,enabled=? WHERE id=?",text(body,"displayName"),required(body,"role"),Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled",true)))?1:0,id);audit.write(SessionUser.name(session),"更新用户","user",String.valueOf(id),null,body);return Map.of("ok",true);}

    @PostMapping("/{id}/reset-password") @Transactional
    public Map<String,Object> reset(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireAdmin(session);String password=required(body,"newPassword");if(password.length()<8)throw new IllegalArgumentException("密码至少 8 位");jdbc.update("UPDATE users SET password_hash=?,must_change=1 WHERE id=?",PasswordVerifier.hashAspNetIdentityV3(password),id);audit.write(SessionUser.name(session),"重置密码","user",String.valueOf(id),null,null);return Map.of("ok",true);}

    private static String required(Map<String,Object>b,String k){String v=text(b,k);if(v==null||v.isBlank())throw new IllegalArgumentException(k+" 不能为空");return v;}
    private static String text(Map<String,Object>b,String k){return b.get(k)==null?null:String.valueOf(b.get(k));}
    private static String now(){return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));}
}
