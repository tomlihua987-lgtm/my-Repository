// 工具页：批量 ping 与网段计算。独立于业务模块（面向全平台），只依赖 app.js 里的 $、api、esc、toast、spStats（views.js）。
// 加载顺序：tools.js → views.js → modules.js → app.js；本文件顶层不执行任何 DOM 操作。
// ================= 工具页 =================
// 批量 ping 的 ICMP 是服务器发的，不是浏览器；掩码计算全在前端用 ipaddr.js（MIT）算，不走后端。

let toolsReady=false, pingHits=[], pingMax=1024;

function selectTool(key){
  for(const b of $$('.tool-tabs button'))b.classList.toggle('active',b.dataset.tool===key);
  $('#toolPing').classList.toggle('hidden',key!=='ping');
  $('#toolMask').classList.toggle('hidden',key!=='mask');
}

async function toolsInit(){
  if(toolsReady)return;
  toolsReady=true;
  for(const b of $$('.tool-tabs button'))b.onclick=()=>selectTool(b.dataset.tool);
  $('#pingTargets').addEventListener('input',pingCount);
  $('#pingRun').onclick=pingRun;
  $('#pingClear').onclick=()=>{$('#pingTargets').value='';$('#pingSource').value='';$('#pingSubnet').value='';pingCount();
    for(const id of ['#pingSummary','#pingNote','#pingResult'])$(id).classList.add('hidden')};
  $('#pingVerdict').onchange=pingRender;
  $('#pingSource').onchange=async e=>{const key=e.target.value;if(!key)return;
    try{const d=await api(`/api/tools/ping/sources/${encodeURIComponent(key)}`);$('#pingTargets').value=d.ips.join('\n');pingCount()}
    catch(err){toast(err.message)}};
  $('#pingSubnet').onchange=e=>{const cidr=e.target.value;if(!cidr)return;
    const box=$('#pingTargets');box.value=(box.value.trim()?box.value.trim()+'\n':'')+cidr;pingCount()};
  $('#maskRun').onclick=maskRun;
  // 输入框是多行的，回车要能换行，所以提交改用 Ctrl+Enter
  $('#maskInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();maskRun()}});
  $('#maskInput').addEventListener('input',maskCount);
  $('#maskClear').onclick=()=>{$('#maskInput').value='';maskCount();
    $('#maskResult').classList.add('hidden');$('#maskError').classList.add('hidden')};
  $('#maskSplit').onchange=maskRun;
  // 只读用户不给发探测：这动作会真往生产网络里打包
  if(me?.role==='只读用户'){$('#pingRun').disabled=true;$('#pingRun').title='只读用户不能发起探测'}

  try{const d=await api('/api/tools/ping/sources');pingMax=d.max||pingMax;
    $('#pingSource').innerHTML='<option value="">选择一类资料…</option>'+
      d.sources.map(x=>`<option value="${esc(x.key)}" title="${esc(x.hint)}">${esc(x.label)}（${x.count}）</option>`).join('')}catch{}
  // ping 目标下拉列全部地址空间的网段（全局 subnets 只是网段管理页当前显示的那一份，不能拿来用）
  try{const all=await api('/api/subnets?kind=all');const label={idc:'IDC',office:'办公网',public:'公网'},order={idc:0,office:1,public:2};
    all.sort((a,b)=>(order[a.kind]??9)-(order[b.kind]??9)||a.networkStart-b.networkStart);
    $('#pingSubnet').innerHTML='<option value="">选择一个网段…</option>'+
      Object.entries(order).map(([k])=>{const list=all.filter(x=>x.kind===k);return list.length?`<optgroup label="${label[k]}">${list.map(x=>`<option value="${esc(x.cidr)}">${esc(x.cidr)} · ${esc(x.zone)}${x.site?' · '+esc(x.site):''}</option>`).join('')}</optgroup>`:''}).join('')}catch{}
  pingCount();
}

// 跟后端 NetTools.ParseTargets 同一套规则，只为在点按钮前给个数量预期；真正的解析以后端为准
function pingParse(text){
  let count=0;const bad=[];
  for(const raw of String(text||'').split(/[\n\r,，;；、 \t]+/)){
    const token=raw.trim();if(!token)continue;
    let m;
    if((m=token.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/))){
      const p=+m[2];if(!v4ok(m[1])||p>32){bad.push(token);continue}
      count+=p>=31?2**(32-p):Math.max(0,2**(32-p)-2);
    }else if((m=token.match(/^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+|\d+)$/))){
      if(!v4ok(m[1])){bad.push(token);continue}
      const from=v4num(m[1]);
      const to=m[2].includes('.')?(v4ok(m[2])?v4num(m[2]):null):((from&0xFFFFFF00)>>>0)|(+m[2]);
      if(to==null||+m[2]>255&&!m[2].includes('.')||to<from){bad.push(token);continue}
      count+=to-from+1;
    }else if(v4ok(token))count++;
    else bad.push(token);
  }
  return {count,bad};
}
function v4ok(s){const p=s.split('.');return p.length===4&&p.every(x=>x!==''&&+x>=0&&+x<=255)}
function v4num(s){return s.split('.').reduce((a,x)=>((a<<8)>>>0)+ +x,0)>>>0}

function pingCount(){
  const {count,bad}=pingParse($('#pingTargets').value);
  const over=count>pingMax;
  $('#pingCount').innerHTML=count
    ?`约 ${count.toLocaleString()} 个地址，重复的会自动去掉${over?`<b class="warn">；超过上限 ${pingMax}，只探前 ${pingMax} 个</b>`:''}${bad.length?`<b class="warn">；${bad.length} 项写法无法识别</b>`:''}`
    :(bad.length?`<b class="warn">${bad.length} 项写法无法识别</b>`:'');
}

async function pingRun(){
  const targets=$('#pingTargets').value.trim();
  if(!targets){toast('先填探测目标');return}
  const btn=$('#pingRun'),label=btn.textContent;
  btn.disabled=true;btn.textContent='探测中…';
  try{
    const d=await api('/api/tools/ping',{method:'POST',body:JSON.stringify({
      targets,timeoutMs:+$('#pingTimeout').value||1000,concurrency:+$('#pingConcurrency').value||32})});
    pingHits=d.results;
    const s=d.summary;
    $('#pingSummary').innerHTML=spStats([
      ['探测地址',s.total,s.truncated?`已截断，实际请求 ${s.requested.toLocaleString()} 个`:'本次实际探测的数量'],
      ['通',s.alive,`占 ${s.total?Math.round(s.alive/s.total*100):0}%`],
      ['不通',s.dead,'含被防火墙拦掉的'],
      ['未登记占用',s.unregistered,'能通但资料库没这条记录'],
      ['资料标在线但不通',s.staleOnline,'资料状态和实际对不上'],
      ['耗时',`${(s.elapsedMs/1000).toFixed(1)} 秒`,`并发 ${$('#pingConcurrency').value}`],
    ]);
    $('#pingSummary').classList.remove('hidden');
    const notes=['<b>ping 不通不等于设备下线</b>：中间防火墙禁 ICMP、设备自己关了 ICMP 响应，都会显示不通，判定前请结合其他手段核实。'];
    if(d.problems.length)notes.push('解析提示：'+d.problems.map(esc).join('；'));
    $('#pingNote').innerHTML=notes.map(x=>`<p>${x}</p>`).join('');
    $('#pingNote').classList.remove('hidden');
    $('#pingVerdict').value='';
    pingRender();
    $('#pingResult').classList.remove('hidden');
  }catch(err){toast(err.message)}
  finally{btn.disabled=false;btn.textContent=label}
}

function pingVerdictTag(v){
  const cls=v==='正常'?'on':v==='未登记占用'?'reserve':v==='无响应'?'':'off';
  return `<span class="tag ${cls}">${esc(v)}</span>`;
}
function pingRender(){
  const want=$('#pingVerdict').value;
  const rows=want?pingHits.filter(x=>x.verdict===want):pingHits;
  $('#pingShown').textContent=want?`${rows.length} / ${pingHits.length} 条`:`共 ${pingHits.length} 条`;
  $('#pingRows').innerHTML=rows.length?rows.map(x=>`<tr>
    <td><b>${esc(x.ip)}</b></td>
    <td><span class="tag ${x.alive?'on':'off'}">${x.alive?'通':'不通'}</span></td>
    <td>${x.alive?`${x.rtt} ms`:esc(x.detail)}</td>
    <td>${pingVerdictTag(x.verdict)}</td>
    <td>${esc(x.name)||'<span class="sp-zero">未登记</span>'}</td>
    <td>${esc(x.category)||'-'}</td>
    <td>${esc(x.registered)||'-'}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">没有符合条件的结果</td></tr>';
}

// ---------- 子网掩码计算（ipaddr.js，MIT，见 /vendor/ipaddr.js.LICENSE）----------

// 支持 10.1.1.0/24、10.1.1.7/255.255.255.0、裸地址（当作 /32 或 /128）、以及 IPv6
function maskParse(text){
  const raw=String(text||'').trim();
  if(!raw)throw new Error('先填一个网段或地址');
  let addr,prefix;
  if(raw.includes('/')){
    const [head,tail]=raw.split('/');
    addr=ipaddr.parse(head.trim());
    if(/^\d+$/.test(tail.trim()))prefix=+tail.trim();
    else{
      // 点分十进制掩码：255.255.255.0 这种写法换算成前缀长度
      const m=ipaddr.parse(tail.trim());
      if(m.kind()!==addr.kind())throw new Error('地址和掩码不是同一种协议');
      prefix=m.prefixLengthFromSubnetMask();
      if(prefix===null)throw new Error(`${tail.trim()} 不是连续的子网掩码`);
    }
  }else{addr=ipaddr.parse(raw);prefix=addr.kind()==='ipv4'?32:128}
  const bits=addr.kind()==='ipv4'?32:128;
  if(!(prefix>=0&&prefix<=bits))throw new Error(`前缀长度要在 0 到 ${bits} 之间`);
  return {addr,prefix,bits,v4:addr.kind()==='ipv4'};
}
function maskBig(addr){return addr.toByteArray().reduce((a,b)=>(a<<8n)+BigInt(b),0n)}
function maskText(big,v4){
  if(v4)return [24n,16n,8n,0n].map(sh=>Number((big>>sh)&255n)).join('.');
  const parts=[];for(let i=7;i>=0;i--)parts.push(Number((big>>BigInt(i*16))&0xFFFFn));
  return ipaddr.fromByteArray(parts.flatMap(x=>[x>>8,x&255])).toString();
}
function maskTokens(){return $('#maskInput').value.split(/[\n\r,，;；、 \t]+/).map(x=>x.trim()).filter(Boolean)}
function maskCount(){
  const n=maskTokens().length;
  $('#maskCount').innerHTML=n>1
    ?`共 ${n} 个网段，并排成表格对比，点行看占用明细${n>64?'<b class="warn">；一次最多查 64 个</b>':''}`
    :'单个网段给完整计算结果，多个则并排成表格对比，点行看占用明细';
}

async function maskRun(){
  const tokens=maskTokens();
  const err=$('#maskError'),out=$('#maskResult');
  $('#maskSplitBox').classList.toggle('hidden',tokens.length>1);
  if(!tokens.length){err.textContent='先填一个网段或地址';err.classList.remove('hidden');out.classList.add('hidden');return}
  return tokens.length===1?maskSingle():maskMany();
}

async function maskSingle(){
  const err=$('#maskError'),out=$('#maskResult');
  let info;
  try{info=maskParse($('#maskInput').value.trim())}
  catch(e){err.textContent=e.message.includes('ipaddr')||/Invalid/i.test(e.message)?'地址格式不认识，检查一下有没有写错':e.message;
    err.classList.remove('hidden');out.classList.add('hidden');return}
  err.classList.add('hidden');

  const {addr,prefix,bits,v4}=info;
  // 单个 IPv4 地址（裸写或 /32）就是「查 IP」：归属网段、地址表登记、资料库占用一次给全，和 IP 模块里的「查 IP」同一份结果
  const single=v4&&prefix===32;
  const total=2n**BigInt(bits-prefix);
  const full=(1n<<BigInt(bits))-1n;
  const maskBits=prefix===0?0n:((full>>BigInt(bits-prefix))<<BigInt(bits-prefix))&full;
  const net=maskBig(addr)&maskBits, last=net|(full^maskBits);
  // /31、/32 没有网络号和广播的说法，整段都能用；IPv6 也不存在广播
  const usable=v4?(prefix>=31?total:(total>2n?total-2n:0n)):total;
  const first=v4&&prefix<31?net+1n:net, end=v4&&prefix<31?last-1n:last;

  const rows=[['网络地址',maskText(net,v4)+`/${prefix}`],['前缀长度','/'+prefix]];
  if(v4){
    rows.push(['子网掩码',maskText(maskBits,v4)],['反掩码（通配符）',maskText(full^maskBits,v4)],
      ['广播地址',prefix>=31?'—（/'+prefix+' 无广播地址）':maskText(last,v4)]);
  }
  rows.push(['地址总数',total.toLocaleString()],['可用地址数',usable.toLocaleString()],
    ['可用区间',usable>0n?`${maskText(first,v4)} ~ ${maskText(end,v4)}`:'—','wide'],
    ['地址类型',maskRange(addr),'plain']);
  if(v4)rows.push(['掩码二进制',maskBinary(maskBits),'wide']);

  let html=`<div class="panel tool-panel"><div class="panel-head"><h3>${esc(maskText(net,v4))}/${prefix}</h3><span>${v4?'IPv4':'IPv6'}</span></div>
    <div class="tool-grid">${rows.map(([k,v,cls])=>`<div class="tool-cell ${cls||''}"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div></div>`;
  html+=maskSubnets(net,prefix,bits,v4);
  out.innerHTML=html;out.classList.remove('hidden');
  maskFillSplit(prefix,bits);
  if(!v4){out.insertAdjacentHTML('beforeend','<div class="tool-note">两张 IP 资料表登记的都是 IPv4 网段，IPv6 无法比对登记和占用情况。</div>');return}
  // 登记和占用要查资料库，前端算不出来；先把计算结果显示出来，查回来再补上，别让人干等
  const ipText=maskText(net,true);
  if(single){
    try{const r=await api(`/api/lookup?ip=${encodeURIComponent(ipText)}`);
      out.insertAdjacentHTML('afterbegin',`<div class="panel tool-panel lk-inline"><div class="panel-head"><h3>查 IP · ${esc(r.ip)}</h3><span>${r.subnet?`落在 ${esc(IP_KIND_LABEL[r.subnet.kind]||r.subnet.kind)} 的 ${esc(r.subnet.cidr)}`:'不在任何已管理的网段内'}${r.address?` · 地址表登记为「${esc(r.address.status)}」`:''}</span></div>${ipLookupHtml(r,{inline:true})}</div>`)}
    catch(err2){out.insertAdjacentHTML('afterbegin',`<div class="tool-note bad"><p>查 IP 失败：${esc(err2.message)}</p></div>`)}
    return}
  try{
    const d=await api('/api/tools/subnets',{method:'POST',body:JSON.stringify({cidrs:`${ipText}/${prefix}`})});
    const row=d.results[0];
    if(row)out.insertAdjacentHTML('afterbegin',maskRegCard(row)+maskDeviceCard(row));
  }catch(err2){out.insertAdjacentHTML('beforeend',`<div class="tool-note bad"><p>登记和占用情况查询失败：${esc(err2.message)}</p></div>`)}
}

// IP 资料一共两张表（IDC 网段规划表、北京及各地表），存法不同但都得查，只看一张会把另一张的网段判成未登记
function maskRegCard(row){
  const regs=row.registrations||[];
  if(!regs.length)return `<div class="tool-note"><p>两张 IP 资料表里都没有登记与 <b>${esc(row.cidr)}</b> 相关的网段，这一段目前是空白的。</p></div>`;
  const exact=regs.find(r=>r.match==='完全一致');
  return `<div class="panel tool-panel"><div class="panel-head"><h3>登记情况</h3>
    <span>${exact?'已登记，写法完全一致':`命中 ${regs.length} 处，但没有完全一致的条目`}</span></div>
    <div class="tool-hits">${regs.map(r=>`<div class="tool-hit ${r.match==='完全一致'?'same':'clash'}">
      <b>${esc(r.text)}</b><span>${esc(r.table)} · ${esc(r.sheet)}</span>
      <em>${esc(maskRegMeta(r))}</em></div>`).join('')}</div></div>`;
}
// zone/module 里常常已经写着「预留」，status 再拼一遍就成了「预留 · 预留」
function maskRegMeta(r){
  const parts=[r.match,r.where,r.status].filter(Boolean).join(' · ').split(' · ');
  return [...new Set(parts.filter(Boolean))].join(' · ');
}
function maskDeviceCard(row){
  if(!row.devices?.length)return `<div class="tool-note"><p>资料库里没有查到这个网段内的占用地址。</p></div>`;
  return `<div class="panel tool-panel"><div class="panel-head"><h3>已占用 ${row.usedAddresses} 个地址</h3>
    <span>可用 ${row.usable} 个 · 使用率 ${maskPct(row)} · 来自 ${row.recordCount} 条资料记录</span></div>
    <div class="table-wrap"><table><thead><tr><th>IP 地址</th><th>名称</th><th>身份</th><th>分类</th><th>来源表</th><th>状态</th></tr></thead>
    <tbody>${row.devices.map(maskDeviceRow).join('')}</tbody></table></div></div>`;
}
function maskDeviceRow(x){
  return `<tr><td><b>${esc(x.ip)}</b></td><td>${esc(x.name)}</td><td>${esc(x.role)}</td>
    <td>${esc(x.category)}</td><td>${esc(x.sub)||'-'}</td><td>${x.status?spTag(x.status):'-'}</td></tr>`;
}
function maskPct(row){return row.usable>0?`${(row.usedAddresses/row.usable*100).toFixed(1)}%`:'-'}

async function maskMany(){
  const err=$('#maskError'),out=$('#maskResult'),btn=$('#maskRun'),label=btn.textContent;
  btn.disabled=true;btn.textContent='查询中…';
  try{
    const d=await api('/api/tools/subnets',{method:'POST',body:JSON.stringify({cidrs:$('#maskInput').value})});
    err.classList.add('hidden');
    maskRows=d.results;
    const used=d.results.reduce((a,x)=>a+x.usedAddresses,0);
    const usable=d.results.reduce((a,x)=>a+x.usable,0);
    const unreg=d.results.filter(x=>!x.registrations.length).length;
    const partial=d.results.filter(x=>x.registrations.length&&!x.registrations.some(r=>r.match==='完全一致')).length;
    let html=`<div class="asset-overview">${spStats([
      ['网段数',d.results.length,'本次查询'],
      ['可用地址合计',usable,'已扣除网络号和广播地址'],
      ['已占用',used,`占 ${usable?(used/usable*100).toFixed(1):0}%`],
      ['未登记',unreg,'两张 IP 表里都查不到'],
      ['仅部分重叠',partial,'查到了但没有完全一致的条目'],
    ])}</div>`;
    if(d.problems.length)html+=`<div class="tool-note"><p>解析提示：${d.problems.map(esc).join('；')}</p></div>`;
    html+=`<div class="panel table-wrap"><table><thead><tr>
      <th>网段</th><th>掩码</th><th>可用区间</th><th>可用</th><th>已占用</th><th>使用率</th><th>登记情况</th><th>涉及分类</th></tr></thead>
      <tbody id="maskRows">${d.results.map((x,i)=>maskTableRow(x,i)).join('')}</tbody></table></div>`;
    out.innerHTML=html;out.classList.remove('hidden');
  }catch(e){err.textContent=e.message;err.classList.remove('hidden');out.classList.add('hidden')}
  finally{btn.disabled=false;btn.textContent=label}
}
let maskRows=[];
function maskRegTag(x){
  if(!x.registrations.length)return '<span class="tag off">未登记</span>';
  const exact=x.registrations.find(r=>r.match==='完全一致');
  const r=exact||x.registrations[0];
  const extra=x.registrations.length>1?` +${x.registrations.length-1}`:'';
  return `<span class="tag ${exact?'on':'reserve'}">${esc(r.match)}</span><small class="tool-sub">${esc(r.table)} · ${esc(r.sheet)}${extra}</small>`;
}
function maskTableRow(x,i){
  return `<tr class="mask-row" onclick="maskExpand(${i})"><td><b>${esc(x.cidr)}</b></td><td>${esc(x.mask)}</td>
    <td><small>${esc(x.range)}</small></td><td>${x.usable}</td>
    <td>${x.usedAddresses?`<b>${x.usedAddresses}</b>`:'<span class="sp-zero">0</span>'}</td>
    <td>${maskPct(x)}</td><td>${maskRegTag(x)}</td><td><small>${esc((x.categories||[]).join('、'))||'-'}</small></td></tr>
    <tr id="maskDetail${i}" class="hidden"><td colspan="8" class="mask-detail"></td></tr>`;
}
function maskExpand(i){
  const cell=$(`#maskDetail${i}`);
  const open=!cell.classList.contains('hidden');
  cell.classList.toggle('hidden',open);
  if(open)return;
  const x=maskRows[i];
  const body=cell.querySelector('.mask-detail');
  body.innerHTML=(x.registrations.length?`<div class="tool-hits">${x.registrations.map(r=>`<div class="tool-hit ${r.match==='完全一致'?'same':'clash'}">
      <b>${esc(r.text)}</b><span>${esc(r.table)} · ${esc(r.sheet)}</span>
      <em>${esc(maskRegMeta(r))}</em></div>`).join('')}</div>`:'<p class="tool-sub">两张 IP 表里都没有登记这一段。</p>')
    +(x.devices.length?`<table class="mask-devices"><thead><tr><th>IP 地址</th><th>名称</th><th>身份</th><th>分类</th><th>来源表</th><th>状态</th></tr></thead>
      <tbody>${x.devices.map(maskDeviceRow).join('')}</tbody></table>`:'<p class="tool-sub">资料库里没有查到这个网段内的占用地址。</p>');
}
function maskRange(addr){
  const names={unicast:'公网单播',private:'私有地址（RFC1918）',loopback:'环回',linkLocal:'链路本地',
    multicast:'组播',broadcast:'广播',reserved:'保留',unspecified:'未指定',carrierGradeNat:'运营商级 NAT',
    uniqueLocal:'唯一本地地址（ULA）',ipv4Mapped:'IPv4 映射',rfc6145:'RFC6145',rfc6052:'RFC6052',
    '6to4':'6to4',teredo:'Teredo',as112:'AS112',amt:'AMT'};
  const r=addr.range();return names[r]||r;
}
function maskBinary(big){
  return [24n,16n,8n,0n].map(sh=>Number((big>>sh)&255n).toString(2).padStart(8,'0')).join('.');
}
function maskFillSplit(prefix,bits){
  const sel=$('#maskSplit'),keep=sel.value;
  const opts=[];
  for(let p=prefix+1;p<=Math.min(prefix+8,bits);p++)opts.push(`<option value="${p}">拆成 /${p}（${2**(p-prefix)} 段）</option>`);
  sel.innerHTML='<option value="">不拆分</option>'+opts.join('');
  if(keep&&opts.some(o=>o.includes(`value="${keep}"`)))sel.value=keep;
}
function maskSubnets(net,prefix,bits,v4){
  const target=+$('#maskSplit').value;
  if(!target||target<=prefix||target>bits)return '';
  const step=2n**BigInt(bits-target), count=2n**BigInt(target-prefix);
  const show=count>256n?256n:count;
  let html=`<div class="panel tool-panel"><div class="panel-head"><h3>拆分成 /${target}</h3>
    <span>共 ${count.toLocaleString()} 段${count>show?`，下面只列前 ${show}`:''}</span></div><div class="tool-splits">`;
  for(let i=0n;i<show;i++){
    const s=net+i*step, e=s+step-1n;
    html+=`<div class="tool-split"><b>${esc(maskText(s,v4))}/${target}</b><small>${esc(maskText(s,v4))} ~ ${esc(maskText(e,v4))}</small></div>`;
  }
  return html+'</div></div>';
}
