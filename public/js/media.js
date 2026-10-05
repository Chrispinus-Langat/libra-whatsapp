/* ===================== LIBRA media =====================
   attach menu · preview-before-send · viewer · voice notes · emoji · stickers · polls · forward · gallery */

/* ---------- attach menu ---------- */
$('att').innerHTML=[['image','bg-fuchsia-500','Photo',"$('fImg').click()"],['video','bg-purple-500','Video',"$('fVid').click()"],['camera','bg-rose-500','Camera',"$('fCam').click()"],['file','bg-indigo-500','Document',"$('fDoc').click()"],
 ['contact','bg-sky-500','Contact','shareContact()'],['map-pin','bg-emerald-500','Location','sendLocation()'],['poll','bg-amber-500','Poll','pollCreate()'],['clock','bg-slate-500','Schedule message','openSch()']]
 .map(([ic,bg,t,f])=>`<button onclick="${f}" class="row flex items-center gap-3 w-full px-3 py-2 rounded-xl"><span class="w-8 h-8 rounded-full ${bg} text-white flex items-center justify-center">${I(ic,'ic-s')}</span>${t}</button>`).join('');

/* ---------- desktop emoji panel (phones use the keyboard's own emoji) ---------- */
const EMO={
'😀':'😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 😉 😍 🥰 😘 😋 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🤯 😱 🤔 🤗 🫡 🙄 😴 😷 🤒 🥵 🥶 🤠 🥺 😳 😬 🤐 🤫 🤭 😶',
'👋':'👋 🤚 ✋ 🖖 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🧠 👀 👅 👄 🙋 🤷 🤦 💃 🕺',
'❤️':'❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💋 💯 💢 💥 💫 💦 🔥 ✨ ⭐ 🌟 🎉 🎊 🎁 🎈 🏆 🥇',
'🐶':'🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🐔 🐧 🦅 🦉 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🌸 🌹 🌻 🌲 🌴 🍀',
'🍔':'🍎 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥑 🍅 🥕 🌽 🥔 🍞 🧀 🍳 🥞 🍗 🍔 🍟 🍕 🌭 🌮 🍝 🍜 🍣 🍦 🍩 🍪 🎂 🍫 🍿 ☕ 🍵 🍺 🍷 🥂',
'⚽':'⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🥊 🎯 🎮 🎲 🎵 🎶 🎤 🎧 🎸 🚗 🚕 🚌 🏍️ ✈️ 🚀 🏠 🏢 🏖️ ⛰️ 🌍 🌙 ☀️ ⛅ 🌧️ ⚡ ❄️ 🌈 💡 📱 💻 📷 🎬 📚 ✏️ 💰 🔑 🔒'};
let emoK='😀';
function renderEmo(){
 $('emoT').innerHTML=Object.keys(EMO).map(k=>`<button type="button" class="emoTab emj" style="border-color:${k===emoK?'var(--accent)':'transparent'}" onclick="emoK='${k}';renderEmo()">${k}</button>`).join('');
 $('emoG').innerHTML=EMO[emoK].split(' ').map(e=>`<button type="button" class="emj" onclick="insEmo(this.textContent)">${e}</button>`).join('');
}
function insEmo(e){const t=$('inp'),s=t.selectionStart==null?t.value.length:t.selectionStart,en=t.selectionEnd==null?s:t.selectionEnd;t.value=t.value.slice(0,s)+e+t.value.slice(en);t.selectionStart=t.selectionEnd=s+e.length;t.focus();upd()}

/* ---------- stickers: emoji stickers + your own (made from photos) ---------- */
const STK_EMO=['😀','😂','🤣','😍','🥰','😘','😎','🤩','🥳','🥹','😭','😡','🤯','😱','🙄','😴','🤔','🤗','🙏','👍','👏','🙌','💪','🔥','💯','🎉','❤️','💔','😅','😇','😉','😜','🤝','👋','✌️','🫶','☕','🍕','🎂','🌹'];
const myStk=()=>lsJ('libra_stk',[]).filter(xU);
function renderStk(){
 const mine=myStk();
 $('xstk').innerHTML=`<div class="px-3 pt-2 pb-1 text-xs mut flex items-center">My stickers<button type="button" onclick="$('fStk').click()" class="ml-auto acc font-semibold">+ Make one</button></div>
<div class="grid grid-cols-4 gap-1 px-2 pb-2">${mine.length?mine.map(u=>`<img src="${esc(u)}" data-u="${esc(u)}" class="xstkimg" alt="" onclick="sendStickerImg(this.dataset.u)" oncontextmenu="event.preventDefault();rmStk(this.dataset.u)">`).join(''):'<p class="col-span-4 text-xs mut px-1 py-2">Turn any photo into a sticker. Right-click or long-press a sticker to remove it.</p>'}</div>
<div class="px-3 pt-1 pb-1 text-xs mut">Emoji stickers</div><div class="grid grid-cols-5 gap-1 px-2 pb-2">${STK_EMO.map(e=>`<button type="button" class="stickerBtn emj" onclick="sendStickerEmoji(this.textContent)">${e}</button>`).join('')}</div>`;
}
function sendStickerEmoji(e){if(!cur)return;xSend({chat_id:cur.id,kind:'sticker',media_meta:{emoji:e}});hidePanels()}
function sendStickerImg(u){if(!cur)return;xSend({chat_id:cur.id,kind:'sticker',media_url:u,media_meta:{}});hidePanels()}
function rmStk(u){ls('libra_stk',JSON.stringify(myStk().filter(x=>x!==u)));renderStk()}
async function makeSticker(el){
 const f=el.files[0];el.value='';if(!f)return;
 try{
  const bmp=await createImageBitmap(f),s=Math.min(512/bmp.width,512/bmp.height),w=bmp.width*s,h=bmp.height*s;
  const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(bmp,(512-w)/2,(512-h)/2,w,h);
  let type='image/webp',blob=await new Promise(r=>c.toBlob(r,type,.9));if(!blob||blob.type!==type){type='image/png';blob=await new Promise(r=>c.toBlob(r,type))}
  const u=await xUpload(new File([blob],'sticker.'+(type==='image/webp'?'webp':'png'),{type}));
  ls('libra_stk',JSON.stringify([u.url,...myStk()].slice(0,30)));
  toast('Sticker saved to My stickers');if(cur)sendStickerImg(u.url);
 }catch(e){toast(e.message||'Could not make that sticker')}
}

/* ---------- pick → preview → send (photos, videos, documents, statuses) ---------- */
let pendingMedia=null;
function pick(el,k){
 const f=el.files[0];if(!f||!cur)return;el.value='';hidePanels();
 const type=f.type||'';
 previewFile(f,k==='auto'?(type.startsWith('video')?'video':type.startsWith('image')?'image':'file'):(k==='img'?'image':k==='video'?'video':'file'),'chat',cur.id);
}
function pickStatus(el,kind){const f=el.files[0];if(!f)return;el.value='';previewFile(f,kind,'status',null)}
async function shrink(file,max=1600){
 if(!file.type.startsWith('image/')||file.type==='image/gif')return file;
 const bmp=await createImageBitmap(file).catch(()=>null);if(!bmp)return file;
 const sc=Math.min(1,max/Math.max(bmp.width,bmp.height));if(sc===1&&file.size<1.5e6)return file;
 const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);
 c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
 const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
 return new File([blob],(file.name||'photo').replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'});
}
function previewFile(f,kind,ctx,chatId){
 if(f.size>25*1024*1024){toast('That file is larger than 25 MB.');return}
 if(pendingMedia&&pendingMedia.previewUrl){try{URL.revokeObjectURL(pendingMedia.previewUrl)}catch(e){}}
 pendingMedia={file:f,kind,ctx,chatId,previewUrl:null};
 const body=$('pvBody');
 $('pvTitle').textContent=kind==='image'?'Photo':kind==='video'?'Video':(f.name||'Document');
 $('pvCap').value='';
 if(kind==='image'||kind==='video'){
  const url=URL.createObjectURL(f);pendingMedia.previewUrl=url;
  body.innerHTML=kind==='image'?`<img src="${url}" class="max-h-full max-w-full object-contain rounded-lg" alt="">`:`<video src="${url}" class="max-h-full max-w-full rounded-lg" controls autoplay muted playsinline></video>`;
 }else body.innerHTML=`<div class="text-center"><div class="w-20 h-20 rounded-2xl accbg text-white flex items-center justify-center mx-auto mb-4">${I('file','ic-xl')}</div><div class="text-sm">${esc(f.name)}</div><div class="text-xs mut mt-1">${(f.size/1024).toFixed(0)} KB</div></div>`;
 $('pv').style.display='flex';
}
function closePreview(){
 if(pendingMedia&&pendingMedia.previewUrl){try{URL.revokeObjectURL(pendingMedia.previewUrl)}catch(e){}}
 pendingMedia=null;$('pv').style.display='none';$('pvBody').innerHTML='';
}
async function sendPreview(){
 if(!pendingMedia)return;
 const {file,kind,ctx,chatId}=pendingMedia,cap=$('pvCap').value.trim();
 closePreview();toast('Uploading…');
 try{
  const up=kind==='image'?await shrink(file):file,u=await xUpload(up);
  if(ctx==='status'){
   await api('/statuses',{method:'POST',body:{bg:'#000',media_url:u.url,kind:kind==='video'?'video':'image',body:cap||undefined}});
   $('cp').style.display='none';await loadStatuses();toast('Status posted');
  }else{
   xSend({chat_id:chatId,kind,body:cap,media_url:u.url,media_meta:{name:u.name||file.name,size:up.size>1e6?(up.size/1e6).toFixed(1)+' MB':Math.ceil(up.size/1e3)+' KB',type:file.type}});
  }
 }catch(e){toast(e.message)}
}
document.addEventListener('paste',e=>{
 if(!cur)return;const items=e.clipboardData&&e.clipboardData.items;if(!items)return;
 for(const it of items){
  if(it.kind!=='file')continue;const f=it.getAsFile();if(!f)continue;
  previewFile(f,f.type.startsWith('video')?'video':f.type.startsWith('image')?'image':'file','chat',cur.id);e.preventDefault();break;
 }
});
const chatEl=$('chat');
chatEl.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
chatEl.addEventListener('drop',e=>{
 const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(!f||!cur)return;e.preventDefault();
 previewFile(f,f.type.startsWith('video')?'video':f.type.startsWith('image')?'image':'file','chat',cur.id);
});

/* ---------- full-screen media viewer ---------- */
let MV={list:[],idx:0},mvSw={x:0,y:0,dx:0,dy:0,active:false,axis:null};
function openMediaViewer(i){
 if(!cur)return;
 MV.list=cur.msgs.map((m,idx)=>({m,idx})).filter(x=>x.m.kind==='image'||x.m.kind==='video');
 if(!MV.list.length)return;
 const pos=MV.list.findIndex(x=>x.idx===i);MV.idx=pos<0?0:pos;
 $('mv').style.display='flex';mvRender();
}
function mvClose(){const v=$('mvVid');if(v){try{v.pause()}catch(e){}}$('mv').style.display='none';$('mvSlot').innerHTML='';$('mvTop').classList.remove('mvHide');$('mvBottom').classList.remove('mvHide')}
function mvRender(){
 const item=MV.list[MV.idx];if(!item)return mvClose();const m=item.m;
 $('mvName').textContent=m.out?'You':(cur.grp?(m.sname||cur.n):cur.n);
 $('mvTime').textContent=new Date(m.at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});
 $('mvIdx').textContent=(MV.idx+1)+' / '+MV.list.length;
 $('mvCaption').textContent=m.body||'';$('mvCaption').style.display=m.body?'block':'none';
 const u=xU(m.url);
 $('mvSlot').innerHTML=m.kind==='image'?`<img id="mvImg" src="${esc(u)}" alt="" style="max-width:100vw;max-height:100vh;object-fit:contain" class="select-none pointer-events-none">`:`<video id="mvVid" src="${esc(u)}" controls autoplay playsinline preload="auto" style="max-width:100vw;max-height:100vh;object-fit:contain"></video>`;
 $('mvSlot').style.transform='translateX(0)';$('mvSlot').style.transition='none';
}
function mvDownload(){
 const item=MV.list[MV.idx];if(!item)return;const m=item.m,a=document.createElement('a');
 a.href=xU(m.url);a.download=(m.meta&&m.meta.name)||('libra-'+m.kind+'-'+Date.now()+(m.kind==='video'?'.mp4':'.jpg'));a.target='_blank';
 document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),500);
}
async function mvShare(){
 const item=MV.list[MV.idx];if(!item)return;const m=item.m,u=xU(m.url);
 try{
  if(navigator.share){
   const blob=await(await fetch(u)).blob(),file=new File([blob],(m.meta&&m.meta.name)||'media',{type:blob.type});
   if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file]});else await navigator.share({url:location.origin+u});
  }else{await navigator.clipboard.writeText(location.origin+u);toast('Link copied')}
 }catch(e){if(e&&e.name!=='AbortError')toast('Could not share')}
}
(function(){
 const stage=$('mvStage'),slot=$('mvSlot');let lastTap=0;
 stage.addEventListener('touchstart',e=>{if(e.touches.length>1)return;mvSw.x=e.touches[0].clientX;mvSw.y=e.touches[0].clientY;mvSw.dx=0;mvSw.dy=0;mvSw.axis=null;mvSw.active=true;slot.style.transition='none'},{passive:true});
 stage.addEventListener('touchmove',e=>{
  if(!mvSw.active||e.touches.length>1)return;
  mvSw.dx=e.touches[0].clientX-mvSw.x;mvSw.dy=e.touches[0].clientY-mvSw.y;
  if(!mvSw.axis)mvSw.axis=Math.abs(mvSw.dx)>Math.abs(mvSw.dy)?'x':'y';
  if(mvSw.axis==='x'){let dx=mvSw.dx;if((MV.idx===0&&dx>0)||(MV.idx===MV.list.length-1&&dx<0))dx*=.35;slot.style.transform=`translateX(${dx}px)`}
 },{passive:true});
 stage.addEventListener('touchend',()=>{
  if(!mvSw.active)return;const wasX=mvSw.axis==='x',dx=mvSw.dx;mvSw.active=false;slot.style.transition='transform .22s ease-out';
  if(wasX&&Math.abs(dx)>60){
   if(dx<0&&MV.idx<MV.list.length-1){slot.style.transform='translateX(-30%)';setTimeout(()=>{MV.idx++;mvRender()},180);return}
   if(dx>0&&MV.idx>0){slot.style.transform='translateX(30%)';setTimeout(()=>{MV.idx--;mvRender()},180);return}
  }
  slot.style.transform='translateX(0)';
 });
 stage.addEventListener('click',e=>{
  if(e.target.closest('video'))return;const now=Date.now();
  if(now-lastTap<300){const img=$('mvImg');if(img){img.style.transition='transform .2s';img.style.transform=img.style.transform==='scale(2)'?'scale(1)':'scale(2)'}lastTap=0;return}
  lastTap=now;
  setTimeout(()=>{if(Date.now()-lastTap>=300){const t=$('mvTop'),b=$('mvBottom');if(t.classList.contains('mvHide')){t.classList.remove('mvHide');b.classList.remove('mvHide')}else{t.classList.add('mvHide');b.classList.add('mvHide')}}},300);
 });
 document.addEventListener('keydown',e=>{
  if($('mv').style.display!=='flex')return;
  if(e.key==='Escape')mvClose();
  if(e.key==='ArrowRight'&&MV.idx<MV.list.length-1){MV.idx++;mvRender()}
  if(e.key==='ArrowLeft'&&MV.idx>0){MV.idx--;mvRender()}
 });
})();

/* ---------- voice notes ---------- */
let mr=null,rchunks=[],rstream=null,rctx=null,rsamp=[],rTimer=null,rT0=0,rsend=false,rmime='',rchat=null;
async function startRec(){
 if(!cur||!window.MediaRecorder)return toast('Voice notes are not supported in this browser');
 try{rstream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){return toast('Allow microphone access to record voice notes')}
 rmime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
 mr=new MediaRecorder(rstream,rmime?{mimeType:rmime}:undefined);rchunks=[];rsamp=[];rchat=cur.id;
 mr.ondataavailable=e=>{if(e.data.size)rchunks.push(e.data)};
 mr.onstop=finishRec;
 rctx=new (window.AudioContext||window.webkitAudioContext)();
 const an=rctx.createAnalyser();an.fftSize=256;rctx.createMediaStreamSource(rstream).connect(an);
 const buf=new Uint8Array(an.fftSize);
 rT0=Date.now();rsend=false;mr.start();
 rTimer=setInterval(()=>{an.getByteTimeDomainData(buf);let mx=0;for(const v of buf)mx=Math.max(mx,Math.abs(v-128));rsamp.push(mx/128);$('recT').textContent=fmt(Math.round((Date.now()-rT0)/1000))},150);
 $('recT').textContent='0:00';$('rec').style.display='flex';
}
function stopRec(ok){rsend=!!ok;clearInterval(rTimer);$('rec').style.display='none';if(mr&&mr.state!=='inactive')mr.stop()}
async function finishRec(){
 rstream.getTracks().forEach(t=>t.stop());if(rctx)rctx.close();
 const dur=Math.max(1,Math.round((Date.now()-rT0)/1000));
 if(!rsend||!rchat)return;
 const n=Math.max(1,Math.floor(rsamp.length/28)),bars=[];
 for(let i=0;i<28;i++){const sl=rsamp.slice(i*n,(i+1)*n),a=sl.length?Math.max(...sl):0;bars.push(Math.round(15+Math.min(1,a*2.5)*85))}
 const type=(rmime||'audio/webm').split(';')[0],ext=type.includes('mp4')?'m4a':'webm';
 try{
  const u=await xUpload(new File([new Blob(rchunks,{type})],'voice-note.'+ext,{type}));
  xSend({chat_id:rchat,kind:'voice',media_url:u.url,media_meta:{duration:dur,waveform:bars}});
 }catch(e){toast(e.message)}
}
let au=null,auBtn=null,VSPD=1;
function vspd(){VSPD=VSPD===1?1.5:VSPD===1.5?2:1;document.querySelectorAll('.vsp').forEach(b=>b.textContent=VSPD+'×');if(au)au.playbackRate=VSPD}
function play(i,b){
 const x=cur.msgs[i];
 if(au&&auBtn===b){au.paused?au.play():au.pause();return}
 if(au){au.pause();auBtn.innerHTML=I('play','ic-s')}
 const u=xU(x.url);if(!u)return;
 const bars=[...b.nextElementSibling.children];au=new Audio(u);au.playbackRate=VSPD;auBtn=b;
 au.onplay=()=>{b.innerHTML=I('pause','ic-s')};au.onpause=()=>{b.innerHTML=I('play','ic-s')};
 au.ontimeupdate=()=>{const p=au.duration?au.currentTime/au.duration:0;bars.forEach((e,k)=>e.style.opacity=k/bars.length<p?1:.4)};
 au.onended=()=>{b.innerHTML=I('play','ic-s');bars.forEach(e=>e.style.opacity=.4);au=null;auBtn=null};
 au.play().catch(()=>{});
}

/* ---------- location + contact ---------- */
function sendLocation(){
 hidePanels();const cid=cur.id,name=cur.n;
 if(!navigator.geolocation)return toast('Location is not available on this device');
 toast('Getting your location…');
 navigator.geolocation.getCurrentPosition(p=>{
  if(confirm(`Send your current location to ${name}?`))xSend({chat_id:cid,kind:'location',media_meta:{lat:p.coords.latitude,lng:p.coords.longitude,label:'Shared location'}});
 },err=>toast(err.code===1?'Allow location access to share it':'Could not get your location'),{enableHighAccuracy:true,timeout:15000});
}
let XCT=[];
async function shareContact(){
 hidePanels();try{XCT=await api('/contacts')}catch(e){XCT=[]}
 xOv('Share a contact',XCT.length?XCT.map((c,i)=>`<div class="row flex items-center gap-3 px-4 py-2.5 cursor-pointer" data-i="${i}" onclick="pickContact(this.dataset.i)">${avatar(c,'w-11 h-11')}<div class="min-w-0"><div class="font-medium truncate">${esc(c.name)}</div><div class="text-xs mut">${esc(c.phone)}</div></div></div>`).join(''):'<p class="text-center mut text-sm mt-10 px-6">No contacts yet.</p>');
}
function pickContact(i){const c=XCT[i];if(!c||!cur)return;xSend({chat_id:cur.id,kind:'contact',media_meta:{name:c.name,phone:c.phone}});xOvClose()}
async function chatWithPhone(phone){try{const r=await api('/chats',{method:'POST',body:{phone}});await refreshChats();openChat(r.id)}catch(e){toast(e.message)}}

/* ---------- polls ---------- */
function pollHtml(m,i){
 const q=m.meta||{},opts=Array.isArray(q.options)?q.options:[],pd=POLLS[m.id]||{counts:[],mine:[],voters:0};
 return `<div class="pollc"><div class="font-semibold text-sm mb-0.5 flex items-start gap-1">${I('poll','ic-s mt-0.5')}<span>${esc(q.question||'Poll')}</span></div><div class="text-xs mut mb-1.5">${q.multi?'Select one or more':'Select one'}</div>`+
 opts.map((o,k)=>{const n=pd.counts[k]||0,pct=pd.voters?Math.round(n*100/pd.voters):0,mine=pd.mine.includes(k);
  return `<button type="button" class="pollopt ${mine?'on':''}" onclick="event.stopPropagation();votePoll(${i},${k})"><span class="pollbar" style="width:${pct}%"></span><span class="pollck">${mine?I('check','ic-xs'):''}</span><span class="flex-1">${esc(o)}</span><span class="text-xs mut">${n}</span></button>`}).join('')+
 `<div class="text-xs mut mt-1">${pd.voters||0} vote${pd.voters===1?'':'s'}</div></div>`;
}
async function loadPolls(c,only){
 const ids=(only||c.msgs.filter(m=>m.kind==='poll').map(m=>m.id)).filter(id=>!String(id).startsWith('tmp'));
 if(!ids.length)return;
 try{Object.assign(POLLS,await api('/extras/polls?ids='+ids.join(',')));if(cur===c)renderMsgs()}catch(e){}
}
async function votePoll(i,k){
 const m=cur.msgs[i];if(!m||m.tmp)return;
 const pd=POLLS[m.id]||(POLLS[m.id]={counts:(m.meta.options||[]).map(()=>0),mine:[],voters:0});
 let mine=pd.mine.slice();
 if(m.meta.multi)mine=mine.includes(k)?mine.filter(x=>x!==k):[...mine,k];else mine=mine.includes(k)?[]:[k];
 pd.mine.forEach(x=>{pd.counts[x]=(pd.counts[x]||1)-1});mine.forEach(x=>{pd.counts[x]=(pd.counts[x]||0)+1});
 pd.voters+=(mine.length?1:0)-(pd.mine.length?1:0);pd.mine=mine;renderMsgs();
 try{await api('/extras/poll/'+m.id,{method:'PUT',body:{options:mine}})}catch(e){toast(e.message);loadPolls(cur,[m.id])}
}
function pollCreate(){
 hidePanels();
 xOv('New poll',`<div class="p-4 flex flex-col gap-3"><input id="plQ" maxlength="200" placeholder="Ask a question" class="border-b bd pb-2 text-base" autocomplete="off"><div id="plOpts" class="flex flex-col gap-2"></div><button type="button" onclick="plAdd()" class="text-sm acc text-left">+ Add option</button><label class="flex items-center gap-2 text-sm"><input type="checkbox" id="plMulti"> Allow multiple answers</label></div>`,
  '<button onclick="plSend()" class="w-full accbg text-white rounded-xl py-2.5 text-sm font-medium">Send poll</button>');
 plAdd();plAdd();$('plQ').focus();
}
function plAdd(){const box=$('plOpts');if(!box||box.children.length>=8)return;box.insertAdjacentHTML('beforeend',`<input maxlength="100" placeholder="Option ${box.children.length+1}" class="border bd rounded-lg px-3 py-2 text-sm" autocomplete="off">`)}
function plSend(){
 const q=$('plQ').value.trim(),opts=[...new Set([...$('plOpts').children].map(i=>i.value.trim()).filter(Boolean))];
 if(!q)return toast('Ask a question first');
 if(opts.length<2)return toast('Add at least two different options');
 xSend({chat_id:cur.id,kind:'poll',media_meta:{question:q,options:opts,multi:$('plMulti').checked}});xOvClose();
}

/* ---------- forward ---------- */
function fwdPayload(m){
 return {kind:m.kind,body:['text','image','video','file'].includes(m.kind)?m.body:'',media_url:m.url||undefined,media_meta:Object.assign({},m.kind==='text'?{}:(m.meta||{}),{fwd:true})};
}
function forwardMsg(i){forwardPicker(fwdPayload(cur.msgs[i]))}
function forwardPicker(payload){
 XFW={payload:Array.isArray(payload)?payload:[payload],sel:new Set()};
 xOv('Forward to…',`<div class="p-3"><div class="flex items-center gap-2 rounded-xl px-3 h-10" style="background:var(--bg)">${I('search','ic-s mut')}<input id="xfq" oninput="fwList()" placeholder="Search chats" class="flex-1 text-sm" autocomplete="off"></div></div><div id="xfl"></div>`,
  '<button id="xfSend" onclick="fwSend()" class="w-full accbg text-white rounded-xl py-2.5 text-sm font-medium opacity-50">Send</button>');
 fwList();
}
function fwList(){
 if(!XFW)return;const qv=($('xfq').value||'').toLowerCase();
 $('xfl').innerHTML=chats.filter(c=>c.n.toLowerCase().includes(qv)&&!c.blockedByMe&&!isLocked(c)).map(c=>`<div class="row flex items-center gap-3 px-4 py-2.5 cursor-pointer" data-id="${esc(c.id)}" onclick="fwTog(this.dataset.id)">${avatar(c,'w-11 h-11')}<div class="flex-1 min-w-0 font-medium truncate">${esc(c.n)}</div><span class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${XFW.sel.has(c.id)?'accbg text-white border-transparent':'bd'}">${XFW.sel.has(c.id)?I('check','ic-xs'):''}</span></div>`).join('')||'<p class="text-center mut text-sm mt-8">No chats</p>';
 const b=$('xfSend');b.textContent=XFW.sel.size?`Send to ${XFW.sel.size}`:'Send';b.style.opacity=XFW.sel.size?1:.5;
}
function fwTog(id){XFW.sel.has(id)?XFW.sel.delete(id):XFW.sel.add(id);fwList()}
function fwSend(){if(!XFW||!XFW.sel.size)return;XFW.sel.forEach(id=>XFW.payload.forEach(p=>xSend(Object.assign({chat_id:id},p))));toast('Forwarded');xOvClose()}

/* ---------- media, docs and links gallery + search inside a chat ---------- */
let GAL={tab:'media'};
async function openGallery(tab){
 if(!cur)return;GAL.tab=tab||'media';
 xOv('Media, links and docs','<p class="text-center mut text-sm mt-10">Loading…</p>');
 let n=0;while(cur.more&&n++<5)await loadOlder();
 drawGallery();
}
function drawGallery(){
 const ms=cur.msgs,tabs=[['media','Media'],['docs','Docs'],['links','Links']];
 let body='';
 if(GAL.tab==='media'){
  const l=ms.map((m,i)=>({m,i})).filter(x=>x.m.kind==='image'||x.m.kind==='video');
  body=l.length?`<div class="gal">${l.map(x=>x.m.kind==='image'?`<img src="${esc(xU(x.m.url))}" loading="lazy" alt="" onclick="xOvClose();openMediaViewer(${x.i})">`:`<video src="${esc(xU(x.m.url))}#t=0.1" preload="metadata" muted playsinline onclick="xOvClose();openMediaViewer(${x.i})"></video>`).join('')}</div>`:'<p class="text-center mut text-sm mt-10">No photos or videos yet</p>';
 }else if(GAL.tab==='docs'){
  const l=ms.filter(m=>m.kind==='file');
  body=l.length?l.map(m=>`<a href="${esc(xU(m.url))}" target="_blank" rel="noopener" class="row flex items-center gap-3 px-4 py-3"><div class="w-10 h-10 rounded-lg accbg text-white flex items-center justify-center flex-none">${I('file')}</div><div class="min-w-0"><div class="text-sm truncate">${esc(m.meta.name||'Document')}</div><div class="text-xs mut">${esc(m.meta.size||'')} · ${new Date(m.at).toLocaleDateString()}</div></div></a>`).join(''):'<p class="text-center mut text-sm mt-10">No documents yet</p>';
 }else{
  const links=[];ms.forEach(m=>{if(m.kind!=='text')return;(m.body.match(/https?:\/\/[^\s<]+/g)||[]).forEach(u=>links.push({u,at:m.at}))});
  body=links.length?links.reverse().map(x=>`<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer" class="row block px-4 py-3"><div class="text-sm acc break-all">${esc(x.u)}</div><div class="text-xs mut">${new Date(x.at).toLocaleDateString()}</div></a>`).join(''):'<p class="text-center mut text-sm mt-10">No links yet</p>';
 }
 $('xovB').innerHTML=`<div class="flex border-b bd sticky top-0 panel">${tabs.map(([k,t])=>`<button class="flex-1 py-2.5 text-sm font-medium border-b-2 ${GAL.tab===k?'acc':'mut border-transparent'}" style="${GAL.tab===k?'border-color:var(--accent)':''}" onclick="GAL.tab='${k}';drawGallery()">${t}</button>`).join('')}</div>${body}`;
}
function chatSearch(){
 xOv('Search in this chat',`<div class="p-3"><div class="flex items-center gap-2 rounded-xl px-3 h-10" style="background:var(--bg)">${I('search','ic-s mut')}<input id="csq" oninput="chatSearchRun()" placeholder="Search messages" class="flex-1 text-sm" autocomplete="off"></div></div><div id="csr"></div>`);
 $('csq').focus();
}
let _cs=null;
function chatSearchRun(){
 clearTimeout(_cs);const q=$('csq').value.trim();
 if(q.length<2){$('csr').innerHTML='';return}
 _cs=setTimeout(async()=>{
  try{
   const r=await api(`/extras/search?q=${encodeURIComponent(q)}&chat=${encodeURIComponent(cur.id)}`);
   $('csr').innerHTML=r.length?r.map(m=>`<div class="row px-4 py-2.5 cursor-pointer" data-c="${esc(m.chat_id)}" data-m="${esc(m.id)}" onclick="xJump(this.dataset.c,this.dataset.m)"><div class="text-xs acc">${esc(m.sender_name||'')} · ${new Date(m.created_at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}</div><div class="text-sm">${esc(m.body)}</div></div>`).join(''):'<p class="text-center mut text-sm mt-8">No messages found</p>';
  }catch(e){$('csr').textContent=e.message}
 },300);
}

/* ---------- message info (who has read / received) ---------- */
async function msgInfo(i){
 const m=cur&&cur.msgs[i];if(!m||!m.out)return;
 xOv('Message info','<p class="text-center mut text-sm mt-10">Loading…</p>');
 let members=[];
 if(cur.grp){try{members=await api('/chats/'+cur.id+'/members')}catch(e){members=[]}}
 else if(cur.peer)members=[{id:cur.peer,name:cur.n,phone:''}];
 const byId=Object.fromEntries(members.map(x=>[x.id,x]));
 const read=(m.rby||[]).filter(id=>id!==ME.id),deliv=(m.dby||[]).filter(id=>id!==ME.id&&!read.includes(id));
 const rows=(ids,label)=>ids.length?`<div class="px-4 pt-3 pb-1 text-xs font-semibold mut">${label} (${ids.length})</div>`+ids.map(id=>{const u=byId[id]||{name:'User',id};return `<div class="flex items-center gap-3 px-4 py-2.5"><div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-none" style="background:${col(id)}">${esc(ini(u.name))}</div><div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(u.name)}</div><div class="text-xs mut">${esc(u.phone||'')}</div></div></div>`}).join(''):'';
 $('xovB').innerHTML=`<div class="p-4 border-b bd"><div class="text-xs mut mb-1">Sent</div><div class="text-sm">${new Date(m.at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}</div>${m.edited?'<div class="text-xs mut mt-1">Edited</div>':''}</div>`+rows(read,'Read by')+rows(deliv,'Delivered to')+((!read.length&&!deliv.length)?'<p class="text-center mut text-sm mt-8 px-6">No delivery info yet.</p>':'');
}
