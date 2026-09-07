package com.wanda.netops.resource;

import org.springframework.web.bind.annotation.*;
import com.wanda.netops.common.SessionUser;
import jakarta.servlet.http.HttpSession;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class NetOpsController {
    private final NetOpsQueryService service;
    private final NetOpsMutationService mutations;

    public NetOpsController(NetOpsQueryService service, NetOpsMutationService mutations) { this.service = service; this.mutations = mutations; }

    @GetMapping("/resources")
    public List<Map<String, Object>> resources(@RequestParam(required = false) String category,
                                               @RequestParam(required = false) String categories,
                                               @RequestParam(required = false) String location,
                                               @RequestParam(required = false) String q,
                                               @RequestParam(defaultValue = "2000") int limit) {
        return service.resources(category == null ? categories : category, location, q, limit);
    }

    @GetMapping("/resources/{id}") public Map<String, Object> resource(@PathVariable long id) { return service.resource(id); }

    @PutMapping("/resources/{id}") public Map<String,Object> updateResource(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireWritable(session);return mutations.updateResource(id,body,SessionUser.name(session));}
    @PutMapping("/resources/{id}/status") public Map<String,Object> updateResourceStatus(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireWritable(session);return mutations.updateResourceStatus(id,body,SessionUser.name(session));}
    @PutMapping("/addresses/{id}") public Map<String,Object> updateAddress(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireWritable(session);return mutations.updateAddress(id,body,SessionUser.name(session));}
    @PostMapping("/subnets/{id}/allocate") public Map<String,Object> allocateSubnet(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireWritable(session);return mutations.allocateSubnet(id,body,SessionUser.name(session));}
    @PostMapping("/subnets/{id}/release") public Map<String,Object> releaseSubnet(@PathVariable long id,HttpSession session){SessionUser.requireWritable(session);return mutations.releaseSubnet(id,SessionUser.name(session));}
    @PostMapping("/subnets/{id}/allocate-addresses") public Map<String,Object> allocateAddresses(@PathVariable long id,@RequestBody Map<String,Object> body,HttpSession session){SessionUser.requireWritable(session);return mutations.allocateAddresses(id,body,SessionUser.name(session));}

    @GetMapping("/resources/stats")
    public Map<String, Object> stats() {
        List<Map<String, Object>> rows = service.resourceStats();
        long total = rows.stream().mapToLong(row -> ((Number) row.get("count")).longValue()).sum();
        return Map.of("total", total, "rows", rows);
    }

    @GetMapping("/dashboard") public Map<String, Object> dashboard() { return service.dashboard(); }

    @GetMapping("/subnets")
    public List<Map<String, Object>> subnets(@RequestParam(defaultValue = "idc") String kind,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(required = false) String zone,
                                             @RequestParam(required = false) String status) {
        return service.subnets(kind, q, zone, status);
    }

    @GetMapping("/subnets/{id}/addresses")
    public List<Map<String, Object>> addresses(@PathVariable long id, @RequestParam(required = false) String q,
                                               @RequestParam(required = false) String status) {
        return service.addresses(id, q, status);
    }

    @GetMapping("/subnets/{id}/map")
    public Map<String, Object> addressMap(@PathVariable long id) {
        List<Map<String, Object>> rows = service.addresses(id, null, null);
        String next = rows.stream().filter(x -> "可用".equals(x.get("status"))).map(x -> (String) x.get("ip")).findFirst().orElse(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("addresses", rows); result.put("nextAvailable", next); result.put("freeRanges", List.of());
        return result;
    }

    @GetMapping("/lookup") public Map<String, Object> lookup(@RequestParam String ip) { return service.lookup(ip); }

    @GetMapping("/ask/capability")
    public Map<String, Object> capability() {
        return Map.of("engine", "Java 本地查询", "modelReady", false, "sendResults", false,
                "samples", List.of("10.199.8.1 属于哪个网段？", "平台有多少条资源记录？"));
    }
}
