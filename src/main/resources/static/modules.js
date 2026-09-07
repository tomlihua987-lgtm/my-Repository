// ===== 模块注册表：前端唯一事实源 =====
// 数据库里的 category / subcategory 一律不改，这里只是把 11 个源文件分类按业务域重新组合成 7 个模块。
// 导航按钮、总览页模块卡、页面标题、搜索占位、页签、深链（navModule / askOpen）全部由 MODULES 生成，
// 加一个页签只改这一个文件：在对应模块的 tabs 里加一条。
//
// 页签 kind：
//   panel   —— 整屏面板，render(rows) 往 #assetSummary 里画（F5 网络图、无线大屏、机架立面、工单看板、AP 底图、设备总览）
//   table   —— 明细表：category + sub 选行，columns 给列定义（k 取 _sp 字段，f:'s' 下拉筛选 / 't' 文本筛选，r 自定义渲染）
//   custom  —— 资产清单 / 周报 / 拓扑 这三个保留原有渲染函数，layout 指定页面骨架
//   checks  —— 汇总本模块各分类下 subcategory='数据校核' 的记录，多一列「来源」
//   subnets —— 网段管理表（#subnetsPage），ipKind 指定地址空间 idc / office / public，三个页签共用一块 DOM
const CHECK='数据校核';
const enc=encodeURIComponent;

// ---- 列定义（从旧 SP 对象原样迁入，按分类分组）----
function wlanColumns(key){
  if(key==='无线控制器')return [{k:'控制器名称',label:'控制器',f:'t'},{k:'管理IP',label:'管理 IP',f:'t'},{k:'设备型号',label:'型号',f:'s'},{k:'软件版本',label:'软件版本',f:'s'},{k:'主备关系',label:'主备关系',f:'s'},{k:'纳管AP数量',label:'纳管 AP'},{k:'覆盖楼层数',label:'覆盖楼层'},{k:'广播SSID数量',label:'广播 SSID'},{k:'射频启用数',label:'启用射频'},{k:'2.4G射频',label:'2.4G'},{k:'5G射频',label:'5G'},{k:'资产状态',label:'资产状态',f:'s',r:spTag}];
  if(key==='楼层覆盖')return [{k:'底图',label:'点位底图',r:tableThumb},{k:'楼宇',label:'楼宇',f:'s'},{k:'楼层',label:'楼层',f:'s'},{k:'AP数量',label:'AP 数量'},{k:'资产在线',label:'在线',r:v=>spCount(v,'ok')},{k:'射频全关AP',label:'射频全关',r:v=>spCount(v,'bad')},{k:'覆盖SSID数',label:'SSID 数'},{k:'2.4G信道使用',label:'2.4G 信道分布',f:'t'},{k:'5G信道使用',label:'5G 信道分布',f:'t'},{k:'同频告警数',label:'同频告警',r:v=>spCount(v,'bad')},{k:'相邻同频点位',label:'干扰点位',f:'t'},{k:'覆盖区域',label:'区域',f:'s'}];
  if(key==='射频信道')return [{k:'AP名称',label:'AP 名称',f:'t'},{k:'射频序号',label:'射频',f:'s'},{k:'楼宇',label:'楼宇',f:'s'},{k:'楼层',label:'楼层',f:'s'},{k:'工作频段',label:'频段',f:'s'},{k:'工作信道',label:'信道',f:'s'},{k:'信道带宽',label:'带宽',f:'s'},{k:'发射功率',label:'功率',f:'s'},{k:'射频状态',label:'状态',f:'s',r:spTag},{k:'承载SSID数',label:'SSID 数'},{k:'承载SSID',label:'承载 SSID',f:'t'},{k:'业务VLAN',label:'业务 VLAN',f:'t'}];
  if(key==='SSID服务')return [{k:'SSID',label:'SSID',f:'t'},{k:'业务名称',label:'业务用途',f:'t'},{k:'认证方式',label:'认证方式',f:'s'},{k:'所属控制器',label:'所属控制器',f:'s'},{k:'启用状态',label:'状态',f:'s',r:spTag},{k:'覆盖AP数量',label:'覆盖 AP'},{k:'覆盖楼层数',label:'覆盖楼层'},{k:'安全方式',label:'安全方式',f:'s'},{k:'是否隐藏',label:'隐藏',f:'s',r:spTag},{k:'转发模式',label:'转发模式',f:'s'},{k:'限速策略',label:'限速',f:'s'},{k:'关联VLAN',label:'业务 VLAN',f:'t'},{k:'业务网段',label:'业务网段',f:'t'}];
  return [{k:'AP名称',label:'AP 名称',f:'t'},{k:'楼宇',label:'楼宇',f:'s'},{k:'楼层',label:'楼层',f:'s'},{k:'区域',label:'区域',f:'s'},{k:'设备型号',label:'型号',f:'s'},{k:'工作频段',label:'频段',f:'s'},{k:'2.4G信道',label:'2.4G 信道',f:'s'},{k:'5G信道',label:'5G 信道',f:'s'},{k:'发射功率',label:'功率',f:'s'},{k:'纳管方式',label:'纳管方式',f:'s',r:spTag},{k:'资产状态',label:'资产状态',f:'s',r:spTag},{k:'广播SSID数',label:'SSID 数'},{k:'广播SSID',label:'广播 SSID',f:'t'}]}
const RACK_UNIT_COLS=[{k:'机柜编号',label:'机柜',f:'s'},{k:'U位区间',label:'U 位',f:'s'},{k:'占用U数',label:'占用 U'},{k:'设备类型',label:'设备类型',f:'s'},{k:'设备型号',label:'设备型号',f:'t'},{k:'设备名称',label:'设备名称',f:'t'},{k:'业务角色',label:'业务角色',f:'s'},{k:'功能分区',label:'功能分区',f:'s'},{k:'管理IP',label:'管理 IP',f:'t'},{k:'资产状态',label:'资产状态',f:'s',r:spTag},{k:'型号来源',label:'型号来源',f:'s',r:spTag},{k:'冗余搭档柜',label:'冗余搭档柜',f:'s'}];
const AP_FLOOR_COLS=[{k:'图片序号',label:'序号'},{k:'楼宇',label:'楼宇',f:'s'},{k:'楼层',label:'楼层',f:'s'},{k:'图片文件',label:'底图',f:'t',r:v=>v?`<a href="${esc(v)}" target="_blank" onclick="event.stopPropagation()">${esc(v.split('/').pop())}</a>`:'-'},{k:'AP数量',label:'AC 配置 AP'},{k:'资产在线',label:'资产在线'},{k:'覆盖SSID数',label:'SSID 数'},{k:'覆盖SSID',label:'覆盖 SSID',f:'t'},{k:'2.4G信道使用',label:'2.4G 信道',f:'t'},{k:'5G信道使用',label:'5G 信道',f:'t'},{k:'同频告警数',label:'同频告警'},{k:'AP清单',label:'AP 清单',f:'t'}];
function f5Columns(key){if(F5_LIVE.includes(key))return F5_LIVE_COLUMNS[key];const C={region:{k:'region',label:'F5 区域',f:'s'},vs:{k:'vs',label:'VS 名称',f:'t'},vip:{k:'vip',label:'VIP:Port',f:'t'},pool:{k:'pool',label:'Pool 名称',f:'t'},member:{k:'member',label:'Pool Member',f:'t'},state:{k:'state',label:'Member 状态',f:'s',r:spTag},keep:{k:'keep',label:'是否保留',f:'s',r:spTag},action:{k:'action',label:'执行动作',f:'s',r:spTag},done:{k:'done',label:'完成清理',f:'s',r:spTag},sys:{k:'sys',label:'系统名称',f:'t'},pm:{k:'pm',label:'项目经理',f:'s'}};if(key==='F5当前策略')return [C.region,C.vs,C.vip,C.pool,C.member,C.state,C.sys,C.pm];if(key==='F5配置策略确认')return [C.region,C.vs,C.vip,C.pool,C.member,C.state,C.keep,C.action,C.done,C.sys,C.pm];return [C.vs,C.vip,C.pool,C.member,C.state,C.keep]}
const TK_COLS=[{k:'工单编号',label:'工单编号',f:'t'},{k:'工单状态',label:'状态',f:'s',r:tkStateTag},{k:'事件分类',label:'事件分类',f:'s'},{k:'突发事件等级',label:'等级',f:'s',r:tkLevelTag},{k:'业态名称',label:'业态',f:'s'},{k:'发生时间',label:'发生时间',f:'t'},{k:'解决时间',label:'解决时间',f:'t'},{k:'处理时长',label:'处理时长',f:'t'},{k:'处理工程师',label:'处理工程师',f:'s'},{k:'发起人',label:'发起人',f:'s'},{k:'工单描述',label:'工单描述',f:'t'}];
function cfgColumns(key){const sw=key!=='F5 设备配置';return [{k:'name',label:'设备名称',f:'t'},{k:'ip',label:'管理 IP',f:'t'},{k:'role',label:'角色',f:'s'},...(sw?[{k:'floor',label:'楼层',f:'s'}]:[]),{k:'model',label:'型号',f:'s'},{k:'ver',label:'软件版本',f:'s'},...(sw?[{k:'vifs',label:'VLAN 口'},{k:'ports',label:'开启/端口'}]:[]),{k:'astat',label:'资产状态',f:'s',r:spTag},{k:'check',label:'台账核对',f:'s',r:spTag},...(sw?[{k:'alerts',label:'抓取告警',f:'t',r:v=>v?`<span class="tag off">${esc(v)}</span>`:'-'}]:[]),{k:'time',label:'备份时间'},{k:'lines',label:'配置行数'}]}
function lineColumns(key){if(spDynCols[key])return spDynCols[key];if(key==='SDWAN信息统计表')return [{k:'no',label:'序号'},{k:'biz',label:'业态',f:'s'},{k:'site',label:'局点名称',f:'t'},{k:'line',label:'是否有专线',f:'s',r:spTag},{k:'bw',label:'隧道带宽(M)'},{k:'time',label:'实施完成'},{k:'rent',label:'月租金(元)'},{k:'hub',label:'主接入点',f:'s'},{k:'move',label:'迁移至同程',f:'s'}];const cols=[{k:'no',label:'序号'},{k:'biz',label:'业态',f:'s'},{k:'site',label:'局点名称',f:'t'},{k:'dev',label:'接入设备',f:'t'},{k:'port',label:'端口'},{k:'carrier',label:'运营商',f:'t'},{k:'lineno',label:'专线号',f:'t'},{k:'bw',label:'带宽'},{k:'rent',label:'月租金(元)'}];cols.push(key==='专线信息统计表'?{k:'sdwan',label:'SDWAN',f:'s'}:{k:'note',label:'备注',f:'t'});return cols}
function ipColumns(key){if(key==='各地IP表')return [{k:'no',label:'序号'},{k:'city',label:'城市',f:'s'},{k:'pos',label:'位置',f:'s'},{k:'floor',label:'楼层',f:'s'},{k:'type',label:'网络类型',f:'s'},{k:'biz',label:'业务名称',f:'t'},{k:'ssid',label:'SSID',f:'t'},{k:'cidr',label:'网段',f:'t'},{k:'gw',label:'网关 IP',f:'t'},{k:'dev',label:'管理设备',f:'t'},{k:'mip',label:'管理地址',f:'t'},{k:'use',label:'用途说明',f:'t'}];if(key==='IP分配明细')return [{k:'zone',label:'网络分区',f:'s'},{k:'mod',label:'子模块',f:'t'},{k:'cnt',label:'子网数量'},{k:'subnet',label:'IP 子网',f:'t'},{k:'note',label:'备注',f:'t'}];if(key==='各地公网IP表')return [{k:'no',label:'序号'},{k:'city',label:'城市',f:'s'},{k:'pos',label:'位置',f:'s'},{k:'type',label:'网络类型',f:'s'},{k:'biz',label:'业务名称',f:'t'},{k:'cidr',label:'网段',f:'t'},{k:'note',label:'备注',f:'t'}];if(key==='互联网IP · 公网IP地址分配'||key==='互联网IP · 基础设施互联网ip')return [{k:'publicIp',label:'公网地址',f:'t'},{k:'biz',label:'应用 / 用途',f:'t'},{k:'domain',label:'应用域名',f:'t'},{k:'nat',label:'NAT 方向',f:'s'},{k:'real',label:'实 IP',f:'t'},{k:'status',label:'状态',f:'s',r:spTag},{k:'keep',label:'保留',f:'s',r:spTag},{k:'pm',label:'项目经理',f:'s'},{k:'note',label:'备注',f:'t'}];
if(key.startsWith('互联网IP · '))return [{k:'publicIp',label:'公网地址',f:'t'},{k:'network',label:'所属网段',f:'t'},{k:'carrier',label:'运营商',f:'s'},{k:'biz',label:'应用 / 用途',f:'t'},{k:'status',label:'状态',f:'s',r:spTag},{k:'note',label:'备注 / 可用地址',f:'t'}];return [{k:'no',label:'序号'},{k:'city',label:'城市',f:'s'},{k:'pos',label:'位置',f:'s'},{k:'type',label:'类型',f:'s'},{k:'floor',label:'楼层',f:'s'},{k:'cidr',label:key==='北京各楼层dhcp保留IP'?'保留 IP 段':'可用网段',f:'t'}]}
// 校核页签的两列虚拟字段（来源、对象）不落在记录 details 里，走 _virt
const CHECK_COLS=[{k:'__src',label:'来源',f:'s'},{k:'问题类型',label:'问题类型',f:'s',r:spTag},{k:'__obj',label:'对象',f:'t'},{k:'问题说明',label:'问题说明',f:'t'},{k:'处理建议',label:'处理建议',f:'t'}];
function checkObject(x){const d=x.details||{};return [d['设备名称'],d['机柜编号'],d['工单编号'],d['楼层'],d['管理IP']].filter(Boolean).join(' · ')||x.name||''}
function tableThumb(v){return v?`<a class="tbl-thumb" href="${esc(v)}" target="_blank" onclick="event.stopPropagation()"><img src="${esc(v)}" loading="lazy" alt="点位底图"></a>`:'<span class="sp-zero">无</span>'}

// 一组同分类的明细表页签：key 直接用 subcategory
const tableTabs=(category,order,labels,columns)=>order.map(sub=>({key:sub,label:(labels||{})[sub]||sub,kind:'table',category,sub,columns}));
const checksTab={key:'checks',label:CHECK,kind:'checks'};

const MODULES=[
{id:'devices',title:'设备台账',abbr:'资',desc:'资产表、配置备份与上架图按设备名互相对照，一台设备一张卡',categories:['资产信息','配置备份'],extra:['机柜上架图'],
 search:'搜索设备名、IP、型号、序列号、位置或配置内容',prepare:{'配置备份':spCfgPrepare},stats:spDeviceOverview,
 tabs:[{key:'overview',label:'设备总览',kind:'panel',render:renderDeviceOverview},
       {key:'assets',label:'资产清单',kind:'custom',layout:'asset',category:'资产信息',render:renderAssetsTab,count:rows=>rows.length},
       ...tableTabs('配置备份',['H3C 设备配置','F5 设备配置'],{'H3C 设备配置':'配置 · H3C 交换机 / AC','F5 设备配置':'配置 · F5 BIG-IP'},cfgColumns),
       checksTab]},
{id:'ip',title:'IP 地址',abbr:'IP',desc:'IP 分配在这里落地：数据中心、各地办公网、互联网公网三张规划图上划网段、分地址、登记映射；「分配 IP」向导一次分 N 个，「查 IP」看地址是谁的；原 Excel 台账作为导入底稿随附',categories:['IP地址资料'],
 // 电商 / 舆情两个公网段 sheet 不在 IP 模块展示（记录仍在库里，工具页的网段登记查询照常合并）
 exclude:{'IP地址资料':['版本记录','互联网IP · 电商互联网IP地址表','互联网IP · 舆情互联网IP地址表']},
 search:'搜索网段、楼层、SSID 或业务名称',prepare:{'IP地址资料':spIpPrepare},stats:spIpOverview,
 tabs:[{key:'plan',label:'规划总览',kind:'panel',render:renderIpPlanPanel},
       {key:'zonemap',label:'数据中心分区图',kind:'panel',tall:true,render:renderZoneMapPanel},
       {key:'office',label:'办公网规划图',kind:'panel',tall:true,render:renderOfficeMapPanel},
       {key:'public',label:'公网地址池',kind:'panel',tall:true,render:renderPublicPoolPanel},
       // 三个地址空间各一张网段管理表（同一个 #subnetsPage，按 ipKind 换数据、列头和文案）
       {key:'subnets',label:'IDC 网段管理',kind:'subnets',ipKind:'idc'},
       {key:'officeSubnets',label:'办公网段管理',kind:'subnets',ipKind:'office'},
       {key:'publicSubnets',label:'公网段管理',kind:'subnets',ipKind:'public'},
       ...tableTabs('IP地址资料',['IP分配明细','各地IP表','各地未分配IP段','北京各楼层dhcp保留IP','各地公网IP表','互联网IP · 公网IP地址分配','互联网IP · 基础设施互联网ip','互联网IP · 北京互联网','互联网IP · 珠海集团办公区'],
         {'IP分配明细':'IDC · 分配明细','各地IP表':'各地 · 在用网段','各地未分配IP段':'各地 · 未分配','北京各楼层dhcp保留IP':'各地 · DHCP 保留','各地公网IP表':'各地 · 公网出口','互联网IP · 基础设施互联网ip':'互联网 · 基础设施','互联网IP · 公网IP地址分配':'互联网 · 应用分配','互联网IP · 北京互联网':'互联网 · 北京出口','互联网IP · 珠海集团办公区':'互联网 · 珠海办公区'},ipColumns)]},
{id:'wlan',title:'无线网络',abbr:'无',desc:'两台 AC 的现网配置：控制器主备、楼层覆盖与点位底图、AP、射频信道、SSID',categories:['无线网络','点位图'],exclude:{'点位图':['文档']},
 search:'搜索 SSID、AP 名称、楼宇楼层、信道或控制器',stats:spWirelessOverview,
 // 楼层覆盖行挂上同层的点位底图，表格里直接给缩略图
 after(rows){const images=apFloorImages(rows);for(const x of rows)if(x.category==='无线网络'&&(x.subcategory||'')==='楼层覆盖'){const img=images.get(floorKey(x.details['楼宇'],x.details['楼层']));if(img)x._virt={底图:img.src}}},
 tabs:[{key:'overview',label:'无线总览',kind:'panel',render:renderWirelessPanel},
       {key:'楼层覆盖',label:'楼层覆盖',kind:'table',category:'无线网络',sub:'楼层覆盖',columns:wlanColumns},
       {key:'apmap',label:'点位底图',kind:'panel',tall:true,category:'点位图',render:renderApPanel,count:rows=>rows.filter(x=>x.category==='点位图'&&(x.subcategory||'')==='楼层底图').length},
       ...tableTabs('无线网络',['AP点位清单','射频信道','SSID服务','无线控制器'],{'AP点位清单':'AP 点位','SSID服务':'SSID 服务','无线控制器':'控制器'},wlanColumns),
       {key:'apfloors',label:'底图清单',kind:'table',category:'点位图',sub:'楼层底图',columns:()=>AP_FLOOR_COLS},
       checksTab]},
{id:'lb',title:'负载均衡',abbr:'负',desc:'F5 设备主备、虚拟服务与后端节点健康状况',categories:['负载均衡'],exclude:{'负载均衡':['填写说明']},
 search:'搜索业务系统、VS 名称、VIP、地址池或后端 IP',prepare:{'负载均衡':spF5Prepare},stats:spF5Overview,
 tabs:[{key:'overview',label:'网络图',kind:'panel',render:renderF5Panel},
       ...tableTabs('负载均衡',['F5设备状态','F5虚拟服务','F5地址池成员','F5当前策略','F5配置策略确认','（底稿勿动）内网服务区配置清理','（底稿勿动）DMZ区配置清理'],
         {'F5设备状态':'设备与主备','F5虚拟服务':'业务入口（实配）','F5地址池成员':'后端节点（实配）','F5当前策略':'策略台账','F5配置策略确认':'清理确认','（底稿勿动）内网服务区配置清理':'内网清理底稿','（底稿勿动）DMZ区配置清理':'DMZ清理底稿'},f5Columns)]},
{id:'line',title:'线路资源',abbr:'线',desc:'专线、SDWAN、特殊线路：运营商、带宽、租金和端点资料',categories:['线路资源'],
 search:'搜索局点、专线号、设备名或业态',prepare:{'线路资源':spCircuitPrepare},stats:spCircuitOverview,
 tabs:tableTabs('线路资源',['专线信息统计表','SDWAN信息统计表','特殊线路统计表','首页','特殊线路首页'],{'首页':'分支线路汇总','特殊线路首页':'特殊线路汇总'},lineColumns)},
{id:'site',title:'机房与拓扑',abbr:'拓',desc:'总部逻辑拓扑与燕郊光子机房核心机柜上架图',categories:['网络拓扑','机柜上架图'],
 search:'搜索机柜编号、U 位、设备型号或设备名称',stats:spRackOverview,
 tabs:[{key:'topology',label:'总部逻辑拓扑',kind:'custom',layout:'topology',category:'网络拓扑',hideStats:true,render:rows=>renderTopology(rows[0]||{id:0,source:'万达总部逻辑互联图2026-5-28(1).vsd'})},
       {key:'rack',label:'光子机房上架图',kind:'panel',tall:true,category:'机柜上架图',render:renderRackPanel},
       {key:'上架设备',label:'上架设备',kind:'table',category:'机柜上架图',sub:'上架设备',columns:()=>RACK_UNIT_COLS},
       checksTab]},
{id:'ops',title:'运维记录',abbr:'单',desc:'网络安全组工单统计与运维周报归档',categories:['工单统计','周报'],
 search:'搜索工单编号、描述、处置结果或处理工程师',stats:spTicketOverview,
 tabs:[{key:'board',label:'工单看板',kind:'panel',category:'工单统计',render:renderTicketPanel},
       {key:'工单明细',label:'工单明细',kind:'table',category:'工单统计',sub:'工单明细',columns:()=>TK_COLS},
       {key:'weekly',label:'周报',kind:'custom',layout:'weekly',category:'周报',render:renderWeekly,count:rows=>rows.length},
       {key:'填报说明',label:'填报口径',kind:'table',category:'工单统计',sub:'填报说明',columns:()=>[{k:'填写说明',label:'填写说明',f:'t'}]},
       checksTab]}];
const moduleById=id=>MODULES.find(m=>m.id===id);

// ===== 取数与分派 =====
let curModule=null,curTab=null,moduleRows=[],tabRows=[],moduleCacheKey='';
// 所有取回过的记录按 id 建索引，设备卡 / 查看配置 / 编辑 都从这里找，不再区分「本页缓存」和「全部行」
const recordIndex=new Map();
const findRow=id=>recordIndex.get(Number(id));
const indexRows=rows=>{for(const x of rows)recordIndex.set(x.id,x)};
const tabUsesToolbar=t=>t.kind==='table'||t.kind==='checks'||t.layout==='asset';
function tabRowsOf(t){return moduleRows.filter(x=>(!t.category||x.category===t.category)&&(!t.sub||(x.subcategory||x.sheet||'')===t.sub))}
function checkRowsOf(m){return moduleRows.filter(x=>m.categories.includes(x.category)&&(x.subcategory||'')===CHECK)}
function tabCount(m,t){if(t.kind==='table')return tabRowsOf(t).length;if(t.kind==='checks')return checkRowsOf(m).length;if(t.kind==='subnets')return subnetCounts[t.ipKind||'idc']||'';return t.count?t.count(tabRowsOf(t)):''}

async function loadModule(id,tabKey){
  const m=moduleById(id);if(!m)return;
  const fresh=curModule?.id!==id;curModule=m;
  if(fresh){$('#resourceSearch').value='';$('#locationFilter').value='';$('#assetStatusFilter').value='';$('#subTabs').dataset.key='ALL';$('#assetTabs').dataset.key=''}
  const tab=m.tabs.find(t=>t.key===(tabKey||$('#assetTabs').dataset.key))||m.tabs[0];
  // 面板类页签不带工具栏；从表格切过去时把残留的位置 / 搜索条件清掉，否则大屏会按筛过的数据画
  if(!tabUsesToolbar(tab)&&($('#resourceSearch').value||$('#locationFilter').value)){$('#resourceSearch').value='';$('#locationFilter').value=''}
  const loc=$('#locationFilter').value,q=$('#resourceSearch').value.trim();
  const key=`${id}|${loc}|${q}`;
  if(moduleCacheKey!==key){
    const cats=[...m.categories,...(m.extra||[])].join(',');
    let rows=await api(`/api/resources?location=${enc(loc)}&category=${enc(cats)}&q=${enc(q)}&limit=10000`);
    rows=rows.filter(x=>!(m.exclude?.[x.category]||[]).includes(x.subcategory||x.sheet||''));
    const byCat={};for(const x of rows)(byCat[x.category]??=[]).push(x);
    for(const [c,list] of Object.entries(byCat))((m.prepare||{})[c]||spPassthrough)(list);
    rows=rows.filter(x=>x._sp);
    m.after?.(rows);
    moduleRows=rows;indexRows(rows);moduleCacheKey=key;
  }
  // IP 模块的概览卡按地址表算（subnetLists），刚进模块时重取一次，划拨 / 回收后的数字才是新的
  if(m.id==='ip'&&fresh&&typeof loadSubnetCounts==='function')await loadSubnetCounts();
  renderTab(tab.key);
}
function reloadModule(){moduleCacheKey='';if(curModule)return loadModule(curModule.id,curTab?.key)}
function selectTab(key){renderTab(key)}
function renderTab(key){
  const m=curModule;if(!m)return;
  const tab=m.tabs.find(t=>t.key===key)||m.tabs[0];curTab=tab;$('#assetTabs').dataset.key=tab.key;
  $('#pageTitle').textContent=m.title;$('#pageDesc').textContent=m.desc||'';
  $('#resourceSearch').placeholder=m.search||'搜索';
  $('#resourceSummary').innerHTML=m.stats?m.stats(moduleRows):'';
  // 没数据的明细表不出页签（搜索筛空时当前页签仍保留，免得按钮消失）
  const shown=m.tabs.filter(t=>t===tab||t.kind!=='table'||tabRowsOf(t).length);
  $('#assetTabs').innerHTML=shown.map(t=>{const n=tabCount(m,t);return `<button type="button" class="${t===tab?'active':''}${t.kind==='panel'?' dash-tab':''}${t.kind==='subnets'?' idc-tab':''}" data-tab="${esc(t.key)}" onclick="selectTab(this.dataset.tab)">${esc(t.label)}${n!==''?`<em>${n}</em>`:''}</button>`}).join('');
  applyLayout(tab);
  if(tab.kind==='panel'){tabRows=tabRowsOf(tab);tab.render(tabRows);return}
  if(tab.kind==='table'){drawTable(tabRowsOf(tab),typeof tab.columns==='function'?tab.columns(tab.sub):tab.columns);return}
  if(tab.kind==='checks'){const rows=checkRowsOf(m);for(const x of rows)x._virt={__src:x.category,__obj:checkObject(x)};drawTable(rows,CHECK_COLS);return}
  if(tab.kind==='subnets'){setSubnetsPage(tab.ipKind||'idc');loadSubnets().then(()=>{if(curTab!==tab)return;const b=$('#assetTabs button.idc-tab.active');if(b&&!b.querySelector('em'))b.insertAdjacentHTML('beforeend',`<em>${subnets.length}</em>`)});return}
  tabRows=tabRowsOf(tab);tab.render(tabRows);
}
// 页面骨架靠几个 class 切换，样式全在 resources.css：sp-dash 整屏面板 / sp-tall 面板超一屏整页滚 / sp-idc 方格图 / asset-page 资产清单 / weekly-page / topology-page
function applyLayout(tab){
  const page=$('#resourcesPage'),layout=tab.layout||tab.kind;
  page.classList.remove('sp-dash','sp-idc','sp-tall','asset-page','weekly-page','topology-page');
  if(tab.kind==='panel'){page.classList.add('sp-dash');if(tab.tall)page.classList.add('sp-tall')}
  if(tab.kind==='subnets')page.classList.add('sp-idc');
  if(layout==='asset')page.classList.add('asset-page');
  if(layout==='weekly')page.classList.add('weekly-page');
  if(layout==='topology')page.classList.add('topology-page');
  $('#subnetsPage').classList.toggle('hidden',tab.kind!=='subnets');
  $('#resourceSummary').classList.toggle('hidden',!!tab.hideStats||layout==='weekly'||layout==='topology');
  $('#resourceSummary').className=$('#resourceSummary').className.replace('location-summary','asset-overview');
  $('#assetSummary').classList.toggle('hidden',!(tab.kind==='panel'||layout==='asset'));
  $('#subTabs').classList.toggle('hidden',layout!=='asset');
  $('#assetStatusFilter').classList.toggle('hidden',layout!=='asset');
  $('#resourcesPage .resource-toolbar').classList.toggle('hidden',!tabUsesToolbar(tab));
  if(tab.kind!=='panel'&&layout!=='asset')$('#assetSummary').innerHTML='';
}

// ===== 通用明细表（列定义驱动）=====
function drawTable(rows,cols){
  tabRows=rows;spCols=cols;resourceColumns=cols.map(c=>c.k);
  $('#resourceTable').className='dynamic-view special-view';
  $('#resourceHead').innerHTML=cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+'<th>操作</th>';
  $('#resourceFilters').innerHTML=cols.map((c,i)=>{if(!c.f)return '<th></th>';const vals=c.f==='s'?[...new Set(rows.map(x=>spValue(x,c.k)).filter(Boolean))].sort():[];if(c.f==='s'&&vals.length<=30)return `<th><select class="column-filter" data-mode="exact" data-col="${i}"><option value="">全部</option>${vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></th>`;return `<th><input class="column-filter" data-mode="contains" data-col="${i}" placeholder="筛选"></th>`}).join('')+'<th><button class="secondary" onclick="clearColumnFilters()">清除</button></th>';
  $$('.column-filter').forEach(s=>{s.onchange=applyColumnFilters;if(s.tagName==='INPUT')s.oninput=applyColumnFilters});
  drawSpecialRows(rows);
}
function drawSpecialRows(rows){
  const cap=1000,shown=rows.slice(0,cap);
  let html=shown.map(x=>`<tr class="asset-row" onclick="openResourceRecord(${x.id})">${spCols.map(c=>{const v=spValue(x,c.k);return `<td title="${esc(v)}">${c.r?c.r(v,x):esc(v)||'-'}</td>`}).join('')}<td>${x.category==='配置备份'&&x.details?.['配置内容']?`<button onclick="event.stopPropagation();viewConfig(${x.id})">查看配置</button>`:`<button onclick="event.stopPropagation();openResourceRecord(${x.id})">详情</button>`}</td></tr>`).join('')||`<tr><td colspan="${spCols.length+1}">没有符合条件的记录。</td></tr>`;
  if(rows.length>cap)html+=`<tr><td colspan="${spCols.length+1}" class="row-cap">仅显示前 ${cap} 条（共 ${rows.length.toLocaleString()} 条），请用上方筛选或搜索缩小范围。</td></tr>`;
  $('#resourceRows').innerHTML=html;
}
function applyColumnFilters(){const asset=curTab?.layout==='asset';const get=asset?assetValue:spValue,draw=asset?drawAssetRows:drawSpecialRows;const controls=$$('.column-filter');draw(tabRows.filter(x=>controls.every(s=>{const value=get(x,resourceColumns[Number(s.dataset.col)]);return !s.value||(s.dataset.mode==='contains'?value.toLowerCase().includes(s.value.toLowerCase()):value===s.value)})))}
function clearColumnFilters(){$$('.column-filter').forEach(s=>s.value='');(curTab?.layout==='asset'?drawAssetRows:drawSpecialRows)(tabRows)}

// ===== 资产清单页签（custom）：综合汇总矩阵 + 按 sheet 的子页签 + 资产表 =====
let assetRows=[];
function renderAssetsTab(rows){assetRows=rows;renderAssetSummary(rows);renderSubTabs(rows);drawAssetList()}
function renderSubTabs(rows){const counts=new Map();for(const x of rows)counts.set(x.subcategory||x.sheet,(counts.get(x.subcategory||x.sheet)||0)+1);const tabs=[{key:'ALL',label:'全部资产',count:rows.length},...[...counts.entries()].map(([sheet,count])=>({key:sheet,label:sheetLabels[sheet]||sheet,count}))];const el=$('#subTabs');if(!tabs.some(t=>t.key===el.dataset.key))el.dataset.key='ALL';el.innerHTML=tabs.map(t=>`<button type="button" class="${t.key===el.dataset.key?'active':''}" data-sheet="${esc(t.key)}" onclick="selectAssetSheet(this.dataset.sheet)">${esc(t.label)}<em>${t.count}</em></button>`).join('')}
function selectAssetSheet(key){$('#subTabs').dataset.key=key;$$('#subTabs button').forEach(b=>b.classList.toggle('active',b.dataset.sheet===key));drawAssetList()}
function drawAssetList(){const key=$('#subTabs').dataset.key||'ALL',status=$('#assetStatusFilter').value;const list=assetRows.filter(x=>(key==='ALL'||(x.subcategory||x.sheet)===key)&&(!status||x.status===status));tabRows=list;renderAssets(list,key)}
async function updateResourceStatus(id,select){const previous=select.dataset.previous||select.value;select.disabled=true;try{await api(`/api/resources/${id}/status`,{method:'PUT',body:JSON.stringify({status:select.value})});select.dataset.previous=select.value;const row=findRow(id);if(row)row.status=select.value;if(curTab)renderTab(curTab.key);toast('资产状态已更新')}catch(err){select.value=previous;toast(err.message)}finally{select.disabled=me.role==='只读用户'}}

// ===== 记录打开：设备类记录一律走跨源设备卡，其余给字段卡 =====
const DEVICE_LIKE=x=>x.category==='资产信息'||(x.category==='配置备份'&&(x.subcategory||'')!==CHECK)||(x.category==='机柜上架图'&&(x.subcategory||'')==='上架设备')||(x.category==='无线网络'&&['无线控制器','AP点位清单'].includes(x.subcategory||''))||(x.category==='负载均衡'&&(x.subcategory||'')==='F5设备状态');
function openResourceRecord(id){openRecord(id)}
async function openRecord(id){let x=findRow(id);if(!x){try{x=await api(`/api/resources/${id}`)}catch(e){toast(e.message);return}if(!x)return;recordIndex.set(x.id,x)}openRecordRow(x)}
function openRecordRow(x){if(DEVICE_LIKE(x)){deviceCard(x);return}if(x.category==='周报'){recordForm(x);return}specialCard(x)}
function specialCard(x){const entries=Object.entries(x.details||{}).filter(([k,v])=>k!=='配置内容'&&String(v??'').trim());modal(`${x.subcategory||x.category} · ${x.name}`,`<div class="detail-grid">${entries.map(([k,v])=>`<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div><div class="modal-tools"><small>来源：${esc(x.source)}${x.sheet?' · '+esc(x.sheet):''}</small>${x.category==='配置备份'&&x.details?.['配置内容']?`<button type="button" onclick="viewConfig(${x.id})">查看配置全文</button>`:''}${me.role!=='只读用户'?`<button type="button" class="secondary" onclick="recordFormById(${x.id})">编辑这条记录</button>`:''}</div>`,null,true)}
function recordFormById(id){const x=findRow(id);if(x)recordForm(x)}
async function viewConfig(id){
  let x=findRow(id);if(!x){try{x=await api(`/api/resources/${id}`);if(x)recordIndex.set(x.id,x)}catch(e){toast(e.message)}}if(!x)return;
  const d=x.details||{},text=String(d['配置内容']||'');
  modal(`${x.name} · 设备配置`,`<div class="cfg-meta"><span><b>${esc(x.name)}</b></span><span>${esc(x.ip||d['管理IP']||'')}</span><span>${esc(d['厂商']||'')} ${esc(d['资产型号']||'')}</span><span>版本 ${esc(d['配置软件版本']||'-')}</span><span>备份于 ${esc(d['备份时间']||'-')}</span><span>${text.split('\n').length} 行</span></div><div class="cfg-tools"><input id="cfgSearch" placeholder="在配置中搜索，如 vlan、interface、ip route"><span id="cfgCount"></span><button type="button" class="secondary" onclick="downloadConfig(${x.id})">下载配置</button></div><pre id="cfgPre" class="cfg-pre">${esc(text)}</pre>`,null,true);
  $('#cfgSearch').oninput=e=>{const q=e.target.value.trim(),pre=$('#cfgPre');if(!q){pre.innerHTML=esc(text);$('#cfgCount').textContent='';return}const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');let html='',last=0,n=0;text.replace(re,(m,off)=>{html+=esc(text.slice(last,off))+`<mark>${esc(m)}</mark>`;last=off+m.length;n++;return m});html+=esc(text.slice(last));pre.innerHTML=html;$('#cfgCount').textContent=n?`${n} 处匹配`:'无匹配';pre.querySelector('mark')?.scrollIntoView({block:'center'})};
}
function downloadConfig(id){const x=findRow(id);if(!x)return;const blob=new Blob([String(x.details?.['配置内容']||'')],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${x.name||'config'}-${x.ip||''}.cfg.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}

// ===== 跨源设备卡：一台设备在资产表、配置备份、上架图、各地IP表、无线 AC 里的记录拼成一张卡 =====
// 匹配口径：设备名归一后相等（忽略空格 / 下划线 / 连字符 / 大小写），或管理 IP 相等。
// 一次 q= 检索会带回名字相近的噪音（F21_1 会命中 F21_10），所以拿回来后再按精确口径过一遍。
function devName(r){return r.name||r.details?.['设备名称']||r.details?.['控制器名称']||r.details?.['AP名称']||''}
function devIp(r){return r.ip||r.details?.['管理IP']||r.details?.['管理地址']||''}
async function deviceCard(x){
  const name=devName(x),ip=devIp(x),key=devKey(name);
  const hits=new Map([[x.id,x]]);
  try{const qs=[];if(name.length>=3)qs.push(api(`/api/resources?q=${enc(name)}&limit=300`));if(ip)qs.push(api(`/api/resources?q=${enc(ip)}&limit=300`));
    for(const list of await Promise.all(qs))for(const r of list){recordIndex.set(r.id,r);hits.set(r.id,r)}}catch(e){toast(e.message)}
  const all=[...hits.values()];
  const same=r=>(key&&devKey(devName(r))===key)||(ip&&devIp(r)===ip);
  const sub=r=>r.subcategory||'';
  const assets=all.filter(r=>r.category==='资产信息'&&same(r));
  const cfgs=all.filter(r=>r.category==='配置备份'&&sub(r)!==CHECK&&same(r));
  const units=all.filter(r=>r.category==='机柜上架图'&&sub(r)==='上架设备'&&(devKey(r.details?.['设备名称'])===key||(ip&&r.details?.['管理IP']===ip)));
  const ipRows=all.filter(r=>r.category==='IP地址资料'&&sub(r)==='各地IP表'&&((key&&devKey(r.details?.['管理设备名称'])===key)||(ip&&r.details?.['管理地址']===ip)));
  const acs=all.filter(r=>r.category==='无线网络'&&sub(r)==='无线控制器'&&same(r));
  const aps=all.filter(r=>r.category==='无线网络'&&sub(r)==='AP点位清单'&&same(r));
  const f5s=all.filter(r=>r.category==='负载均衡'&&sub(r)==='F5设备状态'&&same(r));
  const checks=all.filter(r=>sub(r)===CHECK&&((key&&devKey(r.details?.['设备名称'])===key)||(ip&&r.details?.['管理IP']===ip)));
  const a0=assets[0],f=a0?assetField(a0):null,c0=cfgs[0]?.details||{};
  const type=f?[f.type,f.brand,f.model].filter(Boolean).join(' · '):[c0['厂商'],c0['资产型号']||c0['设备角色']].filter(Boolean).join(' · ');
  const place=f?.place||units[0]?.details?.['机柜编号']&&`${units[0].details['机柜编号']} ${units[0].details['U位区间']}`||x.location;
  const chips=[a0?statusTag(a0):'',cfgs.length?`<span class="tag on">有配置备份</span>`:'',units.length?`<span class="tag reserve">已上架</span>`:'',acs.length?`<span class="tag reserve">无线 AC</span>`:'',aps.length?`<span class="tag ${aps[0].status==='在线'?'on':'off'}">AP · ${esc(aps[0].status||'')}</span>`:'',f5s.length?`<span class="tag reserve">F5 · ${esc(f5s[0].details?.['集群角色']||'')}</span>`:''].filter(Boolean).join('');
  const kv=pairs=>`<div class="dc-kv">${pairs.filter(([,v])=>String(v??'').trim()&&v!=='—').map(([k,v])=>`<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>`;
  const sec=(title,n,body)=>`<section class="dc-sec"><h5>${esc(title)}<em>${n}</em></h5>${body}</section>`;
  const statusSel=r=>{const cur=r.status||'待确认';return `<select class="status-select" data-previous="${esc(cur)}" onchange="updateResourceStatus(${r.id},this)" ${me.role!=='只读用户'?'':'disabled'}>${[...new Set([cur,'在线','下线','在库','维修','停用','报废','待确认'])].map(v=>`<option ${v===cur?'selected':''}>${esc(v)}</option>`).join('')}</select>`};
  const secAssets=assets.length?assets.map(r=>{const g=assetField(r);return `<article class="dc-item">${kv([['资料表',g.sheetLabel],['角色',g.role],['类型',g.type],['厂家 / 型号',[g.brand,g.model].filter(Boolean).join(' ')],['序列号',g.serial],['位置',g.place],['用途',g.use],['维保',g.vendor]])}<footer>状态 ${statusSel(r)}<button type="button" class="secondary" onclick="specialCard(findRow(${r.id}))">全部字段</button>${me.role!=='只读用户'?`<button type="button" class="secondary" onclick="recordFormById(${r.id})">编辑</button>`:''}</footer></article>`}).join(''):'<p class="dc-none">资产表里没有这台设备（按设备名 / 管理 IP 都没找到），建议补登记。</p>';
  const secCfg=cfgs.length?cfgs.map(r=>{const d=r.details||{};return `<article class="dc-item">${kv([['配置设备名',d['配置设备名']||r.name],['管理 IP',d['管理IP']||r.ip],['角色',d['设备角色']],['软件版本',d['配置软件版本']],['软件平台',d['软件平台']],['VLAN 接口',d['VLAN接口数']],['端口',d['物理端口数']?`${d['未关闭端口']}/${d['物理端口数']} 开启`:''],['台账核对',d['台账核对']],['抓取期间告警',d['抓取期间告警']],['备份时间',d['备份时间']]])}<footer>${d['配置内容']?`<button type="button" onclick="viewConfig(${r.id})">查看配置</button>`:''}<button type="button" class="secondary" onclick="specialCard(findRow(${r.id}))">解析要点</button></footer></article>`}).join(''):'<p class="dc-none">资料\\conf 里没有这台设备的配置。</p>';
  const secRack=units.length?units.map(r=>{const d=r.details||{};return `<article class="dc-item">${kv([['机柜',d['机柜编号']],['U 位',`${d['U位区间']}（${d['占用U数']}U）`],['功能分区',d['功能分区']],['业务角色',d['业务角色']],['冗余搭档柜',d['冗余搭档柜']],['型号来源',d['型号来源']]])}<footer><button type="button" class="secondary" onclick="navModule('site','rack')">看机架立面</button></footer></article>`}).join(''):'';
  const secIp=ipRows.length?ipRows.map(r=>{const d=r.details||{};return `<article class="dc-item">${kv([['城市 / 位置',[d['城市'],d['位置'],d['楼层']].filter(Boolean).join(' / ')],['网络类型',d['网络类型']],['业务',d['业务名称']],['网段',d['网段']],['网关',d['网关IP']],['管理地址',d['管理地址']],['用途',d['用途说明']]])}</article>`}).join(''):'';
  const secWlan=[...acs,...aps].length?[...acs,...aps].map(r=>{const d=r.details||{};return `<article class="dc-item">${kv(acs.includes(r)?[['控制器',d['控制器名称']],['管理 IP',d['管理IP']],['型号 / 版本',`${d['设备型号']||''} ${d['软件版本']||''}`],['主备关系',d['主备关系']],['纳管 AP',d['纳管AP数量']],['广播 SSID',d['广播SSID数量']],['启用射频',d['射频启用数']]]:[['AP 名称',d['AP名称']],['楼宇 / 楼层',`${d['楼宇']||''} ${d['楼层']||''} ${d['区域']||''}`],['型号',d['设备型号']],['频段',d['工作频段']],['信道',`2.4G ${d['2.4G信道']||'-'} · 5G ${d['5G信道']||'-'}`],['纳管方式',d['纳管方式']],['广播 SSID',d['广播SSID']]])}<footer><button type="button" class="secondary" onclick="specialCard(findRow(${r.id}))">全部字段</button></footer></article>`}).join(''):'';
  const secF5=f5s.length?f5s.map(r=>{const d=r.details||{};return `<article class="dc-item">${kv([['区域',d['F5区域']],['主备角色',d['集群角色']],['软件版本',d['软件版本']],['硬件平台',d['硬件平台']],['承载虚拟服务',d['承载虚拟服务']],['承载地址池',d['承载地址池']]])}<footer><button type="button" class="secondary" onclick="navModule('lb','overview')">看 F5 网络图</button></footer></article>`}).join(''):'';
  const secChecks=checks.length?`<ul class="dc-checks">${checks.map(r=>`<li onclick="specialCard(findRow(${r.id}))"><b>${esc(r.details?.['问题类型'])}</b><span>${esc(r.details?.['问题说明'])}</span><em>${esc(r.category)}</em></li>`).join('')}</ul>`:'';
  modal(`设备 · ${name||ip||x.name}`,`<div class="dc"><div class="asset-hero dc-hero"><div class="asset-hero-title"><b>${esc(name||x.name)}</b>${chips}</div><p>${esc(type)||'无型号信息'}</p><p>${esc(ip||'无管理地址')} · ${esc(place||'')}</p><small>来源：资产表 ${assets.length} · 配置 ${cfgs.length} · 上架图 ${units.length} · IP 表 ${ipRows.length} · 无线 ${acs.length+aps.length}${f5s.length?` · F5 ${f5s.length}`:''}${checks.length?` · 待核对 ${checks.length}`:''}</small></div>
    ${sec('资产台账',assets.length,secAssets)}
    ${sec('配置备份',cfgs.length,secCfg)}
    ${units.length?sec('上架位置',units.length,secRack):''}
    ${ipRows.length?sec('各地 IP 表登记',ipRows.length,secIp):''}
    ${acs.length+aps.length?sec('无线纳管',acs.length+aps.length,secWlan):''}
    ${f5s.length?sec('F5 设备',f5s.length,secF5):''}
    ${checks.length?sec('数据校核',checks.length,secChecks):''}</div>`,null,true);
}
