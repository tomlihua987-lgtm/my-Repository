# 网络综合管理平台 Java 重建设计方案

> 文档状态：初版  
> 设计基线：现有 `wwwroot` 功能与视觉、`App_Data/netops.db` 数据库及已发布的 .NET 8 应用行为  
> 建设方式：后端使用 Java 重建，前端使用 Vue 3 重构  
> 目标开发环境：Windows 10、IntelliJ IDEA、JDK 21、Node.js 22 LTS，项目和开发缓存以 D 盘为主

## 1. 项目目标

本项目拟将现有 ASP.NET Core 发布版重建为一套具备完整源码、可持续维护的前后端工程。后端采用 Java，前端采用 Vue 3，同时最大限度保留现有业务功能、主要视觉风格、用户操作方式和数据。

目标包括：

- 将现有原生 HTML、CSS、JavaScript 按业务模块重构为 Vue 3；
- Java 后端第一阶段兼容现有 `/api/**` 地址、请求字段和响应格式；
- 以旧前端为功能清单、交互和视觉基线，不继续扩展旧全局脚本；
- 复用并迁移现有 SQLite 数据；
- 重建登录、资源台账、IPAM、网络工具、审计和意见反馈等后端能力；
- 建立 Maven 工程、数据库迁移、自动化测试和部署文档；
- 为设备采集、告警、配置版本和流量分析预留扩展边界。

平台定位：

> 以 IP 地址管理和网络资源台账为核心，整合设备配置、资产、无线、F5、线路、拓扑、工单与周报的轻量级 NetOps 平台。

## 2. 已确认的现状

当前目录是一份可运行的 .NET 8 发布包，不是完整源码工程。现有可利用资产包括：

- `wwwroot/`：旧版前端源码，作为 Vue 重构的功能、交互和视觉基线；
- `App_Data/netops.db`：SQLite 数据库；
- `seed/records.json`：统一资源种子数据；
- `SourceFiles/`：Excel、Word、Visio、配置日志和周报等原始资料；
- `WandaNetOps.dll`：可用于还原接口行为的已编译后端；
- `appsettings.json`：运行配置。

当前数据库约包含：

| 数据 | 数量 |
|---|---:|
| 统一资源记录 | 10,750 |
| 网段 | 458 |
| IPv4 地址 | 120,996 |
| 审计记录 | 272 |
| 用户 | 5 |

## 3. 本机环境基线与准备要求

### 3.1 已检测环境

| 项目 | 当前状态 | 项目要求 |
|---|---|---|
| 操作系统 | Windows 10 64 位（10.0.19045） | 支持 |
| CPU | Intel i7-10510U，4 核 8 线程 | 足够 |
| 内存 | 15.8 GB | 足够，IDEA 最大堆建议 2～3 GB |
| C 盘 | 80 GB，可用空间接近 0 | 开发前至少释放 15 GB，建议 20 GB |
| D 盘 | 可用约 154 GB | 用于项目、JDK、缓存和数据副本 |
| IDEA | IntelliJ IDEA Ultimate 2021.1.1 | 需要升级到支持 Java 21 的新版 |
| `java` | Oracle Java 8 | 不能用于本项目 |
| `javac` / `JAVA_HOME` | Temurin 18 | 更换为 Temurin JDK 21 LTS |
| Maven | `MAVEN_HOME` 指向不存在目录 | 项目使用 Maven Wrapper，不依赖系统 Maven |
| Git | 当前仅确认 Codex 内置 Git 可用 | 建议安装标准 Git for Windows |
| Node.js | 9.11.2，npm 5.6.0 | 更换为 Node.js 22 LTS，使用 Corepack/pnpm |
| 端口 | 9306 未占用 | 作为默认开发端口 |

当前 `java` 与 `javac` 分别指向 Java 8 和 Java 18，不能作为稳定开发环境。开发前统一安装 64 位 Temurin JDK 21，并确保命令行、IDEA Project SDK、Maven Importer 和 Maven Runner 全部使用同一个 JDK。

### 3.2 推荐的 D 盘目录

```text
D:\DevTools\Java\jdk-21                 JDK 21
D:\DevTools\JetBrains\IntelliJ-IDEA    新版 IDEA
D:\DevTools\Git                         Git for Windows（可选安装位置）
D:\DevTools\Node\node-22               Node.js 22 LTS
D:\DevCache\maven-repository            Maven 本地仓库
D:\DevCache\pnpm-store                  pnpm 依赖仓库
D:\DevCache\idea                        IDEA system/cache/log
D:\ReviveProject\WandaNetOps            当前项目根目录
```

环境变量目标状态：

```text
JAVA_HOME=D:\DevTools\Java\jdk-21
PATH 中 %JAVA_HOME%\bin 位于 Oracle javapath 之前
```

环境验收命令：

```powershell
java -version
javac -version
$env:JAVA_HOME
git --version
node --version
pnpm --version
```

`java` 和 `javac` 必须同时显示 21，Node.js 必须显示 22.x。旧的 `MAVEN_HOME` 可以删除，因为项目通过 `mvnw.cmd` 固定 Maven 版本。

### 3.3 磁盘和缓存策略

本机 C 盘空间接近耗尽，因此项目不能继续使用全部默认缓存位置。Maven 本地仓库设为：

```text
D:\DevCache\maven-repository
```

IDEA 的 system、plugins 和 log 建议迁至：

```text
D:\DevCache\idea\system
D:\DevCache\idea\plugins
D:\DevCache\idea\log
```

即使迁移缓存，C 盘仍需保留至少 15 GB 空闲空间，供 Windows、IDEA 配置和临时文件使用。

## 4. 可实施的技术栈

以下技术均可以直接实现、运行和测试，不依赖尚未确定的商业组件。

| 层次 | 选型 | 用途 |
|---|---|---|
| Java | Java 21 LTS | 后端运行环境 |
| Web | Spring Boot 3.x、Spring MVC | REST API、静态资源服务 |
| 权限 | Spring Security | 登录会话、角色和接口鉴权 |
| 数据访问 | MyBatis | SQLite 查询、事务和批量操作 |
| 数据库 | SQLite | 第一阶段兼容现有数据 |
| 数据迁移 | Flyway | Schema 版本管理 |
| JSON | Jackson | 请求、响应及 `details_json` 转换 |
| 校验 | Jakarta Validation | API 参数校验 |
| Excel | Apache POI | XLSX 导入和解析 |
| CSV | Apache Commons CSV | CSV 导出 |
| API 文档 | springdoc-openapi | OpenAPI 和 Swagger UI |
| 测试 | JUnit 5、Mockito、Spring Boot Test | 单元和集成测试 |
| 构建 | Maven | 依赖、编译、测试和打包 |
| 前端框架 | Vue 3 + TypeScript | 组件化重构现有页面 |
| 前端构建 | Vite | 开发服务器和生产构建 |
| 路由与状态 | Vue Router + Pinia | 页面路由和全局状态 |
| HTTP | Axios | API 请求、会话失效和错误拦截 |
| 前端测试 | Vitest + Vue Test Utils + Playwright | 单元、组件和端到端测试 |
| 包管理 | pnpm + Corepack | 固定依赖版本并节省磁盘 |
| 部署 | Spring Boot Fat JAR | Windows/Linux 直接部署 |

第一阶段采用 Vue 3 重构前端，但不引入微服务、Redis、消息队列和 Elasticsearch。现有规模使用前后端双模块、Spring Boot 模块化单体与 SQLite 足够。

## 5. 总体架构

```text
浏览器
  └─ Vue 3 单页应用
       ├─ Vue Router 页面路由
       ├─ Pinia 会话与业务状态
       ├─ Axios API 客户端
       ├─ 业务页面与通用组件
       └─ SVG/图表专题视图
             │ HTTP + JSON
             ▼
Spring Boot 模块化单体
  ├─ 认证与用户
  ├─ 统一资源中心
  ├─ IPAM
  ├─ 设备与专题视图
  ├─ 网络工具
  ├─ 智能查询
  ├─ 意见反馈
  └─ 审计日志
             │
      ┌──────┴──────────┐
      ▼                 ▼
   SQLite            本地文件存储
  结构化数据       原始资料/反馈附件
```

开发模式下，Vue 由 Vite 运行在 `5173`，`/api` 和文件请求代理到 Spring Boot `9306`。生产模式下，Vue 构建为静态文件并由 Spring Boot 同一进程提供，最终仍是单一部署包。

后端采用模块化单体的原因：

- 各模块共享用户、资源、IP 和审计数据；
- 单进程部署与当前应用形态一致；
- 不需要处理分布式事务和多服务运维；
- 模块边界清晰，未来仍可按需要拆分。

## 6. IDEA 工程与目录结构

Java 工程放在当前发布包下的独立子目录，避免 IDEA 索引根目录中的数百个 .NET DLL：

```text
D:\ReviveProject\WandaNetOps\
├─ App_Data\                     原 .NET 数据
├─ SourceFiles\                  原始资料
├─ wwwroot\                      原前端
├─ WandaNetOps.dll               原后端行为基线
├─ JAVA_PLATFORM_DESIGN.md
└─ java-rebuild\                 IDEA 只打开这个目录
```

IDEA 应打开：

```text
D:\ReviveProject\WandaNetOps\java-rebuild
```

不要将整个 `D:\ReviveProject\WandaNetOps` 作为 IDEA 工程打开。

### 6.1 前后端工程结构

```text
java-rebuild/
├─ pom.xml                       后端 Maven 工程
├─ mvnw
├─ mvnw.cmd
├─ frontend/                     Vue 3 工程
│  ├─ package.json
│  ├─ pnpm-lock.yaml
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ index.html
│  ├─ public/source-assets/
│  └─ src/
│     ├─ main.ts
│     ├─ App.vue
│     ├─ router/
│     ├─ stores/
│     ├─ api/
│     ├─ layouts/
│     ├─ components/
│     ├─ views/
│     ├─ modules/
│     ├─ styles/
│     ├─ types/
│     └─ utils/
├─ README.md
├─ docs/
│  ├─ architecture.md
│  ├─ api-compatibility.md
│  ├─ database.md
│  └─ import-format.md
├─ src/
│  ├─ main/
│  │  ├─ java/com/wanda/netops/
│  │  │  ├─ WandaNetOpsApplication.java
│  │  │  ├─ common/
│  │  │  ├─ security/
│  │  │  ├─ resource/
│  │  │  ├─ ipam/
│  │  │  ├─ device/
│  │  │  ├─ wireless/
│  │  │  ├─ loadbalancer/
│  │  │  ├─ circuit/
│  │  │  ├─ topology/
│  │  │  ├─ operation/
│  │  │  ├─ tools/
│  │  │  ├─ assistant/
│  │  │  ├─ feedback/
│  │  │  ├─ audit/
│  │  │  ├─ importdata/
│  │  │  └─ filestore/
│  │  └─ resources/
│  │     ├─ application.yml
│  │     ├─ db/migration/
│  │     ├─ mapper/
│  │     ├─ seed/
│  │     └─ static/              生产构建时接收 Vue dist
│  └─ test/java/com/wanda/netops/
├─ data/
├─ source-files/
└─ storage/
```

每个业务模块内部按以下职责拆分：

```text
Controller → Application Service → Domain Service → Repository/Mapper → SQLite
```

Controller 只负责 HTTP 协议适配；事务和状态转换放在 Service；SQL 放在 Mapper/Repository。

### 6.2 IDEA 配置

在 IDEA 中统一设置：

```text
Project SDK: JDK 21
Language level: 21
Maven home path: Use Maven wrapper
Maven importer JDK: Project JDK 21
Maven runner JRE: Project JDK 21
Working directory: D:\ReviveProject\WandaNetOps\java-rebuild
Active profile: dev
```

启动类固定为：

```text
com.wanda.netops.WandaNetOpsApplication
```

开发者可直接点击该类左侧的绿色运行按钮启动，不要求预先执行命令行打包。

Vue 开发服务通过 IDEA 的 npm 运行配置启动：

```text
package.json: D:\ReviveProject\WandaNetOps\java-rebuild\frontend\package.json
Command: run
Scripts: dev
Node interpreter: Node.js 22
Package manager: pnpm
```

再创建 IDEA Compound 配置 `WandaNetOps Dev`，同时启动后端 `WandaNetOpsApplication`（9306）和前端 `frontend:dev`（5173）。浏览器开发入口为 `http://localhost:5173`。

## 7. Vue 前端重构方案

现有 `wwwroot` 不直接作为新项目源码，而是作为功能、样式和交互参照。Vue 重构采用渐进式业务迁移，但最终页面全部由 Vue 组件承载。

### 7.1 基础架构

```text
frontend/src/
├─ api/              按业务域封装 REST API
├─ components/       表格、筛选、弹窗、状态标签等通用组件
├─ layouts/          登录布局和平台主布局
├─ modules/          模块元数据与动态表格定义
├─ router/           路由、鉴权守卫和懒加载
├─ stores/           用户、模块、IPAM、通知等 Pinia Store
├─ views/            页面级组件
├─ styles/           迁移并整理现有 CSS
├─ types/            请求、响应和领域 TypeScript 类型
└─ utils/            IP、格式化、下载等工具
```

### 7.2 页面路由

```text
/login
/dashboard
/ask
/devices
/ip
/wireless
/load-balancer
/circuits
/topology
/operations
/tools
/feedback
/users
/audit
```

模块内部页签通过子路由或 query 参数表达，使页面支持刷新、收藏和浏览器前进后退。

### 7.3 状态与 API

Pinia 只保存当前用户、角色、导航、全局通知和确需跨页复用的筛选条件；单页表格、弹窗表单和临时选择保留在组件内部。

Axios 实例统一处理 `/api` 基础路径、文件上传、401 跳转登录、403 提示、业务错误、请求取消和文件下载。开发环境的 `vite.config.ts` 将 `/api` 和 `/source-assets` 代理到 `http://localhost:9306`。

### 7.4 组件规划

```text
AppShell、SideNavigation、PageHeader
DataTable、FilterBar、StatusTag、StatCard
ModalDialog、ConfirmDialog、ToastStack、FileUploader
IpAddressGrid、SubnetUsageBar、TopologyCanvas
ResourceDetailDrawer
```

设备、IPAM、无线、F5、线路、拓扑、工单周报、工具、反馈、用户和审计分别建立页面组件。现有 `modules.js` 的模块注册思想保留，但改造成有 TypeScript 类型约束的配置。

### 7.5 兼容原则

- 现有业务功能不因框架迁移而缩减；
- API URL 不变；
- HTTP 方法不变；
- JSON 字段名不变；
- 中文状态值暂时不变；
- 401、403 等状态码行为不变；
- 文件下载地址不变；
- Vue 前端可在新旧后端间切换验证；
- 新旧页面使用同一份验收清单逐项对照；
- 现有 CSS 先迁移复用，再按组件作用域逐步整理。

### 7.6 生产集成

`pnpm build` 生成 `frontend/dist`。Maven 在生产打包阶段调用前端构建并把 `dist` 纳入 Spring Boot 静态资源，最终生成同时包含 Vue 页面和 Java API 的可执行 JAR。开发阶段保持前后端两个进程，以获得 Vite 热更新。

## 8. 后端模块设计

### 8.1 认证与用户

功能：

- 登录、退出和获取当前用户；
- 服务端 Session；
- 首次登录强制修改密码；
- 创建、编辑、启停用户；
- 管理员重置密码；
- 管理员、运维人员、只读用户三类角色；
- 停用用户时使其会话失效。

兼容接口：

```text
POST /api/login
POST /api/logout
GET  /api/me
POST /api/change-password
GET  /api/users
POST /api/users
PUT  /api/users/{id}
POST /api/users/{id}/reset-password
```

### 8.2 统一资源中心

继续使用 `resource_records` 承载不同来源的半结构化资料。稳定字段结构化保存，来源特有字段保存在 `details_json`。

```java
public class ResourceRecord {
    private Long id;
    private String location;
    private String category;
    private String subcategory;
    private String name;
    private String ip;
    private String status;
    private String source;
    private String sheet;
    private Integer rowNo;
    private Map<String, Object> details;
}
```

兼容接口：

```text
GET /api/resources
GET /api/resources/{id}
GET /api/resources/stats
PUT /api/resources/{id}
PUT /api/resources/{id}/status
GET /api/export.csv
GET /api/source-files/{name}
```

### 8.3 IPAM

核心能力：

- IDC、办公网、公网三种地址空间；
- 网段增删改查；
- CIDR 校验和重叠检测；
- 创建网段时生成地址记录；
- 整段预留、业务划拨和释放；
- 单个或批量分配 IP；
- 地址回收；
- 公网 NAT 映射；
- 地址方格图和连续空闲区间；
- IP 归属反查；
- 合并人工登记占用与资料检出占用；
- 所有修改写入审计。

核心状态流：

```text
网段预留 → 划拨给业务 → 地址可用 → 地址已分配
    ▲                         │
    └────── 释放网段 ← 回收地址 ┘
```

兼容接口：

```text
GET    /api/subnets
POST   /api/subnets
PUT    /api/subnets/{id}
DELETE /api/subnets/{id}
POST   /api/subnets/{id}/allocate
POST   /api/subnets/{id}/allocate-addresses
POST   /api/subnets/{id}/release
POST   /api/subnets/{id}/register-detected
GET    /api/subnets/{id}/addresses
GET    /api/subnets/{id}/map
PUT    /api/addresses/{id}
GET    /api/lookup?ip=...
GET    /api/dashboard
```

网段划拨、地址分配、回收和释放均通过 `@Transactional` 保证原子性。批量分配时采用条件更新或版本字段，避免重复分配。

### 8.4 设备台账

第一阶段继续从统一资源记录聚合资产、配置和机柜信息。第二阶段增加结构化 `devices` 与 `device_resource_links`，建立统一 `device_key`。

设备聚合视图应返回：

- 基本台账；
- 管理 IP；
- 型号和序列号；
- 配置备份；
- 机柜和 U 位；
- 关联地址；
- 数据校核结果。

### 8.5 无线网络

第一阶段兼容现有统一资源查询，支持：

- 控制器主备；
- AP 点位和状态；
- 楼层覆盖；
- 2.4G/5G 射频信道；
- SSID 服务；
- 点位底图；
- 同频统计和数据校核。

后续实时采集采用“静态台账 + 状态快照”模型，不覆盖历史快照。

### 8.6 F5 负载均衡

领域关系：

```text
F5 Device → Virtual Server → Pool → Pool Member
```

第一阶段兼容现有资源数据和前端专题图。后续结构化设备、虚拟服务、地址池和成员，并提供从后端 IP 反查 VIP 的影响面接口。

### 8.7 线路资源

支持专线、SD-WAN 和特殊线路，主要字段包括运营商、带宽、租金、局点、端点设备、端口、状态和实施时间。后续可增加到期提醒、费用统计、主备关系和故障关联。

### 8.8 机柜与拓扑

机柜支持机柜容量、U 位占用、设备上下架和空闲空间统计。

现有 SVG 拓扑继续使用；新增服务端布局存储接口，将节点位置和用户创建的连接从浏览器 `localStorage` 迁移到数据库。

```text
GET /api/topologies/{id}/layout
PUT /api/topologies/{id}/layout
```

### 8.9 工单与周报

兼容现有工单看板、明细、数据校核、周报正文和附件下载。导入层为工单和周报定义独立适配器，方便未来接入飞书或其他工单 API。

### 8.10 网络工具

实现：

- 服务端批量 ICMP Ping；
- 从设备、网段等来源生成目标；
- CIDR、掩码、网络地址、广播地址和可用区间计算；
- 网段登记和占用检查；
- 单 IP 查询；
- 工具执行审计。

兼容接口：

```text
POST /api/tools/ping
GET  /api/tools/ping/sources
GET  /api/tools/ping/sources/{key}
POST /api/tools/subnets
```

### 8.11 智能查询

智能查询采用“查询工具优先、模型可选”的结构：

```text
用户问题 → 意图识别 → 后端只读查询工具 → 结果组织 → 可选模型润色
```

内置工具：

- IP 归属查询；
- 网段利用率；
- 设备和资源搜索；
- 配置内容检索；
- IP 影响面；
- F5 引用链；
- 分类统计。

未配置模型时使用本地规则和模板正常回答；配置兼容的模型 API 后，可用于问题规划和自然语言组织，但实际数据仍由平台工具查询。

兼容接口：

```text
GET  /api/ask/capability
POST /api/ask
```

### 8.12 审计与意见反馈

审计记录用户、动作、对象、修改前后内容、客户端 IP 和时间。通过统一 `AuditService` 或注解拦截器写入，避免业务代码各自拼接审计 SQL。

反馈支持文字、截图、附件、回复、状态处理和“我的反馈”。本地文件存储通过 `FileStorage` 接口封装，后续可替换为 MinIO 或对象存储。

## 9. 数据库策略

第一阶段保留现有表：

```text
users
sessions
resource_records
subnets
addresses
audit_logs
feedback
feedback_comments
feedback_files
seed_meta
```

新增 Flyway 基线并逐步增加：

- `import_batches`：导入批次与错误统计；
- `topology_layouts`：拓扑布局；
- `devices`：统一设备；
- `device_resource_links`：设备与来源记录关联；
- 必要的更新时间、版本号和业务索引。

迁移原则：

1. 保留原数据库只读备份；
2. 在数据库副本上完成 Java 兼容验证；
3. Flyway 只做向前迁移；
4. 每次迁移均提供自动化验证；
5. Java 版本与旧版对同一查询返回等价结果后再切换。

本机开发数据库固定使用副本：

```text
java-rebuild\data\dev\netops.db
```

原数据库 `App_Data\netops.db` 只作为迁移输入和行为对照，不作为 IDEA 日常运行的数据源。首次准备开发数据时，在原应用完全停止后复制数据库主文件及必要的 WAL 数据，随后由 Java 开发环境独立使用。

## 10. Excel 与资料导入

不要将所有来源写入一个巨型导入类，采用适配器接口：

```java
public interface ResourceImporter {
    boolean supports(ImportSource source);
    ImportPreview preview(ImportSource source);
    ImportResult execute(ImportSource source);
}
```

实现类包括：

```text
AssetExcelImporter
IpPlanExcelImporter
F5ExcelImporter
CircuitExcelImporter
RackExcelImporter
TicketImporter
H3cConfigImporter
F5ConfigImporter
WeeklyReportImporter
```

导入流程：

```text
上传 → 文件识别 → 预览 → 字段标准化 → 校核 → 事务写入 → 导入报告
```

每次导入记录文件哈希、操作者、总行数、成功、跳过、错误和错误明细。

## 11. API 与异常规范

第一阶段优先兼容当前前端。新接口可采用统一响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "..."
}
```

HTTP 状态使用：

| 状态 | 含义 |
|---:|---|
| 400 | 参数错误 |
| 401 | 未登录或会话失效 |
| 403 | 权限不足 |
| 404 | 对象不存在 |
| 409 | 网段重叠、地址状态冲突等 |
| 500 | 未预期的服务端异常 |

使用 `@RestControllerAdvice` 集中转换业务异常，不在每个 Controller 重复处理。

## 12. 测试与验收

### 12.1 单元测试

必须覆盖：

- IPv4 数值转换；
- CIDR 起止地址；
- `/31`、`/32` 等边界；
- 网段包含和重叠；
- 连续空闲地址计算；
- 网段状态转换；
- 地址分配与回收；
- Excel 字段标准化；
- 设备关联规则；
- 智能查询意图识别。

### 12.2 集成测试

必须覆盖：

- 数据库初始化和 Flyway；
- 现有 SQLite 数据读取；
- 登录、角色和会话；
- 资源查询与统计；
- 创建网段及地址生成；
- 批量分配的事务一致性；
- 网段释放；
- 审计写入；
- 导入批次。

### 12.3 API 兼容测试

以旧前端调用行为为 API 契约，为 Java 接口建立契约测试，校验状态码、字段名、数据类型和中文状态值；Vue 前端使用生成或手写的 TypeScript 类型消费同一契约。

### 12.4 浏览器冒烟测试

验证：

- 登录和退出；
- 打开七个业务模块；
- 查询 IP；
- 查看网段方格图；
- 分配和回收测试地址；
- 查看资产和配置；
- 周报、附件和拓扑；
- 审计查询；
- 创建和处理反馈。

### 12.5 IDEA 启动验收

“项目能够在 IDEA 中运行”必须同时满足：

1. IDEA 能将 `java-rebuild/pom.xml` 正确识别为 Maven 工程；
2. Project SDK、Maven Importer 和 Maven Runner 均为 JDK 21；
3. 点击 `WandaNetOpsApplication` 的运行按钮可以启动；
4. 控制台显示应用监听 `9306`；
5. IDEA Compound 配置能同时启动后端 9306 和 Vue/Vite 5173；
6. 浏览器打开 `http://localhost:5173` 能加载 Vue 前端；
7. `GET /api/health` 返回成功；
8. 应用读取 `data/dev/netops.db`，不修改原数据库；
9. `GET /api/resources/stats` 返回与基线一致的资源数量；
10. IDEA 停止应用后 9306 和 5173 端口释放；
11. IDEA Terminal 中 `.\mvnw.cmd test`、`pnpm test` 和 `pnpm build` 均通过。

## 13. 本机开发配置

```yaml
server:
  port: 9306
  address: 0.0.0.0

spring:
  application:
    name: wanda-netops
  datasource:
    url: jdbc:sqlite:./data/dev/netops.db
    driver-class-name: org.sqlite.JDBC
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 60MB

netops:
  auth:
    require-login: true
    session-hours: 12
  storage:
    source-directory: ./source-files
    feedback-directory: ./storage/feedback
  tools:
    ping:
      max-targets: 256
      timeout-ms: 2000
      concurrency: 32
  assistant:
    engine: local
    base-url: ""
    api-key: ""
    model: ""
    send-results-to-model: false
```

项目提供 `application-dev.yml`，并将工作目录固定为 `java-rebuild`，避免 IDEA 与命令行因工作目录不同而连接到不同数据库。原始资料在开发工程中通过目录联接或只读配置引用上级 `SourceFiles`，不重复提交大文件。

## 14. 本机构建、运行与部署

开发命令：

```bash
.\mvnw.cmd clean test
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
.\mvnw.cmd clean package

cd frontend
corepack enable
pnpm install
pnpm dev
pnpm test
pnpm build
```

标准发布目录：

```text
WandaNetOps-Java/
├─ wanda-netops.jar
├─ config/application.yml
├─ data/netops.db
├─ source-files/
├─ storage/
├─ logs/
└─ start.bat
```

普通启动：

```bat
java -jar wanda-netops.jar
```

如果希望目标 Windows 不安装 Java，可随应用携带由 `jlink` 生成的运行时：

```bat
"%~dp0runtime\bin\java.exe" -jar "%~dp0wanda-netops.jar"
```

后续可使用 WinSW 注册为 Windows 服务。

Maven Wrapper 下载的 Maven 发行版和依赖缓存应配置到 D 盘。IDEA 内运行与命令行运行必须共用同一 `settings.xml` 和本地仓库，避免重复占用 C 盘空间。

## 15. 分阶段实施计划

### 阶段一：工程骨架和只读兼容

- 创建 Java 21 + Spring Boot + Maven 工程；
- 加入 Maven Wrapper，不使用当前失效的系统 Maven；
- 提供 IDEA 可直接运行的启动配置和 `dev` Profile；
- 创建 Vue 3 + TypeScript + Vite 工程；
- 配置 Vue Router、Pinia、Axios、Vitest 和 pnpm；
- 建立 IDEA 前后端 Compound 运行配置；
- 接入 SQLite 和 MyBatis；
- 迁移登录、主布局、导航、总览和通用组件；
- 建立 Flyway 基线；
- 实现登录、当前用户、资源查询、统计和文件下载；
- 让 Vue 平台总览能够读取现有数据。

验收标准：Vue 前端可登录，IDEA 可同时调试前后端，总览数量与旧版一致。

### 阶段二：IPAM 完整闭环

- 网段管理；
- 地址列表和方格图；
- IP 查询；
- 网段划拨与释放；
- 地址分配与回收；
- 公网 NAT 映射；
- 事务与审计。
- 将旧版 IP 规划图、地址池、网段表和地址方格图重构为 Vue 组件。

验收标准：使用数据库副本完成完整的“划拨—分配—回收—释放”流程。

### 阶段三：管理与协同

- 完成设备、无线、F5、线路、拓扑和运维记录 Vue 页面；
- 用户管理；
- 审计筛选和导出；
- 意见反馈、回复和附件；
- CSV 导出；
- 拓扑布局服务端持久化。

### 阶段四：导入、工具和智能查询

- Excel/配置/周报导入适配器；
- Ping 和 CIDR 工具；
- 本地规则问答；
- 可选模型调用；
- 数据校核和影响面查询。

### 阶段五：工程完善

- 全量契约测试；
- Vue 单元、组件和 Playwright 端到端测试；
- 浏览器冒烟测试；
- 数据备份与恢复脚本；
- Windows 服务部署；
- 开发、数据和运维文档。

## 16. 后续演进建议

1. **以旧版为基线并行重构。** Java API 和 Vue 页面按垂直业务切片推进，每完成一个模块就与旧版逐项对照，不采用一次性全部替换。
2. **SQLite 暂时保留。** 当前数据规模足够使用；完成 Java 重建后再评估 PostgreSQL。
3. **统一资源标识。** 尽早建立 `device_key`、`circuit_key`、`application_key`，减少跨资料模糊匹配。
4. **区分台账、快照和事件。** 设备/IP 属于台账，配置和运行状态属于快照，告警和工单属于事件。
5. **智能问答建立在可靠查询工具上。** 模型只负责规划和表达，不负责直接拼 SQL 或臆测业务数据。
6. **拓扑改为服务端持久化。** 支持多用户共享、版本和恢复，而不只存浏览器本地。
7. **导入必须可预览、可追踪。** 每次导入形成批次记录和错误报告。
8. **实时监控作为独立阶段。** 后续可增加 SNMP/SSH/API 采集、配置 Diff、设备告警和流量趋势，不与第一阶段重建混在一起。

## 17. 实施承诺边界

本方案中的核心技术栈和功能均可直接实现，包括：

- Spring Boot REST API 与旧版接口行为兼容；
- Vue 3、TypeScript、Vite、Vue Router、Pinia 和 Axios 前端；
- Vitest 组件测试与 Playwright 端到端测试；
- Spring Security 服务端会话和三角色权限；
- MyBatis + SQLite 数据访问和事务；
- Flyway 数据库版本管理；
- IP/CIDR 计算、网段划拨、地址分配和回收；
- Apache POI Excel 导入；
- 文件上传下载、CSV 导出、审计和反馈；
- 服务端 Ping、智能查询工具和可选模型接口；
- JUnit 集成测试、Maven 打包和 Windows 启动脚本。
- 新版 IDEA 中通过 Compound 配置直接运行和调试 Java 后端与 Vue 前端。

实施时将以 Vue 页面完整覆盖现有功能、现有数据不丢失、Java 接口和前端关键行为可自动验证、IDEA 可一键运行前后端为完成标准，而不是只生成工程骨架、空 Vue 页面或接口占位代码。
