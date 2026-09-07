package com.wanda.netops.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class AuditService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AuditService(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    public void write(String user, String action, String type, String key, Object before, Object after) {
        try {
            jdbc.update("INSERT INTO audit_logs(user_name,action,object_type,object_key,before_json,after_json,created_at,client_ip) VALUES(?,?,?,?,?,?,?,?)",
                    user == null ? "system" : user, action, type, key,
                    before == null ? null : mapper.writeValueAsString(before), after == null ? null : mapper.writeValueAsString(after),
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")), "127.0.0.1");
        } catch (Exception exception) {
            throw new IllegalStateException("审计记录写入失败", exception);
        }
    }
}
