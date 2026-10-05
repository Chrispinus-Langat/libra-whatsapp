/* ===================== LIBRA social =====================
   contacts · groups · profiles · block/report · settings · app lock · status · calls · PWA/push · start-up */

/* ================= contacts picker ================= */
let CONTACTS=[],CP=null;
async function openPicker(mode,opts={}){
 CP={mode,sel:new Map(),step:1,exclude:new Set(opts.exclude||[]),chat:opts.chat||null};
 $('cpkQ').value='';$('cpk').style.display='flex';
 try{CONTACTS=await api('/contacts')}catch(e){CONTACTS=[]}
 renderPicker();
}
function cpkClose(){$('cpk').style.display='none';CP=null}
function cpkBack(){if(CP&&CP.step===2){CP.step=1;renderPicker()}else cpkClose()}
function renderPicker(){
 if(!CP)return;
 const {mode,sel,step}=CP,multi=mode!=='chat';
 $('cpkT').textContent=step===2?'New group':mode==='chat'?'New chat':mode==='group'?'New group':'Add members';
 $('cpkS').textContent=step===2?`${sel.size} member${sel.size===1?'':'s'}`:multi?(sel.size?`${sel.size} selected`:'Select contacts'):`${CONTACTS.length} contact${CONTACTS.length===1?'':'s'}`;
 $('cpkS1').style.display=step===1?'flex':'none';$('cpkS2').style.display=step===2?'block':'none';
 const go=$('cpkGo');go.style.display=multi&&sel.size?'flex':'none';go.innerHTML=I(mode==='group'&&step===1?'next':'check','ic-l');
 if(step===2){
  $('cpkMem').innerHTML=[...sel.values()].map(c=>`<div class="flex items-center gap-3 py-2">${avatar(c,'w-10 h-10')}<div class="min-w-0"><div class="text-sm font-medium truncate">${esc(c.name)}</div><div class="text-xs mut">${esc(c.phone)}</div></div></div>`).join('');
  return;
 }
 $('cpkChips').innerHTML=[...sel.values()].map(c=>`<button data-id="${esc(c.id)}" onclick="cpkTap(this.dataset.id)" class="flex items-center gap-2 rounded-full border bd pl-1 pr-3 py-1 text-xs flex-none">${avatar(c,'w-6 h-6')}${esc(c.name.split(' ')[0])}${I('x','ic-xs')}</button>`).join('');
 const raw=$('cpkQ').value.trim(),qv=raw.toLowerCase(),digits=raw.replace(/[\s-]/g,'');
 const l=CONTACTS.filter(c=>!qv||c.name.toLowerCase().includes(qv)||c.phone.includes(digits)).sort((a,b)=>a.name.localeCompare(b.name));
 const act=(ic,t,f)=>`<div class="row flex items-center gap-3 px-4 py-3 cursor-pointer" onclick="${f}"><div class="w-12 h-12 rounded-full accbg text-white flex items-center justify-center flex-none">${I(ic)}</div><div class="font-medium">${t}</div></div>`;
 let h='';
 if(!qv){
  if(mode==='chat'){h+=act('users','New group','cpkToGroup()');h+=act('bookmark','Saved messages (message yourself)','openSaved()')}
  if('contacts' in navigator&&'ContactsManager' in window)h+=act('contact','Import from phone contacts','cpkImport()');
 }
 if(/^\+?[\d\s-]{6,}$/.test(raw))h+=act('user-plus',`Find ${esc(raw)} on LIBRA`,'cpkNumber()');
 let letter='';
 l.forEach(c=>{
  const L=(c.name[0]||'#').toUpperCase();
  if(L!==letter){letter=L;h+=`<p class="px-4 pt-3 pb-1 text-xs font-semibold mut">${esc(L)}</p>`}
  const ex=CP.exclude.has(c.id),on=sel.has(c.id);
  h+=`<div data-id="${esc(c.id)}" onclick="cpkTap(this.dataset.id)" class="row flex items-center gap-3 px-4 py-2.5 ${ex?'opacity-50':'cursor-pointer'}">${avatar(c,'w-11 h-11')}<div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(c.name)}</div><div class="text-xs mut truncate">${ex?'Already in group':esc(c.about||c.phone)}</div></div>${multi&&!ex?`<div class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-none ${on?'accbg text-white border-transparent':'bd'}">${on?I('check','ic-xs'):''}</div>`:''}</div>`;
 });
 if(!l.length&&!/^\+?[\d\s-]{6,}$/.test(raw))h+=`<p class="text-center mut text-sm px-8 mt-8">${qv?'No contacts match.':'No contacts yet.'} Type a full phone number above to find someone on LIBRA.</p>`;
 h+=act(navigator.share?'share':'copy',navigator.share?'Invite friends to LIBRA':'Copy invite link','cpkInvite()');
 const st=$('cpkList').scrollTop;$('cpkList').innerHTML=h;$('cpkList').scrollTop=st;
}
function cpkToGroup(){CP.mode='group';renderPicker()}
function cpkTap(id){
 if(!CP||CP.exclude.has(id))return;
 const c=CONTACTS.find(x=>x.id===id);if(!c)return;
 if(CP.mode==='chat')return startChatWith(c);
 CP.sel.has(id)?CP.sel.delete(id):CP.sel.set(id,c);renderPicker();
}
async function startChatWith(c){try{const r=await api('/chats',{method:'POST',body:{phone:c.phone}});cpkClose();await refreshChats();openChat(r.id)}catch(e){toast(e.message)}}
async function openSaved(){try{const r=await api('/extras/saved',{method:'POST'});cpkClose();await refreshChats();openChat(r.id)}catch(e){toast(e.message)}}
function mergeContacts(list){list.forEach(u=>{if(!CONTACTS.some(c=>c.id===u.id))CONTACTS.push(u)})}
async function cpkImport(){
 if(!navigator.contacts||!navigator.contacts.select){toast('Your browser does not support importing contacts');return}
 try{
  const picked=await navigator.contacts.select(['name','tel'],{multiple:true});
  const phones=picked.flatMap(c=>c.tel||[]);if(!phones.length)return;
  const found=await api('/contacts/match',{method:'POST',body:{phones}});
  mergeContacts(found);renderPicker();
  toast(found.length?`${found.length} of your contacts ${found.length===1?'is':'are'} on LIBRA`:'None of those contacts are on LIBRA yet');
 }catch(e){if(e&&e.name!=='AbortError')toast('Could not read your contacts')}
}
async function cpkNumber(){
 try{
  const found=await api('/contacts/match',{method:'POST',body:{phones:[$('cpkQ').value]}});
  if(!found.length)return toast('That number is not on LIBRA yet');
  mergeContacts(found);$('cpkQ').value='';
  if(CP.mode==='chat')return startChatWith(found[0]);
  if(!CP.exclude.has(found[0].id))CP.sel.set(found[0].id,found[0]);renderPicker();
 }catch(e){toast(e.message)}
}
function cpkInvite(){
 const url=location.origin,text='Join me on LIBRA - balanced, private messaging.';
 if(navigator.share)navigator.share({title:'LIBRA',text,url}).catch(()=>{});
 else{try{navigator.clipboard.writeText(url);toast('Invite link copied')}catch(e){prompt('Copy this link',url)}}
}
async function cpkNext(){
 if(!CP||!CP.sel.size)return;
 const phones=[...CP.sel.values()].map(c=>c.phone);
 if(CP.mode==='group'&&CP.step===1){CP.step=2;renderPicker();$('cpkName').focus();return}
 try{
  if(CP.mode==='group'){
   const name=$('cpkName').value.trim();if(!name)return toast('Give the group a name');
   const g=await api('/groups',{method:'POST',body:{name,phones}});cpkClose();await refreshChats();openChat(g.id);
  }else{await api(`/chats/${CP.chat}/members`,{method:'POST',body:{phones}});cpkClose();openGroupInfo()}
 }catch(e){toast(e.message)}
}
function fab(){if(S.sec==='status')return openCompose();openPicker('chat')}
function newChat(){openPicker('chat')}

/* ================= groups ================= */
async function openGroupInfo(){
 if(!cur||!cur.grp)return;
 const c=cur;$('pnT').textContent=c.n;$('pn').style.display='flex';$('pnB').innerHTML='<p class="mut text-sm">Loading…</p>';
 try{
  const ms=await api(`/chats/${c.id}/members`),admin=ms.some(m=>m.id===ME.id&&m.role==='admin');
  window._gm=ms.map(m=>m.id);c.members=ms;
  const link=(ic,t,f)=>`<div class="row flex items-center gap-3 py-2 px-2 rounded-xl cursor-pointer" onclick="${f}"><div class="w-10 h-10 rounded-full accbg text-white flex items-center justify-center flex-none">${I(ic)}</div><div class="text-sm font-medium">${t}</div></div>`;
  $('pnB').innerHTML=`<div class="flex items-center gap-3 mb-4">${avatar(c,'w-16 h-16')}${admin?`<button onclick="$('fGAv').click()" class="xbtn">Change group photo</button>`:''}</div>`+
  link('image','Media, links and docs',"$('pn').style.display='none';openGallery()")+link('search','Search in chat',"$('pn').style.display='none';chatSearch()")+
  `<p class="text-xs mut mt-3 mb-2">${ms.length} members</p>`+(admin?link('user-plus','Add members','addMemberPicker()'):'')+
  ms.map(m=>`<div class="flex items-center gap-3 py-2 px-2">${avatar({id:m.id,n:m.name,avatar_url:m.avatar_url},'w-10 h-10')}<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${esc(m.name)}${m.id===ME.id?' (You)':''}</div><div class="text-xs mut truncate">${esc(m.phone)}</div></div>${m.role==='admin'?'<span class="text-xs acc">Admin</span>':''}${admin&&m.id!==ME.id?`<button data-id="${esc(m.id)}" onclick="rmMember(this.dataset.id)" class="text-xs text-red-500 ml-2">Remove</button>`:''}</div>`).join('')+
  (admin?`<div class="mt-4 flex gap-2"><input id="gmNm" value="${esc(c.n)}" class="flex-1 min-w-0 border bd rounded-lg px-3 py-2 text-sm"><button onclick="renameGroup()" class="px-3 rounded-lg border bd text-sm">Rename</button></div>`:'')+
  `<button onclick="leaveGroup()" class="mt-6 w-full border bd rounded-xl py-2.5 text-sm text-red-500 flex items-center justify-center gap-2">${I('logout','ic-s')} Leave group</button>`;
 }catch(e){$('pnB').textContent=e.message}
}
function addMemberPicker(){$('pn').style.display='none';openPicker('add',{chat:cur.id,exclude:window._gm||[]})}
async function rmMember(id){if(!confirm('Remove this member?'))return;try{await api(`/chats/${cur.id}/members/${id}`,{method:'DELETE'});openGroupInfo()}catch(e){toast(e.message)}}
async function renameGroup(){const n=$('gmNm').value.trim();if(!n)return;try{await api(`/chats/${cur.id}/group`,{method:'PATCH',body:{name:n}});toast('Group renamed')}catch(e){toast(e.message)}}
async function leaveGroup(){if(!confirm('Leave this group?'))return;try{await api(`/chats/${cur.id}/members/${ME.id}`,{method:'DELETE'});$('pn').style.display='none'}catch(e){toast(e.message)}}
async function cropSquare(file,size){
 const bmp=await createImageBitmap(file),s=Math.min(bmp.width,bmp.height),c=document.createElement('canvas');c.width=c.height=size;
 c.getContext('2d').drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,size,size);
 return new Promise(r=>c.toBlob(r,'image/jpeg',.88));
}
async function setGroupPhoto(el){
 const f=el.files[0];el.value='';if(!f||!cur)return;
 try{const u=await xUpload(new File([await cropSquare(f,256)],'group.jpg',{type:'image/jpeg'}));await api('/extras/group/'+cur.id,{method:'PATCH',body:{avatar_url:u.url}});toast('Group photo updated')}catch(e){toast(e.message)}
}
function wireGroups(){
 sock.on('chat:new',()=>refreshChats().catch(console.error));
 sock.on('group:updated',({chat_id})=>{const c=chats.find(x=>x.id===chat_id);if(c)c.members=null;refreshChats().catch(console.error);if($('pn').style.display!=='none'&&cur&&cur.grp&&$('gmNm'))openGroupInfo()});
 sock.on('chat:removed',({chat_id})=>{chats=chats.filter(c=>c.id!==chat_id);if(cur&&cur.id===chat_id)back();renderList()});
}

/* ================= profiles ================= */
const xWeb=u=>{let s=String(u||'').trim();if(!s)return '';if(!/^https?:\/\//i.test(s))s='https://'+s;try{const x=new URL(s);return /^https?:$/.test(x.protocol)?x.href:''}catch(e){return ''}};
const xMail=e=>/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e||'')?e:'';
function bizHtml(u){
 const rows=[];
 if(u.biz_name)rows.push(`<div class="font-semibold text-sm">${esc(u.biz_name)}${u.biz_cat?` <span class="mut font-normal">· ${esc(u.biz_cat)}</span>`:''}</div>`);
 if(u.biz_desc)rows.push(`<div>${esc(u.biz_desc)}</div>`);
 const w=xWeb(u.biz_url);if(w)rows.push(`<a href="${esc(w)}" target="_blank" rel="noopener noreferrer" class="acc underline break-all">${esc(u.biz_url)}</a>`);
 const m=xMail(u.biz_email);if(m)rows.push(`<a href="mailto:${esc(m)}" class="acc underline break-all">${esc(m)}</a>`);
 if(u.biz_addr)rows.push(`<div class="flex items-start gap-1">${I('map-pin','ic-xs mt-0.5')}<span>${esc(u.biz_addr)}</span></div>`);
 if(u.biz_hours)rows.push(`<div class="flex items-start gap-1">${I('clock','ic-xs mt-0.5')}<span>${esc(u.biz_hours)}</span></div>`);
 return rows.length?`<div class="text-left border bd rounded-xl p-3 mt-3 text-xs flex flex-col gap-1.5"><div class="font-semibold mut uppercase tracking-wider" style="font-size:10px">Business info</div>${rows.join('')}</div>`:'';
}
function paintProfile(u,isMe){
 $('profT').textContent=isMe?'My profile':'Profile';
 const av=$('profAv');
 if(xU(u.avatar_url)){av.style.background=`url(${xU(u.avatar_url)}) center/cover`;av.textContent=''}else{av.style.background=col(u.id);av.textContent=ini(u.name)}
 $('profName').textContent=u.name||'';$('profAbout').textContent=u.about||'';$('profPhone').textContent=u.phone||'';
 $('profBiz').innerHTML=bizHtml(u);
 const pc=isMe?null:chats.find(c=>c.peer===u.id),btn=(ic,t,f,cls='')=>`<button onclick="${f}" class="w-full border bd rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 ${cls}">${I(ic,'ic-s')} ${t}</button>`;
 $('profActions').innerHTML=isMe
  ?btn('camera',xU(u.avatar_url)?'Change photo':'Add photo',"$('fAv').click()")+(xU(u.avatar_url)?btn('trash','Remove photo','removeAvatar()','text-red-500'):'')+btn('pencil','Edit profile and business info',"closeProfile();openSet(true)")
  :`<button onclick="closeProfile();startChatWithId('${esc(u.id)}')" class="w-full accbg text-white rounded-xl py-2.5 text-sm">Message</button>`+
   (pc?btn('image','Media, links and docs',`closeProfile();openChat('${esc(pc.id)}').then(()=>openGallery())`):'')+
   btn('ban','Block',`blockPeer('${esc(u.id)}')`)+btn('flag','Report',`closeProfile();report('${esc(u.id)}',${pc?`'${esc(pc.id)}'`:'null'},null)`,'text-red-500');
}
async function openProfile(who){
 if(!ME){toast('Please log in');return}
 const isMe=who==='me';let u;
 if(isMe)u={id:ME.id,name:ME.name,about:ME.about,phone:ME.phone,avatar_url:ME.avatar_url,biz_name:P.bizName,biz_cat:P.bizCat,biz_desc:P.bizDesc,biz_url:P.bizUrl,biz_email:P.bizEmail,biz_addr:P.bizAddr,biz_hours:P.bizHours};
 else{const p=chats.find(c=>c.peer===who)||CONTACTS.find(c=>c.id===who)||{};u={id:who,name:p.n||p.name||'User',about:p.about||'',phone:p.phone||'',avatar_url:p.avatar||p.avatar_url}}
 paintProfile(u,isMe);$('prof').style.display='flex';
 if(!isMe){try{const d=await api('/extras/user/'+who);if($('prof').style.display!=='none')paintProfile(Object.assign(u,d),false)}catch(e){}}
}
function closeProfile(){$('prof').style.display='none'}
function openPeerProfile(){if(!cur)return;if(cur.grp)return openGroupInfo();if(cur.saved||!cur.peer)return;openProfile(cur.peer)}
async function startChatWithId(id){
 const c=chats.find(x=>x.peer===id);if(c)return openChat(c.id);
 const ct=CONTACTS.find(x=>x.id===id);if(ct)return startChatWith(ct);toast('Contact not found');
}
async function uploadAvatar(el){
 const f=el.files[0];el.value='';if(!f)return;
 try{const u=await xUpload(new File([await cropSquare(f,320)],'avatar.jpg',{type:'image/jpeg'}));await api('/me',{method:'PATCH',body:{avatar_url:u.url}});ME.avatar_url=u.url;prUpd();toast('Photo updated');openProfile('me')}catch(e){toast(e.message)}
}
async function removeAvatar(){
 if(!confirm('Remove your profile photo?'))return;
 try{await api('/me',{method:'PATCH',body:{avatar_url:null}});ME.avatar_url=null;prUpd();toast('Photo removed');openProfile('me')}catch(e){toast(e.message)}
}

/* ================= chat menu, mute, archive, lock, block, report ================= */
function chatMenu(e){
 e.stopPropagation();const direct=!cur.grp&&cur.peer&&!cur.saved;
 showCtx([['search','Search in chat','chatSearch()'],['image','Media, links and docs','openGallery()'],['check','Select messages','selMode()'],
  ['pin',cur.pin?'Unpin chat':'Pin chat','togglePin()'],[cur.muted?'bell':'bell-off',cur.muted?'Unmute notifications':'Mute notifications','toggleMute()'],
  ['archive',cur.archived?'Unarchive chat':'Archive chat','toggleArchive()'],['lock',isLocked(cur)?'Unlock chat':'Lock chat','toggleLockChat()'],['folder','Move to folder','moveFolder()'],
  ...(cur.grp?[['users','Group info','openGroupInfo()'],['logout','Leave group','leaveGroup()',true]]:[]),
  ...(direct?[['ban',cur.blockedByMe?'Unblock':'Block',cur.blockedByMe?'unblockCur()':'blockCur()',!cur.blockedByMe],['flag','Report','report(cur.peer,cur.id,null)',true]]:[]),
  ['eraser','Clear chat','clearChat()',true]],innerWidth,60);
}
function selMode(){SEL.on=true;SEL.set=new Set();selUI();renderMsgs()}
function togglePin(){cur.pin=!cur.pin;api('/chats/'+cur.id,{method:'PATCH',body:{pinned:cur.pin}}).catch(console.error);renderList()}
function toggleMute(){cur.muted=!cur.muted;api('/chats/'+cur.id,{method:'PATCH',body:{muted:cur.muted}}).catch(console.error);renderList();toast(cur.muted?'Notifications muted':'Notifications on')}
function toggleArchive(){
 cur.archived=!cur.archived;api('/extras/chat/'+cur.id,{method:'PATCH',body:{archived:cur.archived}}).catch(console.error);
 toast(cur.archived?'Chat archived':'Chat unarchived');renderTabs();renderList();if(cur.archived)back();
}
const saveLocked=()=>ls('libra_locked',JSON.stringify([...LOCKED]));
function toggleLockChat(){
 const c=cur;if(!c)return;
 if(isLocked(c)){LOCKED.delete(c.id);saveLocked();toast('Chat unlocked');renderTabs();renderList();return}
 const doLock=()=>{LOCKED.add(c.id);saveLocked();UNLOCK_UNTIL=Date.now()+5*60e3;toast('Chat locked. Find it under the Locked tab.');if(cur===c)closeChat();renderTabs();renderList()};
 if(!pinHash){toast('Create a PIN to lock chats');S.appLock=true;openLock('set',doLock)}else doLock();
}
function clearChat(){if(!confirm('Clear all messages in this chat for you?'))return;api(`/chats/${cur.id}/clear`,{method:'POST'}).catch(console.error);cur.msgs=[];cur.last=null;cur.loaded=true;renderMsgs();renderList()}
function moveFolder(){
 const n=prompt('Folder for this chat ('+folders.join(', ')+'). Leave blank to remove.');if(n===null)return;
 const f=n.trim();cur.f=f||undefined;if(f&&!folders.includes(f))folders.push(f);
 api('/chats/'+cur.id,{method:'PATCH',body:{folder:f}}).catch(console.error);renderTabs();renderList();
}
function addFolder(){const n=(prompt('New folder name')||'').trim();if(!n||folders.includes(n))return;folders.push(n);S.tab=n;renderTabs();renderList()}
async function blockCur(){
 if(!confirm(`Block ${cur.n}? They won't be able to send you messages.`))return;
 try{await api('/extras/block/'+cur.peer,{method:'PUT'});cur.blockedByMe=true;composerState();renderList();toast('Contact blocked')}catch(e){toast(e.message)}
}
async function unblockCur(){if(cur&&cur.peer)await unblockId(cur.peer)}
async function unblockId(id){
 try{await api('/extras/block/'+id,{method:'DELETE'});await loadMeta();if(cur)composerState();renderList();toast('Unblocked');if($('xov').style.display!=='none')blockedList()}catch(e){toast(e.message)}
}
async function blockPeer(id){
 if(!confirm("Block this contact? They won't be able to send you messages."))return;
 try{await api('/extras/block/'+id,{method:'PUT'});await loadMeta();if(cur)composerState();renderList();closeProfile();toast('Contact blocked')}catch(e){toast(e.message)}
}
async function blockedList(){
 await loadMeta();
 xOv('Blocked contacts',XM.blocked.length?XM.blocked.map(b=>`<div class="flex items-center gap-3 px-4 py-3"><div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(b.name)}</div><div class="text-xs mut">${esc(b.phone)}</div></div><button data-id="${esc(b.id)}" onclick="unblockId(this.dataset.id)" class="xbtn">Unblock</button></div>`).join(''):'<p class="text-center mut text-sm mt-10">You have not blocked anyone.</p>');
}
let XRP=null;
function reportMsg(i){const m=cur.msgs[i];report(m.sid,cur.id,m.id)}
function report(userId,chatId,msgId){
 if(!userId)return;XRP={userId,chatId,msgId};
 xOv('Report',`<div class="p-4"><p class="text-sm mut mb-3">Reports are reviewed by the LIBRA team. The other person is not told.</p>${['Spam','Harassment or bullying','Scam or fraud','Inappropriate content','Other'].map((r,i)=>`<label class="flex items-center gap-3 py-2 text-sm"><input type="radio" name="xrr" value="${esc(r)}" ${i===0?'checked':''}> ${r}</label>`).join('')}<textarea id="xrd" rows="3" maxlength="500" placeholder="Details (optional)" class="w-full border bd rounded-lg px-3 py-2 text-sm mt-3"></textarea><label class="flex items-center gap-3 py-2 text-sm mt-1"><input type="checkbox" id="xrb"> Also block this contact</label></div>`,
  '<button onclick="reportSend()" class="w-full accbg text-white rounded-xl py-2.5 text-sm font-medium">Send report</button>');
}
async function reportSend(){
 const r=document.querySelector('input[name=xrr]:checked');if(!r||!XRP)return;
 try{
  await api('/extras/report',{method:'POST',body:{user_id:XRP.userId,chat_id:XRP.chatId,message_id:XRP.msgId,reason:r.value,details:$('xrd').value}});
  if($('xrb').checked)await api('/extras/block/'+XRP.userId,{method:'PUT'}).catch(()=>{});
  xOvClose();await loadMeta();if(cur)composerState();renderList();toast('Report sent. Thank you.');
 }catch(e){toast(e.message)}
}
async function deleteAccount(){
 if(!confirm('Delete your LIBRA account? Your profile, statuses and group memberships are removed. This cannot be undone.'))return;
 if((prompt('Type DELETE to confirm')||'').trim()!=='DELETE')return toast('Account not deleted');
 try{await api('/extras/me',{method:'DELETE',body:{confirm:'DELETE'}});ls('libra_token',null);location.reload()}catch(e){toast(e.message)}
}

/* ================= starred / scheduled ================= */
async function openPn(k){
 const b=$('pnB');$('pn').style.display='flex';b.innerHTML='<p class="mut text-sm">Loading…</p>';
 try{
  if(k==='starred'){
   $('pnT').textContent='Starred messages';const r=await api('/starred');
   b.innerHTML=r.map(m=>`<div class="row p-3 rounded-xl cursor-pointer" onclick="$('pn').style.display='none';openChat('${m.chat_id}')"><div class="text-xs acc mb-1">${esc(m.chat_name||'Chat')} · ${esc(m.sender_name||'')} · ${tm(m.created_at)}</div><div class="text-sm">${esc(m.kind==='text'?m.body:KL[m.kind]||m.body)}</div></div>`).join('')||'<p class="mut text-sm">No starred messages. Tap a message and choose Star.</p>';
  }else{
   $('pnT').textContent='Scheduled messages';const r=await api('/scheduled');
   b.innerHTML=r.map(x=>{const c=chats.find(k=>k.id===x.chat_id);return `<div class="p-3 rounded-xl border bd mb-2"><div class="text-xs acc mb-1">To ${esc(c?c.n:'chat')} · ${new Date(x.scheduled_at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}</div><div class="text-sm mb-2">${esc(x.body)}</div><button onclick="cancelSch('${x.id}')" class="text-xs text-red-500">Cancel</button></div>`}).join('')||'<p class="mut text-sm">Nothing scheduled. Type a message, tap the paperclip, then Schedule message.</p>';
  }
 }catch(e){b.textContent=e.message}
}
function openSch(){
 hidePanels();if(!cur)return;
 const t=$('inp').value.trim();if(!t){toast('Type the message to schedule first');$('inp').focus();return}
 $('schM').textContent='“'+t+'”';
 const d=new Date(Date.now()+120000-new Date().getTimezoneOffset()*60000);$('schT').value=d.toISOString().slice(0,16);
 $('sch').style.display='flex';
}
async function saveSch(){
 const at=new Date($('schT').value).getTime();if(!at||at<Date.now()){toast('Pick a time in the future');return}
 try{await api(`/chats/${cur.id}/messages`,{method:'POST',body:{body:$('inp').value.trim(),scheduled_at:new Date(at).toISOString()}});$('inp').value='';upd();$('sch').style.display='none';toast('Message scheduled')}catch(e){toast(e.message)}
}
async function cancelSch(id){await api('/scheduled/'+id,{method:'DELETE'}).catch(()=>{});openPn('sched')}

/* ================= settings ================= */
function toggleTheme(){const d=document.documentElement,dk=d.dataset.theme==='dark'||(!d.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);d.dataset.theme=dk?'light':'dark'}
function accent(c){document.documentElement.style.setProperty('--accent',c);const m=document.querySelector('meta[name=theme-color]');if(m)m.content=c;renderSet()}
function openSet(o){$('set').classList.toggle('hidden',!o);if(o)renderSet()}
function prUpd(){
 const a=$('prAv');if(!a)return;
 if(ME&&xU(ME.avatar_url)){a.style.background=`url(${xU(ME.avatar_url)}) center/cover`;a.textContent=''}
 else{a.style.background='var(--accent)';a.textContent=ini(P.name||'Me')}
}
const TOG=[['ghost','Ghost mode','Hide online, typing and read status'],['noBlue','Hide read receipts','Others won\'t see blue ticks'],['noType','Hide typing','Don\'t show "typing…"'],['noOnline','Hide online status','Appear offline'],['appLock','App lock','Require a PIN when you come back'],['push','Notifications','Message alerts on this device']];
function setWp(k){CFG.wp=k;saveCfg();renderSet()}
function setFs(v){CFG.fs=+v;saveCfg();$('fsV').textContent=CFG.fs+'px';if(cur)renderMsgs()}
function cfgTog(k){CFG[k]=!CFG[k];saveCfg();renderSet();if(k==='sound'&&CFG.sound)beep()}
function renderSet(){
 $('prN').value=P.name;$('prA').value=P.about;$('prP').textContent=P.phone||'';
 $('prBizName').value=P.bizName||'';$('prBizCat').value=P.bizCat||'';$('prBizDesc').value=P.bizDesc||'';
 $('prBizUrl').value=P.bizUrl||'';$('prBizEmail').value=P.bizEmail||'';$('prBizAddr').value=P.bizAddr||'';$('prBizHours').value=P.bizHours||'';
 prUpd();
 const a=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
 $('sws').innerHTML=COLORS.map(c=>`<div class="sw ${c===a?'on':''}" style="background:${c}" onclick="accent('${c}')"></div>`).join('');
 $('wps').innerHTML=Object.entries(WP).map(([k,w])=>`<div class="wps ${CFG.wp===k?'on':''}" title="${w.n}" style="background:${w.bg||'var(--wall)'}" onclick="setWp('${k}')"></div>`).join('');
 $('fsR').value=CFG.fs;$('fsV').textContent=CFG.fs+'px';
 const row=(on,t,d,f)=>`<div class="flex items-center gap-3"><div class="flex-1"><div class="text-sm font-medium">${t}</div><div class="text-xs mut">${d}</div></div><div class="tog ${on?'on':''}" onclick="${f}"></div></div>`;
 $('cfgs').innerHTML=row(CFG.sound,'Sounds','Play a tone for new messages',"cfgTog('sound')")+(COARSE?'':row(CFG.enter,'Enter key sends','Off: Ctrl+Enter sends',"cfgTog('enter')"));
 $('tgs').innerHTML=TOG.map(([k,t,d])=>row(S[k],t,d,`tog('${k}')`)).join('');
 $('setExtra').innerHTML=`<button onclick="blockedList()" class="mb-3 w-full border bd rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">${I('ban','ic-s')} Blocked contacts</button>`+(XM.admin?`<a href="/admin.html" target="_blank" class="mb-3 w-full border bd rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">${I('flag','ic-s')} Admin: reports</a>`:'');
 $('instBtn').style.display=(!STANDALONE&&(DIP||IOS))?'flex':'none';
}
function adminLink(){if(!$('set').classList.contains('hidden'))renderSet()}
function tog(k){
 if(k==='push'){S.push?pushDisable():pushEnable();return}
 if(k==='ghost'){const v=!S.ghost;S.ghost=S.noBlue=S.noType=S.noOnline=v}
 else if(k==='appLock'){S.appLock=!S.appLock;if(S.appLock)openLock('set');else{pinHash=null;ls('libra_pin',null)}}
 else{S[k]=!S[k];S.ghost=S.noBlue&&S.noType&&S.noOnline}
 syncPriv();renderSet();
}
let _pt=null;
function saveProfile(){
 clearTimeout(_pt);
 _pt=setTimeout(()=>{
  api('/me',{method:'PATCH',body:{name:P.name,about:P.about,biz_name:P.bizName,biz_cat:P.bizCat,biz_desc:P.bizDesc,biz_url:P.bizUrl,biz_email:P.bizEmail,biz_addr:P.bizAddr,biz_hours:P.bizHours}}).catch(()=>{});
  if(ME){ME.name=P.name;ME.about=P.about}
 },600);
}
function syncPriv(){ME&&api('/me',{method:'PATCH',body:{hide_online:!!S.noOnline,hide_read:!!S.noBlue,hide_typing:!!S.noType}}).catch(()=>{})}

/* ================= app lock (also guards locked chats) ================= */
let pinHash=ls('libra_pin'),lkBuf='',lkMode='',lkFirst='',lkAfter=null;
S.appLock=!!pinHash;
const sha=async s=>{try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('libra:'+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return 'p:'+s}};
$('lkK').innerHTML=['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k=>k?`<button onclick="lkKey('${k}')" class="w-16 h-16 rounded-full panel border bd text-xl">${k}</button>`:'<span></span>').join('');
function openLock(m,cb){
 if(m==='verify'&&!pinHash){toast('Create a PIN first');m='set';S.appLock=true}
 lkMode=m;lkBuf='';lkFirst='';lkAfter=cb||null;$('lk').style.display='flex';lkRender();
}
function lkRender(){
 $('lkT').textContent=lkMode==='set'?(lkFirst?'Confirm your PIN':'Create a 4-digit PIN'):lkMode==='verify'?'Enter your PIN':'Enter PIN to unlock';
 $('lkD').innerHTML=[0,1,2,3].map(i=>`<i class="w-3.5 h-3.5 rounded-full border-2 inline-block mx-1.5" style="border-color:var(--accent);background:${i<lkBuf.length?'var(--accent)':'transparent'}"></i>`).join('');
 $('lkC').style.display=lkMode==='unlock'?'none':'block';
}
function lkKey(k){if(k==='⌫')lkBuf=lkBuf.slice(0,-1);else if(lkBuf.length<4)lkBuf+=k;lkRender();if(lkBuf.length===4)setTimeout(lkDone,150)}
async function lkDone(){
 const done=()=>{$('lk').style.display='none';const cb=lkAfter;lkAfter=null;if(cb)cb()};
 if(lkMode==='set'){
  if(!lkFirst){lkFirst=lkBuf;lkBuf='';lkRender();return}
  if(lkFirst===lkBuf){pinHash=await sha(lkBuf);ls('libra_pin',pinHash);renderSet();done()}
  else{lkFirst='';lkBuf='';lkRender();$('lkT').textContent="PINs didn't match, try again"}
 }else if(await sha(lkBuf)===pinHash){if(lkMode==='verify')UNLOCK_UNTIL=Date.now()+5*60e3;done()}
 else{lkBuf='';lkRender();$('lkT').textContent='Wrong PIN'}
}
function lkCancel(){if(lkMode==='set'&&!pinHash)S.appLock=false;lkAfter=null;$('lk').style.display='none';renderSet()}
function lockNow(){openSet(false);if(!pinHash){S.appLock=true;openLock('set')}else openLock('unlock')}
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)return;
 UNLOCK_UNTIL=0;if(cur&&isLocked(cur))closeChat();
 if(pinHash&&$('auth').style.display==='none')openLock('unlock');
});
if(pinHash)openLock('unlock');

/* ================= status ================= */
const BGS=BG;
let sts=[],mine=[],sv=null,si=0,stm=null,cbg=BG[0];
let stPaused=false,stRemain=5000,stT0=0,stHold=null,stHeld=false;
const ringAv=(id,n,seen,av)=>`<div class="rounded-full p-[2.5px] flex-none" style="background:${seen?'var(--line)':'var(--accent)'}"><div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold border-2" style="background:${xU(av)?`url(${xU(av)}) center/cover`:col(id==='me'?'0':id)};border-color:var(--panel)">${xU(av)?'':esc(ini(n))}</div></div>`;
function renderStatus(){
 const row=x=>`<div onclick="openSt('${x.id}')" class="row flex items-center gap-3 px-4 py-3 cursor-pointer">${ringAv(x.id,x.n,x.seen,x.avatar)}<div><div class="font-medium">${esc(x.n)}</div><div class="text-xs mut">${x.items[x.items.length-1].t}</div></div></div>`;
 const u=sts.filter(x=>!x.seen),v=sts.filter(x=>x.seen),h=t=>`<p class="px-4 pt-3 pb-1 text-xs mut">${t}</p>`;
 $('list').innerHTML=`<div class="row flex items-center gap-3 px-4 py-3 cursor-pointer" onclick="${mine.length?"openSt('me')":'openCompose()'}"><div class="relative">${ringAv('me','Me',!mine.length,ME&&ME.avatar_url)}<span onclick="event.stopPropagation();openCompose()" class="absolute -bottom-0.5 -right-0.5 accbg text-white rounded-full w-5 h-5 flex items-center justify-center">${I('plus','ic-xs')}</span></div><div><div class="font-medium">My status</div><div class="text-xs mut">${mine.length?mine.length+' update(s), tap to view':'Tap to add status update'}</div></div></div>`+(u.length?h('Recent updates')+u.map(row).join(''):'')+(v.length?h('Viewed')+v.map(row).join(''):'');
}
async function loadStatuses(){
 const rows=await api('/statuses'),by={};mine=[];
 rows.forEach(r=>{
  const url=r.media_url||'',vid=r.kind==='video'||/\.(mp4|webm|mov|m4v|3gp)$/i.test(url);
  const it={bg:r.bg,tx:r.body,img:url||undefined,vid,t:ago(r.created_at),sid:r.id};
  if(r.user_id===ME.id){mine.push(it);return}
  const u2=by[r.user_id]=by[r.user_id]||{id:r.user_id,n:r.name,avatar:r.avatar_url,seen:true,items:[]};
  u2.items.push(it);if(!r.seen)u2.seen=false;
 });
 sts=Object.values(by);renderList();
}
const viewSt=id=>api(`/statuses/${id}/view`,{method:'POST'}).catch(()=>{});
function openCompose(){$('cpTx').value='';pickBg(cbg);$('cp').style.display='flex'}
function pickBg(c){cbg=c;$('cp').style.background=c;$('cpCol').innerHTML=BG.map(b=>`<div onclick="pickBg('${b}')" class="w-7 h-7 rounded-full cursor-pointer border-2 ${b===c?'border-white':'border-white/30'}" style="background:${b}"></div>`).join('')}
async function postSt(){
 const t=$('cpTx').value.trim();if(!t)return;
 try{await api('/statuses',{method:'POST',body:{body:t,bg:cbg}});$('cp').style.display='none';await loadStatuses()}catch(e){toast(e.message)}
}
$('svRx').innerHTML=['❤️','😂','😮','😢','🙏','👍'].map(e=>`<button class="emj" onclick="stReact(this.textContent)">${e}</button>`).join('');
const svTxEl=$('svTx');
svTxEl.addEventListener('pointerdown',()=>{stHeld=false;clearTimeout(stHold);stHold=setTimeout(()=>{stHeld=true;stPause(true)},220)});
['pointerup','pointercancel','pointerleave'].forEach(ev=>svTxEl.addEventListener(ev,()=>{clearTimeout(stHold);if(stHeld){stPause(false);setTimeout(()=>{stHeld=false},120)}}));
function openSt(id){
 sv=id==='me'?{id:'me',n:'My status',items:mine}:sts.find(x=>x.id===id);if(!sv||!sv.items.length)return;
 si=0;if(id!=='me'){sv.seen=true;renderList()}
 $('svRp').style.display=id==='me'?'none':'block';$('svOwn').style.display=id==='me'?'block':'none';
 $('sv').style.display='flex';showSt();
}
function stStart(ms){
 const e=$('act');stRemain=ms;clearTimeout(stm);
 if(e){e.style.transition='none';e.style.width='0%';void e.offsetWidth;e.style.transition=`width ${ms}ms linear`;e.style.width='100%'}
 stT0=Date.now();stm=setTimeout(nextSt,ms);
}
function stVidMeta(v){
 if(!sv||!v.isConnected)return;
 const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true;v.play().catch(()=>{})});
 if(!stPaused)stStart(Math.min(60000,Math.max(3000,(v.duration||8)*1000)));
}
function showSt(){
 clearTimeout(stm);const it=sv.items[si];stPaused=false;stRemain=5000;
 if(it.sid&&sv.id!=='me')viewSt(it.sid);
 $('sv').style.background=it.bg||'#000';$('svAv').textContent=ini(sv.n);$('svN').textContent=sv.n;$('svT').textContent=it.t;
 const u=xU(it.img),cap=it.img&&it.tx?`<div class="absolute left-0 right-0 bottom-0 px-4 py-3 text-base text-center" style="background:linear-gradient(transparent,rgba(0,0,0,.65))">${rich(it.tx)}</div>`:'';
 if(it.img&&it.vid)$('svTx').innerHTML=`<div class="relative w-full h-full flex items-center justify-center bg-black"><video id="svVid" src="${esc(u)}" playsinline webkit-playsinline autoplay preload="auto" class="max-w-full max-h-full" onloadedmetadata="stVidMeta(this)" onerror="this.outerHTML='<div class=&quot;text-sm px-6&quot;>This video cannot be played on this device</div>'"></video>${cap}</div>`;
 else if(it.img)$('svTx').innerHTML=`<div class="relative w-full h-full flex items-center justify-center bg-black"><img src="${esc(u)}" class="max-w-full max-h-full object-contain pointer-events-none" alt="">${cap}</div>`;
 else $('svTx').innerHTML=`<span>${rich(it.tx)}</span>`;
 $('svBars').innerHTML=sv.items.map((_,i)=>`<div class="flex-1 h-1 rounded bg-white/30 overflow-hidden"><div class="h-full bg-white" ${i===si?'id="act"':''} style="width:${i<si?100:0}%"></div></div>`).join('');
 $('svPause').innerHTML=I('pause','ic-l');
 if(sv.id==='me'&&it.sid)api(`/extras/status/${it.sid}/viewers`).then(v=>{$('svCnt').textContent=v.length}).catch(()=>{$('svCnt').textContent='0'});
 if(it.img&&it.vid){stT0=Date.now();stm=setTimeout(nextSt,20000)}
 else requestAnimationFrame(()=>requestAnimationFrame(()=>stStart(5000)));
}
function nextSt(){if(si<sv.items.length-1){si++;showSt()}else closeSt()}
function closeSt(){clearTimeout(stm);stPaused=false;$('svTx').innerHTML='';$('sv').style.display='none';renderList()}
function stPause(on){
 if(!sv||stPaused===on||$('sv').style.display==='none')return;const e=$('act'),v=$('svVid');
 if(on){
  clearTimeout(stm);stRemain=Math.max(300,stRemain-(Date.now()-stT0));
  if(e){const w=e.getBoundingClientRect().width,p=e.parentElement.getBoundingClientRect().width;e.style.transition='none';e.style.width=(p>0?w/p*100:50)+'%'}
  if(v)v.pause();stPaused=true;
 }else{
  stPaused=false;
  if(e){void e.offsetWidth;e.style.transition=`width ${stRemain}ms linear`;e.style.width='100%'}
  if(v)v.play().catch(()=>{});
  stT0=Date.now();stm=setTimeout(nextSt,stRemain);
 }
 $('svPause').innerHTML=I(on?'play':'pause','ic-l');
}
function tapSt(e){
 if(stHeld){stHeld=false;return}
 if(e.target.closest&&e.target.closest('button,input'))return;
 if(stPaused){stPause(false);return}
 if(e.clientX<innerWidth/3){if(si>0){si--;showSt()}}else nextSt();
}
function stReply(e){
 if(e.key!=='Enter')return;const t=e.target.value.trim(),c=chats.find(c=>c.peer===sv.id);if(!t||!c)return;
 xSend({chat_id:c.id,body:'↩ Status: '+(sv.items[si].tx||'photo')+'\n'+t});e.target.value='';e.target.blur();toast('Reply sent');
}
function stReact(emoji){
 const c=chats.find(c=>c.peer===sv.id);if(!c)return;
 xSend({chat_id:c.id,body:'↩ Status: '+(sv.items[si].tx||'photo')+'\n'+emoji});toast('Reaction sent');
}
function stMenu(ev){
 stPause(true);const r=ev.currentTarget.getBoundingClientRect(),own=sv.id==='me';
 showCtx([['download','Save','stSave()'],['forward','Forward','stForward()'],...(own?[['trash','Delete this status','stDelete()',true]]:[])],Math.max(8,r.right-190),r.bottom+4);
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function textStatusPng(it){
 return new Promise(res=>{
  const c=document.createElement('canvas');c.width=720;c.height=1280;const g=c.getContext('2d');
  g.fillStyle=it.bg||'#6366f1';g.fillRect(0,0,720,1280);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.font='600 52px Montserrat, "Noto Color Emoji", sans-serif';
  const lines=[];let line='';
  String(it.tx||'').split(/\s+/).forEach(w=>{const t=line?line+' '+w:w;if(g.measureText(t).width>600&&line){lines.push(line);line=w}else line=t});if(line)lines.push(line);
  const lh=72,y0=640-(lines.length-1)*lh/2;lines.forEach((l,i)=>g.fillText(l,360,y0+i*lh));c.toBlob(res,'image/png');
 });
}
async function stSave(){
 const it=sv.items[si];
 try{
  if(it.img){const b=await(await fetch(xU(it.img))).blob();downloadBlob(b,'libra-status.'+((b.type.split('/')[1]||'jpg').replace('jpeg','jpg')))}
  else downloadBlob(await textStatusPng(it),'libra-status.png');
  toast('Saved to your downloads');
 }catch(e){toast('Could not save this status')}
}
function stForward(){
 const it=sv.items[si];
 forwardPicker(it.img?{kind:it.vid?'video':'image',body:it.tx||'',media_url:it.img,media_meta:{name:it.vid?'status.mp4':'status.jpg',fwd:true}}:{kind:'text',body:it.tx||'',media_meta:{fwd:true}});
}
async function stDelete(){
 const it=sv.items[si];if(!it.sid||!confirm('Delete this status?'))return;
 try{await api('/extras/status/'+it.sid,{method:'DELETE'});closeSt();await loadStatuses();toast('Status deleted')}catch(e){toast(e.message)}
}
async function stViewers(){
 const it=sv.items[si];stPause(true);xOv('Viewed by','<p class="text-center mut text-sm mt-10">Loading…</p>');
 try{const v=await api(`/extras/status/${it.sid}/viewers`);$('xovB').innerHTML=v.length?v.map(x=>`<div class="flex items-center gap-3 px-4 py-3"><div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold" style="background:${col(x.id)}">${esc(ini(x.name))}</div><div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(x.name)}</div><div class="text-xs mut">${ago(x.viewed_at)}</div></div></div>`).join(''):'<p class="text-center mut text-sm mt-10 px-6">No views yet. People who hide read receipts are not listed.</p>'}
 catch(e){$('xovB').textContent=e.message}
}

/* ================= calls (WebRTC) ================= */
let calls=[];
function renderCalls(){
 $('list').innerHTML=calls.map(c=>`<div class="row flex items-center gap-3 px-4 py-3"><div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-none" style="background:${col(c.id)}">${esc(ini(c.n))}</div><div class="flex-1 min-w-0"><div class="font-medium truncate ${c.d==='miss'?'text-red-500':''}">${esc(c.n)}</div><div class="text-xs mut flex items-center gap-1">${I(c.d==='out'?'out':'in','ic-xs '+(c.d==='miss'?'text-red-500':''))}${c.d==='miss'?'Missed':c.d==='out'?'Outgoing':'Incoming'} · ${c.t}</div></div><button onclick="startCall('${c.id}',${c.v?1:0})" class="ib acc">${I(c.v?'video':'phone')}</button></div>`).join('')||'<p class="text-center mut text-sm mt-10">No calls yet</p>';
}
async function loadCalls(){
 const rows=await api('/calls');
 calls=rows.map(r=>{const out=r.caller_id===ME.id;return{id:out?r.callee_id:r.caller_id,n:out?r.callee_name:r.caller_name,d:out?'out':(r.outcome==='answered'?'in':'miss'),t:new Date(r.created_at).toLocaleString([],{weekday:'short',hour:'2-digit',minute:'2-digit'}),v:r.video}});
 if(S.sec==='calls')renderList();
}
let ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let pc=null,lstream=null,cpeer=null,cout=false,cconn=false,cvid=false,pendOffer=null,pendIce=[],cw=null,ct=null,cs=0;
async function getMedia(v){
 try{return await navigator.mediaDevices.getUserMedia({audio:true,video:!!v})}
 catch(e){if(v){try{return await navigator.mediaDevices.getUserMedia({audio:true})}catch(e2){}}toast('Allow microphone (and camera) access to make calls');return null}
}
function callUI(name,key,status,incoming,video){
 $('cAv').textContent=ini(name);$('cAv').style.background=col(key);$('cN').textContent=name;$('cS').textContent=status;
 $('cAcc').style.display=incoming?'flex':'none';$('cCam').style.display=video?'flex':'none';
 $('cMute').classList.remove('on');$('cMute').innerHTML=I('mic','ic-l');$('cCam').classList.remove('on');$('call').style.display='flex';
}
function showLocal(){const has=lstream.getVideoTracks().length>0;$('cVid').style.display=has?'block':'none';if(has)$('cVid').srcObject=lstream;$('cCam').classList.toggle('on',false)}
function mkPc(){
 pc=new RTCPeerConnection(ICE);
 pc.onicecandidate=e=>{if(e.candidate)sock.emit('call:ice',{to:cpeer,candidate:e.candidate})};
 pc.ontrack=e=>{const r=$('rVid');r.srcObject=e.streams[0];if(cvid)r.style.display='block'};
 pc.onconnectionstatechange=()=>{
  if(!pc)return;
  if(pc.connectionState==='connected'&&!cconn){cconn=true;clearTimeout(cw);cs=0;$('cS').textContent='0:00';clearInterval(ct);ct=setInterval(()=>{cs++;$('cS').textContent=fmt(cs)},1000)}
  if(pc.connectionState==='failed')endCall();
 };
 lstream.getTracks().forEach(t=>pc.addTrack(t,lstream));
}
async function startCall(id,v){
 if(pc||pendOffer)return;
 const c=chats.find(x=>x.id===id||x.peer===id);
 if(!c||!c.peer){toast('Calls work in one-to-one chats');return}
 cpeer=c.peer;cout=true;cconn=false;cvid=!!v;
 lstream=await getMedia(v);if(!lstream){cleanup();return}
 callUI(c.n,c.id,(v?'Video':'Voice')+' calling…',false,v);mkPc();showLocal();
 const o=await pc.createOffer();await pc.setLocalDescription(o);
 sock.emit('call:offer',{to:cpeer,sdp:pc.localDescription,video:!!v,name:ME.name});
 cw=setTimeout(()=>{if(!cconn&&cpeer)endCall()},45000);
}
async function acceptCall(){
 const o=pendOffer;pendOffer=null;$('cAcc').style.display='none';
 lstream=await getMedia(o.video);
 if(!lstream){sock.emit('call:end',{to:o.from,reason:'declined'});cleanup();return}
 mkPc();showLocal();$('cS').textContent='Connecting…';
 await pc.setRemoteDescription(o.sdp);
 pendIce.splice(0).forEach(c=>pc.addIceCandidate(c).catch(()=>{}));
 const a=await pc.createAnswer();await pc.setLocalDescription(a);
 sock.emit('call:answer',{to:o.from,sdp:pc.localDescription});
}
async function logCall(outcome){try{await api('/calls',{method:'POST',body:{callee_id:cpeer,video:cvid,outcome,duration_s:cconn?cs:0}});loadCalls()}catch(e){}}
function cleanup(delay){
 clearInterval(ct);clearTimeout(cw);
 const done=()=>{
  if(pc){pc.close();pc=null}
  if(lstream){lstream.getTracks().forEach(t=>t.stop());lstream=null}
  ['rVid','cVid'].forEach(k=>{$(k).srcObject=null;$(k).style.display='none'});
  $('call').style.display='none';cpeer=null;cconn=false;cout=false;pendOffer=null;pendIce=[];
 };
 delay?setTimeout(done,1200):done();
}
function endCall(){
 const peer=pendOffer?pendOffer.from:cpeer;
 if(peer)sock.emit('call:end',{to:peer,reason:pendOffer?'declined':undefined});
 if(cout&&cpeer)logCall(cconn?'answered':'missed');
 cleanup();
}
function cTog(){const el=$('cMute');el.classList.toggle('on');const muted=el.classList.contains('on');el.innerHTML=I(muted?'mic-off':'mic','ic-l');if(lstream)lstream.getAudioTracks().forEach(t=>t.enabled=!muted)}
function cCamTog(){if(!lstream)return;const t=lstream.getVideoTracks();if(!t.length)return;const on=!t[0].enabled;t.forEach(x=>x.enabled=on);$('cCam').classList.toggle('on',!on)}
function wireCalls(){
 sock.on('call:offer',({from,sdp,video,name})=>{
  if(pc||pendOffer){sock.emit('call:end',{to:from,reason:'busy'});return}
  pendOffer={from,sdp,video};cpeer=from;cout=false;cconn=false;cvid=!!video;
  callUI(name||'Unknown caller',from,video?'Incoming video call…':'Incoming voice call…',true,video);
 });
 sock.on('call:answer',async({from,sdp})=>{if(!pc||from!==cpeer)return;await pc.setRemoteDescription(sdp);pendIce.splice(0).forEach(c=>pc.addIceCandidate(c).catch(()=>{}))});
 sock.on('call:ice',({from,candidate})=>{if(from!==cpeer)return;pc&&pc.remoteDescription?pc.addIceCandidate(candidate).catch(()=>{}):pendIce.push(candidate)});
 sock.on('call:end',({from,reason})=>{
  if(from!==cpeer)return;
  if(cout){logCall(reason==='declined'?'declined':cconn?'answered':'missed');cout=false}
  $('cAcc').style.display='none';
  $('cS').textContent=reason==='declined'?'Call declined':reason==='busy'?'User is busy':cconn?'Call ended':'Missed call';
  cleanup(true);
 });
}

/* ================= PWA: install, service worker, push ================= */
let SWREG=null,DIP=null;
async function regSW(){
 if(!('serviceWorker' in navigator))return;
 try{SWREG=await navigator.serviceWorker.register('/sw.js');navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='open-chat'&&e.data.chat_id)openChat(e.data.chat_id)})}catch(e){console.error('sw:',e)}
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();DIP=e;renderSet()});
addEventListener('appinstalled',()=>{DIP=null;renderSet();toast('LIBRA installed')});
async function installApp(){
 if(DIP){DIP.prompt();await DIP.userChoice.catch(()=>{});DIP=null;renderSet()}
 else toast('Tap the Share button, then "Add to Home Screen".');
}
const b64u=s=>{const p='='.repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
async function pushCheck(){
 try{
  if(!SWREG||!('PushManager' in window)||!('Notification' in window)){S.push=false;return}
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  S.push=!!sub&&Notification.permission==='granted';
 }catch(e){S.push=false}
 renderNbar();
}
async function pushEnable(){
 if(!SWREG||!('PushManager' in window)||!('Notification' in window)){
  toast(IOS&&!STANDALONE?'On iPhone, tap Share, then Add to Home Screen, and open LIBRA from there.':'Notifications are not supported in this browser.');return false;
 }
 const perm=await Notification.requestPermission();
 if(perm!=='granted'){toast('Notifications are blocked. Allow them in your browser settings.');renderNbar();return false}
 try{
  const {key}=await api('/push/key'),reg=await navigator.serviceWorker.ready;
  const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
  await api('/push/subscribe',{method:'POST',body:sub.toJSON()});
  S.push=true;renderNbar();renderSet();return true;
 }catch(e){toast(e.message||'Could not turn on notifications');return false}
}
async function pushDisable(){
 try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await api('/push/unsubscribe',{method:'POST',body:{endpoint:sub.endpoint}}).catch(()=>{});await sub.unsubscribe()}}catch(e){}
 S.push=false;renderSet();
}
function renderNbar(){
 const show=ME&&S.sec==='chats'&&'Notification' in window&&Notification.permission==='default'&&!ls('libra_nbar')&&(!IOS||STANDALONE);
 $('nbar').innerHTML=show?`<div class="flex items-center gap-3 px-4 py-2 text-sm" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">${I('bell','acc')}<span class="flex-1">Get notified when messages arrive</span><button onclick="pushEnable()" class="accbg text-white rounded-lg px-3 py-1 text-xs font-semibold">Turn on</button><button onclick="ls('libra_nbar','1');renderNbar()" class="ib" title="Dismiss">${I('x','ic-s')}</button></div>`:'';
}

/* ================= keyboard shortcuts ================= */
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSec('chats');if(cur&&innerWidth<768)back();$('q').focus();return}
 if(e.key!=='Escape')return;
 if($('mv').style.display==='flex')return;
 const layers=[['pv',closePreview],['xov',xOvClose],['prof',closeProfile],['cpk',cpkClose],['sch',()=>{$('sch').style.display='none'}],['pn',()=>{$('pn').style.display='none'}]];
 for(const [id,fn] of layers){if($(id).style.display&&$(id).style.display!=='none'){fn();return}}
 if(!$('set').classList.contains('hidden')){openSet(false);return}
 if(SEL.on){selClear();return}
 if($('ctx').style.display==='block'){$('ctx').style.display='none';return}
 if(['att','emo','xstk'].some(p=>!$(p).classList.contains('hidden'))){hidePanels();return}
});

/* ================= start-up ================= */
function startApp(){renderTabs();renderNav();regSW();init();syncSend()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startApp);else startApp();
