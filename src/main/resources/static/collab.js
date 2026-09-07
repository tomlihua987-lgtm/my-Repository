// 协同研发：意见收集（/api/feedback）与审计日志（/api/audit）两个页面。
// 依赖 app.js 里的 $ / api / modal / toast / esc / me，只在页面切换后被调用，不在加载时执行。

// ===== 公用小工具 =====
const fmtSize=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
const whoName=x=>x.displayName||x.userName||'';
const whoBoth=x=>x.displayName?`${esc(x.displayName)}<small>${esc(x.userName)}</small>`:esc(x.userName);
const avatar=x=>`<i class="fb-avatar">${esc((x.displayName||x.userName||'?').slice(0,1))}</i>`;
const nl=s=>esc(s).replace(/\n/g,'<br>');
const debounce=(fn,ms)=>{let t=0;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};

// ===== 意见收集 =====
let fbStats=null,fbRows=[],fbCategory='';
const FB_STATUS_CLASS={待处理:'wait',处理中:'doing',已采纳:'ok',已完成:'done',暂不处理:'skip'};
const fbStatusTag=s=>`<span class="fb-status ${FB_STATUS_CLASS[s]||''}">${esc(s)}</span>`;
const fbCatTag=c=>`<span class="fb-cat">${esc(c)}</span>`;

async function loadFeedback(){
  const q=$('#fbSearch').value.trim(),status=$('#fbStatus').value,mine=$('#fbScope').value;
  const [stats,rows]=await Promise.all([api('/api/feedback/stats'),api(`/api/feedback?q=${encodeURIComponent(q)}&category=${encodeURIComponent(fbCategory)}&status=${encodeURIComponent(status)}&mine=${mine}&limit=500`)]);
  fbStats=stats;fbRows=rows;
  if($('#fbStatus').options.length<=1)$('#fbStatus').insertAdjacentHTML('beforeend',stats.statuses.map(s=>`<option>${s}</option>`).join(''));
  renderFeedback();
}
function renderFeedback(){
  const s=fbStats,bs=s.byStatus||{};
  $('#fbSummary').innerHTML=[
    ['全部意见',s.total,`${s.contributors} 人参与 · ${s.comments} 条回复`],
    ['待处理',bs['待处理']||0,'等管理员认领'],
    ['处理中',bs['处理中']||0,'已在排期或开发'],
    ['已采纳 / 完成',(bs['已采纳']||0)+(bs['已完成']||0),`暂不处理 ${bs['暂不处理']||0}`],
    ['我提交的',s.mine,'点右侧「只看我提交的」筛选'],
    ['附件',s.files,`截图 ${s.images} · 文件 ${s.files-s.images}`]
  ].map(([n,v,d])=>`<div class="asset-stat"><small>${n}</small><b>${v}</b><em>${d}</em></div>`).join('');
  const tabs=[{key:'',label:'全部',count:s.total},...s.categories.map(c=>({key:c,label:c,count:(s.byCategory||{})[c]||0}))];
  $('#fbTabs').innerHTML=tabs.map(t=>`<button type="button" class="${t.key===fbCategory?'active':''}" onclick="fbSelectCategory('${esc(t.key)}')">${esc(t.label)}<em>${t.count}</em></button>`).join('');
  $('#fbList').innerHTML=fbRows.length?fbRows.map(fbCard).join(''):`<div class="fb-empty"><h4>还没有${fbCategory||''}意见</h4><p>用起来哪里别扭、哪个数据不对、想加什么功能，都可以直接告诉研发人员。不会描述也没关系，写一句标题并附上截图即可。</p><button type="button" onclick="fbNewForm()">填写第一条意见</button></div>`;
}
function fbSelectCategory(c){fbCategory=c;loadFeedback()}
function fbCard(x){
  const images=x.files.filter(f=>f.isImage),docs=x.files.filter(f=>!f.isImage);
  const mineOrAdmin=me&&(me.role==='管理员'||me.username===x.userName);
  return `<article class="fb-card" onclick="openFeedback(${x.id})">
    <header>${fbCatTag(x.category)}${x.module?`<span class="fb-module">${esc(x.module)}</span>`:''}${fbStatusTag(x.status)}<b>${esc(x.title)}</b><span class="fb-id">#${x.id}</span></header>
    <div class="fb-meta">${avatar(x)}<span class="fb-who">${whoBoth(x)}</span><time>${esc(x.createdAt)}</time>${x.commentCount?`<em>${x.commentCount} 条回复</em>`:''}${x.handler?`<em>由 ${esc(x.handler)} 处理${x.handledAt?' · '+esc(x.handledAt):''}</em>`:''}</div>
    ${x.content?`<p class="fb-text">${nl(x.content)}</p>`:''}
    ${images.length?`<div class="fb-thumbs">${images.map(f=>`<a href="${f.url}" target="_blank" title="${esc(f.fileName)}" onclick="event.stopPropagation();event.preventDefault();fbLightbox('${f.url}','${esc(f.fileName)}')"><img src="${f.url}" alt="${esc(f.fileName)}" loading="lazy"></a>`).join('')}</div>`:''}
    ${docs.length?`<div class="fb-files">${docs.map(f=>`<a class="fb-file" href="${f.url}?download=1" onclick="event.stopPropagation()" title="下载"><i>${esc((f.fileName.split('.').pop()||'').toUpperCase().slice(0,5))}</i>${esc(f.fileName)}<small>${fmtSize(f.size)}</small></a>`).join('')}</div>`:''}
    ${x.handleNote?`<p class="fb-note"><b>处理意见</b>${nl(x.handleNote)}</p>`:''}
    <footer><button type="button" class="secondary" onclick="event.stopPropagation();openFeedback(${x.id})">查看 / 回复</button>${me&&me.role==='管理员'?`<button type="button" class="secondary" onclick="event.stopPropagation();fbHandleForm(${x.id})">处理</button>`:''}${mineOrAdmin?`<button type="button" class="danger" onclick="event.stopPropagation();deleteFeedback(${x.id})">删除</button>`:''}</footer>
  </article>`;
}
// 附件列表和缩略图渲染，详情弹窗和卡片共用
function fbAttachments(x,big){
  const images=x.files.filter(f=>f.isImage),docs=x.files.filter(f=>!f.isImage);
  return `${images.length?`<div class="fb-thumbs ${big?'big':''}">${images.map(f=>`<a href="${f.url}" onclick="event.preventDefault();fbLightbox('${f.url}','${esc(f.fileName)}')" title="${esc(f.fileName)}"><img src="${f.url}" alt="${esc(f.fileName)}"></a>`).join('')}</div>`:''}
    ${docs.length?`<div class="fb-files">${docs.map(f=>`<a class="fb-file" href="${f.url}?download=1" title="下载"><i>${esc((f.fileName.split('.').pop()||'').toUpperCase().slice(0,5))}</i>${esc(f.fileName)}<small>${fmtSize(f.size)}</small></a>`).join('')}</div>`:''}`;
}
function fbLightbox(url,name){
  const box=document.createElement('div');box.className='fb-lightbox';box.innerHTML=`<img src="${url}" alt="${esc(name)}"><span>${esc(name)}　·　点击任意处关闭　·　<a href="${url}?download=1" onclick="event.stopPropagation()">下载原图</a></span>`;
  box.onclick=()=>box.remove();document.body.appendChild(box);
}
async function openFeedback(id){
  let x;try{x=await api(`/api/feedback/${id}`)}catch(e){return toast(e.message)}
  const admin=me&&me.role==='管理员',mineOrAdmin=admin||me.username===x.userName;
  const comments=(x.comments||[]).map(c=>`<li>${avatar(c)}<div><b>${whoBoth(c)}<time>${esc(c.createdAt)}</time></b><p>${nl(c.content)}</p></div></li>`).join('');
  modal(`意见 #${x.id}`,`<div class="fb-detail">
    <header>${fbCatTag(x.category)}${x.module?`<span class="fb-module">${esc(x.module)}</span>`:''}${fbStatusTag(x.status)}<h4>${esc(x.title)}</h4></header>
    <div class="fb-meta">${avatar(x)}<span class="fb-who">${whoBoth(x)}</span><time>提交于 ${esc(x.createdAt)}</time></div>
    ${x.content?`<div class="fb-body">${nl(x.content)}</div>`:'<div class="fb-body fb-muted">（没有文字说明，见附件）</div>'}
    ${fbAttachments(x,true)}
    ${x.handler||x.handleNote?`<div class="fb-handle"><b>处理情况</b><span>${fbStatusTag(x.status)} ${esc(x.handler||'')}${x.handledAt?' · '+esc(x.handledAt):''}</span>${x.handleNote?`<p>${nl(x.handleNote)}</p>`:''}</div>`:''}
    <section class="fb-comments"><h5>讨论<em>${(x.comments||[]).length}</em></h5><ul>${comments||'<li class="fb-muted">还没有回复。</li>'}</ul>
      <div class="fb-reply"><textarea id="fbReplyBox" rows="2" placeholder="补充说明、追问或者反馈处理结果…"></textarea><button type="button" onclick="fbReply(${x.id})">回复</button></div></section>
    <div class="sa-actions">${admin?`<button type="button" class="primary" onclick="fbHandleForm(${x.id})">处理 / 改状态</button>`:''}${mineOrAdmin?`<button type="button" class="danger" onclick="deleteFeedback(${x.id})">删除</button>`:''}</div>
  </div>`,null,true);
}
async function fbReply(id){
  const box=$('#fbReplyBox'),text=(box.value||'').trim();if(!text)return toast('先写点内容');
  try{await api(`/api/feedback/${id}/comments`,{method:'POST',body:JSON.stringify({content:text})});toast('已回复');await openFeedback(id);loadFeedback()}catch(e){toast(e.message)}
}
function fbHandleForm(id){
  const x=fbRows.find(r=>r.id===id);const cur=x?x.status:'待处理';
  modal(`处理意见 #${id}`,`<div class="form-grid"><label>状态<select name="status">${(fbStats?.statuses||[]).map(s=>`<option ${s===cur?'selected':''}>${s}</option>`).join('')}</select></label><label class="wide">处理意见（提交人和所有人都能看到）<textarea name="note" rows="4" placeholder="怎么处理的、为什么暂不处理、预计什么时候上">${esc(x?.handleNote||'')}</textarea></label></div>`,async d=>{await api(`/api/feedback/${id}/status`,{method:'PUT',body:JSON.stringify({status:d.status,note:d.note})});toast('已更新处理状态');await loadFeedback()});
}
async function deleteFeedback(id){
  if(!confirm(`删除意见 #${id}？附件一起删除，审计里保留摘要。`))return;
  try{await api(`/api/feedback/${id}`,{method:'DELETE'});toast('已删除');if($('#modal').open)$('#modal').close();await loadFeedback()}catch(e){toast(e.message)}
}
// 提交表单：文件走原生 <input type=file multiple>，onSave 里直接从表单拼 FormData，不经过 modal 默认的 Object.fromEntries
function fbNewForm(){
  const cats=fbStats?.categories||['功能建议','问题反馈','数据纠错','界面体验','其他'];
  const mods=[...(typeof MODULES!=='undefined'?MODULES.map(m=>m.title):[]),'智能问答','工具','账号管理','审计日志','平台整体','其他'];
  modal('提交新意见',`<div class="form-grid">
    <label>意见类型<select name="category">${cats.map(c=>`<option>${c}</option>`).join('')}</select><small class="fb-hint">不确定时保持默认“功能建议”即可</small></label>
    <label>涉及哪个功能<select name="module"><option value="">不限 / 平台整体</option>${mods.map(m=>`<option>${m}</option>`).join('')}</select><small class="fb-hint">不知道属于哪里时可不选</small></label>
    <label class="wide">标题（必填）<input name="title" required minlength="2" maxlength="120" placeholder="用一句话说明，如：网段方格图想支持按负责人筛选"><small class="fb-hint">至少填写 2 个字，让研发人员一眼看懂是什么事情</small></label>
    <label class="wide">详细说明（选填）<textarea name="content" rows="6" placeholder="可以写：现在是什么样、希望变成什么样；如果是问题，请写当时点了哪里、看到了什么提示。"></textarea></label>
    <label class="wide">上传截图或文件（选填）<input type="file" name="files" id="fbFiles" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.log,.cfg,.conf,.zip,.7z,.rar,.vsd,.vsdx,.xmind,.mp4"><small class="fb-hint">可一次选择多个文件，最多 10 个、单个 30 MB。图片会直接显示，文档和压缩包可下载。请勿上传账号、密码或密钥。</small><div id="fbFilePreview" class="fb-preview"></div></label>
  </div>`,async()=>{
    const form=$('#modalForm'),fd=new FormData();
    fd.append('category',form.category.value);fd.append('module',form.module.value);fd.append('title',form.title.value);fd.append('content',form.content.value);
    for(const f of form.files.files)fd.append('files',f,f.name);
    await api('/api/feedback',{method:'POST',body:fd});toast('已提交，感谢建议');fbCategory='';await loadFeedback();
  },false,'提交意见');
  $('#fbFiles').onchange=e=>{const files=[...e.target.files];$('#fbFilePreview').innerHTML=files.map(f=>f.type.startsWith('image/')?`<span class="fb-pv"><img src="${URL.createObjectURL(f)}" alt=""><small>${esc(f.name)}</small></span>`:`<span class="fb-pv doc"><i>${esc((f.name.split('.').pop()||'').toUpperCase().slice(0,5))}</i><small>${esc(f.name)} · ${fmtSize(f.size)}</small></span>`).join('')};
}
// ===== 审计日志 =====
// 对象类型 → 页签分组：数据变更（默认）/ 账号与登录 / 工具与查询 / 协同意见
const AU_GROUP={账号:'account',登录:'account',工具:'tool',智能问答:'tool',IP地址明细:'tool',审计日志:'tool',Excel:'tool',协同意见:'collab'};
const AU_TABS=[{key:'',label:'全部'},{key:'data',label:'数据变更'},{key:'account',label:'账号与登录'},{key:'tool',label:'工具与查询'},{key:'collab',label:'协同意见'}];
const auGroup=x=>AU_GROUP[x.objectType]||'data';
const AU_ACTION_CLASS={新增:'add',分配IP:'add',提交意见:'add',登录:'add',导入:'add',删除:'del',回收IP:'del',删除意见:'del',登录失败:'del',编辑:'mod',更新状态:'mod',处理意见:'mod',重置密码:'mod',修改密码:'mod',划拨:'mod',回收:'mod'};
const auActionTag=a=>`<span class="au-action ${AU_ACTION_CLASS[a]||''}">${esc(a)}</span>`;
let auStats=null,auRows=[],auTab='';

async function loadAudit(){
  const q=$('#auditSearch').value.trim(),user=$('#auditUser').value,action=$('#auditAction').value,from=$('#auditFrom').value,to=$('#auditTo').value;
  const qs=`q=${encodeURIComponent(q)}&user=${encodeURIComponent(user)}&action=${encodeURIComponent(action)}&from=${from}&to=${to}`;
  const [stats,rows]=await Promise.all([api('/api/audit/stats'),api(`/api/audit?${qs}&limit=1000`)]);
  auStats=stats;auRows=rows;
  const keep=(sel,list,fmt)=>{const cur=sel.value;sel.innerHTML=sel.options[0].outerHTML+list.map(fmt).join('');sel.value=cur};
  keep($('#auditUser'),stats.users,u=>`<option value="${esc(u.userName)}">${esc(u.displayName?`${u.displayName}（${u.userName}）`:u.userName)} · ${u.count}</option>`);
  keep($('#auditAction'),stats.actions,a=>`<option value="${esc(a.key)}">${esc(a.key)} · ${a.count}</option>`);
  $('#auditExport').onclick=()=>{location.href=`/api/audit/export.csv?${qs}`};
  renderAudit();
}
function renderAudit(){
  const s=auStats;
  const count=g=>auRows.filter(x=>!g||auGroup(x)===g).length;
  $('#auditSummary').innerHTML=[
    ['累计记录',s.total,'所有变更、登录、工具与意见'],
    ['今日操作',s.today,`${s.todayUsers} 人在线操作`],
    ['近 7 天',s.week,`${s.weekUsers} 人 · ${(s.weekActions||[]).slice(0,3).map(a=>`${a.key} ${a.count}`).join(' · ')||'无'}`],
    ['登录失败（7天）',s.failedLogins7d,s.failedLogins7d?'关注是否有人试密码':'正常'],
    ['当前筛选',auRows.length,auRows.length>=1000?'只显示最近 1000 条，请缩小范围':'条记录'],
    ['最活跃',s.users[0]?whoName(s.users[0]):'—',s.users[0]?`${s.users[0].count} 次 · 最近 ${s.users[0].lastAt}`:'']
  ].map(([n,v,d])=>`<div class="asset-stat"><small>${n}</small><b>${typeof v==='number'?v.toLocaleString():esc(v)}</b><em>${esc(d)}</em></div>`).join('');
  $('#auditTabs').innerHTML=AU_TABS.map(t=>`<button type="button" class="${t.key===auTab?'active':''}" onclick="auSelectTab('${t.key}')">${t.label}<em>${count(t.key)}</em></button>`).join('');
  const rows=auRows.filter(x=>!auTab||auGroup(x)===auTab);
  $('#auditRows').innerHTML=rows.map(x=>`<tr class="asset-row" onclick="auDetail(${x.id})"><td>${esc(x.createdAt)}</td><td class="au-who">${whoBoth(x)}</td><td>${auActionTag(x.action)}</td><td>${esc(x.objectType)}</td><td class="au-key" title="${esc(x.objectKey)}">${esc(x.objectKey)}</td><td>${esc(x.clientIp||'-')}</td><td>${x.before||x.after?`<button type="button" class="secondary" onclick="event.stopPropagation();auDetail(${x.id})">变更内容</button>`:'-'}</td></tr>`).join('')||'<tr><td colspan="7">没有符合条件的记录。</td></tr>';
}
function auSelectTab(k){auTab=k;renderAudit()}
const auParse=s=>{if(!s)return null;try{return JSON.parse(s)}catch{return s}};
const auVal=v=>v===null||v===undefined||v===''?'<span class="au-empty">空</span>':typeof v==='object'?`<code>${esc(JSON.stringify(v))}</code>`:esc(String(v));
// 变更前 / 后都是对象时按字段逐行对比，只有一边时列字段，其他情况直接给原文
function auDiff(before,after){
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(isObj(before)&&isObj(after)){
    const keys=[...new Set([...Object.keys(before),...Object.keys(after)])];
    const rows=keys.map(k=>{const a=before[k],b=after[k],changed=JSON.stringify(a)!==JSON.stringify(b);return `<tr class="${changed?'changed':''}"><td>${esc(k)}</td><td>${auVal(a)}</td><td>${auVal(b)}</td></tr>`});
    const n=keys.filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).length;
    return `<p class="fb-hint">${n?`${n} 个字段有变化，高亮显示`:'字段值没有变化（可能只是重新保存）'}</p><table class="au-diff"><thead><tr><th>字段</th><th>变更前</th><th>变更后</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }
  const one=(title,v)=>v===null||v===undefined?'':isObj(v)?`<h6 class="au-h">${title}</h6><table class="au-diff"><tbody>${Object.entries(v).map(([k,x])=>`<tr><td>${esc(k)}</td><td colspan="2">${auVal(x)}</td></tr>`).join('')}</tbody></table>`:`<h6 class="au-h">${title}</h6><pre class="au-raw">${esc(typeof v==='string'?v:JSON.stringify(v,null,2))}</pre>`;
  return one('变更前',before)+one('变更后 / 详情',after);
}
function auDetail(id){
  const x=auRows.find(r=>r.id===id);if(!x)return;
  modal(`审计 #${x.id} · ${x.action}`,`<div class="sa-head">${auActionTag(x.action)}<b>${esc(x.objectType)}</b><em>${esc(x.objectKey)}</em></div>
    <div class="dc-kv au-kv"><b>操作人</b><span>${whoBoth(x)}</span><b>时间</b><span>${esc(x.createdAt)}</span><b>来源 IP</b><span>${esc(x.clientIp||'未记录')}</span><b>记录号</b><span>#${x.id}</span></div>
    ${auDiff(auParse(x.before),auParse(x.after))}`,null,true);
}
// 由 app.js 在 $ 就位后调用一次，挂两个页面工具栏的事件
function collabBind(){
  $('#fbNew').onclick=fbNewForm;
  $('#fbGuideNew').onclick=fbNewForm;
  $('#fbSearch').addEventListener('input',debounce(loadFeedback,280));
  $('#fbStatus').onchange=loadFeedback;$('#fbScope').onchange=loadFeedback;
  $('#auditSearch').addEventListener('input',debounce(loadAudit,300));
  for(const id of ['#auditUser','#auditAction','#auditFrom','#auditTo'])$(id).onchange=loadAudit;
}
