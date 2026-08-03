/* ===========================================================
   好康到家 · 杨存工作台 —— 交互层
   =========================================================== */
const KEY = 'hk_yc_workbench_v1';
const DB = {
  d: null,
  load(){
    try{ this.d = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ this.d = {}; }
    this.d.startDate  = this.d.startDate  || todayStr();
    this.d.doneTasks  = this.d.doneTasks  || {};
    this.d.usedScript = this.d.usedScript || {};
    this.d.reviews    = this.d.reviews    || [];
    this.d.myHot      = this.d.myHot      || [];
    return this.d;
  },
  save(){ localStorage.setItem(KEY, JSON.stringify(this.d)); }
};
function todayStr(dt){ const d = dt||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dayDiff(a,b){ return Math.floor((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function $(s,r){ return (r||document).querySelector(s); }
function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
function toast(msg){
  let t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._tm); t._tm = setTimeout(()=>t.classList.remove('on'), 1800);
}
function copy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('已复制到剪贴板'); }catch(e){ toast('复制失败，请手动选择'); }
  document.body.removeChild(ta);
}

/* 当前起号第几天 */
function curDay(){ return Math.max(1, dayDiff(DB.d.startDate, todayStr()) + 1); }
/* 今日文案（30 天循环） */
function todayScript(){ return SCRIPTS[(curDay()-1) % SCRIPTS.length]; }

/* 合并自动化写入的热点 */
function hotspots(){
  const auto = (window.__DAILY__ && window.__DAILY__.list) ? window.__DAILY__ : HOTSPOTS_SEED;
  return { updatedAt: auto.updatedAt || HOTSPOTS_SEED.updatedAt, list: (DB.d.myHot||[]).concat(auto.list) };
}

/* ================= 违禁词检测 ================= */
function scanText(text){
  const hits = [];
  BANNED.forEach(b=>{
    if(b.re){
      b.re.lastIndex = 0; let m;
      while((m = b.re.exec(text)) !== null){ hits.push({s:m.index, e:m.index+m[0].length, raw:m[0], b}); if(m.index===b.re.lastIndex) b.re.lastIndex++; }
    }else{
      let i = text.indexOf(b.w);
      while(i > -1){ hits.push({s:i, e:i+b.w.length, raw:b.w, b}); i = text.indexOf(b.w, i+1); }
    }
  });
  hits.sort((a,x)=> a.s - x.s || (x.e-x.s) - (a.e-a.s));
  const keep = []; let last = -1;
  hits.forEach(h=>{ if(h.s >= last){ keep.push(h); last = h.e; } });
  return keep;
}
function renderChecker(){
  const text = $('#chkInput').value;
  const box = $('#chkOut'), sum = $('#chkSum'), list = $('#chkList');
  if(!text.trim()){
    box.innerHTML = '<span style="color:var(--tx3)">左侧粘贴文案后，这里会实时标出风险词。</span>';
    sum.innerHTML = ''; list.innerHTML = '<div class="empty">暂无风险项</div>'; return;
  }
  const hits = scanText(text);
  let html = '', p = 0;
  hits.forEach(h=>{
    html += esc(text.slice(p, h.s));
    html += '<mark class="'+(h.b.lv==='mid'?'m':'')+'" title="'+esc(h.b.cat)+'">'+esc(h.raw)+'</mark>';
    p = h.e;
  });
  html += esc(text.slice(p));
  box.innerHTML = html.replace(/\n/g,'<br>');

  const high = hits.filter(h=>h.b.lv==='high').length, mid = hits.length - high;
  const n = text.replace(/\s/g,'').length;
  const sec = (n/6.2).toFixed(1);
  sum.innerHTML =
    '<span class="tag '+(high?'t-bad':(mid?'t-warn':'t-ok'))+'">'+(high?'高危 '+high+' 处':(mid?'敏感 '+mid+' 处':'未发现风险'))+'</span>'+
    (high&&mid?'<span class="tag t-warn">敏感 '+mid+' 处</span>':'')+
    '<span class="tag t-gray">'+n+' 字</span>'+
    '<span class="tag '+(sec>17?'t-warn':'t-ok')+'">约 '+sec+' 秒</span>';

  const uniq = {}; hits.forEach(h=>{ uniq[h.b.w] = h.b; });
  const arr = Object.values(uniq);
  list.innerHTML = arr.length ? arr.map(b=>
    '<div class="risk-i"><div class="w"><span class="tag '+(b.lv==='high'?'t-bad':'t-warn')+'">'+(b.lv==='high'?'高危':'敏感')+'</span></div>'+
    '<div class="a"><b>'+esc(b.w)+'</b> <span style="color:var(--tx3)">· '+esc(b.cat)+'</span><br>'+
    '<span class="arrow">→</span> 建议改成：'+esc(b.alt)+'</div></div>').join('')
    : '<div class="empty">✅ 未命中违禁词库，可以发布</div>';
}
function purify(){
  let text = $('#chkInput').value;
  if(!text.trim()) return;
  let n = 0;
  BANNED.forEach(b=>{
    if(b.alt.indexOf('（直接删除）') > -1 || b.alt.indexOf('（不') > -1 || b.alt.indexOf('（口播') > -1) return;
    const rep = b.alt.split(' / ')[0].split('（')[0].trim();
    if(b.re){ b.re.lastIndex = 0; if(b.re.test(text)){ b.re.lastIndex = 0; text = text.replace(b.re, rep); n++; } }
    else if(text.indexOf(b.w) > -1){ text = text.split(b.w).join(rep); n++; }
  });
  $('#chkInput').value = text; renderChecker();
  toast(n ? '已替换 '+n+' 类风险词，请再通读一遍' : '没有可自动替换的词');
}

/* ================= 今日看板 ================= */
function renderToday(){
  const day = curDay(), s = todayScript();
  const allT = STAGES.reduce((a,st)=>a+st.tasks.length,0);
  const doneT = Object.values(DB.d.doneTasks).filter(Boolean).length;
  const stage = STAGES.find(st=>{
    const [a,b] = st.range.replace(/D/g,'').split('—').map(Number);
    return day >= a && day <= b;
  }) || STAGES[3];
  const rv = DB.d.reviews;
  const last7 = rv.slice(0,7);
  const avgF = last7.length ? (last7.reduce((a,r)=>a+(+r.finish||0),0)/last7.length).toFixed(1) : '—';

  $('#kpis').innerHTML = [
    ['🚀','起号第 '+day+' 天', stage.name.split(' · ')[1], Math.min(100, day/90*100)],
    ['✅','任务 '+doneT+'/'+allT, '作战地图完成度', doneT/allT*100],
    ['🎬','已发布 '+rv.length+' 条', '录入复盘的作品数', Math.min(100, rv.length/30*100)],
    ['📈','近7条完播 '+avgF+(avgF==='—'?'':'%'), '目标 ≥45%', avgF==='—'?0:Math.min(100, avgF/45*100)]
  ].map(k=>'<div class="kpi"><div class="k">'+k[0]+' '+k[2]+'</div><div class="v">'+k[1]+'</div>'+
    '<div class="bar"><i style="width:'+k[3]+'%"></i></div></div>').join('');

  $('#todayScript').innerHTML = scriptCard(s, true);

  const wd = new Date().getDay(), idx = wd===0?6:wd-1;
  const w = WEEK_RHYTHM[idx];
  $('#todayRhythm').innerHTML =
    '<div style="font-size:12px;color:var(--tx3)">今天是'+w[0]+'</div>'+
    '<div style="font-size:15px;font-weight:600;margin:4px 0 5px">'+esc(w[1])+'</div>'+
    '<div style="font-size:12.5px;color:var(--tx2)">'+esc(w[2])+'</div>';

  const todo = stage.tasks.filter(t=>!DB.d.doneTasks[t[0]]).slice(0,4);
  $('#todayTasks').innerHTML = '<div style="font-size:12px;color:var(--tx3);margin-bottom:8px">'+
    esc(stage.name)+' <span class="tag t-gray">'+stage.range+'</span></div>'+
    (todo.length ? todo.map(t=>
      '<div class="tk"><input type="checkbox" data-tk="'+t[0]+'"><div><div class="tx">'+esc(t[1])+'</div></div></div>'
    ).join('') : '<div class="empty">本阶段任务已全部完成 🎉</div>');
  bindTasks();

  const h = hotspots().list.slice(0,3);
  $('#todayHot').innerHTML = h.map(x=>
    '<div style="padding:9px 0;border-bottom:1px dashed var(--line-soft)">'+
    '<div style="display:flex;gap:8px;align-items:center"><b style="font-size:13.5px">'+esc(x.t)+'</b>'+heatBar(x.heat)+'</div>'+
    '<div style="font-size:12.5px;color:var(--tx2);margin-top:3px">'+esc(x.idea)+'</div></div>').join('');
}
function heatBar(n){
  let s = '<span class="heat">'; for(let i=1;i<=5;i++) s += '<i class="'+(i<=n?'on':'')+'"></i>'; return s+'</span>';
}

/* ================= 文案卡片 ================= */
function scriptCard(s, big){
  const used = DB.d.usedScript[s.d];
  const n = s.script.length, sec = (n/6.2).toFixed(1);
  return '<div class="sc '+(big?'big ':'')+(s.track==='mom'?'mom':'')+'">'+
    '<div class="sc-h"><div><span class="day">DAY '+s.d+'</span> '+
      '<span class="tag '+(s.track==='kid'?'t-kid':'t-mom')+'">'+(s.track==='kid'?'少儿体态':'产后恢复')+'</span> '+
      (used?'<span class="tag t-ok">已发布</span>':'')+
      '<div style="margin-top:3px"><b>'+esc(s.title)+'</b></div></div>'+
      '<div style="display:flex;gap:6px;flex:0 0 auto">'+
        '<button class="btn sm" data-cp="'+s.d+'">复制</button>'+
        '<button class="btn sm '+(used?'gh':'')+'" data-use="'+s.d+'">'+(used?'取消':'标记已发')+'</button>'+
      '</div></div>'+
    '<div class="body">'+esc(s.script)+'</div>'+
    '<div class="meta"><span class="tag t-gray">'+n+' 字 · 约 '+sec+' 秒</span>'+
      s.tags.map(t=>'<span class="hash">#'+esc(t)+'</span>').join('')+'</div>'+
    '<div class="row"><i>📷 拍摄</i><span>'+esc(s.shoot)+'</span></div>'+
    '<div class="row"><i>🛡 合规</i><span style="color:#a87700">'+esc(s.note)+'</span></div>'+
    '</div>';
}
let scFilter = 'all';
function renderScripts(){
  const list = SCRIPTS.filter(s=>{
    if(scFilter==='kid') return s.track==='kid';
    if(scFilter==='mom') return s.track==='mom';
    if(scFilter==='todo') return !DB.d.usedScript[s.d];
    return true;
  });
  $('#scGrid').innerHTML = list.map(s=>scriptCard(s)).join('');
  $$('[data-cp]').forEach(b=>b.onclick = ()=>{
    const s = SCRIPTS.find(x=>x.d == b.dataset.cp);
    copy(s.script + '\n\n' + s.tags.map(t=>'#'+t).join(' '));
  });
  $$('[data-use]').forEach(b=>b.onclick = ()=>{
    const d = b.dataset.use;
    DB.d.usedScript[d] = !DB.d.usedScript[d]; DB.save(); renderScripts(); renderToday();
  });
  const done = Object.values(DB.d.usedScript).filter(Boolean).length;
  $('#scStat').textContent = '已发布 '+done+' / '+SCRIPTS.length+' 条';
}

/* ================= 作战地图 ================= */
function bindTasks(){
  $$('[data-tk]').forEach(c=>{
    c.checked = !!DB.d.doneTasks[c.dataset.tk];
    c.closest('.tk').classList.toggle('done', c.checked);
    c.onchange = ()=>{
      DB.d.doneTasks[c.dataset.tk] = c.checked; DB.save();
      c.closest('.tk').classList.toggle('done', c.checked);
      renderPlan(); renderToday();
    };
  });
}
function renderPlan(){
  const day = curDay();
  $('#planWrap').innerHTML = STAGES.map((st,i)=>{
    const done = st.tasks.filter(t=>DB.d.doneTasks[t[0]]).length;
    const pct = Math.round(done/st.tasks.length*100);
    const [a,b] = st.range.replace(/D/g,'').split('—').map(Number);
    const cur = day>=a && day<=b;
    return '<div class="stage'+((cur||pct<100)&&i<2||cur?' open':'')+'" data-st="'+i+'">'+
      '<div class="stage-h"><div class="n">'+(i+1)+'</div>'+
      '<div><b>'+esc(st.name)+'</b> '+(cur?'<span class="tag t-brand">进行中</span>':'')+
      '<div class="sub">'+st.range+' · '+esc(st.goal)+'</div></div>'+
      '<div class="pg">'+done+'/'+st.tasks.length+'<div class="bar pgbar"><i style="width:'+pct+'%;background:'+(pct===100?'var(--ok)':'var(--brand)')+'"></i></div></div></div>'+
      '<div class="tasks">'+st.tasks.map(t=>
        '<div class="tk"><input type="checkbox" data-tk="'+t[0]+'"><div><div class="tx">'+esc(t[1])+'</div><div class="tip">💡 '+esc(t[2])+'</div></div></div>'
      ).join('')+'</div></div>';
  }).join('');
  $$('.stage-h').forEach(h=>h.onclick = e=>{ if(e.target.tagName!=='INPUT') h.parentElement.classList.toggle('open'); });
  bindTasks();
  const all = STAGES.reduce((a,s)=>a+s.tasks.length,0);
  const dn = Object.values(DB.d.doneTasks).filter(Boolean).length;
  $('#planStat').textContent = '总进度 '+dn+'/'+all+'（'+Math.round(dn/all*100)+'%）· 今天是第 '+day+' 天';
}

/* ================= 热点雷达 ================= */
function renderHot(){
  const h = hotspots();
  $('#hotTime').textContent = '数据更新：'+h.updatedAt;
  $('#hotGrid').innerHTML = h.list.map((x,i)=>
    '<div class="hot"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">'+
    '<h4>'+esc(x.t)+'</h4>'+heatBar(x.heat||3)+'</div>'+
    '<span class="tag t-gray">'+esc(x.plat||'抖音')+'</span>'+
    '<div class="why"><b>为什么火：</b>'+esc(x.why)+'</div>'+
    '<div class="idea"><b>你的二创角度：</b>'+esc(x.idea)+'</div>'+
    (x.risk?'<div class="rk">⚠ '+esc(x.risk)+'</div>':'')+
    '<div style="margin-top:9px"><button class="btn sm" data-hc="'+i+'">复制二创角度</button></div></div>').join('');
  $$('[data-hc]').forEach(b=>b.onclick = ()=>copy(h.list[b.dataset.hc].idea));
}

/* ================= 复盘 ================= */
function diagnose(d){
  const out = [];
  DIAG_RULES.forEach(r=>{
    const v = +r.get(d) || 0;
    if(!d.play && r.k!=='hook' && r.k!=='finish') return;
    const lv = v >= r.good ? 'ok' : (v >= r.mid ? 'warn' : 'bad');
    out.push({lv, name:r.name, v: v.toFixed(r.unit?2:1)+(r.unit||'%'),
      msg: lv==='ok' ? '表现达标，这一环节可以保持。' : r.badMsg,
      fix: lv==='ok' ? '' : r.fix});
  });
  if(!d.msg || +d.msg===0) out.push({lv:'warn',name:'线索转化',v:'0 条',
    msg:'播放没有变成咨询，结尾缺少下一步动作。',
    fix:'结尾给一个"轻动作"，例如"完整清单在主页合集"或"评估流程置顶了"。注意不要在口播和字幕里出现微信、私信我、加V。'});
  return out;
}
function renderReviewList(){
  const rv = DB.d.reviews;
  $('#rvList').innerHTML = rv.length ? '<div class="tw"><table><thead><tr>'+
    ['日期','平台','标题','播放','3秒','完播','赞','评','藏','粉','线索',''].map(h=>'<th>'+h+'</th>').join('')+
    '</tr></thead><tbody>'+rv.map((r,i)=>'<tr>'+
      '<td>'+esc(r.date)+'</td><td><span class="tag '+(r.plat==='抖音'?'t-gray':'t-mom')+'">'+esc(r.plat)+'</span></td>'+
      '<td style="max-width:230px">'+esc(r.title)+'</td>'+
      '<td>'+r.play+'</td><td>'+r.hook+'%</td><td>'+r.finish+'%</td>'+
      '<td>'+r.like+'</td><td>'+r.comment+'</td><td>'+r.collect+'</td><td>'+r.fans+'</td><td>'+r.msg+'</td>'+
      '<td><button class="btn sm" data-rv="'+i+'">诊断</button> <button class="btn sm" data-rd="'+i+'">删</button></td>'+
    '</tr>').join('')+'</tbody></table></div>'
    : '<div class="empty">还没有复盘记录。发完一条就来填一次，7 天后就能看出规律。</div>';
  $$('[data-rv]').forEach(b=>b.onclick = ()=>showDiag(DB.d.reviews[b.dataset.rv]));
  $$('[data-rd]').forEach(b=>b.onclick = ()=>{ DB.d.reviews.splice(b.dataset.rd,1); DB.save(); renderReviewList(); renderToday(); });
}
function showDiag(d){
  const res = diagnose(d);
  $('#rvDiag').innerHTML = '<div style="margin-bottom:10px"><b style="font-size:15px">'+esc(d.title)+'</b>'+
    '<div style="font-size:12px;color:var(--tx3)">'+esc(d.date)+' · '+esc(d.plat)+' · '+d.play+' 播放</div></div>'+
    res.map(r=>'<div class="diag '+r.lv+'"><b>'+
      (r.lv==='ok'?'✅ ':r.lv==='warn'?'⚠️ ':'❌ ')+r.name+'：'+r.v+'</b>'+
      '<p>'+esc(r.msg)+'</p>'+(r.fix?'<div class="fix"><b>下次这样改：</b>'+esc(r.fix)+'</div>':'')+
    '</div>').join('')+
    '<div class="note" style="margin-top:12px">下一条视频只针对上面第一个 ❌ 做改动，一次改一个变量，才知道是什么起了作用。</div>';
  $('#rvDiag').scrollIntoView({behavior:'smooth', block:'center'});
}

/* ================= SOP ================= */
function renderSop(){
  $('#sopTable').innerHTML = '<div class="tw"><table><thead><tr><th style="width:110px">维度</th><th>抖音 · 好康到家上门私教</th><th>小红书 · 同名号</th></tr></thead><tbody>'+
    PLATFORM_SOP.map(r=>'<tr><td style="color:var(--tx3);font-weight:600">'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join('')+
    '</tbody></table></div>';
  $('#weekTable').innerHTML = '<div class="tw"><table><thead><tr><th style="width:60px">周期</th><th>固定动作</th><th>为什么</th></tr></thead><tbody>'+
    WEEK_RHYTHM.map(r=>'<tr><td style="font-weight:600">'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td style="color:var(--tx2)">'+esc(r[2])+'</td></tr>').join('')+
    '</tbody></table></div>';
  $('#banTable').innerHTML = '<div class="tw"><table><thead><tr><th style="width:150px">风险词</th><th style="width:90px">级别</th><th style="width:100px">分类</th><th>合规替换</th></tr></thead><tbody>'+
    BANNED.map(b=>'<tr><td><b>'+esc(b.w)+'</b></td><td><span class="tag '+(b.lv==='high'?'t-bad':'t-warn')+'">'+(b.lv==='high'?'高危':'敏感')+'</span></td>'+
    '<td style="color:var(--tx3)">'+esc(b.cat)+'</td><td>'+esc(b.alt)+'</td></tr>').join('')+'</tbody></table></div>';
}

/* ================= 导航 ================= */
function go(v){
  $$('.view').forEach(x=>x.classList.toggle('on', x.id==='v-'+v));
  $$('.nav button').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  window.scrollTo({top:0});
  if(v==='today') renderToday();
  if(v==='scripts') renderScripts();
  if(v==='plan') renderPlan();
  if(v==='hot') renderHot();
}

/* ================= init ================= */
window.addEventListener('DOMContentLoaded', ()=>{
  DB.load();
  $$('.nav button').forEach(b=>b.onclick = ()=>go(b.dataset.v));
  $$('.pill').forEach(p=>p.onclick = ()=>{
    $$('.pill').forEach(x=>x.classList.remove('on'));
    p.classList.add('on'); scFilter = p.dataset.f; renderScripts();
  });

  $('#chkInput').addEventListener('input', renderChecker);
  $('#btnPurify').onclick = purify;
  $('#btnClear').onclick = ()=>{ $('#chkInput').value=''; renderChecker(); };
  $('#btnFromToday').onclick = ()=>{ $('#chkInput').value = todayScript().script; renderChecker(); };

  $('#startDate').value = DB.d.startDate;
  $('#startDate').onchange = e=>{ DB.d.startDate = e.target.value; DB.save(); renderToday(); renderPlan(); toast('起号起始日已更新'); };

  $('#rvForm').onsubmit = e=>{
    e.preventDefault();
    const f = e.target, g = n=>f[n].value;
    const rec = {date:g('date')||todayStr(), plat:g('plat'), title:g('title')||'未命名',
      play:+g('play')||0, hook:+g('hook')||0, finish:+g('finish')||0, like:+g('like')||0,
      comment:+g('comment')||0, collect:+g('collect')||0, fans:+g('fans')||0, msg:+g('msg')||0};
    DB.d.reviews.unshift(rec); DB.save();
    f.reset(); f.date.value = todayStr();
    renderReviewList(); renderToday(); showDiag(rec); toast('已生成诊断建议');
  };
  $('#rvForm').date.value = todayStr();

  $('#hotAdd').onclick = ()=>{
    const t = prompt('热点标题（例如：开学季书包话题）'); if(!t) return;
    const idea = prompt('你的二创角度？') || '待补充';
    DB.d.myHot.unshift({t, heat:4, plat:'手动添加', why:'手动记录的热点线索。', idea, risk:''});
    DB.save(); renderHot(); toast('已加入热点雷达');
  };

  $('#btnExport').onclick = ()=>{
    const blob = new Blob([JSON.stringify(DB.d,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '工作台备份-'+todayStr()+'.json'; a.click();
    toast('已导出备份文件');
  };

  renderChecker(); renderReviewList(); renderSop(); go('today');
});
