import{initializeApp}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{getAuth,createUserWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import{getFirestore,collection,doc,getDoc,setDoc,addDoc,updateDoc,deleteDoc,getDocs,query,where}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import{CFG}from"/firebase-config.js";
const fapp=initializeApp(CFG),db=getFirestore(fapp);
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0');
const D=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const T=ms=>ms?new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'-';
const hv=ms=>{if(!ms)return'';const d=new Date(ms);return pad(d.getHours())+':'+pad(d.getMinutes())};
const hm=m=>`${Math.floor(m/60)}h ${Math.round(m%60)}m`,lm=ms=>{const d=new Date(ms);return d.getHours()*60+d.getMinutes()},tm=t=>{const[a,b]=t.split(':');return+a*60+ +b};
const ts=(d,t)=>t?new Date(d+'T'+t).getTime():null,OFF=5,GRACE=10;
const DEF={role:['employee,employee','supervisor,supervisor','manager,manager','admin,admin'],hol:[],dept:['Office Staff','Duct Team','Pipe','Electrical','Core Cutting','VCV/CCV'],desig:[],shift:['Office General Shift,09:30,18:30'],lcat:['Casual Leave','Sick Leave','Annual Leave']};
let C={},all=[],projs=[],pg='dash',ME=null;
const act=()=>all.filter(e=>e.active!==false),H=()=>C.hol,msg=(t,c)=>`<p class="msg ${c||''}">${esc(t)}</p>`;
const shifts=()=>C.shift.map(l=>{const[n,a,b]=l.split(',').map(x=>x.trim());return{n,a,b}});
const roles=()=>C.role.map(l=>{const[n,a]=l.split(',').map(x=>x.trim());return{n,a:['admin','manager','supervisor','employee'].includes(a)?a:'employee'}});
const rl=n=>(roles().find(r=>r.n==n)||{a:'employee'}).a;
const sh=e=>{const x=shifts().find(y=>y.n==e.shift);return x?[x.a,x.b]:['09:30','18:30']};
const SUP=()=>ME&&ME.role=='supervisor';
const P_OPT=()=>SUP()?(ME.projectNames||[]):[...new Set(['Office',...projs])];
const opt=(a,v)=>a.map(x=>`<option${x==v?' selected':''}>${esc(x)}</option>`).join('');

async function ld(){for(const k in DEF){const s=await getDoc(doc(db,'settings',k));C[k]=s.exists()?s.data().list:DEF[k]}
 projs=(await getDocs(collection(db,'projects'))).docs.map(x=>x.data().name).filter(Boolean).sort();
 if(SUP()){const m={};for(const n of ME.projectNames||[])(await getDocs(query(collection(db,'employees'),where('project','==',n)))).forEach(x=>m[x.id]=x.data());all=Object.values(m).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))}
 else if(ME.role!='employee'){all=(await getDocs(collection(db,'employees'))).docs.map(x=>x.data()).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))}}
const load=async ym=>{const m={},add=x=>{const r=x.data();if(r.date.slice(0,7)==ym)(m[r.empId]=m[r.empId]||{})[r.date]=r};
 if(SUP()){for(const n of ME.projectNames||[])(await getDocs(query(collection(db,'att'),where('project','==',n)))).forEach(add)}else(await getDocs(query(collection(db,'att'),where('date','>=',ym+'-01'),where('date','<=',ym+'-31')))).forEach(add);return m};

// ---- হিসাব ----
function day(e,r,date){const off=new Date(date+'T00:00').getDay()==OFF||H().includes(date),o={off,w:0,late:0,early:0,ot:0};
 if(!r||r.leave)return o;o.w=r.out?Math.round((r.out-r.in)/60000):0;const[a,b]=sh(e),s=tm(a),en=tm(b);
 if(off)o.ot=o.w;else{const l=lm(r.in)-s;o.late=l>GRACE?l:0;if(r.out)o.early=Math.max(0,en-lm(r.out));o.ot=e.otApplied=='No'?0:Math.max(0,o.w-(en-s))}return o}
function msum(e,recs,ym){const[y,m]=ym.split('-').map(Number),n=new Date(y,m,0).getDate(),t=D(new Date()),s={pr:0,ab:0,lv:0,late:0,early:0,ot:0,otOk:0,w:0,proj:{}};
 for(let i=1;i<=n;i++){const dt=`${ym}-${pad(i)}`,r=recs[dt],x=day(e,r,dt);if(r&&r.leave){s.lv++;continue}
  if(r){s.pr++;s.w+=x.w;if(x.late)s.late++;if(x.early)s.early++;s.ot+=x.ot;if(r.otOk)s.otOk+=x.ot;const p=r.project||'-';s.proj[p]=s.proj[p]||{d:0,m:0};s.proj[p].d++;s.proj[p].m+=x.w}
  else if(!x.off&&dt<t&&dt>=(e.joined||'0'))s.ab++}return s}
const pay=(e,s,b=0,d=0)=>{const bs=+e.salary||0,od=Math.round(bs/30*s.ab),op=Math.round(s.otOk/60*(bs/240*2));return{bs,od,op,b:+b,d:+d,net:Math.round(bs-od+op+ +b- +d)}};
const prj=s=>Object.entries(s).map(([k,v])=>`${esc(k)}: ${v.d}d/${(v.m/60).toFixed(1)}h`).join('; ');

// ---- কাঠামো ----
const PAGES={dash:'Dashboard',emp:'Employees',att:'Manual Attendance',dev:'Device Import',stmt:'Attendance Statement / Report',pay:'Payroll & Salary Statement',leave:'Leave',notice:'Notice Board',cfg:'Configuration'};
const PG={},AC={};
const HR=window.HR={cur:'',
 async show(tab){HR.cur=tab;pg=tab.slice(3);$('#app').innerHTML=`<h2 style="margin:0 0 12px">${esc(PAGES[pg])}</h2><div id="hb2">লোড হচ্ছে…</div>`;
  try{ME=ME||await myRole();await ld();await PG[pg]($('#hb2'))}catch(x){$('#hb2').innerHTML=`<div class="card warn">ত্রুটি: ${esc(x.message)}</div>`}},
 page(){return HR.show('hr_'+pg)},
 async portal(uid,u){ME={uid,...u};$('#app').innerHTML='<div id="hb2" class="card">লোড হচ্ছে…</div>';try{await ld();await PG.my($('#hb2'))}catch(x){$('#hb2').innerHTML='ত্রুটি: '+esc(x.message)}}};
async function myRole(){const{getAuth}=await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");const u=getAuth(fapp).currentUser,s=await getDoc(doc(db,'users',u.uid));return{uid:u.uid,...s.data()}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.hx)AC[b.dataset.hx]?.(b.dataset.hi,b)});
document.addEventListener('change',async e=>{const t=e.target;if(t.dataset?.ht){await updateDoc(doc(db,'employees',t.dataset.ht),{project:t.value});all.find(x=>x.id==t.dataset.ht).project=t.value}});

// ---- Dashboard ----
PG.dash=async el=>{const t=D(new Date()),ym=t.slice(0,7),A=await load(ym),nn=(await getDocs(collection(db,'notices'))).size;let pr=0,late=0,lv=0,ab=0,am=0;
 for(const e of act()){const m=A[e.id]||{},r=m[t],x=day(e,r,t);if(r&&r.leave)lv++;else if(r){pr++;if(x.late)late++}else if(!x.off)ab++;am+=msum(e,m,ym).ab}
 const c=(n,l,bg)=>`<div style="background:${bg};color:#fff;border-radius:14px;padding:16px;text-align:center;font-weight:600"><b style="font-size:34px;display:block">${n}</b>${l}</div>`;
 el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px">${c(act().length,'Employees','#00a65a')+c(pr,'Today Attendance','#ff851b')+c(late,'Total Late','#dd4b39')+c(ab,'Total Late Absent (আজ অনুপস্থিত)','#8a96a5')+c(am,'Total Absence (এই মাস)','#0073b7')}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px"><div class="card"><canvas id="c1"></canvas></div><div class="card"><canvas id="c2"></canvas></div></div>`;
 new Chart($('#c1'),{type:'bar',data:{labels:['Employees','Notices','Holidays','Projects'],datasets:[{label:'Evaluation Report',data:[act().length,nn,H().length,projs.length],backgroundColor:['#1ab5a0','#2f7fd6','#c26475','#444']}]}});
 new Chart($('#c2'),{type:'pie',data:{labels:['On time','Late','Leave','Absent'],datasets:[{data:[pr-late,late,lv,ab],backgroundColor:['#1ab5a0','#e0a100','#2f7fd6','#c26475']}]}})};

// ---- Employees ----
const F={q:'',s:'',p:''};
PG.emp=async el=>{
 el.innerHTML=`<div class="card"><h2>Manage Employee</h2><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" data-hx="add">+ Add</button><button class="btn g" data-hx="print">Print</button><input id="fq" placeholder="Search.." style="flex:1;min-width:150px" value="${esc(F.q)}"><select id="fs" style="width:auto"><option value="">All Shift</option>${opt(shifts().map(x=>x.n),F.s)}</select><select id="fp" style="width:auto"><option value="">All Project</option>${opt(P_OPT(),F.p)}</select></div><div id="fm"></div></div><div class="card scroll" id="et"></div>`;
 const tb=()=>{const v=all.filter(e=>(!F.q||(e.id+e.name+(e.contact||'')).toLowerCase().includes(F.q.toLowerCase()))&&(!F.s||e.shift==F.s)&&(!F.p||e.project==F.p));
  $('#et').innerHTML=`<table id="tbl"><tr><th>SL#</th><th>Reg ID</th><th>Name</th><th>Shift</th><th>Project</th><th>Department</th><th>Designation</th><th>Salary</th><th>Contact No</th><th>Joining Date</th><th>Role</th><th>OT</th><th>Actions</th></tr>${v.map((e,i)=>`<tr style="${e.active===false?'opacity:.55':''}"><td>${i+1}</td><td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.shift)}</td><td><select data-ht="${esc(e.id)}" style="width:auto">${opt(P_OPT(),e.project)}</select></td><td>${esc(e.dept)}</td><td>${esc(e.desig)}</td><td>${e.salary}</td><td>${esc(e.contact)}</td><td>${esc(e.joined)}</td><td>${esc(e.role)}</td><td>${esc(e.otApplied)}</td><td><button class="btn s ${e.active===false?'g':''}" data-hx="tg" data-hi="${esc(e.id)}">${e.active===false?'Deactive':'Active'}</button> <button class="btn s" data-hx="vw" data-hi="${esc(e.id)}">view</button> <button class="btn s" data-hx="ed" data-hi="${esc(e.id)}">Edit</button> <button class="btn s g" data-hx="dl" data-hi="${esc(e.id)}">Delete</button></td></tr>`).join('')}</table>`};
 $('#fq').oninput=e=>{F.q=e.target.value;tb()};$('#fs').onchange=e=>{F.s=e.target.value;tb()};$('#fp').onchange=e=>{F.p=e.target.value;tb()};tb();window._tb=tb};
const nextId=()=>String(Math.max(1000,...all.map(e=>+e.id||0))+1);
function form(e){const n=!e,v=e||{id:nextId(),otApplied:'No',joined:D(new Date()),role:'employee'};
 $('#fm').innerHTML=`<h2 style="margin-top:14px">${n?'Add Employee':'Edit Employee'}</h2><form id="ef"><label>ID (auto)<input id="i" value="${esc(v.id)}" readonly></label><label>NID Number<input id="nid" value="${esc(v.nid)}"></label><label>Name *<input id="n" required value="${esc(v.name)}"></label><label>Designation *<select id="dg" required><option value="">Select one</option>${opt(C.desig,v.desig)}</select></label><label>Email *<input id="em" type="email" required value="${esc(v.email)}" ${n?'':'readonly'}></label><label>Department *<select id="dp" required><option value="">Select one</option>${opt(C.dept,v.dept)}</select></label><label>Contact No *<input id="ct" required value="${esc(v.contact)}"></label><label>Shift *<select id="sf" required><option value="">Select one</option>${opt(shifts().map(x=>x.n),v.shift)}</select></label><label>Emergency Contact<input id="ec" value="${esc(v.emergency)}"></label><label>Project *<select id="pj" required><option value="">Select one</option>${opt(P_OPT(),v.project)}</select></label><label>Joining Date *<input id="jd" type="date" required value="${esc(v.joined)}"></label><label>Role *<select id="rl">${opt(roles().map(r=>r.n),v.role)}</select></label><label>Permanent Address<input id="ad" value="${esc(v.address)}"></label><label>Salary (মাসিক) *<input id="sl" type="number" required value="${v.salary??''}"></label><label>Overtime Applied<select id="ot">${opt(['No','Yes'],v.otApplied)}</select></label>${n?'<small style="grid-column:1/-1">নতুন কর্মীর login: তার Email + Password <b>123456</b></small>':''}<button class="btn">${n?'Add':'Save'}</button><button type="button" class="btn g" data-hx="cx">Cancel</button></form><div id="fmsg"></div>`;
 $('#ef').onsubmit=async ev=>{ev.preventDefault();const m=$('#fmsg'),id=$('#i').value;
  const d={id,nid:$('#nid').value,name:$('#n').value,desig:$('#dg').value,email:$('#em').value.trim(),dept:$('#dp').value,contact:$('#ct').value,shift:$('#sf').value,emergency:$('#ec').value,project:$('#pj').value,joined:$('#jd').value,role:$('#rl').value,address:$('#ad').value,salary:+$('#sl').value,otApplied:$('#ot').value};
  try{if(n){const{getAuth}=await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");const a2=initializeApp(CFG,'s'+Date.now()),au=getAuth(a2),c=await createUserWithEmailAndPassword(au,d.email,'123456');
    try{await setDoc(doc(db,'users',c.user.uid),{name:d.name,email:d.email,role:rl(d.role),empId:id})}catch(x){await c.user.delete();throw x}
    await setDoc(doc(db,'employees',id),{...d,active:true,uid:c.user.uid});await signOut(au)}
   else{await updateDoc(doc(db,'employees',id),d);if(e.uid)try{await updateDoc(doc(db,'users',e.uid),{role:rl(d.role),name:d.name})}catch{}}
   await ld();PG.emp($('#hb2'))}catch(x){m.innerHTML=msg('ত্রুটি: '+(x.code||x.message),'err')}}}
AC.add=()=>form();AC.cx=()=>{$('#fm').innerHTML=''};
AC.ed=i=>{form(all.find(e=>e.id==i));scrollTo(0,0)};
AC.tg=async i=>{const e=all.find(x=>x.id==i);e.active=e.active===false;await updateDoc(doc(db,'employees',i),{active:e.active});window._tb()};
AC.dl=async i=>{const e=all.find(x=>x.id==i);if(!confirm(e.name+' কে Delete করবেন? এই কাজ ফেরানো যাবে না।'))return;if(e.uid)try{await deleteDoc(doc(db,'users',e.uid))}catch{}await deleteDoc(doc(db,'employees',i));all=all.filter(x=>x.id!=i);window._tb()};
AC.vw=i=>{const e=all.find(x=>x.id==i),r=[['ID',e.id],['Name',e.name],['Email',e.email],['Contact',e.contact],['Emergency',e.emergency],['NID',e.nid],['Designation',e.desig],['Department',e.dept],['Shift',e.shift],['Project',e.project],['Joining',e.joined],['Address',e.address],['Salary',e.salary],['Overtime Applied',e.otApplied],['Role',e.role],['Status',e.active===false?'Deactive':'Active']];
 $('#fm').innerHTML=`<div class="card" style="margin-top:14px"><h2>${esc(e.name)}</h2><table>${r.map(x=>`<tr><td>${x[0]}</td><td>${esc(x[1])}</td></tr>`).join('')}</table><button class="btn g" data-hx="cx">Close</button></div>`;scrollTo(0,0)};
AC.print=()=>{const w=open('');w.document.write('<title>Employees</title><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px;font:13px sans-serif}select{border:0;font:13px sans-serif;appearance:none}button{display:none}</style>'+$('#tbl').outerHTML);w.print()};

// ---- Manual Attendance (প্রজেক্টভিত্তিক) ----
const AF={d:D(new Date()),p:'',s:'',q:''};
PG.att=async el=>{
 el.innerHTML=`<div class="card"><h2>Manual Attendance <small>(যারা device এ পাঞ্চ করেননি)</small></h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end"><label>তারিখ<input id="d" type="date" value="${AF.d}"></label><label>Project<select id="p"><option value="">All Project</option>${opt(P_OPT(),AF.p)}</select></label><label>Shift<select id="s"><option value="">All Shift</option>${opt(shifts().map(x=>x.n),AF.s)}</select></label><label>Employee<input id="q" placeholder="নাম বা ID" value="${esc(AF.q)}"></label><button class="btn" id="go">Go</button></div></div><div class="card scroll" id="at"></div>`;
 const draw=async()=>{AF.d=$('#d').value;AF.p=$('#p').value;AF.s=$('#s').value;AF.q=$('#q').value;
  const R={},qq=SUP()?(ME.projectNames||[]).map(n=>query(collection(db,'att'),where('date','==',AF.d),where('project','==',n))):[query(collection(db,'att'),where('date','==',AF.d))];for(const q1 of qq)(await getDocs(q1)).forEach(x=>R[x.data().empId]=x.data());
  const v=act().filter(e=>(!AF.p||e.project==AF.p)&&(!AF.s||e.shift==AF.s)&&(!AF.q||(e.id+e.name).toLowerCase().includes(AF.q.toLowerCase())));window._v=v;window._R=R;
  $('#at').innerHTML=`<table><tr><th>SL#</th><th>ID</th><th>Name</th><th>Designation</th><th>Project</th><th>Attendance</th><th>Leave Category</th><th>In Time</th><th>Out Time</th><th>OT অনুমোদন</th><th>Source</th></tr>${v.map((e,i)=>{const r=R[e.id],st=r?(r.leave?'Leave':'Present'):'Absent';
   return`<tr data-r="${i}"><td>${i+1}</td><td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.desig)}</td><td><select class="pj" style="width:auto">${opt(P_OPT(),r?.project||e.project)}</select></td><td><select class="st" style="width:auto">${opt(['Present','Absent','Leave'],st)}</select></td><td><select class="lc" style="width:auto">${opt(C.lcat,r?.cat)}</select></td><td><input class="tin" type="time" value="${r&&!r.leave?hv(r.in):''}"></td><td><input class="tout" type="time" value="${r&&!r.leave?hv(r.out):''}"></td><td><input class="ok" type="checkbox" ${r?.otOk?'checked':''} ${SUP()?'disabled':''} style="width:auto"></td><td>${r?(r.src||'device'):'-'}</td></tr>`}).join('')}</table><p><button class="btn" id="sv">Save Attendance</button></p><div id="am"></div>`;
  $('#at').querySelectorAll('tr[data-r]').forEach(tr=>{tr.onchange=ev=>{tr.dataset.dirty=1;if(ev.target.classList.contains('st')&&ev.target.value=='Present'){const e=v[tr.dataset.r],[a,b]=sh(e);if(!tr.querySelector('.tin').value)tr.querySelector('.tin').value=a;if(!tr.querySelector('.tout').value)tr.querySelector('.tout').value=b}}});
  $('#sv').onclick=async()=>{let n=0;try{for(const tr of $('#at').querySelectorAll('tr[data-dirty]')){const e=v[tr.dataset.r],st=tr.querySelector('.st').value,pj=tr.querySelector('.pj').value,ref=doc(db,'att',AF.d+'_'+e.id),old=R[e.id];
    if(st=='Absent'){if(old)await deleteDoc(ref)}
    else if(st=='Leave')await setDoc(ref,{empId:e.id,date:AF.d,leave:true,cat:tr.querySelector('.lc').value,project:pj,in:0,out:0,last:0,n:0,otOk:false,src:'manual'});
    else{const a=ts(AF.d,tr.querySelector('.tin').value);if(!a)throw new Error(e.name+': In Time দিন');const o=ts(AF.d,tr.querySelector('.tout').value);await setDoc(ref,{empId:e.id,date:AF.d,in:a,out:o,last:o||a,n:old?.n||1,project:pj,otOk:SUP()?!!old?.otOk:tr.querySelector('.ok').checked,src:old?.src||'manual'})}n++}
   $('#am').innerHTML=msg(n+' জনের attendance সংরক্ষিত হয়েছে','ok');draw()}catch(x){$('#am').innerHTML=msg(x.message,'err')}}};
 $('#go').onclick=draw;draw()};

// ---- Device Import ----
let DV=null;
const pdt=v=>{if(v instanceof Date)return v.getTime();const s=String(v||'').trim();let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);if(m)return new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5]).getTime();
 m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{1,2}):(\d{2})\s*(AM|PM)?/i);if(m){let h=+m[4];if(m[6]){h=h%12+(/pm/i.test(m[6])?12:0)}return new Date(+m[3],m[2]-1,+m[1],h,+m[5]).getTime()}return NaN};
PG.dev=async el=>{
 el.innerHTML=`<div class="card"><h2>Face Attendance Device Data Import</h2><p>Device থেকে Excel/CSV export করে এখানে দিন। দুইটা column লাগবে: <b>ID</b> (device এ কর্মীর ID = software এর Reg ID) এবং <b>DateTime</b> (পাঞ্চের সময়; অথবা আলাদা Date ও Time column)। দিনের প্রথম পাঞ্চ = In, শেষ পাঞ্চ = Out।</p><input type="file" id="fi" accept=".xlsx,.xls,.csv"><div id="dm"></div></div>`;
 $('#fi').onchange=async ev=>{const f=ev.target.files[0],m=$('#dm');if(!f)return;try{const wb=XLSX.read(await f.arrayBuffer(),{cellDates:true}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
   if(!rows.length)throw new Error('ফাইলে row নেই');const k={};Object.keys(rows[0]).forEach(c=>k[c.trim().toLowerCase()]=c);
   const cI=k['id']||k['emp id']||k['employee id']||k['user id']||k['person id']||k['no']||k['reg id'],cD=k['datetime']||k['date time']||k['punch time']||k['check time']||k['time'],cDa=k['date'],cTi=k['time'];
   if(!cI||!(cD||(cDa&&cTi)))throw new Error('ID ও DateTime column পাওয়া যায়নি');
   const g={};let bad=0;rows.forEach(r=>{let t=cDa&&cTi&&!k['datetime']?pdt((r[cDa] instanceof Date?D(r[cDa]):r[cDa])+' '+(r[cTi] instanceof Date?hv(+r[cTi]):r[cTi])):pdt(r[cD]);const id=String(r[cI]).trim();if(!id||isNaN(t)){bad++;return}const d=D(new Date(t));((g[id+'|'+d]=g[id+'|'+d]||{id,d,t:[]}).t.push(t))});
   DV=Object.values(g).map(x=>({id:x.id,d:x.d,in:Math.min(...x.t),out:x.t.length>1&&Math.max(...x.t)-Math.min(...x.t)>=60000?Math.max(...x.t):null,n:x.t.length}));
   const known=DV.filter(x=>all.some(e=>e.id==x.id)),unk=[...new Set(DV.filter(x=>!all.some(e=>e.id==x.id)).map(x=>x.id))];
   m.innerHTML=`<p>${rows.length} টা পাঞ্চ → ${DV.length} টা দিনের হাজিরা।${bad?` ${bad} টা row পড়া যায়নি।`:''} ${unk.length?`<span class="err">অচেনা ID (বাদ যাবে): ${esc(unk.join(', '))}</span>`:''}</p><button class="btn" id="im">${known.length} টা Import করুন</button><div id="mi"></div>`;
   $('#im').onclick=async()=>{let n=0;$('#mi').innerHTML=msg('Import চলছে…','ok');for(const x of known){const e=all.find(y=>y.id==x.id),ref=doc(db,'att',x.d+'_'+x.id),o=await getDoc(ref);if(o.exists()&&o.data().leave)continue;
     await setDoc(ref,{empId:x.id,date:x.d,in:x.in,out:x.out,last:x.out||x.in,n:x.n,project:o.exists()?(o.data().project||e.project):e.project,src:'device'},{merge:true});n++}$('#mi').innerHTML=msg(n+' টা হাজিরা Import হয়েছে','ok')}
  }catch(x){m.innerHTML=msg(x.message,'err')}}};

// ---- Statement / Report ----
PG.stmt=async el=>{el.innerHTML=`<div class="card"><label style="max-width:200px">মাস<input id="ym" type="month" value="${D(new Date()).slice(0,7)}"></label> <button class="btn g" id="xl">Excel Export</button></div><div class="card scroll" id="tb"></div>`;let rows=[];
 const draw=async()=>{const ym=$('#ym').value,A=await load(ym);rows=act().map(e=>({e,s:msum(e,A[e.id]||{},ym)}));
  $('#tb').innerHTML=`<table><tr><th>কর্মী</th><th>Project</th><th>উপস্থিত</th><th>দেরি</th><th>আগে গেছে</th><th>Leave</th><th>অনুপস্থিত</th><th>কাজের ঘণ্টা</th><th>OT ঘণ্টা</th></tr>${rows.map(r=>`<tr><td>${esc(r.e.id)} ${esc(r.e.name)}</td><td>${esc(r.e.project)}</td><td>${r.s.pr}</td><td>${r.s.late}</td><td>${r.s.early}</td><td>${r.s.lv}</td><td>${r.s.ab}</td><td>${(r.s.w/60).toFixed(1)}</td><td>${(r.s.ot/60).toFixed(1)}</td></tr>`).join('')}</table>`};
 $('#ym').onchange=draw;$('#xl').onclick=()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.map(r=>({ID:r.e.id,Name:r.e.name,Project:r.e.project,Present:r.s.pr,Late:r.s.late,'Early Leave':r.s.early,Leave:r.s.lv,Absent:r.s.ab,'Work Hours':+(r.s.w/60).toFixed(1),'OT Hours':+(r.s.ot/60).toFixed(1)}))),'Attendance');XLSX.writeFile(wb,`attendance-${$('#ym').value}.xlsx`)};draw()};

// ---- Payroll ----
PG.pay=async el=>{el.innerHTML=`<div class="card"><label style="max-width:200px">মাস<input id="ym" type="month" value="${D(new Date()).slice(0,7)}"></label> <button class="btn" id="fz">Payroll সংরক্ষণ (Finalize)</button> <button class="btn g" id="xl">Excel Export</button><div id="m"></div></div><div class="card scroll" id="tb"></div>`;let rows=[];
 const draw=async()=>{const ym=$('#ym').value,A=await load(ym),PR={};(await getDocs(query(collection(db,'payroll'),where('ym','==',ym)))).forEach(x=>PR[x.data().empId]=x.data());
  rows=act().map(e=>({e,s:msum(e,A[e.id]||{},ym),b:PR[e.id]?.bonus||0,d:PR[e.id]?.ded||0,fin:!!PR[e.id]}));
  $('#tb').innerHTML=`<table><tr><th>কর্মী</th><th>Department</th><th>বেসিক</th><th>উপস্থিত</th><th>Leave</th><th>অনুপস্থিত</th><th>কর্তন</th><th>OT ঘণ্টা (অনুমোদিত/মোট)</th><th>OT টাকা</th><th>বোনাস</th><th>অন্য কর্তন</th><th>Net Pay</th><th>Project-wise</th></tr>${rows.map((r,i)=>{const p=pay(r.e,r.s,r.b,r.d);return`<tr><td>${esc(r.e.id)} ${esc(r.e.name)}${r.fin?' ✓':''}</td><td>${esc(r.e.dept)}</td><td>${p.bs}</td><td>${r.s.pr}</td><td>${r.s.lv}</td><td>${r.s.ab}</td><td>${p.od}</td><td>${(r.s.otOk/60).toFixed(1)} / ${(r.s.ot/60).toFixed(1)}</td><td>${p.op}</td><td><input type="number" style="width:80px" data-pb="${i}" value="${r.b}"></td><td><input type="number" style="width:80px" data-pd="${i}" value="${r.d}"></td><td><b id="n${i}">${p.net}</b></td><td>${prj(r.s.proj)}</td></tr>`}).join('')}</table>`;
  $('#tb').querySelectorAll('input').forEach(x=>x.oninput=()=>{const i=x.dataset.pb??x.dataset.pd,r=rows[i];if(x.dataset.pb!=null)r.b=+x.value;else r.d=+x.value;$('#n'+i).textContent=pay(r.e,r.s,r.b,r.d).net})};
 const rec=r=>{const p=pay(r.e,r.s,r.b,r.d);return{ym:$('#ym').value,empId:r.e.id,name:r.e.name,dept:r.e.dept,basic:p.bs,present:r.s.pr,leave:r.s.lv,absent:r.s.ab,late:r.s.late,otHours:+(r.s.otOk/60).toFixed(2),otPay:p.op,absentDeduction:p.od,bonus:p.b,ded:p.d,net:p.net,projects:r.s.proj}};
 $('#ym').onchange=draw;$('#fz').onclick=async()=>{if(!confirm('এই মাসের Payroll সংরক্ষণ হবে এবং কর্মীরা দেখতে পাবেন। নিশ্চিত?'))return;for(const r of rows){const x=rec(r);await setDoc(doc(db,'payroll',x.ym+'_'+x.empId),x)}$('#m').innerHTML=msg('সংরক্ষিত হয়েছে','ok');draw()};
 $('#xl').onclick=()=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.map(r=>{const x=rec(r);return{Month:x.ym,ID:x.empId,Name:x.name,Department:x.dept,Basic:x.basic,Present:x.present,Leave:x.leave,Absent:x.absent,'Absent Deduction':x.absentDeduction,'OT Hours':x.otHours,'OT Pay':x.otPay,Bonus:x.bonus,Deduction:x.ded,'Net Pay':x.net,Projects:Object.entries(x.projects).map(([k,v])=>`${k}: ${v.d}d/${(v.m/60).toFixed(1)}h`).join('; ')}})),'Payroll');XLSX.writeFile(wb,`payroll-${$('#ym').value}.xlsx`)};draw()};

// ---- Leave ----
const lvSave=(id,date,cat)=>{const e=all.find(x=>x.id==id);return setDoc(doc(db,'att',date+'_'+id),{empId:id,date,leave:true,cat,project:e?.project||'',in:0,out:0,last:0,n:0,otOk:false,src:'leave'})};
const leaveForm=emp=>`<div class="card"><h2>Leave Application</h2><form id="lf">${emp?'':`<label>কর্মী<select id="le">${act().map(e=>`<option value="${esc(e.id)}">${esc(e.id)} ${esc(e.name)}</option>`).join('')}</select></label>`}<label>Category<select id="lc">${opt(C.lcat)}</select></label><label>শুরু<input id="la" type="date" required></label><label>শেষ<input id="lb" type="date" required></label><label>কারণ<input id="lr"></label><button class="btn">জমা দিন</button></form><div id="lm"></div></div>`;
const leaveSubmit=(emp,after)=>{$('#lf').onsubmit=async ev=>{ev.preventDefault();const a=$('#la').value,b=$('#lb').value;if(b<a)return $('#lm').innerHTML=msg('শেষ তারিখ ভুল','err');
 try{await addDoc(collection(db,'leaves'),{empId:emp?ME.empId:$('#le').value,cat:$('#lc').value,from:a,to:b,days:Math.round((new Date(b)-new Date(a))/864e5)+1,reason:$('#lr').value,status:'pending',at:Date.now()});$('#lm').innerHTML=msg('জমা হয়েছে','ok');after()}catch(x){$('#lm').innerHTML=msg(x.message,'err')}}};
PG.leave=async el=>{const L=(await getDocs(collection(db,'leaves'))).docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>b.at-a.at);
 el.innerHTML=leaveForm(false)+`<div class="card scroll"><h2>Application List / Manage</h2><table><tr><th>কর্মী</th><th>Category</th><th>শুরু</th><th>শেষ</th><th>দিন</th><th>কারণ</th><th>Status</th><th></th></tr>${L.map((l,i)=>`<tr><td>${esc(l.empId)}</td><td>${esc(l.cat)}</td><td>${l.from}</td><td>${l.to}</td><td>${l.days}</td><td>${esc(l.reason)}</td><td>${l.status}</td><td>${l.status=='pending'?`<button class="btn s" data-hx="ly" data-hi="${i}">Approve</button> <button class="btn s g" data-hx="ln" data-hi="${i}">Reject</button>`:''}</td></tr>`).join('')}</table></div>`;
 window._L=L;leaveSubmit(false,()=>HR.page())};
AC.ly=async i=>{const l=window._L[i];for(const d=new Date(l.from+'T00:00');D(d)<=l.to;d.setDate(d.getDate()+1))await lvSave(l.empId,D(d),l.cat);await updateDoc(doc(db,'leaves',l.id),{status:'approved'});HR.page()};
AC.ln=async i=>{await updateDoc(doc(db,'leaves',window._L[i].id),{status:'rejected'});HR.page()};

// ---- Notice ----
const noticeList=async(st)=>{const ns=(await getDocs(collection(db,'notices'))).docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>b.at-a.at);
 return ns.map(n=>`<div class="card"><b>${esc(n.title)}</b> <small>${new Date(n.at).toLocaleDateString()}</small><p>${esc(n.body)}</p>${st?`<button class="btn s g" data-hx="nd" data-hi="${n.id}">মুছুন</button>`:''}</div>`).join('')||'<div class="card">কোনো notice নেই</div>'};
PG.notice=async el=>{el.innerHTML=`<div class="card"><h2>New Notice</h2><form id="nf"><label>Title<input id="nt" required></label><label>বিবরণ<input id="nb" required></label><button class="btn">প্রকাশ</button></form></div>`+await noticeList(true);
 $('#nf').onsubmit=async ev=>{ev.preventDefault();await addDoc(collection(db,'notices'),{title:$('#nt').value,body:$('#nb').value,at:Date.now()});HR.page()}};
AC.nd=async i=>{await deleteDoc(doc(db,'notices',i));HR.page()};

// ---- Configuration ----
let CF='desig';
const CFGS={desig:{t:'Designation',f:[['v','Designation নাম','text']]},dept:{t:'Department',f:[['v','Department নাম','text']]},shift:{t:'Shift',f:[['n','Shift নাম','text'],['a','শুরু','time','09:30'],['b','শেষ','time','18:30']]},role:{t:'Role',f:[['n','Role নাম','text'],['a','Access','sel']]},hol:{t:'Holiday List',f:[['v','তারিখ','date']]},lcat:{t:'Leave Category',f:[['v','Category নাম','text']]}};
PG.cfg=async el=>{const g=CFGS[CF];
 el.innerHTML=`<div class="cbar">${Object.entries(CFGS).map(([k,x])=>`<button class="cbtn${k==CF?' on':''}" data-hx="cft" data-hi="${k}">${x.t}</button>`).join('')}</div><div class="card"><h2>New ${g.t}</h2><form id="cff">${g.f.map(f=>`<label>${f[1]}${f[2]=='sel'?`<select name="${f[0]}">${opt(['employee','supervisor','manager','admin'])}</select>`:`<input name="${f[0]}" type="${f[2]}" value="${f[3]||''}" required>`}</label>`).join('')}<button class="btn">Add</button></form>${CF=='role'?'<p><small>Access = সফটওয়্যারে কী দেখতে পারবে: employee শুধু নিজের Portal; supervisor/manager/admin Tools ও HR (অনুমতি অনুযায়ী)।</small></p>':''}</div><div class="card scroll"><h2>${g.t} List</h2><table>${C[CF].map((l,i)=>`<tr><td>${esc(l.split(',').join(' · '))}</td><td><button class="btn s g" data-hx="cfd" data-hi="${i}">Delete</button></td></tr>`).join('')||'<tr><td>কিছু নেই</td></tr>'}</table></div>`;
 $('#cff').onsubmit=async ev=>{ev.preventDefault();const d=new FormData(ev.target),v=g.f.map(f=>String(d.get(f[0])).trim().replace(/,/g,' ')).join(',');if(C[CF].includes(v))return;C[CF].push(v);if(CF=='hol')C[CF].sort();await setDoc(doc(db,'settings',CF),{list:C[CF]});PG.cfg(el)}};
AC.cft=k=>{CF=k;HR.page()};
AC.cfd=async i=>{C[CF].splice(i,1);await setDoc(doc(db,'settings',CF),{list:C[CF]});HR.page()};

// ---- Employee Self-Service ----
PG.my=async el=>{const id=ME.empId,e=(await getDoc(doc(db,'employees',id))).data();if(!e||e.active===false){el.innerHTML='<div class="card warn">আপনার account সক্রিয় নয়। HR এর সঙ্গে যোগাযোগ করুন।</div>';return}
 const recs={},PR={};(await getDocs(query(collection(db,'att'),where('empId','==',id)))).forEach(x=>recs[x.data().date]=x.data());(await getDocs(query(collection(db,'payroll'),where('empId','==',id)))).forEach(x=>PR[x.data().ym]=x.data());
 const td=D(new Date()),cur=td.slice(0,7),ms=[...new Set([cur,...Object.keys(recs).map(d=>d.slice(0,7)),...Object.keys(PR)])].sort().reverse();
 el.innerHTML=`<div class="card"><h2>${esc(e.name)} — ${esc(e.id)}</h2><p>${esc(e.dept)} · ${esc(e.desig)} · ${esc(e.project)}</p><label style="max-width:200px">মাস<select id="ym">${ms.map(m=>`<option>${m}</option>`).join('')}</select></label></div><div id="md"></div>
 <div class="card scroll"><h2>মাসভিত্তিক ইতিহাস</h2><table><tr><th>মাস</th><th>উপস্থিত</th><th>ছুটি</th><th>অনুপস্থিত</th><th>OT (ঘণ্টা)</th><th>প্রাপ্ত টাকা</th></tr>${ms.map(m=>{const s=msum(e,recs,m),p=PR[m];return`<tr><td>${m}</td><td>${s.pr}</td><td>${s.lv}</td><td>${s.ab}</td><td>${(p?p.otHours:s.otOk/60).toFixed(1)}</td><td>${p?p.net:'অপেক্ষমাণ'}</td></tr>`}).join('')}</table></div>${leaveForm(true)}<div class="card scroll" id="ml"></div><h2>Notice Board</h2>${await noticeList(false)}`;
 const myL=async()=>{const q=await getDocs(query(collection(db,'leaves'),where('empId','==',id)));$('#ml').innerHTML=`<h2>আমার Leave আবেদন</h2><table><tr><th>Category</th><th>শুরু</th><th>শেষ</th><th>দিন</th><th>Status</th></tr>${q.docs.map(x=>x.data()).sort((a,b)=>b.at-a.at).map(l=>`<tr><td>${esc(l.cat)}</td><td>${l.from}</td><td>${l.to}</td><td>${l.days}</td><td>${l.status}</td></tr>`).join('')}</table>`};
 const dr=()=>{const ym=$('#ym').value,s=msum(e,recs,ym),p=PR[ym],f=pay(e,s),[y,m]=ym.split('-').map(Number),nd=new Date(y,m,0).getDate(),el_=ym==cur?+td.slice(8):nd,paid=Math.min(30,Math.max(0,el_-s.ab)),base=Math.round((+e.salary||0)/30*paid),earn=base+f.op,net=p?p.net:earn;
  const k=(n,l)=>`<div style="background:var(--bg);border-radius:10px;padding:10px"><b style="font-size:22px;display:block">${n}</b>${l}</div>`;
  const rows=[];for(let i=1;i<=nd;i++){const dt=`${ym}-${pad(i)}`;if(dt>td)break;const r=recs[dt],x=day(e,r,dt);let st,c='inherit';
   if(r&&r.leave){st='Leave'+(r.cat?' ('+esc(r.cat)+')':'');c='#2f7fd6'}else if(r){st=x.late?`Present (দেরি ${x.late}m)`:'Present';c='#1b7a43'}else if(x.off){st='ছুটির দিন';c='#8a96a5'}else if(dt<(e.joined||'0'))st='—';else if(dt==td)st='এখনো পাঞ্চ হয়নি';else{st='Absent';c='#b3261e'}
   const w=r&&!r.leave;rows.push(`<tr><td>${dt}</td><td style="color:${c};font-weight:600">${st}</td><td>${w?T(r.in):'-'}</td><td>${w?T(r.out):'-'}</td><td>${w&&r.out?hm(x.w):'-'}</td><td>${x.ot?hm(x.ot)+(r.otOk?' ✓':''):'-'}</td></tr>`)}
  $('#md').innerHTML=`<div class="card"><h2>${ym} ${p?'(চূড়ান্ত)':ym==cur?'(আজ '+td+' পর্যন্ত)':'(আনুমানিক)'}</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">${k(s.pr,'উপস্থিত দিন')+k(s.lv,'Leave (দিন)')+k(s.ab,'Absent (দিন)')+k(s.late,'দেরি (দিন)')+k(hm(s.ot),'মোট OT')+k(hm(s.otOk),'অনুমোদিত OT')+k(net,p?'Net Pay':'আজ পর্যন্ত প্রাপ্য বেতন')}</div></div>
  <div class="card scroll"><h2>বেতনের বিস্তারিত</h2><table>${p?`<tr><td>মূল বেতন</td><td>${p.basic}</td></tr><tr><td>অনুপস্থিতি কর্তন</td><td>- ${p.absentDeduction}</td></tr><tr><td>OT</td><td>+ ${p.otPay}</td></tr><tr><td>বোনাস</td><td>+ ${p.bonus}</td></tr><tr><td>অন্যান্য কর্তন</td><td>- ${p.ded}</td></tr><tr><td><b>Net Pay</b></td><td><b>${p.net}</b></td></tr>`:`<tr><td>মাসিক বেতন</td><td>${e.salary}</td></tr><tr><td>গণনার দিন (${el_} দিন − ${s.ab} দিন Absent)</td><td>${paid}</td></tr><tr><td>আজ পর্যন্ত বেতন</td><td>${base}</td></tr><tr><td>OT (অনুমোদিত)</td><td>+ ${f.op}</td></tr><tr><td><b>আজ পর্যন্ত মোট প্রাপ্য</b></td><td><b>${earn}</b></td></tr>`}</table>${p?'':'<small>বোনাস, অন্য কর্তন ও OT অনুমোদন মাস শেষে Accounts চূড়ান্ত করলে বদলাতে পারে।</small>'}</div>
  <div class="card scroll"><h2>দৈনিক হাজিরা</h2><table><tr><th>তারিখ</th><th>Status</th><th>In</th><th>Out</th><th>কাজ</th><th>OT</th></tr>${rows.reverse().join('')||'<tr><td colspan="6">তথ্য নেই</td></tr>'}</table></div>
  <div class="card scroll"><h2>Project-wise কাজ</h2><table><tr><th>Project</th><th>দিন</th><th>ঘণ্টা</th></tr>${Object.entries(s.proj).map(([k2,v])=>`<tr><td>${esc(k2)}</td><td>${v.d}</td><td>${(v.m/60).toFixed(1)}</td></tr>`).join('')||'<tr><td colspan="3">তথ্য নেই</td></tr>'}</table></div>`};
 $('#ym').onchange=dr;dr();myL();leaveSubmit(true,myL)};
