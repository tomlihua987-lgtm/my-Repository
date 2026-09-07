# WandaNetOps Java

由原 `.NET 8` 发布包重建的网络综合管理平台。项目使用 JDK 17、Spring Boot、Maven 和 SQLite，保留原页面、业务数据及原用户密码兼容能力，可直接使用 IntelliJ IDEA 继续开发。

- 原项目（保持不变）：`D:\AIProject\wandaProject\WandaNetOps\WandaNetOps`
- Java 项目：`D:\AIProject\wandaProject\WandaNetJava`
- 完整接口文档：[docs/API.md](docs/API.md)

## 当前能力

- 原账号及 ASP.NET Core Identity V3 密码兼容登录
- 登录会话、退出、修改密码和三级角色权限
- 资源查询、统计、编辑及状态修改
- Dashboard、三类网段、地址方格图和 IP 归属查询
- IP 登记、回收、批量分配和网段划拨/回收
- 用户新增、编辑、启停和密码重置
- 审计日志、意见协作及基础本地智能查询
- 原静态页面、CSS、JavaScript、拓扑和周报素材
- 独立 SQLite 开发数据库副本

## 技术栈

| 组件 | 版本/说明 |
|---|---|
| Java | Eclipse Temurin JDK 17 LTS |
| Maven | 3.9.16 |
| Spring Boot | 3.5.11 |
| Web | Spring MVC / Embedded Tomcat |
| 数据访问 | Spring JDBC |
| 数据库 | SQLite + Xerial JDBC 3.53.2.1 |
| 测试 | JUnit 5、Spring Boot Test、MockMvc |
| 前端 | 原生 HTML/CSS/JavaScript，计划迁移 Vue 3 |

## 目录结构

```text
WandaNetJava/
├─ .idea/runConfigurations/       IDEA 运行配置
├─ data/dev/netops.db             独立开发数据库
├─ docs/API.md                    接口文档
├─ docs/JAVA_PLATFORM_DESIGN.md   Java 重建设计方案
├─ source-files/                  原始资料目录
├─ storage/feedback/              反馈附件目录
├─ src/main/java/com/wanda/netops/
│  ├─ assistant/                  本地智能查询
│  ├─ audit/                      审计
│  ├─ common/                     公共代码
│  ├─ feedback/                   意见协作
│  ├─ resource/                   资源、网段和 IP
│  └─ security/                   认证及用户管理
├─ src/main/resources/static/     原页面和素材
├─ src/test/java/                 自动化测试
├─ pom.xml
├─ mvnw.cmd
└─ start-dev.cmd
```

## 使用 IDEA

1. 启动 IntelliJ IDEA，打开 `D:\AIProject\wandaProject\WandaNetJava`。
2. Project SDK 选择 `D:\JavaEnvironment\JDK-17`。
3. 等待 Maven 导入 `pom.xml`。
4. 运行 `com.wanda.netops.WandaNetOpsApplication`，或使用共享配置 `WandaNetOps Java`。
5. 浏览器访问 `http://localhost:9306`。

IDEA 的 Working directory 必须保持为项目根目录，否则相对数据库路径会指向错误位置。

## 命令行运行

```powershell
cd D:\AIProject\wandaProject\WandaNetJava
.\mvnw.cmd spring-boot:run
```

也可以双击 `start-dev.cmd`。健康检查地址：`http://localhost:9306/api/health`。

## 构建与测试

```powershell
.\mvnw.cmd clean test
.\mvnw.cmd clean package
```

运行构建产物：

```powershell
& 'D:\JavaEnvironment\JDK-17\bin\java.exe' -jar '.\target\wanda-netops-1.0.0-SNAPSHOT.jar'
```

测试覆盖 Java/Spring 启动、数据库基线、旧密码兼容、访问控制及核心查询 API。

## 数据安全

Java 使用 `data\dev\netops.db`，它是原数据库的独立副本，不会修改旧项目的 `App_Data\netops.db`。

| 数据 | 初始数量 |
|---|---:|
| 统一资源记录 | 10,750 |
| 网段 | 458 |
| IPv4 地址 | 120,996 |
| 审计记录 | 272 |
| 用户 | 5 |

开发前建议备份数据库。应用运行时可能生成 `netops.db-wal` 和 `netops.db-shm`，不要在服务运行期间只复制主数据库文件。

## 配置

配置文件：`src/main/resources/application.yml`。

```yaml
server:
  port: 9306
spring:
  datasource:
    url: jdbc:sqlite:./data/dev/netops.db
```

原账号密码无需转换；新密码也以兼容哈希保存，不在代码或配置中保存明文密码。

## 尚待迁移

- 新增、编辑、删除网段及地址自动生成
- 资料检出结果登记
- Excel 导入和校验报告
- 意见附件持久化、预览与下载
- 原始资料下载、审计 CSV 导出
- 服务端 Ping/CIDR 工具
- 原生前端迁移至 Vue 3 + TypeScript

未实现的旧接口详见 [API 文档](docs/API.md#尚未实现的旧接口)。

## 开发约定

- IDEA 只打开 `WandaNetJava`，避免索引旧发布包中的大量 DLL。
- 新写操作必须使用 `AuditService` 记录审计。
- 保持旧前端的 URL、HTTP 方法和 JSON 字段名兼容。
- 增加或修改接口时同步维护 `docs/API.md` 和 MockMvc 测试。
- 不提交密码、API Key 或其他密钥。
