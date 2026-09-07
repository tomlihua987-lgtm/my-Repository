# WandaNetOps Java 接口文档

服务地址：`http://localhost:9306`。JSON 使用 UTF-8；除登录和健康检查外，所有 `/api/**` 接口均需要 Cookie `WANDA_NETOPS_SESSION`。

角色：管理员拥有全部权限；运维人员可查询并修改资源/IP；只读用户只能查询。错误格式为 `{"message":"错误说明"}`，常见状态码为 400、401、403、500。

## 健康与认证

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 无需登录，返回 `status=UP` |
| POST | `/api/login` | 登录，兼容原 ASP.NET Identity V3 密码 |
| GET | `/api/me` | 当前用户 |
| POST | `/api/logout` | 注销会话 |
| POST | `/api/change-password` | 修改本人密码 |

登录请求：

```json
{"username":"admin","password":"实际密码"}
```

修改密码请求：

```json
{"currentPassword":"旧密码","newPassword":"至少8位的新密码"}
```

## 资源接口

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/resources` | 登录 | 资源查询 |
| GET | `/api/resources/{id}` | 登录 | 资源详情 |
| PUT | `/api/resources/{id}` | 可写 | 编辑资源 |
| PUT | `/api/resources/{id}/status` | 可写 | 修改状态 |
| GET | `/api/resources/stats` | 登录 | 分类统计 |
| GET | `/api/dashboard` | 登录 | Dashboard 统计 |

`GET /api/resources` 参数：`category`（逗号分隔）、`categories`（兼容别名）、`location`、`q`、`limit`（默认 2000，最大 5000）。

编辑资源示例：

```json
{
  "location":"北京总部",
  "subcategory":"设备台账",
  "name":"核心交换机",
  "ip":"10.0.0.1",
  "status":"在用",
  "details":{"型号":"示例型号","负责人":"张三"}
}
```

统计响应：

```json
{"total":10750,"rows":[{"category":"IP地址管理","subcategory":"网段","count":100}]}
```

## 网段和 IP

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/subnets` | 登录 | 网段查询 |
| GET | `/api/subnets/{id}/addresses` | 登录 | 地址列表 |
| GET | `/api/subnets/{id}/map` | 登录 | 方格图数据 |
| GET | `/api/lookup?ip=...` | 登录 | IP 归属查询 |
| PUT | `/api/addresses/{id}` | 可写 | 登记、编辑或回收 IP |
| POST | `/api/subnets/{id}/allocate` | 可写 | 划拨预留网段 |
| POST | `/api/subnets/{id}/release` | 可写 | 整段回收为预留 |
| POST | `/api/subnets/{id}/allocate-addresses` | 可写 | 批量分配地址 |

`GET /api/subnets` 参数：`kind=idc|office|public|all`、`q`、`zone`、`status`。地址列表支持 `q`、`status`。

IP 登记示例：

```json
{
  "status":"已分配","hostname":"app-server-01","deviceType":"服务器",
  "systemName":"示例系统","owner":"张三","ticketNo":"REQ-001","remarks":"生产环境"
}
```

状态设为 `可用` 时会清空主要业务登记字段。

网段划拨示例：

```json
{"module":"集团WEB","owner":"张三","gateway":"10.199.8.1","vlanId":"100","remarks":"生产业务"}
```

批量分配示例：

```json
{
  "count":2,"startIp":"10.199.8.10","hostname":"app-server",
  "deviceType":"服务器","systemName":"示例系统","owner":"张三","ticketNo":"REQ-001"
}
```

响应：`{"cidr":"10.199.8.0/24","count":2,"ips":["10.199.8.10","10.199.8.11"]}`。

## 用户管理（管理员）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/users` | 用户列表，不返回密码哈希 |
| POST | `/api/users` | 新建用户 |
| PUT | `/api/users/{id}` | 修改姓名、角色和启用状态 |
| POST | `/api/users/{id}/reset-password` | 重置临时密码 |

```json
{"username":"zhangsan","displayName":"张三","role":"运维人员","password":"InitialPassword123!"}
```

```json
{"displayName":"张三","role":"只读用户","enabled":true}
```

```json
{"newPassword":"TemporaryPassword123!"}
```

## 审计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/audit` | 参数：`q`、`user`、`action`、`limit` |
| GET | `/api/audit/stats` | 累计、今日、近七天、用户和动作统计 |

## 意见协作

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/feedback` | 参数：`q`、`category`、`status`、`mine`、`limit` |
| GET | `/api/feedback/stats` | 意见统计 |
| GET | `/api/feedback/{id}` | 详情及回复 |
| POST | `/api/feedback` | multipart：`category`、`module`、`title`、`content`、`files` |
| POST | `/api/feedback/{id}/comments` | `{"content":"补充说明"}` |
| PUT | `/api/feedback/{id}/status` | 管理员处理意见 |
| DELETE | `/api/feedback/{id}` | 管理员或提交人删除 |

处理请求：`{"status":"处理中","note":"已进入开发计划"}`。状态允许：待处理、处理中、已采纳、已完成、暂不处理。当前版本尚未持久化附件。

## 智能查询

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ask/capability` | 引擎能力和示例问题 |
| POST | `/api/ask` | `{"question":"10.199.8.1 属于哪个网段？"}` |

当前支持 IPv4 归属和平台基础统计，不调用外部模型。

## 尚未实现的旧接口

以下接口当前返回 404：

- `POST /api/subnets`、`PUT /api/subnets/{id}`、`DELETE /api/subnets/{id}`
- `POST /api/subnets/{id}/register-detected`
- `POST /api/import`
- `GET /api/source-files/{name}`
- `GET /api/audit/export.csv`
- `GET /api/tools/ping/sources`、`GET /api/tools/ping/sources/{key}`、`POST /api/tools/ping`
- `POST /api/tools/subnets`

## PowerShell 调试

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ username='admin'; password='实际密码' } | ConvertTo-Json
Invoke-RestMethod 'http://localhost:9306/api/login' -Method Post -ContentType 'application/json' -Body $body -WebSession $session
Invoke-RestMethod 'http://localhost:9306/api/resources/stats' -WebSession $session
```
