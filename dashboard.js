(() => {
"use strict";
const $ = id => document.getElementById(id);
const data = window.RETURN_DESK;
const main = $("main");
if (!data) {
  main.innerHTML = '<h1>Dashboard data unavailable</h1><p>Extract the full project folder, then open index.html again.</p>';
  return;
}
const num = n => Number(n).toLocaleString("en-IN");
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct = (n,total) => total ? (100*n/total).toFixed(1)+"%" : "—";
const dayMs = 86400000;
const isoDay = ms => new Date(ms).toISOString().slice(0,10);
const dayTime = day => Date.parse(day.slice(0,10)+"T00:00:00Z");
const dayLabel = (day,year=false) => new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",...(year?{year:"numeric"}:{}),timeZone:"UTC"}).format(dayTime(day));
const endDay = dayTime(data.meta.asOf) - dayMs;
const earliestDay = dayTime(data.history.reduce((a,r)=>r.date<a?r.date:a,data.meta.asOf.slice(0,10)));
const names = {overview:"Overview",queue:"Follow-up queue",segments:"Segment explorer",guide:"Metric guide"};
const state = {page:"overview", period:"28", granularity:"Daily", filtersOpen:false, courier:"", payment:"", reason:"", region:"", group:"courier", segmentSort:"rto", segmentMin:"1", segmentPage:0, search:"", priority:"", qPayment:"", qCourier:"", capacity:String(data.meta.defaultCapacity), qPage:0};
const paths = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  queue:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8m-8 4h8m-8 4h4"/>',
  segments:'<path d="M4 20V6m0 14h17M8 16v-4m5 4V7m5 9v-6"/>',
  book:'<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1zM12 6v14"/>',
  grid:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  filter:'<path d="M3 6h10m4 0h4M3 12h4m4 0h10M3 18h11m4 0h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  box:'<path d="m3 7 9-4 9 4-9 5zM3 7v10l9 5 9-5V7M12 12v10M7.5 5l9 4"/>',
  rto:'<path d="m9 3-6 6 6 6M4 9h10a6 6 0 0 1 0 12h-3"/>',
  recovered:'<path d="m5 12 4 4L20 5"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||""}</svg>`;
document.querySelectorAll("[data-icon]").forEach(e=>e.outerHTML=icon(e.dataset.icon));
$("nav-count").textContent = num(data.queue.length);
const opts = (vals,selected) => vals.map(entry=>{
  const [v,label] = Array.isArray(entry)?entry:[entry,entry];
  return `<option value="${esc(v)}" ${String(v)===String(selected)?"selected":""}>${esc(label)}</option>`;
}).join("");
const select = (key,label,vals) => `<select id="${key}" data-state="${key}" aria-label="${esc(label)}">${opts(vals,state[key])}</select>`;
const button = (action,label,ico="",cl="") => `<button type="button" class="btn ${cl}" data-action="${action}">${ico?icon(ico):""}${label}</button>`;
const field = (label,control)=>`<label>${esc(label)}${control}</label>`;
const uniq = (rows,key) => [...new Set(rows.map(r=>r[key]))].sort((a,b)=>String(a).localeCompare(String(b)));
const filterOptions = (rows,key,all)=>[["",all],...uniq(rows,key)];
const historyMatches = r => (!state.courier||r.courier===state.courier)&&(!state.payment||r.payment===state.payment)&&(!state.reason||r.reason===state.reason)&&(!state.region||r.state===state.region);
const sumRTO = rows => rows.reduce((n,r)=>n+Number(r.outcome==="RTO"),0);
function historyContext(){
  const all = data.history.filter(historyMatches);
  const first = state.period==="all"?earliestDay:endDay-(Number(state.period)-1)*dayMs;
  const lo=isoDay(first),hi=isoDay(endDay);
  const prevLo=isoDay(first-(endDay-first+dayMs));
  const fullPriorPeriod=state.period!=="all"&&dayTime(prevLo)>=earliestDay;
  const open=(data.meta.unresolvedCohorts||[]).filter(r=>historyMatches(r)&&r.date>=lo&&r.date<=hi);
  return {first,end:endDay,open,rows:all.filter(r=>r.date>=lo&&r.date<=hi),previous:fullPriorPeriod?all.filter(r=>r.date>=prevLo&&r.date<lo):[]};
}
function grouped(rows,key){
  const groups=new Map();
  rows.forEach(r=>{
    const k=r[key],g=groups.get(k)||{name:k,total:0,rto:0,recovered:0};
    g.total++;
    if(r.outcome==="RTO")g.rto++;else g.recovered++;
    groups.set(k,g);
  });
  return [...groups.values()].map(g=>({...g,rate:g.rto/g.total})).sort((a,b)=>b.rto-a.rto||b.total-a.total||a.name.localeCompare(b.name));
}
function series(ctx,weekly){
  const span=weekly?7:1, groups=[];
  for(let t=ctx.first;t<=ctx.end;t+=span*dayMs)groups.push({date:isoDay(t),end:isoDay(Math.min(ctx.end,t+(span-1)*dayMs)),rto:0,recovered:0});
  ctx.rows.forEach(r=>{const g=groups[Math.floor((dayTime(r.date)-ctx.first)/(dayMs*span))];if(g)g[r.outcome==="RTO"?"rto":"recovered"]++;});
  return groups;
}
const filterCount = ()=>["courier","payment","reason","region"].filter(k=>state[k]).length;
function head(title,sub,controls=""){
  return `<div class="pagehead"><div><h1>${title}</h1><p>${sub}</p></div>${controls?`<div class="controls">${controls}</div>`:""}</div>`;
}
function historyControls(){
  return select("period","First failure period",[["7","Last 7 days"],["28","Last 28 days"],["56","Last 56 days"],["all","All dates"]])+`<button class="btn" data-action="filters" aria-expanded="${state.filtersOpen}">${icon("filter")}Filters${filterCount()?` (${filterCount()})`:""}</button>`+button("export","Export","download");
}
function filterPanel(){
  if(!state.filtersOpen)return "";
  return `<div class="filters">${field("Courier",select("courier","Historical courier",filterOptions(data.history,"courier","All couriers")))}${field("Payment",select("payment","Historical payment",filterOptions(data.history,"payment","All payments")))}${field("Failure reason",select("reason","Historical first failure",filterOptions(data.history,"reason","All reasons")))}${field("Destination",select("region","Historical destination state",filterOptions(data.history,"state","All states")))}${button("resetHistory","Reset filters")}</div>`;
}
const snapshot = ()=>`<footer class="snapshot"><span>${icon("clock")}Snapshot ${dayLabel(data.meta.asOf,true)} · ${esc(data.meta.asOf.slice(11,16))} IST</span><a href="#guide">Metric definitions</a></footer>`;
function spark(vals,color){
  if(!vals||vals.length<2)return "";
  const max=Math.max(...vals),min=Math.min(...vals);
  const points=vals.map((v,i)=>`${(i/(vals.length-1)*78+1).toFixed(1)},${(28-(v-min)/(max-min||1)*24).toFixed(1)}`).join(" ");
  return `<svg class="metric-spark" viewBox="0 0 80 33" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}
function metric(title,val,foot,ico,color,vals){
  return `<div class="metric" style="--accent:${color}"><div class="metric-title"><span class="metric-ico">${icon(ico)}</span>${title}</div><strong class="metric-value">${val}</strong>${spark(vals,color)}<div class="metric-foot">${foot}</div></div>`;
}
const keyDot = color => `<i class="key" style="--k:${color}"></i>`;
const cyan="#51d7ff",purple="#ae91ff",blue="#58a9ff",amber="#f3c57d";
function deltaRate(rate,prev,total,positiveGood){
  if(state.period==="all"||!total)return "Share of resolved cases";
  const change=rate-prev;
  const tag=change>=0?"+":"−";
  return `<span class="${(change>=0)===positiveGood?"up":"down"}">${tag}${Math.abs(100*change).toFixed(1)} pp</span> vs prior ${state.period} days`;
}
function metrics(ctx){
  const rows=ctx.rows,n=rows.length,r=sumRTO(rows),p=ctx.previous.length,prevR=sumRTO(ctx.previous);
  const ser=series(ctx,false).slice(-14);
  const valDiff=p?(n-p)/p:0;
  return `<div class="metrics">${metric("Resolved cases",num(n),p?`${valDiff>=0?"+":"−"}${Math.abs(valDiff*100).toFixed(1)}% vs prior ${state.period} days`:"In selected cohort","box",blue,ser.map(g=>g.rto+g.recovered))}${metric("NDR-to-RTO rate",pct(r,n),n?deltaRate(r/n,prevR/p,p,false):"No resolved cases","rto",purple,ser.map(g=>g.rto/(g.rto+g.recovered||1)))}${metric("Recovery rate",pct(n-r,n),n?deltaRate((n-r)/n,(p-prevR)/p,p,true):"No resolved cases","recovered",cyan,ser.map(g=>g.recovered/(g.rto+g.recovered||1)))}${metric("Open follow-ups",num(data.queue.length),`<a href="#queue">View snapshot queue</a>`,"queue",amber)}</div>`;
}

function trendCard(ctx){
  const groups=series(ctx,state.granularity==="Weekly");
  const w=window.innerWidth<=680?Math.max(235,main.clientWidth-54):620;
  const h=190,l=32,r=12,t=12,b=26,plotW=w-l-r,plotH=h-t-b;
  const raw=Math.max(1,...groups.map(g=>Math.max(g.rto,g.recovered)))/4;
  const unit=10**Math.floor(Math.log10(raw));
  const step=Math.max(1,Math.ceil(raw/unit)*unit),max=step*4;
  const x=i=>groups.length===1?l+plotW/2:l+i/(groups.length-1)*plotW;
  const y=v=>t+plotH*(1-v/max);
  const points=k=>groups.map((g,i)=>[x(i),y(g[k])]);
  const curve=k=>points(k).map(([xx,yy],i)=>`${i?"L":"M"}${xx.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const area=k=>curve(k)+` L${x(groups.length-1)} ${y(0)} L${l} ${y(0)} Z`;
  const openCases=ctx.open.reduce((total,r)=>total+r.cases,0);
  const maturity=openCases?num(openCases)+" shipments in the shaded period are still open.":"All shipments in this cohort have resolved.";
  const firstOpen=ctx.open.reduce((first,r)=>r.date<first?r.date:first,"9999-12-31");
  const firstOpenGroup=groups.findIndex(g=>g.end>=firstOpen);
  const shadeStart=groups.length===1?l:x(Math.max(0,firstOpenGroup));
  const shade=openCases?`<rect x="${shadeStart}" y="${t}" width="${w-r-shadeStart}" height="${plotH}" fill="#93a9c0" opacity=".09"/><line x1="${shadeStart}" x2="${shadeStart}" y1="${t}" y2="${y(0)}" stroke="#7790aa" stroke-dasharray="3 4"/>`:"";
  const markers=groups.length===1?["rto","recovered"].map(k=>`<circle cx="${x(0)}" cy="${y(groups[0][k])}" r="4" fill="${k==="rto"?purple:cyan}"/>`).join(""):"";
  const grid=Array.from({length:5},(_,i)=>`<line x1="${l}" x2="${w-r}" y1="${y(step*i)}" y2="${y(step*i)}" stroke="#2a3b50" stroke-dasharray="3 5"/><text x="${l-8}" y="${y(step*i)+4}" text-anchor="end">${num(step*i)}</text>`).join("");
  const ticks=[...new Set(Array.from({length:Math.min(6,groups.length)},(_,i)=>Math.round(i*(groups.length-1)/(Math.min(6,groups.length)-1||1))))];
  const labels=ticks.map(i=>`<text x="${x(i)}" y="${h-5}" text-anchor="${i===0?"start":i===groups.length-1?"end":"middle"}">${dayLabel(groups[i].date)}</text>`).join("");
  const info=groups.map((g,i)=>`<rect data-tip="${esc((g.date===g.end?dayLabel(g.date):dayLabel(g.date)+" – "+dayLabel(g.end))+"|Recovered "+num(g.recovered)+"|RTO "+num(g.rto))}" tabindex="0" role="img" aria-label="${esc(dayLabel(g.date)+" to "+dayLabel(g.end)+", "+g.recovered+" recovered, "+g.rto+" returned")}" x="${Math.max(l,x(i)-plotW/(groups.length-1||1)/2)}" y="${t}" width="${Math.min(w-r,x(i)+plotW/(groups.length-1||1)/2)-Math.max(l,x(i)-plotW/(groups.length-1||1)/2)}" height="${plotH}" fill="transparent"/>`).join("");
  return `<article class="card"><div class="cardhead"><div><h2>Outcome trend</h2><p>Resolved shipments by first failed attempt</p></div>${select("granularity","Trend interval",["Daily","Weekly"])}</div><div class="legend"><span>${keyDot(cyan)}Recovered</span><span>${keyDot(purple)}Returned to origin</span></div><div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Counts by first failure date"><defs><linearGradient id="wash-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${cyan}" stop-opacity=".24"/><stop offset="100%" stop-color="${cyan}" stop-opacity="0"/></linearGradient><linearGradient id="wash-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${purple}" stop-opacity=".20"/><stop offset="100%" stop-color="${purple}" stop-opacity=".01"/></linearGradient></defs>${shade}${grid}<path d="${area("recovered")}" fill="url(#wash-c)"/><path d="${area("rto")}" fill="url(#wash-p)"/><path d="${curve("recovered")}" fill="none" stroke="${cyan}" stroke-width="2.4" stroke-linejoin="round"/><path d="${curve("rto")}" fill="none" stroke="${purple}" stroke-width="2.3" stroke-linejoin="round"/>${markers}${labels}${info}</svg></div><p class="card-foot">${maturity}</p></article>`;
}
function donut(ctx){
  const n=ctx.rows.length,r=sumRTO(ctx.rows),rec=n-r, share=n?rec/n:0;
  return `<article class="card"><div class="cardhead"><div><h2>Resolution mix</h2><p>Final outcomes in the selected cohort</p></div></div><div class="donut-body"><div class="donut"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="59" fill="none" stroke="#22384d" stroke-width="1" stroke-dasharray="1 4"/><circle cx="64" cy="64" r="48" fill="none" stroke="${n?purple:"#29384a"}" stroke-width="12"/><circle cx="64" cy="64" r="48" fill="none" stroke="${cyan}" pathLength="100" stroke-dasharray="${(share*100).toFixed(3)} 100" stroke-width="12"/><circle cx="64" cy="64" r="38" fill="none" stroke="#26394e" stroke-width=".8"/></svg><div class="donut-center"><b>${pct(rec,n)}</b><small>recovered</small></div></div><div class="ring-legend"><div><span>${keyDot(cyan)}Recovered</span><strong>${num(rec)}</strong></div><div><span>${keyDot(purple)}RTO</span><strong>${num(r)}</strong></div></div></div></article>`;
}
function drivers(ctx){
  const vals=grouped(ctx.rows,"reason").slice(0,5);
  return `<article class="card"><div class="cardhead"><div><h2>Return drivers</h2><p>Top first-failure reasons by RTO count</p></div><button class="link-btn" data-explore="reason">Explore</button></div>${vals.length?vals.map(v=>`<div class="bar-item"><span>${esc(v.name)}</span><span class="bar-track"><i style="width:${100*v.rto/(vals[0].rto||1)}%"></i></span><b>${num(v.rto)}</b></div>`).join(""):`<p class="empty">No cases in this cohort.</p>`}</article>`;
}
function courierCard(ctx){
  const vals=grouped(ctx.rows,"courier");
  return `<article class="card"><div class="cardhead"><div><h2>Courier performance</h2><p>Resolved NDR cases by delivery partner</p></div><button class="link-btn" data-explore="courier">Explore</button></div><div class="table-scroll"><table><thead><tr><th>Courier</th><th class="num">Resolved</th><th class="num">RTO rate</th></tr></thead><tbody>${vals.map(v=>`<tr><td>${esc(v.name)}</td><td class="num">${num(v.total)}</td><td class="num">${pct(v.rto,v.total)}</td></tr>`).join("")}</tbody></table>${!vals.length?'<p class="empty">No matching couriers.</p>':""}</div></article>`;
}
function overview(){
  const ctx=historyContext();
  return head("Recovery overview",`Failed-delivery outcomes · ${dayLabel(isoDay(ctx.first))} – ${dayLabel(isoDay(ctx.end),true)}`,historyControls())+filterPanel()+metrics(ctx)+`<div class="grid hero">${trendCard(ctx)}${donut(ctx)}</div><div class="grid lower">${drivers(ctx)}${courierCard(ctx)}</div>`+snapshot();
}
const groupNames={courier:"Courier",reason:"Failure reason",payment:"Payment type",state:"State",pin:"PIN code",merchant:"Merchant"};
function segmentsData(){
  const ctx=historyContext(),vals=grouped(ctx.rows,state.group).filter(g=>g.total>=Number(state.segmentMin));
  vals.sort((a,b)=>b[state.segmentSort]-a[state.segmentSort]||b.total-a.total||a.name.localeCompare(b.name));
  return {ctx,vals};
}
function pager(page,pages,type,label){
  return `<div class="tablefoot"><span>${label}</span><div class="controls"><button class="btn" data-step="${type}:-1" ${page===0?"disabled":""}>Previous</button><span>${page+1} / ${Math.max(1,pages)}</span><button class="btn" data-step="${type}:1" ${page+1>=pages?"disabled":""}>Next</button></div></div>`;
}
function segments(){
  const {ctx,vals}=segmentsData(),totalR=sumRTO(ctx.rows);
  const size=10,pages=Math.ceil(vals.length/size);
  state.segmentPage=Math.min(state.segmentPage,Math.max(0,pages-1));
  const visible=vals.slice(state.segmentPage*size,(state.segmentPage+1)*size);
  const table=visible.map(v=>`<tr><td>${esc(v.name)}</td><td class="num">${num(v.total)}</td><td class="num">${num(v.rto)}</td><td class="num">${pct(v.rto,v.total)}</td><td class="num">${pct(v.rto,totalR)}</td><td class="num">${num(v.recovered)}</td></tr>`).join("");
  return head("Segment explorer",`Compare return volume and rates across ${num(ctx.rows.length)} resolved cases · ${dayLabel(isoDay(ctx.first))} – ${dayLabel(isoDay(ctx.end))}`,historyControls())+filterPanel()+`<div class="filters">${field("Group by",select("group","Segment dimension",Object.entries(groupNames)))}${field("Rank by",select("segmentSort","Sort segments",[["rto","RTO count"],["rate","RTO rate"],["total","Resolved volume"]]))}${field("Minimum resolved cases",select("segmentMin","Minimum segment size",["1","25","100","250"]))}</div><article class="card queue-top"><div class="cardhead"><div><h2>${groupNames[state.group]} breakdown</h2><p>Return share uses all RTOs in the filtered cohort.</p></div></div><div class="table-scroll"><table><thead><tr><th>${groupNames[state.group]}</th><th class="num">Resolved</th><th class="num">RTO</th><th class="num">RTO rate</th><th class="num">Return share</th><th class="num">Recovered</th></tr></thead><tbody>${table}</tbody></table></div>${!vals.length?'<p class="empty">No segments meet these filters.</p>':""}${pager(state.segmentPage,pages,"segmentPage",`${num(vals.length)} matching segments`)}</article>`+snapshot();
}
function queueContext(){
  const base=data.queue.filter(r=>(!state.qPayment||r.payment===state.qPayment)&&(!state.qCourier||r.courier===state.qCourier)&&(!state.priority||r.priority===state.priority));
  const assigned=state.capacity==="all"?base:base.slice(0,Number(state.capacity));
  const query=state.search.trim().toLowerCase();
  const rows=query?assigned.filter(r=>[r.id,r.city,r.pin,r.reason,r.action,r.merchant,r.courier].some(v=>String(v).toLowerCase().includes(query))):assigned;
  return {base,assigned,rows};
}
function queue(){
  const {base,assigned,rows}=queueContext();
  const size=10,pages=Math.ceil(rows.length/size);
  state.qPage=Math.min(state.qPage,Math.max(0,pages-1));
  const visible=rows.slice(state.qPage*size,(state.qPage+1)*size);
  return head("Follow-up queue",`Open cases at ${esc(data.meta.asOf.slice(11,16))} IST · ${dayLabel(data.meta.asOf,true)}`,button("export","Export worklist","download","primary"))+
    `<div class="metrics">${metric("Open NDR cases",num(data.meta.openCount),"At the snapshot cutoff","box",blue)}${metric("Actionable",num(data.queue.length),"Forward delivery still open","queue",cyan)}${metric("Held for review",num(data.meta.heldCount),"Latest reason is buyer refusal","rto",purple)}${metric("In this worklist",num(assigned.length),`${num(base.length)} eligible after filters`,"target",amber)}</div>
<div class="filters">${field("Follow-up capacity",select("capacity","Worklist capacity",[["25","Top 25 cases"],["50","Top 50 cases"],["100","Top 100 cases"],["all","All eligible cases"]]))}${field("Priority",select("priority","Follow-up priority",[["","All priorities"],"High","Medium","Standard"]))}${field("Payment",select("qPayment","Queue payment",filterOptions(data.queue,"payment","All payments")))}${field("Courier",select("qCourier","Queue courier",filterOptions(data.queue,"courier","All couriers")))}${button("resetQueue","Reset")}</div>
<article class="card queue-top"><div class="sectionhead"><div><h2>Prioritized worklist</h2><p>Ranked by urgency and time since the latest failed attempt.</p></div><input type="search" id="search" value="${esc(state.search)}" aria-label="Search within worklist" placeholder="Search this worklist…"></div><div class="table-scroll"><table><thead><tr><th>Rank</th><th>Shipment</th><th>Latest failure</th><th>Priority</th><th class="num">Age¹</th><th>Next action</th></tr></thead><tbody>${visible.map(r=>`<tr><td class="rank">${r.rank}</td><td><button class="case-id" data-case="${esc(r.id)}">${esc(r.id)}</button><span class="detailsub">${esc(r.city)} · ${esc(r.payment)}</span></td><td>${esc(r.reason)}</td><td><span class="pill ${r.priority.toLowerCase()}">${esc(r.priority)}</span></td><td class="num">${r.hoursSinceLast}h</td><td>${esc(r.action)}</td></tr>`).join("")}</tbody></table></div>${!rows.length?'<p class="empty">No cases match this worklist. Try a different filter or search.</p>':""}${pager(state.qPage,pages,"qPage",`${num(rows.length)} matching cases · ¹Hours since latest failure`)}</article>`+snapshot();
}

function guide(){
  return head("Metric guide","Definitions, assumptions, and a way to test the worklist.")+`<div class="guide-grid">
<article class="guide-card"><h2>Which shipments are included?</h2><p>The simulation contains <strong>${num(data.meta.totalShipments)} shipments</strong> with a failed first delivery attempt. An NDR is a non-delivery report. An RTO is a confirmed return-to-origin decision. All timestamps use India Standard Time.</p><p>The history page groups shipments by their first failure date. Open cases are excluded from outcome rates. Recent cohorts have had less time to resolve, so their rates can change.</p></article>
<article class="guide-card"><h2>Outcome metrics</h2><p><strong>NDR-to-RTO rate</strong> = confirmed RTO cases ÷ resolved NDR cases.</p><p><strong>Recovery rate</strong> = deliveries after a failed attempt ÷ resolved NDR cases.</p><p>Each shipment contributes one outcome, even after several failed attempts. Trend counts represent the final known outcomes of each first-failure cohort.</p></article>
<article class="guide-card"><h2>How the queue is ranked</h2><ol><li>Start with open cases that have a concrete next action. A latest buyer refusal is held for review.</li><li>High priority starts at 24 hours since the last failure, or 12 hours after a repeated failure. Medium covers other cases at least 12 hours old or with repeated failures.</li><li>Within each tier, take the oldest latest failure first. Break ties by failed-attempt count and shipment ID.</li></ol><p>Capacity applies after the queue filters. Search looks within that selected worklist. Ranks show the original snapshot order.</p></article>
<article class="guide-card"><h2>How to test business impact</h2><p>Randomly assign comparable incoming cases to two operations teams. Give each the same follow-up capacity and observation window. One team uses the ranked queue, the other uses its usual order.</p><p>Compare the fraction of all assigned shipments returned or recovered. Track unresolved cases, time spent, and contact attempts. The simulated outcomes support a workflow demonstration. A controlled pilot would measure incremental recoveries.</p></article>
<article class="guide-card"><h2>Data and reproducibility</h2><p>The shipment records and carrier names are synthetic. The full project includes the generation seed, raw attempts, SQL views, and reconciliation checks.</p><p><a href="data/DATA_CARD.md">Dataset provenance and dictionary</a> · <a href="sql/README.md">SQL methodology</a></p></article>
<article class="guide-card"><h2>Operational context</h2><p>Shiprocket documents how sellers review failed attempts, request reattempts, or start a return. The project adapts that public workflow into an independent analyst case study.</p><p><a href="https://support.shiprocket.in/support/solutions/articles/43000664209-what-is-ndr-" target="_blank" rel="noreferrer">Shiprocket’s NDR workflow</a> · <a href="INTERVIEW.md">Interview walkthrough</a></p></article></div>`;
}
function showCase(id){
  const r=data.queue.find(c=>c.id===id);if(!r)return;
  const fields=[["Courier",r.courier],["Merchant",r.merchant],["Destination",`${r.city} · ${r.pin}`],["Payment",r.payment],["Failed attempts",r.attempts],["Time since latest failure",r.hoursSinceLast+" hours"]];
  const dlg=$("drawer");
  dlg.innerHTML=`<div class="drawer-head"><div><div class="eyebrow">Shipment details</div><h2 id="case-title">${esc(r.id)}</h2></div><button class="btn" data-action="close">Close</button></div><div class="controls"><span class="pill ${r.priority.toLowerCase()}">${r.priority} priority</span><span class="pill">Snapshot rank ${r.rank}</span></div><dl class="detail-grid">${fields.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><div class="action-box"><strong>${esc(r.action)}</strong><p>${esc(r.why)}. Latest reason: ${esc(r.reason)}.</p></div><h3>Shipment timeline</h3><ol class="timeline"><li>Shipment created<small>${esc(r.createdAt)} IST</small></li>${r.timeline.map(e=>`<li>Attempt ${e.no} · ${esc(e.reason||e.result)}<small>${esc(e.at)} IST</small></li>`).join("")}</ol>`;
  dlg.setAttribute("aria-labelledby","case-title");
  dlg.showModal();
}
function exportCSV(){
  let rows,keys,labels,name;
  if(state.page==="segments"){
    rows=segmentsData().vals.map(g=>({...g,rate:(100*g.rate).toFixed(2)}));keys=["name","total","rto","rate","recovered"];labels=[groupNames[state.group],"Resolved cases","RTO cases","RTO rate (%)","Recovered cases"];name="segment-explorer";
  }else if(state.page==="queue"){
    rows=queueContext().rows;keys=["rank","id","priority","action","why","reason","courier","city","pin","payment","attempts","hoursSinceLast","lastAttempt"];name="follow-up-worklist";
  }else{
    rows=historyContext().rows;keys=["id","date","reason","outcome","courier","state","city","pin","merchant","payment","attempts","resolvedAt"];name="resolved-cases";
  }
  const quote=v=>'"'+String(v??"").replaceAll('"','""')+'"';
  const lines=[(labels||keys).map(quote).join(","),...rows.map(r=>keys.map(k=>quote(r[k])).join(","))];
  const url=URL.createObjectURL(new Blob(["\ufeff",lines.join("\r\n"),"\r\n"],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="ReturnDesk-"+name+".csv";document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);$("status").textContent=`Exported ${num(rows.length)} rows.`;
}
function render(keepFocus=""){
  const renderPage={overview,queue,segments,guide};
  document.querySelectorAll("nav a").forEach(a=>{
    const current=a.dataset.page===state.page;
    a.classList.toggle("active",current);
    if(current)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
  });
  $("breadcrumb").textContent=names[state.page];document.title=names[state.page]+" · ReturnDesk";
  main.innerHTML=renderPage[state.page]();
  if(keepFocus)$(keepFocus)?.focus({preventScroll:true});
}
function navigate(){
  const target=location.hash.slice(1);
  state.page=Object.hasOwn(names,target)?target:"overview";render();window.scrollTo(0,0);
}
function clearTip(){document.querySelector(".chart-tip")?.remove();}
function tooltip(e){
  const rect=e.target.closest("[data-tip]");if(!rect){clearTip();return;}
  clearTip();const host=rect.closest(".chart-wrap"),tip=document.createElement("div");
  tip.className="chart-tip";tip.innerHTML=rect.dataset.tip.split("|").map(esc).join("<br>");
  host.append(tip);const b=rect.getBoundingClientRect(),h=host.getBoundingClientRect();
  tip.style.left=Math.max(2,Math.min(h.width-tip.offsetWidth-3,b.left-h.left+b.width*.5+6))+"px";
  tip.style.top="15px";
}
document.addEventListener("pointerover",e=>{if(e.target.closest(".chart-wrap")||document.querySelector(".chart-tip"))tooltip(e);});
document.addEventListener("focusin",e=>{if(e.target.closest("[data-tip]"))tooltip(e);else clearTip();});
document.addEventListener("change",e=>{
  const k=e.target.dataset.state;if(!k||!Object.hasOwn(state,k))return;
  state[k]=e.target.value;state.qPage=0;state.segmentPage=0;render(k);
});
document.addEventListener("input",e=>{
  if(e.target.id!=="search")return;
  const pos=e.target.selectionStart;state.search=e.target.value;state.qPage=0;
  render("search");if(pos!==null)$("search").setSelectionRange(pos,pos);
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.case){showCase(b.dataset.case);return;}
  if(b.dataset.explore){state.group=b.dataset.explore;state.segmentPage=0;location.hash="segments";return;}
  if(b.dataset.step){const [k,n]=b.dataset.step.split(":");state[k]+=Number(n);render();return;}
  switch(b.dataset.action){
  case "filters":
    state.filtersOpen=!state.filtersOpen;
    render();break;
  case "resetHistory":Object.assign(state,{courier:"",payment:"",reason:"",region:"",filtersOpen:false,segmentPage:0});render();break;
  case "resetQueue":Object.assign(state,{qCourier:"",qPayment:"",priority:"",search:"",capacity:String(data.meta.defaultCapacity),qPage:0});render();break;
  case "export":exportCSV();break;
  case "close":$("drawer").close();break;
  }
});
$("drawer").addEventListener("click",e=>{if(e.target===$("drawer")){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener("hashchange",navigate);navigate();
})();
