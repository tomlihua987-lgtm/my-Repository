package com.wanda.netops.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final JdbcTemplate jdbc;
    public AuditController(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @GetMapping
    public List<Map<String,Object>> list(@RequestParam(required=false)String q,@RequestParam(required=false)String user,@RequestParam(required=false)String action,@RequestParam(defaultValue="1000")int limit){StringBuilder sql=new StringBuilder("SELECT * FROM audit_logs WHERE 1=1");var args=new java.util.ArrayList<Object>();if(user!=null&&!user.isBlank()){sql.append(" AND user_name=?");args.add(user);}if(action!=null&&!action.isBlank()){sql.append(" AND action=?");args.add(action);}if(q!=null&&!q.isBlank()){sql.append(" AND (object_key LIKE ? OR before_json LIKE ? OR after_json LIKE ?)");args.add("%"+q+"%");args.add("%"+q+"%");args.add("%"+q+"%");}sql.append(" ORDER BY id DESC LIMIT ?");args.add(Math.min(limit,5000));return jdbc.query(sql.toString(),(rs,n)->{Map<String,Object>m=new LinkedHashMap<>();m.put("id",rs.getLong("id"));m.put("userName",rs.getString("user_name"));m.put("action",rs.getString("action"));m.put("objectType",rs.getString("object_type"));m.put("objectKey",rs.getString("object_key"));m.put("beforeJson",rs.getString("before_json"));m.put("afterJson",rs.getString("after_json"));m.put("createdAt",rs.getString("created_at"));m.put("clientIp",rs.getString("client_ip"));return m;},args.toArray());}

    @GetMapping("/stats")
    public Map<String,Object> stats(){List<Map<String,Object>> users=jdbc.queryForList("SELECT a.user_name userName,u.display_name displayName,count(*) count,max(a.created_at) lastAt FROM audit_logs a LEFT JOIN users u ON u.username=a.user_name GROUP BY a.user_name,u.display_name ORDER BY count DESC");List<Map<String,Object>> actions=jdbc.queryForList("SELECT action key,count(*) count FROM audit_logs GROUP BY action ORDER BY count DESC");Long total=jdbc.queryForObject("SELECT count(*) FROM audit_logs",Long.class);Long today=jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE date(created_at)=date('now','localtime')",Long.class);Long todayUsers=jdbc.queryForObject("SELECT count(DISTINCT user_name) FROM audit_logs WHERE date(created_at)=date('now','localtime')",Long.class);Long week=jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE datetime(created_at)>=datetime('now','-7 day')",Long.class);Long weekUsers=jdbc.queryForObject("SELECT count(DISTINCT user_name) FROM audit_logs WHERE datetime(created_at)>=datetime('now','-7 day')",Long.class);List<Map<String,Object>>weekActions=jdbc.queryForList("SELECT action key,count(*) count FROM audit_logs WHERE datetime(created_at)>=datetime('now','-7 day') GROUP BY action ORDER BY count DESC");Map<String,Object>m=new LinkedHashMap<>();m.put("total",total);m.put("today",today);m.put("todayUsers",todayUsers);m.put("week",week);m.put("weekUsers",weekUsers);m.put("weekActions",weekActions);m.put("failedLogins7d",0);m.put("users",users);m.put("actions",actions);return m;}
}
