// ===== 各域面板渲染（F5 网络图、无线大屏、机架立面、工单看板、AP 底图、周报、拓扑、资产矩阵、设备总览）=====
// 这些函数只负责把已取回、已 prepare 的记录画成 HTML；取数、页签、布局切换都在 modules.js 的注册表里。
// 面板统一写到 #assetSummary（模块页的面板容器），概览卡函数（spXxxOverview）返回 HTML 由 renderModule 放进 #resourceSummary。
let resourceColumns=[],spCols=[],spDynCols={};
// 记录字段读取：所有源表的表头都不统一，按候选名清洗后取第一个非空值
const cleanKey=k=>String(k||'').replace(/\s|（.*?）|\(.*?\)/g,'').toLowerCase();
const nameKeys=['设备名称','名称','F5配置名VSName','局点名称','业务名称','万达集团IDC网络IP地址分配表'];
const ipKeys=['IP地址','设备IP地址','F5VIP:PortVSIP:Port','网段','IP子网','可用网段','保留IP'];
const statusKeys=['状态','实IP状态MemberState','MemberState','是否完成清理'];
const typeKeys=['设备类型'];
const brandKeys=['设备厂家','设备品牌','品牌'];
const modelKeys=['设备型号','型号'];
const serialKeys=['设备序列号','序列号'];
const useKeys=['用途','设备用途'];
const vendorKeys=['维保类型','维保厂商'];
const qtyKeys=['库存数量'];
const sheetLabels={'廊坊网络设备':'廊坊/光子网络','安全设备':'安全设备','北京&珠海网络设备':'北京&珠海网络','库存配件':'库存配件','其他':'外地办公区','B座在管商管设备':'B座商管'};
function pickDetail(details,names){for(const name of names){for(const [k,v] of Object.entries(details||{}))if(cleanKey(k)===cleanKey(name)&&String(v??'').trim())return String(v)}return ''}
function assetPlace(details){const site=pickDetail(details,['物理位置','设备位置','所在位置']);const room=pickDetail(details,['位置']);const rack=pickDetail(details,['机架位置']);const full=pickDetail(details,['完整位置']);if(full)return full;return [...new Set([site,room,rack].filter(Boolean))].join(' / ')}
function assetField(x){const d=x.details||{};return{sheet:x.subcategory||x.sheet||'',sheetLabel:sheetLabels[x.subcategory||x.sheet]||x.subcategory||x.sheet||'',name:x.name||pickDetail(d,nameKeys),ip:x.ip||pickDetail(d,ipKeys),type:pickDetail(d,typeKeys),brand:pickDetail(d,brandKeys),model:pickDetail(d,modelKeys),serial:pickDetail(d,serialKeys),place:assetPlace(d),use:pickDetail(d,useKeys),vendor:pickDetail(d,vendorKeys),qty:pickDetail(d,qtyKeys),role:pickDetail(d,['资产角色'])||'设备',note:pickDetail(d,['说明','备注'])}}
function assetOverviewStats(rows){const online=rows.filter(x=>x.status==='在线').length,offline=rows.filter(x=>x.status==='下线').length,stock=rows.filter(x=>x.status==='在库'||assetField(x).role==='配件').length,named=rows.filter(x=>pickDetail(x.details,['设备名称'])).length;const locs={};for(const x of rows)locs[x.location]=(locs[x.location]||0)+1;return spStats([['资产总数',rows.length,'Excel 设备资产统计表'],['在线',online,'当前在网运行'],['下线 / 在库',offline+stock,`${offline} 下线 · ${stock} 配件库存`],['有主机名',named,`${rows.length-named} 条为板卡/备件/配件`],['燕郊光子机房',locs['燕郊光子机房']||0,'廊坊网络与光子库存'],['北京总部',locs['北京总部']||0,`外地 ${locs['其他区域']||0} 条`]])}
function assetClass(x){const f=assetField(x);const t=f.type||'';if(f.role==='配件')return '库存配件';if(/板卡|电源|风扇|模块/.test(t)||f.role==='板卡')return '板卡/模块';if(/交换机/.test(t))return '交换机';if(/路由器|CPE/.test(t))return '路由器';if(/负载均衡/.test(t))return '负载均衡';if(/AP/.test(t)||f.role==='AP')return '无线AP';if(/AC/.test(t))return '无线AC';if(/防火墙/.test(t))return '防火墙';if(t)return '安全/其它';return '未登记类型'}
// 资产类别 × 位置、维保类型 × 位置 两张矩阵；资产清单页签和设备总览面板共用
function assetSummaryTables(rows){
  const locs=['燕郊光子机房','北京总部','其他区域'];
  const order=['交换机','路由器','负载均衡','无线AP','无线AC','防火墙','安全/其它','板卡/模块','库存配件','未登记类型'];
  const matrix={},warr={};
  for(const x of rows){
    const cls=assetClass(x),loc=locs.includes(x.location)?x.location:'其他区域';
    const c=((matrix[cls]??={})[loc]??={total:0,on:0,off:0,stock:0,other:0});
    const s=x.status==='在线'?'on':x.status==='下线'?'off':x.status==='在库'?'stock':'other';
    c[s]++;c.total++;
    const wRaw=pickDetail(x.details,['维保类型','维保厂商']);
    const w=/原厂/.test(wRaw)?'原厂保':/集成商/.test(wRaw)?'集成商保':/无维保/.test(wRaw)?'无维保':'未登记';
    const wr=(warr[w]??={});wr[loc]=(wr[loc]||0)+1;
  }
  const cellHtml=c=>{if(!c||!c.total)return '<td class="mx-zero">—</td>';const parts=[c.on?`在线 ${c.on}`:'',c.off?`下线 ${c.off}`:'',c.stock?`在库 ${c.stock}`:'',c.other?`其它 ${c.other}`:''].filter(Boolean).join(' · ');return `<td><b>${c.total.toLocaleString()}</b><small>${parts}</small></td>`};
  const sum=cells=>{const t={total:0,on:0,off:0,stock:0,other:0};for(const c of cells)if(c)for(const p in t)t[p]+=c[p]||0;return t};
  const classes=order.filter(k=>matrix[k]);
  const t1=`<table class="summary-matrix"><thead><tr><th>设备类别</th>${locs.map(l=>`<th>${l}</th>`).join('')}<th>合计</th></tr></thead><tbody>${classes.map(k=>`<tr><td class="mx-name">${k}</td>${locs.map(l=>cellHtml(matrix[k][l])).join('')}${cellHtml(sum(locs.map(l=>matrix[k][l])))}</tr>`).join('')}<tr class="mx-total"><td>合计</td>${locs.map(l=>cellHtml(sum(classes.map(k=>matrix[k][l])))).join('')}${cellHtml(sum(classes.flatMap(k=>locs.map(l=>matrix[k][l]))))}</tr></tbody></table>`;
  const wOrder=['原厂保','集成商保','无维保','未登记'].filter(k=>warr[k]);
  const t2=`<table class="summary-matrix"><thead><tr><th>维保类型</th>${locs.map(l=>`<th>${l}</th>`).join('')}<th>合计</th></tr></thead><tbody>${wOrder.map(k=>{const wr=warr[k];const tot=locs.reduce((a,l)=>a+(wr[l]||0),0);return `<tr><td class="mx-name">${k}</td>${locs.map(l=>`<td><b>${wr[l]||0}</b></td>`).join('')}<td><b>${tot.toLocaleString()}</b></td></tr>`}).join('')}<tr class="mx-total"><td>合计</td>${locs.map(l=>`<td><b>${wOrder.reduce((a,k)=>a+(warr[k][l]||0),0)}</b></td>`).join('')}<td><b>${rows.length.toLocaleString()}</b></td></tr></tbody></table>`;
  return {t1,t2,classes,matrix,locs};
}
let assetSummaryRows=[];
function renderAssetSummary(rows){
  const el=$('#assetSummary');if(!el)return;assetSummaryRows=rows;
  const {t1,t2}=assetSummaryTables(rows);
  const collapsed=el.dataset.collapsed==='1';
  el.innerHTML=`<div class="panel asset-summary-panel"><div class="panel-head"><h3>资产综合汇总</h3><span>按库内数据实时统计（共 ${rows.length.toLocaleString()} 条），修改状态或维保后自动联动</span><button type="button" class="secondary" onclick="toggleAssetSummary()">${collapsed?'展开':'收起'}</button></div><div class="asset-summary-grid ${collapsed?'hidden':''}">${t1}${t2}</div></div>`;
}
function toggleAssetSummary(){const el=$('#assetSummary');el.dataset.collapsed=el.dataset.collapsed==='1'?'':'1';renderAssetSummary(assetSummaryRows)}
function assetValue(x,key){const f=assetField(x);return({sheet:f.sheetLabel,role:f.role,name:f.name,ip:f.ip,type:f.type,brand:f.brand,model:f.model,serial:f.serial,status:x.status||'',place:f.place,use:f.use,vendor:f.vendor,qty:f.qty,note:f.note})[key]||''}
function assetColumns(rows,sheet){sheet=sheet||'ALL';if(sheet==='库存配件'||(sheet==='ALL'&&rows.length&&rows.every(x=>assetField(x).role==='配件')))return{keys:['model','brand','note','qty','place','status'],labels:{model:'型号',brand:'品牌',note:'说明',qty:'库存数量',place:'存放位置',status:'状态'}};const keys=sheet==='ALL'?['sheet','role','name','ip','type','brand','model','serial','status','place','use','vendor']:['role','name','ip','type','brand','model','serial','status','place','use','vendor'];return{keys,labels:{sheet:'资料表',role:'角色',name:'设备名称',ip:'IP地址',type:'设备类型',brand:'厂家',model:'型号',serial:'序列号',status:'状态',place:'位置',use:'用途',vendor:'维保'}}}
function renderAssets(rows,sheet){const {keys,labels}=assetColumns(rows,sheet);resourceColumns=keys;$('#resourceTable').className='dynamic-view asset-info-view';$('#resourceHead').innerHTML=keys.map(k=>`<th>${labels[k]}</th>`).join('')+'<th>操作</th>';$('#resourceFilters').innerHTML='';drawAssetRows(rows)}
function roleTag(role){const map={设备:'role-host',板卡:'role-card',备件:'role-spare',配件:'role-part',AP:'role-ap',未命名:'role-spare'};return `<span class="role-tag ${map[role]||''}">${esc(role)}</span>`}
function statusTag(x){const cls=x.status==='在线'?'on':x.status==='下线'?'off':x.status==='在库'?'stock':'';return `<span class="tag ${cls}">${esc(x.status||'待确认')}</span>`}
function drawAssetRows(rows){const keys=resourceColumns;$('#resourceRows').innerHTML=rows.map(x=>{const f=assetField(x);const named=!!pickDetail(x.details,['设备名称']);const cells=keys.map(k=>{if(k==='role')return `<td>${roleTag(f.role)}</td>`;if(k==='status')return `<td>${statusTag(x)}</td>`;if(k==='name')return `<td class="${named?'':'unnamed'}" title="${esc(f.name)}">${esc(f.name)||'-'}${named?'':`<small>无主机名</small>`}</td>`;const v=assetValue(x,k);return `<td title="${esc(v)}">${esc(v)||'-'}</td>`}).join('');return `<tr class="asset-row" onclick="openResourceRecord(${x.id})">${cells}<td><button onclick="event.stopPropagation();openResourceRecord(${x.id})">详情</button></td></tr>`}).join('')||`<tr><td colspan="${keys.length+1}">没有符合条件的资产。</td></tr>`}
// _sp 是 prepare 整理出的展示字段；_virt 放不属于记录本身的虚拟列（校核页签的来源 / 对象、楼层覆盖行挂的底图），不会随编辑写回
function spValue(x,k){return String(x._sp?.[k]??x._virt?.[k]??'')}
function spStats(items){return items.map(([k,v,d])=>`<div class="asset-stat"><small>${esc(k)}</small><b>${typeof v==='number'?v.toLocaleString():esc(String(v))}</b><em>${esc(d||'')}</em></div>`).join('')}
const spGoodTag=/^(up|是|在线|保留|全部在线|已启用|已匹配|已关联|主用|正常调度|一致)$/;
const spBadTag=/^(down|否|下线|全部异常|已停用|离线|未匹配|资产表未登记|资产表无此设备|未挂成员)$/;
function spTag(v){if(!v)return '-';const s=String(v);const cls=spGoodTag.test(s)?'on':spBadTag.test(s)||/下线|不一致/.test(s)?'off':'reserve';return `<span class="tag ${cls}">${esc(s)}</span>`}
function spCount(v,cls){const n=Number(v)||0;return n?`<b class="sp-count ${cls}">${n}</b>`:'<span class="sp-zero">0</span>'}
const F5_LIVE=['F5设备状态','F5虚拟服务','F5地址池成员'];
function spPassthrough(rows){for(const x of rows)x._sp=x.details||{}}
function spF5Prepare(rows){const groups={};for(const x of rows)(groups[x.subcategory||'']??=[]).push(x);for(const [sheet,list] of Object.entries(groups)){if(F5_LIVE.includes(sheet)){spPassthrough(list);continue}list.sort((a,b)=>a.id-b.id);let last=null;for(const x of list){const d=x.details||{};const v={region:pickDetail(d,['F5区域']),vs:pickDetail(d,['F5配置名VSName','VSName']),vip:pickDetail(d,['F5VIP:PortVSIP:Port','VSIP:Port']),pool:pickDetail(d,['策略名PoolName','PoolName']),member:pickDetail(d,['策略指向实IPPoolMember','PoolMember']),state:pickDetail(d,['实IP状态MemberState','MemberState']).toLowerCase(),keep:pickDetail(d,['是否保留down状态默认为不保留','是否保留']),action:pickDetail(d,['最终执行动作']),done:pickDetail(d,['是否完成清理']),sys:pickDetail(d,['系统名称']),pm:pickDetail(d,['项目经理'])};if(last){if(!v.pool)v.pool=last.pool;if(!v.vs){v.vs=last.vs;if(!v.vip)v.vip=last.vip}if(!v.region)v.region=last.region;if(v.pool&&v.pool===last.pool)for(const k of ['sys','pm','keep','done','action'])if(!v[k])v[k]=last[k]}const sub=x.subcategory||'';if(!v.region)v.region=/DMZ/.test(sub)?'DMZ区':/内网/.test(sub)?'内网区':'';x._sp=v;last=v}}}
function spF5Overview(rows){
  const by=s=>rows.filter(x=>(x.subcategory||'')===s);
  const dev=by('F5设备状态'),vs=by('F5虚拟服务'),mem=by('F5地址池成员');
  const conf=by('F5配置策略确认').map(x=>x._sp);
  const health=k=>vs.filter(x=>x._sp['健康状态']===k).length;
  const member=k=>mem.filter(x=>x._sp['成员状态']===k).length;
  const zones=new Set(dev.map(x=>x._sp['F5区域']).filter(Boolean)).size;
  const systems=new Set(vs.map(x=>x._sp['业务系统']).filter(Boolean)).size;
  const off=conf.filter(v=>/下线/.test(v.action)).length,done=conf.filter(v=>v.done==='是').length;
  return spStats([
    ['F5 设备',dev.length,zones?`${zones} 个区域 · 两组主备`:'配置未采集'],
    ['对外业务入口',vs.length,`覆盖 ${systems} 个业务系统`],
    ['服务全部正常',health('全部在线'),`部分节点异常 ${health('部分异常')} 个`],
    ['服务全部中断',health('全部异常'),'建议优先核实'],
    ['后端节点在线',member('在线'),`离线 ${member('离线')} · 人工停用 ${member('人工禁用')}`],
    ['配置清理进度',off?`${(done/off*100).toFixed(0)}%`:'—',off?`计划下线 ${off} 条成员，已完成 ${done} 条`:'来自策略确认表']])}
// F5 网络图：照着 BIG-IP 的 Network Map 排卡片，一张卡就是一个虚拟服务：VS → VIP:Port → 地址池 → 池成员
// 状态点沿用 F5 的图形语义：绿圆在线、红菱形离线、黄菱形部分异常、黑方块人工停用、蓝方块未探测
const F5_DOT={'全部在线':'up','在线':'up','正常调度':'up','部分异常':'warn','全部异常':'down','离线':'down','人工禁用':'off','已停用':'off','已启用':'up','未挂成员':'unk','未探测':'unk'};
function f5Dot(state){return `<i class="f5-dot d-${F5_DOT[state]||'unk'}" title="${esc(state||'未知')}"></i>`}
let f5Map=null;
function renderF5Panel(rows){
  const el=$('#assetSummary');el.classList.remove('hidden');
  const vsRows=rows.filter(x=>(x.subcategory||'')==='F5虚拟服务');
  const memRows=rows.filter(x=>(x.subcategory||'')==='F5地址池成员');
  // 成员按「区域+池名」归堆：同名池在两个区域可能各有一个
  const byPool={},used=new Set();
  for(const m of memRows){const d=m.details||{};(byPool[`${d['F5区域']}|${d['地址池']}`]??=[]).push(m)}
  const member=m=>{const d=m.details||{};return {id:m.id,addr:`${d['成员地址']}:${d['成员端口']}`,state:d['成员状态']||'',monitor:d['健康监测']||''}};
  const cards=vsRows.map(x=>{
    const d=x.details||{},key=`${d['F5区域']}|${d['地址池']}`;
    if(byPool[key])used.add(key);
    const mem=(byPool[key]||[]).map(member);
    // 已停用的 VS 整卡按停用显示，和 F5 上看到的一致
    const health=d['启用状态']==='已停用'?'已停用':(d['健康状态']||'');
    return {id:x.id,region:d['F5区域']||'其他',vs:d['VS名称']||x.name,vip:`${d['VIP地址']||''}${d['服务端口']?':'+d['服务端口']:''}`,
      proto:d['协议']||'',pool:d['地址池']||'',health,enabled:d['启用状态']||'',sys:d['业务系统']||'',
      persist:d['会话保持']||'',mem,orphan:false,
      text:[d['VS名称'],d['VIP地址'],d['服务端口'],d['地址池'],d['业务系统'],...mem.map(v=>v.addr)].join(' ').toLowerCase()};
  });
  // 池里有成员、却没有任何 VS 引用——F5 自己的 Network Map 不画，但清理时正是要找的东西
  for(const [key,list] of Object.entries(byPool)){
    if(used.has(key))continue;
    const [region,pool]=key.split('|'),mem=list.map(member),d=list[0].details||{};
    cards.push({id:list[0].id,region:region||'其他',vs:pool,vip:'',proto:'',pool,
      health:mem.every(v=>v.state==='在线')?'全部在线':mem.some(v=>v.state==='在线')?'部分异常':'全部异常',
      enabled:'',sys:d['业务系统']||'',persist:'',mem,orphan:true,
      text:[pool,d['业务系统'],...mem.map(v=>v.addr)].join(' ').toLowerCase()});
  }
  cards.sort((a,b)=>a.region.localeCompare(b.region,'zh')||a.orphan-b.orphan||a.vs.localeCompare(b.vs,'zh'));
  f5Map=cards;
  const regions=[...new Set(cards.map(c=>c.region))];
  el.innerHTML=`<div class="panel f5-panel"><div class="panel-head"><h3>F5 网络图</h3>
    <span>按 BIG-IP 网络图的看法排列：一张卡片一个虚拟服务，从对外 VIP 一路看到后端节点，状态点取自设备实配（共 ${vsRows.length} 个虚拟服务、${memRows.length} 个后端节点）</span></div>
  <div class="f5-tools"><input id="f5MapQ" placeholder="搜 VS 名、VIP、地址池、后端 IP 或业务系统" oninput="f5MapDraw()">
    <select id="f5MapRegion" onchange="f5MapDraw()"><option value="">全部区域</option>${regions.map(r=>`<option>${esc(r)}</option>`).join('')}</select>
    <select id="f5MapHealth" onchange="f5MapDraw()"><option value="">全部状态</option><option>有异常节点</option><option>全部在线</option><option>全部异常</option><option>已停用</option><option>未挂成员</option><option>无 VS 引用</option></select>
    <span class="f5-legend">${[['up','在线'],['warn','部分异常'],['down','离线'],['off','人工停用'],['unk','未探测']].map(([k,t])=>`<em><i class="f5-dot d-${k}"></i>${t}</em>`).join('')}</span>
    <b id="f5MapCount"></b></div>
  <div class="f5-map" id="f5MapBody"></div></div>`;
  f5MapDraw();
}
function f5MapDraw(){
  if(!f5Map)return;
  const q=($('#f5MapQ')?.value||'').trim().toLowerCase(),region=$('#f5MapRegion')?.value||'',health=$('#f5MapHealth')?.value||'';
  const hit=c=>(!q||c.text.includes(q))&&(!region||c.region===region)&&(!health
    ||(health==='有异常节点'?c.mem.some(m=>m.state==='离线'):health==='无 VS 引用'?c.orphan:c.health===health));
  const list=f5Map.filter(hit),cap=320,shown=list.slice(0,cap);
  const groups=[];for(const c of shown){const g=groups.at(-1);if(g&&g.region===c.region)g.list.push(c);else groups.push({region:c.region,list:[c]})}
  $('#f5MapCount').textContent=list.length===f5Map.length?`${list.length} 个`:`筛出 ${list.length} / ${f5Map.length} 个`;
  $('#f5MapBody').innerHTML=groups.map(g=>`<h4 class="f5-group">${esc(g.region)}<em>${g.list.length} 个</em></h4>
    <div class="f5-cards">${g.list.map(c=>`<article class="f5-card${c.orphan?' orphan':''}" onclick="openResourceRecord(${c.id})">
      <header>${f5Dot(c.health)}<b title="${esc(c.vs)}">${esc(c.vs)}</b>${c.orphan?'<em class="f5-flag">无 VS</em>':c.proto?`<em>${esc(c.proto)}</em>`:''}</header>
      ${c.vip?`<p class="f5-vip">${esc(c.vip)}</p>`:'<p class="f5-vip muted">未挂虚拟服务</p>'}
      ${c.pool?`<p class="f5-pool">${f5Dot(c.health)}<span title="${esc(c.pool)}">${esc(c.pool)}</span></p>`:''}
      <ul class="f5-mem">${c.mem.map(m=>`<li onclick="event.stopPropagation();openResourceRecord(${m.id})" title="${esc(m.state)} · 监测 ${esc(m.monitor||'未配置')}">${f5Dot(m.state)}<span>${esc(m.addr)}</span></li>`).join('')||'<li class="empty">地址池没有成员</li>'}</ul>
      ${c.sys?`<footer>${esc(c.sys)}</footer>`:''}</article>`).join('')}</div>`).join('')
    ||'<p class="f5-none">没有符合条件的虚拟服务。</p>';
  if(list.length>cap)$('#f5MapBody').insertAdjacentHTML('beforeend',`<p class="f5-none">仅显示前 ${cap} 个，请用上面的搜索或筛选缩小范围。</p>`);
}
function wlanSplit(rows){const by=s=>rows.filter(x=>(x.subcategory||'')===s).sort((a,b)=>a.id-b.id);
  return {ac:by('无线控制器'),ssid:by('SSID服务'),ap:by('AP点位清单'),radio:by('射频信道'),floor:by('楼层覆盖')}}
function spWirelessOverview(rows){
  const {ac,ssid,ap,radio,floor}=wlanSplit(rows);
  const apBy=k=>ap.filter(x=>x.status===k).length;
  const live=ssid.filter(x=>x._sp['启用状态']==='已启用');
  const on=radio.filter(x=>x._sp['射频状态']==='已启用');
  const band=b=>on.filter(x=>x._sp['工作频段']===b).length;
  const alarms=floor.reduce((a,x)=>a+(Number(x._sp['同频告警数'])||0),0);
  const dual=ap.filter(x=>x._sp['工作频段']==='2.4G + 5G').length;
  return spStats([
    ['无线控制器',ac.length,ac.length?`${ac[0]._sp['设备型号']||'H3C'} ${ac[0]._sp['备份控制器IP']!=='—'?'主备互备':'单机'}`:'配置未采集'],
    ['AP 点位',ap.length,`覆盖 ${floor.length} 个楼层区域`],
    ['AP 在线',apBy('在线'),`下线 ${apBy('下线')} · 资产未登记 ${apBy('配置在册')}`],
    ['在用射频',on.length,`2.4G ${band('2.4G')} · 5G ${band('5G')} · 双频 AP ${dual}`],
    ['广播 SSID',new Set(live.map(x=>x._sp['SSID'])).size,`共 ${ssid.length} 条服务模板，隐藏 ${live.filter(x=>x._sp['是否隐藏']==='是').length} 条`],
    ['同频干扰点',alarms,alarms?'相邻编号 AP 用了同一信道':'相邻点位信道无冲突']])}
function wlanBar(parts,total){return `<div class="wlan-bar">${parts.filter(p=>p[1]).map(p=>`<i class="${p[0]}" style="width:${p[1]/total*100}%" title="${esc(p[2])} ${p[1]}"></i>`).join('')}</div>`}
function wlanChannels(radios,band,order){
  const use={};for(const x of radios)if(x._sp['工作频段']===band&&x._sp['射频状态']==='已启用'){const c=x._sp['工作信道'];if(c&&c!=='自动')use[c]=(use[c]||0)+1}
  const keys=(order||[]).filter(c=>use[c]).concat(Object.keys(use).filter(c=>!(order||[]).includes(c)).sort((a,b)=>a-b));
  if(!keys.length)return '<p class="wlan-empty">该频段暂无启用射频。</p>';
  const max=Math.max(...keys.map(c=>use[c]));
  return `<div class="wlan-chan">${keys.map(c=>`<div class="wlan-chan-col" title="${esc(c)} 信道 ${use[c]} 个射频"><b>${use[c]}</b><i style="height:${Math.max(8,use[c]/max*100)}%"></i><small>${esc(c)}</small></div>`).join('')}</div>`}
// 楼层键：AC 配置里的「B座 / 3F」和点位图 docx 里的「B 座 3F」空格不一致，去掉空白再比
const floorKey=(b,f)=>`${b||''}|${f||''}`.replace(/\s+/g,'');
// 点位图·楼层底图 → (楼宇,楼层) → 图片路径。无线模块的楼层卡片和楼层覆盖表都靠它嵌缩略图
function apFloorImages(rows){const m=new Map();for(const x of rows)if(x.category==='点位图'&&(x.subcategory||'')==='楼层底图'&&x.details?.['图片文件'])m.set(floorKey(x.details['楼宇'],x.details['楼层']),{src:x.details['图片文件'],id:x.id});return m}
function apThumb(img,name){return img?`<a class="wlan-thumb" href="${esc(img.src)}" target="_blank" onclick="event.stopPropagation()" title="点开看 ${esc(name)} 点位底图大图"><img src="${esc(img.src)}" loading="lazy" alt="${esc(name)} 点位底图"></a>`:'<span class="wlan-thumb none" title="点位图文档里没有这一层的底图">无底图</span>'}
function renderWirelessPanel(rows){
  const el=$('#assetSummary');if(!el)return;
  const {ac,ssid,ap,radio,floor}=wlanSplit(rows);
  const images=apFloorImages(rows);
  const floors=floor.map(x=>{const d=x._sp,total=Number(d['AP数量'])||0,reg=Number(d['资产已登记'])||0,on=Number(d['资产在线'])||0;
    return {id:x.id,name:`${d['楼宇']} ${d['楼层']}`,img:images.get(floorKey(d['楼宇'],d['楼层'])),total,on,off:reg-on,un:total-reg,ssid:Number(d['覆盖SSID数'])||0,warn:Number(d['同频告警数'])||0,conflict:d['相邻同频点位'],dark:Number(d['射频全关AP'])||0}});
  const widest=Math.max(1,...floors.map(f=>f.total));
  const floorHtml=floors.map(f=>`<div class="wlan-floor has-thumb" onclick="openRecord(${f.id})">${apThumb(f.img,f.name)}<b title="${esc(f.name)}">${esc(f.name)}</b>${wlanBar([['on',f.on,'在线'],['off',f.off,'下线'],['un',f.un,'资产未登记']],widest)}<small>${f.total} AP · ${f.ssid} SSID${f.warn?` · <em class="warn">同频 ${f.warn}</em>`:''}</small></div>`).join('')||'<p class="wlan-empty">暂无楼层数据。</p>';
  const withImg=floors.filter(f=>f.img).length;

  const cards=new Map();
  for(const x of ssid){const d=x._sp,key=d['SSID'];if(!key)continue;
    const c=cards.get(key)||{name:key,auth:d['认证方式'],hidden:d['是否隐藏']==='是',enabled:false,aps:0,vlan:new Set(),biz:d['业务名称']||'',fwd:d['转发模式'],rate:d['限速策略']};
    c.aps+=Number(d['覆盖AP数量'])||0;c.enabled=c.enabled||d['启用状态']==='已启用';
    for(const v of String(d['关联VLAN']||'').split(' / '))if(v&&v!=='—')c.vlan.add(v);
    if(!c.biz&&d['业务名称'])c.biz=d['业务名称'];cards.set(key,c)}
  const clip=(v,n)=>{const s=String(v||'');return s.length>n?s.slice(0,n)+'…':s};
  const ssidHtml=[...cards.values()].sort((a,b)=>b.aps-a.aps).map(c=>{const vlan=[...c.vlan],vtxt=vlan.length>3?`${vlan.slice(0,3).join('/')} 等 ${vlan.length} 个`:vlan.join('/')||'—';
    return `<div class="wlan-ssid ${c.enabled?'':'idle'}" title="${esc(`${c.name}｜${c.auth}｜${c.aps} 个 AP｜VLAN ${vlan.join('/')||'—'}｜${c.biz||c.fwd||''}`)}"><h5><b>${esc(c.name)}</b>${c.hidden?'<span class="wlan-chip hide">隐藏</span>':''}${c.enabled?'':'<span class="wlan-chip off">未启用</span>'}</h5><p>${esc(clip(c.auth,18)||'—')}</p><small>${c.aps} 个 AP · VLAN ${esc(vtxt)}</small><small>${esc(clip(c.biz||c.fwd||'',22))}</small></div>`}).join('')||'<p class="wlan-empty">暂无 SSID。</p>';

  const alerts=[];
  const unreg=ap.filter(x=>x.status==='配置在册'),down=ap.filter(x=>x.status==='下线');
  const dark=ap.filter(x=>x._sp['工作频段']==='射频全关'),single=ap.filter(x=>/^(2\.4G|5G)$/.test(x._sp['工作频段']));
  const conflicts=floors.filter(f=>f.warn);
  const idle=ssid.filter(x=>x._sp['启用状态']!=='已启用');
  const push=(level,text,detail)=>alerts.push(`<li class="${level}"><b>${esc(text)}</b><small>${esc(detail)}</small></li>`);
  if(unreg.length)push('warn',`${unreg.length} 个 AP 在配置里存在、资产台账未登记`,unreg.slice(0,6).map(x=>x.name).join(' / ')+(unreg.length>6?' 等':''));
  if(down.length)push('bad',`${down.length} 个 AP 资产状态为下线`,down.slice(0,6).map(x=>x.name).join(' / ')+(down.length>6?' 等':''));
  if(dark.length)push('bad',`${dark.length} 个 AP 射频全部关闭`,dark.map(x=>x.name).join(' / '));
  if(single.length)push('warn',`${single.length} 个 AP 只开了单频段`,single.slice(0,6).map(x=>`${x.name}（${x._sp['工作频段']}）`).join(' / ')+(single.length>6?' 等':''));
  if(conflicts.length)push('warn',`${conflicts.length} 个楼层存在相邻同频点位`,conflicts.slice(0,4).map(f=>f.conflict).join('；'));
  if(idle.length)push('info',`${idle.length} 条 SSID 服务模板未启用`,idle.map(x=>x._sp['SSID']||x.name).join(' / '));
  if(!alerts.length)push('info','配置与台账核对无异常','AP、射频、SSID 均处于正常状态');

  const acHtml=ac.map(x=>{const d=x._sp;return `<div class="wlan-ac"><h5>${esc(d['控制器名称']||x.name)}<span class="wlan-chip ${x.status==='在线'?'on':'off'}">${esc(x.status)}</span></h5><p>${esc(d['管理IP'])} · ${esc(d['设备型号']||'')} · ${esc(d['软件版本']||'')}</p><small>${esc(d['主备关系']||'')}</small><small>纳管 ${esc(d['纳管AP数量'])} 个 AP · 广播 ${esc(d['广播SSID数量'])} 个 SSID · 启用射频 ${esc(d['射频启用数'])}</small><small>${esc(d['已启用能力']||'')}</small></div>`}).join('')||'<p class="wlan-empty">未采集到控制器配置。</p>';

  el.innerHTML=`<div class="panel wlan-panel"><div class="panel-head"><h3>无线网络总览</h3><span>基于两台 AC 的现网配置解析：${ap.length} 个 AP 点位、${radio.length} 条射频、${floor.length} 个楼层区域</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span2"><h4>楼层覆盖分布<em>绿=资产在线 · 灰=下线 · 斜纹=台账未登记 · ${withImg}/${floors.length} 层有点位底图，点缩略图看大图</em></h4><div class="wlan-scroll"><div class="wlan-floors">${floorHtml}</div></div></section>
    <section class="wlan-box"><h4>控制器与主备</h4><div class="wlan-scroll">${acHtml}</div></section>
    <section class="wlan-box"><h4>信道占用<em>按已启用射频</em></h4><h6>2.4G</h6>${wlanChannels(radio,'2.4G',['1','6','11'])}<h6>5G</h6>${wlanChannels(radio,'5G',['36','40','44','48','52','56','60','64','149','153','157','161','165'])}</section>
    <section class="wlan-box span2"><h4>SSID 服务<em>合并两台 AC</em></h4><div class="wlan-scroll"><div class="wlan-ssids">${ssidHtml}</div></div></section>
    <section class="wlan-box span2"><h4>健康提醒<em>配置与资产台账自动比对</em></h4><div class="wlan-scroll"><ul class="wlan-alerts">${alerts.join('')}</ul></div></section>
  </div></div>`;
}
// 机柜上架图：位置取自 资料\02 首页《上架图》方格的合并单元格，型号、管理 IP 按设备名回挂《设备资产统计表》
// 「上架图」页签直接画成机架立面，和原表 sheet 一样：8 个柜横排、U 刻度在柜体两侧、分区标注在最下面
const RACK_H=47,RACK_U=17;
const RACK_KIND={'交换机':'sw','路由器':'rt','防火墙':'fw','负载均衡':'lb','态势感知':'sec','漏扫':'scan','准入控制':'nac','SDWAN':'wan','镜像流量汇聚':'tap','邮件安全':'mail','移动传输':'isp','托盘':'tray'};
// 位置类问题要现场核，型号缺失只是台账不全
const RACK_WARN=['不符','冲突','越界','重复'];
function rackShort(name){return String(name||'').replace(/^B[1-8][_-]\d{1,2}(?:[-_]\d{1,2})?U[_-]?/i,'')||name}
function rackSplit(rows){const g=k=>rows.filter(x=>(x.subcategory||'')===k);return{cabs:g('机柜总览'),units:g('上架设备'),checks:g('数据校核')}}
function rackNo(cab){return parseInt(String(cab).replace(/\D/g,''))||0}
function spRackOverview(rows){
  const {cabs,units,checks}=rackSplit(rows);
  const used=cabs.reduce((a,x)=>a+(+x.details['已占用U数']||0),0);
  const total=cabs.length*RACK_H;
  const kinds=new Set(units.map(x=>x.details['设备类型']).filter(Boolean));
  const best=cabs.slice().sort((a,b)=>(parseInt(b.details['最大连续空闲'])||0)-(parseInt(a.details['最大连续空闲'])||0))[0];
  const full=cabs.slice().sort((a,b)=>(+b.details['已占用U数']||0)-(+a.details['已占用U数']||0))[0];
  return spStats([
    ['机柜数量',cabs.length,'燕郊光子机房核心区'],
    ['上架设备',units.length,`${kinds.size} 类设备`],
    ['U 位占用',`${used}/${total}`,`整体使用率 ${total?Math.round(used/total*100):0}%`],
    ['最满机柜',full?full.name:'-',full?`已用 ${full.details['已占用U数']}U · ${full.details['功能分区']}`:''],
    ['最大连续空闲',best?best.details['最大连续空闲']:'-',best?`在 ${best.name}，可放整机架设备`:''],
    ['待核对项',checks.length,checks.length?'命名、位置或资产台账存在出入':'图与资产表完全一致']]);
}
function renderRackPanel(rows){
  const el=$('#assetSummary');el.classList.remove('hidden');
  const {cabs,units,checks}=rackSplit(rows);
  const byCab={};for(const u of units)(byCab[u.details['机柜编号']]??=[]).push(u);
  const order=cabs.map(c=>c.name).sort((a,b)=>rackNo(a)-rackNo(b));
  // U 刻度：47 在最上、1 在最下，和原表一样柜体左右各一列
  const scale=Array.from({length:RACK_H},(_,i)=>{const u=RACK_H-i;return `<div class="rk-tick${u%5===0?' mark':''}" style="height:${RACK_U}px">${u}</div>`}).join('');
  const slots=Array.from({length:RACK_H},(_,i)=>`<div class="rk-slot${(RACK_H-i)%5===0?' mark':''}" style="height:${RACK_U}px"></div>`).join('');
  const racks=order.map(cab=>{
    const info=cabs.find(c=>c.name===cab)?.details||{};
    const list=(byCab[cab]||[]).slice().sort((a,b)=>parseInt(b.details['起始U位'])-parseInt(a.details['起始U位']));
    const blocks=list.map(d=>{
      const s=parseInt(d.details['起始U位'])||1,e=parseInt(d.details['结束U位'])||s,n=e-s+1;
      const kind=RACK_KIND[d.details['设备类型']]||'other';
      const model=d.details['设备型号']||'',mip=d.details['管理IP']||'',st=d.details['资产状态']||'';
      const tip=[d.details['设备名称'],`${d.details['设备类型']} · ${model||'型号未登记'}`,`${d.details['U位区间']}（${n}U）`,
        d.details['业务角色']&&d.details['业务角色']!=='未识别'?d.details['业务角色']:'',mip?`管理 IP ${mip}`:'',st?`资产状态 ${st}`:''].filter(Boolean).join('\n');
      // 1U 只有 15px 高，塞两行会被裁掉，所以第二行只在 2U 以上才显示
      const label=esc(rackShort(d.details['设备名称']));
      const second=n>=2?`<i>${esc(d.details['U位区间'])} · ${esc(model||d.details['设备类型'])}</i>`:'';
      return `<div class="rk-dev k-${kind}${n===1?' one':''}" style="bottom:${(s-1)*RACK_U}px;height:${n*RACK_U-2}px" title="${esc(tip)}" onclick="askOpen('record',${d.id})"><b>${label}</b>${second}</div>`}).join('');
    const usage=+info['已占用U数']||0;
    return `<div class="rk-col"><div class="rk-cap">${esc(info['原表柜号']||cab)}</div>
      <div class="rk-grid" style="height:${RACK_H*RACK_U}px"><div class="rk-scale">${scale}</div>
      <div class="rk-slots">${slots}${blocks}</div><div class="rk-scale">${scale}</div></div>
      <div class="rk-zone">${esc(info['功能分区']||'')}</div>
      <div class="rk-foot">${list.length} 台 · 占 ${usage}/${RACK_H}U · 搭档 ${esc(info['冗余搭档']||'-')}</div></div>`;
  }).join('');
  const present=new Set(units.map(u=>u.details['设备类型']));
  const legend=Object.entries(RACK_KIND).filter(([k])=>present.has(k)).map(([k,v])=>`<span class="rk-legend"><i class="k-${v}"></i>${esc(k)}</span>`).join('')
    +([...present].some(k=>!RACK_KIND[k])?'<span class="rk-legend"><i class="k-other"></i>其他</span>':'');
  const isWarn=c=>RACK_WARN.some(w=>String(c.details['问题类型']).includes(w));
  const alerts=checks.length?checks.slice().sort((a,b)=>isWarn(b)-isWarn(a)).map(c=>`<li class="rk-alert ${isWarn(c)?'warn':'info'}" onclick="askOpen('record',${c.id})"><b>${esc(c.details['问题类型'])} · ${esc(c.details['机柜编号'])}</b><small>${esc(c.details['问题说明'])}</small></li>`).join(''):'<li class="rk-alert ok"><b>无待核对项</b><small>上架图与资产表完全一致</small></li>';
  const matched=units.filter(u=>u.details['型号来源']==='资产表匹配').length;
  el.innerHTML=`<div class="panel rk-panel"><div class="panel-head"><h3>核心设备上架图</h3><span>燕郊光子机房 ${cabs.length} 个机柜 · ${units.length} 台设备，柜位与 U 位按《上架图》首页的方格逐格重绘；${matched} 台已按设备名回挂《设备资产统计表》取型号和管理 IP，其余按设备名推断（${checks.filter(isWarn).length} 处命名或位置待现场核对）</span></div>
  <div class="rk-legends">${legend}</div>
  <div class="rk-floor"><div class="rk-sheet">${racks}</div></div>
  <div class="rk-checks"><h4>上架数据校核<em>点条目查看详情，建议现场核对后回填上架图与资产表</em></h4><ul>${alerts}</ul></div></div>`;
}
// 工单统计：数据来自飞书多维表格导出的《网络安全组工单.base》。
// 明细一律照抄原表不做修正，时间对不上的（年份录错、解决早于发生等）单独进「数据校核」页签。
const TK_LEVELS=['一级','二级','三级','四级'];
const TK_KINDS=['网管报警','用户报障','主动运维'];
const TK_KIND_CLS={'网管报警':'alarm','用户报障':'report','主动运维':'routine'};
// 通用 spTag 不认识工单的词，会把「已完成」和最低的「四级」一律标成待办色，这里按语义自己配色
function tkStateTag(v){const s=String(v||'');if(!s)return '-';
  return `<span class="tag ${s==='已完成'?'on':s==='处理中'?'reserve':'off'}">${esc(s)}</span>`}
function tkLevelTag(v){const s=String(v||'');if(!s)return '-';
  return `<span class="tag ${s==='一级'||s==='二级'?'off':s==='三级'?'reserve':'on'}">${esc(s)}</span>`}
function tkSplit(rows){const pick=s=>rows.filter(x=>(x.subcategory||x.sheet||'')===s);
  return {tickets:pick('工单明细'),checks:pick('数据校核'),guides:pick('填报说明')}}
function tkDate(v){const s=String(v||'').trim();if(!s)return null;const d=new Date(s.replace(' ','T'));return isNaN(d)?null:d}
function tkMins(x){const v=x._sp?.['处理时长分钟'];return v===''||v==null?null:Number(v)}
function tkSpan(mins){if(mins==null)return '-';if(mins<60)return `${Math.round(mins)} 分钟`;
  if(mins<1440)return `${Math.floor(mins/60)} 小时`;return `${Math.floor(mins/1440)} 天`}
function tkMedian(list){if(!list.length)return null;const a=list.slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)]}
function tkPct(n,total){return total?Math.round(n/total*100):0}
function tkCount(rows,key,value){return rows.filter(x=>x._sp?.[key]===value).length}
function spTicketOverview(rows){
  const {tickets,checks}=tkSplit(rows);
  const done=tkCount(tickets,'工单状态','已完成'),open=tkCount(tickets,'工单状态','处理中');
  const durations=tickets.map(tkMins).filter(v=>v!=null&&v>=0);
  const slow=durations.filter(v=>v>1440).length;
  const sorted=durations.slice().sort((a,b)=>a-b);
  const p90=sorted.length?sorted[Math.floor(sorted.length*0.9)]:null;
  // 累计区间用工单编号里的登记日，不用发生时间——后者有年份录错的记录，会把区间拉到一年前
  const months=tickets.map(x=>String(x._sp['编号登记日']||'').slice(0,7)).filter(Boolean).sort();
  const routine=tkCount(tickets,'事件分类','主动运维');
  const fault=tkCount(tickets,'事件分类','用户报障'),alarm=tkCount(tickets,'事件分类','网管报警');
  const urgent=tickets.filter(x=>['一级','二级'].includes(x._sp['突发事件等级'])).length;
  return spStats([
    ['工单总量',tickets.length,months.length?`${months[0]} ~ ${months[months.length-1]} 登记`:'按工单编号统计'],
    ['未闭环',open,`已完成 ${done} · 闭环率 ${tkPct(done,tickets.length)}%`],
    ['主动运维',routine,`占全部工单 ${tkPct(routine,tickets.length)}%`],
    ['报障与告警',fault+alarm,`用户报障 ${fault} · 网管报警 ${alarm}`],
    ['处理时长中位',tkSpan(tkMedian(durations)),`P90 ${tkSpan(p90)} · 超 24 小时 ${slow} 件`],
    ['一二级事件',urgent,checks.length?`另有 ${checks.length} 项录入待核对`:'录入数据无异常']]);
}
function tkBar(parts,total){return `<div class="tk-bar">${parts.filter(p=>p[1]).map(p=>`<i class="${p[0]}" style="width:${p[1]/total*100}%" title="${esc(p[2])} ${p[1]}"></i>`).join('')}</div>`}
function tkGroup(tickets,key,order){
  const use=new Map();for(const x of tickets){const v=x._sp[key]||'未填';use.set(v,(use.get(v)||0)+1)}
  const keys=(order||[]).filter(k=>use.has(k)).concat([...use.keys()].filter(k=>!(order||[]).includes(k)));
  const max=Math.max(1,...keys.map(k=>use.get(k)));
  return keys.map(k=>`<div class="tk-rank"><b title="${esc(k)}">${esc(k)}</b><div class="tk-track"><i style="width:${use.get(k)/max*100}%"></i></div><small>${use.get(k)} · ${tkPct(use.get(k),tickets.length)}%</small></div>`).join('')
    ||'<p class="tk-empty">暂无数据。</p>';
}
// 月度趋势按发生时间统计，画最近 12 个**连续**自然月。
// 必须连续：年份录错的那批（编号是 2026-01、发生时间写成 2025-01）如果和正常月份并排画，
// 中间十个月的空档就看不出来了，趋势会被读错。落在窗口外的条数在标题里点出来。
function tkTrend(tickets){
  const months=new Map();
  for(const x of tickets){const m=String(x._sp['发生时间']||'').slice(0,7);if(!m)continue;
    const bucket=months.get(m)||{total:0,alarm:0,report:0,routine:0};bucket.total++;
    const cls=TK_KIND_CLS[x._sp['事件分类']];if(cls)bucket[cls]++;months.set(m,bucket)}
  const keys=[...months.keys()].sort();
  if(!keys.length)return {html:'<p class="tk-empty">暂无发生时间。</p>',hidden:0,span:''};
  const [ly,lm]=keys[keys.length-1].split('-').map(Number);
  const window=[];
  for(let i=11;i>=0;i--){const d=new Date(ly,lm-1-i,1);window.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
  const dated=tickets.filter(x=>String(x._sp['发生时间']||'')).length;
  const shown=window.reduce((a,k)=>a+(months.get(k)?.total||0),0);
  const max=Math.max(1,...window.map(k=>months.get(k)?.total||0));
  const html=`<div class="tk-trend">${window.map(k=>{const b=months.get(k)||{total:0,alarm:0,report:0,routine:0};
    const seg=(cls,n)=>n?`<i class="${cls}" style="height:${n/max*100}%"></i>`:'';
    return `<div class="tk-col${b.total?'':' idle'}" title="${k}：${b.total} 件（网管报警 ${b.alarm} · 用户报障 ${b.report} · 主动运维 ${b.routine}）"><b>${b.total||''}</b><div class="tk-stack">${seg('alarm',b.alarm)}${seg('report',b.report)}${seg('routine',b.routine)}</div><small>${k.slice(2)}</small></div>`}).join('')}</div>`;
  return {html,hidden:dated-shown,span:`${window[0]} ~ ${window[window.length-1]}`};
}
function tkWorkload(tickets){
  const use=new Map();
  for(const x of tickets){const who=x._sp['处理工程师']||'未指派';const v=use.get(who)||{n:0,open:0,mins:[]};
    v.n++;if(x._sp['工单状态']==='处理中')v.open++;const m=tkMins(x);if(m!=null&&m>=0)v.mins.push(m);use.set(who,v)}
  const list=[...use.entries()].sort((a,b)=>b[1].n-a[1].n).slice(0,8);
  const max=Math.max(1,...list.map(([,v])=>v.n));
  return list.map(([who,v])=>`<div class="tk-rank"><b title="${esc(who)}">${esc(who)}</b><div class="tk-track"><i style="width:${v.n/max*100}%"></i></div><small>${v.n} 件${v.open?` · 未闭环 ${v.open}`:''} · 中位 ${tkSpan(tkMedian(v.mins))}</small></div>`).join('')
    ||'<p class="tk-empty">暂无处理人信息。</p>';
}
function tkDurations(tickets){
  const buckets=[['30 分钟内',v=>v<=30],['30 分钟 ~ 2 小时',v=>v>30&&v<=120],['2 ~ 24 小时',v=>v>120&&v<=1440],['超过 24 小时',v=>v>1440]];
  const durations=tickets.map(tkMins).filter(v=>v!=null&&v>=0);
  const max=Math.max(1,...buckets.map(([,f])=>durations.filter(f).length));
  return buckets.map(([label,f])=>{const n=durations.filter(f).length;
    return `<div class="tk-rank"><b>${label}</b><div class="tk-track"><i style="width:${n/max*100}%"></i></div><small>${n} · ${tkPct(n,durations.length)}%</small></div>`}).join('');
}
function tkOpenList(tickets){
  const open=tickets.filter(x=>x._sp['工单状态']==='处理中');
  if(!open.length)return '<li class="tk-item ok"><b>全部工单已闭环</b><small>没有处理中的工单</small></li>';
  const rank=x=>TK_LEVELS.indexOf(x._sp['突发事件等级']);
  const now=Date.now();
  return open.slice().sort((a,b)=>rank(a)-rank(b)||(tkDate(b._sp['发生时间'])||0)-(tkDate(a._sp['发生时间'])||0)).map(x=>{
    const d=x._sp,when=tkDate(d['发生时间']);
    const age=when?tkSpan((now-when.getTime())/60000):'-';
    const level=d['突发事件等级']||'未定级';
    const cls=level==='一级'?'bad':level==='二级'?'warn':'info';
    return `<li class="tk-item ${cls}" onclick="askOpen('record',${x.id})"><b><span class="tk-chip ${cls}">${esc(level)}</span>${esc(d['工单编号'])} · ${esc(d['事件分类'])}</b><small>${esc(d['工单描述']||'（无描述）')}</small><em>发生于 ${esc(d['发生时间']||'未填')} · 已挂起 ${age} · ${esc(d['处理工程师']||'未指派')}</em></li>`}).join('');
}
function tkCheckList(checks){
  if(!checks.length)return '<li class="tk-item ok"><b>无待核对项</b><small>时间字段与工单编号完全对得上</small></li>';
  const groups=new Map();
  for(const c of checks){const k=c._sp['问题类型']||'其他';(groups.get(k)||groups.set(k,[]).get(k)).push(c)}
  return [...groups.entries()].sort((a,b)=>b[1].length-a[1].length).map(([kind,list])=>{
    const first=list[0];
    return `<li class="tk-item warn" onclick="askOpen('record',${first.id})"><b>${esc(kind)} <span class="tk-chip warn">${list.length} 条</span></b><small>${esc(first._sp['问题说明'])}</small><em>${esc(first._sp['处理建议'])}，点开看第一条，完整清单在「数据校核」页签</em></li>`}).join('');
}
function renderTicketPanel(rows){
  const el=$('#assetSummary');if(!el)return;
  const {tickets,checks,guides}=tkSplit(rows);
  const trend=tkTrend(tickets);
  const biz=tkGroup(tickets,'业态名称',['集团','酒管','投资','宝贝王']);
  const open=tickets.filter(x=>x._sp['工单状态']==='处理中').length;
  const guideHtml=guides.map(g=>`<li>${esc(g._sp['填写说明'])}</li>`).join('')||'<li>暂无填报说明。</li>';
  el.innerHTML=`<div class="panel tk-panel"><div class="panel-head"><h3>网络安全组工单统计</h3><span>共 ${tickets.length.toLocaleString()} 条工单，来自《网络安全组工单.base》的工单记录数据、前端数据表与手工录入三张表按工单编号去重合并；明细照抄原表不做修正，${checks.length} 项时间录入问题列在「数据校核」页签</span></div>
  <div class="tk-grid">
    <section class="tk-box span2"><h4>月度工单量<em>按发生时间 · ${esc(trend.span)}${trend.hidden?` · 另有 ${trend.hidden} 条发生时间落在区间外，见数据校核`:''}</em></h4>
      <div class="tk-legends"><span class="tk-legend"><i class="alarm"></i>网管报警</span><span class="tk-legend"><i class="report"></i>用户报障</span><span class="tk-legend"><i class="routine"></i>主动运维</span></div>${trend.html}</section>
    <section class="tk-box"><h4>事件分类<em>按工单量</em></h4><div class="tk-scroll">${tkGroup(tickets,'事件分类',TK_KINDS)}</div></section>
    <section class="tk-box"><h4>突发事件等级<em>一级最紧急</em></h4><div class="tk-scroll">${tkGroup(tickets,'突发事件等级',TK_LEVELS)}</div></section>
    <section class="tk-box span2"><h4>未闭环工单<em>${open} 件处理中，按等级和发生时间排</em></h4><div class="tk-scroll"><ul class="tk-items">${tkOpenList(tickets)}</ul></div></section>
    <section class="tk-box"><h4>处理工程师<em>工单量前 8 名</em></h4><div class="tk-scroll">${tkWorkload(tickets)}</div></section>
    <section class="tk-box"><h4>处理时长分布<em>发生到解决</em></h4><div class="tk-scroll">${tkDurations(tickets)}</div></section>
    <section class="tk-box span2"><h4>数据校核<em>原始数据不改动，仅列出对不上的地方</em></h4><div class="tk-scroll"><ul class="tk-items">${tkCheckList(checks)}</ul></div></section>
    <section class="tk-box"><h4>业态分布<em>按工单量</em></h4><div class="tk-scroll">${biz}</div></section>
    <section class="tk-box"><h4>填报口径<em>班组自定的记录规范</em></h4><div class="tk-scroll"><ul class="tk-guides">${guideHtml}</ul></div></section>
  </div></div>`;
}
// 配置备份：一台设备一条，解析要点（角色、VLAN 接口、端口、告警）由 parse_net_configs.py 写在 details 里；「数据校核」是配置和各地IP表/资产表交叉核对的结果
function spCfgPrepare(rows){for(const x of rows){const d=x.details||{};if((x.subcategory||'')==='数据校核'){x._sp=d;continue}x._sp={name:x.name||d['配置设备名']||'',ip:x.ip||d['管理IP']||'',vendor:d['厂商']||'',role:d['设备角色']||'',floor:d['楼层']&&d['楼层']!=='—'?d['楼层']:'',type:d['资产类型']||'',model:d['资产型号']||'',ver:d['配置软件版本']||'',platform:d['软件平台']||'',astat:d['资产状态']||'',check:d['台账核对']||'',vifs:d['VLAN接口数']??'',ports:d['物理端口数']?`${d['未关闭端口']}/${d['物理端口数']}`:'',irf:d['IRF成员数']||'',alerts:d['抓取期间告警']&&d['抓取期间告警']!=='无'?d['抓取期间告警']:'',time:d['备份时间']||'',match:d['资产匹配']||'',lines:String(d['配置内容']||'').split('\n').length}}}
function spCfgOverview(rows){const dev=rows.filter(x=>(x.subcategory||'')!=='数据校核'),checks=rows.length-dev.length;const f=dev.map(x=>x._sp);const roles={};for(const v of f)roles[v.role||'其他']=(roles[v.role||'其他']||0)+1;const vers=new Set(f.map(v=>v.ver).filter(Boolean)).size;const matched=f.filter(v=>v.match==='已匹配').length;const bad=f.filter(v=>v.check&&!/^一致/.test(v.check)).length;const alerts=f.filter(v=>v.alerts).length;const latest=f.map(v=>v.time).filter(Boolean).sort().pop()||'-';const roleText=Object.entries(roles).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${n}`).join(' · ');return spStats([['配置备份',dev.length,roleText||'台设备配置全文可查'],['软件版本',vers,'个不同版本，含 Comware 3/5/7 与 TMOS'],['资产已匹配',matched,`未匹配 ${dev.length-matched} 台 · 台账不一致 ${bad} 台`],['抓取期间告警',alerts,alerts?'终端滚出风扇/电源等故障日志':'无设备告警'],['交叉核对待办',checks,checks?'配置 vs 各地IP表 / 资产表':'配置与台账一致'],['最近备份',latest.split(' ')[0]||'-','资料\\conf 抓取时间']])}
function spCircuitPrepare(rows){spDynCols={};const cv=v=>{v=String(v??'').trim();return /^[\\\/]+$/.test(v)?'':v};const groups={};for(const x of rows)(groups[x.subcategory||'']??=[]).push(x);for(const [s,list] of Object.entries(groups)){list.sort((a,b)=>a.id-b.id);if(s==='首页'||s==='特殊线路首页'){const keys=[];for(const x of list)for(const k of Object.keys(x.details||{}))if(!keys.includes(k))keys.push(k);keys.sort((a,b)=>Number(a.match(/^字段(\d+)$/)?.[1]??0)-Number(b.match(/^字段(\d+)$/)?.[1]??0));const header=list.find(x=>Object.values(x.details||{}).some(v=>String(v).trim()==='业态'));spDynCols[s]=keys.map((k,i)=>({k:'c'+i,label:cv(header?.details?.[k])||k,f:i===1?'s':null}));for(const x of list){const filled=Object.values(x.details||{}).filter(v=>String(v??'').trim()).length;x._sp=(x===header||filled<2)?null:Object.fromEntries(keys.map((k,i)=>['c'+i,cv(x.details?.[k])]))}continue}let last=null;for(const x of list){const d=x.details||{},pd=n=>cv(pickDetail(d,[n]));if(s==='SDWAN信息统计表'){x._sp={no:pd('序号'),biz:pd('业态'),site:pd('局点名称'),line:pd('是否有专线'),bw:pd('SDWAN隧道带宽'),time:pd('实施完成时间'),rent:pd('月租金'),hub:pd('主接入点'),move:pd('是否迁移至同程')};continue}const carriers=[],linenos=[],bws=[];for(const c of ['移动','联通','电信']){const v=pd(c);if(v)carriers.push(v);const ln=pd(c+'专线号');if(ln)linenos.push(`${c}：${ln}`);const bw=pd(c+'带宽');if(bw)bws.push(`${c} ${bw}M`)}const v={no:pd('序号'),biz:pd('业态'),site:pd('局点名称'),dev:pd('接入设备名称')||pd('路由器名称'),port:pd('端口号'),carrier:[...new Set(carriers)].join(' / '),lineno:linenos.join('；'),bw:bws.join(' / '),rent:pd('月租金'),sdwan:pd('是否配置SDWAN')||pd('是否实施SDWAN'),note:pd('备注')};if(last)for(const k of ['biz','site','dev'])if(!v[k])v[k]=last[k];x._sp=v;last=v}}}
function spCircuitOverview(rows){const g=s=>rows.filter(x=>(x.subcategory||'')===s&&x._sp);const dl=g('专线信息统计表'),sd=g('SDWAN信息统计表'),spc=g('特殊线路统计表');const rent=[...dl,...sd,...spc].reduce((a,x)=>a+(parseFloat(String(x._sp.rent).replace(/,/g,''))||0),0);const biz=new Set([...dl,...sd,...spc].map(x=>x._sp.biz).filter(Boolean)).size;return spStats([['专线接入',dl.length,'专线信息统计表'],['SDWAN 节点',sd.length,'SDWAN信息统计表'],['特殊线路',spc.length,'云专线 / POP点 / 楼间'],['月租金合计',rent?Math.round(rent).toLocaleString()+' 元':'-','三张明细表求和'],['覆盖业态',biz,'宝贝王 / 投资 / 普惠等'],['汇总表',(g('首页').length+g('特殊线路首页').length),'分支与特殊线路汇总']])}
function spIpPrepare(rows){const list=rows.slice().sort((a,b)=>a.id-b.id);let zone='',seg='',prev='';for(const x of list){const d=x.details||{},s=x.subcategory||'',pd=n=>pickDetail(d,[n]);if(s!==prev){zone='';seg='';prev=s}if(s==='各地IP表')x._sp={no:pd('d')||pd('序号'),city:pd('城市'),pos:pd('位置'),floor:pd('楼层'),type:pd('网络类型'),biz:pd('业务名称'),ssid:pd('SSID'),cidr:pd('网段'),gw:pd('网关IP'),dev:pd('管理设备名称'),mip:pd('管理地址'),use:pd('用途说明')};else if(s==='IP分配明细'){const z=pd('网络分区');if(z)zone=z;const g=pd('IP地址段');if(g)seg=g;x._sp={zone,mod:pd('子模块'),cnt:pd('IP子网数量'),subnet:pd('IP子网'),note:pd('备注')}}else if(s==='各地未分配IP段')x._sp={no:pd('序号'),city:pd('城市'),pos:pd('位置'),type:pd('类型'),floor:pd('楼层'),cidr:pd('可用网段')};else if(s==='北京各楼层dhcp保留IP')x._sp={no:pd('序号'),city:pd('城市'),pos:pd('位置'),type:pd('类型'),floor:pd('楼层'),cidr:pd('保留IP')};else if(s==='各地公网IP表')x._sp={no:pd('序号'),city:pd('城市'),pos:pd('位置'),type:pd('网络类型'),biz:pd('业务名称'),cidr:pd('网段'),note:pd('备注')};else if(s.startsWith('互联网IP · '))x._sp={publicIp:pd('公网地址')||pd('新分配公网IP')||pd('当前使用')||x.ip,network:pd('公网网段'),carrier:pd('运营商'),biz:pd('应用备注')||pd('应用')||pd('用途')||pd('业务名称')||x.name,domain:pd('应用域名'),nat:pd('NAT方向'),real:pd('实IP'),keep:pd('是否保留'),pm:pd('项目经理'),status:x.status,note:pd('备注')||pd('可用公网地址')||pd('可用')};else x._sp=null}}
// 概览卡按地址表（subnetLists，三个空间的网段与地址）给数，与规划总览 / 办公网规划图同一口径；
// 地址表还没导入（老库首次启动前）时退回三份 Excel 底稿的行数
function spIpOverview(rows){
  const g=s=>rows.filter(x=>(x.subcategory||'')===s).length,pub=rows.filter(x=>(x.subcategory||'').startsWith('互联网IP · ')),pubUsed=new Set(pub.flatMap(x=>String(x.ip||'').split(',')).filter(Boolean)).size;
  const lists=typeof subnetLists==='object'&&subnetLists?subnetLists:{},off=lists.office||[],pools=lists.public||[];
  const idcCard=['IDC 机房',subnetCounts.idc||(subnetKind==='idc'&&subnets.length)||g('IP分配明细'),'IDC 网段 · 可下钻方格图'];
  if(!off.length)return spStats([idcCard,['各地在用网段',g('各地IP表'),'万达IP地址规划表 · 办公 / 无线 / 管理'],['各地未分配',g('各地未分配IP段'),'可直接规划使用'],['DHCP 保留段',g('北京各楼层dhcp保留IP'),'北京各楼层'],['互联网公网',pub.length,`互联网IP地址分配表 · 已分配地址 ${pubUsed} 个`],['各地公网出口',g('各地公网IP表'),'联通 / 移动 / 电信']]);
  const st=ofSiteStats(off),cities=new Set(off.map(s=>s.zone).filter(Boolean)).size;
  const poolTot=pools.reduce((a,p)=>a+p.total,0),poolUsed=pools.reduce((a,p)=>a+p.used,0),poolDet=pools.reduce((a,p)=>a+(p.detected||0),0);
  return spStats([idcCard,
    ['各地在用网段',st.used.length,`${cities} 个城市 · 有线 ${st.wired} · 无线 ${st.wifi} · ${ipNum(st.assigned+st.det)} 地址在用`],
    ['各地预留网段',st.res.length,`${ipNum(st.resAddr)} 个地址可划给新楼层 / 新业务`],
    ['DHCP 保留地址',st.dhcp,'在用段里留给终端 DHCP 的地址'],
    ['互联网公网',pools.length,pools.length?`公网地址池 · 登记 ${ipNum(poolUsed)} · 检出 ${ipNum(poolDet)} · 共 ${ipNum(poolTot)} 地址`:`互联网IP地址分配表 · 已分配地址 ${pubUsed} 个`],
    ['各地公网出口',g('各地公网IP表'),'联通 / 移动 / 电信']])}
const F5_LIVE_COLUMNS={
'F5设备状态':[{k:'设备名称',label:'设备名称',f:'t'},{k:'F5区域',label:'区域',f:'s'},{k:'集群角色',label:'主备角色',f:'s',r:spTag},{k:'软件版本',label:'软件版本',f:'s'},{k:'硬件平台',label:'硬件平台',f:'s'},{k:'承载虚拟服务',label:'虚拟服务'},{k:'承载地址池',label:'地址池'},{k:'资产状态',label:'资产状态',f:'s',r:spTag},{k:'维保类型',label:'维保',f:'s'}],
'F5虚拟服务':[{k:'VS名称',label:'服务名称',f:'t'},{k:'业务系统',label:'业务系统',f:'t'},{k:'F5区域',label:'区域',f:'s'},{k:'VIP地址',label:'对外地址',f:'t'},{k:'服务端口',label:'端口',f:'t'},{k:'协议',label:'协议',f:'s'},{k:'后端成员数',label:'后端节点'},{k:'在线成员',label:'在线',r:v=>spCount(v,'ok')},{k:'异常成员',label:'异常',r:v=>spCount(v,'bad')},{k:'健康状态',label:'健康状态',f:'s',r:spTag},{k:'会话保持',label:'会话保持',f:'s'},{k:'启用状态',label:'启用',f:'s',r:spTag}],
'F5地址池成员':[{k:'地址池',label:'地址池',f:'t'},{k:'业务系统',label:'业务系统',f:'t'},{k:'F5区域',label:'区域',f:'s'},{k:'成员地址',label:'节点地址',f:'t'},{k:'成员端口',label:'端口',f:'t'},{k:'成员状态',label:'节点状态',f:'s',r:spTag},{k:'会话状态',label:'调度状态',f:'s',r:spTag},{k:'健康监测',label:'健康监测',f:'s'},{k:'对外VIP',label:'对外地址',f:'t'},{k:'关联VS',label:'所属服务',f:'t'}]};
function weeklyAssetUrl(src){let raw=String(src||'').trim().replace(/\\/g,'');try{raw=decodeURIComponent(raw)}catch{}if(/^https?:/i.test(raw))return raw;raw=raw.replace(/^\.\//,'');if(raw&&!raw.includes('/')&&!raw.startsWith('Images_attachments'))raw='Images_attachments/'+raw;return '/source-assets/weekly/'+raw.split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function weeklyFileName(path){const name=String(path||'').replace(/\\/g,'/').split('/').pop()||path;try{return decodeURIComponent(name)}catch{return name}}
function weeklyPlain(text){return String(text||'').replace(/\\(.)/g,'$1').replace(/#{1,6}\s*/g,'').replace(/!\[.*?\]\(.*?\)/g,'').replace(/\[(.*?)\]\(.*?\)/g,'$1').replace(/\*\*|\~\~/g,'').replace(/<br\s*\/?>/gi,' ').replace(/\s+/g,' ').trim()}
function weeklyInline(text){const slots=[];const keep=html=>{slots.push(html);return `\u0000${slots.length-1}\u0000`};let s=String(text||'').replace(/\\(.)/g,'$1').replace(/#{1,6}\s*/g,'');s=s.replace(/!\[(.*?)\]\((.*?)\)/g,(_,alt,src)=>keep(`<img class="weekly-img" src="${weeklyAssetUrl(src)}" alt="${esc(alt)}" loading="lazy">`));s=s.replace(/\[(.*?)\]\((.*?)\)/g,(_,t,href)=>{const url=/^https?:/i.test(href)?href:weeklyAssetUrl(href);return keep(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(t.replace(/\\/g,''))}</a>`)});s=esc(s).replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/&lt;br\s*\/?&gt;/gi,'<br>');return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>slots[Number(i)])}
function weeklyCellHtml(text){const raw=String(text||'').replace(/\\(.)/g,'$1').trim();if(!raw||raw==='-')return '';const parts=raw.split(/<br\s*\/?>/i).map(s=>s.trim()).filter(s=>s&&s!=='-');if(parts.length>1&&parts.filter(s=>/^[-*]\s+/.test(s)).length>=Math.ceil(parts.length/2))return `<ul>${parts.map(s=>`<li>${weeklyInline(s.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;return weeklyInline(raw)}
function weeklySplitRow(line){let s=line.trim();if(s.startsWith('|'))s=s.slice(1);if(s.endsWith('|'))s=s.slice(0,-1);return s.split('|').map(c=>c.trim())}
function weeklyIsSep(line){return /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line)}
function weeklyIsRow(line){return /^\s*\|/.test(line)&&line.includes('|')}
function weeklyFilled(row){return row.filter(c=>c&&c!=='-').length}
function weeklyLooksHeader(row){if(weeklyLooksEvent(row))return false;const cells=row.map(weeklyPlain);const text=cells.join(' ');if(weeklyFilled(row)<2)return false;if(/^\d+%/.test(cells[1]||''))return false;if(cells.some(c=>c.length>40)&&cells.filter(c=>c&&c.length<=12).length<3)return false;return /项目(内容|名称)|开始时间|计划完成时间|责任人|组别|处理进度/.test(text)||(cells.some(c=>c==='时间')&&cells.some(c=>c==='内容'||c.includes('内容')))||(/进展/.test(text)&&/责任人|项目/.test(text))}
function weeklyLooksEvent(row){return /20\d{2}|^\d{1,2}月|^\d{1,2}\/\d{1,2}/.test(weeklyPlain(row[0]||''))}
function weeklyCaptionHtml(text){return weeklyInline(String(text||'').replace(/<br\s*\/?>/gi,'').trim())}
function weeklyTableKind(caption,head,body,width){const headText=weeklyPlain((head||[]).join(' '));const cap=weeklyPlain(caption);const hasImg=body.some(r=>r.some(c=>/!\[/.test(c)));const eventish=body.filter(weeklyLooksEvent).length>=Math.max(1,Math.ceil(body.length/2));if(width<=2&&hasImg)return 'circuit';if(/组别/.test(headText)&&/事件|变更|演练|服务单/.test(headText))return 'summary';if(/项目(内容|名称)/.test(headText)||(/进展/.test(headText)&&/责任人/.test(headText))||(/\d+%/.test(weeklyPlain(body[0]?.[1]||''))&&width>=5&&!eventish))return 'project';if((/(^| )时间( |$)/.test(` ${headText} `)&&/内容|等级|处理进度/.test(headText)&&!/项目/.test(headText))||/重点事件/.test(cap)||eventish)return 'event';if(hasImg&&width>=4)return 'project';return 'table'}
function weeklyEventRow(row){const cells=row.map(c=>c&&c!=='-'?c:'');const level=cells.findIndex(c=>/^(一级|二级|三级|一般|紧急)$/.test(weeklyPlain(c)));if(level>=0){const content=cells.slice(1,level).filter(Boolean).join(' ')||cells[1]||'';return [cells[0]||'',content,cells[level],cells[level+1]||'',cells[level+2]||'']}return [cells[0]||'',cells[1]||'','',cells[2]||'',cells[3]||'']}
function weeklyLevelTag(text){const t=weeklyPlain(text);if(!t)return '<span class="weekly-empty">—</span>';const cls=/一级|紧急/.test(t)?'sev-1':/二级/.test(t)?'sev-2':'sev-3';return `<span class="weekly-level ${cls}">${esc(t)}</span>`}
function weeklyEventTable(caption,head,body){const cols=(head&&head.length>=4)?head:['时间','内容','等级','原因','处理进度'];const rows=body.map(weeklyEventRow);return `${caption?`<h4 class="weekly-caption">${weeklyCaptionHtml(caption)}</h4>`:''}<table class="weekly-table weekly-event"><thead><tr>${cols.slice(0,5).map(c=>`<th>${weeklyInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${weeklyCellHtml(r[0])||'<span class="weekly-empty">—</span>'}</td><td>${weeklyCellHtml(r[1])||'<span class="weekly-empty">—</span>'}</td><td>${weeklyLevelTag(r[2])}</td><td>${r[3]?weeklyCellHtml(r[3]):'<span class="weekly-empty">—</span>'}</td><td>${r[4]?weeklyCellHtml(r[4]):'<span class="weekly-empty">—</span>'}</td></tr>`).join('')}</tbody></table>`}
function weeklyMapRow(head,row){const get=(...names)=>{const i=head.findIndex(h=>names.some(n=>weeklyPlain(h).includes(n)));return i>=0?row[i]||'':''};const mapped={title:get('项目内容','项目名称','组别')||row[0]||'',progress:get('进展','结果')||row[1]||'',start:get('开始时间','时间'),end:get('计划完成时间','完成时间'),week:get('本周','相关事项','内容','事件'),next:get('下周计划'),owner:get('责任人'),risk:get('问题','风险','等级'),note:get('演练','服务单','变更','原因','处理进度')};if(!mapped.start&&!mapped.end&&row.length>=4){mapped.start=row[2]||'';mapped.end=row[3]||'';if(!mapped.week)mapped.week=row[4]||'';if(!mapped.next)mapped.next=row[5]||'';if(!mapped.owner)mapped.owner=row[6]||''}return mapped}
function weeklyProgress(text){const t=weeklyPlain(text);if(/终止|搁置/.test(t))return {label:t||'已终止',cls:'stop'};if(/100%|已完成/.test(t))return {label:t||'已完成',cls:'done'};if(/\d+%/.test(t))return {label:t.match(/\d+%/)[0],cls:'ing'};return t?{label:t,cls:'ing'}:null}
function weeklyProjectCards(caption,head,body){return `${caption?`<h4 class="weekly-caption">${weeklyCaptionHtml(caption)}</h4>`:''}<div class="weekly-cards">${body.map(row=>{const x=weeklyMapRow(head,row);const p=weeklyProgress(x.progress);const meta=[x.start&&x.end?`${weeklyPlain(x.start)} → ${weeklyPlain(x.end)}`:weeklyPlain(x.start||x.end),weeklyPlain(x.owner)].filter(Boolean).join(' · ');return `<section class="weekly-card"><header><b>${weeklyInline(x.title)}</b>${p?`<span class="weekly-progress ${p.cls}">${esc(p.label)}</span>`:''}</header>${meta?`<p class="weekly-meta">${esc(meta)}</p>`:''}${x.week?`<div class="weekly-field"><small>本周</small>${weeklyCellHtml(x.week)}</div>`:''}${x.next?`<div class="weekly-field"><small>下周</small>${weeklyCellHtml(x.next)}</div>`:''}${x.risk?`<div class="weekly-field"><small>备注</small>${weeklyCellHtml(x.risk)}</div>`:''}${x.note&&!x.week?`<div class="weekly-field">${weeklyCellHtml(x.note)}</div>`:''}</section>`}).join('')}</div>`}
function weeklyCircuitCards(caption,cells){return `${caption?`<h4 class="weekly-caption">${weeklyCaptionHtml(caption)}</h4>`:''}<div class="weekly-circuits">${cells.filter(c=>weeklyPlain(c)||/!\[/.test(c)).map(c=>`<section class="weekly-circuit">${weeklyCellHtml(c)}</section>`).join('')}</div>`}
function weeklyCompactTable(caption,head,body){return `<table class="weekly-table">${caption?`<caption>${weeklyCaptionHtml(caption)}</caption>`:''}<thead><tr>${head.map(c=>`<th>${weeklyInline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${c&&c!=='-'?weeklyCellHtml(c):'<span class="weekly-empty">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function weeklyRenderTable(rows){if(!rows.length)return '';const width=Math.max(...rows.map(r=>r.length));const norm=rows.map(r=>{const x=r.slice();while(x.length<width)x.push('');return x});let caption='',i=0;if(weeklyFilled(norm[0])===1){caption=norm[0].find(c=>c&&c!=='-');i=1}const chunks=[];let head=weeklyLooksHeader(norm[i])?norm[i++]:null;let body=[];const flush=keepEmpty=>{const data=body.filter(weeklyFilled);if(data.length||(keepEmpty&&caption))chunks.push({head:head||[],body:data,caption});body=[]};for(;i<norm.length;i++){if(weeklyLooksHeader(norm[i])){flush(false);head=norm[i];continue}if(weeklyFilled(norm[i])===1&&!/[%\d]{2,}/.test(weeklyPlain(norm[i].join('')))){flush(true);caption=norm[i].find(c=>c&&c!=='-');head=null;continue}body.push(norm[i])}flush(true);if(!chunks.length)return caption?`<p class="weekly-empty-block">${weeklyCaptionHtml(caption)}：本周无记录</p>`:'';return chunks.map(chunk=>{if(!chunk.body.length)return chunk.caption?`<p class="weekly-empty-block">${weeklyCaptionHtml(chunk.caption)}：本周无记录</p>`:'';const kind=weeklyTableKind(chunk.caption,chunk.head,chunk.body,width);if(kind==='circuit')return weeklyCircuitCards(chunk.caption,chunk.body.flat());if(kind==='event')return weeklyEventTable(chunk.caption,chunk.head,chunk.body);if(kind==='project')return weeklyProjectCards(chunk.caption,chunk.head,chunk.body);return weeklyCompactTable(chunk.caption,chunk.head.length?chunk.head:chunk.body[0].map((_,n)=>`列${n+1}`),chunk.body)}).join('')}
function markdownToHtml(md){const lines=String(md||'').replace(/\r\n/g,'\n').split('\n');const out=[];let i=0,skippedTitle=false;while(i<lines.length){const line=lines[i];if(weeklyIsRow(line)){const block=[];while(i<lines.length&&(weeklyIsRow(lines[i])||weeklyIsSep(lines[i]))){if(!weeklyIsSep(lines[i]))block.push(weeklySplitRow(lines[i]));i++}out.push(weeklyRenderTable(block));continue}if(/^#{1,6}\s*$/.test(line)){i++;continue}if(/^#{1,6}\s+/.test(line)){const text=line.replace(/^#+\s+/,'');if(!skippedTitle&&/工作周报/.test(text)){skippedTitle=true;i++;continue}if(/已完成项目/.test(text)){i++;while(i<lines.length&&!/^# [^#]/.test(lines[i]))i++;continue}const n=Math.min(line.match(/^#+/)[0].length+1,4);out.push(`<h${n}>${weeklyInline(text)}</h${n}>`);i++;continue}if(/^[-*]\s+/.test(line)){const items=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i])){items.push(`<li>${weeklyInline(lines[i].replace(/^[-*]\s+/,''))}</li>`);i++}out.push(`<ul>${items.join('')}</ul>`);continue}if(!line.trim()){i++;continue}out.push(`<p>${weeklyInline(line)}</p>`);i++}return out.join('')}
let weeklyRows=[];
function selectWeekly(id){$('#weeklyRoot').dataset.weeklyId=String(id);renderWeekly(weeklyRows)}
function renderWeekly(rows){const root=$('#weeklyRoot');weeklyRows=rows;if(!rows.length){root.innerHTML='<div class="weekly-article"><p>还没有归档周报。</p></div>';return}const current=rows.find(x=>String(x.id)===root.dataset.weeklyId)||rows[0];root.dataset.weeklyId=String(current.id);const d=current.details||{};const files=String(d['附件清单']||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);const docs=files.filter(f=>!/\.(png|jpe?g|gif|webp)$/i.test(f));const list=rows.length>1?`<aside class="weekly-nav">${rows.map(x=>`<button type="button" class="${x.id===current.id?'active':''}" onclick="selectWeekly(${x.id})"><b>${esc(x.name)}</b><small>${esc(x.details?.['周期']||x.status||'')}</small></button>`).join('')}</aside>`:'';root.innerHTML=`<div class="weekly-shell ${rows.length>1?'has-nav':''}">${list}<article class="weekly-article"><header class="weekly-head"><div><h3>${esc(current.name)}</h3><p>${esc(d['周期']||'')} · ${esc(current.subcategory||'网络安全组')} · ${docs.length} 个文档附件</p></div><div class="weekly-tools">${me.role!=='只读用户'?`<button class="secondary" type="button" onclick="openResourceRecord(${current.id})">编辑信息</button>`:''}<a class="button" href="/api/source-files/${encodeURIComponent(current.source)}">下载原压缩包</a></div></header>${docs.length?`<div class="weekly-files">${docs.map(f=>`<a class="weekly-file" href="${weeklyAssetUrl(f)}" target="_blank" rel="noopener">${esc(weeklyFileName(f))}</a>`).join('')}</div>`:''}<div class="weekly-document">${markdownToHtml(String(d['周报正文']||''))}</div></article></div>`}
// AP 点位图：每层一张底图，图片和楼层顺序来自 docx 正文（parse_ap_map.py），AP 数、SSID 取自 AC 配置解析出的楼层覆盖
function apSplit(rows){const g=k=>rows.filter(x=>(x.subcategory||'')===k);return{doc:g('文档')[0],floors:g('楼层底图').slice().sort((a,b)=>(+a.details['图片序号']||0)-(+b.details['图片序号']||0)),checks:g('数据校核')}}
function spApOverview(rows){
  const {doc,floors,checks}=apSplit(rows);
  const aps=floors.reduce((a,x)=>a+(+x.details['AP数量']||0),0),on=floors.reduce((a,x)=>a+(+x.details['资产在线']||0),0);
  const withAp=floors.filter(x=>+x.details['AP数量']>0).length,warn=floors.reduce((a,x)=>a+(+x.details['同频告警数']||0),0);
  const d=doc?.details||{};
  return spStats([
    ['楼层底图',floors.length,d['文件']?`《${d['文件']}》`:'来自 AP 点位图文档'],
    ['已配置 AP 楼层',withAp,floors.length?`${floors.length-withAp} 层 AC 配置里没有 AP`:''],
    ['AC 配置 AP',aps,`资产在线 ${on} 台`],
    ['同频告警',warn,warn?'相邻点位同信道，见无线网络模块':'无相邻同频'],
    ['待核对项',checks.length,checks.length?'底图与 AC 配置存在出入':'底图与 AC 配置一致']]);
}
function renderApPanel(rows){
  const el=$('#assetSummary');el.classList.remove('hidden');
  const {doc,floors,checks}=apSplit(rows);
  const cards=floors.map(x=>{const d=x.details,aps=+d['AP数量']||0,on=+d['资产在线']||0,warn=+d['同频告警数']||0;
    const badge=aps?`<b class="ap-badge on">${aps} AP</b>${on?`<b class="ap-badge ok">在线 ${on}</b>`:''}${warn?`<b class="ap-badge warn">同频 ${warn}</b>`:''}`:'<b class="ap-badge off">AC 无 AP</b>';
    const ssid=d['覆盖SSID']&&d['覆盖SSID']!=='—'?`<small title="${esc(d['覆盖SSID'])}">SSID：${esc(d['覆盖SSID'])}</small>`:'';
    return `<figure class="ap-card" onclick="askOpen('record',${x.id})"><a href="${esc(d['图片文件'])}" target="_blank" onclick="event.stopPropagation()"><img src="${esc(d['图片文件'])}" loading="lazy" alt="${esc(x.name)} AP 点位图"></a><figcaption><div class="ap-cap"><b>${esc(x.name)}</b><span>第 ${esc(d['图片序号'])} 张 · ${esc(d['图片格式'])} ${esc(d['图片大小'])}</span></div><div class="ap-badges">${badge}</div>${ssid}</figcaption></figure>`}).join('');
  const alerts=checks.length?checks.map(c=>`<li class="rk-alert info" onclick="askOpen('record',${c.id})"><b>${esc(c.details['问题类型'])} · ${esc(c.details['楼层'])}</b><small>${esc(c.details['问题说明'])}</small></li>`).join(''):'<li class="rk-alert ok"><b>无待核对项</b><small>每层底图都能在 AC 配置里找到对应 AP</small></li>';
  const d=doc?.details||{};
  el.innerHTML=`<div class="panel rk-panel"><div class="panel-head"><h3>无线 AP 点位图</h3><span>北京总部 B 座 ${floors.length} 层底图，图片按《${esc(d['文件']||'AP点位图文档')}》正文顺序排列；角标里的 AP 数、在线数取自无线控制器配置解析（${d['AC配置AP合计']||0} 个 AP 落在 ${d['AC已配置AP楼层']||0} 层）${doc?` · <a href="/api/source-files/${encodeURIComponent(doc.source)}">下载源文档</a>`:''}</span></div>
  <div class="point-gallery ap-gallery">${cards||'<p class="wlan-empty">没有解析到楼层底图，请先运行 tools/parse_ap_map.py。</p>'}</div>
  <div class="rk-checks"><h4>点位数据校核<em>底图与 AC 配置对不上的楼层，点条目查看详情</em></h4><ul>${alerts}</ul></div></div>`;
}
let topologyPages=[],topologyIndex=0,topologyScale=1,topologyEdit=false,topologyDrag=null,topologyLoadToken=0,topologyConnectMode=false,topologyConnectFrom=null;
async function loadTopologyPages(){try{topologyPages=await fetch('/source-assets/topology/pages.json',{cache:'no-store'}).then(r=>r.json())}catch{topologyPages=[{file:'page1.svg',title:'万达总部逻辑互联'}]}showTopologyPage(0)}
function topologyLayoutKey(){return `wanda-topology-layout:${topologyPages[topologyIndex]?.file||'page1.svg'}`}
function topologyNodeBox(g){return{x:+g.dataset.x+(+g.dataset.dx||0),y:+g.dataset.y+(+g.dataset.dy||0),w:+g.dataset.w,h:+g.dataset.h}}
function topologyNodeCenter(g){const b=topologyNodeBox(g);return[b.x+b.w/2,b.y+b.h/2]}
function topologyNearest(x,y,nodes){let best=null,dist=Infinity;for(const g of nodes){const b=topologyNodeBox(g),px=Math.max(b.x,Math.min(x,b.x+b.w)),py=Math.max(b.y,Math.min(y,b.y+b.h)),d=(px-x)**2+(py-y)**2;if(d<dist){dist=d;best=g}}return dist<=120**2?best:null}
function topologyAnchor(g,toward,fallback){if(!g)return fallback;const b=topologyNodeBox(g),cx=b.x+b.w/2,cy=b.y+b.h/2,dx=toward[0]-cx,dy=toward[1]-cy;if(!dx&&!dy)return[cx,cy];const tx=dx?b.w/2/Math.abs(dx):Infinity,ty=dy?b.h/2/Math.abs(dy):Infinity,t=Math.min(tx,ty);return[cx+dx*t,cy+dy*t]}
function topologyAttachLinks(){const svg=$('#topologyCanvas svg');if(!svg)return;const nodes=[...svg.querySelectorAll('.topology-node')];for(const p of svg.querySelectorAll('.topology-link:not(.topology-user-link)')){const x1=+p.dataset.x1,y1=+p.dataset.y1,x2=+p.dataset.x2,y2=+p.dataset.y2,a=topologyNearest(x1,y1,nodes),b=topologyNearest(x2,y2,nodes);if(a)p.dataset.from=a.dataset.nodeId;if(b)p.dataset.to=b.dataset.nodeId}topologyUpdateLinks()}
function topologyUpdateLinks(){const svg=$('#topologyCanvas svg');if(!svg)return;const nodes=new Map([...svg.querySelectorAll('.topology-node')].map(g=>[g.dataset.nodeId,g]));for(const p of svg.querySelectorAll('.topology-link')){const from=nodes.get(p.dataset.from),to=nodes.get(p.dataset.to);if(!from&&!to)continue;const a0=from?topologyNodeCenter(from):[+p.dataset.x1,+p.dataset.y1],b0=to?topologyNodeCenter(to):[+p.dataset.x2,+p.dataset.y2],a=topologyAnchor(from,b0,a0),b=topologyAnchor(to,a0,b0),mx=(a[0]+b[0])/2;p.setAttribute('d',`M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`)}}
function topologyRestore(){const svg=$('#topologyCanvas svg');if(!svg)return;let saved={};try{saved=JSON.parse(localStorage.getItem(topologyLayoutKey())||'{}')}catch{}for(const g of svg.querySelectorAll('.topology-node')){const p=saved[g.dataset.nodeId]||[0,0];g.dataset.dx=p[0];g.dataset.dy=p[1];g.setAttribute('transform',`translate(${p[0]} ${p[1]})`)}}
function topologyCreateLink(from,to){const svg=$('#topologyCanvas svg');if(!svg||!from||!to||from===to)return null;const exists=[...svg.querySelectorAll('.topology-user-link')].some(p=>p.dataset.from===from&&p.dataset.to===to||p.dataset.from===to&&p.dataset.to===from);if(exists)return null;const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class','topology-link topology-user-link');p.setAttribute('fill','none');p.setAttribute('stroke','#147d75');p.setAttribute('stroke-width','2.4');p.dataset.from=from;p.dataset.to=to;const first=svg.querySelector('.topology-node');first?.parentNode.insertBefore(p,first);topologyUpdateLinks();return p}
function topologyRestoreLinks(){let links=[];try{links=JSON.parse(localStorage.getItem(`${topologyLayoutKey()}:links`)||'[]')}catch{}for(const pair of links)topologyCreateLink(pair[0],pair[1])}
function topologySave(silent=false){const svg=$('#topologyCanvas svg');if(!svg)return;const saved={};for(const g of svg.querySelectorAll('.topology-node'))saved[g.dataset.nodeId]=[+g.dataset.dx||0,+g.dataset.dy||0];localStorage.setItem(topologyLayoutKey(),JSON.stringify(saved));const links=[...svg.querySelectorAll('.topology-user-link')].map(p=>[p.dataset.from,p.dataset.to]);localStorage.setItem(`${topologyLayoutKey()}:links`,JSON.stringify(links));if(!silent)toast('当前页模块位置和连接已保存到本机浏览器')}
function topologyReset(){localStorage.removeItem(topologyLayoutKey());localStorage.removeItem(`${topologyLayoutKey()}:links`);topologyConnectMode=false;topologyConnectFrom=null;showTopologyPage(topologyIndex);toast('已恢复原始布局')}
function topologyApplyScale(){const svg=$('#topologyCanvas svg'),canvas=$('#topologyCanvas');if(!svg||!canvas)return;const vb=svg.viewBox.baseVal,w=vb?.width||svg.width.baseVal.value,h=vb?.height||svg.height.baseVal.value;svg.style.transform=`scale(${topologyScale})`;canvas.style.width=`${w*topologyScale}px`;canvas.style.height=`${h*topologyScale}px`}
function topologyZoom(factor){topologyScale=Math.min(3,Math.max(0.25,topologyScale*factor));topologyApplyScale()}
function topologyFit(){const stage=$('#topologyStage'),svg=$('#topologyCanvas svg');if(!stage||!svg)return;const w=svg.viewBox.baseVal.width||svg.width.baseVal.value;topologyScale=Math.min((stage.clientWidth-32)/w,1);topologyApplyScale()}
function topologyToggleEdit(){topologyEdit=!topologyEdit;if(!topologyEdit){topologyConnectMode=false;topologyConnectFrom=null}const shell=$('#topologyRoot .topology-shell'),btn=$('#topologyEdit'),connect=$('#topologyConnect');shell?.classList.toggle('is-editing',topologyEdit);shell?.classList.remove('is-connecting');if(btn)btn.textContent=topologyEdit?'完成编辑':'编辑布局';if(connect){connect.classList.remove('active');connect.textContent='连接模块'}const hint=$('#topologyHint');if(hint)hint.textContent=topologyEdit?'拖动任意设备模块；与模块相连的线会同步移动，布局自动保存在本机。':'查看模式：滚轮缩放；点击“编辑布局”后可像 PPT 一样拖动模块。'}
function topologyToggleConnect(){if(!topologyEdit)topologyToggleEdit();topologyConnectMode=!topologyConnectMode;topologyConnectFrom=null;const shell=$('#topologyRoot .topology-shell'),btn=$('#topologyConnect'),hint=$('#topologyHint');shell?.classList.toggle('is-connecting',topologyConnectMode);if(btn){btn.classList.toggle('active',topologyConnectMode);btn.textContent=topologyConnectMode?'退出连接':'连接模块'}if(hint)hint.textContent=topologyConnectMode?'连接模式：依次点击两个设备模块即可拼接；重复连接不会创建。':'拖动任意设备模块；与模块相连的线会同步移动，布局自动保存在本机。'}
function topologyUndoLink(){const links=$$('#topologyCanvas .topology-user-link'),last=links[links.length-1];if(!last)return toast('当前页还没有手工连接');last.remove();topologySave(true);toast('已撤销上一条手工连接')}
function topologyExport(){const svg=$('#topologyCanvas svg');if(!svg)return;const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${topologyPages[topologyIndex]?.title||'网络拓扑'}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function topologyBindDrag(){const stage=$('#topologyStage');if(!stage||stage.dataset.dragBound)return;stage.dataset.dragBound='1';stage.addEventListener('click',e=>{if(!topologyConnectMode)return;const g=e.target.closest?.('.topology-node');if(!g)return;e.preventDefault();if(!topologyConnectFrom){topologyConnectFrom=g;g.classList.add('connect-source');$('#topologyHint').textContent=`已选择 ${g.textContent.trim().split(/\s+/)[0]}，再点一个模块完成连接。`;return}topologyConnectFrom.classList.remove('connect-source');const made=topologyCreateLink(topologyConnectFrom.dataset.nodeId,g.dataset.nodeId);topologyConnectFrom=null;if(made){topologySave(true);toast('模块已连接')}else toast('不能连接自身或重复连接')});stage.addEventListener('pointerdown',e=>{if(!topologyEdit||topologyConnectMode)return;const g=e.target.closest?.('.topology-node');if(!g)return;e.preventDefault();topologyDrag={g,id:e.pointerId,x:e.clientX,y:e.clientY,dx:+g.dataset.dx||0,dy:+g.dataset.dy||0};g.classList.add('selected');stage.setPointerCapture(e.pointerId)});stage.addEventListener('pointermove',e=>{if(!topologyDrag||e.pointerId!==topologyDrag.id)return;const d=topologyDrag,g=d.g,dx=d.dx+(e.clientX-d.x)/topologyScale,dy=d.dy+(e.clientY-d.y)/topologyScale;g.dataset.dx=dx;g.dataset.dy=dy;g.setAttribute('transform',`translate(${dx} ${dy})`);topologyUpdateLinks()});const end=e=>{if(!topologyDrag||e.pointerId!==topologyDrag.id)return;topologyDrag.g.classList.remove('selected');topologyDrag=null;topologySave(true)};stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('wheel',e=>{if(e.ctrlKey||!topologyEdit){e.preventDefault();topologyZoom(e.deltaY>0?0.9:1.1)}},{passive:false})}
async function showTopologyPage(i){if(!topologyPages[i])return;topologyIndex=i;topologyScale=1;topologyConnectMode=false;topologyConnectFrom=null;const token=++topologyLoadToken,tabs=$('#topologyTabs'),canvas=$('#topologyCanvas');if(tabs)tabs.innerHTML=topologyPages.map((p,idx)=>`<button class="${idx===i?'active':''}" onclick="showTopologyPage(${idx})">${esc(p.title)}</button>`).join('');if(!canvas)return;canvas.innerHTML='<p class="topology-loading">正在装入模块化拓扑…</p>';try{const svg=await fetch(`/source-assets/topology/${topologyPages[i].file}?v=20260901-03`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text()});if(token!==topologyLoadToken)return;canvas.innerHTML=svg;canvas.querySelector('svg')?.classList.add('topology-svg');topologyRestore();topologyAttachLinks();topologyRestoreLinks();topologyUpdateLinks();requestAnimationFrame(topologyFit)}catch(e){canvas.innerHTML=`<p class="topology-loading">拓扑加载失败：${esc(e.message)}</p>`}}
function renderTopology(x){const root=$('#topologyRoot');if(!root)return;root.innerHTML=`<div class="topology-shell"><div class="topology-toolbar"><div id="topologyTabs" class="topology-tabs"></div><div class="topology-tools"><button id="topologyEdit" class="secondary" type="button" onclick="topologyToggleEdit()">编辑布局</button><button id="topologyConnect" class="secondary" type="button" onclick="topologyToggleConnect()">连接模块</button><button class="secondary" type="button" onclick="topologyUndoLink()">撤销连接</button><button class="secondary" type="button" onclick="topologyZoom(0.8)">缩小</button><button class="secondary" type="button" onclick="topologyZoom(1.25)">放大</button><button class="secondary" type="button" onclick="topologyFit()">适应宽度</button><button class="secondary" type="button" onclick="topologySave()">保存布局</button><button class="secondary" type="button" onclick="topologyReset()">复位</button><button class="secondary" type="button" onclick="topologyExport()">导出 SVG</button>${x.source?`<a class="button" href="/api/source-files/${encodeURIComponent(x.source)}">下载 Visio 原图</a>`:''}</div></div><div id="topologyHint" class="topology-edit-hint">查看模式：滚轮缩放；点击“编辑布局”后可像 PPT 一样拖动模块。</div><div id="topologyStage" class="topology-stage"><div id="topologyCanvas" class="topology-canvas"></div></div></div>`;topologyEdit=false;topologyConnectMode=false;topologyConnectFrom=null;topologyBindDrag();loadTopologyPages()}
function resourceDetail(x){recordForm(x)}

// ===== 设备台账总览：资产矩阵 + 配置备份覆盖 + 上架覆盖 + 健康提醒 =====
// 三份来源（资产表、conf 配置、上架图）按设备名归一后互相对照，名字里的空格、下划线、连字符和大小写都不算差异
const NETDEV_CLASSES=['交换机','路由器','负载均衡','无线AC','防火墙'];
const devKey=s=>String(s||'').toLowerCase().replace(/[\s_\-]/g,'');
function devSplit(rows){const is=(c,s)=>x=>x.category===c&&(s===undefined||(x.subcategory||'')===s);
  return{assets:rows.filter(is('资产信息')),cfg:rows.filter(x=>x.category==='配置备份'&&(x.subcategory||'')!=='数据校核'),cfgChecks:rows.filter(is('配置备份','数据校核')),units:rows.filter(is('机柜上架图','上架设备')),rackChecks:rows.filter(is('机柜上架图','数据校核'))}}
function devCoverage(rows){
  const {assets,cfg,units}=devSplit(rows);
  const cfgNames=new Set(cfg.map(x=>devKey(x.name))),cfgIps=new Set(cfg.map(x=>x.ip).filter(Boolean));
  const unitNames=new Set(units.map(u=>devKey(u.details['设备名称'])));
  // 该有配置备份的：在线、有主机名的交换机/路由器/负载均衡/AC/防火墙；AP 由 AC 统一纳管，不单独备份
  const need=assets.filter(x=>x.status==='在线'&&NETDEV_CLASSES.includes(assetClass(x))&&pickDetail(x.details,['设备名称']));
  const backed=new Set(need.filter(x=>cfgNames.has(devKey(x.name))||(x.ip&&cfgIps.has(x.ip))));
  const missing=need.filter(x=>!backed.has(x));
  // 上架覆盖只看光子机房：资产名带 U 位（B3_12U_xxx）的在线设备，应能在上架图上找到
  const gz=assets.filter(x=>x.status==='在线'&&x.location==='燕郊光子机房'&&/^B[1-8][_-]\d{1,2}(?:[-_]\d{1,2})?U(?=[_-]|$)/i.test(x.name||''));
  const racked=gz.filter(x=>unitNames.has(devKey(x.name)));
  return {need,backed:[...backed],missing,cfg,cfgUnmatched:cfg.filter(x=>x.details?.['资产匹配']!=='已匹配'),gz,racked,unracked:gz.filter(x=>!unitNames.has(devKey(x.name))),units,unitsMatched:units.filter(u=>u.details['型号来源']==='资产表匹配')};
}
function spDeviceOverview(rows){
  const {assets,cfgChecks,rackChecks}=devSplit(rows),c=devCoverage(rows);
  const st=k=>assets.filter(x=>x.status===k).length,pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  return spStats([
    ['资产总数',assets.length,`在线 ${st('在线')} · 下线 ${st('下线')} · 在库 ${st('在库')}`],
    ['在线网络设备',c.need.length,'交换机 / 路由器 / F5 / AC / 防火墙，有主机名'],
    ['配置备份覆盖',pct(c.backed.length,c.need.length),`${c.backed.length} 台有备份 · ${c.missing.length} 台缺`],
    ['配置备份',c.cfg.length,`资产已匹配 ${c.cfg.length-c.cfgUnmatched.length} · 资产表无此设备 ${c.cfgUnmatched.length}`],
    ['光子机房上架',pct(c.racked.length,c.gz.length),`${c.racked.length}/${c.gz.length} 台在线设备已在上架图定位`],
    ['待核对项',cfgChecks.length+rackChecks.length,`配置 vs IP 表 / 资产表 ${cfgChecks.length} · 上架图 vs 资产表 ${rackChecks.length}`]])}
function devBars(pairs){const max=Math.max(1,...pairs.map(p=>p[1]));const total=pairs.reduce((a,p)=>a+p[1],0);
  return pairs.map(([k,n])=>`<div class="tk-rank"><b title="${esc(k)}">${esc(k)}</b><div class="tk-track"><i style="width:${n/max*100}%"></i></div><small>${n} · ${total?Math.round(n/total*100):0}%</small></div>`).join('')||'<p class="wlan-empty">暂无数据。</p>'}
function devList(list,label,fmt,cls){if(!list.length)return '';const shown=list.slice(0,12);
  return `<li class="${cls}"><b>${esc(label)}</b><small class="dev-links">${shown.map(x=>`<a onclick="openRecord(${x.id})">${esc(fmt(x))}</a>`).join('')}${list.length>shown.length?`<em>等 ${list.length} 台</em>`:''}</small></li>`}
function renderDeviceOverview(rows){
  const el=$('#assetSummary');if(!el)return;
  const {assets,cfgChecks,rackChecks}=devSplit(rows),c=devCoverage(rows);
  const {t1,t2}=assetSummaryTables(assets);
  const roles={};for(const x of c.cfg){const k=x.details?.['设备角色']||'其他';roles[k]=(roles[k]||0)+1}
  const vers={};for(const x of c.cfg){const v=x.details?.['软件平台']||x.details?.['厂商']||'其他';vers[v]=(vers[v]||0)+1}
  const byLoc=k=>c.missing.filter(x=>x.location===k).length;
  const cover=`<ul class="wlan-alerts">
    <li class="${c.missing.length?'warn':'info'}"><b>${c.backed.length}/${c.need.length} 台在线网络设备有配置备份${c.missing.length?`，缺 ${c.missing.length} 台（北京 ${byLoc('北京总部')} · 光子 ${byLoc('燕郊光子机房')} · 其他 ${byLoc('其他区域')}）`:''}</b><small>按设备名或管理 IP 对照 资料\\conf 抓取到的配置；没备份的设备下次抓取时补上</small></li>
    ${devList(c.missing,'在线但没有配置备份',x=>`${x.name}${x.ip?' '+x.ip:''}`,'warn')}
    ${devList(c.cfgUnmatched,'有配置、资产表里却找不到',x=>`${x.name}${x.ip?' '+x.ip:''}`,'bad')}</ul>`;
  const rack=`<ul class="wlan-alerts">
    <li class="info"><b>上架图 ${c.units.length} 台，${c.unitsMatched.length} 台已回挂资产表</b><small>其余 ${c.units.length-c.unitsMatched.length} 台按设备名推断型号；机架立面在「机房与拓扑」模块</small></li>
    ${devList(c.unracked,'光子在线设备名带 U 位、上架图上没画',x=>x.name,'warn')}</ul>`;
  const alerts=[];const push=(cls,b,s)=>alerts.push(`<li class="${cls}"><b>${esc(b)}</b><small>${esc(s)}</small></li>`);
  const alarmed=c.cfg.filter(x=>x.details?.['抓取期间告警']&&x.details['抓取期间告警']!=='无');
  if(alarmed.length)push('bad',`${alarmed.length} 台设备抓取配置时终端滚出故障日志`,alarmed.map(x=>`${x.name}：${x.details['抓取期间告警']}`).join('；'));
  const incons=c.cfg.filter(x=>x.details?.['台账核对']&&!/^一致/.test(x.details['台账核对']));
  if(incons.length)push('warn',`${incons.length} 台设备配置与资产台账不一致`,incons.slice(0,8).map(x=>`${x.name}（${x.details['台账核对']}）`).join('；'));
  const pending=assets.filter(x=>!x.status||x.status==='待确认');
  if(pending.length)push('warn',`${pending.length} 条资产状态待确认`,'资产表里状态列为空，在「资产清单」页签点行改状态');
  const kinds={};for(const x of [...cfgChecks,...rackChecks]){const k=x.details?.['问题类型']||'其他';kinds[k]=(kinds[k]||0)+1}
  if(cfgChecks.length+rackChecks.length)push('info',`${cfgChecks.length+rackChecks.length} 项交叉核对待办，见「数据校核」页签`,Object.entries(kinds).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${n}`).join(' · '));
  if(!alerts.length)push('info','三份来源对照无异常','资产表、配置备份、上架图一致');
  el.innerHTML=`<div class="panel wlan-panel dev-panel"><div class="panel-head"><h3>设备总览</h3><span>资产表 ${assets.length.toLocaleString()} 条、配置备份 ${c.cfg.length} 台、上架图 ${c.units.length} 台，三份来源按设备名互相对照；点任意设备名打开跨源设备卡</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span2"><h4>资产类别 × 位置<em>在线 / 下线 / 在库明细在格内</em></h4><div class="wlan-scroll">${t1}</div></section>
    <section class="wlan-box span2"><h4>配置备份覆盖<em>在线网络设备 vs 资料\\conf 配置</em></h4><div class="wlan-scroll">${cover}</div></section>
    <section class="wlan-box"><h4>配置设备角色<em>按配置解析</em></h4><div class="wlan-scroll">${devBars(Object.entries(roles).sort((a,b)=>b[1]-a[1]))}</div></section>
    <section class="wlan-box"><h4>软件平台<em>Comware / TMOS</em></h4><div class="wlan-scroll">${devBars(Object.entries(vers).sort((a,b)=>b[1]-a[1]))}</div></section>
    <section class="wlan-box span2"><h4>维保类型 × 位置</h4><div class="wlan-scroll">${t2}</div></section>
    <section class="wlan-box span2"><h4>光子机房上架覆盖<em>资产表 vs 上架图</em></h4><div class="wlan-scroll">${rack}</div></section>
    <section class="wlan-box span2"><h4>健康提醒<em>配置、台账、上架图自动比对</em></h4><div class="wlan-scroll"><ul class="wlan-alerts">${alerts.join('')}</ul></div></section>
  </div></div>`;
}


// ================= IP 地址规划总览 =================
// 给不看技术的人看结构：全集团地址空间分三层（数据中心 / 办公网 / 互联网），每一层还有多少余量；
// 给运维留下钻：点分区进方格图、点城市进各地表、点网段直接开地址明细。
// IDC 的"使用率"有两套口径：整体口径把 156 段预留网段也算进分母，只有 2%，看不出问题；
// 这里主推"已启用网段口径"（分母去掉整段预留），才反映真正在用的地址池紧不紧。
const IP_CITY_ORDER=['北京','珠海','天津','广州','上海'];
function ipNum(n){return Number(n||0).toLocaleString()}
function ipPct(a,b){return b?Math.round(a/b*1000)/10:0}
// 单个网段的真实占用 = 地址表登记已分配 + 资料检出（/api/subnets 的 detected）
const ipOcc=s=>(s.used||0)+(s.detected||0);
// 网段文本 → 地址数：一格里可能写好几段（顿号 / 逗号 / 换行分隔），区间写法按起止算
function ipCidrSize(text){let n=0;for(const part of String(text||'').split(/[、,，;\n\s]+/).filter(Boolean)){const m=part.match(/\/(\d{1,2})$/);if(m){n+=2**(32-Number(m[1]));continue}const r=part.match(/^(\d+\.\d+\.\d+\.)(\d+)\s*[-~]\s*(?:\d+\.\d+\.\d+\.)?(\d+)$/);if(r){n+=Math.max(0,Number(r[3])-Number(r[2])+1);continue}if(/^\d+\.\d+\.\d+\.\d+$/.test(part))n+=1}return n}
function ipZoneStats(d,subs){
  const byZone=new Map();for(const z of d.byZone||[])byZone.set(z.zone,{...z,segs:0,usedSegs:0,resSegs:0,modules:new Set(),hot:[]});
  for(const s of subs){const z=byZone.get(s.zone);if(!z)continue;z.segs++;if(s.status==='预留'){z.resSegs++}else{z.usedSegs++;if(s.module&&s.module!=='预留')z.modules.add(s.module);if(s.total&&ipOcc(s)/s.total>=.7)z.hot.push(s)}}
  for(const z of byZone.values()){z.enabled=z.total-z.reserved;z.pct=ipPct(z.used,z.enabled)}
  return [...byZone.values()].sort((a,b)=>b.total-a.total)}
function ipCityStats(g){
  const cities=new Map();const at=c=>{if(!cities.has(c))cities.set(c,{city:c,wired:0,wifi:0,addr:0,sites:new Set(),free:[],dhcp:0,exits:[]});return cities.get(c)};
  for(const x of g['各地IP表']||[]){const c=at(x._sp.city||'未标城市');(x._sp.type==='WiFi'?c.wifi++:c.wired++);c.addr+=ipCidrSize(x._sp.cidr);if(x._sp.pos)c.sites.add(x._sp.pos)}
  for(const x of g['各地未分配IP段']||[])at(x._sp.city||'未标城市').free.push(x);
  for(const x of g['北京各楼层dhcp保留IP']||[])at(x._sp.city||'北京').dhcp++;
  for(const x of g['各地公网IP表']||[])at(x._sp.city||'未标城市').exits.push(x);
  return [...cities.values()].sort((a,b)=>{const ia=IP_CITY_ORDER.indexOf(a.city),ib=IP_CITY_ORDER.indexOf(b.city);return (ia<0?99:ia)-(ib<0?99:ib)||b.wired+b.wifi-a.wired-a.wifi})}
// 办公网城市统计（地址表口径）：在用段容量 cap 不含预留段；dhcp 是在用段里标预留的地址（DHCP 保留）
function ipOfficeCityStats(subs){
  const cities=new Map();
  for(const c of [...new Set(subs.map(s=>s.zone))]){const list=subs.filter(s=>s.zone===c),st=ofSiteStats(list);const cap=st.tot-st.resAddr,inUse=st.assigned+st.det;
    cities.set(c,{city:c,wired:st.wired,wifi:st.wifi,sites:new Set(list.map(s=>s.site).filter(Boolean)),cap,inUse,assigned:st.assigned,det:st.det,dhcp:st.dhcp,freeAddr:st.free,resSegs:st.res.length,resAddr:st.resAddr,pct:ipPct(inUse,cap)})}
  return [...cities.values()].sort((a,b)=>{const ia=IP_CITY_ORDER.indexOf(a.city),ib=IP_CITY_ORDER.indexOf(b.city);return (ia<0?99:ia)-(ib<0?99:ib)||b.wired+b.wifi-a.wired-a.wifi})}
function ippBar(parts,total){return `<div class="ipp-bar">${parts.filter(([,n])=>n>0).map(([k,n,tip])=>`<i class="${k}" style="width:${total?n/total*100:0}%" title="${esc(tip||'')} ${ipNum(n)}"></i>`).join('')}</div>`}
function ippLegend(items){return `<div class="ipp-legend">${items.map(([k,label])=>`<span><i class="ipp-sw ${k}"></i>${esc(label)}</span>`).join('')}</div>`}
// 跳到某地址空间的网段管理页并按分区 / 城市筛好；kind 缺省为 IDC
const SUBNET_TAB_OF={idc:'subnets',office:'officeSubnets',public:'publicSubnets'};
async function ipGotoZone(zone,kind='idc'){selectTab(SUBNET_TAB_OF[kind]||'subnets');$('#subnetSearch').value='';$('#subnetStatus').value='';$('#zoneFilter').value='';await loadSubnets();const f=$('#zoneFilter');if(zone&&[...f.options].some(o=>o.value===zone)){f.value=zone;await loadSubnets()}}
function ipGotoTab(key,q){$('#resourceSearch').value=q||'';return loadModule('ip',key)}
async function renderIpPlanPanel(rows){
  const el=$('#assetSummary');if(!el)return;
  el.innerHTML='<div class="panel wlan-panel ip-plan"><div class="panel-head"><h3>IP 地址规划总览</h3><span>正在汇总三份台账与地址表…</span></div></div>';
  const [d,subs,pools,offSubs]=await Promise.all([api('/api/dashboard'),api('/api/subnets'),api('/api/subnets?kind=public'),api('/api/subnets?kind=office')]);
  if(typeof curTab!=='undefined'&&curTab&&curTab.render!==renderIpPlanPanel)return;
  const poolTotal=pools.reduce((a,p)=>a+p.total,0),poolUsed=pools.reduce((a,p)=>a+p.used,0),poolDet=pools.reduce((a,p)=>a+(p.detected||0),0),poolFree=pools.reduce((a,p)=>a+Math.max(0,p.total-p.used-(p.detected||0)-p.reserved),0);
  const g={};for(const x of rows)(g[x.subcategory||'']??=[]).push(x);
  const zones=ipZoneStats(d,subs);
  // 办公网以地址表（kind=office）为准；地址表还没导入时退回 Excel 底稿的口径
  for(const s of offSubs)s._r=zmCidrRange(s);
  const hasOffice=offSubs.length>0;
  const cities=hasOffice?ipOfficeCityStats(offSubs):ipCityStats(g);
  const office=hasOffice?offSubs.filter(s=>s.status!=='预留'):(g['各地IP表']||[]),free=hasOffice?offSubs.filter(s=>s.status==='预留'):(g['各地未分配IP段']||[]),dhcp=g['北京各楼层dhcp保留IP']||[],exits=g['各地公网IP表']||[];
  const officeAddr=hasOffice?office.reduce((a,s)=>a+s.total,0):office.reduce((a,x)=>a+ipCidrSize(x._sp.cidr),0),freeAddr=hasOffice?free.reduce((a,s)=>a+s.total,0):free.reduce((a,x)=>a+ipCidrSize(x._sp.cidr),0);
  const wired=hasOffice?office.filter(s=>s.netType==='有线').length:office.filter(x=>x._sp.type!=='WiFi').length,wifi=office.length-wired;
  const offSt=hasOffice?ofSiteStats(offSubs):null;
  const pub=rows.filter(x=>(x.subcategory||'').startsWith('互联网IP · ')),apps=g['互联网IP · 公网IP地址分配']||[],infra=g['互联网IP · 基础设施互联网ip']||[];
  const pubAddrs=new Set(pub.flatMap(x=>String(x.ip||'').split(',')).filter(Boolean)).size;
  const dv=(x,k)=>String(x.details?.[k]??'').trim();
  const biz={};for(const x of apps){const k=dv(x,'所属业态')||'未标业态';biz[k]=(biz[k]||0)+1}
  const recyclable=apps.filter(x=>/^否/.test(dv(x,'是否保留'))),pendingCfg=apps.filter(x=>dv(x,'是否提前配置')&&!/完成/.test(dv(x,'是否提前配置'))),needIcp=apps.filter(x=>/^是/.test(dv(x,'是否需要网站备案')));
  const resSegs=subs.filter(s=>s.status==='预留'),usedSegs=subs.length-resSegs.length;
  const idcPct=ipPct(d.used,d.total-d.reserved);
  // ---- 第一排：三层地址空间 ----
  const domains=`<div class="ipp-domains">
    <div class="ipp-domain" style="--c:#147d75"><h5>数据中心 · 燕郊光子机房<small>10.199.0.0/16 · ${zones.length} 个分区</small></h5>
      <div class="ipp-big"><b>${idcPct}%</b><span>已启用网段使用率<br>${ipNum(d.used)} / ${ipNum(d.total-d.reserved)} 地址在用</span></div>
      ${ippBar([['used',d.assigned,'登记已分配'],['det',d.detected,'资料检出占用'],['free',d.available,'启用段内可用'],['res',d.reserved,'整段预留']],d.total)}
      ${ippLegend([['used','登记已分配'],['det','资料检出占用'],['free','启用段可用'],['res','整段预留']])}
      <div class="ipp-kv"><span>已启用网段 <b>${usedSegs}</b> 段</span><span>预留待用 <b>${resSegs.length}</b> 段</span><span>地址总量 <b>${ipNum(d.total)}</b></span><span>可规划余量 <b>${ipNum(d.available+d.reserved)}</b></span></div>
      <div class="ipp-links"><a onclick="selectTab('zonemap')">分区规划图</a><a onclick="selectTab('subnets')">网段管理</a><a onclick="ipGotoTab('IP分配明细')">分配明细</a></div></div>
    ${hasOffice?`<div class="ipp-domain" style="--c:#2b5ea7"><h5>办公网 · 北京总部与各地<small>10.0 / 10.1 等 · ${cities.length} 个城市 · ${new Set(offSubs.map(s=>s.site).filter(Boolean)).size} 个站点</small></h5>
      <div class="ipp-big"><b>${ipPct(offSt.assigned+offSt.det,offSt.tot-offSt.resAddr)}%</b><span>在用网段地址使用率<br>${ipNum(offSt.assigned+offSt.det)} / ${ipNum(offSt.tot-offSt.resAddr)} 地址在用</span></div>
      ${ippBar([['used',offSt.assigned,'登记已分配（网关、管理地址、页面登记）'],['det',offSt.det,'资料检出占用'],['res',offSt.dhcp,'DHCP 保留'],['free',offSt.free,'在用段可用']],offSt.tot-offSt.resAddr)}
      ${ippLegend([['used','登记已分配'],['det','资料检出'],['res','DHCP 保留'],['free','在用段可用']])}
      <div class="ipp-kv"><span>在用 <b>${office.length}</b> 段（有线 ${wired} · 无线 ${wifi}）</span><span>预留 <b>${free.length}</b> 段（${ipNum(freeAddr)} 地址）</span><span>DHCP 保留 <b>${ipNum(offSt.dhcp)}</b> 地址</span><span>在用段容量 <b>${ipNum(officeAddr)}</b></span></div>
      <div class="ipp-links"><a onclick="selectTab('office')">办公网规划图</a><a onclick="selectTab('officeSubnets')">网段管理</a><a onclick="ipGotoTab('各地IP表')">导入底稿</a><a onclick="ipGotoTab('北京各楼层dhcp保留IP')">DHCP 保留表</a></div></div>`
    :`<div class="ipp-domain" style="--c:#2b5ea7"><h5>办公网 · 北京总部与各地<small>10.0 / 10.1 · ${cities.length} 个城市</small></h5>
      <div class="ipp-big"><b>${office.length}</b><span>在用网段<br>约 ${ipNum(officeAddr)} 个地址容量</span></div>
      ${ippBar([['wired',wired,'有线网段'],['wifi',wifi,'WiFi 网段'],['free',free.length,'未分配网段']],office.length+free.length)}
      ${ippLegend([['wired','有线'],['wifi','WiFi'],['free','未分配']])}
      <div class="ipp-kv"><span>有线 <b>${wired}</b> · WiFi <b>${wifi}</b></span><span>未分配 <b>${free.length}</b> 段（${ipNum(freeAddr)} 地址）</span><span>DHCP 保留 <b>${dhcp.length}</b> 段</span><span>覆盖站点 <b>${new Set(office.map(x=>x._sp.pos).filter(Boolean)).size}</b> 处</span></div>
      <div class="ipp-links"><a onclick="ipGotoTab('各地IP表')">在用网段</a><a onclick="ipGotoTab('各地未分配IP段')">未分配</a><a onclick="ipGotoTab('北京各楼层dhcp保留IP')">DHCP 保留</a></div></div>`}
    <div class="ipp-domain" style="--c:#c98a1d"><h5>互联网 · 出口与公网<small>${pools.length} 个公网地址池 · ${ipNum(poolTotal)} 个公网地址</small></h5>
      <div class="ipp-big"><b>${ipPct(poolUsed+poolDet,poolTotal)}%</b><span>公网地址使用率<br>${ipNum(poolUsed+poolDet)} / ${ipNum(poolTotal)} 已分配，可用 ${ipNum(poolFree)}</span></div>
      ${ippBar([['used',poolUsed,'登记已分配'],['det',poolDet,'资料检出未登记'],['free',poolFree,'可用']],poolTotal)}
      ${ippLegend([['used','登记已分配'],['det','资料检出'],['free','可用']])}
      <div class="ipp-kv"><span>应用映射 <b>${apps.length}</b>（${Object.keys(biz).length} 个业态）</span><span>待分配申请 <b>${apps.filter(x=>x.status==='未分配').length}</b></span><span>可回收映射 <b>${recyclable.length}</b></span><span>需备案 <b>${needIcp.length}</b></span></div>
      <div class="ipp-links"><a onclick="selectTab('public')">公网地址池</a><a onclick="selectTab('publicSubnets')">网段管理</a><a onclick="ipGotoTab('互联网IP · 公网IP地址分配')">应用分配表</a><a onclick="ipGotoTab('各地公网IP表')">出口线路</a></div></div></div>`;
  // ---- 第二排：分区 / 城市 ----
  const zoneRows=zones.map(z=>`<tr class="link" onclick="ipGotoZone('${esc(z.zone)}')"><td><b>${esc(z.zone)}</b><small>${z.modules.size} 个业务模块</small></td><td class="num">${z.usedSegs} <small>预留 ${z.resSegs}</small></td><td>${ippBar([['used',z.assigned,'登记已分配'],['det',z.detected,'资料检出'],['free',z.available,'可用']],z.enabled)}</td><td class="num ${z.pct>=70?'ipp-hot':''}">${z.pct}%<small>${ipNum(z.used)} / ${ipNum(z.enabled)}</small></td><td class="num">${ipNum(z.reserved)}<small>${z.resSegs} 段整段预留</small></td></tr>`).join('');
  const zoneBox=`<table class="ipp-table"><thead><tr><th>网络分区</th><th class="num">已启用网段</th><th>启用段使用情况</th><th class="num">使用率</th><th class="num">预留余量</th></tr></thead><tbody>${zoneRows}</tbody></table><p class="ipp-note">使用率＝已用地址 ÷ 已启用网段地址数；整段预留的网段不计入分母。点分区进网段管理页，已按该分区筛好。</p>`;
  const exitsOf=city=>exits.filter(x=>(x._sp.city||'')===city);
  const cityRows=hasOffice
    ?cities.map(c=>`<tr class="link" onclick="selectTab('office')"><td><b>${esc(c.city)}</b><small>${[...c.sites].slice(0,4).join(' / ')}${c.sites.size>4?` 等 ${c.sites.size} 处`:''}</small></td><td><div class="ipp-chips"><span class="ipp-chip wired">有线 ${c.wired}</span><span class="ipp-chip wifi">无线 ${c.wifi}</span></div>${ippBar([['used',c.assigned,'登记已分配'],['det',c.det,'资料检出'],['res',c.dhcp,'DHCP 保留'],['free',c.freeAddr,'可用']],c.cap)}</td><td class="num ${c.pct>=70?'ipp-hot':''}">${c.pct}%<small>${ipNum(c.inUse)} / ${ipNum(c.cap)}</small></td><td class="num ${c.resSegs?'':'ipp-hot'}">${c.resSegs}<small>${c.resSegs?ipNum(c.resAddr)+' 地址':'无余量'}</small></td><td>${exitsOf(c.city).length?exitsOf(c.city).map(x=>`<small>${esc(x._sp.biz||x._sp.cidr)}</small>`).join(''):'<small>—</small>'}</td></tr>`).join('')
    :cities.map(c=>`<tr class="link" onclick="ipGotoTab('各地IP表','${esc(c.city)}')"><td><b>${esc(c.city)}</b><small>${[...c.sites].slice(0,4).join(' / ')}${c.sites.size>4?` 等 ${c.sites.size} 处`:''}</small></td><td><div class="ipp-chips"><span class="ipp-chip wired">有线 ${c.wired}</span><span class="ipp-chip wifi">WiFi ${c.wifi}</span></div><small>约 ${ipNum(c.addr)} 地址</small></td><td class="num">—</td><td class="num ${c.free.length?'':'ipp-hot'}">${c.free.length}<small>${c.free.length?ipNum(c.free.reduce((a,x)=>a+ipCidrSize(x._sp.cidr),0))+' 地址':'无余量'}</small></td><td>${c.exits.length?c.exits.map(x=>`<small>${esc(x._sp.biz||x._sp.cidr)}</small>`).join(''):'<small>—</small>'}</td></tr>`).join('');
  const cityBox=`<table class="ipp-table"><thead><tr><th>城市 / 站点</th><th>在用网段与地址使用</th><th class="num">使用率</th><th class="num">预留网段</th><th>互联网出口</th></tr></thead><tbody>${cityRows}</tbody></table><p class="ipp-note">${hasOffice?'使用率＝在用地址 ÷ 在用网段地址数（预留段不计）；点城市进办公网规划图，按站点、楼层看网段，划拨、回收在图上做。':'来自《万达IP地址规划原则和分配表》；点城市看该城市在用网段明细。'}</p>`;
  // ---- 第三排：余量清单 / 公网 ----
  const resByZone={};for(const s of resSegs)(resByZone[s.zone]??=[]).push(s);
  const resList=Object.entries(resByZone).sort((a,b)=>b[1].length-a[1].length).map(([z,l])=>`<li><b onclick="selectTab('zonemap')">${esc(z)}</b><span>${l.length} 段 · ${ipNum(l.reduce((a,s)=>a+s.total,0))} 地址 · 首段 ${esc(l[0].cidr)}</span></li>`).join('');
  let freeList,freeMore='';
  if(hasOffice){
    // 按 城市 · 站点 · 类型 归并预留段，一行一组，点进办公网规划图
    const grp=new Map();for(const s of free){const k=[s.zone,s.site,s.netType].filter(Boolean).join(' · ');if(!grp.has(k))grp.set(k,[]);grp.get(k).push(s)}
    freeList=[...grp.entries()].sort((a,b)=>b[1].length-a[1].length).map(([k,l])=>`<li><b onclick="selectTab('office')">${esc(k)}</b><span>${l.length} 段 · ${ipNum(l.reduce((a,s)=>a+s.total,0))} 地址 · 首段 ${esc(l.sort((x,y)=>x._r.start-y._r.start)[0].cidr)}</span></li>`).join('');
  }else{
    const freeSorted=free.slice().sort((a,b)=>IP_CITY_ORDER.indexOf(a._sp.city)-IP_CITY_ORDER.indexOf(b._sp.city)),freeShown=freeSorted.slice(0,14);
    freeList=freeShown.map(x=>`<li><b onclick="openRecord(${x.id})">${esc(x._sp.cidr)}</b><span>${esc([x._sp.city,x._sp.pos,x._sp.floor,x._sp.type].filter(Boolean).join(' · '))}</span></li>`).join('');
    if(free.length>freeShown.length)freeMore=`<p class="ipp-note"><a class="ipp-more" onclick="ipGotoTab('各地未分配IP段')">查看全部 ${free.length} 段未分配网段 →</a></p>`;
  }
  const spare=`<h6>数据中心 · 整段预留网段（${resSegs.length} 段，可直接划给新业务）</h6><ul class="ipp-list">${resList||'<li><span>无预留网段</span></li>'}</ul>
    <h6>办公网 · 预留网段（${free.length} 段${hasOffice?'，按站点归并':''}）</h6><ul class="ipp-list ipp-list-2">${freeList||'<li><span>各地均无预留网段</span></li>'}</ul>${freeMore}`;
  const exitList=exits.map(x=>`<li><b onclick="openRecord(${x.id})">${esc(x._sp.cidr)}</b><span>${esc([x._sp.city,x._sp.pos,x._sp.biz].filter(Boolean).join(' · '))}</span></li>`).join('');
  const nat={};for(const x of apps){const k=dv(x,'NAT方向')||'未标';nat[k]=(nat[k]||0)+1}
  const pubBox=`<h6>互联网出口线路（${exits.length} 条）</h6><ul class="ipp-list">${exitList}</ul>
    <h6>公网应用映射 · 按业态（${apps.length} 个）</h6>${devBars(Object.entries(biz).sort((a,b)=>b[1]-a[1]))}
    <p class="ipp-note">NAT 方向：${Object.entries(nat).map(([k,n])=>`${esc(k)} ${n}`).join(' · ')}；已分配公网地址 ${pubAddrs} 个（去重）</p>`;
  // ---- 第四排：规划提醒 ----
  const alerts=[];const push=(cls,b,s)=>alerts.push(`<li class="${cls}"><b>${esc(b)}</b><small>${esc(s)}</small></li>`);
  const hotZones=zones.filter(z=>z.pct>=70);if(hotZones.length)push('bad',`${hotZones.length} 个分区已启用网段使用率超过 70%`,hotZones.map(z=>`${z.zone} ${z.pct}%`).join('；')+'，建议从预留段里提前启用新网段');
  const hotSubs=subs.filter(s=>s.status!=='预留'&&s.total&&ipOcc(s)/s.total>=.8);if(hotSubs.length)push('warn',`${hotSubs.length} 个在用网段地址用掉八成以上`,hotSubs.slice(0,6).map(s=>`${s.cidr}（${s.zone} · ${s.module}，${ipOcc(s)}/${s.total}）`).join('；'));
  const resHit=subs.filter(s=>s.status==='预留'&&s.detected);if(resHit.length)push('bad',`${resHit.length} 个整段预留的网段里已经有设备在用`,'规划与现网不一致：要么在分区规划图里补划给对应业务，要么核实资料是否过期。'+resHit.slice(0,6).map(s=>`${s.cidr}（${s.zone}，${s.detected} 个）`).join('；'));
  const idle=subs.filter(s=>s.status!=='预留'&&ipOcc(s)===0);if(idle.length)push('info',`${idle.length} 个已启用网段还没有任何设备占用`,'状态标"已使用"但资料库里查不到占用，可能是规划了未上线，也可能可以在分区规划图里整段回收为预留：'+idle.slice(0,5).map(s=>s.cidr).join('、'));
  if(d.assigned===0&&d.detected>0)push('warn','IDC 地址表尚无一条"已分配"登记，占用全部来自资料检出',`${ipNum(d.detected)} 个在用地址是从资产、F5、无线等资料里反推出来的；在方格图里点「按检出结果登记」逐段收敛，地址表就成了唯一口径`);
  else if(d.detected>0)push('info',`${ipNum(d.detected)} 个在用地址还停留在"资料检出"，未在地址表登记`,'方格图里每段一键「按检出结果登记」即可收敛');
  const poolLow=pools.filter(p=>p.total>=16&&(p.total-p.used-(p.detected||0)-p.reserved)/p.total<.15);if(poolLow.length)push('warn',`${poolLow.length} 个公网地址池可用不足 15%`,poolLow.map(p=>`${p.module} ${p.cidr}`).join('；'));
  if(poolDet)push('info',`${poolDet} 个公网地址资料里在用、地址池未登记`,'公网地址池页点色块登记，或整池「按检出结果登记」');
  if(hasOffice){
    const noFree=cities.filter(c=>!c.resSegs&&c.wired+c.wifi>0);if(noFree.length)push('warn',`${noFree.map(c=>c.city).join('、')} 没有预留网段`,'新增办公区或无线扩容前需要先在办公网规划图里新增网段');
    const offHot=office.filter(s=>s.total&&ipOcc(s)/s.total>=.8);if(offHot.length)push('warn',`${offHot.length} 个办公网网段地址用掉八成以上`,offHot.slice(0,6).map(s=>`${s.cidr}（${[s.zone,s.site,s.floor].filter(Boolean).join(' ')} · ${s.module}）`).join('；'));
    const offResHit=free.filter(s=>s.detected);if(offResHit.length)push('bad',`${offResHit.length} 个办公网预留段里已经有设备在用`,'在办公网规划图里补划给对应楼层 / 业务，或核实资料：'+offResHit.slice(0,6).map(s=>`${s.cidr}（${s.zone}，${s.detected} 个）`).join('；'));
    if(offSt.det)push('info',`${ipNum(offSt.det)} 个办公网地址资料里在用、地址表未登记`,'办公网规划图里点网段 → 方格图「按检出结果登记」');
  }else{const noFree=cities.filter(c=>!c.free.length&&c.wired+c.wifi>0);if(noFree.length)push('warn',`${noFree.map(c=>c.city).join('、')} 没有未分配网段`,'新增办公区或无线扩容前需要先规划新段')}
  if(recyclable.length)push('info',`${recyclable.length} 条公网映射标记"不保留"，可回收公网地址`,recyclable.slice(0,6).map(x=>dv(x,'应用备注')||dv(x,'应用域名')||x.name).join('、'));
  if(pendingCfg.length)push('warn',`${pendingCfg.length} 条公网映射尚未提前配置`,pendingCfg.slice(0,6).map(x=>`${dv(x,'应用备注')||x.name}（${dv(x,'是否提前配置')}）`).join('；'));
  if(!alerts.length)push('info','地址空间余量充足','数据中心、办公网、互联网三层均无需立即扩容');
  el.innerHTML=`<div class="panel wlan-panel ip-plan"><div class="panel-head"><h3>IP 地址规划总览</h3><span>全集团地址空间分三层：数据中心 ${ipNum(d.total)} 地址 · 办公网 ${office.length} 段${hasOffice?` ${ipNum(officeAddr)} 地址`:''} · 互联网 ${ipNum(poolTotal)} 个公网地址；分配动作在三张规划图上做，点分区 / 城市 / 网段可下钻${ipActionButtons()}</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span4"><h4>地址空间全景<em>三层各有多少、用了多少、还剩多少</em></h4><div class="wlan-scroll">${domains}</div></section>
    <section class="wlan-box span4"><h4>规划提醒<em>按地址表与资料自动比对，${alerts.length} 项</em></h4><div class="wlan-scroll"><ul class="wlan-alerts ipp-alerts">${alerts.join('')}</ul></div></section>
    <section class="wlan-box span2"><h4>数据中心分区规划<em>${zones.length} 个网络分区 · ${subs.length} 个网段</em></h4><div class="wlan-scroll">${zoneBox}</div></section>
    <section class="wlan-box span2"><h4>各地办公网规划<em>${cities.length} 个城市 · ${office.length} 个在用网段</em></h4><div class="wlan-scroll">${cityBox}</div></section>
    <section class="wlan-box span2"><h4>可规划余量<em>新业务、新办公区先从这里挑</em></h4><div class="wlan-scroll">${spare}</div></section>
    <section class="wlan-box span2"><h4>互联网出口与公网<em>出口线路、对外发布的应用</em></h4><div class="wlan-scroll">${pubBox}</div></section>
  </div></div>`;
}

// ===================== IP 地址 · 分区规划图 =====================
// 规划口径：一个大 B 段（/16）→ 按网络分区切成若干 /24 → 分区内再按子模块 / 业务分配，剩下的整段预留。
// 图上一格 = 一个 /24，颜色 = 网络分区，条纹 = 整段预留，空白 = /16 里还没纳入规划的段。
// 分配动作（划给业务 / 回收 / 逐 IP 登记）都从这张图点进去做，地址表就是唯一台账。
const ZM_PALETTE=['#147d75','#2b5ea7','#c98a1d','#8e44ad','#c0392b','#16a085','#d35400','#5d6d7e'];
let zmState={subs:[],zones:[],color:{}};
const ipToNum=ip=>ip.split('.').reduce((s,v)=>s*256+Number(v),0)>>>0;
const numToIp=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
function zmZoneColor(zone){return zmState.color[zone]||'#7f8c8d'}
function zmCidrRange(s){const start=s.networkStart??ipToNum(s.cidr.split('/')[0]);const size=2**(32-(s.prefix??Number(s.cidr.split('/')[1])));return {start,end:start+size-1,size}}
// 连续的预留 /24 合并成一段，方便一次划出「N 个连续网段」
function zmReservedRuns(list){const res=list.filter(s=>s.status==='预留').sort((a,b)=>a._r.start-b._r.start);const runs=[];let cur=null;
  for(const s of res){if(cur&&cur.end+1===s._r.start){cur.end=s._r.end;cur.items.push(s)}else runs.push(cur={start:s._r.start,end:s._r.end,items:[s]})}
  return runs.sort((a,b)=>b.items.length-a.items.length)}
function zmTip(s){const occ=ipOcc(s);return [s.cidr,`${s.zone} · ${s.module}`,s.status,s.status==='预留'?(s.detected?`预留段内已检出 ${s.detected} 个地址在用`:'整段预留，可划给新业务'):`在用 ${occ}/${s.total}（登记 ${s.used} · 检出 ${s.detected||0}）`,s.owner?`负责人 ${s.owner}`:'',s.vlanId?`VLAN ${s.vlanId}`:''].filter(Boolean).join('\n')}
async function renderZoneMapPanel(){
  const el=$('#assetSummary');if(!el)return;
  el.innerHTML='<div class="panel wlan-panel zone-map"><div class="panel-head"><h3>数据中心分区规划图</h3><span>正在读取网段表…</span></div></div>';
  const subs=await api('/api/subnets');
  if(typeof curTab!=='undefined'&&curTab&&curTab.render!==renderZoneMapPanel)return;
  for(const s of subs)s._r=zmCidrRange(s);
  const zones=[...new Set(subs.map(s=>s.zone))];const color={};zones.forEach((z,i)=>color[z]=ZM_PALETTE[i%ZM_PALETTE.length]);
  zmState={subs,zones,color};
  // 按 /16 分块（IDC 目前只有 10.199.0.0/16，留着通用逻辑以便将来加 B 段）
  const blocks=new Map();for(const s of subs){const k=(s._r.start>>>16);if(!blocks.has(k))blocks.set(k,[]);blocks.get(k).push(s)}
  const canEdit=me&&me.role!=='只读用户';
  const blockHtml=[...blocks.entries()].sort((a,b)=>a[0]-b[0]).map(([k,list])=>{
    const base=k<<16>>>0;const cells=[];
    // 只零星用了几段的 B 段（如设备互联用的 10.208）不铺 256 格，只列已规划的
    const compact=list.length<32;
    for(let i=0;i<256;i++){const lo=(base+i*256)>>>0,hi=lo+255;const hit=list.filter(s=>s._r.start<=hi&&s._r.end>=lo);
      if(!hit.length){if(!compact)cells.push(`<i class="zm-cell zm-empty" title="${numToIp(lo)}/24 · 尚未纳入规划${canEdit?'，点击新增网段':''}" ${canEdit?`onclick="zmNewSubnet('${numToIp(lo)}/24')"`:''}>${i}</i>`);continue}
      const s=hit[0];const allRes=hit.every(x=>x.status==='预留'),off=hit.every(x=>x.status==='停用');const multi=hit.length>1||s._r.size<256;
      const occ=ipOcc(s),pct=s.total?occ/s.total:0;
      cells.push(`<i class="zm-cell${allRes?' zm-res':''}${off?' zm-off':''}${multi?' zm-multi':''}${!allRes&&pct>=.8?' zm-hot':''}${s.status==='预留'&&s.detected?' zm-warn':''}" style="--zc:${zmZoneColor(s.zone)}" title="${esc(hit.map(zmTip).join('\n——\n'))}" onclick="subnetActions(${s.id})">${i}${multi?`<small>${hit.length}</small>`:''}</i>`)}
    const used=list.filter(s=>s.status!=='预留').length,res=list.length-used,empty=256-new Set(list.flatMap(s=>{const a=[];for(let x=s._r.start>>>8;x<=s._r.end>>>8;x++)a.push(x&255);return a})).size;
    return `<div class="zm-block"><div class="zm-block-head"><b>${numToIp(base)}/16</b><span>共 256 个 /24：在用 <b>${used}</b> · 整段预留 <b>${res}</b> · 未规划 <b>${empty}</b>${compact?'（只列已规划的段）':''}</span></div><div class="zm-grid${compact?' zm-compact':''}">${cells.join('')}</div></div>`}).join('');
  const legend=`<div class="zm-legend">${zones.map(z=>`<span onclick="ipGotoZone('${esc(z)}')"><i style="background:${zmZoneColor(z)}"></i>${esc(z)}</span>`).join('')}<span><i class="zm-sw zm-res"></i>整段预留</span><span><i class="zm-sw zm-warn"></i>预留段内已有设备</span><span><i class="zm-sw zm-hot"></i>用量 ≥80%</span><span><i class="zm-sw zm-empty"></i>未规划</span></div>`;
  // 分区卡：模块 → 网段 chips，预留连续段可一键划拨
  const zoneCards=zones.map(z=>{const list=subs.filter(s=>s.zone===z).sort((a,b)=>a._r.start-b._r.start);const used=list.filter(s=>s.status!=='预留'),res=list.filter(s=>s.status==='预留');
    const tot=list.reduce((a,s)=>a+s.total,0),assigned=list.reduce((a,s)=>a+s.used,0),det=list.reduce((a,s)=>a+(s.detected||0),0),resAddr=res.reduce((a,s)=>a+s.total,0),free=tot-assigned-det-resAddr;
    const mods=new Map();for(const s of used){const k=s.module||'未命名';if(!mods.has(k))mods.set(k,[]);mods.get(k).push(s)}
    const modRows=[...mods.entries()].sort((a,b)=>b[1].length-a[1].length).map(([m,l])=>{const o=l.reduce((a,s)=>a+ipOcc(s),0),t=l.reduce((a,s)=>a+s.total,0);
      return `<div class="zm-mod"><b title="${esc(m)}">${esc(m)}</b><span class="zm-chips">${l.map(s=>`<a class="zm-chip${ipOcc(s)/s.total>=.8?' hot':''}" title="${esc(zmTip(s))}" onclick="subnetActions(${s.id})">${esc(s.cidr.replace(/\/24$/,''))}<em>${s.total?Math.round(ipOcc(s)/s.total*100):0}%</em></a>`).join('')}</span><small>${l.length} 段 · ${ipNum(o)}/${ipNum(t)}</small></div>`}).join('')||'<p class="wlan-empty">还没有业务网段。</p>';
    const runs=zmReservedRuns(list);
    const runRows=runs.map(r=>`<li><b onclick="subnetActions(${r.items[0].id})">${numToIp(r.start)}${r.items.length>1?` – ${numToIp(r.end-255)}`:''}<em>/24 × ${r.items.length}</em></b><span>${ipNum(r.items.reduce((a,s)=>a+s.total,0))} 地址${r.items.some(s=>s.detected)?` · <i class="zm-flag">${r.items.filter(s=>s.detected).length} 段已有设备</i>`:''}</span>${canEdit?`<button type="button" class="secondary" onclick="allocateRunForm('${esc(z)}',[${r.items.map(s=>s.id).join(',')}])">划给业务</button>`:''}</li>`).join('');
    return `<section class="wlan-box zm-zone" style="--zc:${zmZoneColor(z)}"><h4><i class="zm-dot"></i>${esc(z)}<em>${list.length} 段 · 在用 ${used.length} · 预留 ${res.length}</em></h4><div class="wlan-scroll">
      ${ippBar([['used',assigned,'登记已分配'],['det',det,'资料检出占用'],['free',free,'启用段可用'],['res',resAddr,'整段预留']],tot)}
      <div class="ipp-kv"><span>地址 <b>${ipNum(tot)}</b></span><span>在用 <b>${ipNum(assigned+det)}</b></span><span>启用段余量 <b>${ipNum(free)}</b></span><span>预留余量 <b>${ipNum(resAddr)}</b></span></div>
      <h6>业务模块（${mods.size}）</h6>${modRows}
      <h6>预留连续段（${runs.length}）<small>新业务从这里划</small></h6><ul class="ipp-list zm-runs">${runRows||'<li><span>本分区已无整段预留</span></li>'}</ul></div></section>`}).join('');
  const totalRes=subs.filter(s=>s.status==='预留'),warn=totalRes.filter(s=>s.detected);
  el.innerHTML=`<div class="panel wlan-panel zone-map"><div class="panel-head"><h3>数据中心分区规划图 · 燕郊光子机房</h3><span>${zones.length} 个网络分区 · ${subs.length} 个网段 · 整段预留 ${totalRes.length} 段${warn.length?` · <b class="zm-flag">${warn.length} 个预留段里已经有设备在用</b>`:''}；点格子或网段看详情、划拨、回收${ipActionButtons(`<button type="button" class="secondary zm-btn" onclick="selectTab('subnets')">网段列表</button>${canEdit?`<button type="button" class="secondary zm-btn" onclick="subnetForm(null,{kind:'idc'})">新增网段</button>`:''}`)}</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span4 zm-map-box"><h4>B 段全景<em>一格一个 /24，颜色按网络分区；点格子操作</em></h4><div class="wlan-scroll">${blockHtml}${legend}</div></section>
    ${zoneCards}
  </div></div>`;
}
function zmNewSubnet(cidr){subnetForm(null,{cidr,kind:'idc'})}
// 每张规划图右上角都带的两个动作入口：分配 IP（向导）、查 IP
function ipActionButtons(extra){const canEdit=typeof me!=='undefined'&&me&&me.role!=='只读用户';return `<span class="ip-actbar">${extra||''}${canEdit?'<button type="button" class="zm-btn" onclick="allocateWizard()">分配 IP</button>':''}<button type="button" class="secondary zm-btn" onclick="ipLookupPrompt()">查 IP</button></span>`}

// ===================== IP 地址 · 办公网规划图 =====================
// 办公网的规划口径：城市 → 位置（楼宇 / 园区）→ 楼层 → 网段，网络类型分有线 / 无线。
// 一个站点一张卡，网段按楼层排成行；预留段（原 Excel「未分配网段」）列在卡底部，连续的可一次划出 N 段。
const OF_TYPE_COLOR={'有线':'#2b5ea7','无线':'#16a085'};
function ofTypeColor(t){return OF_TYPE_COLOR[t]||'#7f8c8d'}
// 楼层排序：B3 < B2 < B1 < 1层 < 2层 … < 任意楼层 < 未标
function ofFloorKey(f){if(!f)return 9999;if(/任意/.test(f))return 9000;const b=f.match(/^B(\d+)/i);if(b)return -Number(b[1]);const n=f.match(/(\d+)/);return n?Number(n[1]):8000}
function ofTip(s){const occ=ipOcc(s);return [s.cidr,[s.zone,s.site,s.floor,s.netType].filter(Boolean).join(' · '),s.module,s.status==='预留'?(s.detected?`预留段内已检出 ${s.detected} 个地址在用`:'整段预留，可划给新业务'):`在用 ${occ}/${s.total}（登记 ${s.used} · 检出 ${s.detected||0} · DHCP/预留 ${s.reserved}）`,s.gateway?`网关 ${s.gateway}`:'',s.mgmtDevice?`管理设备 ${s.mgmtDevice}`:'',s.remarks||''].filter(Boolean).join('\n')}
function ofSiteStats(list){const used=list.filter(s=>s.status!=='预留'),res=list.filter(s=>s.status==='预留');const tot=list.reduce((a,s)=>a+s.total,0),assigned=list.reduce((a,s)=>a+s.used,0),det=list.reduce((a,s)=>a+(s.detected||0),0),resAddr=res.reduce((a,s)=>a+s.total,0),dhcp=used.reduce((a,s)=>a+Math.max(0,s.reserved-2),0),free=Math.max(0,tot-assigned-det-resAddr-dhcp-used.length*2);return {used,res,tot,assigned,det,resAddr,dhcp,free,wired:used.filter(s=>s.netType==='有线').length,wifi:used.filter(s=>s.netType==='无线').length}}
async function renderOfficeMapPanel(){
  const el=$('#assetSummary');if(!el)return;
  el.innerHTML='<div class="panel wlan-panel office-map"><div class="panel-head"><h3>各地办公网规划图</h3><span>正在读取办公网网段…</span></div></div>';
  const subs=await api('/api/subnets?kind=office');
  if(typeof curTab!=='undefined'&&curTab&&curTab.render!==renderOfficeMapPanel)return;
  for(const s of subs)s._r=zmCidrRange(s);
  const canEdit=typeof me!=='undefined'&&me&&me.role!=='只读用户';
  const cities=[...new Set(subs.map(s=>s.zone))].sort((a,b)=>{const ia=IP_CITY_ORDER.indexOf(a),ib=IP_CITY_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b,'zh')});
  const siteKey=s=>`${s.zone}|${s.site||'未标位置'}`;
  const sites=new Map();for(const c of cities)for(const s of subs.filter(x=>x.zone===c)){const k=siteKey(s);if(!sites.has(k))sites.set(k,[]);sites.get(k).push(s)}
  // 城市汇总表
  const cityRows=cities.map(c=>{const list=subs.filter(s=>s.zone===c),st=ofSiteStats(list),siteNames=[...new Set(list.map(s=>s.site).filter(Boolean))];const runs=zmReservedRuns(list);const inUse=st.assigned+st.det;const cap=st.tot-st.resAddr;
    return `<tr class="link" title="进办公网段管理表，按 ${esc(c)} 筛好" onclick="ipGotoZone('${esc(c)}','office')"><td><b>${esc(c)}</b><small>${esc(siteNames.join(' / '))||'—'}</small></td><td><div class="ipp-chips"><span class="ipp-chip wired">有线 ${st.wired}</span><span class="ipp-chip wifi">无线 ${st.wifi}</span></div><small>${ipNum(cap)} 地址容量</small></td><td>${ippBar([['used',st.assigned,'登记已分配'],['det',st.det,'资料检出'],['res',st.dhcp,'DHCP / 预留地址'],['free',st.free,'可用']],cap)}<small>在用 ${ipNum(inUse)} · 可用 ${ipNum(st.free)}</small></td><td class="num ${st.res.length?'':'ipp-hot'}">${st.res.length}<small>${st.res.length?ipNum(st.resAddr)+' 地址':'无余量'}</small></td><td class="num">${runs.length?`${runs[0].items.length} 段<small>${numToIp(runs[0].start)} 起</small>`:'—'}</td></tr>`}).join('');
  const cityBox=`<table class="ipp-table"><thead><tr><th>城市 / 站点</th><th>在用网段</th><th>地址使用情况（不含预留段）</th><th class="num">预留网段</th><th class="num">最大连续预留</th></tr></thead><tbody>${cityRows}</tbody></table><p class="ipp-note">点城市进「办公网段管理」表，按该城市筛好，逐段看 IP 明细、编辑、划拨。</p>`;
  const legend=`<div class="zm-legend"><span><i style="background:${OF_TYPE_COLOR['有线']}"></i>有线</span><span><i style="background:${OF_TYPE_COLOR['无线']}"></i>无线</span><span><i class="zm-sw zm-res"></i>预留（可划给新楼层 / 新业务）</span><span><i class="zm-sw zm-warn"></i>预留段内已有设备</span><span><i class="zm-sw zm-hot"></i>用量 ≥80%</span></div>`;
  // 站点卡
  const siteCards=[...sites.entries()].map(([k,list])=>{const [city,site]=k.split('|');const st=ofSiteStats(list);list.sort((a,b)=>a._r.start-b._r.start);
    const floors=new Map();for(const s of st.used){const f=s.floor||'未标楼层';if(!floors.has(f))floors.set(f,[]);floors.get(f).push(s)}
    const floorRows=[...floors.entries()].sort((a,b)=>ofFloorKey(a[0])-ofFloorKey(b[0])).map(([f,l])=>`<div class="of-floor"><b title="${esc(f)}">${esc(f)}</b><span class="zm-chips">${l.map(s=>{const pct=s.total?ipOcc(s)/s.total:0;return `<a class="zm-chip of-chip${pct>=.8?' hot':''}" style="--zc:${ofTypeColor(s.netType)}" title="${esc(ofTip(s))}" onclick="subnetActions(${s.id})"><i></i>${esc(s.cidr)}<u>${esc(s.module)}</u><em>${Math.round(pct*100)}%</em></a>`}).join('')}</span></div>`).join('')||'<p class="wlan-empty">还没有在用网段。</p>';
    const runs=zmReservedRuns(list);
    const runRows=runs.map(r=>{const f=[...new Set(r.items.map(s=>s.floor).filter(Boolean))].join(' / '),t=[...new Set(r.items.map(s=>s.netType).filter(Boolean))].join(' / ');return `<li><b onclick="subnetActions(${r.items[0].id})">${r.items[0].cidr}${r.items.length>1?` – ${r.items[r.items.length-1].cidr.split('/')[0]}`:''}<em>× ${r.items.length}</em></b><span>${esc([f,t].filter(Boolean).join(' · ')||'未指定楼层')} · ${ipNum(r.items.reduce((a,s)=>a+s.total,0))} 地址${r.items.some(s=>s.detected)?` · <i class="zm-flag">${r.items.filter(s=>s.detected).length} 段已有设备</i>`:''}</span>${canEdit?`<button type="button" class="secondary" onclick="allocateRunForm('${esc(city+' '+site)}',[${r.items.map(s=>s.id).join(',')}])">划给业务</button>`:''}</li>`}).join('');
    const cap=st.tot-st.resAddr;
    return `<section class="wlan-box zm-zone of-site" style="--zc:${ofTypeColor(st.wired>=st.wifi?'有线':'无线')}"><h4><i class="zm-dot"></i>${esc(city)} · ${esc(site)}<em>${list.length} 段 · 在用 ${st.used.length}（有线 ${st.wired} / 无线 ${st.wifi}）· 预留 ${st.res.length}</em></h4><div class="wlan-scroll">
      ${ippBar([['used',st.assigned,'登记已分配'],['det',st.det,'资料检出占用'],['res',st.dhcp,'DHCP / 预留地址'],['free',st.free,'可用']],cap)}
      <div class="ipp-kv"><span>在用段容量 <b>${ipNum(cap)}</b></span><span>在用 <b>${ipNum(st.assigned+st.det)}</b></span><span>可用 <b>${ipNum(st.free)}</b></span><span>预留段余量 <b>${ipNum(st.resAddr)}</b></span></div>
      <h6>按楼层（${floors.size}）</h6>${floorRows}
      <h6>预留网段（${st.res.length}）<small>新楼层、无线扩容从这里划</small></h6><ul class="ipp-list zm-runs">${runRows||'<li><span>本站点已无预留网段</span></li>'}</ul></div></section>`}).join('');
  const res=subs.filter(s=>s.status==='预留'),warn=res.filter(s=>s.detected);
  el.innerHTML=`<div class="panel wlan-panel zone-map office-map"><div class="panel-head"><h3>各地办公网规划图 · 北京总部与分支</h3><span>${cities.length} 个城市 · ${sites.size} 个站点 · ${subs.length} 个网段 · 预留 ${res.length} 段${warn.length?` · <b class="zm-flag">${warn.length} 个预留段里已经有设备在用</b>`:''}；网段按站点、楼层排列，点网段看详情、划拨、回收${ipActionButtons(`<button type="button" class="secondary zm-btn" onclick="selectTab('officeSubnets')">网段列表</button>${canEdit?`<button type="button" class="secondary zm-btn" onclick="subnetForm(null,{kind:'office'})">新增网段</button>`:''}`)}</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span4"><h4>各城市办公网<em>在用网段、地址余量、还有多少预留段可划</em></h4><div class="wlan-scroll">${cityBox}${legend}</div></section>
    ${siteCards||'<section class="wlan-box span4"><p class="wlan-empty">办公网网段尚未导入。</p></section>'}
  </div></div>`;
}

// ===================== IP 地址 · 公网地址池 =====================
// 一个池 = 一段运营商给的公网地址；池里每个地址登记「给谁用 → 映射到哪个内网真实地址 → 哪个业态 / 负责人」。
const PP_BIZ_PALETTE=['#147d75','#2b5ea7','#c98a1d','#8e44ad','#c0392b','#16a085','#d35400','#2c3e50','#7f8c8d'];
let ppState={pools:[],maps:{},bizColor:{}};
function ppBizOf(a){return (a.business||'').split(' · ')[0]||(a.deviceType==='网关'||a.deviceType==='基础设施'||a.deviceType==='出口接口'?'基础设施':'未标业态')}
function ppKind(a){if(a.remarks==='网络地址'||a.remarks==='广播地址')return 'edge';if(a.status==='已分配')return 'used';if(a.refs&&a.refs.length)return 'ref';if(a.status==='禁用')return 'blocked';if(a.status==='预留')return 'reserved';return 'free'}
function ppTip(a){const k=ppKind(a);return [a.ip,k==='used'?`${a.hostname||'已分配'}${a.business?'（'+a.business+'）':''}`:IP_KINDS[k],a.domain,a.realIp?`→ ${a.realIp}${a.natDir?' · '+a.natDir:''}`:'',a.owner?`负责人 ${a.owner}`:'',(a.refs||[]).map(r=>`资料：${r.name}`).join('；'),a.remarks].filter(Boolean).join('\n')}
async function renderPublicPoolPanel(rows){
  const el=$('#assetSummary');if(!el)return;
  el.innerHTML='<div class="panel wlan-panel pub-pool"><div class="panel-head"><h3>公网地址池</h3><span>正在读取地址池…</span></div></div>';
  const pools=await api('/api/subnets?kind=public');
  const maps=Object.fromEntries(await Promise.all(pools.map(async p=>[p.id,await api(`/api/subnets/${p.id}/map`)])));
  if(typeof curTab!=='undefined'&&curTab&&curTab.render!==renderPublicPoolPanel)return;
  const all=pools.flatMap(p=>maps[p.id].addresses.map(a=>({...a,_pool:p})));
  const used=all.filter(a=>a.status==='已分配'),free=all.filter(a=>ppKind(a)==='free'),ref=all.filter(a=>ppKind(a)==='ref');
  const biz={};for(const a of used){const k=ppBizOf(a);biz[k]=(biz[k]||0)+1}
  const bizList=Object.entries(biz).sort((a,b)=>b[1]-a[1]);const bizColor={};bizList.forEach(([k],i)=>bizColor[k]=PP_BIZ_PALETTE[i%PP_BIZ_PALETTE.length]);
  ppState={pools,maps,bizColor};
  const canEdit=me&&me.role!=='只读用户';
  const pending=(rows||[]).filter(x=>(x.subcategory||'')==='互联网IP · 公网IP地址分配'&&x.status==='未分配');
  const recyclable=used.filter(a=>/不保留/.test(a.remarks||''));
  const dv=(x,k)=>String(x.details?.[k]??'').trim();
  const poolCards=pools.map(p=>{const m=maps[p.id];const list=m.addresses;const u=list.filter(a=>a.status==='已分配').length,f=list.filter(a=>ppKind(a)==='free'),r=list.filter(a=>ppKind(a)==='ref').length;
    const cells=list.map(a=>{const k=ppKind(a);const c=k==='used'?bizColor[ppBizOf(a)]:'';return `<i class="pp-cell k-${k}" ${c?`style="--bc:${c}"`:''} title="${esc(ppTip(a))}" onclick='publicAddressForm(${JSON.stringify({...a,refs:undefined}).replaceAll("'","&#39;")},${p.id})'>${a.ip.split('.').pop()}</i>`}).join('');
    const rowsHtml=list.filter(a=>a.status==='已分配').map(a=>`<tr><td><b>${a.ip}</b></td><td><i class="pp-sw" style="background:${bizColor[ppBizOf(a)]||'#999'}"></i>${esc(a.hostname)||'-'}<small>${esc(a.business)||''}</small></td><td class="pp-dom">${esc(a.domain)||'-'}</td><td>${esc(a.natDir)||'-'}</td><td class="mono">${esc(a.realIp)||'-'}</td><td>${esc(a.owner)||'-'}</td><td><small>${esc(a.remarks)||''}</small></td>${canEdit?`<td><div class="actions"><button type="button" class="secondary" onclick='publicAddressForm(${JSON.stringify({...a,refs:undefined}).replaceAll("'","&#39;")},${p.id})'>编辑</button><button type="button" class="danger" onclick="publicRelease(${a.id},'${a.ip}',${p.id})">回收</button></div></td>`:''}</tr>`).join('');
    return `<section class="wlan-box span4 pp-pool"><h4>${esc(p.module)}<em>${esc(p.cidr)} · 网关 ${esc(p.gateway)||'未登记'} · ${esc(p.remarks)||''}</em>${canEdit&&f.length?`<button type="button" class="pp-add" onclick="publicAddressForm(null,${p.id})">新增映射</button>`:''}</h4><div class="wlan-scroll">
      <div class="pp-stats">${spStats([['地址总数',m.size,esc(p.cidr)],['已分配',u,`${Math.round(u/m.size*100)}%`],['可用',f.length,f.length?`下一个 ${f[0].ip}`:'已用尽'],['资料检出未登记',r,r?'资料里有、地址表没登记':'—']])}</div>
      <div class="pp-strip">${cells}</div>
      ${rowsHtml?`<div class="pp-table-wrap"><table class="ipp-table pp-table"><thead><tr><th>公网地址</th><th>应用 / 业态</th><th>域名</th><th>NAT</th><th>实IP</th><th>负责人</th><th>备注</th>${canEdit?'<th>操作</th>':''}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`:'<p class="wlan-empty">本池还没有登记任何映射。</p>'}</div></section>`}).join('');
  const pendingRows=pending.slice(0,40).map(x=>`<li><b onclick="openRecord(${x.id})">${esc(dv(x,'应用备注')||x.name)}</b><span>${esc([dv(x,'所属业态'),dv(x,'NAT方向'),dv(x,'实IP').replace(/\n/g,' / '),dv(x,'项目经理')].filter(Boolean).join(' · '))}</span>${canEdit?`<button type="button" class="secondary" onclick="publicAssignRequest(${x.id})">分配地址</button>`:''}</li>`).join('');
  el.innerHTML=`<div class="panel wlan-panel pub-pool"><div class="panel-head"><h3>公网地址池 · 出口与映射</h3><span>${pools.length} 个地址池 · ${all.length} 个公网地址 · 已分配 ${used.length} · 可用 ${free.length}${ref.length?` · <b class="zm-flag">${ref.length} 个资料里在用但没登记</b>`:''}；点色块登记 / 回收，Excel 不再维护${ipActionButtons(`<button type="button" class="secondary zm-btn" onclick="selectTab('publicSubnets')">网段列表</button>${canEdit?`<button type="button" class="secondary zm-btn" onclick="subnetForm(null,{kind:'public'})">新增地址池</button>`:''}`)}</span></div>
  <div class="wlan-grid">
    <section class="wlan-box span2"><h4>按业态<em>已分配 ${used.length} 个公网地址</em></h4><div class="wlan-scroll">${devBars(bizList)}<div class="ipp-legend">${bizList.map(([k])=>`<span><i class="ipp-sw" style="background:${bizColor[k]}"></i>${esc(k)}</span>`).join('')}<span><i class="ipp-sw k-ref"></i>资料检出</span><span><i class="ipp-sw k-free"></i>可用</span><span><i class="ipp-sw k-edge"></i>网络/广播</span></div></div></section>
    <section class="wlan-box span2"><h4>待分配申请<em>《互联网IP地址分配表》里还没给公网地址的 ${pending.length} 项</em></h4><div class="wlan-scroll"><ul class="ipp-list pp-pending">${pendingRows||'<li><span>没有待分配的申请</span></li>'}</ul>${recyclable.length?`<p class="ipp-note">另有 <b>${recyclable.length}</b> 个地址标记"不保留"，可回收：${recyclable.slice(0,8).map(a=>a.ip).join('、')}</p>`:''}</div></section>
    ${poolCards}
  </div></div>`;
}
