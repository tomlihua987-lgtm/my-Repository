package com.wanda.netops.resource;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@Service
public class NetOpsQueryService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public NetOpsQueryService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<Map<String, Object>> resources(String category, String location, String q, int limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM resource_records WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (category != null && !category.isBlank()) {
            String[] values = category.split(",");
            sql.append(" AND category IN (").append(String.join(",", Collections.nCopies(values.length, "?"))).append(")");
            args.addAll(Arrays.asList(values));
        }
        if (location != null && !location.isBlank()) { sql.append(" AND location=?"); args.add(location); }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (name LIKE ? OR ip LIKE ? OR status LIKE ? OR subcategory LIKE ? OR details_json LIKE ?)");
            String like = "%" + q + "%";
            args.addAll(Collections.nCopies(5, like));
        }
        sql.append(" ORDER BY id LIMIT ?");
        args.add(Math.max(1, Math.min(limit, 5000)));
        return jdbc.query(sql.toString(), this::resourceRow, args.toArray());
    }

    public Map<String, Object> resource(long id) {
        return jdbc.query("SELECT * FROM resource_records WHERE id=?", this::resourceRow, id).stream()
                .findFirst().orElseThrow(() -> new IllegalArgumentException("资源不存在"));
    }

    public List<Map<String, Object>> resourceStats() {
        return jdbc.query("SELECT category,subcategory,count(*) count FROM resource_records GROUP BY category,subcategory ORDER BY category,subcategory",
                (rs, n) -> mapOf("category", rs.getString(1), "subcategory", rs.getString(2), "count", rs.getLong(3)));
    }

    public List<Map<String, Object>> subnets(String kind, String q, String zone, String status) {
        StringBuilder sql = new StringBuilder("SELECT s.*,(s.network_end-s.network_start+1) total,")
                .append("(SELECT count(*) FROM addresses a WHERE a.subnet_id=s.id AND a.status='已分配') used,")
                .append("(SELECT count(*) FROM addresses a WHERE a.subnet_id=s.id AND a.status='预留') reserved ")
                .append("FROM subnets s WHERE s.deleted=0");
        List<Object> args = new ArrayList<>();
        if (kind != null && !kind.isBlank() && !"all".equals(kind)) { sql.append(" AND s.kind=?"); args.add(kind); }
        if (zone != null && !zone.isBlank()) { sql.append(" AND s.zone=?"); args.add(zone); }
        if (status != null && !status.isBlank()) { sql.append(" AND s.status=?"); args.add(status); }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (s.cidr LIKE ? OR s.zone LIKE ? OR s.module LIKE ? OR s.remarks LIKE ? OR s.site LIKE ?)");
            args.addAll(Collections.nCopies(5, "%" + q + "%"));
        }
        sql.append(" ORDER BY s.kind,s.network_start");
        return jdbc.query(sql.toString(), this::subnetRow, args.toArray());
    }

    public List<Map<String, Object>> addresses(long subnetId, String q, String status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM addresses WHERE subnet_id=?");
        List<Object> args = new ArrayList<>();
        args.add(subnetId);
        if (status != null && !status.isBlank()) { sql.append(" AND status=?"); args.add(status); }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (ip LIKE ? OR hostname LIKE ? OR system_name LIKE ? OR owner LIKE ? OR remarks LIKE ?)");
            args.addAll(Collections.nCopies(5, "%" + q + "%"));
        }
        sql.append(" ORDER BY ip_num");
        return jdbc.query(sql.toString(), this::addressRow, args.toArray());
    }

    public Map<String, Object> dashboard() {
        long subnetCount = jdbc.queryForObject("SELECT count(*) FROM subnets WHERE deleted=0", Long.class);
        long total = jdbc.queryForObject("SELECT count(*) FROM addresses a JOIN subnets s ON s.id=a.subnet_id WHERE s.deleted=0", Long.class);
        long assigned = jdbc.queryForObject("SELECT count(*) FROM addresses a JOIN subnets s ON s.id=a.subnet_id WHERE s.deleted=0 AND a.status='已分配'", Long.class);
        long reserved = jdbc.queryForObject("SELECT count(*) FROM addresses a JOIN subnets s ON s.id=a.subnet_id WHERE s.deleted=0 AND a.status='预留'", Long.class);
        List<Map<String, Object>> zones = jdbc.query("SELECT s.zone,count(a.id) total,sum(CASE WHEN a.status='已分配' THEN 1 ELSE 0 END) assigned,sum(CASE WHEN a.status='预留' THEN 1 ELSE 0 END) reserved FROM subnets s LEFT JOIN addresses a ON a.subnet_id=s.id WHERE s.deleted=0 GROUP BY s.zone ORDER BY s.zone", (rs, n) -> {
            long zoneTotal = rs.getLong("total"), zoneAssigned = rs.getLong("assigned"), zoneReserved = rs.getLong("reserved");
            return mapOf("zone", rs.getString("zone"), "total", zoneTotal, "assigned", zoneAssigned,
                    "detected", 0, "used", zoneAssigned, "reserved", zoneReserved,
                    "available", Math.max(0, zoneTotal - zoneAssigned - zoneReserved));
        });
        return mapOf("subnets", subnetCount, "total", total, "assigned", assigned, "detected", 0,
                "used", assigned, "reserved", reserved, "available", Math.max(0, total - assigned - reserved),
                "utilization", total == 0 ? 0d : (double) assigned / total, "byZone", zones);
    }

    public Map<String, Object> lookup(String ip) {
        long number = ipv4ToLong(ip);
        List<Map<String, Object>> subnet = jdbc.query("SELECT s.*,(s.network_end-s.network_start+1) total,0 used,0 reserved FROM subnets s WHERE s.deleted=0 AND network_start<=? AND network_end>=? ORDER BY prefix DESC LIMIT 1", this::subnetRow, number, number);
        List<Map<String, Object>> address = jdbc.query("SELECT * FROM addresses WHERE ip=? LIMIT 1", this::addressRow, ip);
        List<Map<String, Object>> refs = jdbc.query("SELECT * FROM resource_records WHERE ip=? OR details_json LIKE ? LIMIT 100", this::resourceRow, ip, "%" + ip + "%");
        return mapOf("ip", ip, "subnet", subnet.isEmpty() ? null : subnet.get(0), "address", address.isEmpty() ? null : address.get(0), "refs", refs, "registered", List.of());
    }

    private Map<String, Object> resourceRow(ResultSet rs, int n) throws SQLException {
        Map<String, Object> result = mapOf("id", rs.getLong("id"), "location", rs.getString("location"),
                "category", rs.getString("category"), "subcategory", rs.getString("subcategory"),
                "name", rs.getString("name"), "ip", rs.getString("ip"), "status", rs.getString("status"),
                "source", rs.getString("source"), "sheet", rs.getString("sheet"), "rowNo", rs.getObject("row_no"),
                "createdAt", rs.getString("created_at"));
        try { result.put("details", mapper.readValue(rs.getString("details_json"), new TypeReference<Map<String, Object>>() {})); }
        catch (Exception ignored) { result.put("details", Map.of()); }
        return result;
    }

    private Map<String, Object> subnetRow(ResultSet rs, int n) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        String[] same = {"id", "zone", "module", "cidr", "prefix", "status", "gateway", "owner", "remarks", "source", "kind", "site", "floor"};
        for (String key : same) m.put(key, rs.getObject(key));
        m.put("vlanId", rs.getString("vlan_id")); m.put("netType", rs.getString("net_type")); m.put("mgmtDevice", rs.getString("mgmt_device"));
        m.put("total", rs.getLong("total")); m.put("used", rs.getLong("used")); m.put("reserved", rs.getLong("reserved")); m.put("detected", 0);
        return m;
    }

    private Map<String, Object> addressRow(ResultSet rs, int n) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getLong("id")); m.put("subnetId", rs.getLong("subnet_id")); m.put("ip", rs.getString("ip")); m.put("status", rs.getString("status"));
        String[][] fields = {{"hostname","hostname"},{"deviceType","device_type"},{"systemName","system_name"},{"owner","owner"},{"macAddress","mac_address"},{"location","location"},{"ticketNo","ticket_no"},{"allocatedAt","allocated_at"},{"releasedAt","released_at"},{"remarks","remarks"},{"business","business"},{"domain","domain"},{"realIp","real_ip"},{"natDir","nat_dir"}};
        for (String[] field : fields) m.put(field[0], rs.getString(field[1]));
        return m;
    }

    private static long ipv4ToLong(String ip) {
        String[] parts = ip == null ? new String[0] : ip.trim().split("\\.");
        if (parts.length != 4) throw new IllegalArgumentException("请输入有效 IPv4 地址");
        long value = 0;
        for (String part : parts) { int octet = Integer.parseInt(part); if (octet < 0 || octet > 255) throw new IllegalArgumentException("请输入有效 IPv4 地址"); value = value * 256 + octet; }
        return value;
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }
}
