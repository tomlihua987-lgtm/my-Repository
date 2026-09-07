package com.wanda.netops.resource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wanda.netops.common.AuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class NetOpsMutationService {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final NetOpsQueryService queries;
    private final AuditService audit;

    public NetOpsMutationService(JdbcTemplate jdbc, ObjectMapper mapper, NetOpsQueryService queries, AuditService audit) {
        this.jdbc = jdbc; this.mapper = mapper; this.queries = queries; this.audit = audit;
    }

    @Transactional
    public Map<String, Object> updateResource(long id, Map<String, Object> body, String user) {
        Map<String, Object> before = queries.resource(id);
        try {
            jdbc.update("UPDATE resource_records SET location=?,subcategory=?,name=?,ip=?,status=?,details_json=? WHERE id=?",
                    text(body, "location", before.get("location")), text(body, "subcategory", before.get("subcategory")),
                    text(body, "name", before.get("name")), text(body, "ip", before.get("ip")), text(body, "status", before.get("status")),
                    mapper.writeValueAsString(body.getOrDefault("details", before.get("details"))), id);
        } catch (Exception exception) { throw new IllegalArgumentException("资源更新失败：" + exception.getMessage()); }
        Map<String, Object> after = queries.resource(id); audit.write(user, "更新资源", "resource", String.valueOf(id), before, after); return after;
    }

    @Transactional
    public Map<String, Object> updateResourceStatus(long id, Map<String, Object> body, String user) {
        Map<String, Object> before = queries.resource(id);
        jdbc.update("UPDATE resource_records SET status=? WHERE id=?", text(body, "status", ""), id);
        Map<String, Object> after = queries.resource(id); audit.write(user, "更新资源状态", "resource", String.valueOf(id), before, after); return after;
    }

    @Transactional
    public Map<String, Object> updateAddress(long id, Map<String, Object> body, String user) {
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM addresses WHERE id=?", id);
        String status = text(body, "status", before.get("status"));
        boolean release = "可用".equals(status);
        String now = LocalDateTime.now().format(TIME);
        jdbc.update("UPDATE addresses SET status=?,hostname=?,device_type=?,system_name=?,owner=?,mac_address=?,location=?,ticket_no=?,remarks=?,business=?,domain=?,real_ip=?,nat_dir=?,allocated_at=?,released_at=?,updated_at=? WHERE id=?",
                status, release ? null : text(body,"hostname",before.get("hostname")), release ? null : text(body,"deviceType",before.get("device_type")),
                release ? null : text(body,"systemName",before.get("system_name")), release ? null : text(body,"owner",before.get("owner")),
                release ? null : text(body,"macAddress",before.get("mac_address")), release ? null : text(body,"location",before.get("location")),
                release ? null : text(body,"ticketNo",before.get("ticket_no")), text(body,"remarks",release ? null : before.get("remarks")),
                release ? null : text(body,"business",before.get("business")), release ? null : text(body,"domain",before.get("domain")),
                release ? null : text(body,"realIp",before.get("real_ip")), release ? null : text(body,"natDir",before.get("nat_dir")),
                "已分配".equals(status) ? now : before.get("allocated_at"), release ? now : before.get("released_at"), now, id);
        Map<String, Object> after = jdbc.queryForMap("SELECT * FROM addresses WHERE id=?", id);
        audit.write(user, release ? "回收IP" : "更新IP", "address", String.valueOf(before.get("ip")), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> allocateSubnet(long id, Map<String, Object> body, String user) {
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM subnets WHERE id=? AND deleted=0", id);
        jdbc.update("UPDATE subnets SET module=?,owner=?,gateway=?,vlan_id=?,remarks=?,floor=coalesce(?,floor),net_type=coalesce(?,net_type),status='已使用',updated_at=? WHERE id=?",
                text(body,"module",before.get("module")), text(body,"owner",before.get("owner")), text(body,"gateway",before.get("gateway")),
                text(body,"vlanId",before.get("vlan_id")), text(body,"remarks",before.get("remarks")), emptyToNull(body.get("floor")), emptyToNull(body.get("netType")), now(), id);
        int freed = jdbc.update("UPDATE addresses SET status='可用',updated_at=? WHERE subnet_id=? AND status='预留' AND remarks NOT IN ('网络地址','广播地址','网关')", now(), id);
        Map<String, Object> after = jdbc.queryForMap("SELECT * FROM subnets WHERE id=?", id); audit.write(user,"划拨网段","subnet",String.valueOf(before.get("cidr")),before,after);
        return Map.of("id", id, "cidr", before.get("cidr"), "freed", freed);
    }

    @Transactional
    public Map<String, Object> releaseSubnet(long id, String user) {
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM subnets WHERE id=? AND deleted=0", id);
        Integer used = jdbc.queryForObject("SELECT count(*) FROM addresses WHERE subnet_id=? AND status='已分配'", Integer.class, id);
        if (used != null && used > 0) throw new IllegalArgumentException("段内仍有已分配地址，请先逐个回收");
        jdbc.update("UPDATE subnets SET module='预留',status='预留',updated_at=? WHERE id=?", now(), id);
        jdbc.update("UPDATE addresses SET status='预留',updated_at=? WHERE subnet_id=?", now(), id);
        Map<String, Object> after = jdbc.queryForMap("SELECT * FROM subnets WHERE id=?", id); audit.write(user,"回收网段","subnet",String.valueOf(before.get("cidr")),before,after);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> allocateAddresses(long subnetId, Map<String, Object> body, String user) {
        int count = Math.max(1, Math.min(256, Integer.parseInt(String.valueOf(body.getOrDefault("count", 1)))));
        String start = text(body,"startIp",null);
        String sql = "SELECT id,ip FROM addresses WHERE subnet_id=? AND status='可用'" + (start == null || start.isBlank() ? "" : " AND ip_num>=?") + " ORDER BY ip_num LIMIT ?";
        List<Map<String, Object>> free = start == null || start.isBlank() ? jdbc.queryForList(sql, subnetId, count) : jdbc.queryForList(sql, subnetId, ipv4ToLong(start), count);
        if (free.size() < count) throw new IllegalArgumentException("没有足够的连续可用地址");
        List<String> ips = new ArrayList<>(); String baseName = text(body,"hostname",null);
        for (int i=0;i<free.size();i++) {
            Map<String,Object> row=free.get(i); String hostname=baseName;
            if (count>1 && hostname!=null && !hostname.isBlank()) hostname += String.format("-%02d",i+1);
            jdbc.update("UPDATE addresses SET status='已分配',hostname=?,device_type=?,system_name=?,owner=?,ticket_no=?,remarks=?,allocated_at=?,updated_at=? WHERE id=? AND status='可用'",
                    hostname,text(body,"deviceType",null),text(body,"systemName",null),text(body,"owner",null),text(body,"ticketNo",null),text(body,"remarks",null),now(),now(),row.get("id"));
            ips.add(String.valueOf(row.get("ip")));
        }
        String cidr=jdbc.queryForObject("SELECT cidr FROM subnets WHERE id=?",String.class,subnetId); audit.write(user,"批量分配IP","subnet",cidr,null,Map.of("ips",ips));
        return Map.of("cidr",cidr,"count",ips.size(),"ips",ips);
    }

    private static String text(Map<String,Object> body,String key,Object fallback){Object value=body.containsKey(key)?body.get(key):fallback;return value==null?null:String.valueOf(value);}
    private static String emptyToNull(Object value){return value==null||String.valueOf(value).isBlank()?null:String.valueOf(value);}
    private static String now(){return LocalDateTime.now().format(TIME);}
    private static long ipv4ToLong(String ip){long n=0;String[] p=ip.split("\\.");if(p.length!=4)throw new IllegalArgumentException("IP 格式错误");for(String x:p)n=n*256+Integer.parseInt(x);return n;}
}
