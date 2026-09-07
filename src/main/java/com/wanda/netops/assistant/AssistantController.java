package com.wanda.netops.assistant;

import com.wanda.netops.resource.NetOpsQueryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/ask")
public class AssistantController {
    private static final Pattern IP=Pattern.compile("(?<!\\d)(?:\\d{1,3}\\.){3}\\d{1,3}(?!\\d)");
    private final NetOpsQueryService service;
    public AssistantController(NetOpsQueryService service){this.service=service;}
    @PostMapping
    public Map<String,Object> ask(@RequestBody Map<String,Object> body){String question=String.valueOf(body.getOrDefault("question",""));var matcher=IP.matcher(question);if(matcher.find()){Map<String,Object> result=service.lookup(matcher.group());return Map.of("type","ip","title","IP 查询结果","text",matcher.group()+" 的归属与登记信息如下","data",result,"rows",List.of(result));}if(question.contains("多少")||question.contains("统计")){Map<String,Object>d=service.dashboard();return Map.of("type","stats","title","平台统计","text","当前平台共有 "+d.get("subnets")+" 个网段、"+d.get("assigned")+" 个登记占用地址。","data",d,"rows",List.of());}return Map.of("type","text","title","本地查询","text","可以询问 IP 归属或平台网段统计，例如：10.199.8.1 属于哪个网段？","rows",List.of());}
}
