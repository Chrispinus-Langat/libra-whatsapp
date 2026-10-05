/* LIBRA v2: avatars, stickers, video/location/contact, forward, status tools, block/report/delete, archive/mute, message search.
   Loads AFTER the main script and overrides some of its functions. */

/* ---------- extra icons ---------- */
document.querySelector('svg defs').insertAdjacentHTML('beforeend', `
<symbol id="i-forward" viewBox="0 0 24 24"><path d="m15 17 5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></symbol>
<symbol id="i-camera" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></symbol>
<symbol id="i-map-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="i-sticker" viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/><path d="M8 13h.01M14 13h.01"/><path d="M8.500 16.500s1 1.500 2.500 1.500 2.500-1.500 2.500-1.500"/></symbol>
<symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.900 4.900 14.200 14.200"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></symbol>
<symbol id="i-archive" viewBox="0 0 24 24"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></symbol>
<symbol id="i-bell-off" viewBox="0 0 24 24"><path d="M8.700 3A6 6 0 0 1 18 8a21.300 21.300 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.670 4.670 0 0 1 .3-1.700"/><path d="M10.300 21a1.940 1.940 0 0 0 3.400 0"/><path d="m2 2 20 20"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>`);
Object.assign(KL, { video: 'Video', sticker: 'Sticker', location: 'Location', contact: 'Contact' });

/* ---------- helpers ---------- */
const xU = u => /^\/uploads\/[\w.-]{1,100}$/.test(u || '') ? u : '';
const xSize = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.ceil(n / 1e3) + ' KB';
const xUpload = f => { const fd = new FormData(); fd.append('file', f, f.name || 'file'); return api('/upload', { method: 'POST', body: fd }); };
const xLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const xSend = o => sock.emit('message:send', o, a => { if (!a || !a.ok) toast('Message not sent. Check your connection.'); });

/* ---------- emoji: one consistent look everywhere ---------- */
const XE = '(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)\\p{Emoji_Modifier}?';
const EMO_RE = new RegExp(`(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|${XE}(?:\\u200D(?:${XE}|\\p{Extended_Pictographic}\\uFE0F?))*)`, 'gu');
const emojiOnly = s => { const t = String(s || '').replace(/\s+/g, ''); if (!t) return 0; const m = t.match(EMO_RE); return m && m.join('') === t ? m.length : 0; };
const emojify = h => h.replace(EMO_RE, e => `<span class="emj">${e}</span>`);
const xLink = h => h.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer" class="underline" onclick="event.stopPropagation()">${u}</a>`);
const rich = s => xLink(emojify(esc(s)));

/* ---------- avatars ---------- */
function AVATAR(c, size = 'w-12 h-12') {
  if (c && xU(c.avatar)) return `<img src="${esc(xU(c.avatar))}" alt="" loading="lazy" class="${size} rounded-full object-cover flex-none">`;
  return _avatarV1(c, size);
}
function renderHead() {
  $('hName').innerHTML = emojify(esc(cur.n));
  const a = $('hAv');
  if (xU(cur.avatar)) { a.style.background = 'transparent'; a.innerHTML = `<img src="${esc(xU(cur.avatar))}" alt="" class="w-10 h-10 rounded-full object-cover">`; }
  else { a.style.background = col(cur.id); a.innerHTML = cur.grp ? I('users') : esc(ini(cur.n)); }
  $('hSt').textContent = stTxt(cur);
  xComposerState();
}
async function xCrop(file, size) {
  const bmp = await createImageBitmap(file), s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .88));
}
async function xSetAvatar(el) {
  const f = el.files[0]; el.value = ''; if (!f) return;
  try {
    const u = await xUpload(new File([await xCrop(f, 256)], 'avatar.jpg', { type: 'image/jpeg' }));
    const me = await api('/me', { method: 'PATCH', body: { avatar_url: u.url } });
    ME.avatar_url = me.avatar_url; xPaintProfileAvatar(); toast('Profile photo updated');
  } catch (e) { toast(e.message); }
}
function xPaintProfileAvatar() {
  const a = $('prAv'); if (!a || !ME || !xU(ME.avatar_url)) return;
  a.style.background = 'transparent'; a.innerHTML = `<img src="${esc(xU(ME.avatar_url))}" alt="" class="w-16 h-16 rounded-full object-cover">`;
}
const _renderSetV1 = renderSet; renderSet = function () { _renderSetV1(); xPaintProfileAvatar(); };

/* ---------- chat meta (avatars, archived, muted, blocked) ---------- */
let XM = { blocked: [], admin: false };
async function xMeta() {
  try {
    const m = await api('/extras/meta');
    XM = { blocked: m.blocked || [], admin: !!m.admin };
    chats.forEach(c => { const x = m.chats[c.id] || {}; c.avatar = x.avatar || null; c.archived = !!x.archived; c.muted = !!x.muted; c.blockedByMe = !!x.blocked_by_me; c.blockedMe = !!x.blocked_me; });
    if (m.me) ME.avatar_url = m.me.avatar_url;
    if (XM.admin && !$('xAdminLink')) $('instBtn').insertAdjacentHTML('beforebegin', `<a id="xAdminLink" href="/admin.html" target="_blank" class="mt-3 w-full border bd rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">${I('flag', 'ic-s')} Admin: reports</a>`);
  } catch (e) { /* server without extras: ignore */ }
}
const _refreshChatsV1 = refreshChats;
refreshChats = async function () { await _refreshChatsV1(); await xMeta(); if (cur) renderHead(); renderTabs(); renderList(); };

/* ---------- chat list ---------- */
function renderTabs() {
  const tabs = ['All', 'Unread', 'Groups', ...folders, ...(chats.some(c => c.archived) ? ['Archived'] : [])];
  $('tabs').innerHTML = tabs.map(t => `<button data-t="${esc(t)}" onclick="setTab(this.dataset.t)" class="px-3 py-1 rounded-full border bd ${S.tab === t ? 'accbg text-white border-transparent' : 'mut'}">${esc(t)}</button>`).join('') +
    `<button onclick="addFolder()" class="px-3 py-1 rounded-full border bd mut" title="New folder">${I('plus', 'ic-s')}</button>`;
}
function preview(c) {
  const l = lastOf(c);
  if (!l) return '<span class="text-sm mut flex-1 truncate">No messages yet</span>';
  const icon = { image: 'image', video: 'video', voice: 'mic', file: 'file', sticker: 'sticker', location: 'map-pin', contact: 'contact' }[l.kind];
  const txt = l.kind === 'text' ? emojify(esc(l.body)) : esc(KL[l.kind] || l.body);
  return `<div class="flex items-center gap-1 flex-1 min-w-0 text-sm mut">${l.out && l.st != null ? tick(l.st) : ''}${icon ? I(icon, 'ic-s') : ''}<span class="truncate">${txt}</span></div>`;
}
const XS = { q: '', html: '' };
function renderList() {
  renderNav(); renderNbar();
  $('tabs').style.display = S.sec === 'chats' ? 'flex' : 'none'; $('qwrap').style.display = S.sec === 'chats' ? 'block' : 'none';
  const tot = chats.filter(c => !c.archived && !c.muted).reduce((a, c) => a + (c.u || 0), 0);
  document.title = tot ? `(${tot}) LIBRA` : 'LIBRA';
  try { tot ? navigator.setAppBadge && navigator.setAppBadge(tot) : navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) { }
  if (S.sec === 'status') return renderStatus();
  if (S.sec === 'calls') return renderCalls();
  const qv = $('q').value.trim().toLowerCase();
  let l = chats.filter(c => c.n.toLowerCase().includes(qv));
  if (S.tab === 'Archived') l = l.filter(c => c.archived);
  else { l = l.filter(c => !c.archived); if (S.tab === 'Unread') l = l.filter(c => c.u); if (S.tab === 'Groups') l = l.filter(c => c.grp); if (folders.includes(S.tab)) l = l.filter(c => c.f === S.tab); }
  l.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  $('list').innerHTML = l.map(c => {
    const x = lastOf(c);
    return `<div onclick="openChat('${c.id}')" class="row ${cur && cur.id === c.id ? 'on' : ''} flex items-center gap-3 px-4 py-3 cursor-pointer">${avatar(c)}
 <div class="flex-1 min-w-0 border-b bd pb-3 -mb-3"><div class="flex items-center gap-2"><span class="font-semibold truncate flex-1 text-[15px]">${emojify(esc(c.n))}</span><span class="text-xs flex-none ${c.u && !c.muted ? 'acc' : 'mut'}">${listTime(x)}</span></div>
 <div class="flex items-center gap-2 mt-0.5">${preview(c)}${c.muted ? I('bell-off', 'ic-s mut') : ''}${c.pin ? I('pin', 'ic-s mut') : ''}${c.u ? `<span class="${c.muted ? 'bg-gray-400' : 'accbg'} text-white text-xs font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">${c.u}</span>` : ''}</div></div></div>`;
  }).join('') || '<p class="text-center mut text-sm mt-10 px-6">No chats here yet.</p>';
  $('list').insertAdjacentHTML('beforeend', `<div id="xmsgres">${XS.q === qv ? XS.html : ''}</div>`);
  xSearchMsgs(qv);
}
let _sq = null;
function xSearchMsgs(qv) {
  clearTimeout(_sq);
  if (qv.length < 3) { XS.q = ''; XS.html = ''; return; }
  if (XS.q === qv) return;
  _sq = setTimeout(async () => {
    try {
      const r = await api('/extras/search?q=' + encodeURIComponent(qv));
      XS.q = qv;
      XS.html = r.length ? `<p class="px-4 pt-3 pb-1 text-xs font-semibold mut">Messages</p>` + r.map(m => `<div class="row px-4 py-2.5 cursor-pointer" data-c="${esc(m.chat_id)}" data-m="${esc(m.id)}" onclick="xJump(this.dataset.c,this.dataset.m)"><div class="text-xs acc truncate">${esc(m.chat_name || 'Chat')} · ${esc(m.sender_name || '')} · ${listTime({ at: m.created_at })}</div><div class="text-sm truncate">${emojify(esc(m.body))}</div></div>`).join('') : '';
      if ($('xmsgres') && $('q').value.trim().toLowerCase() === qv) $('xmsgres').innerHTML = XS.html;
    } catch (e) { }
  }, 300);
}
async function xJump(chatId, msgId) {
  $('q').value = ''; XS.q = ''; await openChat(chatId);
  const c = chats.find(x => x.id === chatId); if (!c) return;
  let n = 0; while (c.loaded && !c.msgs.some(m => m.id === msgId) && c.more && n++ < 15) await loadOlder();
  const el = document.querySelector(`[data-mid="${CSS.escape(msgId)}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('xflash'); setTimeout(() => el.classList.remove('xflash'), 1800); }
}

/* ---------- message bubbles ---------- */
function rxHtml(m) {
  if (!m.rx.length) return ''; const by = {}; m.rx.forEach(r => by[r.emoji] = (by[r.emoji] || 0) + 1);
  return `<span class="rxs emj">${Object.entries(by).map(([e, n]) => esc(e) + (n > 1 ? `<small class="mut"> ${n}</small>` : '')).join(' ')}</span>`;
}
function mediaHtml(m, i) {
  const u = xU(m.url), meta = m.meta || {};
  switch (m.kind) {
    case 'image': return `<img src="${esc(u)}" data-u="${esc(u)}" loading="lazy" class="xmedia cursor-zoom-in" alt="Photo" onclick="event.stopPropagation();viewImg(this.dataset.u)">`;
    case 'video': return `<video src="${esc(u)}" class="xmedia" controls preload="metadata" playsinline onclick="event.stopPropagation()"></video>`;
    case 'sticker': return meta.emoji ? `<span class="emj" style="font-size:84px;line-height:1.1;display:block">${esc(meta.emoji)}</span>` : `<img src="${esc(u)}" class="xsticker" alt="Sticker" loading="lazy">`;
    case 'file': return `<a href="${esc(u)}" target="_blank" rel="noopener" download="${esc(meta.name || 'file')}" onclick="event.stopPropagation()" class="flex items-center gap-2 py-1"><div class="w-10 h-10 rounded-lg accbg text-white flex items-center justify-center flex-none">${I('file')}</div><div class="min-w-0"><div class="text-sm truncate max-w-[180px]">${esc(meta.name || 'Document')}</div><div class="text-xs mut">${esc(meta.size || '')}</div></div></a>`;
    case 'voice': { const bars = meta.waveform && meta.waveform.length ? meta.waveform : [40, 70, 50, 80, 45];
      return `<div class="flex items-center gap-2 py-1 min-w-[210px]"><button onclick="event.stopPropagation();play(${i},this)" class="w-9 h-9 rounded-full accbg text-white flex-none flex items-center justify-center">${I('play', 'ic-s')}</button><div class="flex items-center gap-[2px] h-7 flex-1">${bars.map(h => `<i class="w-[3px] rounded bg-current opacity-40" style="height:${Math.max(5, Math.min(100, Number(h) || 0))}%"></i>`).join('')}</div><span class="text-xs mut">${fmt(Number(meta.duration) || 1)}</span></div>`; }
    case 'location': { const la = +meta.lat, ln = +meta.lng, ok = Math.abs(la) <= 90 && Math.abs(ln) <= 180;
      const href = ok ? `https://www.openstreetmap.org/?mlat=${la}&amp;mlon=${ln}#map=16/${la}/${ln}` : '';
      return `<${ok ? `a href="${href}" target="_blank" rel="noopener"` : 'div'} onclick="event.stopPropagation()" class="xcard"><div class="xicon" style="background:#ef4444">${I('map-pin')}</div><div class="min-w-0"><div class="text-sm font-semibold">Location</div><div class="text-xs mut truncate">${esc(meta.label || (ok ? la.toFixed(5) + ', ' + ln.toFixed(5) : ''))}</div>${ok ? '<div class="text-xs acc">Open in map</div>' : ''}</div></${ok ? 'a' : 'div'}>`; }
    case 'contact': return `<div class="xcard" onclick="event.stopPropagation()"><div class="xicon" style="background:${col(meta.phone || 'x')}">${esc(ini(meta.name))}</div><div class="min-w-0"><div class="text-sm font-semibold truncate">${esc(meta.name || 'Contact')}</div><div class="text-xs mut">${esc(meta.phone || '')}</div></div><button data-p="${esc(meta.phone || '')}" onclick="xChatWith(this.dataset.p)" class="xbtn">Message</button></div>`;
    default: return `<span class="text-sm whitespace-pre-wrap">${rich(m.body)}</span>`;
  }
}
function renderMsgs(toBottom) {
  const box = $('msgs'), keep = box.scrollTop; let h = '', prev = null;
  cur.msgs.forEach((m, i) => {
    const d = new Date(m.at); if (!prev || !sameDay(prev, d)) h += `<div class="day">${dayLabel(d)}</div>`; prev = d;
    const n = m.kind === 'text' && !m.reply ? emojiOnly(m.body) : 0;
    const cls = ['bub', m.out ? 'out' : 'in', m.kind === 'image' ? 'xm' : '', m.kind === 'video' ? 'xv' : '', m.kind === 'sticker' ? 'xs' : '', n > 0 && n <= 3 ? 'xe' : ''].join(' ');
    const fwd = m.meta && m.meta.fwd ? `<div class="text-xs mut italic mb-0.5 flex items-center gap-1">${I('forward', 'ic-xs')}Forwarded</div>` : '';
    h += `<div class="${cls}" data-mid="${esc(m.id)}" style="${m.rx.length ? 'margin-bottom:12px' : ''}" ondblclick="reactQuick(${i},'❤️')" onclick="msgMenu(${i},event)">
 ${cur.grp && !m.out ? `<div class="text-xs font-semibold mb-0.5" style="color:${col(m.sid)}">${esc(m.sname || '')}</div>` : ''}${fwd}
 ${m.reply ? `<div class="rq">${m.reply.name ? `<div class="font-semibold acc">${esc(m.reply.name)}</div>` : ''}<div class="truncate mut">${esc(m.reply.text)}</div></div>` : ''}
 ${n > 0 && n <= 3 ? `<span class="emj xbig">${esc(m.body.trim())}</span>` : mediaHtml(m, i)}
 <span class="meta">${m.starred ? I('star', 'ic-xs fillc') : ''}${m.edited ? 'edited' : ''} ${tm(m.at)} ${m.out ? tick(tickOf(m)) : ''}</span><div class="clear-both"></div>${rxHtml(m)}</div>`;
  });
  if (!cur.msgs.length) h = `<div class="day">${cur.loaded ? 'No messages yet. Say hi!' : 'Loading…'}</div>`;
  box.innerHTML = h; box.scrollTop = toBottom ? box.scrollHeight : keep; xScrollBtn();
}
function msgMenu(i, e) {
  e.stopPropagation(); const m = cur.msgs[i];
  const top = `<div class="flex justify-between px-3 py-2 text-2xl">${QR.map(q => `<button class="emj" onclick="reactQuick(${i},'${q}')">${q}</button>`).join('')}</div><div class="border-t bd my-1"></div>`;
  showCtx([['reply', 'Reply', `setReply(cur.msgs[${i}])`], ...(m.kind === 'text' ? [['copy', 'Copy', `copyMsg(${i})`]] : []), ['forward', 'Forward', `xForwardMsg(${i})`], ['star', m.starred ? 'Unstar' : 'Star', `star(${i})`],
    ...(m.out && m.kind === 'text' ? [['pencil', 'Edit', `startEdit(cur.msgs[${i}])`]] : []), ['trash', 'Delete for me', `delMe(${i})`, true],
    ...(m.out ? [['trash', 'Delete for everyone', `delAll(${i})`, true]] : [['flag', 'Report', `xReportMsg(${i})`, true]])], e.clientX, e.clientY, top);
}
function reactQuick(i, emoji) {
  $('ctx').style.display = 'none';
  const m = cur.msgs[i], mine = m.rx.find(r => r.user_id === ME.id), e = mine && mine.emoji === emoji ? null : emoji;
  setRx(m, ME.id, e); renderMsgs(); api(`/messages/${m.id}/reaction`, { method: 'PUT', body: { emoji: e } }).catch(console.error);
}

/* scroll-to-bottom button + blocked banner */
$('chat').classList.add('relative');
$('chat').insertAdjacentHTML('beforeend', `<button id="xdown" style="display:none" onclick="xToBottom()" class="absolute right-4 bottom-24 w-10 h-10 rounded-full panel border bd shadow-lg flex items-center justify-center z-10" title="Latest messages">${I('chevron-down')}</button>`);
document.querySelector('#chat footer').insertAdjacentHTML('beforebegin', '<div id="xblk" style="display:none" class="items-center gap-3 px-4 py-3 border-t bd panel"></div>');
function xScrollBtn() { const b = $('msgs'); $('xdown').style.display = b.scrollHeight - b.scrollTop - b.clientHeight > 400 ? 'flex' : 'none'; }
function xToBottom() { const b = $('msgs'); b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }
$('msgs').addEventListener('scroll', xScrollBtn);
function xComposerState() {
  const ft = document.querySelector('#chat footer'), b = $('xblk'), blocked = !!cur && !!cur.blockedByMe;
  ft.style.display = blocked ? 'none' : ''; b.style.display = blocked ? 'flex' : 'none';
  if (blocked) b.innerHTML = `<span class="flex-1 text-sm mut">You blocked ${esc(cur.n)}.</span><button onclick="xUnblock()" class="accbg text-white rounded-lg px-3 py-1.5 text-sm">Unblock</button>`;
}

/* ---------- generic full-screen dialog ---------- */
document.body.insertAdjacentHTML('beforeend', `<div id="xov" style="display:none" class="fixed inset-0 z-[75] bg-black/50 items-center justify-center md:p-4" onclick="if(event.target===this)xOvClose()"><div class="panel w-full h-full md:h-[min(640px,88vh)] md:max-w-md md:rounded-2xl flex flex-col overflow-hidden"><header class="flex items-center gap-2 px-3 h-14 border-b bd flex-none"><button onclick="xOvClose()" class="ib">${I('back')}</button><div id="xovT" class="font-semibold flex-1 truncate"></div></header><div id="xovB" class="flex-1 overflow-y-auto scr"></div><div id="xovF" class="p-3 border-t bd" style="display:none"></div></div></div>
<input type="file" id="xFile" accept="image/*,video/*" class="hidden" onchange="xPickMedia(this)"><input type="file" id="xCam" accept="image/*" capture="environment" class="hidden" onchange="xPickMedia(this)">
<input type="file" id="xStkIn" accept="image/*" class="hidden" onchange="xMakeSticker(this)"><input type="file" id="xAv" accept="image/*" class="hidden" onchange="xSetAvatar(this)"><input type="file" id="xGAv" accept="image/*" class="hidden" onchange="xSetGroupPhoto(this)">`);
function xOv(title, body, footer) {
  $('xovT').textContent = title; $('xovB').innerHTML = body || ''; const f = $('xovF');
  if (footer) { f.innerHTML = footer; f.style.display = 'block'; } else f.style.display = 'none';
  $('xov').style.display = 'flex';
}
function xOvClose() { $('xov').style.display = 'none'; XFW = null; }

/* ---------- attach menu + new message types ---------- */
$('att').innerHTML = [['image', 'bg-fuchsia-500', 'Photo or video', "$('xFile').click()"], ['camera', 'bg-rose-500', 'Camera', "$('xCam').click()"], ['file', 'bg-indigo-500', 'Document', "$('fDoc').click()"],
  ['contact', 'bg-sky-500', 'Contact', 'xSendContact()'], ['map-pin', 'bg-emerald-500', 'Location', 'xSendLocation()'], ['sticker', 'bg-amber-500', 'Make a sticker', "$('xStkIn').click()"], ['clock', 'bg-slate-500', 'Schedule message', 'openSch()']]
  .map(([ic, bg, t, f]) => `<button onclick="${f}" class="row flex items-center gap-3 w-full px-3 py-2 rounded-xl"><span class="w-8 h-8 rounded-full ${bg} text-white flex items-center justify-center">${I(ic, 'ic-s')}</span>${t}</button>`).join('');
async function xShrink(file, max = 1600) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height)); if (sc === 1 && file.size < 1.5e6) return file;
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
async function xPickMedia(el) {
  const f = el.files[0]; el.value = ''; if (!f || !cur) return; $('att').classList.add('hidden');
  const cid = cur.id, vid = f.type.startsWith('video/');
  if (vid && f.size > 25 * 1024 * 1024) return toast('That video is larger than 25 MB. Trim it and try again.');
  try {
    toast(vid ? 'Uploading video…' : 'Uploading photo…');
    const file = vid ? f : await xShrink(f), u = await xUpload(file);
    xSend({ chat_id: cid, kind: vid ? 'video' : 'image', media_url: u.url, media_meta: { name: u.name, size: xSize(file.size) } });
  } catch (e) { toast(e.message); }
}
function xSendLocation() {
  $('att').classList.add('hidden'); const cid = cur.id, name = cur.n;
  if (!navigator.geolocation) return toast('Location is not available on this device');
  toast('Getting your location…');
  navigator.geolocation.getCurrentPosition(p => {
    if (confirm(`Send your current location to ${name}?`)) xSend({ chat_id: cid, kind: 'location', media_meta: { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Shared location' } });
  }, err => toast(err.code === 1 ? 'Allow location access to share it' : 'Could not get your location'), { enableHighAccuracy: true, timeout: 15000 });
}
let XCT = [];
async function xSendContact() {
  $('att').classList.add('hidden'); try { XCT = await api('/contacts'); } catch (e) { XCT = []; }
  xOv('Share a contact', XCT.length ? XCT.map((c, i) => `<div class="row flex items-center gap-3 px-4 py-2.5 cursor-pointer" data-i="${i}" onclick="xPickContact(this.dataset.i)">${avatar({ id: c.id, n: c.name }, 'w-11 h-11')}<div class="min-w-0"><div class="font-medium truncate">${esc(c.name)}</div><div class="text-xs mut">${esc(c.phone)}</div></div></div>`).join('') : '<p class="text-center mut text-sm mt-10 px-6">No contacts yet.</p>');
}
function xPickContact(i) { const c = XCT[i]; if (!c || !cur) return; xSend({ chat_id: cur.id, kind: 'contact', media_meta: { name: c.name, phone: c.phone } }); xOvClose(); }
async function xChatWith(phone) {
  try { const r = await api('/chats', { method: 'POST', body: { phone } }); await refreshChats(); openChat(r.id); } catch (e) { toast(e.message); }
}

/* ---------- stickers ---------- */
const XEMO = ['😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '🥳', '🥹', '😭', '😡', '🤯', '😱', '🙄', '😴', '🤔', '🤗', '🙏', '👍', '👏', '🙌', '💪', '🔥', '💯', '🎉', '❤️', '💔', '😅', '😇', '😉', '😜', '🤝', '👋', '✌️', '🫶', '☕', '🍕', '🎂', '🌹'];
const xMyStk = () => xLS('libra_stk', []).filter(xU);
$('attBtn').insertAdjacentHTML('afterend', `<button id="stkBtn" onclick="xToggleStk()" class="ib" title="Stickers">${I('sticker')}</button>`);
document.querySelector('#chat footer').insertAdjacentHTML('beforeend', '<div id="xstk" class="hidden panel border bd rounded-2xl shadow-xl"></div>');
function xToggleStk() { const p = $('xstk'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden')) xStkRender(); }
function xStkRender() {
  const mine = xMyStk();
  $('xstk').innerHTML = `<div class="px-3 pt-2 pb-1 text-xs mut flex items-center">My stickers<button onclick="$('xStkIn').click()" class="ml-auto acc font-semibold">+ Add</button></div>
<div class="grid grid-cols-4 gap-1 px-2 pb-2">${mine.length ? mine.map(u => `<img src="${esc(u)}" data-u="${esc(u)}" class="xstkimg" alt="" onclick="xSendSticker(this.dataset.u)" oncontextmenu="event.preventDefault();xRmStk(this.dataset.u)">`).join('') : '<p class="col-span-4 text-xs mut px-1 py-2">Tap + Add to turn any photo into a sticker. Right-click or long-press a sticker to remove it.</p>'}</div>
<div class="px-3 pt-1 pb-1 text-xs mut">Emoji stickers</div><div class="grid grid-cols-6 gap-1 px-2 pb-2">${XEMO.map(e => `<button class="emj text-4xl" onclick="xSendEmojiSticker(this.textContent)">${e}</button>`).join('')}</div>`;
}
function xSendSticker(u) { if (!cur) return; xSend({ chat_id: cur.id, kind: 'sticker', media_url: u, media_meta: {} }); $('xstk').classList.add('hidden'); }
function xSendEmojiSticker(e) { if (!cur) return; xSend({ chat_id: cur.id, kind: 'sticker', media_meta: { emoji: e } }); $('xstk').classList.add('hidden'); }
function xRmStk(u) { localStorage.setItem('libra_stk', JSON.stringify(xMyStk().filter(x => x !== u))); xStkRender(); }
async function xMakeSticker(el) {
  const f = el.files[0]; el.value = ''; if (!f) return; $('att').classList.add('hidden');
  try {
    const bmp = await createImageBitmap(f), s = Math.min(512 / bmp.width, 512 / bmp.height), w = bmp.width * s, h = bmp.height * s;
    const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(bmp, (512 - w) / 2, (512 - h) / 2, w, h);
    let type = 'image/webp', blob = await new Promise(r => c.toBlob(r, type, .9)); if (!blob || blob.type !== type) { type = 'image/png'; blob = await new Promise(r => c.toBlob(r, type)); }
    const u = await xUpload(new File([blob], 'sticker.' + (type === 'image/webp' ? 'webp' : 'png'), { type }));
    localStorage.setItem('libra_stk', JSON.stringify([u.url, ...xMyStk()].slice(0, 30)));
    toast('Sticker saved to My stickers'); if (cur) xSendSticker(u.url);
  } catch (e) { toast(e.message || 'Could not make that sticker'); }
}

/* ---------- forward ---------- */
let XFW = null;
function xForwardMsg(i) {
  const m = cur.msgs[i];
  xForwardPicker({ kind: m.kind, body: m.kind === 'text' ? m.body : '', media_url: m.url || undefined, media_meta: Object.assign({}, m.meta || {}, { fwd: true }) });
}
function xForwardPicker(payload) {
  XFW = { payload, sel: new Set() };
  xOv('Forward to…', `<div class="p-3"><div class="flex items-center gap-2 rounded-xl px-3 h-10" style="background:var(--bg)">${I('search', 'ic-s mut')}<input id="xfq" oninput="xFwList()" placeholder="Search chats" class="flex-1 text-sm" autocomplete="off"></div></div><div id="xfl"></div>`,
    '<button id="xfSend" onclick="xFwSend()" class="w-full accbg text-white rounded-xl py-2.5 text-sm font-medium opacity-50">Send</button>');
  xFwList();
}
function xFwList() {
  if (!XFW) return; const qv = ($('xfq').value || '').toLowerCase();
  $('xfl').innerHTML = chats.filter(c => c.n.toLowerCase().includes(qv) && !c.blockedByMe).map(c => `<div class="row flex items-center gap-3 px-4 py-2.5 cursor-pointer" data-id="${esc(c.id)}" onclick="xFwTog(this.dataset.id)">${avatar(c, 'w-11 h-11')}<div class="flex-1 min-w-0 font-medium truncate">${emojify(esc(c.n))}</div><span class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${XFW.sel.has(c.id) ? 'accbg text-white border-transparent' : 'bd'}">${XFW.sel.has(c.id) ? I('check', 'ic-xs') : ''}</span></div>`).join('') || '<p class="text-center mut text-sm mt-8">No chats</p>';
  const b = $('xfSend'); b.textContent = XFW.sel.size ? `Send to ${XFW.sel.size}` : 'Send'; b.style.opacity = XFW.sel.size ? 1 : .5;
}
function xFwTog(id) { XFW.sel.has(id) ? XFW.sel.delete(id) : XFW.sel.add(id); xFwList(); }
function xFwSend() { if (!XFW || !XFW.sel.size) return; XFW.sel.forEach(id => xSend(Object.assign({ chat_id: id }, XFW.payload))); toast('Forwarded'); xOvClose(); }

/* ---------- chat menu: mute, archive, block, report ---------- */
function chatMenu(e) {
  e.stopPropagation(); const direct = !cur.grp && cur.peer;
  showCtx([['pin', cur.pin ? 'Unpin chat' : 'Pin chat', 'togglePin()'], [cur.muted ? 'bell' : 'bell-off', cur.muted ? 'Unmute notifications' : 'Mute notifications', 'xToggleMute()'],
    ['archive', cur.archived ? 'Unarchive chat' : 'Archive chat', 'xToggleArchive()'], ['folder', 'Move to folder', 'moveFolder()'],
    ...(cur.grp ? [['users', 'Group info', 'openGroupInfo()'], ['logout', 'Leave group', 'leaveGroup()', true]] : []),
    ...(direct ? [['ban', cur.blockedByMe ? 'Unblock' : 'Block', cur.blockedByMe ? 'xUnblock()' : 'xBlock()', !cur.blockedByMe], ['flag', 'Report', 'xReport(cur.peer,cur.id,null)', true]] : []),
    ['eraser', 'Clear chat', 'clearChat()', true]], innerWidth, 60);
}
function xToggleMute() { cur.muted = !cur.muted; api('/chats/' + cur.id, { method: 'PATCH', body: { muted: cur.muted } }).catch(console.error); renderList(); toast(cur.muted ? 'Notifications muted' : 'Notifications on'); }
function xToggleArchive() {
  cur.archived = !cur.archived; api('/extras/chat/' + cur.id, { method: 'PATCH', body: { archived: cur.archived } }).catch(console.error);
  toast(cur.archived ? 'Chat archived' : 'Chat unarchived'); renderTabs(); renderList(); if (cur.archived) back();
}
async function xBlock() {
  if (!confirm(`Block ${cur.n}? They won't be able to send you messages.`)) return;
  try { await api('/extras/block/' + cur.peer, { method: 'PUT' }); cur.blockedByMe = true; xComposerState(); renderList(); toast('Contact blocked'); } catch (e) { toast(e.message); }
}
async function xUnblock() { if (cur && cur.peer) await xUnblockId(cur.peer); }
async function xUnblockId(id) {
  try { await api('/extras/block/' + id, { method: 'DELETE' }); await xMeta(); if (cur) xComposerState(); renderList(); toast('Unblocked'); if ($('xov').style.display !== 'none') xBlockedList(); } catch (e) { toast(e.message); }
}
async function xBlockedList() {
  await xMeta();
  xOv('Blocked contacts', XM.blocked.length ? XM.blocked.map(b => `<div class="flex items-center gap-3 px-4 py-3"><div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(b.name)}</div><div class="text-xs mut">${esc(b.phone)}</div></div><button data-id="${esc(b.id)}" onclick="xUnblockId(this.dataset.id)" class="xbtn">Unblock</button></div>`).join('') : '<p class="text-center mut text-sm mt-10">You have not blocked anyone.</p>');
}
let XRP = null;
function xReportMsg(i) { const m = cur.msgs[i]; xReport(m.sid, cur.id, m.id); }
function xReport(userId, chatId, msgId) {
  if (!userId) return; XRP = { userId, chatId, msgId };
  xOv('Report', `<div class="p-4"><p class="text-sm mut mb-3">Reports are reviewed by the LIBRA team. The other person is not told.</p>${['Spam', 'Harassment or bullying', 'Scam or fraud', 'Inappropriate content', 'Other'].map((r, i) => `<label class="flex items-center gap-3 py-2 text-sm"><input type="radio" name="xrr" value="${esc(r)}" ${i === 0 ? 'checked' : ''}> ${r}</label>`).join('')}<textarea id="xrd" rows="3" maxlength="500" placeholder="Details (optional)" class="w-full border bd rounded-lg px-3 py-2 text-sm mt-3"></textarea><label class="flex items-center gap-3 py-2 text-sm mt-1"><input type="checkbox" id="xrb"> Also block this contact</label></div>`,
    '<button onclick="xReportSend()" class="w-full accbg text-white rounded-xl py-2.5 text-sm font-medium">Send report</button>');
}
async function xReportSend() {
  const r = document.querySelector('input[name=xrr]:checked'); if (!r || !XRP) return;
  try {
    await api('/extras/report', { method: 'POST', body: { user_id: XRP.userId, chat_id: XRP.chatId, message_id: XRP.msgId, reason: r.value, details: $('xrd').value } });
    if ($('xrb').checked) await api('/extras/block/' + XRP.userId, { method: 'PUT' }).catch(() => { });
    xOvClose(); await xMeta(); if (cur) xComposerState(); renderList(); toast('Report sent. Thank you.');
  } catch (e) { toast(e.message); }
}

/* ---------- settings: photo, blocked list, delete account ---------- */
$('prAv').style.cursor = 'pointer'; $('prAv').title = 'Change profile photo'; $('prAv').onclick = () => $('xAv').click();
$('instBtn').insertAdjacentHTML('beforebegin', `<button onclick="xBlockedList()" class="mt-6 w-full border bd rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">${I('ban', 'ic-s')} Blocked contacts</button>`);
document.querySelector('#set button[onclick="logout()"]').insertAdjacentHTML('afterend', `<button onclick="xDeleteAccount()" class="mt-2 w-full rounded-xl py-2.5 text-sm text-red-500 flex items-center justify-center gap-2">${I('trash', 'ic-s')} Delete my account</button>`);
async function xDeleteAccount() {
  if (!confirm('Delete your LIBRA account? Your profile, statuses and group memberships are removed. This cannot be undone.')) return;
  if ((prompt('Type DELETE to confirm') || '').trim() !== 'DELETE') return toast('Account not deleted');
  try { await api('/extras/me', { method: 'DELETE', body: { confirm: 'DELETE' } }); ls('libra_token', null); location.reload(); } catch (e) { toast(e.message); }
}

/* ---------- group photo ---------- */
const _openGroupInfoV1 = openGroupInfo;
openGroupInfo = async function () {
  await _openGroupInfoV1();
  if (!cur || !cur.grp || !$('gmNm')) return;       // only admins see the rename box
  $('pnB').insertAdjacentHTML('afterbegin', `<div class="flex items-center gap-3 mb-4">${avatar(cur, 'w-16 h-16')}<button onclick="$('xGAv').click()" class="xbtn" style="margin-left:0">Change group photo</button></div>`);
};
async function xSetGroupPhoto(el) {
  const f = el.files[0]; el.value = ''; if (!f || !cur) return;
  try { const u = await xUpload(new File([await xCrop(f, 256)], 'group.jpg', { type: 'image/jpeg' })); await api('/extras/group/' + cur.id, { method: 'PATCH', body: { avatar_url: u.url } }); toast('Group photo updated'); }
  catch (e) { toast(e.message); }
}

/* ---------- status viewer: pause, react, save, forward, viewers, delete ---------- */
let stPaused = false, stRemain = 5000, stT0 = 0, stHold = null, stHeld = false;
$('sv').innerHTML = `<div id="svBars" class="flex gap-1 px-3 pt-3"></div>
<div class="flex items-center gap-1 px-3 py-3"><div id="svAv" class="w-9 h-9 rounded-full flex items-center justify-center font-semibold bg-white/20 mr-2"></div><div class="flex-1 min-w-0"><div id="svN" class="font-medium text-sm truncate"></div><div id="svT" class="text-xs opacity-80"></div></div>
<button id="svPause" onclick="event.stopPropagation();xStPause(!stPaused)" class="ib text-white" title="Pause"></button>
<button onclick="event.stopPropagation();xStMenu(event)" class="ib text-white" title="More">${I('more', 'ic-l')}</button>
<button onclick="event.stopPropagation();closeSt()" class="ib text-white" title="Close">${I('x', 'ic-l')}</button></div>
<div id="svTx" class="flex-1 flex items-center justify-center text-center text-2xl md:text-4xl font-semibold px-8 min-h-0 select-none"></div>
<div id="svRp" class="p-3 max-w-xl w-full mx-auto" onclick="event.stopPropagation()"><div class="flex justify-center gap-4 text-3xl mb-3">${['❤️', '😂', '😮', '😢', '🙏', '👍'].map(e => `<button class="emj" onclick="xStReact(this.textContent)">${e}</button>`).join('')}</div>
<input style="color:#fff" onfocus="xStPause(true)" onblur="xStPause(false)" onkeydown="stReply(event)" placeholder="Reply…" class="w-full rounded-full bg-white/20 px-4 py-2.5 text-sm"></div>
<div id="svOwn" class="p-3 text-center" style="display:none" onclick="event.stopPropagation()"><button onclick="xStViewers()" class="text-white inline-flex items-center gap-2 text-sm">${I('eye')}<span id="svCnt">0</span> views</button></div>`;
const svTxEl = $('svTx');
svTxEl.addEventListener('pointerdown', () => { stHeld = false; clearTimeout(stHold); stHold = setTimeout(() => { stHeld = true; xStPause(true); }, 220); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => svTxEl.addEventListener(ev, () => { clearTimeout(stHold); if (stHeld) { xStPause(false); setTimeout(() => { stHeld = false; }, 120); } }));

function openSt(id) {
  sv = id === 'me' ? { id: 'me', n: 'My status', items: mine } : sts.find(x => x.id === id); if (!sv || !sv.items.length) return;
  si = 0; if (id !== 'me') { sv.seen = true; renderList(); }
  $('svRp').style.display = id === 'me' ? 'none' : 'block'; $('svOwn').style.display = id === 'me' ? 'block' : 'none';
  $('sv').style.display = 'flex'; showSt();
}
function showSt() {
  clearTimeout(stm); const it = sv.items[si]; stPaused = false; stRemain = 5000;
  if (it.sid && sv.id !== 'me') viewSt(it.sid);
  $('sv').style.background = it.bg; $('svAv').textContent = ini(sv.n); $('svN').textContent = sv.n; $('svT').textContent = it.t;
  $('svTx').innerHTML = it.img ? `<img src="${esc(xU(it.img))}" class="max-h-full max-w-full object-contain pointer-events-none" alt="">` : `<span>${rich(it.tx)}</span>`;
  $('svBars').innerHTML = sv.items.map((_, i) => `<div class="flex-1 h-1 rounded bg-white/30 overflow-hidden"><div class="h-full bg-white" ${i === si ? 'id="act"' : ''} style="width:${i < si ? 100 : 0}%"></div></div>`).join('');
  $('svPause').innerHTML = I('pause', 'ic-l', 1);
  if (sv.id === 'me' && it.sid) api(`/extras/status/${it.sid}/viewers`).then(v => { $('svCnt').textContent = v.length; }).catch(() => { $('svCnt').textContent = '0'; });
  requestAnimationFrame(() => requestAnimationFrame(() => { const e = $('act'); if (e) { e.style.transition = `width ${stRemain}ms linear`; e.style.width = '100%'; } }));
  stT0 = Date.now(); stm = setTimeout(nextSt, stRemain);
}
function xStPause(on) {
  if (!sv || stPaused === on || $('sv').style.display === 'none') return; const e = $('act');
  if (on) {
    clearTimeout(stm); stRemain = Math.max(300, stRemain - (Date.now() - stT0));
    if (e) { const w = e.getBoundingClientRect().width, p = e.parentElement.getBoundingClientRect().width; e.style.transition = 'none'; e.style.width = (p > 0 ? w / p * 100 : 50) + '%'; }
    stPaused = true;
  } else {
    stPaused = false;
    if (e) { void e.offsetWidth; e.style.transition = `width ${stRemain}ms linear`; e.style.width = '100%'; }
    stT0 = Date.now(); stm = setTimeout(nextSt, stRemain);
  }
  $('svPause').innerHTML = I(on ? 'play' : 'pause', 'ic-l', 1);
}
function tapSt(e) {
  if (stHeld) { stHeld = false; return; }
  if (e.target.closest && e.target.closest('button,input')) return;
  if (stPaused) { xStPause(false); return; }
  if (e.clientX < innerWidth / 3) { if (si > 0) { si--; showSt(); } } else nextSt();
}
function stReply(e) {
  if (e.key !== 'Enter') return; const t = e.target.value.trim(), c = chats.find(c => c.peer === sv.id); if (!t || !c) return;
  xSend({ chat_id: c.id, body: '↩ Status: ' + (sv.items[si].tx || 'photo') + '\n' + t }); e.target.value = ''; e.target.blur(); toast('Reply sent');
}
function xStReact(emoji) {
  const c = chats.find(c => c.peer === sv.id); if (!c) return;
  xSend({ chat_id: c.id, body: '↩ Status: ' + (sv.items[si].tx || 'photo') + '\n' + emoji }); toast('Reaction sent');
}
function xStMenu(ev) {
  xStPause(true); const r = ev.currentTarget.getBoundingClientRect(), own = sv.id === 'me';
  showCtx([['download', 'Save', 'xStSave()'], ['forward', 'Forward', 'xStForward()'], ...(own ? [['trash', 'Delete this status', 'xStDelete()', true]] : [])], Math.max(8, r.right - 190), r.bottom + 4);
}
function xDownload(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
function xTextStatusPng(it) {
  return new Promise(res => {
    const c = document.createElement('canvas'); c.width = 720; c.height = 1280; const g = c.getContext('2d');
    g.fillStyle = it.bg || '#6366f1'; g.fillRect(0, 0, 720, 1280); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 52px Montserrat, "Noto Color Emoji", sans-serif';
    const lines = []; let line = '';
    String(it.tx || '').split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 600 && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
    const lh = 72, y0 = 640 - (lines.length - 1) * lh / 2; lines.forEach((l, i) => g.fillText(l, 360, y0 + i * lh)); c.toBlob(res, 'image/png');
  });
}
async function xStSave() {
  const it = sv.items[si];
  try {
    if (it.img) { const b = await (await fetch(xU(it.img))).blob(); xDownload(b, 'libra-status.' + ((b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'))); }
    else xDownload(await xTextStatusPng(it), 'libra-status.png');
    toast('Saved to your downloads');
  } catch (e) { toast('Could not save this status'); }
}
function xStForward() {
  const it = sv.items[si];
  xForwardPicker(it.img ? { kind: 'image', media_url: it.img, media_meta: { name: 'status.jpg', fwd: true } } : { kind: 'text', body: it.tx || '', media_meta: { fwd: true } });
}
async function xStDelete() {
  const it = sv.items[si]; if (!it.sid || !confirm('Delete this status?')) return;
  try { await api('/extras/status/' + it.sid, { method: 'DELETE' }); closeSt(); await loadStatuses(); toast('Status deleted'); } catch (e) { toast(e.message); }
}
async function xStViewers() {
  const it = sv.items[si]; xStPause(true); xOv('Viewed by', '<p class="text-center mut text-sm mt-10">Loading…</p>');
  try { const v = await api(`/extras/status/${it.sid}/viewers`); $('xovB').innerHTML = v.length ? v.map(x => `<div class="flex items-center gap-3 px-4 py-3"><div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold" style="background:${col(x.id)}">${esc(ini(x.name))}</div><div class="flex-1 min-w-0"><div class="font-medium truncate">${esc(x.name)}</div><div class="text-xs mut">${ago(x.viewed_at)}</div></div></div>`).join('') : '<p class="text-center mut text-sm mt-10 px-6">No views yet. People who hide read receipts are not listed.</p>'; }
  catch (e) { $('xovB').textContent = e.message; }
}
