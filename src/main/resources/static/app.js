// 平台壳：登录、导航、api/modal/toast、总览、IDC 网段方格图、智能问答、账号。
// 业务模块的注册表与分派在 modules.js，各域面板在 views.js，ping / 网段计算在 tools.js，意见收集 / 审计日志在 collab.js。
// 本文件最后加载（index.html 顺序：ipaddr → tools → views → modules → collab → app），顶层代码会生成导航并调 init()。
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// subnets 是「网段管理」页当前显示的列表，subnetKind 说明它属于哪个地址空间（idc / office / public）；subnetCounts 记各空间无筛选时的段数给页签角标；
// subnetLists 是三个空间无筛选的完整列表缓存，IP 模块顶部的概览卡直接按它算（与规划图同一口径），不再数 Excel 底稿
let me=null, subnets=[], subnetKind='idc', subnetCounts={}, subnetLists={};
async function api(url,opt={}){const r=await fetch(url,{headers:{...(opt.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opt.headers||{})},...opt});if(r.status===401){showLogin();throw new Error('登录已失效');}const data=r.headers.get('content-type')?.includes('json')?await r.json():null;if(!r.ok)throw new Error(data?.message||(r.status===403?'没有权限':`请求失败 (${r.status})`));return data}
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showLogin(){$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}
// 免登录模式（NetOps:RequireLogin=false）下 /api/me 直接给管理员身份，登录页不会出现，
// 退出登录和改密码也就没意义了，一并藏掉，用户名那栏标一下当前是免登录
async function init(){try{me=await api('/api/me');const open=me.requireLogin===false;$('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#userName').textContent=open?'免登录模式':me.username;$('#userName').title=open?'appsettings.json 里 NetOps:RequireLogin 改回 true 可恢复登录':'点击修改密码';$('#userRole').textContent=open?'测试用，所有人都是管理员':me.role;$('#logout').classList.toggle('hidden',open);$('#usersNav').classList.toggle('hidden',me.role!=='管理员');$('#auditNav').classList.toggle('hidden',me.role==='只读用户');if(me.role==='只读用户'){$('#newSubnet').classList.add('hidden');$('#importBtn').classList.add('hidden')}if(me.role!=='管理员')$('#importBtn').classList.add('hidden');await dashboard();setSubnetsPage(subnetKind);loadSubnets();loadSubnetCounts();if(me.mustChangePassword&&!open)passwordDialog(true)}catch{showLogin()}}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{me=await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});$('#loginError').textContent='';await init()}catch{$('#loginError').textContent='用户名或密码错误'}});
$('#logout').onclick=async()=>{await api('/api/logout',{method:'POST'});showLogin()};
// 收起后使用统一线性图标，避免用“总、问、资”等单字挤满窄边栏。
const NAV_ICON_PATHS={
  '总':'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  '问':'<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.2-2.5 4"/><path d="M12 18h.01"/>',
  '资':'<path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3M8 12h8M8 16h5"/>',
  '线':'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3"/>',
  '负':'<rect x="8" y="3" width="8" height="5" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M12 8v4M6.5 16v-4h11v4"/>',
  '无':'<path d="M4.5 10a11 11 0 0 1 15 0M7.5 13.5a6.5 6.5 0 0 1 9 0M10.5 17a2.3 2.3 0 0 1 3 0"/><circle cx="12" cy="20" r=".7" fill="currentColor" stroke="none"/>',
  'IP':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  '配':'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 13h6M9 17h6"/>',
  '拓':'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M7 5h10M6 7l5 10M18 7l-5 10"/>',
  '架':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h8"/><circle cx="16" cy="7" r=".7" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r=".7" fill="currentColor" stroke="none"/>',
  '点':'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  '单':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  '周':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2"/>',
  '综':'<path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  '工':'<path d="M14.5 6.5a4 4 0 0 0-5-5l2 2-3 3-2-2a4 4 0 0 0 5 5L20 18l-2 2-8.5-8.5"/>',
  '监':'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 11h2l2-3 2 6 2-3h2"/>',
  '流':'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  '号':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  '变':'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  '审':'<path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="M9 3v3h6V3M8.5 13l2.5 2.5L16 10"/>',
  '意':'<path d="M21 12a8 8 0 0 1-8 8H8l-4 3V12a8 8 0 0 1 8-8h1a8 8 0 0 1 8 8z"/><path d="M8.5 11h7M8.5 14.5h4"/>'
};
const navSvg=path=>`<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
// 业务模块的导航按钮由 modules.js 的注册表生成，插在「工具」分组之前；总览、问答、工具、系统几个固定项写在 index.html
$('#navToolsGroup').insertAdjacentHTML('beforebegin',MODULES.map(m=>`<button data-page="resources" data-module="${esc(m.id)}" data-abbr="${esc(m.abbr)}" data-title="${esc(m.title)}" data-desc="${esc(m.desc)}">${esc(m.title)}</button>`).join(''));
for(const b of $$('nav button[data-abbr]')){const label=b.textContent.trim();b.title=label;b.setAttribute('aria-label',label);b.innerHTML=`${navSvg(NAV_ICON_PATHS[b.dataset.abbr]||NAV_ICON_PATHS['综'])}<span class="nav-label">${esc(label)}</span>`}
function setNavCollapsed(on){$('#app').classList.toggle('nav-collapsed',on);const t=$('#navToggle'),label=on?'展开侧边栏':'收起侧边栏';t.innerHTML=navSvg(on?'<path d="m9 18 6-6-6-6"/>':'<path d="m15 18-6-6 6-6"/>');t.title=label;t.setAttribute('aria-label',label);try{localStorage.setItem('navCollapsed',on?'1':'')}catch{}}
$('#navToggle').onclick=()=>setNavCollapsed(!$('#app').classList.contains('nav-collapsed'));
try{setNavCollapsed(localStorage.getItem('navCollapsed')==='1')}catch{setNavCollapsed(false)}
$$('nav button').forEach(b=>b.onclick=async()=>{const page=b.dataset.page;$$('nav button').forEach(x=>x.classList.toggle('active',x===b));$$('.page').forEach(x=>x.classList.add('hidden'));$(`#${page}Page`).classList.remove('hidden');$('.header-actions').classList.toggle('hidden',page==='feedback');$('#pageTitle').textContent=b.dataset.title||b.textContent;$('#pageDesc').textContent=b.dataset.desc||'';if(page==='dashboard')await dashboard();if(page==='ask'){await askInit();$('#askBox').focus()}if(page==='resources')await loadModule(b.dataset.module);if(page==='tools')await toolsInit();if(page==='audit')await loadAudit();if(page==='feedback')await loadFeedback();if(page==='users')await loadUsers();if(page==='planned')$('#plannedTitle').textContent=b.dataset.module});
async function dashboard(){const [d,r]=await Promise.all([api('/api/dashboard'),api('/api/resources/stats')]);const items=[['地理位置',2,'北京总部 / 燕郊光子机房'],['管理网段',d.subnets,'条'],['已导入资料',r.total,'条'],['已占用地址',d.used,`使用率 ${(d.utilization*100).toFixed(1)}% · 登记 ${d.assigned.toLocaleString()} + 资料检出 ${d.detected.toLocaleString()}`]];$('#stats').innerHTML=items.map(x=>`<div class="stat"><small>${x[0]}</small><b>${x[1].toLocaleString()}</b><em>${x[2]}</em></div>`).join('');const totals={};for(const x of r.rows)totals[x.category]=(totals[x.category]||0)+x.count;
  // 模块卡按注册表生成：一张卡一个业务模块，条数是该模块下几个分类之和，副标题列出来源分类
  const cards=MODULES.map(m=>{const n=m.categories.reduce((a,c)=>a+(totals[c]||0),0);return `<div class="module-card ready" onclick="navModule('${m.id}')"><span>已接入</span><h3>${esc(m.title)}</h3><b>${n.toLocaleString()} 条<small>${m.categories.map(c=>`${esc(c)} ${(totals[c]||0).toLocaleString()}`).join(' · ')}</small></b></div>`});
  for(const name of ['网管监控','流量分析'])cards.push(`<div class="module-card building" onclick="navPlanned('${name}')"><span>建设中</span><h3>${name}</h3><b>功能入口已建立</b></div>`);
  $('#moduleStats').innerHTML=cards.join('');$('#zoneBars').innerHTML=d.byZone.map(z=>{const pct=x=>z.total?x/z.total*100:0,p=pct(z.used),tip=`登记已分配 ${z.assigned} · 资料检出占用 ${z.detected} · 预留 ${z.reserved} · 可用 ${z.available}`;return `<div class="zone-row"><b>${esc(z.zone)}</b><div class="bar" title="${tip}"><i style="width:${pct(z.assigned)}%"></i><i class="detected" style="width:${pct(z.detected)}%"></i><i class="reserved" style="width:${pct(z.reserved)}%"></i></div><small>${z.used.toLocaleString()}/${z.total.toLocaleString()} (${p.toFixed(1)}%)</small></div>`}).join('')||'<p>尚未导入数据。</p>'}
// ---- 网段管理表：三个地址空间共用 #subnetsPage，按 kind 换说明、列头、筛选项文案 ----
// zoneLabel 是 subnets.zone 在该空间里的含义（IDC＝网络分区，办公网＝城市，公网＝地址空间），列表和筛选都按它称呼
const SUBNET_PAGE={
  idc:{title:'燕郊光子机房数据中心（IDC）',zoneLabel:'网络分区',newLabel:'新增 IDC 网段',search:'搜索 IDC 网段、网络分区、子模块或备注',
    text:'这一页是平台自己维护的地址表，不是只读资料：光子机房 IDC 规划表的网段（DMZ 区、内网服务器区、测试开发区、网管区、文旅区、合作伙伴区、设备互联）都在这里管。点每行的「IP 明细」进入方格图——每个 IP 一个色块，深色＝占用（登记已分配 / 资料检出）、白色＝空闲，一眼分清；自动列出连续空闲段和下一个可用地址，分地址、登记、预留都在方格图里点色块完成。分区维度的整体规划看「数据中心分区图」。',
    cols:[['网络分区',x=>esc(x.zone)],['子模块',x=>esc(x.module)],['网段',x=>`<b>${x.cidr}</b>`],['状态',subnetStatusTag],['使用情况',subnetUsageCell],['VLAN',x=>esc(x.vlanId)||'-'],['负责人',x=>esc(x.owner)||'-']]},
  office:{title:'各地办公网（北京总部与分支）',zoneLabel:'城市',newLabel:'新增办公网段',search:'搜索办公网段、城市、楼宇、楼层、业务或管理设备',
    text:'各地办公网的网段台账，首次从《万达IP地址规划原则和分配表》导入，之后的划拨、回收、登记都在平台做，不再回 Excel。每段记城市 → 位置（楼宇 / 园区）→ 楼层 → 业务（有线 / 无线）。点「IP 明细」进方格图看每个地址（网关、管理地址已登记，DHCP 保留段标预留，终端走 DHCP 一般不登记）；整段预留的网段点「划给业务」给新楼层 / 新业务。按站点、楼层看排布用「办公网规划图」。',
    cols:[['城市',x=>esc(x.zone)],['位置 · 楼层',x=>twoLine(x.site,x.floor)],['业务',x=>`${esc(x.module)}${x.netType?`<br><em class="sub-type ${x.netType==='无线'?'wifi':'wired'}">${esc(x.netType)}</em>`:''}`],['网段',x=>`<b>${x.cidr}</b>`],['状态',subnetStatusTag],['使用情况',subnetUsageCell],['VLAN',x=>esc(x.vlanId)||'-'],['网关 / 管理设备',x=>twoLine(x.gateway,x.mgmtDevice)]]},
  public:{title:'互联网公网地址池',zoneLabel:'地址空间',newLabel:'新增公网地址池',search:'搜索公网网段、地址池名称或备注',
    text:'运营商分配的公网地址段，一段一个地址池。池里每个地址登记「给哪个应用 → 映射到哪个内网实 IP → 业态 / 负责人」，点「IP 明细」进方格图或地址列表登记、回收；按业态和待分配申请看全貌用「公网地址池」页签。电商、舆情两个公网段不在这里展示。',
    cols:[['地址空间',x=>esc(x.zone)],['地址池',x=>esc(x.module)],['网段',x=>`<b>${x.cidr}</b>`],['状态',subnetStatusTag],['使用情况',subnetUsageCell],['网关',x=>esc(x.gateway)||'-'],['负责人 / 备注',x=>twoLine(x.owner,x.remarks)]]}};
const twoLine=(a,b)=>a||b?`${esc(a)||'-'}${b?`<small class="sub-note" title="${esc(b)}">${esc(b)}</small>`:''}`:'-';
function subnetStatusTag(x){return `<span class="tag ${x.status==='预留'?'reserve':x.status==='停用'?'off':''}">${x.status}</span>`}
function subnetUsageCell(x){const occ=x.used+(x.detected||0),pct=x.total?Math.round(occ/x.total*100):0;return `<div class="sub-usage${pct>=80?' hot':''}"><i style="width:${pct}%"></i></div>${occ}/${x.total}<br><small>${x.detected?`检出 ${x.detected} · `:''}登记 ${x.used} · 预留 ${x.reserved}</small>`}
// 三个页签的角标和概览卡用的完整列表一次取齐，免得没点过的页签没数字；进 IP 模块时会 await 它，保证概览卡拿到的是地址表口径
async function loadSubnetCounts(){try{const all=await api('/api/subnets?kind=all');for(const k of ['idc','office','public']){subnetLists[k]=all.filter(s=>(s.kind||'idc')===k);subnetCounts[k]=subnetLists[k].length}}catch{}}
// 切换地址空间：清筛选、换文案和列头；列表本身由随后的 loadSubnets 填
function setSubnetsPage(kind){kind=SUBNET_PAGE[kind]?kind:'idc';const p=SUBNET_PAGE[kind];if(kind!==subnetKind){$('#subnetSearch').value='';$('#zoneFilter').value='';$('#subnetStatus').value='';subnets=[]}subnetKind=kind;
  $('#subnetsScopeTitle').textContent=p.title;$('#subnetsScopeText').textContent=p.text;$('#subnetSearch').placeholder=p.search;$('#newSubnet').textContent=p.newLabel;$('#zoneFilter').options[0].textContent=`全部${p.zoneLabel}`;
  $('#subnetHead').innerHTML='<tr>'+p.cols.map(([h])=>`<th>${h}</th>`).join('')+'<th>操作</th></tr>'}
async function loadSubnets(){const p=SUBNET_PAGE[subnetKind],q=$('#subnetSearch').value,z=$('#zoneFilter').value,s=$('#subnetStatus').value;const list=await api(`/api/subnets?kind=${subnetKind}&q=${encodeURIComponent(q)}&zone=${encodeURIComponent(z)}&status=${encodeURIComponent(s)}`);if(p!==SUBNET_PAGE[subnetKind])return;subnets=list;if(!q&&!z&&!s){subnetLists[subnetKind]=subnets;subnetCounts[subnetKind]=subnets.length}
  const zones=[...new Set(subnets.map(x=>x.zone))];const current=$('#zoneFilter').value;$('#zoneFilter').innerHTML=`<option value="">全部${p.zoneLabel}</option>`+zones.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('');
  $('#subnetRows').innerHTML=subnets.map(x=>`<tr>${p.cols.map(([,f])=>`<td>${f(x)}</td>`).join('')}<td><div class="actions"><button onclick="addresses(${x.id},'${x.cidr}')">IP 明细</button>${me.role!=='只读用户'?(x.status==='预留'?`<button class="secondary" onclick="allocateForm(${x.id})">划给业务</button>`:`<button class="secondary" onclick="subnetForm(${x.id})">编辑</button>`):''}<button class="secondary" onclick="subnetActions(${x.id})">更多</button>${me.role==='管理员'?`<button class="danger" onclick="removeSubnet(${x.id})">删除</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="${p.cols.length+1}">没有符合条件的网段。</td></tr>`}
['#subnetSearch','#zoneFilter','#subnetStatus'].forEach(s=>$(s).addEventListener(s.includes('Search')?'input':'change',loadSubnets));
$('#newSubnet').onclick=()=>subnetForm(null,{kind:subnetKind});
// 网段级动作做完后刷新当前视图：网段管理页重拉列表，分区图 / 公网池 / 规划总览重画
async function ipRefresh(){if(typeof curTab==='undefined'||!curTab)return;if(curTab.kind==='subnets')return loadSubnets();if(curTab.render)return curTab.render(typeof tabRows==='undefined'?[]:tabRows)}
async function subnetById(id){let x=subnets.find(s=>s.id===id);if(!x){const all=await api('/api/subnets?kind=all');x=all.find(s=>s.id===id)}return x}
// 三类网段共用一张表单：kind=office 多出 位置 / 楼层 / 有线无线 / 管理设备 四个维度，标题和占位符也按类别换
const IP_KIND_LABEL={idc:'数据中心 IDC',public:'互联网公网',office:'办公网'};
async function subnetForm(id,preset){const x=id?(await subnetById(id))||{}:(preset||{});const kind=x.kind||'idc',office=kind==='office';
  const pool=(typeof ipState!=='undefined'&&ipState.lists&&ipState.lists[kind])||(kind===subnetKind?subnets:[]);
  const zones=[...new Set(pool.map(s=>s.zone))],sites=[...new Set(pool.map(s=>s.site).filter(Boolean))];
  modal(id?`编辑${office?'办公网':''}网段 ${x.cidr}`:`新增网段（${IP_KIND_LABEL[kind]}）`,`<input type="hidden" name="kind" value="${kind}"><div class="form-grid">
    <label>${office?'城市':kind==='public'?'地址空间':'网络分区'}<input name="zone" list="zoneList" value="${esc(x.zone)||(kind==='public'?'互联网公网':'')}" required><datalist id="zoneList">${zones.map(z=>`<option value="${esc(z)}">`).join('')}</datalist></label>
    ${office?`<label>位置（楼宇 / 园区）<input name="site" list="siteList" value="${esc(x.site)}" placeholder="如：B座、12号楼"><datalist id="siteList">${sites.map(z=>`<option value="${esc(z)}">`).join('')}</datalist></label><label>楼层<input name="floor" value="${esc(x.floor)}" placeholder="如：8层、B1层"></label><label>网络类型<select name="netType">${['有线','无线'].map(v=>`<option ${(x.netType||'有线')===v?'selected':''}>${v}</option>`).join('')}</select></label>`:''}
    <label>${office?'业务名称':kind==='public'?'地址池名称':'子模块/用途'}<input name="module" value="${esc(x.module)||(x.status==='预留'?'预留':'')}" placeholder="${office?'办公有线 / 办公WiFi，整段预留请填「预留」':'业务名，整段预留请填「预留」'}" required></label>
    <label>CIDR 网段<input name="cidr" placeholder="${office?'10.1.108.0/24':'10.199.100.0/24'}" value="${esc(x.cidr)}" required></label>
    <label>状态<select name="status">${['已使用','预留','停用'].map(v=>`<option ${(x.status||'预留')===v?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>网关<input name="gateway" value="${esc(x.gateway)}"></label><label>VLAN ID<input name="vlanId" value="${esc(x.vlanId)}"></label><label>负责人<input name="owner" value="${esc(x.owner)}"></label>
    ${office?`<label class="wide">管理设备（名称 + 管理地址）<input name="mgmtDevice" value="${esc(x.mgmtDevice)}" placeholder="BJ_ZB_F8_HJ（10.0.20.108）"></label>`:''}
    <label class="wide">备注${office?'（用途、SSID）':''}<textarea name="remarks">${esc(x.remarks)}</textarea></label></div>`,async data=>{await api(id?`/api/subnets/${id}`:'/api/subnets',{method:id?'PUT':'POST',body:JSON.stringify(data)});toast(id?'网段已更新':'网段已新增');await ipRefresh()})}
async function removeSubnet(id){if(!confirm('确定删除这个网段吗？历史审计记录仍会保留。'))return;await api(`/api/subnets/${id}`,{method:'DELETE'});toast('网段已删除');await ipRefresh()}
// ---- 网段级分配动作：划给业务 / 回收为预留 / 按检出结果登记 ----
async function subnetActions(id){
  const s=await subnetById(id);if(!s)return toast('网段不存在');
  const occ=s.used+(s.detected||0),canEdit=me.role!=='只读用户',res=s.status==='预留';
  const bar=`<div class="ip-bar"><i class="k-used" style="width:${s.used/s.total*100}%" title="登记已分配 ${s.used}"></i><i class="k-ref" style="width:${(s.detected||0)/s.total*100}%" title="资料检出 ${s.detected||0}"></i><i class="k-reserved" style="width:${s.reserved/s.total*100}%" title="预留 ${s.reserved}"></i></div>`;
  const warn=res&&s.detected?`<p class="ip-note warn">这是预留网段，但资料库里已有 ${s.detected} 个地址在用——要么补划给对应业务，要么核实资料是否过期。</p>`:'';
  const idle=!res&&occ===0?`<p class="ip-note">已启用但没有任何地址在用，如业务未上线或已下线，可整段回收为预留。</p>`:'';
  const where=s.kind==='office'?[s.zone,s.site,s.floor,s.netType].filter(Boolean).join(' · '):s.zone;
  modal(`网段 ${s.cidr}`,`<div class="sa-head"><span class="tag ${res?'reserve':s.status==='停用'?'off':''}">${s.status}</span><b>${esc(where)}</b><em>${esc(s.module)}</em>${s.owner?`<small>负责人 ${esc(s.owner)}</small>`:''}${s.vlanId?`<small>VLAN ${esc(s.vlanId)}</small>`:''}${s.gateway?`<small>网关 ${esc(s.gateway)}</small>`:''}${s.mgmtDevice?`<small>管理设备 ${esc(s.mgmtDevice)}</small>`:''}</div>
    ${spStats([['地址总数',s.total,s.cidr],['登记已分配',s.used,'地址表口径'],['资料检出',s.detected||0,'资料里在用、未登记'],['可用',Math.max(0,s.total-s.used-(s.detected||0)-s.reserved),res?'整段预留中':'可直接分配']])}${bar}${warn}${idle}
    ${s.remarks?`<p class="ip-note">${esc(s.remarks)}</p>`:''}
    <div class="sa-actions">
      <button type="button" onclick="$('#modal').close();addresses(${s.id},'${s.cidr}')">地址方格图</button>
      ${canEdit&&!res&&s.status!=='停用'?`<button type="button" class="primary" onclick="allocateWizard({subnetId:${s.id}})">分配 IP</button>`:''}
      ${canEdit&&res?`<button type="button" class="primary" onclick="allocateForm(${s.id})">划给业务</button>`:''}
      ${canEdit&&!res?`<button type="button" class="${s.used?'secondary':'danger'}" ${s.used?`disabled title="段内还有 ${s.used} 个已分配地址，先逐个回收"`:''} onclick="releaseSubnet(${s.id})">回收为预留</button>`:''}
      ${canEdit&&s.detected?`<button type="button" class="secondary" onclick="registerDetected(${s.id},'${s.cidr}')">按检出结果登记 ${s.detected} 个</button>`:''}
      ${canEdit?`<button type="button" class="secondary" onclick="subnetForm(${s.id})">编辑</button>`:''}
    </div>`,null)}
// 办公网划拨时多问一句楼层和有线 / 无线；业务名候选取同城市已在用的
function officeAllocFields(s,siblings){if(s.kind!=='office')return '';const floors=[...new Set(siblings.map(x=>x.floor).filter(Boolean))];return `<label>楼层<input name="floor" list="floorList" value="${esc(s.floor&&s.floor!=='任意楼层'?s.floor:'')}" placeholder="如：8层"><datalist id="floorList">${floors.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></label><label>网络类型<select name="netType">${['有线','无线'].map(v=>`<option ${(s.netType||'有线')===v?'selected':''}>${v}</option>`).join('')}</select></label>`}
async function siblingsOf(s){const all=await api(`/api/subnets?kind=${s.kind||'idc'}`);return all.filter(x=>x.zone===s.zone)}
async function allocateForm(id){
  const s=await subnetById(id);if(!s)return;
  const sib=await siblingsOf(s),office=s.kind==='office';
  const mods=[...new Set(sib.filter(x=>x.status!=='预留').flatMap(x=>x.module.split(' / ')))];
  const where=office?[s.zone,s.site,s.floor].filter(Boolean).join(' · '):s.zone;
  modal(`划拨 ${s.cidr} 给业务`,`<p class="ip-note">${esc(where)} · 当前整段预留。划拨后状态改为「已使用」，段内 ${s.total-2} 个地址放开为可用，之后用「分配 IP」或在方格图里登记。</p><div class="form-grid"><label>${office?'业务名称':'划给业务 / 子模块'}<input name="module" list="modList" required placeholder="${office?'如：办公有线、办公WiFi':'如：集团WEB（real server）'}"><datalist id="modList">${mods.map(m=>`<option value="${esc(m)}">`).join('')}</datalist></label>${officeAllocFields(s,sib)}<label>负责人<input name="owner"></label><label>网关地址<input name="gateway" placeholder="${esc(s.cidr.replace(/\.0\/\d+$/,'.1'))}"></label><label>VLAN ID<input name="vlanId"></label><label class="wide">备注 / 申请单号<textarea name="remarks"></textarea></label></div>`,async data=>{const r=await api(`/api/subnets/${id}/allocate`,{method:'POST',body:JSON.stringify(data)});toast(`${s.cidr} 已划给 ${data.module}，放开 ${r.freed} 个地址`);await ipRefresh()})}
// 连续的几个预留 /24 一次划出 N 段
async function allocateRunForm(zone,ids){
  const list=(await Promise.all(ids.map(subnetById))).filter(Boolean);if(!list.length)return;
  const s0=list[0],sib=await siblingsOf(s0);
  modal(`从 ${esc(zone)} 预留段划拨`,`<p class="ip-note">连续预留段 ${list[0].cidr}${list.length>1?` 起共 ${list.length} 段`:''}。按顺序划出前 N 段给同一个业务。</p><div class="form-grid"><label>划出网段数<select name="count">${list.map((_,i)=>`<option value="${i+1}" ${i===0?'selected':''}>${i+1} 段（${list.slice(0,i+1).map(s=>s.cidr.replace(/\/24$/,'')).join('、')}）</option>`).join('')}</select></label><label>${s0.kind==='office'?'业务名称':'划给业务 / 子模块'}<input name="module" required></label>${officeAllocFields(s0,sib)}<label>负责人<input name="owner"></label><label>VLAN ID<input name="vlanId"></label><label class="wide">备注 / 申请单号<textarea name="remarks"></textarea></label></div>`,async data=>{const n=Number(data.count);let ok=0;for(const s of list.slice(0,n)){await api(`/api/subnets/${s.id}/allocate`,{method:'POST',body:JSON.stringify({module:data.module,owner:data.owner,vlanId:data.vlanId,remarks:data.remarks,floor:data.floor,netType:data.netType})});ok++}toast(`已划拨 ${ok} 段给 ${data.module}`);await ipRefresh()})}

// ---- 「分配 IP」向导：选地址空间 → 选分区 / 城市 → 选网段（按余量排）→ 要几个 → 填登记信息，一次落地 ----
// 三个下拉是级联的，modal 渲染完再挂 onchange；所有网段一次取回（kind=all）
let ipState={lists:{}};
async function allocateWizard(opt={}){
  const all=await api('/api/subnets?kind=all');ipState.lists={idc:all.filter(s=>s.kind==='idc'),office:all.filter(s=>s.kind==='office'),public:all.filter(s=>s.kind==='public')};
  const usable=all.filter(s=>s.status==='已使用');
  const pre=opt.subnetId?all.find(s=>s.id===opt.subnetId):null;
  const kind0=pre?pre.kind:(opt.kind||'idc');
  const free=s=>Math.max(0,s.total-s.used-(s.detected||0)-s.reserved);
  const zoneLabel=k=>k==='office'?'城市':k==='public'?'地址空间':'网络分区';
  const subLabel=s=>`${s.cidr} · ${s.kind==='office'?[s.site,s.floor,s.module].filter(Boolean).join(' '):s.module} · 可用 ${free(s)}`;
  const zonesOf=k=>[...new Set(usable.filter(s=>s.kind===k).map(s=>s.zone))];
  const subsOf=(k,z)=>usable.filter(s=>s.kind===k&&s.zone===z).sort((a,b)=>free(b)-free(a));
  const opts=(arr,sel,fmt=x=>x,val=x=>x)=>arr.map(x=>`<option value="${esc(val(x))}" ${val(x)===sel?'selected':''}>${esc(fmt(x))}</option>`).join('');
  const z0=pre?pre.zone:zonesOf(kind0)[0],s0=pre?pre.id:(subsOf(kind0,z0)[0]||{}).id;
  modal('分配 IP',`<p class="ip-note">先选地址空间和分区 / 城市，网段按可用余量排好；填要几个，平台从第一个可用地址起连续分出，主机名多于一个时自动加 -01、-02。整段预留的网段不在列表里——先在规划图上「划给业务」。</p>
    <div class="form-grid">
      <label>地址空间<select name="kind" id="wzKind">${opts(['idc','office','public'],kind0,k=>IP_KIND_LABEL[k])}</select></label>
      <label id="wzZoneLabel">${zoneLabel(kind0)}<select name="zone" id="wzZone">${opts(zonesOf(kind0),z0)}</select></label>
      <label class="wide">网段<select name="subnetId" id="wzSubnet" required>${opts(subsOf(kind0,z0),s0,subLabel,s=>s.id)}</select><small id="wzHint" class="wz-hint"></small></label>
      <label>需要几个地址<input name="count" type="number" min="1" max="256" value="${opt.count||1}" required></label>
      <label>从哪个地址起（可空）<input name="startIp" placeholder="默认第一个可用地址"></label>
      <label>主机名 / 应用<input name="hostname" placeholder="多个地址时自动加序号"></label>
      <label>设备类型<input name="deviceType" list="wzDt" placeholder="服务器 / 终端 / AP / 打印机"><datalist id="wzDt">${['服务器','虚拟机','终端','AP','打印机','网络设备','摄像头','其他'].map(v=>`<option value="${v}">`).join('')}</datalist></label>
      <label>所属系统 / 部门<input name="systemName"></label><label>负责人<input name="owner"></label><label>申请单号<input name="ticketNo"></label>
      <label class="wide">备注<textarea name="remarks"></textarea></label>
    </div>`,async data=>{
      const id=Number(data.subnetId);if(!id)throw new Error('请选择网段');
      const body={count:Number(data.count),startIp:data.startIp,hostname:data.hostname,deviceType:data.deviceType,systemName:data.systemName,owner:data.owner,ticketNo:data.ticketNo,remarks:data.remarks};
      const r=await api(`/api/subnets/${id}/allocate-addresses`,{method:'POST',body:JSON.stringify(body)});
      toast(`已在 ${r.cidr} 分出 ${r.count} 个地址：${r.ips.slice(0,4).join('、')}${r.ips.length>4?' …':''}`);
      await ipRefresh();setTimeout(()=>addresses(id,r.cidr),0)});
  const kindSel=$('#wzKind'),zoneSel=$('#wzZone'),subSel=$('#wzSubnet');
  const hint=()=>{const s=all.find(x=>x.id===Number(subSel.value));$('#wzHint').textContent=s?`${s.zone}${s.site?' · '+s.site:''}${s.floor?' · '+s.floor:''} · ${s.module} · 共 ${s.total} 地址，已用 ${s.used+(s.detected||0)}，预留 ${s.reserved}，可用 ${free(s)}${s.gateway?'，网关 '+s.gateway:''}`:'该分区没有可分地址的已启用网段'};
  const fillSubs=()=>{subSel.innerHTML=opts(subsOf(kindSel.value,zoneSel.value),null,subLabel,s=>s.id);hint()};
  const fillZones=()=>{const zs=zonesOf(kindSel.value);$('#wzZoneLabel').firstChild.textContent=zoneLabel(kindSel.value);zoneSel.innerHTML=opts(zs,zs[0]);fillSubs()};
  kindSel.onchange=fillZones;zoneSel.onchange=fillSubs;subSel.onchange=hint;hint()}
// ---- 「查 IP」：这个地址在哪个网段、登记给了谁、资料库里谁在用 ----
// 查询结果的 HTML 单独成函数：IP 模块里弹窗用，工具页「网段计算与查询」输入单个地址时也直接嵌在结果里
function ipLookupHtml(r,opt={}){
  const s=r.subnet,a=r.address;
  const where=s?`${IP_KIND_LABEL[s.kind]||s.kind} · ${[s.zone,s.site,s.floor,s.netType].filter(Boolean).join(' · ')}`:'';
  const kv=(k,v)=>v?`<div><small>${k}</small><b>${esc(v)}</b></div>`:'';
  const addrBox=a?`<div class="lk-kv">${kv('登记状态',a.status)}${kv('主机名 / 应用',a.hostname)}${kv('设备类型',a.deviceType)}${kv('所属系统',a.systemName)}${kv('负责人',a.owner)}${kv('申请单号',a.ticketNo)}${kv('所属业态',a.business)}${kv('域名',a.domain)}${kv('实 IP',a.realIp)}${kv('NAT',a.natDir)}${kv('分配时间',a.allocatedAt)}${kv('备注',a.remarks)}</div>`:'<p class="ip-note">地址表里没有这个地址——它不在任何已纳入平台管理的网段内。</p>';
  const refs=r.refs.length?`<h6>资料库里在用（${r.refs.length}）</h6><ul class="ipp-list">${r.refs.map(x=>`<li><b>${esc(x.name)}</b><span>${esc(x.subcategory||x.category)}${x.status?' · '+esc(x.status):''}</span></li>`).join('')}</ul>`:'<p class="ip-note">资产、F5、无线、IP 资料表里都没有查到这个地址。</p>';
  const reg=r.registered.length?`<h6>台账登记</h6><ul class="ipp-list">${r.registered.map(x=>`<li><b>${esc(x.table)}</b><span>${esc([x.where,x.text].filter(Boolean).join(' · '))}${x.status?' · '+esc(x.status):''}</span></li>`).join('')}</ul>`:'';
  const canEdit=me&&me.role!=='只读用户';
  return `${s?`<div class="sa-head"><span class="tag ${s.status==='预留'?'reserve':s.status==='停用'?'off':''}">${s.status}</span><b>${esc(s.cidr)}</b><em>${esc(s.module)}</em><small>${esc(where)}</small>${s.gateway?`<small>网关 ${esc(s.gateway)}</small>`:''}</div>`:'<p class="ip-note warn">没有任何已管理的网段包含这个地址。</p>'}
    ${addrBox}${refs}${reg}
    <div class="sa-actions">
      ${s?`<button type="button" onclick="$('#modal').close();addresses(${s.id},'${s.cidr}')">打开网段方格图</button><button type="button" class="secondary" onclick="subnetActions(${s.id})">网段操作</button>`:''}
      ${canEdit&&a&&(a.status==='可用'||a.status==='预留')&&s&&s.status==='已使用'?`<button type="button" class="primary" onclick="$('#modal').close();addresses(${s.id},'${s.cidr}',{openIp:'${r.ip}'})">登记这个地址</button>`:''}
      ${opt.inline?'':'<button type="button" class="secondary" onclick="ipLookupPrompt()">再查一个</button>'}
    </div>`}
async function ipLookupPrompt(ip){
  ip=ip||prompt('输入要查的 IP 地址：');if(!ip)return;
  let r;try{r=await api(`/api/lookup?ip=${encodeURIComponent(ip.trim())}`)}catch(e){return toast(e.message)}
  modal(`查 IP · ${r.ip}`,ipLookupHtml(r),null)}
async function releaseSubnet(id){
  const s=await subnetById(id);if(!s)return;
  if(s.detected&&!confirm(`${s.cidr} 资料库里还检出 ${s.detected} 个地址在用，确定整段回收？`))return;
  const reason=prompt(`回收 ${s.cidr}（${s.module}）为预留网段，填写原因（可空）：`);if(reason===null)return;
  await api(`/api/subnets/${id}/release`,{method:'POST',body:JSON.stringify({reason})});toast(`${s.cidr} 已回收为预留`);$('#modal').close();await ipRefresh()}
async function registerDetected(id,cidr){
  if(!confirm(`把 ${cidr} 内资料库检出在用、地址表未登记的地址一次登记为「已分配」？主机名取资料记录，之后可在方格图里逐个修正。`))return;
  const r=await api(`/api/subnets/${id}/register-detected`,{method:'POST'});toast(`已登记 ${r.count} 个地址`);$('#modal').close();if(ipCtx&&ipCtx.id===id)setTimeout(()=>addresses(id,cidr),0);else await ipRefresh()}
// 方格图把地址表的登记状态和资料库里的真实占用叠在一起看
function ipKind(a){if(a.remarks==='网络地址'||a.remarks==='广播地址')return 'edge';
  if(a.status==='已分配')return 'used';
  if(a.refs&&a.refs.length)return 'ref';
  if(a.status==='禁用')return 'blocked';
  if(a.status==='预留')return 'reserved';
  return 'free'}
const IP_KINDS={used:'已分配',ref:'资料库占用',reserved:'预留',blocked:'禁用',edge:'网络/广播',free:'空闲'};
function ipTip(a){const kind=IP_KINDS[ipKind(a)];const who=(a.refs||[]).map(r=>`${r.name}（${r.subcategory||r.category}）`).join('；');
  return [a.ip,kind,a.hostname,a.systemName,who,a.remarks].filter(Boolean).join(' · ')}
function freeBlocks(rows){const runs=[];let cur=null;
  for(const a of rows){if(ipKind(a)==='free'){cur?cur.push(a):runs.push(cur=[a])}else cur=null}
  return runs.map(r=>({from:r[0].ip,to:r[r.length-1].ip,size:r.length})).sort((a,b)=>b.size-a.size)}
function fitCidr(size){let p=32;while(p>0&&(1<<(32-p))<=size)p--;return (1<<(31-p))<=size?`可放下一个 /${p+1}`:''}
async function subnetMap(id,cidr){
  const m=await api(`/api/subnets/${id}/map`);const rows=m.addresses;if(ipCtx&&ipCtx.id===id){ipCtx.kind=m.kind;ipCtx.map=m}
  const tally={};for(const a of rows){const k=ipKind(a);tally[k]=(tally[k]||0)+1}
  const occupied=(tally.used||0)+(tally.ref||0);
  const blocks=freeBlocks(rows),next=rows.find(a=>ipKind(a)==='free');
  const bar=[['used',tally.used||0],['ref',tally.ref||0],['reserved',tally.reserved||0],['blocked',tally.blocked||0],['edge',tally.edge||0],['free',tally.free||0]];
  const cells=rows.map(a=>{const k=ipKind(a);const last=a.ip.split('.').pop();
    return `<button type="button" class="ip-cell k-${k}" title="${esc(ipTip(a))}" onclick='addressForm(${JSON.stringify(a).replaceAll("'","&#39;")})'>${last}</button>`}).join('');
  const legend=`<span class="ip-legend ip-legend-sum">深色＝占用 <b>${occupied}</b>　白色＝空闲 <b>${tally.free||0}</b></span>`+bar.filter(([,n])=>n).map(([k,n])=>`<span class="ip-legend"><i class="k-${k}"></i>${IP_KINDS[k]} ${n}</span>`).join('');
  const blockList=blocks.length?blocks.slice(0,12).map(b=>`<li><b>${b.from} – ${b.to}</b><span>${b.size} 个${b.size>1?'，'+fitCidr(b.size):''}</span></li>`).join(''):'<li class="ip-none">本网段已无连续空闲地址。</li>';
  const pub=m.kind==='public',office=m.kind==='office',canEdit=me.role!=='只读用户';
  const scopeTitle=pub?'互联网公网地址池':office?'办公网':'燕郊光子机房数据中心（IDC）';
  const where=office?[m.zone,m.site,m.floor].filter(Boolean).join(' · '):m.zone;
  const actions=canEdit?`<div class="ip-actions">${tally.ref?`<button type="button" onclick="registerDetected(${id},'${cidr}')">按检出结果登记 ${tally.ref} 个</button>`:''}${next?`<button type="button" class="secondary" onclick='addressForm(${JSON.stringify(next).replaceAll("'","&#39;")},"已分配")'>登记下一个可用 ${next.ip}</button>`:''}${next&&m.status==='已使用'?`<button type="button" class="secondary" onclick="allocateWizard({subnetId:${id}})">一次分多个</button>`:''}${m.status==='预留'?`<button type="button" class="secondary" onclick="allocateForm(${id})">整段划给业务</button>`:''}</div>`:'';
  return `<div class="ip-map">
    <div class="scope-note"><b>${scopeTitle} · ${esc(where)}</b><span>${pub?'地址池':office?'业务':'子模块'}：${esc(m.module)||'未登记'}${office&&m.netType?`（${esc(m.netType)}）`:''}　网段：${esc(cidr)}　每个色块代表一个 IP 地址：<b>深色＝占用，白色＝空闲</b>，点击登记 / 回收${m.status==='预留'?'　<b>整段预留中</b>':''}</span></div>
    ${actions}
    <div class="ip-summary">${spStats([
      [pub?'地址池容量':office?'网段容量':'IDC 网段容量',m.size,`${esc(where)} · ${esc(m.module)}`],
      ['真实占用',occupied,occupied?'资料库中有设备使用':'资料库中暂无设备使用'],
      ['可用地址',tally.free||0,`占 ${((tally.free||0)/m.size*100).toFixed(0)}%`],
      ['最大连续空闲',blocks[0]?blocks[0].size:0,blocks[0]?`${blocks[0].from} 起`:'无'],
      ['下一个可用',next?next.ip:'—','建议优先分配'],
      ['网关',m.gateway||'未登记',m.vlanId?`VLAN ${esc(m.vlanId)}`:'未登记 VLAN']])}</div>
    <div class="ip-bar">${bar.filter(([,n])=>n).map(([k,n])=>`<i class="k-${k}" style="width:${n/m.size*100}%" title="${IP_KINDS[k]} ${n}"></i>`).join('')}</div>
    <div class="ip-legends">${legend}</div>
    <div class="ip-grid">${cells}</div>
    <h4 class="ip-blocks-title">连续空闲段<em>按大小排序，可直接用于新业务规划</em></h4>
    <ul class="ip-blocks">${blockList}</ul></div>`;
}
let ipCtx=null;
function ipListRow(a){const pub=ipCtx&&ipCtx.kind==='public';return `<tr><td>${a.ip}</td><td><span class="tag ${a.status==='预留'?'reserve':a.status==='禁用'?'off':''}">${a.status}</span></td><td>${esc(a.hostname)||'-'}${pub&&a.domain?`<br><small>${esc(a.domain)}</small>`:''}</td><td>${pub?esc(a.realIp)||'-':esc(a.systemName)||'-'}</td><td>${esc(a.owner)||'-'}</td><td>${me.role!=='只读用户'?`<div class="actions"><button onclick='addressForm(${JSON.stringify(a).replaceAll("'","&#39;")})'>${a.status==='已分配'?'修改':'登记'}</button>${a.status==='已分配'?`<button class="danger" onclick="releaseAddress(${a.id},'${a.ip}')">回收</button>`:''}</div>`:''}</td></tr>`}
function switchIpView(btn){$$('.ip-tabs button').forEach(b=>b.classList.toggle('active',b===btn));const map=btn.dataset.v==='map';$('#ipViewMap').classList.toggle('hidden',!map);$('#ipViewList').classList.toggle('hidden',map)}
// opt.openIp：打开方格图后直接弹出某个地址的登记表单（「查 IP」→「登记这个地址」）
async function addresses(id,cidr,opt={}){
  ipCtx={id,cidr};
  const [mapHtml,rows]=await Promise.all([subnetMap(id,cidr),api(`/api/subnets/${id}/addresses`)]);
  const pub=ipCtx.kind==='public';
  const list=`<div class="toolbar" style="grid-template-columns:1fr 150px"><input id="ipSearch" placeholder="搜索 IP、主机名、系统或负责人"><select id="ipStatus"><option value="">全部状态</option><option>可用</option><option>已分配</option><option>预留</option><option>禁用</option></select></div><div class="address-list"><table><thead><tr><th>IP 地址</th><th>状态</th><th>${pub?'应用 / 域名':'主机名'}</th><th>${pub?'实IP':'所属系统'}</th><th>负责人</th><th>操作</th></tr></thead><tbody id="ipRows">${rows.map(ipListRow).join('')}</tbody></table></div>`;
  modal(`${pub?'公网地址池':ipCtx.kind==='office'?'办公网网段':'IDC IP 网段'} ${cidr}`,`<div class="ip-tabs"><button type="button" class="active" data-v="map" onclick="switchIpView(this)">网段方格图</button><button type="button" data-v="list" onclick="switchIpView(this)">地址明细列表</button></div><div id="ipViewMap">${mapHtml}</div><div id="ipViewList" class="hidden">${list}</div>`,null,true);
  const reload=async()=>{const hit=await api(`/api/subnets/${id}/addresses?q=${encodeURIComponent($('#ipSearch').value)}&status=${encodeURIComponent($('#ipStatus').value)}`);$('#ipRows').innerHTML=hit.map(ipListRow).join('')||'<tr><td colspan="6">没有符合条件的地址。</td></tr>'};
  $('#ipSearch').oninput=reload;$('#ipStatus').onchange=reload;
  if(opt.openIp){const a=(ipCtx.map&&ipCtx.map.addresses||rows).find(x=>x.ip===opt.openIp);if(a)setTimeout(()=>addressForm(a,a.status==='已分配'?undefined:'已分配'),0)}
}
// 地址级登记：IDC 地址填主机 / 系统 / 机柜，公网地址填应用 / 域名 / NAT / 实IP。preset 用于「登记下一个可用」直接把状态设为已分配
const NAT_DIRS=['入向','出向','双向'];
function addressForm(a,preset,pub){const back=ipCtx;pub=pub??(ipCtx&&ipCtx.kind==='public');const st=preset||a.status;const refs=(a.refs||[]);const first=refs[0];
  const refBox=refs.length?`<div class="ip-refs"><b>资料库中占用这个地址的记录</b>${refs.map(r=>`<span>${esc(r.name)}<em>${esc(r.subcategory||r.category)}${r.status?' · '+esc(r.status):''}</em></span>`).join('')}${a.status!=='已分配'&&me.role!=='只读用户'?`<button type="button" class="secondary" onclick="fillFromRef(this)" data-name="${esc(first.name)}" data-sys="${esc(first.subcategory||first.category)}">按资料登记</button>`:''}</div>`:'';
  const idcFields=`<label>主机名/设备名<input name="hostname" value="${esc(a.hostname)}"></label><label>设备类型<input name="deviceType" value="${esc(a.deviceType)}"></label><label>所属系统<input name="systemName" value="${esc(a.systemName)}"></label><label>负责人<input name="owner" value="${esc(a.owner)}"></label><label>MAC 地址<input name="macAddress" value="${esc(a.macAddress)}"></label><label>位置/机柜<input name="location" value="${esc(a.location)}"></label><label>申请单号<input name="ticketNo" value="${esc(a.ticketNo)}"></label>`;
  const pubFields=`<label>应用 / 用途<input name="hostname" value="${esc(a.hostname)}" placeholder="如：移动审批"></label><label>所属业态 · 部门<input name="business" value="${esc(a.business)}" placeholder="集团 · 通用系统"></label><label class="wide">应用域名<input name="domain" value="${esc(a.domain)}" placeholder="多个用 / 分隔"></label><label>NAT 方向<select name="natDir"><option value="">—</option>${NAT_DIRS.map(v=>`<option ${a.natDir===v?'selected':''}>${v}</option>`).join('')}</select></label><label>映射到内网实IP<input name="realIp" value="${esc(a.realIp)}" placeholder="10.199.x.x，多个用 / 分隔"></label><label>负责人 / 项目经理<input name="owner" value="${esc(a.owner)}"></label><label>申请单号<input name="ticketNo" value="${esc(a.ticketNo)}"></label><input type="hidden" name="deviceType" value="${esc(a.deviceType||'应用映射')}"><input type="hidden" name="systemName" value="${esc(a.systemName)}"><input type="hidden" name="macAddress" value="${esc(a.macAddress)}"><input type="hidden" name="location" value="${esc(a.location)}">`;
  modal(`${a.status==='已分配'?'修改':'登记'} ${a.ip}`,`${refBox}<div class="form-grid"><label>状态<select name="status">${['可用','已分配','预留','禁用'].map(v=>`<option ${st===v?'selected':''}>${v}</option>`).join('')}</select></label>${pub?pubFields:idcFields}<label class="wide">备注<textarea name="remarks">${esc(a.remarks)}</textarea></label></div>${a.status==='已分配'&&me.role!=='只读用户'?`<p class="ip-note">要释放这个地址，点<a class="ipp-more" onclick="releaseAddress(${a.id},'${a.ip}')">回收</a>：状态改为可用并清空登记信息。</p>`:''}`,async data=>{await api(`/api/addresses/${a.id}`,{method:'PUT',body:JSON.stringify(data)});toast(data.status==='已分配'?`${a.ip} 已登记`:'IP 信息已更新');afterAddressChange(back)})}
function fillFromRef(btn){const f=$('#modalForm');f.status.value='已分配';if(f.hostname&&!f.hostname.value)f.hostname.value=btn.dataset.name;if(f.systemName&&!f.systemName.value)f.systemName.value=btn.dataset.sys}
async function releaseAddress(id,ip){if(!confirm(`回收 ${ip}？状态改为可用，登记的主机 / 应用信息会清空，审计里保留记录。`))return;const back=ipCtx;await api(`/api/addresses/${id}`,{method:'PUT',body:JSON.stringify({status:'可用'})});toast(`${ip} 已回收`);if($('#modal').open)$('#modal').close();afterAddressChange(back)}
function afterAddressChange(back){if(back&&back.id)setTimeout(()=>addresses(back.id,back.cidr),0);else ipRefresh()}
// ---- 公网地址池：从池图直接登记 / 新增映射 / 给待分配申请挑地址 ----
function ppFree(poolId){const m=ppState.maps[poolId];return m?m.addresses.filter(a=>ppKind(a)==='free'):[]}
function publicAddressForm(a,poolId){ipCtx=null;const p=ppState.pools.find(x=>x.id===poolId);
  if(a){const full=ppState.maps[poolId]?.addresses.find(x=>x.id===a.id)||a;return addressForm(full,full.status==='已分配'?undefined:'已分配',true)}
  const free=ppFree(poolId);if(!free.length)return toast('这个池已没有可用地址');
  modal(`新增公网映射 · ${p?p.module:''}`,`<div class="form-grid"><label>公网地址<select name="_ip">${free.map(x=>`<option value="${x.id}">${x.ip}</option>`).join('')}</select></label><label>应用 / 用途<input name="hostname" required></label><label>所属业态 · 部门<input name="business" placeholder="集团 · 通用系统"></label><label class="wide">应用域名<input name="domain"></label><label>NAT 方向<select name="natDir">${NAT_DIRS.map(v=>`<option>${v}</option>`).join('')}</select></label><label>映射到内网实IP<input name="realIp" placeholder="10.199.x.x"></label><label>负责人 / 项目经理<input name="owner"></label><label>申请单号<input name="ticketNo"></label><label class="wide">备注<textarea name="remarks"></textarea></label></div>`,async data=>{const id=Number(data._ip);delete data._ip;await api(`/api/addresses/${id}`,{method:'PUT',body:JSON.stringify({...data,status:'已分配',deviceType:'应用映射'})});toast('公网映射已登记');ipRefresh()})}
async function publicRelease(id,ip,poolId){ipCtx=null;await releaseAddress(id,ip)}
// 分配表里「未分配」的申请：挑一个池里的可用地址登记，并把申请记录改成已分配、写回公网地址
async function publicAssignRequest(recordId){const x=findRow(recordId);if(!x)return toast('记录不存在');const d=x.details||{};const v=k=>String(d[k]??'').trim();
  const opts=ppState.pools.flatMap(p=>ppFree(p.id).slice(0,64).map(a=>`<option value="${a.id}">${a.ip}　${esc(p.module)}</option>`)).join('');if(!opts)return toast('所有地址池都没有可用地址');
  modal(`给「${esc(v('应用备注')||x.name)}」分配公网地址`,`<div class="form-grid"><label class="wide">公网地址<select name="_ip">${opts}</select></label><label>应用 / 用途<input name="hostname" value="${esc(v('应用备注')||x.name)}" required></label><label>所属业态 · 部门<input name="business" value="${esc([v('所属业态'),v('所属部门')].filter(Boolean).join(' · '))}"></label><label class="wide">应用域名<input name="domain" value="${esc(v('应用域名').replace(/\s*\n\s*/g,' / '))}"></label><label>NAT 方向<select name="natDir"><option value="">—</option>${NAT_DIRS.map(o=>`<option ${v('NAT方向')===o?'selected':''}>${o}</option>`).join('')}</select></label><label>映射到内网实IP<input name="realIp" value="${esc(v('实IP').replace(/\s*\n\s*/g,' / '))}"></label><label>负责人 / 项目经理<input name="owner" value="${esc(v('项目经理'))}"></label><label>申请单号<input name="ticketNo"></label><label class="wide">备注<textarea name="remarks">${esc([v('是否保留')==='是'?'搬迁保留':'',v('是否需要网站备案')==='是'?'需网站备案':'',v('备注')].filter(Boolean).join('；'))}</textarea></label></div>`,async data=>{const id=Number(data._ip);delete data._ip;const ip=$('#modalForm')._ip.selectedOptions[0].textContent.split(/\s/)[0];await api(`/api/addresses/${id}`,{method:'PUT',body:JSON.stringify({...data,status:'已分配',deviceType:'应用映射'})});
    const details={...d,'新分配公网IP':ip,'公网地址':ip};await api(`/api/resources/${recordId}`,{method:'PUT',body:JSON.stringify({location:x.location,subcategory:x.subcategory,name:x.name,ip,status:'已分配',details})});x.status='已分配';x.ip=ip;x.details=details;toast(`${ip} 已分配给 ${data.hostname}`);ipRefresh()})}
// 审计日志与意见收集页在 collab.js（loadAudit / loadFeedback）
const userRoles=['管理员','运维人员','只读用户'];
const roleHelp={管理员:'可管理账号、导入资料、删除网段',运维人员:'可维护资产和地址，不能管账号',只读用户:'仅查询，不能改数据'};
let userRowsCache=[];
async function loadUsers(){userRowsCache=await api('/api/users');if(!$('#userRoleTabs').dataset.key)$('#userRoleTabs').dataset.key='全部';renderUsers()}
function renderUsers(){const q=($('#userSearch').value||'').trim().toLowerCase();const key=$('#userRoleTabs').dataset.key||'全部';const disabled=userRowsCache.filter(x=>!x.enabled).length;const counts=Object.fromEntries(userRoles.map(r=>[r,userRowsCache.filter(x=>x.role===r).length]));$('#userRoleSummary').innerHTML=[['全部账号',userRowsCache.length,'当前系统登录账号'],['管理员',counts['管理员']||0,roleHelp['管理员']],['运维人员',counts['运维人员']||0,roleHelp['运维人员']],['只读用户',counts['只读用户']||0,roleHelp['只读用户']],['已停用',disabled,'停用后立即无法登录']].map(([n,v,d])=>`<div class="asset-stat"><small>${n}</small><b>${v}</b><em>${d}</em></div>`).join('');const tabs=[{key:'全部',count:userRowsCache.length},...userRoles.map(r=>({key:r,count:counts[r]||0})),{key:'已停用',count:disabled}];$('#userRoleTabs').innerHTML=tabs.map(t=>`<button type="button" class="${t.key===key?'active':''}" onclick="selectUserRole('${t.key}')">${t.key}<em>${t.count}</em></button>`).join('');const rows=userRowsCache.filter(x=>{const hit=!q||x.username.toLowerCase().includes(q)||(x.displayName||'').toLowerCase().includes(q);if(!hit)return false;if(key==='全部')return true;if(key==='已停用')return !x.enabled;return x.role===key});$('#userRows').innerHTML=rows.map(x=>{const self=x.username===me.username;return `<tr class="${x.enabled?'':'user-disabled'}"><td><b>${esc(x.username)}</b>${self?'<small class="self-mark">当前账号</small>':''}</td><td>${esc(x.displayName)||'-'}</td><td>${userRoleTag(x.role)}</td><td><span class="tag ${x.enabled?'on':'off'}">${x.enabled?(x.mustChangePassword?'待改密':'启用'):'停用'}</span></td><td>${esc(x.createdAt)}</td><td><div class="actions"><button class="secondary" onclick="userForm(${x.id})">编辑</button><button class="secondary" onclick="resetUserPassword(${x.id},'${esc(x.username)}')">重置密码</button>${self?'':`<button class="danger" onclick="toggleUser(${x.id},${x.enabled})">${x.enabled?'停用':'启用'}</button>`}</div></td></tr>`}).join('')||'<tr><td colspan="6">没有符合条件的账号。</td></tr>'}
function userRoleTag(role){const map={管理员:'role-host',运维人员:'role-card',只读用户:'role-part'};return `<span class="role-tag ${map[role]||''}">${esc(role)}</span>`}
function selectUserRole(key){$('#userRoleTabs').dataset.key=key;renderUsers()}
function userForm(id){const x=id?userRowsCache.find(u=>u.id===id):{role:'只读用户',enabled:true};const create=!id;modal(create?'新增账号':'编辑账号',`<div class="form-grid"><label>用户名<input name="username" value="${esc(x.username||'')}" ${create?'required':'readonly'} placeholder="字母数字，如 zhangsan"></label><label>姓名<input name="displayName" value="${esc(x.displayName||'')}" placeholder="可选"></label><label>角色<select name="role">${userRoles.map(r=>`<option ${x.role===r?'selected':''} value="${r}">${r}</option>`).join('')}</select></label>${create?`<label>初始密码<input name="password" type="password" minlength="8" required placeholder="至少 8 位"></label>`:`<label>状态<select name="enabled"><option value="true" ${x.enabled?'selected':''}>启用</option><option value="false" ${x.enabled?'':'selected'}>停用</option></select></label>`}<p class="wide user-role-hint">${userRoles.map(r=>`<span><b>${r}</b> ${roleHelp[r]}</span>`).join('')}</p></div>`,async data=>{if(create){await api('/api/users',{method:'POST',body:JSON.stringify({username:data.username,displayName:data.displayName,role:data.role,password:data.password})});toast('账号已创建，对方首次登录需修改密码')}else{await api(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({displayName:data.displayName,role:data.role,enabled:data.enabled==='true'})});toast('账号已更新')}await loadUsers()})}
async function toggleUser(id,enabled){const x=userRowsCache.find(u=>u.id===id);if(!x)return;if(enabled&&!confirm(`确定停用 ${x.username}？停用后该账号会立即退出。`))return;await api(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({displayName:x.displayName,role:x.role,enabled:!enabled})});toast(enabled?'账号已停用':'账号已启用');await loadUsers()}
function resetUserPassword(id,name){modal(`重置密码 · ${name}`,`<div class="form-grid"><label class="wide">新的临时密码<input name="newPassword" type="password" minlength="8" required placeholder="至少 8 位，对方下次登录必须修改"></label></div>`,async data=>{await api(`/api/users/${id}/reset-password`,{method:'POST',body:JSON.stringify({newPassword:data.newPassword})});toast('密码已重置，对方下次登录需修改')})}
$('#newUser').onclick=()=>userForm();
$('#userSearch').addEventListener('input',renderUsers);
collabBind();
// 智能问答：把大白话变成一次工具调用，答案里的每条记录都能点开核对原始数据
let askBusy=false,askCap=null;
async function askInit(){
  if(!askCap){try{askCap=await api('/api/ask/capability')}catch{askCap={engine:'本地规则',samples:[]}}}
  $('#askEngine').textContent=`当前引擎：${askCap.engine}${askCap.modelReady?(askCap.sendResults?'（结果会发给模型润色）':'（数据不出网：只把问题发给模型，查询结果本地渲染）'):'（未接入大模型，按关键词规则解析）'}`;
  if($('#askLog').children.length)return;
  askPush('bot',`<div class="ask-hello"><h4>想查什么，直接说就行</h4><p>我会把问题翻译成一次数据库查询，答案里的数字全部来自平台记录，不是模型编的。下面几个可以直接点：</p><div class="ask-chips">${(askCap.samples||[]).map(s=>`<button type="button" onclick="askFill(this.textContent)">${esc(s)}</button>`).join('')}</div></div>`);
}
function askFill(s){$('#askBox').value=s;askSubmit()}
function askPush(who,html){const log=$('#askLog');const div=document.createElement('div');div.className='ask-msg '+who;div.innerHTML=html;log.appendChild(div);log.scrollTop=log.scrollHeight;return div}
async function askSubmit(){
  if(askBusy)return;
  const box=$('#askBox'),q=box.value.trim();if(!q)return;
  box.value='';askBusy=true;$('#askSend').disabled=true;
  askPush('me',esc(q));
  const wait=askPush('bot','<div class="ask-wait"><i></i><i></i><i></i> 正在查询资料库…</div>');
  try{
    const a=await api('/api/ask',{method:'POST',body:JSON.stringify({question:q})});
    wait.innerHTML=askRender(a);
  }catch(e){wait.innerHTML=`<div class="ask-err">查询失败：${esc(e.message)}</div>`}
  finally{askBusy=false;$('#askSend').disabled=false;$('#askLog').scrollTop=$('#askLog').scrollHeight}
}
function askRender(a){
  const blocks=(a.blocks||[]).map(b=>`<section class="ask-block"><h5>${esc(b.title)}${b.note?`<em>${esc(b.note)}</em>`:''}</h5><ul>${b.rows.map(r=>{
    const click=r.refId?` onclick="askOpen('${esc(r.refKind||'record')}',${r.refId})"`:'';
    return `<li class="${r.refId?'linked':''} ${r.tone?'t-'+r.tone:''}"${click}><b>${esc(r.text)}</b>${r.sub?`<span>${esc(r.sub)}</span>`:''}</li>`}).join('')}</ul></section>`).join('');
  const tips=(a.tips||[]).map(t=>`<p class="ask-tip">${esc(t)}</p>`).join('');
  return `<div class="ask-answer"><p class="ask-sum">${esc(a.summary)}</p>${blocks}${tips}<div class="ask-meta">${esc(a.tool)} · ${esc(a.engine)}</div></div>`;
}
async function askOpen(kind,id){
  try{
    if(kind==='subnet'){const s=await subnetById(id);if(s)await addresses(s.id,s.cidr);return}
    if(kind==='config'){await viewConfig(id);return}
    // 记录统一走 openRecord：设备类给跨源设备卡，其余给字段卡
    await openRecord(id);
  }catch(e){toast(e.message)}
}
function recordForm(x){const entries=Object.entries(x.details||{});const fields=entries.map(([k,v],i)=>{const value=typeof v==='object'?JSON.stringify(v):String(v??'');const control=value.length>120||value.includes('\n')?`<textarea name="detail_${i}">${esc(value)}</textarea>`:`<input name="detail_${i}" value="${esc(value)}">`;return `<label>${esc(k)}${control}</label>`}).join('');modal(`编辑 · ${x.name}`,`<div class="form-grid"><label>地理位置<select name="location">${['北京总部','燕郊光子机房','集团跨区域','其他区域'].map(v=>`<option ${v===x.location?'selected':''}>${v}</option>`).join('')}</select></label><label>资料表<input name="subcategory" value="${esc(x.subcategory)}"></label></div><div class="form-grid asset-detail-fields">${fields}</div>`,async data=>{const details={};entries.forEach(([k],i)=>details[k]=data[`detail_${i}`]||'');const name=pickDetail(details,nameKeys)||x.name;const ip=pickDetail(details,ipKeys)||x.ip||'';const status=pickDetail(details,statusKeys)||x.status||'';await api(`/api/resources/${x.id}`,{method:'PUT',body:JSON.stringify({location:data.location,subcategory:data.subcategory,name,ip,status,details})});toast('记录已保存');await reloadModule()},true)}
// 模块页工具栏：搜索走服务端（配置全文也能搜到），敲键后稍等再发请求
let searchTimer=0;
$('#resourceSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(curModule)loadModule(curModule.id,curTab?.key)},280)});
$('#locationFilter').addEventListener('change',()=>{if(curModule)loadModule(curModule.id,curTab?.key)});
$('#assetStatusFilter').onchange=()=>{if(curTab?.layout==='asset')drawAssetList()};
// 深链：总览模块卡、设备卡里的「看机架立面」、智能问答都用它跳到某模块某页签
function navModule(id,tab){const btn=$$('nav button').find(b=>b.dataset.module===id);if(!btn)return;$$('nav button').forEach(x=>x.classList.toggle('active',x===btn));$$('.page').forEach(x=>x.classList.add('hidden'));$('#resourcesPage').classList.remove('hidden');if($('#modal').open)$('#modal').close();return loadModule(id,tab)}
function navPlanned(name){const btn=$$('nav button').find(b=>b.dataset.page==='planned'&&b.dataset.module===name);if(btn)btn.click()}
function modal(title,html,onSave,wide=false,saveLabel='保存'){if($('#modal').open)$('#modal').close();$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modalSave').classList.toggle('hidden',!onSave);$('#modalSave').textContent=saveLabel;$('#modalClose').classList.remove('hidden');$('#modalCancel').classList.remove('hidden');$('#modalCancel').textContent=onSave?'取消':'关闭';$('#modal').style.width=wide?'min(1000px,95vw)':'min(680px,92vw)';const form=$('#modalForm');form.onsubmit=async e=>{e.preventDefault();if(!onSave){$('#modal').close();return}try{const data=Object.fromEntries(new FormData(form));await onSave(data);$('#modal').close()}catch(err){toast(err.message)}};$('#modal').showModal()}
$('#modalClose').onclick=$('#modalCancel').onclick=()=>$('#modal').close();
$('#userName').onclick=()=>{if(me?.requireLogin!==false)passwordDialog(false)};
$('#askSend').onclick=askSubmit;
$('#askBox').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askSubmit()}});
$('#askBox').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'});
function passwordDialog(force){modal(force?'首次登录请修改密码':'修改密码',`<div class="form-grid"><label class="wide">当前密码<input type="password" name="currentPassword" required></label><label class="wide">新密码<input type="password" name="newPassword" minlength="8" required></label></div>`,async d=>{await api('/api/change-password',{method:'POST',body:JSON.stringify(d)});me.mustChangePassword=false;toast('密码已修改')});if(force){$('#modalClose').classList.add('hidden');$('#modalCancel').classList.add('hidden')}}
$('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=async e=>{if(!e.target.files[0])return;const f=new FormData();f.append('file',e.target.files[0]);try{const r=await api('/api/import',{method:'POST',body:f});toast(`导入完成：成功 ${r.success}，跳过 ${r.skipped}`);if(r.errors.length)modal('导入检查结果',`<div class="address-list"><ul>${r.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`,null)}catch(err){toast(err.message)}e.target.value=''};
init();
