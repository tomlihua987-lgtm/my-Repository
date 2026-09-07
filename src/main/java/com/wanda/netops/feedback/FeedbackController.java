package com.wanda.netops.feedback;

import com.wanda.netops.common.AuditService;
import com.wanda.netops.common.SessionUser;
import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {
    private static final List<String> STATUSES=List.of("待处理","处理中","已采纳","已完成","暂不处理");
    private static final List<String> CATEGORIES=List.of("功能建议","问题反馈","数据纠错","界面体验","其他");
    private final JdbcTemplate jdbc; private final AuditService audit;
    public FeedbackController(JdbcTemplate jdbc,AuditService audit){this.jdbc=jdbc;this.audit=audit;}

    @GetMapping
    public List<Map<String,Object>> list(@RequestParam(required=false)String q,@RequestParam(required=false)String category,@RequestParam(required=false)String status,@RequestParam(defaultValue="false")boolean mine,@RequestParam(defaultValue="500")int limit,HttpSession session){StringBuilder sql=new StringBuilder("SELECT f.*,u.display_name,(SELECT count(*) FROM feedback_comments c WHERE c.feedback_id=f.id) comment_count FROM feedback f LEFT JOIN users u ON u.username=f.user_name WHERE 1=1");List<Object>args=new ArrayList<>();if(mine){sql.append(" AND f.user_name=?");args.add(SessionUser.name(session));}if(category!=null&&!category.isBlank()){sql.append(" AND f.category=?");args.add(category);}if(status!=null&&!status.isBlank()){sql.append(" AND f.status=?");args.add(status);}if(q!=null&&!q.isBlank()){sql.append(" AND (f.title LIKE ? OR f.content LIKE ?)");args.add("%"+q+"%");args.add("%"+q+"%");}sql.append(" ORDER BY f.id DESC LIMIT ?");args.add(Math.min(limit,1000));return jdbc.query(sql.toString(),(rs,n)->{Map<String,Object>m=new LinkedHashMap<>();m.put("id",rs.getLong("id"));m.put("userName",rs.getString("user_name"));m.put("displayName",rs.getString("display_name"));m.put("category",rs.getString("category"));m.put("module",rs.getString("module"));m.put("title",rs.getString("title"));m.put("content",rs.getString("content"));m.put("status",rs.getString("status"));m.put("handler",rs.getString("handler"));m.put("handleNote",rs.getString("handle_note"));m.put("handledAt",rs.getString("handled_at"));m.put("createdAt",rs.getString("created_at"));m.put("commentCount",rs.getInt("comment_count"));m.put("files",List.of());return m;},args.toArray());}

    @GetMapping("/stats")
    public Map<String,Object> stats(HttpSession session){Map<String,Integer>byStatus=new LinkedHashMap<>();for(Map<String,Object>r:jdbc.queryForList("SELECT status,count(*) count FROM feedback GROUP BY status"))byStatus.put(String.valueOf(r.get("status")),((Number)r.get("count")).intValue());Map<String,Integer>byCategory=new LinkedHashMap<>();for(Map<String,Object>r:jdbc.queryForList("SELECT category,count(*) count FROM feedback GROUP BY category"))byCategory.put(String.valueOf(r.get("category")),((Number)r.get("count")).intValue());Long total=jdbc.queryForObject("SELECT count(*) FROM feedback",Long.class);Long contributors=jdbc.queryForObject("SELECT count(DISTINCT user_name) FROM feedback",Long.class);Long comments=jdbc.queryForObject("SELECT count(*) FROM feedback_comments",Long.class);Long mine=jdbc.queryForObject("SELECT count(*) FROM feedback WHERE user_name=?",Long.class,SessionUser.name(session));return Map.of("statuses",STATUSES,"categories",CATEGORIES,"byStatus",byStatus,"byCategory",byCategory,"total",total,"contributors",contributors,"comments",comments,"mine",mine,"files",0,"images",0);}

    @GetMapping("/{id}")
    public Map<String,Object> detail(@PathVariable long id,HttpSession session){Map<String,Object> item=list(null,null,null,false,1000,session).stream().filter(x->((Number)x.get("id")).longValue()==id).findFirst().orElseThrow(()->new IllegalArgumentException("意见不存在"));List<Map<String,Object>>comments=jdbc.queryForList("SELECT c.user_name userName,u.display_name displayName,c.content,c.created_at createdAt FROM feedback_comments c LEFT JOIN users u ON u.username=c.user_name WHERE c.feedback_id=? ORDER BY c.id",id);item.put("comments",comments);return item;}

    @PostMapping(consumes="multipart/form-data") @Transactional
    public Map<String,Object> create(@RequestParam String category,@RequestParam(required=false)String module,@RequestParam String title,@RequestParam(required=false,defaultValue="")String content,@RequestParam(required=false)List<MultipartFile> files,HttpSession session){if(title.trim().length()<2)throw new IllegalArgumentException("标题至少 2 个字");String now=now();jdbc.update("INSERT INTO feedback(user_name,category,module,title,content,status,created_at,updated_at) VALUES(?,?,?,?,?,'待处理',?,?)",SessionUser.name(session),category,module,title.trim(),content,now,now);Long id=jdbc.queryForObject("SELECT last_insert_rowid()",Long.class);audit.write(SessionUser.name(session),"提交意见","协同意见",String.valueOf(id),null,Map.of("title",title));return Map.of("id",id);}

    @PostMapping("/{id}/comments") @Transactional
    public Map<String,Object> comment(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){String content=String.valueOf(body.getOrDefault("content","")).trim();if(content.isBlank())throw new IllegalArgumentException("回复不能为空");jdbc.update("INSERT INTO feedback_comments(feedback_id,user_name,content,created_at) VALUES(?,?,?,?)",id,SessionUser.name(session),content,now());jdbc.update("UPDATE feedback SET updated_at=? WHERE id=?",now(),id);return Map.of("ok",true);}

    @PutMapping("/{id}/status") @Transactional
    public Map<String,Object> status(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireAdmin(session);String status=String.valueOf(body.getOrDefault("status","处理中"));if(!STATUSES.contains(status))throw new IllegalArgumentException("状态不合法");jdbc.update("UPDATE feedback SET status=?,handle_note=?,handler=?,handled_at=?,updated_at=? WHERE id=?",status,String.valueOf(body.getOrDefault("note","")),SessionUser.name(session),now(),now(),id);return Map.of("ok",true);}

    @DeleteMapping("/{id}") @Transactional
    public Map<String,Object> delete(@PathVariable long id,HttpSession session){Map<String,Object>row=jdbc.queryForMap("SELECT user_name,title FROM feedback WHERE id=?",id);if(!SessionUser.name(session).equals(row.get("user_name"))&&!"管理员".equals(SessionUser.get(session).get("role")))throw new SecurityException("只能删除自己提交的意见");jdbc.update("DELETE FROM feedback_comments WHERE feedback_id=?",id);jdbc.update("DELETE FROM feedback_files WHERE feedback_id=?",id);jdbc.update("DELETE FROM feedback WHERE id=?",id);audit.write(SessionUser.name(session),"删除意见","协同意见",String.valueOf(id),row,null);return Map.of("ok",true);}
    private static String now(){return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));}
}
