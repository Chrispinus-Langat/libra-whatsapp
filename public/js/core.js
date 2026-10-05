/* ===================== LIBRA core =====================
   helpers · settings · state · API/auth · chat list · messages · composer · realtime */

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const xU=u=>/^\/uploads\/[\w.\/-]{1,200}$/.test(u||'')?u:'';
const I=(n,c='')=>`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const tick=s=>`<svg class="tk ${s===2?'read':''}" viewBox="0 0 17 12" role="img" aria-label="${['Sent','Delivered','Read'][s]}"><use href="#${s?'tk2':'tk1'}"/></svg>`;
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null};
const lsJ=(k,d)=>{try{return JSON.parse(ls(k))||d}catch(e){return d}};
let _toast;
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';e.style.background='#1f2937';clearTimeout(_toast);_toast=setTimeout(()=>e.style.display='none',3500)}

const COLORS=['#14b8a6','#6366f1','#ec4899','#f59e0b','#ef4444','#0ea5e9'];
const AV=['#6366f1','#ec4899','#f59e0b','#0ea5e9','#10b981','#ef4444'];
const BG=['#6366f1','#14b8a6','#ec4899','#f59e0b','#0ea5e9','#ef4444'];
const QR=['👍','❤️','😂','😮','😢','🙏'];
const KL={image:'Photo',video:'Video',voice:'Voice message',file:'Document',sticker:'Sticker',location:'Location',contact:'Contact',poll:'Poll'};
const IOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const STANDALONE=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const COARSE=matchMedia('(pointer:coarse)').matches;

/* ---------- personal settings (saved on this device) ---------- */
const CFG=Object.assign({sound:true,wp:'dots',fs:14,enter:true},lsJ('libra_cfg',{}));
const WP={dots:{n:'Dots'},plain:{n:'Plain',img:'none'},mint:{n:'Mint',bg:'#d7efe9',img:'none'},sky:{n:'Sky',bg:'#dbeafe',img:'none'},rose:{n:'Rose',bg:'#fde2e4',img:'none'},sand:{n:'Sand',bg:'#efe7d6',img:'none'},night:{n:'Night',bg:'#0b0e12',img:'none'}};
function applyCfg(){
 const r=document.documentElement.style,w=WP[CFG.wp]||WP.dots;
 r.setProperty('--fs',CFG.fs+'px');
 w.bg?r.setProperty('--wall',w.bg):r.removeProperty('--wall');
 w.img?r.setProperty('--wpimg',w.img):r.removeProperty('--wpimg');
}
function saveCfg(){ls('libra_cfg',JSON.stringify(CFG));applyCfg()}
applyCfg();

/* ---------- state ---------- */
const S={sec:'chats',tab:'All',ghost:false,noBlue:false,noType:false,noOnline:false,appLock:false,push:false};
const P={name:'',about:'Hey there! I am using LIBRA',phone:'',bizName:'',bizCat:'',bizDesc:'',bizUrl:'',bizEmail:'',bizAddr:'',bizHours:''};
let TOKEN=null,ME=null,sock=null,chats=[],cur=null,rep=null,editM=null,folders=['Work','Family'];
const ONL=new Set();
const DR=lsJ('libra_drafts',{});                 // unsent drafts per chat
const LOCKED=new Set(lsJ('libra_locked',[]));    // chats hidden behind the PIN
let UNLOCK_UNTIL=0;
const unlockedNow=()=>Date.now()<UNLOCK_UNTIL;
const isLocked=c=>LOCKED.has(c.id);
const POLLS={};                                  // poll tallies by message id
let XM={blocked:[],admin:false};

/* ---------- formatting ---------- */
const ini=n=>{n=(n||'?').trim();if(!/[a-z]/i.test(n))return '#';return n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()};
const col=id=>AV[(typeof id==='string'?[...id].reduce((a,c)=>a+c.charCodeAt(0),0):Number(id)||0)%AV.length];
const tm=d=>new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const sameDay=(a,b)=>a.toDateString()===b.toDateString();
const dayLabel=d=>{d=new Date(d);const n=new Date(),y=new Date(Date.now()-864e5);return sameDay(d,n)?'Today':sameDay(d,y)?'Yesterday':d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'})};
const listTime=l=>{if(!l||!l.at)return '';const d=new Date(l.at);return sameDay(d,new Date())?tm(d):sameDay(d,new Date(Date.now()-864e5))?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short'})};
const lsFmt=d=>{d=new Date(d);return sameDay(d,new Date())?'today at '+tm(d):sameDay(d,new Date(Date.now()-864e5))?'yesterday at '+tm(d):d.toLocaleDateString([],{day:'numeric',month:'short'})};
const fmt=s=>`${s/60|0}:${String(s%60).padStart(2,'0')}`;
const ago=d=>{const m=Math.max(0,(Date.now()-new Date(d))/60000|0);return m<1?'Just now':m<60?m+'m ago':(m/60|0)+'h ago'};
const xLink=h=>h.replace(/(https?:\/\/[^\s<]+)/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer" class="underline" onclick="event.stopPropagation()">${u}</a>`);
function rich(s,c){let h=esc(s);if(c&&c.mre)h=h.replace(c.mre,m=>`<b class="acc">${m}</b>`);return xLink(h)}

/* emoji-only messages are shown large, like WhatsApp */
const XE='(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)\\p{Emoji_Modifier}?';
const EMO_RE=new RegExp(`(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|${XE}(?:\\u200D(?:${XE}|\\p{Extended_Pictographic}\\uFE0F?))*)`,'gu');
const emojiOnly=s=>{const t=String(s||'').replace(/\s+/g,'');if(!t)return 0;const m=t.match(EMO_RE);return m&&m.join('')===t?m.length:0};

/* ---------- avatars ---------- */
function AVATAR(c,size='w-12 h-12'){
 if(c&&c.saved)return `<div class="${size} rounded-full flex items-center justify-center text-white flex-none accbg">${I('bookmark')}</div>`;
 const u=xU(c&&(c.avatar||c.avatar_url));
 if(u)return `<img src="${esc(u)}" alt="" loading="lazy" class="${size} rounded-full object-cover flex-none">`;
 return `<div class="${size} rounded-full flex items-center justify-center text-white font-semibold flex-none" style="background:${col(c.id)}">${c.grp?I('users'):esc(ini(c.n||c.name))}</div>`;
}
const avatar=AVATAR;

/* ---------- message model ---------- */
const toM=x=>({id:x.id,out:x.sender_id===ME.id,sid:x.sender_id,sname:x.sender_name,body:x.body||'',kind:x.kind||'text',at:x.created_at,url:x.media_url,meta:x.media_meta||{},
 rid:x.reply_to,reply:null,edited:!!x.edited_at,starred:!!x.starred,rx:x.reactions||[],dby:x.delivered_by||[],rby:x.read_by||[],rcp:Math.max(1,x.recipients||1)});
const tickOf=m=>m.rby.length>=m.rcp?2:m.dby.length>=m.rcp?1:0;
const prevTxt=m=>m.kind==='text'?m.body:(m.kind==='poll'&&m.meta&&m.meta.question)?m.meta.question:(KL[m.kind]||m.body);
function resolveReplies(arr){arr.forEach(m=>{if(!m.rid)return;const o=arr.find(y=>y.id===m.rid);m.reply=o?{name:o.out?'You':(o.sname||''),text:prevTxt(o)}:{name:'',text:'Message'}})}
const lastOf=c=>{const m=c.loaded&&c.msgs[c.msgs.length-1];return m?{body:m.body,kind:m.kind,out:m.out,at:m.at,st:m.tmp?-1:tickOf(m),meta:m.meta}:(c.loaded?null:c.last)};
const toChat=c=>({id:c.id,n:c.name||'Group',grp:c.is_group,pin:c.pinned,f:c.folder||undefined,u:c.unread||0,peer:c.peer_id,ls:c.peer_last_seen,
 saved:c.name==='Saved messages'&&!c.is_group&&!c.peer_id,
 last:c.last?{body:c.last.body,kind:c.last.kind,out:c.last.sender_id===ME.id,at:c.last.created_at}:null,msgs:[],loaded:false,more:false});
const isOn=c=>!c.grp&&c.peer&&ONL.has(c.peer);
const lsText=c=>c.saved?'message yourself':c.grp?(c.mnames?c.mnames:'tap for group info'):isOn(c)?'online':c.ls?'last seen '+lsFmt(c.ls):'';
const stTxt=lsText;
const tickHtml=m=>m.fail?`<span class="text-red-500" title="Not sent">${I('info','ic-xs')}</span>`:m.tmp?I('clock','ic-xs'):(cur&&cur.saved?'':tick(tickOf(m)));

/* ---------- generic full-screen dialog ---------- */
let XFW=null;
function xOv(title,body,footer){
 $('xovT').textContent=title;$('xovB').innerHTML=body||'';const f=$('xovF');
 if(footer){f.innerHTML=footer;f.style.display='block'}else f.style.display='none';
 $('xov').style.display='flex';
}
function xOvClose(){$('xov').style.display='none';XFW=null}

/* ================= API + auth ================= */
async function api(path,{method='GET',body}={}){
 const h={};if(TOKEN)h.Authorization='Bearer '+TOKEN;
 let b;if(body instanceof FormData)b=body;else if(body){h['Content-Type']='application/json';b=JSON.stringify(body)}
 const r=await fetch('/api'+path,{method,headers:h,body:b});
 if(r.status===204)return null;
 if(r.status===401&&TOKEN&&!path.startsWith('/auth')){ls('libra_token',null);location.reload();return}
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||'Request failed ('+r.status+')');
 return d;
}
const xUpload=f=>{const fd=new FormData();fd.append('file',f,f.name||'file');return api('/upload',{method:'POST',body:fd})};
const auErr=t=>{$('auErr').textContent=t||''};
let _rs=null;
function auTimer(){
 let s=60;const b=$('auResend');clearInterval(_rs);
 const tk=()=>{b.textContent=s>0?`Resend in ${s}s`:'Resend code';b.disabled=s>0;if(s<=0)clearInterval(_rs);s--};
 tk();_rs=setInterval(tk,1000);
}
async function auResend(){try{await api('/auth/request-otp',{method:'POST',body:{phone:P.phone}});auErr();toast('New code sent');auTimer()}catch(e){auErr(e.message)}}
function auChange(){clearInterval(_rs);auErr();$('au2').style.display='none';$('au1').style.display='block';$('auPh').focus()}
async function auNext(){
 const n=$('auName').value.trim(),ph=$('auPh').value.trim();
 if(!n||!ph)return auErr('Enter your name and phone number');
 if(!/^\+\d{7,15}$/.test(ph))return auErr('Use international format, e.g. +254712345678');
 try{
  await api('/auth/request-otp',{method:'POST',body:{phone:ph}});
  auErr();P.name=n;P.phone=ph;$('auTo').textContent=ph;
  $('au1').style.display='none';$('au2').style.display='block';$('auCode').focus();auTimer();
 }catch(e){auErr(e.message)}
}
async function auVerify(){
 try{
  const d=await api('/auth/verify',{method:'POST',body:{phone:P.phone,code:$('auCode').value.trim(),name:P.name}});
  TOKEN=d.token;ls('libra_token',TOKEN);$('auCode').value='';auErr();await boot(d.user);
 }catch(e){auErr(e.message)}
}
async function logout(){
 try{if(SWREG&&'PushManager' in window){const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await api('/push/unsubscribe',{method:'POST',body:{endpoint:sub.endpoint}}).catch(()=>{})}}catch(e){}
 ls('libra_token',null);location.reload();
}
async function init(){
 TOKEN=ls('libra_token');if(!TOKEN)return;
 try{await boot(await api('/me'))}catch(e){console.error('boot',e);TOKEN=null}
}
async function boot(u){
 ME=u;P.name=u.name;P.about=u.about||P.about;P.phone=u.phone;
 P.bizName=u.biz_name||'';P.bizCat=u.biz_cat||'';P.bizDesc=u.biz_desc||'';
 P.bizUrl=u.biz_url||'';P.bizEmail=u.biz_email||'';P.bizAddr=u.biz_addr||'';P.bizHours=u.biz_hours||'';
 S.noOnline=!!u.hide_online;S.noBlue=!!u.hide_read;S.noType=!!u.hide_typing;S.ghost=S.noOnline&&S.noBlue&&S.noType;
 if(u.accent)accent(u.accent);
 $('auth').style.display='none';
 connectSocket();await refreshChats();
 const want=new URLSearchParams(location.search).get('chat');
 if(want){history.replaceState(null,'',location.pathname);openChat(want)}
 loadStatuses().catch(console.error);loadCalls().catch(console.error);
 api('/turn').then(r=>{ICE=r}).catch(()=>{});
 pushCheck().then(()=>{if('Notification' in window&&Notification.permission==='granted')pushEnable()});
}

/* ================= chats data ================= */
async function loadMeta(){                       // avatars, archived, muted, blocked
 try{
  const m=await api('/extras/meta');
  XM={blocked:m.blocked||[],admin:!!m.admin};
  chats.forEach(c=>{const x=m.chats[c.id]||{};c.avatar=x.avatar||null;c.archived=!!x.archived;c.muted=!!x.muted;c.blockedByMe=!!x.blocked_by_me;c.blockedMe=!!x.blocked_me});
  if(m.me)ME.avatar_url=m.me.avatar_url;
  adminLink();
 }catch(e){/* server without extras */}
}
async function refreshChats(){
 const rows=await api('/chats'),old=new Map(chats.map(c=>[c.id,c]));
 chats=rows.map(r=>{
  const n=toChat(r),o=old.get(r.id);if(!o)return n;
  Object.assign(o,{n:n.n,pin:n.pin,f:n.f,grp:n.grp,peer:n.peer,ls:n.ls,saved:n.saved});
  if(cur!==o)o.u=n.u;if(!o.loaded)o.last=n.last;
  return o;
 });
 await loadMeta();
 folders=[...new Set([...folders,...chats.map(c=>c.f).filter(Boolean)])];
 if(cur){const k=chats.find(c=>c.id===cur.id);if(k){cur=k;renderHead()}else closeChat()}
 renderTabs();renderList();
}

/* ================= chat list ================= */
function setTab(t){
 if(t==='Locked'&&!unlockedNow()){openLock('verify',()=>{S.tab='Locked';renderTabs();renderList()});return}
 S.tab=t;renderTabs();renderList();
}
function renderTabs(){
 const tabs=['All','Unread','Groups',...folders,...(chats.some(c=>c.archived)?['Archived']:[]),...(LOCKED.size?['Locked']:[])];
 $('tabs').innerHTML=tabs.map(t=>`<button data-t="${esc(t)}" onclick="setTab(this.dataset.t)" class="px-3 py-1 rounded-full border bd ${S.tab===t?'accbg text-white border-transparent':'mut'}">${t==='Locked'?I('lock','ic-xs')+' ':''}${esc(t)}</button>`).join('')+`<button onclick="addFolder()" class="px-3 py-1 rounded-full border bd mut" title="New folder">${I('plus','ic-s')}</button>`;
}
function setSec(x){S.sec=x;renderList()}
function renderNav(){
 const un=sts.some(x=>!x.seen);
 $('nav').innerHTML=[['chats','Chats'],['status','Status'],['calls','Calls']].map(([k,t])=>`<button onclick="setSec('${k}')" class="flex-1 py-2.5 border-b-2 ${S.sec===k?'acc':'mut border-transparent'}" style="${S.sec===k?'border-color:var(--accent)':''}">${t}${k==='status'&&un?' <span class="inline-block w-2 h-2 rounded-full accbg align-middle"></span>':''}</button>`).join('');
 $('fab').innerHTML=I(S.sec==='status'?'pencil':'chat','ic-l');
}
function preview(c){
 if(DR[c.id]&&(!cur||cur.id!==c.id))return `<div class="flex items-center gap-1 flex-1 min-w-0 text-sm mut"><span class="text-red-500">Draft:</span><span class="truncate">${esc(DR[c.id])}</span></div>`;
 const l=lastOf(c);
 if(!l)return `<span class="text-sm mut flex-1 truncate">${c.saved?'Keep notes, links and files here':'No messages yet'}</span>`;
 const icon={image:'image',video:'video',voice:'mic',file:'file',sticker:'sticker',location:'map-pin',contact:'contact',poll:'poll'}[l.kind];
 const txt=isLocked(c)?'Locked chat':l.kind==='text'?esc(l.body):l.kind==='poll'&&l.meta&&l.meta.question?esc(l.meta.question):esc(KL[l.kind]||l.body||'');
 const st=l.out&&l.st!=null&&!c.saved?(l.st<0?I('clock','ic-xs'):tick(l.st)):'';
 return `<div class="flex items-center gap-1 flex-1 min-w-0 text-sm mut">${st}${icon&&!isLocked(c)?I(icon,'ic-s'):''}<span class="truncate">${txt}</span></div>`;
}
function chatsForTab(){
 const qv=$('q').value.trim().toLowerCase();
 let l=chats.filter(c=>c.n.toLowerCase().includes(qv));
 if(S.tab==='Locked')return unlockedNow()?l.filter(isLocked):[];
 l=l.filter(c=>!isLocked(c));
 if(S.tab==='Archived')return l.filter(c=>c.archived);
 l=l.filter(c=>!c.archived);
 if(S.tab==='Unread')l=l.filter(c=>c.u);else if(S.tab==='Groups')l=l.filter(c=>c.grp);else if(folders.includes(S.tab))l=l.filter(c=>c.f===S.tab);
 return l.sort((a,b)=>(b.pin?1:0)-(a.pin?1:0));
}
const XS={q:'',html:''};
function renderList(){
 renderNav();renderNbar();
 $('tabs').style.display=S.sec==='chats'?'flex':'none';$('qwrap').style.display=S.sec==='chats'?'block':'none';
 const tot=chats.filter(c=>!c.archived&&!c.muted&&!isLocked(c)).reduce((a,c)=>a+(c.u||0),0);
 document.title=tot?`(${tot}) LIBRA`:'LIBRA';
 try{tot?navigator.setAppBadge&&navigator.setAppBadge(tot):navigator.clearAppBadge&&navigator.clearAppBadge()}catch(e){}
 if(S.sec==='status')return renderStatus();
 if(S.sec==='calls')return renderCalls();
 const qv=$('q').value.trim().toLowerCase(),l=chatsForTab();
 $('list').innerHTML=l.map(c=>{
  const x=lastOf(c),lk=isLocked(c);
  return `<div onclick="openChat('${c.id}')" class="row ${cur&&cur.id===c.id?'on':''} flex items-center gap-3 px-4 py-3 cursor-pointer"><div class="relative flex-none">${lk?`<div class="w-12 h-12 rounded-full flex items-center justify-center text-white" style="background:var(--muted)">${I('lock')}</div>`:avatar(c)}${!lk&&isOn(c)?'<span class="odot"></span>':''}</div>
 <div class="flex-1 min-w-0 border-b bd pb-3 -mb-3"><div class="flex items-center gap-2"><span class="font-semibold truncate flex-1 text-[15px]">${esc(c.n)}</span><span class="text-xs flex-none ${c.u&&!c.muted?'acc':'mut'}">${listTime(x)}</span></div>
 <div class="flex items-center gap-2 mt-0.5">${preview(c)}${c.muted?I('bell-off','ic-s mut'):''}${c.pin?I('pin','ic-s mut'):''}${c.u?`<span class="${c.muted?'bg-gray-400':'accbg'} text-white text-xs font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">${c.u}</span>`:''}</div></div></div>`;
 }).join('')||(S.tab==='Locked'?'<p class="text-center mut text-sm mt-10 px-6">Unlock with your PIN to see locked chats.</p>':'<p class="text-center mut text-sm mt-10 px-6">No chats here yet. Tap the button below to start one.</p>');
 $('list').insertAdjacentHTML('beforeend',`<div id="xmsgres">${XS.q===qv?XS.html:''}</div>`);
 searchMsgs(qv);
}
let _sq=null;
function searchMsgs(qv){
 clearTimeout(_sq);
 if(qv.length<3){XS.q='';XS.html='';return}
 if(XS.q===qv)return;
 _sq=setTimeout(async()=>{
  try{
   const r=(await api('/extras/search?q='+encodeURIComponent(qv))).filter(m=>{const c=chats.find(x=>x.id===m.chat_id);return !c||!isLocked(c)});
   XS.q=qv;
   XS.html=r.length?`<p class="px-4 pt-3 pb-1 text-xs font-semibold mut">Messages</p>`+r.map(m=>`<div class="row px-4 py-2.5 cursor-pointer" data-c="${esc(m.chat_id)}" data-m="${esc(m.id)}" onclick="xJump(this.dataset.c,this.dataset.m)"><div class="text-xs acc truncate">${esc(m.chat_name||'Chat')} · ${esc(m.sender_name||'')} · ${listTime({at:m.created_at})}</div><div class="text-sm truncate">${esc(m.body)}</div></div>`).join(''):'';
   if($('xmsgres')&&$('q').value.trim().toLowerCase()===qv)$('xmsgres').innerHTML=XS.html;
  }catch(e){}
 },300);
}
async function xJump(chatId,msgId){
 $('q').value='';XS.q='';$('xov').style.display='none';await openChat(chatId);
 const c=chats.find(x=>x.id===chatId);if(!c)return;
 let n=0;while(c.loaded&&!c.msgs.some(m=>m.id===msgId)&&c.more&&n++<15)await loadOlder();
 const el=document.querySelector(`[data-mid="${CSS.escape(msgId)}"]`);
 if(el){el.scrollIntoView({block:'center'});el.classList.add('xflash');setTimeout(()=>el.classList.remove('xflash'),1800)}
}

/* ================= opening a chat ================= */
let _hp=false;
function showChatUI(){
 $('empty').classList.add('hidden');$('chat').classList.remove('hidden');$('chat').classList.add('flex');
 $('main').classList.remove('hidden');$('main').classList.add('flex');
 if(innerWidth<768){$('side').classList.add('hidden');if(!_hp){history.pushState({c:1},'');_hp=true}}
}
function closeChat(){
 if(cur)cur.divAt=-1;
 selClear();cur=null;setReply(null);hidePanels();
 $('side').classList.remove('hidden');if(innerWidth<768)$('main').classList.add('hidden');
 $('chat').classList.add('hidden');$('chat').classList.remove('flex');$('empty').classList.remove('hidden');renderList();
}
function back(){if(_hp){history.back();return}closeChat()}
addEventListener('popstate',()=>{_hp=false;if(cur)closeChat()});
function renderHead(){
 $('hName').textContent=cur.n;
 const a=$('hAv');
 if(xU(cur.avatar)){a.style.background='transparent';a.innerHTML=`<img src="${esc(xU(cur.avatar))}" alt="" class="w-10 h-10 rounded-full object-cover">`}
 else if(cur.saved){a.style.background='var(--accent)';a.innerHTML=I('bookmark')}
 else{a.style.background=col(cur.id);a.innerHTML=cur.grp?I('users'):esc(ini(cur.n))}
 $('hSt').textContent=stTxt(cur);
 composerState();
}
function composerState(){
 const ft=$('foot'),b=$('xblk'),blocked=!!cur&&!!cur.blockedByMe;
 ft.style.display=blocked?'none':'';b.style.display=blocked?'flex':'none';
 if(blocked)b.innerHTML=`<span class="flex-1 text-sm mut">You blocked ${esc(cur.n)}.</span><button onclick="unblockCur()" class="accbg text-white rounded-lg px-3 py-1.5 text-sm">Unblock</button>`;
}
function calcDivider(c,n){
 c.divAt=-1;if(!n)return;let cnt=0;
 for(let i=c.msgs.length-1;i>=0;i--)if(!c.msgs[i].out&&(++cnt===n)){c.divAt=i;c.divN=n;return}
}
async function openChat(id){
 let c=chats.find(x=>x.id===id);
 if(!c){await refreshChats().catch(()=>{});c=chats.find(x=>x.id===id)}
 if(!c)return;
 if(isLocked(c)&&!unlockedNow()){openLock('verify',()=>openChat(id));return}
 const unread=c.u;
 cur=c;c.u=0;setReply(null);selClear();showChatUI();renderHead();
 $('inp').value=DR[c.id]||'';syncSend();
 renderMsgs(true);renderList();
 if(!c.loaded){
  try{const arr=await api(`/chats/${id}/messages`);c.msgs=arr.reverse().map(toM);resolveReplies(c.msgs);c.more=arr.length>=50;c.loaded=true}
  catch(e){toast(e.message);return}
 }
 calcDivider(c,unread);
 if(cur===c){renderMsgs(c.divAt>=0?'div':true);renderList();sock&&sock.emit('chat:read',{chat_id:id});loadPolls(c);ensureMembers(c)}
}
async function loadOlder(){
 const c=cur;if(!c||!c.loaded||!c.more||c.busy||!c.msgs.length)return;c.busy=true;
 try{
  const box=$('msgs'),h=box.scrollHeight;
  const arr=(await api(`/chats/${c.id}/messages?before=${encodeURIComponent(c.msgs[0].at)}`)).reverse().map(toM);
  const have=new Set(c.msgs.map(m=>m.id));const add=arr.filter(m=>!have.has(m.id));
  c.more=arr.length>=50;c.msgs=[...add,...c.msgs];resolveReplies(c.msgs);
  if(cur===c){renderMsgs(false);box.scrollTop=box.scrollHeight-h;loadPolls(c)}
 }catch(e){}finally{c.busy=false}
}
async function ensureMembers(c){
 if(!c||!c.grp||c.members||c.mload)return;c.mload=1;
 try{
  const ms=await api(`/chats/${c.id}/members`);c.members=ms;
  c.mnames=ms.map(x=>x.id===ME.id?'You':x.name.split(' ')[0]).slice(0,6).join(', ')+(ms.length>6?'…':'');
  c.mre=ms.length?new RegExp('@('+ms.map(x=>escRe(esc(x.name))).sort((a,b)=>b.length-a.length).join('|')+')','gi'):null;
  if(cur===c){$('hSt').textContent=stTxt(c);renderMsgs()}
 }catch(e){}
 c.mload=0;
}

/* ================= rendering messages ================= */
function mediaHtml(m,i){
 const u=xU(m.url),meta=m.meta||{};
 const cap=m.body?`<div class="mtx px-1.5 pt-1.5 pb-0.5">${rich(m.body,cur)}</div>`:'';
 switch(m.kind){
  case 'image':return `<img src="${esc(u)}" loading="lazy" class="xmedia cursor-zoom-in" alt="Photo" onclick="event.stopPropagation();openMediaViewer(${i})">${cap}`;
  case 'video':return `<div class="relative inline-block"><video src="${esc(u)}" class="xmedia" controls preload="metadata" playsinline onclick="event.stopPropagation()"></video><button onclick="event.stopPropagation();openMediaViewer(${i})" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center z-10" title="Full screen">${I('expand','ic-s')}</button></div>${cap}`;
  case 'sticker':return meta.emoji?`<span class="emj" style="font-size:84px;line-height:1.1;display:block">${esc(meta.emoji)}</span>`:`<img src="${esc(u)}" class="xsticker" alt="Sticker" loading="lazy">`;
  case 'file':return `<a href="${esc(u)}" target="_blank" rel="noopener" download="${esc(meta.name||'file')}" onclick="event.stopPropagation()" class="flex items-center gap-2 py-1"><div class="w-10 h-10 rounded-lg accbg text-white flex items-center justify-center flex-none">${I('file')}</div><div class="min-w-0"><div class="text-sm truncate max-w-[180px]">${esc(meta.name||'Document')}</div><div class="text-xs mut">${esc(meta.size||'')}</div></div></a>${cap}`;
  case 'voice':{const bars=meta.waveform&&meta.waveform.length?meta.waveform:[40,70,50,80,45];
   return `<div class="flex items-center gap-2 py-1 min-w-[230px]"><button onclick="event.stopPropagation();play(${i},this)" class="w-9 h-9 rounded-full accbg text-white flex-none flex items-center justify-center">${I('play','ic-s')}</button><div class="flex items-center gap-[2px] h-7 flex-1">${bars.map(h=>`<i class="w-[3px] rounded bg-current opacity-40" style="height:${Math.max(5,Math.min(100,Number(h)||0))}%"></i>`).join('')}</div><span class="text-xs mut">${fmt(Number(meta.duration)||1)}</span><button class="vsp" onclick="event.stopPropagation();vspd()">${VSPD}×</button></div>`}
  case 'location':{const la=+meta.lat,ln=+meta.lng,ok=Math.abs(la)<=90&&Math.abs(ln)<=180;
   const href=ok?`https://www.openstreetmap.org/?mlat=${la}&amp;mlon=${ln}#map=16/${la}/${ln}`:'';
   return `<${ok?`a href="${href}" target="_blank" rel="noopener"`:'div'} onclick="event.stopPropagation()" class="xcard"><div class="xicon" style="background:#ef4444">${I('map-pin')}</div><div class="min-w-0"><div class="text-sm font-semibold">Location</div><div class="text-xs mut truncate">${esc(meta.label||(ok?la.toFixed(5)+', '+ln.toFixed(5):''))}</div>${ok?'<div class="text-xs acc">Open in map</div>':''}</div></${ok?'a':'div'}>`}
  case 'contact':return `<div class="xcard" onclick="event.stopPropagation()"><div class="xicon" style="background:${col(meta.phone||'x')}">${esc(ini(meta.name))}</div><div class="min-w-0"><div class="text-sm font-semibold truncate">${esc(meta.name||'Contact')}</div><div class="text-xs mut">${esc(meta.phone||'')}</div></div><button data-p="${esc(meta.phone||'')}" onclick="chatWithPhone(this.dataset.p)" class="xbtn ml-auto">Message</button></div>`;
  case 'poll':return pollHtml(m,i);
  default:return `<span class="mtx">${rich(m.body,cur)}</span>`;
 }
}
function rxHtml(m){
 if(!m.rx.length)return '';const by={};m.rx.forEach(r=>by[r.emoji]=(by[r.emoji]||0)+1);
 return `<span class="rxs">${Object.entries(by).map(([e,n])=>esc(e)+(n>1?`<small class="mut"> ${n}</small>`:'')).join(' ')}</span>`;
}
function bubbleHtml(m,i){
 const big=m.kind==='text'&&!m.reply?emojiOnly(m.body):0,isBig=big>0&&big<=3;
 const cls=['bub',m.out?'out':'in',m.kind==='image'&&!m.body?'xm':'',m.kind==='video'||(m.kind==='image'&&m.body)?'xv':'',m.kind==='sticker'?'xs':'',isBig?'xe':'',SEL.set.has(m.id)?'sel':''].join(' ');
 const fwd=m.meta&&m.meta.fwd?`<div class="text-xs mut italic mb-0.5 flex items-center gap-1">${I('forward','ic-xs')}Forwarded</div>`:'';
 return `<div class="${cls}" data-i="${i}" data-mid="${esc(m.id)}" style="${m.rx.length?'margin-bottom:12px;':''}${m.tmp&&!m.fail?'opacity:.75':''}" ondblclick="reactQuick(${i},'❤️')" onclick="bubClick(${i},event)">
 ${cur.grp&&!m.out?`<div class="text-xs font-semibold mb-0.5" style="color:${col(m.sid)}">${esc(m.sname||'')}</div>`:''}${fwd}
 ${m.reply?`<div class="rq">${m.reply.name?`<div class="font-semibold acc">${esc(m.reply.name)}</div>`:''}<div class="truncate mut">${esc(m.reply.text)}</div></div>`:''}
 ${isBig?`<span class="emj xbig">${esc(m.body.trim())}</span>`:mediaHtml(m,i)}
 ${m.fail?'<div class="text-xs text-red-500">Not sent. Tap to retry.</div>':''}
 <span class="meta">${m.starred?I('star','ic-xs fillc'):''}${m.edited?'edited':''} ${tm(m.at)} ${m.out?tickHtml(m):''}</span><div class="clear-both"></div>${rxHtml(m)}</div>`;
}
function renderMsgs(toBottom){
 const box=$('msgs'),keep=box.scrollTop;let h='',prev=null;
 cur.msgs.forEach((m,i)=>{
  const d=new Date(m.at);if(!prev||!sameDay(prev,d))h+=`<div class="day">${dayLabel(d)}</div>`;prev=d;
  if(cur.divAt===i)h+=`<div class="day unreadDiv">${cur.divN} unread message${cur.divN>1?'s':''}</div>`;
  h+=bubbleHtml(m,i);
 });
 if(!cur.msgs.length)h=`<div class="day">${cur.loaded?(cur.saved?'Save messages, links and files for yourself':'No messages yet. Say hi!'):'Loading…'}</div>`;
 box.innerHTML=h;
 if(toBottom==='div'){const d=box.querySelector('.unreadDiv');d?d.scrollIntoView({block:'start'}):box.scrollTop=box.scrollHeight}
 else box.scrollTop=toBottom?box.scrollHeight:keep;
 scrollBtn();
}
$('msgs').addEventListener('scroll',e=>{if(e.target.scrollTop<60)loadOlder();scrollBtn()});
function scrollBtn(){const b=$('msgs');$('xdown').style.display=b.scrollHeight-b.scrollTop-b.clientHeight>400?'flex':'none'}
function xToBottom(){const b=$('msgs');b.scrollTo({top:b.scrollHeight,behavior:'smooth'})}

/* ---------- touch gestures: swipe right to reply, long-press to select ---------- */
let LONGUNTIL=0;
(function(){
 const box=$('msgs');let t=null;
 box.addEventListener('touchstart',e=>{
  const b=e.target.closest('.bub');if(!b||SEL.on||e.touches.length>1){t=null;return}
  t={b,x:e.touches[0].clientX,y:e.touches[0].clientY,on:false,dx:0};
  t.timer=setTimeout(()=>{if(t&&!t.on){LONGUNTIL=Date.now()+600;selStart(+b.dataset.i);if(navigator.vibrate)navigator.vibrate(20)}},500);
 },{passive:true});
 box.addEventListener('touchmove',e=>{
  if(!t)return;const dx=e.touches[0].clientX-t.x,dy=e.touches[0].clientY-t.y;
  if(Math.abs(dx)>10||Math.abs(dy)>10)clearTimeout(t.timer);
  if(!t.on){if(Math.abs(dy)>12){t=null;return}if(dx>12&&Math.abs(dx)>Math.abs(dy))t.on=true;else return}
  t.dx=Math.min(80,Math.max(0,dx));t.b.style.transition='none';t.b.style.transform=`translateX(${t.dx}px)`;
 },{passive:true});
 box.addEventListener('touchend',()=>{
  if(!t)return;clearTimeout(t.timer);const b=t.b;b.style.transition='transform .15s';b.style.transform='';
  if(t.on&&t.dx>60){const m=cur&&cur.msgs[+b.dataset.i];if(m&&!m.tmp){setReply(m);if(navigator.vibrate)navigator.vibrate(15)}}
  t=null;
 });
})();

/* ================= menus + multi-select ================= */
function showCtx(items,x,y,top=''){
 const c=$('ctx');
 c.innerHTML=top+items.map(([ic,t,f,danger])=>`<button class="row flex items-center gap-3 w-full text-left px-4 py-2 ${danger?'text-red-500':''}" onclick="${f}">${I(ic,'ic-s')}${t}</button>`).join('');
 c.style.display='block';
 c.style.left=Math.max(4,Math.min(x,innerWidth-c.offsetWidth-8))+'px';c.style.top=Math.max(4,Math.min(y,innerHeight-c.offsetHeight-10))+'px';
}
function hidePanels(){['att','emo','xstk'].forEach(p=>$(p).classList.add('hidden'));$('mnt').style.display='none'}
function togglePanel(id){
 ['att','emo','xstk'].forEach(p=>{if(p!==id)$(p).classList.add('hidden')});
 const el=$(id);el.classList.toggle('hidden');
 if(!el.classList.contains('hidden')){if(id==='emo')renderEmo();if(id==='xstk')renderStk()}
}
document.addEventListener('click',e=>{
 $('ctx').style.display='none';
 if(!e.target.closest('#att,#attBtn,#emo,#emoBtn,#xstk,#stkBtn,#mnt'))hidePanels();
});
function bubClick(i,e){
 if(Date.now()<LONGUNTIL){e.stopPropagation();return}
 const m=cur.msgs[i];
 if(SEL.on){e.stopPropagation();selToggle(i);return}
 if(m.tmp){if(m.fail){e.stopPropagation();showCtx([['send','Retry',`retryMsg(${i})`],['trash','Delete',`dropLocal(${i})`,true]],e.clientX,e.clientY)}return}
 msgMenu(i,e);
}
function msgMenu(i,e){
 e.stopPropagation();hidePanels();const m=cur.msgs[i];
 const top=`<div class="flex justify-between px-3 py-2 text-2xl">${QR.map(q=>`<button class="emj" onclick="reactQuick(${i},'${q}')">${q}</button>`).join('')}</div><div class="border-t bd my-1"></div>`;
 showCtx([['reply','Reply',`setReply(cur.msgs[${i}])`],...(m.kind==='text'?[['copy','Copy',`copyMsg(${i})`]]:[]),['forward','Forward',`forwardMsg(${i})`],['star',m.starred?'Unstar':'Star',`star(${i})`],
  ['check','Select',`selStart(${i})`],
  ...(m.out&&m.kind==='text'?[['pencil','Edit',`startEdit(cur.msgs[${i}])`]]:[]),
  ...(m.out&&!cur.saved?[['info','Message info',`msgInfo(${i})`]]:[]),
  ['trash','Delete for me',`delMe(${i})`,true],
  ...(m.out?[['trash','Delete for everyone',`delAll(${i})`,true]]:[['flag','Report',`reportMsg(${i})`,true]])],e.clientX,e.clientY,top);
}
function copyMsg(i){navigator.clipboard&&navigator.clipboard.writeText(cur.msgs[i].body).then(()=>toast('Copied')).catch(()=>{})}
function star(i){const m=cur.msgs[i];m.starred=!m.starred;api(`/messages/${m.id}/star`,{method:m.starred?'PUT':'DELETE'}).catch(console.error);renderMsgs()}
function setRx(m,uid,e){m.rx=m.rx.filter(r=>r.user_id!==uid);if(e)m.rx.push({user_id:uid,emoji:e})}
function reactQuick(i,emoji){
 $('ctx').style.display='none';hidePanels();
 const m=cur.msgs[i];if(m.tmp)return;
 const mine=m.rx.find(r=>r.user_id===ME.id),e=mine&&mine.emoji===emoji?null:emoji;
 setRx(m,ME.id,e);renderMsgs();api(`/messages/${m.id}/reaction`,{method:'PUT',body:{emoji:e}}).catch(console.error);
}
function dropLocal(i){cur.msgs.splice(i,1);renderMsgs();renderList()}
function delMe(i){const m=cur.msgs[i];api(`/messages/${m.id}/hide`,{method:'PUT'}).catch(console.error);dropLocal(i)}
function delAll(i){if(!confirm('Delete this message for everyone?'))return;const m=cur.msgs[i];api('/messages/'+m.id,{method:'DELETE'}).catch(console.error);dropLocal(i)}

const SEL={on:false,set:new Set()};
function selUI(){$('chatHead').style.display=SEL.on?'none':'';$('selbar').style.display=SEL.on?'flex':'none';$('selN').textContent=SEL.set.size+' selected'}
function selStart(i){const m=cur.msgs[i];if(!m||m.tmp)return;SEL.on=true;SEL.set=new Set([m.id]);selUI();renderMsgs()}
function selToggle(i){const m=cur.msgs[i];if(!m||m.tmp)return;SEL.set.has(m.id)?SEL.set.delete(m.id):SEL.set.add(m.id);if(!SEL.set.size)return selClear();selUI();renderMsgs()}
function selClear(){const was=SEL.on;SEL.on=false;SEL.set=new Set();selUI();if(was&&cur)renderMsgs()}
const selMsgs=()=>cur.msgs.filter(m=>SEL.set.has(m.id)&&!m.tmp);
function selStar(){const ms=selMsgs(),on=!ms.every(m=>m.starred);ms.forEach(m=>{m.starred=on;api(`/messages/${m.id}/star`,{method:on?'PUT':'DELETE'}).catch(()=>{})});selClear();toast(on?'Starred':'Unstarred')}
function selCopy(){const t=selMsgs().filter(m=>m.kind==='text').map(m=>m.body).join('\n');if(t&&navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast('Copied')).catch(()=>{});selClear()}
function selForward(){const ms=selMsgs();if(!ms.length)return;selClear();forwardPicker(ms.map(fwdPayload))}
function selDelete(){const ms=selMsgs();if(!ms.length||!confirm(`Delete ${ms.length} message${ms.length>1?'s':''} for you?`))return;ms.forEach(m=>api(`/messages/${m.id}/hide`,{method:'PUT'}).catch(()=>{}));cur.msgs=cur.msgs.filter(m=>!SEL.set.has(m.id));selClear();renderList()}

/* ================= composer ================= */
function setReply(m){
 rep=m;if(editM&&!m){editM=null;$('inp').value='';syncSend()}
 const r=$('reply');if(!m){r.classList.add('hidden');return}
 $('replyN').textContent=m.out?'You':(m.sname||'');$('replyTx').textContent=prevTxt(m);r.classList.remove('hidden');$('inp').focus();
}
function startEdit(m){rep=null;editM=m;$('inp').value=m.body;$('reply').classList.remove('hidden');$('replyN').textContent='Editing message';$('replyTx').textContent=m.body;$('inp').focus();syncSend()}
function resize(){const t=$('inp');t.style.height='auto';t.style.height=Math.min(t.scrollHeight,128)+'px'}
function syncSend(){$('sendBtn').innerHTML=I($('inp').value.trim()?'send':'mic','ic-l');resize()}
let _tt=null,_dt=null;
function upd(){
 syncSend();
 const t=$('inp').value,has=!!t.trim();
 if(cur&&!editM){clearTimeout(_dt);const id=cur.id;_dt=setTimeout(()=>{has?DR[id]=t:delete DR[id];ls('libra_drafts',JSON.stringify(DR));renderList()},400)}
 mentionCheck();
 if(!cur||!sock||!has)return;
 if(!_tt)sock.emit('typing',{chat_id:cur.id,typing:true});
 clearTimeout(_tt);_tt=setTimeout(()=>{sock.emit('typing',{chat_id:cur.id,typing:false});_tt=null},1500);
}
function onKey(e){
 if(MN.on&&['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(e.key)){
  e.preventDefault();
  if(e.key==='ArrowDown')MN.idx=(MN.idx+1)%MN.list.length;
  else if(e.key==='ArrowUp')MN.idx=(MN.idx-1+MN.list.length)%MN.list.length;
  else if(e.key==='Escape'){MN.on=false;$('mnt').style.display='none';return}
  else{mentionPick(MN.list[MN.idx].name);return}
  mentionDraw();return;
 }
 if(e.key==='Enter'&&!COARSE){
  const go=CFG.enter?!e.shiftKey:(e.ctrlKey||e.metaKey);
  if(go){e.preventDefault();send()}
 }
}
function sendOrRec(){if($('inp').value.trim())send();else startRec()}
function send(){
 const t=$('inp').value.trim();if(!t||!cur)return;
 if(editM){
  const m=editM;api('/messages/'+m.id,{method:'PATCH',body:{body:t}}).catch(e=>toast(e.message));
  m.body=t;m.edited=true;editM=null;$('inp').value='';setReply(null);syncSend();renderMsgs();renderList();return;
 }
 const rid=rep?rep.id:null,rcopy=rep?{name:rep.out?'You':(rep.sname||''),text:prevTxt(rep)}:null;
 $('inp').value='';setReply(null);syncSend();hidePanels();
 delete DR[cur.id];ls('libra_drafts',JSON.stringify(DR));
 clearTimeout(_tt);_tt=null;sock.emit('typing',{chat_id:cur.id,typing:false});
 sendText(cur,t,rid,rcopy);
}
/* optimistic send: the bubble appears at once with a clock, then turns into the real message */
function sendText(c,t,rid,rcopy){
 const m={id:'tmp'+Date.now()+Math.random().toString(36).slice(2,6),tmp:true,out:true,sid:ME.id,sname:ME.name,body:t,kind:'text',at:new Date().toISOString(),url:null,meta:{},rid,reply:rcopy,edited:false,starred:false,rx:[],dby:[],rby:[],rcp:1};
 c.msgs.push(m);c.last={body:t,kind:'text',out:true,at:m.at};
 chats=[c,...chats.filter(k=>k!==c)];
 if(cur===c)renderMsgs(true);renderList();
 sock.emit('message:send',{chat_id:c.id,body:t,kind:'text',reply_to:rid},a=>{
  if(a&&a.ok&&a.message){
   const i=c.msgs.indexOf(m);if(i<0)return;
   if(c.msgs.some(y=>y.id===a.message.id))c.msgs.splice(i,1);else c.msgs[i]=Object.assign(toM(a.message),{reply:rcopy});
   if(cur===c)renderMsgs();renderList();
  }else{m.fail=true;if(cur===c)renderMsgs();toast('Message not sent. Tap it to retry.')}
 });
}
function retryMsg(i){const m=cur.msgs[i];if(!m||!m.fail)return;cur.msgs.splice(i,1);sendText(cur,m.body,m.rid,m.reply)}
const xSend=o=>sock.emit('message:send',o,a=>{if(!a||!a.ok)toast('Message not sent. Check your connection.')});

/* ---------- @mentions in groups ---------- */
const MN={on:false,list:[],idx:0,start:0};
function mentionCheck(){
 const t=$('inp'),pop=$('mnt');
 if(!cur||!cur.grp){MN.on=false;pop.style.display='none';return}
 const pos=t.selectionStart,m=t.value.slice(0,pos).match(/(^|\s)@([^\s@]{0,20})$/);
 if(!m){MN.on=false;pop.style.display='none';return}
 const start=pos-m[2].length-1,q=m[2].toLowerCase(),c=cur;
 ensureMembers(c).then(()=>{
  if(cur!==c||!c.members)return;
  MN.list=c.members.filter(x=>x.id!==ME.id&&x.name.toLowerCase().includes(q)).slice(0,6);
  MN.on=MN.list.length>0;MN.idx=0;MN.start=start;mentionDraw();
 });
}
function mentionDraw(){
 const pop=$('mnt');if(!MN.on){pop.style.display='none';return}
 pop.innerHTML=MN.list.map((x,i)=>`<button type="button" data-n="${esc(x.name)}" onmousedown="event.preventDefault();mentionPick(this.dataset.n)" class="row flex items-center gap-2 w-full px-3 py-2 text-left text-sm ${i===MN.idx?'on':''}">${avatar({id:x.id,n:x.name,avatar_url:x.avatar_url},'w-7 h-7')}<span class="truncate">${esc(x.name)}</span></button>`).join('');
 pop.style.display='block';
}
function mentionPick(name){
 const t=$('inp'),pos=t.selectionStart;
 t.value=t.value.slice(0,MN.start)+'@'+name+' '+t.value.slice(pos);
 const p=MN.start+name.length+2;t.selectionStart=t.selectionEnd=p;t.focus();
 MN.on=false;$('mnt').style.display='none';upd();
}

/* ================= realtime ================= */
let _typTimer=null;
function connectSocket(){
 sock=io({auth:{token:TOKEN}});
 const find=id=>chats.find(c=>c.id===id);
 sock.on('connect_error',e=>console.error('socket:',e.message));
 sock.on('connect',()=>{if(cur&&cur.loaded){cur.loaded=false;openChat(cur.id)}});
 wireCalls();wireGroups();
 sock.on('status:new',()=>loadStatuses().catch(console.error));
 sock.on('poll:update',({message_id})=>{chats.forEach(c=>{if(c.msgs.some(m=>m.id===message_id))loadPolls(c,[message_id])})});
 sock.on('message:new',x=>{
  const c=find(x.chat_id);if(!c){refreshChats();return}
  const m=toM(x);c.last={body:x.body,kind:x.kind,out:m.out,at:x.created_at};
  if(c.loaded&&!c.msgs.some(y=>y.id===m.id)){
   if(m.out){const pi=c.msgs.findIndex(y=>y.tmp&&!y.fail&&m.kind==='text'&&y.body===m.body);if(pi>=0)c.msgs.splice(pi,1)}
   c.msgs.push(m);resolveReplies(c.msgs);
  }
  if(!m.out){
   sock.emit('message:delivered',{message_id:x.id});
   if(cur===c&&!document.hidden)sock.emit('chat:read',{chat_id:c.id});else{c.u++;if(!c.muted&&!c.archived)banner(c,m)}
  }
  chats=[c,...chats.filter(k=>k!==c)];
  if(cur===c){const bx=$('msgs'),near=m.out||bx.scrollHeight-bx.scrollTop-bx.clientHeight<160;renderMsgs(near);if(m.kind==='poll')loadPolls(c)}
  renderList();
 });
 sock.on('message:edited',x=>{const c=find(x.chat_id),m=c&&c.msgs.find(y=>y.id===x.id);if(m){m.body=x.body;m.edited=true;if(cur===c)renderMsgs();renderList()}});
 sock.on('message:deleted',({id,chat_id})=>{const c=find(chat_id);if(!c)return;c.msgs=c.msgs.filter(y=>y.id!==id);if(cur===c)renderMsgs();renderList()});
 sock.on('message:reaction',({message_id,user_id,emoji})=>{chats.forEach(c=>c.msgs.forEach(m=>{if(m.id===message_id)setRx(m,user_id,emoji)}));if(cur)renderMsgs()});
 sock.on('message:delivered',({message_id,user_id})=>{chats.forEach(c=>c.msgs.forEach(m=>{if(m.id===message_id&&!m.dby.includes(user_id))m.dby.push(user_id)}));if(cur)renderMsgs();renderList()});
 sock.on('chat:delivered',({chat_id,user_id})=>{const c=find(chat_id);if(!c)return;c.msgs.forEach(m=>{if(m.out&&!m.dby.includes(user_id))m.dby.push(user_id)});if(cur===c)renderMsgs();renderList()});
 sock.on('chat:read',({chat_id,user_id})=>{const c=find(chat_id);if(!c)return;c.msgs.forEach(m=>{if(!m.out)return;if(!m.dby.includes(user_id))m.dby.push(user_id);if(!m.rby.includes(user_id))m.rby.push(user_id)});if(cur===c)renderMsgs();renderList()});
 sock.on('typing',async({chat_id,user_id,typing})=>{
  const c=find(chat_id);if(!c||cur!==c)return;
  let who='';
  if(c.grp){await ensureMembers(c);const mem=(c.members||[]).find(x=>x.id===user_id);who=mem?mem.name.split(' ')[0]+' is ':'Someone is '}
  $('hSt').innerHTML=typing?`${esc(who)}typing <span class="dot inline-block">•</span><span class="dot inline-block">•</span><span class="dot inline-block">•</span>`:esc(stTxt(c));
  clearTimeout(_typTimer);if(typing)_typTimer=setTimeout(()=>{if(cur===c)$('hSt').textContent=stTxt(c)},4000);
 });
 sock.on('presence:init',({online})=>{ONL.clear();online.forEach(id=>ONL.add(id));if(cur)$('hSt').textContent=stTxt(cur);renderList()});
 sock.on('presence',({user_id,online,last_seen})=>{
  online?ONL.add(user_id):ONL.delete(user_id);
  chats.forEach(c=>{if(c.peer===user_id&&last_seen)c.ls=last_seen});
  if(cur&&cur.peer===user_id)$('hSt').textContent=stTxt(cur);
  renderList();
 });
}

/* ---------- in-app banner + sound ---------- */
let _ac;
function beep(){
 try{_ac=_ac||new (window.AudioContext||window.webkitAudioContext)();const o=_ac.createOscillator(),g=_ac.createGain(),t=_ac.currentTime;
  o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.18);
  o.connect(g);g.connect(_ac.destination);o.start();o.stop(t+.2)}catch(e){}
}
function banner(c,m){
 if(document.hidden)return;                      // the service worker shows a system notification instead
 const el=$('nb'),lk=isLocked(c);
 el.innerHTML=`${lk?`<div class="w-10 h-10 rounded-full flex items-center justify-center text-white flex-none" style="background:var(--muted)">${I('lock')}</div>`:avatar(c,'w-10 h-10')}<div class="min-w-0 flex-1"><div class="font-semibold text-sm truncate">${esc(c.n)}</div><div class="text-xs mut truncate">${lk?'New message':esc((c.grp&&m.sname?m.sname+': ':'')+prevTxt(m))}</div></div>`;
 el.dataset.id=c.id;el.classList.add('show');clearTimeout(banner.t);banner.t=setTimeout(()=>el.classList.remove('show'),4500);
 if(CFG.sound)beep();
}
function nbClick(){const id=$('nb').dataset.id;$('nb').classList.remove('show');if(id)openChat(id)}
