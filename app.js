'use strict';
/**
 * ============================================================
 * SIM MA Suryah Khairuddin Merlung — Frontend (JavaScript.html)
 * Navigasi instan (render lokal), data via fetch ke API Apps Script,
 * tanpa window.location / ?page= (aman untuk iframe Blogger).
 * ============================================================
 */

const S = { cfg: {}, berita: [], peng: [], token: null, user: null, mode: 'public', page: 'beranda', adm: 'dashboard',
  cache: {}, charts: {}, names: [], loginAdmin: false, bq: '', bk: '', k: { table: 'berita', q: '', st: '' }, uq: '', up: '', mq: '' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = t => esc(t).split(/\n{2,}/).filter(Boolean).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
const ic = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
const fmtD = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); };
const fmtDT = iso => { if (!iso) return '-'; const d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const img = (id, w = 1000) => id ? `https:\/\/lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${w}` : '';
const safeUrl = u => /^https?:\x2f\x2f/i.test(u || '') ? u : '';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  sget: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  sset: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }
};
let _debounce; const debounce = (fn, ms = 250) => (...a) => { clearTimeout(_debounce); _debounce = setTimeout(() => fn(...a), ms); };
const waLink = n => { let d = String(n || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return d ? 'https:\/\/wa.me\/' + d : ''; };
const ROLES = { guru: 'Guru', wali_kelas: 'Wali Kelas', bk: 'Guru BK', tu: 'Staf TU', kepala: 'Kepala Madrasah', bendahara: 'Bendahara', pustakawan: 'Pustakawan', siswa: 'Siswa', super_admin: 'Super Admin' };
const KATEGORI = ['Umum', 'Akademik', 'Prestasi', 'Keagamaan', 'Kesiswaan', 'Ekstrakurikuler', 'Kegiatan Guru', 'Sarana Prasarana'];
const STATUS_BADGE = { 'Draft': 'b-gray', 'Menunggu Persetujuan': 'b-warn', 'Dipublikasikan': 'b-ok', 'Ditolak': 'b-bad', 'Diarsipkan': 'b-info' };
const skeleton = (n = 3) => `<div class="grid g3">${'<div class="skeleton"></div>'.repeat(n)}</div>`;

function applyTheme() { document.documentElement.setAttribute('data-theme', store.get('theme') === 'dark' ? 'dark' : 'light'); }
function toggleTheme() {
  const nx = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nx); store.set('theme', nx);
  Object.values(S.charts).forEach(c => { try { c.destroy(); } catch (e) {} }); S.charts = {};
  if (S.mode === 'admin' && S.adm === 'dashboard') drawDashboard(S.cache.dash);
}

const RETRY_OK = ['bundle', 'beritaDetail', 'galeri', 'unduhan', 'karya', 'karyaDetail', 'loginNames', 'ppdbInfo'];
async function run(fn, ...args) {
  const cfg = window.APP_CONFIG || {}, url = cfg.API_URL;
  if (!url || /GANTI_DENGAN/.test(url)) throw new Error('Alamat API belum diisi. Buka berkas config.js lalu isi API_URL dengan alamat Web App Apps Script.');
  const pubCall = fn === 'apiPublic';
  const body = pubCall ? { t: 'pub', a: args[0], p: args[1] || {} } : { t: 'api', k: args[0], a: args[1], p: args[2] || {} };
  const boleh = pubCall && RETRY_OK.includes(args[0]);
  let galat;
  for (let i = 0; i < (boleh ? 2 : 1); i++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 90000);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal });
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (e) { throw new Error('Jawaban server tidak dapat dibaca. Pastikan alamat API benar dan Web App di-deploy dengan akses Anyone.'); }
    } catch (e) {
      galat = e;
      if (e.name === 'AbortError') { galat = new Error('Server tidak merespons. Coba lagi sebentar lagi.'); break; }
      if (/tidak dapat dibaca/.test(e.message)) break;
      if (i === 0 && boleh) await new Promise(r => setTimeout(r, 900));
    } finally { clearTimeout(timer); }
  }
  throw new Error(galat && /Failed to fetch|NetworkError|Load failed/i.test(galat.message) ? 'Tidak dapat terhubung ke server. Periksa koneksi internet.' : (galat ? galat.message : 'Gagal terhubung ke server.'));
}
async function pub(action, p) {
  try { const r = await run('apiPublic', action, p || {}); if (!r.success) { toast('Gagal', r.message, 'bad'); return; } return r.data == null ? true : r.data; }
  catch (e) { toast('Error', e.message, 'bad'); }
}
async function api(action, p, quiet) {
  try {
    const r = await run('api', S.token, action, p || {});
    if (!r.success) {
      if (r.code === 'AUTH') { if (quiet) { S.token = null; S.user = null; store.sset('sim_t', null); } else forceLogout(); } else if (!quiet) toast('Gagal', r.message, 'bad');
      return;
    }
    return r.data == null ? true : r.data;
  } catch (e) { if (!quiet) toast('Error', e.message, 'bad'); }
}
function busy(btn, on, txt) {
  if (!btn) return;
  if (on) { btn._h = btn.innerHTML; btn.innerHTML = `<span class="spin spin-sm"></span> ${txt || 'Memproses…'}`; btn.disabled = true; }
  else { btn.innerHTML = btn._h || btn.innerHTML; btn.disabled = false; }
}

function toast(title, msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast t-' + type; el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4300);
}
let modalLock = false;
function modal({ title, body, foot = '', wide = false, lock = false }) {
  modalLock = lock;
  $('#modalRoot').innerHTML = `<div class="overlay" ${lock ? '' : 'onclick="if(event.target===this)closeModal()"'}>
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mTitle">
      <div class="m-head"><h2 id="mTitle" style="font-size:1.1rem">${esc(title)}</h2>${lock ? '' : `<button class="icon-btn" aria-label="Tutup" onclick="closeModal()">${ic('close')}</button>`}</div>
      <div class="m-body">${body}</div>${foot ? `<div class="m-foot">${foot}</div>` : ''}</div></div>`;
  document.body.classList.add('noscroll');
  const f = $('#modalRoot').querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus();
}
function closeModal() { $('#modalRoot').innerHTML = ''; document.body.classList.remove('noscroll'); modalLock = false; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modalLock && $('#modalRoot').innerHTML) closeModal(); });
function confirmBox(msg, { ok = 'Ya, lanjutkan', danger = false, type = '' } = {}) {
  return new Promise(res => {
    modal({ title: 'Konfirmasi', body: `<p>${esc(msg)}</p>${type ? `<label class="label" for="cfT">Ketik <b>${esc(type)}</b> untuk melanjutkan</label><input id="cfT" class="input" autocomplete="off">` : ''}`,
      foot: `<button class="btn btn-outline" id="cfNo">Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cfYes">${esc(ok)}</button>` });
    $('#cfNo').onclick = () => { closeModal(); res(false); };
    $('#cfYes').onclick = () => { if (type && $('#cfT').value.trim() !== type) { toast('Periksa', 'Teks konfirmasi belum sesuai.', 'warn'); return; } closeModal(); res(true); };
  });
}
function promptBox(title, label) {
  return new Promise(res => {
    modal({ title, body: `<label class="label" for="pbT">${esc(label)} <span class="req">*</span></label><textarea id="pbT" class="input" maxlength="300"></textarea>`,
      foot: `<button class="btn btn-outline" id="pbNo">Batal</button><button class="btn btn-primary" id="pbYes">Kirim</button>` });
    $('#pbNo').onclick = () => { closeModal(); res(null); };
    $('#pbYes').onclick = () => { const v = $('#pbT').value.trim(); if (!v) { toast('Periksa', label + ' wajib diisi.', 'warn'); return; } closeModal(); res(v); };
  });
}
function togglePw(id, btn) { const i = $('#' + id); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; btn.innerHTML = ic(show ? 'visibility_off' : 'visibility'); }
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function csvDownload(name, rows) {
  const cell = v => { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  download(name, new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}
function fileToImage(file, max) {
  return new Promise((res, rej) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Pilih gambar JPG, PNG, atau WebP.'));
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('Gagal membaca berkas.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error('Gambar tidak valid.'));
      im.onload = () => {
        const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const mime = file.type === 'png' || file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        res({ data: c.toDataURL(mime, .82).split(',')[1], mime });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function pickImage(inputEl, targetId, max, privat) {
  const f = inputEl.files[0]; if (!f) return;
  try {
    toast('Mengunggah', 'Mohon tunggu…', 'warn');
    const im = await fileToImage(f, max || 1600);
    const d = await api('upload', { data: im.data, mime: im.mime, name: f.name, privat: !!privat });
    if (d === undefined) return;
    $('#' + targetId).value = d.id;
    $('#' + targetId + '_p').innerHTML = privat ? '<span class="badge b-ok">Tersimpan (privat)</span>' : `<img class="img-prev" alt="Pratinjau" src="${img(d.id, 400)}">`;
    toast('Berhasil', 'Gambar diunggah.');
  } catch (e) { toast('Gagal', e.message, 'bad'); }
  inputEl.value = '';
}
const imgField = (id, val, max, privat) => `<input type="hidden" id="${id}" value="${esc(val || '')}"><div id="${id}_p">${val ? (privat ? '<span class="badge b-ok">Tersimpan (privat)</span>' : `<img class="img-prev" alt="Pratinjau" src="${img(val, 400)}">`) : ''}</div>
  <input type="file" accept="image/png,image/jpeg,image/webp" class="input" style="margin-top:.4rem" onchange="pickImage(this,'${id}',${max || 1600},${privat ? 'true' : 'false'})" aria-label="Pilih gambar">`;

const LIB = { chart: 'https:\/\/cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js', xlsx: 'https:\/\/cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js' };
const _libs = {};
function loadLib(u) {
  return _libs[u] || (_libs[u] = new Promise((res, rej) => {
    const el = document.createElement('script'); el.src = u; el.onload = res;
    el.onerror = () => { delete _libs[u]; rej(new Error('Pustaka tambahan gagal dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(el);
  }));
}
async function startApp() {
  const bt = $('#boot'); if (bt) bt.innerHTML = '<div class="spin"></div><p class="muted">Memuat portal madrasah…</p>';
  try {
    applyTheme();
    const r = await run('apiPublic', 'bundle', {});
    if (!r || !r.success) throw new Error((r && r.message) || 'Tidak ada respons dari server.');
    S.cfg = r.data.cfg; S.berita = r.data.berita; S.peng = r.data.pengumuman; S.loadedAt = Date.now();
    showPublic(); const rt = parseHash(); go(rt[0], rt[1], true);
  } catch (e) { window.__bootErr(e.message); return; }
  const b = $('#boot'); if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 300); }
  const t = store.sget('sim_t');
  if (t) { S.token = t; const me = await api('me', {}, true); if (me) { S.user = me.user; updatePanelBtn(); } else { S.token = null; store.sset('sim_t', null); } }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp); else startApp();
function setBrand() {
  const c = S.cfg; document.title = c.nama_madrasah || 'MA Suryah Khairuddin Merlung';
  $$('[data-brand]').forEach(e => e.textContent = c.nama_madrasah || 'MA Suryah Khairuddin Merlung');
  $$('[data-logo]').forEach(e => { if (c.logo_id) { e.src = img(c.logo_id, 160); e.hidden = false; } else e.hidden = true; });
  $$('[data-logo-fb]').forEach(e => e.hidden = !!c.logo_id);
}
function updatePanelBtn() {
  const b = $('#btnPanel'); if (!b) return;
  b.innerHTML = S.user ? `${ic('dashboard')}<span class="hide-sm">Panel Saya</span>` : `${ic('login')}<span class="hide-sm">Masuk</span>`;
  b.onclick = () => S.user ? enterAdmin() : go('login');
}
function showPublic() { S.mode = 'public'; $('#adm').hidden = true; $('#pub').hidden = false; setBrand(); renderTop(); renderFoot(); updatePanelBtn(); }

const PUB = {};
const PUB_PATH = { beranda: '', profil: 'profil', berita: 'berita', pengumuman: 'pengumuman', galeri: 'galeri', karya: 'karya', unduhan: 'unduhan', ppdb: 'ppdb', kontak: 'kontak', login: 'login' };
const PUB_TITLE = { beranda: '', profil: 'Profil', berita: 'Berita', pengumuman: 'Pengumuman', galeri: 'Galeri', karya: 'Karya Siswa', unduhan: 'Unduhan', ppdb: 'PPDB Online', kontak: 'Kontak', login: 'Masuk', 'berita-detail': 'Berita', 'karya-detail': 'Karya Siswa' };
function hashFor(page, arg) {
  if (page === 'berita-detail') return '#/berita/' + arg;
  if (page === 'karya-detail') return '#/karya/' + arg;
  return '#/' + (PUB_PATH[page] || '');
}
function parseHash() {
  const m = location.hash.replace(/^#\/?/, '').split('/'), a = m[0] || '', b = (m[1] || '').replace(/[^a-z0-9-]/gi, '');
  if (a === 'berita' && b) return ['berita-detail', b];
  if (a === 'karya' && b) return ['karya-detail', b];
  const page = Object.keys(PUB_PATH).find(k => PUB_PATH[k] === a && k !== 'beranda');
  return [page || 'beranda', ''];
}
function go(page, arg, dariRute) {
  S.mode = 'public'; S.page = page; S.routeArg = arg || ''; $('#pubNav').classList.remove('open'); renderNav();
  (PUB[page] || PUB.beranda)(arg); window.scrollTo(0, 0);
  const nm = S.cfg.nama_madrasah || 'MA Suryah Khairuddin Merlung', t = PUB_TITLE[page];
  document.title = t ? t + ' | ' + nm : nm;
  if (!dariRute) { const h = hashFor(page, arg); if (location.hash !== h && !(h === '#/' && !location.hash)) history.pushState(null, '', h); }
  if (Date.now() - (S.loadedAt || 0) > 120000) refreshPublic();
}
function route() {
  if (S.mode !== 'public' || !S.cfg || !S.cfg.nama_madrasah) return;
  const [p, a] = parseHash();
  if (p === S.page && (p.indexOf('-detail') < 0 || a === S.routeArg)) return;
  go(p, a, true);
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
function renderNav() {
  const items = [['beranda', 'Beranda'], ['profil', 'Profil'], ['berita', 'Berita'], ['pengumuman', 'Pengumuman'], ['galeri', 'Galeri'], ['karya', 'Karya Siswa'], ['unduhan', 'Unduhan'], ['ppdb', 'PPDB'], ['kontak', 'Kontak']]
    .filter(([k]) => k !== 'ppdb' || S.cfg.ppdb_aktif === 'Ya');
  const cur = S.page === 'berita-detail' ? 'berita' : S.page === 'karya-detail' ? 'karya' : S.page;
  $('#pubNav').innerHTML = items.map(([k, l]) => `<a href="#/${PUB_PATH[k]}" class="nl ${cur === k ? 'active' : ''}" onclick="go('${k}');return false">${l}</a>`).join('');
}
function renderTop() {
  const c = S.cfg, p = [];
  if (c.telp) p.push(`${ic('call')} ${esc(c.telp)}`); if (c.email) p.push(`${ic('mail')} ${esc(c.email)}`);
  p.push(`${ic('location_on')} Merlung, Tanjung Jabung Barat`);
  $('#topInfo').innerHTML = p.map(x => `<span>${x}</span>`).join('');
}
function socials(light) {
  const c = S.cfg, out = [];
  const wa = waLink(c.wa); if (wa) out.push(`<a class="btn btn-sm ${light ? 'btn-light' : 'btn-outline'}" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (c.email) out.push(`<a class="btn btn-sm ${light ? 'btn-light' : 'btn-outline'}" href="mailto:${esc(c.email)}">Email</a>`);
  [['ig', 'Instagram'], ['fb', 'Facebook'], ['tiktok', 'TikTok'], ['yt', 'YouTube']].forEach(([k, l]) => {
    const u = safeUrl(c[k]); if (u) out.push(`<a class="btn btn-sm ${light ? 'btn-light' : 'btn-outline'}" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`);
  });
  return out.join('');
}
function renderFoot() {
  const c = S.cfg;
  $('#pubFoot').innerHTML = `<div class="wrap section"><div class="grid g4">
    <div><h4>${esc(c.nama_madrasah)}</h4><p style="font-size:.85rem">${esc(c.nama_yayasan)}<br>NPSN ${esc(c.npsn)} · NSM ${esc(c.nsm)}</p></div>
    <div><h4>Tautan</h4><p style="font-size:.88rem;line-height:2"><a href="javascript:void(0)" onclick="go('profil')">Profil Madrasah</a><br><a href="javascript:void(0)" onclick="go('berita')">Berita</a><br><a href="javascript:void(0)" onclick="go('pengumuman')">Pengumuman</a><br><a href="javascript:void(0)" onclick="go('galeri')">Galeri</a><br><a href="javascript:void(0)" onclick="go('karya')">Karya Siswa</a><br><a href="javascript:void(0)" onclick="go('unduhan')">Unduhan</a><br><a href="javascript:void(0)" onclick="go('kontak')">Kontak</a></p></div>
    <div><h4>Alamat</h4><p style="font-size:.85rem">${esc(c.alamat)}</p>${c.jam_layanan ? `<p style="font-size:.85rem">${esc(c.jam_layanan)}</p>` : ''}</div>
    <div><h4>Terhubung</h4><div class="row">${socials(true) || '<span style="font-size:.85rem">Segera hadir</span>'}</div></div>
  </div><p class="center" style="font-size:.78rem;margin-top:2rem;opacity:.8">© ${new Date().getFullYear()} ${esc(c.nama_madrasah)}. Hak cipta dilindungi.</p></div>`;
}
const beritaCard = b => `<article class="card card-hover" style="overflow:hidden;cursor:pointer" tabindex="0" role="link" aria-label="${esc(b.judul)}"
  onclick="go('berita-detail','${esc(b.slug)}')" onkeydown="if(event.key==='Enter')go('berita-detail','${esc(b.slug)}')">
  ${b.gambar_id ? photo(b.gambar_id, 700) : `<div class="thumb-ph">${ic('newspaper')}</div>`}
  <div class="pad"><div class="meta"><span class="badge b-sage">${esc(b.kategori)}</span><span>${fmtD(b.tgl_terbit)}</span></div>
  <h3 class="line2" style="margin:.5rem 0">${esc(b.judul)}</h3><p class="muted line3" style="font-size:.85rem">${esc(b.ringkasan)}</p></div></article>`;
const emptyBox = (icon, t) => `<div class="empty">${ic(icon)}${esc(t)}</div>`;
const anncCard = a => `<div class="card pad annc ${a.prioritas === 'Penting' ? 'penting' : ''}"><div class="meta"><span class="badge ${a.prioritas === 'Penting' ? 'b-bad' : 'b-sage'}">${a.prioritas === 'Penting' ? 'Penting' : esc(a.kategori)}</span><span>${fmtD(a.tgl_terbit)}</span></div>
  <h3 style="margin:.4rem 0">${esc(a.judul)}</h3><div class="muted prose" style="font-size:.88rem">${para(a.isi)}</div></div>`;

PUB.beranda = () => {
  const c = S.cfg;
  const bg = c.hero_bg_id ? `style="background-image:linear-gradient(180deg,rgba(16,69,47,.78),rgba(16,69,47,.93)),url('${img(c.hero_bg_id, 1600)}')"` : '';
  const stats = [1, 2, 3, 4].filter(i => c['stat_' + i + '_nilai'] && c['stat_' + i + '_label'])
    .map(i => `<div class="stat"><b>${esc(c['stat_' + i + '_nilai'])}</b><span>${esc(c['stat_' + i + '_label'])}</span></div>`).join('');
  $('#pubMain').innerHTML = `
  <section class="hero" ${bg}><div class="wrap"><span class="pill">${esc(c.nama_yayasan)}</span>
    <h1 style="max-width:18ch">${esc(c.hero_title)}</h1>${c.hero_sub ? `<p style="margin-top:1rem">${esc(c.hero_sub)}</p>` : ''}
    <div class="row" style="margin-top:1.5rem">${c.ppdb_aktif === 'Ya' ? `<button class="btn btn-gold" onclick="go('ppdb')">${ic('how_to_reg')} Daftar Siswa Baru</button>` : ''}
    <button class="btn btn-light" onclick="go('profil')">Lihat Profil Madrasah</button></div>${stats ? `<div class="stats">${stats}</div>` : ''}</div></section>
  ${c.sambutan ? `<section class="section"><div class="wrap card pad"><div class="grid g2" style="align-items:center;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))">
    <div class="arch">${c.kepala_foto_id ? `<img alt="Kepala Madrasah" src="${img(c.kepala_foto_id, 600)}">` : ''}</div>
    <div><div class="eyebrow">Sambutan Kepala Madrasah</div><h2 style="margin-bottom:1rem">Assalamu'alaikum Warahmatullahi Wabarakatuh</h2>
    <div class="prose line3" style="max-height:none">${para(c.sambutan.slice(0, 700))}</div>${c.kepala_nama ? `<p><b>${esc(c.kepala_nama)}</b><br><span class="muted" style="font-size:.85rem">Kepala ${esc(c.nama_madrasah)}</span></p>` : ''}</div></div></div></section>` : ''}
  <section class="section ${c.sambutan ? 'alt' : ''}"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">Kabar Madrasah</div><h2>Berita Terkini</h2></div>
    <button class="btn btn-outline btn-sm" onclick="go('berita')">Semua Berita ${ic('arrow_forward')}</button></div>
    ${S.berita.length ? `<div class="grid g3">${S.berita.slice(0, 3).map(beritaCard).join('')}</div>` : emptyBox('newspaper', 'Belum ada berita yang dipublikasikan.')}</div></section>
  <section class="section"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">Informasi Resmi</div><h2>Pengumuman</h2></div>
    <button class="btn btn-outline btn-sm" onclick="go('pengumuman')">Semua Pengumuman</button></div>
    ${S.peng.length ? `<div class="grid g2">${S.peng.slice(0, 4).map(anncCard).join('')}</div>` : emptyBox('campaign', 'Belum ada pengumuman aktif.')}</div></section>
  ${c.ppdb_aktif === 'Ya' ? `<section class="section"><div class="wrap"><div class="hero card pad" style="border-radius:20px;padding:2rem"><h2>Penerimaan Peserta Didik Baru telah dibuka</h2>
    <p style="margin-top:.5rem">Dapatkan informasi persyaratan dan jadwal pendaftaran.</p><button class="btn btn-gold" onclick="go('ppdb')">Informasi PPDB</button></div></div></section>` : ''}`;
};

PUB.profil = () => {
  const c = S.cfg;
  const blk = (t, body) => body ? `<section class="card pad" style="margin-bottom:1.25rem"><h2 style="margin-bottom:.75rem">${t}</h2><div class="prose">${body}</div></section>` : '';
  const misi = c.misi ? `<ol style="padding-left:1.2rem">${c.misi.split('\n').filter(x => x.trim()).map(x => `<li style="margin-bottom:.4rem">${esc(x)}</li>`).join('')}</ol>` : '';
  const any = c.sejarah || c.visi || c.misi || c.tujuan || c.struktur_img_id;
  $('#pubMain').innerHTML = `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">Profil</div><h1>Profil Madrasah</h1></div></section>
  <section class="section"><div class="wrap" style="max-width:880px">
  ${blk('Sejarah', c.sejarah ? para(c.sejarah) : '')}${blk('Visi', c.visi ? para(c.visi) : '')}${blk('Misi', misi)}${blk('Tujuan Pendidikan', c.tujuan ? para(c.tujuan) : '')}
  ${c.struktur_img_id ? `<section class="card pad" style="margin-bottom:1.25rem"><h2 style="margin-bottom:.75rem">Struktur Organisasi</h2><img style="width:100%;border-radius:12px" alt="Bagan struktur organisasi" src="${img(c.struktur_img_id, 1400)}"></section>` : ''}
  ${!any ? emptyBox('info', 'Konten profil belum diisi oleh admin.') : ''}
  <section class="card pad"><h2 style="margin-bottom:.75rem">Identitas Madrasah</h2><table class="tbl"><tbody>
    <tr><td><b>Nama</b></td><td>${esc(c.nama_madrasah)}</td></tr><tr><td><b>Yayasan</b></td><td>${esc(c.nama_yayasan)}</td></tr>
    <tr><td><b>NPSN</b></td><td>${esc(c.npsn)}</td></tr><tr><td><b>NSM</b></td><td>${esc(c.nsm)}</td></tr><tr><td><b>Alamat</b></td><td>${esc(c.alamat)}</td></tr></tbody></table></section></div></section>`;
};

PUB.berita = () => {
  const cats = [...new Set(S.berita.map(b => b.kategori))];
  $('#pubMain').innerHTML = `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">Kabar Madrasah</div><h1>Berita & Kegiatan</h1></div></section>
  <section class="section"><div class="wrap"><div class="toolbar"><input class="input" id="bq" type="search" placeholder="Cari berita…" aria-label="Cari berita" value="${esc(S.bq)}" oninput="S.bq=this.value;drawBerita()">
  <div class="row" role="group" aria-label="Filter kategori"><button class="chip ${S.bk ? '' : 'on'}" onclick="S.bk='';PUB.berita()">Semua</button>${cats.map(k => `<button class="chip ${S.bk === k ? 'on' : ''}" data-cat="${esc(k)}" onclick="S.bk=this.dataset.cat;PUB.berita()">${esc(k)}</button>`).join('')}</div></div>
  <div id="bgrid"></div></div></section>`;
  drawBerita();
};
function drawBerita() {
  const q = S.bq.toLowerCase(), r = S.berita.filter(b => (!S.bk || b.kategori === S.bk) && (!q || (b.judul + ' ' + b.ringkasan).toLowerCase().includes(q)));
  $('#bgrid').innerHTML = r.length ? `<div class="grid g3">${r.map(beritaCard).join('')}</div>` : emptyBox('search_off', 'Berita tidak ditemukan.');
}
PUB['berita-detail'] = async slug => {
  $('#pubMain').innerHTML = `<section class="section"><div class="wrap">${skeleton(1)}</div></section>`;
  const b = await pub('beritaDetail', { slug });
  if (!b) { go('berita'); return; }
  $('#pubMain').innerHTML = `<section class="section"><div class="wrap" style="max-width:820px"><button class="btn btn-ghost btn-sm" onclick="go('berita')">${ic('arrow_back')} Kembali</button>
  <article class="card" style="overflow:hidden;margin-top:1rem">${b.gambar_id ? photo(b.gambar_id, 1200, 'auto') : ''}<div class="pad" style="padding:1.5rem">
  <div class="meta"><span class="badge b-sage">${esc(b.kategori)}</span><span>${fmtD(b.tgl_terbit)}</span><span>Oleh ${esc(b.penulis)}</span></div>
  <h1 style="font-size:1.8rem;margin:.75rem 0 1rem">${esc(b.judul)}</h1><div class="prose">${para(b.isi)}</div></div></article></div></section>`;
};
PUB.pengumuman = () => {
  $('#pubMain').innerHTML = `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">Informasi Resmi</div><h1>Pengumuman</h1></div></section>
  <section class="section"><div class="wrap" style="max-width:900px">${S.peng.length ? `<div class="grid">${S.peng.map(anncCard).join('')}</div>` : emptyBox('campaign', 'Belum ada pengumuman aktif.')}</div></section>`;
};
PUB.ppdb = () => {
  const c = S.cfg, wa = waLink(c.wa);
  $('#pubMain').innerHTML = `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">Tahun Ajaran Baru</div><h1>Penerimaan Peserta Didik Baru</h1></div></section>
  <section class="section"><div class="wrap" style="max-width:860px"><div class="card pad"><div class="prose">${c.ppdb_info ? para(c.ppdb_info) : '<p class="muted">Informasi pendaftaran akan segera diumumkan.</p>'}</div>
  <div class="row"><button class="btn btn-primary" onclick="go('kontak')">${ic('mail')} Hubungi Panitia</button>${wa ? `<a class="btn btn-outline" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
  <p class="hint" style="margin-top:1rem">Formulir pendaftaran online tersedia pada pembaruan berikutnya.</p></div></div></section>`;
};
PUB.kontak = () => {
  const c = S.cfg, q = encodeURIComponent(c.maps_query || c.alamat || '');
  $('#pubMain').innerHTML = `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">Hubungi Kami</div><h1>Kontak & Lokasi</h1></div></section>
  <section class="section"><div class="wrap"><div class="grid g2">
  <div class="card pad"><h2 style="margin-bottom:1rem">Informasi Kontak</h2>
    <p>${ic('location_on')} ${esc(c.alamat)}</p>${c.telp ? `<p>${ic('call')} ${esc(c.telp)}</p>` : ''}${c.email ? `<p>${ic('mail')} ${esc(c.email)}</p>` : ''}${c.jam_layanan ? `<p>${ic('schedule')} ${esc(c.jam_layanan)}</p>` : ''}
    <div class="row" style="margin:1rem 0">${socials(false)}</div>
    <iframe class="map" title="Lokasi madrasah di Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https:\/\/www.google.com/maps?q=${q}&output=embed"></iframe></div>
  <form class="card pad" onsubmit="kirimPesan(event)" novalidate><h2 style="margin-bottom:1rem">Kirim Pesan</h2>
    <div class="field"><label class="label" for="cN">Nama <span class="req">*</span></label><input id="cN" class="input" maxlength="80" autocomplete="name"></div>
    <div class="field"><label class="label" for="cK">Email atau Nomor WhatsApp <span class="req">*</span></label><input id="cK" class="input" maxlength="80"></div>
    <div class="field"><label class="label" for="cS">Subjek</label><input id="cS" class="input" maxlength="120"></div>
    <div class="field"><label class="label" for="cP">Pesan <span class="req">*</span></label><textarea id="cP" class="input" maxlength="2000"></textarea></div>
    <input id="cW" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
    <label class="field row" style="flex-wrap:nowrap;font-size:.82rem"><input type="checkbox" id="cC" style="width:20px;height:20px;flex:none"> Saya setuju data saya diproses untuk menanggapi pesan ini.</label>
    <button class="btn btn-primary" id="cBtn" type="submit">${ic('send')} Kirim Pesan</button></form></div></div></section>`;
};
async function kirimPesan(e) {
  e.preventDefault(); const b = $('#cBtn'); busy(b, true, 'Mengirim…');
  const r = await pub('kirimPesan', { nama: $('#cN').value, kontak: $('#cK').value, subjek: $('#cS').value, pesan: $('#cP').value, website: $('#cW').value, setuju: $('#cC').checked });
  busy(b, false);
  if (r) { toast('Terkirim', 'Pesan Anda sudah kami terima.'); PUB.kontak(); }
}

PUB.login = () => {
  if (S.user) { enterAdmin(); return; }
  S.loginAdmin = false;
  $('#pubMain').innerHTML = `<section class="section"><div class="wrap"><div class="card pad login-card"><h2 style="margin-bottom:.25rem">Masuk Sistem</h2>
  <p class="muted" style="font-size:.88rem">Khusus guru, staf, dan siswa terdaftar.</p>
  <form onsubmit="doLogin(event)" novalidate>
   <div class="field" id="fRole"><label class="label" for="lRole">Peran <span class="req">*</span></label><select id="lRole" class="input" onchange="loadNames(this.value)">
     <option value="">— Pilih peran —</option>${Object.keys(ROLES).filter(k => k !== 'super_admin').map(k => `<option value="${k}">${ROLES[k]}</option>`).join('')}</select></div>
   <div class="field" id="fName"><label class="label" for="lName">Nama <span class="req">*</span></label><input id="lName" class="input" list="nameList" autocomplete="off" placeholder="Ketik untuk mencari nama"><datalist id="nameList"></datalist><div class="hint" id="nameHint" aria-live="polite"></div></div>
   <div class="field" id="fUser" hidden><label class="label" for="lUser">Username Administrator <span class="req">*</span></label><input id="lUser" class="input" autocomplete="username"></div>
   <div class="field"><label class="label" for="lPw">Kata sandi <span class="req">*</span></label><div class="row" style="flex-wrap:nowrap"><input id="lPw" type="password" class="input" autocomplete="current-password">
     <button type="button" class="icon-btn" aria-label="Tampilkan kata sandi" onclick="togglePw('lPw',this)">${ic('visibility')}</button></div></div>
   <button class="btn btn-primary" style="width:100%" id="lBtn" type="submit">${ic('login')} Masuk</button></form>
  <p class="center hint" style="margin-top:1rem"><a href="javascript:void(0)" id="lSwitch" onclick="toggleAdminLogin()">Masuk sebagai Administrator</a></p></div></div></section>`;
};
function toggleAdminLogin() {
  S.loginAdmin = !S.loginAdmin;
  $('#fRole').hidden = $('#fName').hidden = S.loginAdmin; $('#fUser').hidden = !S.loginAdmin;
  $('#lSwitch').textContent = S.loginAdmin ? 'Masuk sebagai pengguna biasa' : 'Masuk sebagai Administrator';
}
async function loadNames(peran) {
  $('#lName').value = ''; $('#nameList').innerHTML = ''; S.names = [];
  const h = $('#nameHint'); h.textContent = '';
  if (!peran) return;
  const d = await pub('loginNames', { peran });
  if (d && d !== true) {
    S.names = d; $('#nameList').innerHTML = d.map(n => `<option value="${esc(n.label)}">`).join('');
    h.textContent = d.length ? d.length + ' akun tersedia. Ketik sebagian nama, lalu pilih dari daftar yang muncul.' : 'Belum ada akun untuk peran ini. Minta Super Admin menambahkannya di menu Pengguna.';
  }
}
async function doLogin(e) {
  e.preventDefault(); const b = $('#lBtn'), pw = $('#lPw').value; let p = { password: pw };
  if (S.loginAdmin) { p.username = $('#lUser').value.trim(); if (!p.username) { toast('Periksa', 'Isi username administrator.', 'warn'); return; } }
  else {
    const val = $('#lName').value.trim().toLowerCase();
    let n = S.names.find(x => x.label.toLowerCase() === val);
    if (!n && val) { const m = S.names.filter(x => x.label.toLowerCase().includes(val)); if (m.length === 1) n = m[0]; }
    if (!n) { toast('Periksa', S.names.length ? 'Pilih nama dari daftar yang muncul: ketik sebagian nama lalu klik pilihannya.' : 'Belum ada akun untuk peran ini. Hubungi Super Admin.', 'warn'); return; }
    p.id = n.id;
  }
  if (!pw) { toast('Periksa', 'Isi kata sandi.', 'warn'); return; }
  busy(b, true, 'Masuk…'); const d = await pub('login', p); busy(b, false);
  if (!d || d === true) return;
  S.token = d.token; S.user = d.user; store.sset('sim_t', d.token); S.cache = {}; S.mods = null; S.refs = null;
  toast('Selamat datang', d.user.nama); enterAdmin(d.wajibGanti);
}
function forceLogout() {
  S.token = null; S.user = null; S.cache = {}; S.mods = null; S.refs = null; store.sset('sim_t', null);
  showPublic(); go('login'); toast('Sesi berakhir', 'Silakan masuk kembali.', 'warn');
}
async function logout() {
  await api('logout', {}, true); S.token = null; S.user = null; S.cache = {}; S.mods = null; S.refs = null; store.sset('sim_t', null);
  closeModal(); showPublic(); go('beranda');
}
function logoutToPublic() { showPublic(); go('beranda'); refreshPublic(); }
const PUB_REFRESH = ['beranda', 'profil', 'berita', 'pengumuman', 'galeri', 'karya', 'unduhan'];
async function refreshPublic() {
  let r = null;
  try { r = await run('apiPublic', 'bundle', {}); } catch (e) { return; }
  if (!r || !r.success) return;
  S.cfg = r.data.cfg; S.berita = r.data.berita; S.peng = r.data.pengumuman; S.loadedAt = Date.now(); S.galeri = null; S.unduhan = null; S.karya = null;
  if (S.mode === 'public') { setBrand(); renderTop(); renderFoot(); renderNav(); if (PUB_REFRESH.includes(S.page)) PUB[S.page](); }
}

const ADM = {};
function enterAdmin(wajib) {
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  S.mode = 'admin'; $('#pub').hidden = true; $('#adm').hidden = false; setBrand();
  $('#userName').textContent = S.user.nama;
  S.mods = S.mods || []; renderMenu(); goA('dashboard'); if (wajib) pwModal(true); loadMods();
}
function toggleSide(on) { $('#side').classList.toggle('open', on); $('#scrim').classList.toggle('open', on); }
function goA(k) {
  S.adm = k; S.navTok = (S.navTok || 0) + 1; toggleSide(false);
  $$('#admNav .sl').forEach(a => a.classList.toggle('active', a.dataset.k === k));
  const t = menuFor(S.user.peran).find(x => x[0] === k); $('#admTitle').textContent = t ? t[2] : 'Panel';
  if (k.startsWith('m:')) modPage(k.slice(2)); else (ADM[k] || ADM.dashboard)();
  window.scrollTo(0, 0);
}
const HOLDERS = { k_berita: '#ktable', k_pengumuman: '#ktable', pesan: '#ptable', users: '#utable', log: '#ltable' };
async function swr(key, action, payload, page, render) {
  const nav = S.navTok, hold = HOLDERS[key] || (key.indexOf('m_') === 0 ? '#mtable' : ''), box = () => (hold && $(hold)) || $('#admMain');
  if (S.cache[key]) render(S.cache[key]); else box().innerHTML = skeleton();
  const d = await api(action, payload);
  if (nav !== S.navTok) return;
  if (d === undefined) {
    if (!S.cache[key] && S.adm === page) box().innerHTML = `<div class="empty">${ic('cloud_off')}Gagal memuat data.<br><button class="btn btn-outline btn-sm" style="margin-top:.75rem" onclick="goA('${page}')">Coba lagi</button></div>`;
    return;
  }
  S.cache[key] = d; if (S.adm === page) render(d);
}
function navGuard() { const nav = S.navTok; return () => nav === S.navTok; }
function openUserMenu() {
  modal({ title: S.user.nama, body: `<p class="muted">${esc(ROLES[S.user.peran] || S.user.peran)} · ${esc(S.user.username)}</p>`,
    foot: `<button class="btn btn-outline" onclick="pwModal(false)">${ic('key')} Ganti Kata Sandi</button><button class="btn btn-danger" onclick="logout()">${ic('logout')} Keluar</button>` });
}
function pwModal(force) {
  modal({ title: force ? 'Buat Kata Sandi Baru' : 'Ganti Kata Sandi', lock: force, body: `${force ? '<p class="muted">Demi keamanan, ganti kata sandi awal Anda sebelum melanjutkan.</p>' : ''}
    <div class="field"><label class="label" for="pw0">Kata sandi saat ini</label><input id="pw0" type="password" class="input" autocomplete="current-password"></div>
    <div class="field"><label class="label" for="pw1">Kata sandi baru</label><input id="pw1" type="password" class="input" autocomplete="new-password"><div class="hint">Minimal 8 karakter, berisi huruf dan angka.</div></div>
    <div class="field"><label class="label" for="pw2">Ulangi kata sandi baru</label><input id="pw2" type="password" class="input" autocomplete="new-password"></div>`,
    foot: `${force ? '<button class="btn btn-ghost" onclick="logout()">Keluar</button>' : '<button class="btn btn-outline" onclick="closeModal()">Batal</button>'}<button class="btn btn-primary" id="pwOk">Simpan</button>` });
  $('#pwOk').onclick = async () => {
    const a = $('#pw0').value, b = $('#pw1').value, c = $('#pw2').value;
    if (b.length < 8 || !/[A-Za-z]/.test(b) || !/\d/.test(b)) { toast('Periksa', 'Kata sandi baru minimal 8 karakter, huruf dan angka.', 'warn'); return; }
    if (b !== c) { toast('Periksa', 'Ulangi kata sandi tidak sama.', 'warn'); return; }
    busy($('#pwOk'), true, 'Menyimpan…'); const d = await api('gantiSandi', { lama: a, baru: b }); busy($('#pwOk'), false);
    if (d !== undefined) { closeModal(); toast('Berhasil', 'Kata sandi diganti.'); }
  };
}

ADM.dashboard = () => swr('dash', 'dashboard', {}, 'dashboard', drawDashboard);
function drawDashboard(d) {
  if (!d) return;
  const kpi = (l, v, cls = '', go2 = '') => `<div class="card kpi ${cls}" ${go2 ? `style="cursor:pointer" onclick="goA('${go2}')"` : ''}><small>${l}</small><b>${v}</b></div>`;
  let h = `<div class="card pad" style="margin-bottom:1.25rem"><h2>Assalamu'alaikum, ${esc(d.nama)}</h2><p class="muted" style="margin:0">${esc(d.peranLabel)} · ${esc(S.cfg.nama_madrasah || '')}</p></div>`;
  if (['guru', 'wali_kelas'].includes(S.user.peran) && !S.user.ref_id) h += `<div class="card pad" style="margin-bottom:1.25rem;border-left:4px solid var(--warn)"><b>Akun belum terhubung dengan data guru.</b><p class="muted" style="margin:.25rem 0 0">Minta Super Admin menekan Hubungkan di menu Pengguna, lalu keluar dan masuk lagi. Tanpa itu absensi, nilai, dan jurnal tidak dapat disimpan.</p></div>`;
  if (d.jadwalHariIni) h += jadwalCard(d.jadwalHariIni);
  if (d.keu) h += keuCards(d.keu);
  if (d.stat) {
    h += `<div class="grid g4" style="margin-bottom:1.25rem">${kpi('Berita Terbit', d.stat.beritaTerbit, '', 'berita')}${kpi('Draf Berita', d.stat.draft, 'info', 'berita')}
      ${kpi('Menunggu Persetujuan', d.stat.menunggu, 'warn', 'berita')}${kpi('Pengumuman Aktif', d.stat.pengumumanAktif, 'gold', 'pengumuman')}${d.stat.ppdbMenunggu !== undefined ? kpi('PPDB Menunggu', d.stat.ppdbMenunggu, 'warn', 'ppdb') + kpi('Karya Ditinjau', d.stat.karyaDiajukan, 'info', 'karya') + (d.stat.suratMenunggu !== undefined && ['super_admin', 'kepala', 'tu'].includes(S.user.peran) ? kpi('Surat Menunggu', d.stat.suratMenunggu, 'warn', 'suratkeluar') : '') : ''}
      ${['super_admin', 'tu'].includes(S.user.peran) ? kpi('Pesan Belum Dibaca', d.stat.pesanBaru, 'warn', 'pesan') : ''}${d.pengguna ? kpi('Pengguna Aktif', d.pengguna.aktif + ' / ' + d.pengguna.total, '', 'pengguna') : ''}</div>
    <div class="grid g2" style="margin-bottom:1.25rem"><div class="card pad"><h3 style="margin-bottom:.75rem">Berita Terbit per Bulan</h3><div style="height:240px"><canvas id="chBerita" aria-label="Grafik berita terbit per bulan" role="img"></canvas></div></div>
    <div class="insight"><h3>${ic('auto_awesome')} Ringkasan Otomatis</h3><ul>${(d.insights || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      ${d.backupTerakhir ? `<p style="font-size:.8rem;margin:.75rem 0 0;opacity:.9">Backup terakhir: ${esc(fmtDT(d.backupTerakhir.waktu))} (${esc(d.backupTerakhir.status)})</p>` : ''}</div></div>`;
  } else if (!d.jadwalHariIni && !d.keu) h += `<div class="card pad"><div class="empty">${ic('construction')}Modul untuk peran Anda akan tersedia pada paket berikutnya.</div></div>`;
  if (d.aktivitas) h += `<div class="card pad"><h3 style="margin-bottom:.75rem">Aktivitas Terbaru</h3>${d.aktivitas.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>${d.aktivitas.map(a => `<tr><td>${esc(fmtDT(a.waktu))}</td><td>${esc(a.pengguna)}</td><td><span class="badge b-sage">${esc(a.aksi)}</span></td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('history', 'Belum ada aktivitas.')}</div>`;
  $('#admMain').innerHTML = h;
  if (d.perBulan && $('#chBerita')) loadLib(LIB.chart).then(() => {
    if (!$('#chBerita')) return;
    if (S.charts.b) S.charts.b.destroy();
    const cs = getComputedStyle(document.documentElement), txt = cs.getPropertyValue('--muted').trim();
    S.charts.b = new Chart($('#chBerita'), { type: 'bar', data: { labels: d.perBulan.map(m => m.label), datasets: [{ label: 'Berita terbit', data: d.perBulan.map(m => m.n), backgroundColor: cs.getPropertyValue('--primary').trim(), borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, color: txt } }, x: { ticks: { color: txt } } } } });
  }).catch(() => { const c = $('#chBerita'); if (c && c.parentElement) c.parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; });
}

ADM.berita = () => kontenPage('berita'); ADM.pengumuman = () => kontenPage('pengumuman');
function kontenPage(t) {
  S.k.table = t; S.k.q = ''; S.k.st = '';
  const can = ['super_admin', 'tu'].includes(S.user.peran), label = t === 'berita' ? 'Berita' : 'Pengumuman';
  $('#admMain').innerHTML = `<div class="toolbar"><input class="input" type="search" id="kq" placeholder="Cari judul / penulis…" aria-label="Cari" oninput="S.k.q=this.value;debounce(drawKonten,150)()">
    <select class="input" style="max-width:210px" id="ks" aria-label="Filter status" onchange="S.k.st=this.value;drawKonten()"><option value="">Semua status</option>${Object.keys(STATUS_BADGE).map(s => `<option>${s}</option>`).join('')}</select>
    <span style="flex:1"></span>${t === 'berita' ? `<button class="btn btn-outline" onclick="cetakPdf('berita',this)">${ic('print')} Cetak PDF</button>` : ''}
    ${can ? `<button class="btn btn-primary" onclick="kForm()">${ic('add_circle')} Buat ${label}</button>` : ''}</div>
    <div class="card"><div class="tbl-wrap" id="ktable"></div></div>`;
  swr('k_' + t, 'kontenList', { table: t }, t, rows => { S.k.rows = rows; drawKonten(); });
}
function kActions(r) {
  const role = S.user.peran, sa = role === 'super_admin', kep = sa || role === 'kepala', ed = sa || role === 'tu', t = S.k.table;
  const b = (i, ti, fn) => `<button class="icon-btn sm" title="${ti}" aria-label="${ti}" onclick="${fn}">${ic(i)}</button>`;
  const a = [], dr = ['Draft', 'Ditolak'].includes(r.status);
  if (ed && (dr || sa)) a.push(b('edit', 'Ubah', `kForm('${r.id}')`));
  if (ed && dr) a.push(b('send', 'Ajukan ke Kepala Madrasah', `kAksi('${r.id}','ajukan')`));
  if (kep && r.status === 'Menunggu Persetujuan') a.push(b('check_circle', 'Setujui & terbitkan', `kAksi('${r.id}','setujui')`), b('cancel', 'Tolak', `kAksi('${r.id}','tolak')`));
  if (sa && (dr || r.status === 'Menunggu Persetujuan')) a.push(b('publish', 'Terbitkan langsung', `kAksi('${r.id}','terbitLangsung')`));
  if (r.status === 'Dipublikasikan') a.push(b('inventory_2', 'Arsipkan', `kAksi('${r.id}','arsip')`));
  if (r.status === 'Diarsipkan') a.push(b('undo', 'Kembalikan ke draf', `kAksi('${r.id}','draft')`));
  if (sa) a.push(b('delete', 'Hapus', `kHapus('${r.id}')`));
  return `<div class="acts">${a.join('')}</div>`;
}
function drawKonten() {
  const q = S.k.q.toLowerCase(), rows = (S.k.rows || []).filter(r => (!S.k.st || r.status === S.k.st) && (!q || (r.judul + ' ' + r.penulis).toLowerCase().includes(q)));
  $('#ktable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Judul</th><th>Kategori</th><th>Penulis</th><th>Status</th><th>Diperbarui</th><th></th></tr></thead><tbody>${rows.map(r => `<tr>
    <td style="min-width:220px"><b>${esc(r.judul)}</b>${r.alasan_tolak ? `<div class="hint" style="color:var(--bad)">Ditolak: ${esc(r.alasan_tolak)}</div>` : ''}</td>
    <td>${esc(r.kategori)}${r.prioritas === 'Penting' ? ' <span class="badge b-bad">Penting</span>' : ''}</td><td>${esc(r.penulis)}</td>
    <td><span class="badge ${STATUS_BADGE[r.status] || 'b-gray'}">${esc(r.status)}</span></td><td>${esc(fmtDT(r.diperbarui || r.tgl_buat))}</td><td>${kActions(r)}</td></tr>`).join('')}</tbody></table>` : emptyBox('inbox', 'Belum ada data.');
}
async function kForm(id) {
  const t = S.k.table, isB = t === 'berita'; let d = {};
  if (id) { d = await api('kontenGet', { table: t, id }); if (d === undefined) return; }
  const v = k => esc(d[k] || ''), inp = (k, l, ex = '') => `<div class="field"><label class="label" for="f_${k}">${l}</label><input id="f_${k}" class="input" ${ex} value="${v(k)}"></div>`;
  modal({ title: (id ? 'Ubah ' : 'Buat ') + (isB ? 'Berita' : 'Pengumuman'), wide: true, body: `
    ${inp('judul', 'Judul <span class="req">*</span>', 'maxlength="150"')}
    <div class="grid g2"><div class="field"><label class="label" for="f_kategori">Kategori</label><select id="f_kategori" class="input">${KATEGORI.map(k => `<option ${d.kategori === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    ${isB ? `<div class="field"><label class="label" for="f_tgl_terbit">Jadwal terbit (opsional)</label><input id="f_tgl_terbit" type="datetime-local" class="input" value="${v('tgl_terbit').slice(0, 16)}"><div class="hint">Kosongkan untuk terbit saat disetujui.</div></div>`
      : `<div class="field"><label class="label" for="f_prioritas">Prioritas</label><select id="f_prioritas" class="input"><option>Biasa</option><option ${d.prioritas === 'Penting' ? 'selected' : ''}>Penting</option></select></div>`}</div>
    ${isB ? inp('ringkasan', 'Ringkasan singkat', 'maxlength="300"') : `<div class="grid g2">${inp('tgl_mulai', 'Tampil mulai', 'type="date"').replace(`value="${v('tgl_mulai')}"`, `value="${v('tgl_mulai').slice(0, 10)}"`)}${inp('tgl_akhir', 'Tampil sampai', 'type="date"').replace(`value="${v('tgl_akhir')}"`, `value="${v('tgl_akhir').slice(0, 10)}"`)}</div>`}
    <div class="field"><label class="label" for="f_isi">Isi <span class="req">*</span></label><textarea id="f_isi" class="input" style="min-height:220px" maxlength="${isB ? 20000 : 3000}">${v('isi')}</textarea><div class="hint">Pisahkan paragraf dengan satu baris kosong.</div></div>
    ${isB ? `<div class="field"><label class="label">Gambar sampul</label>${imgField('f_gambar_id', d.gambar_id, 1400)}</div>` : ''}`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="kSave">${ic('save')} Simpan Draf</button>` });
  $('#kSave').onclick = async () => {
    const g = k => ($('#f_' + k) || {}).value || '', data = { id: id || '', judul: g('judul'), kategori: g('kategori'), isi: g('isi'), ringkasan: g('ringkasan'), gambar_id: g('gambar_id'),
      prioritas: g('prioritas'), tgl_mulai: g('tgl_mulai'), tgl_akhir: g('tgl_akhir'), tgl_terbit: g('tgl_terbit') };
    if (!data.judul.trim() || !data.isi.trim()) { toast('Periksa', 'Judul dan isi wajib diisi.', 'warn'); return; }
    busy($('#kSave'), true, 'Menyimpan…'); const r = await api('kontenSave', { table: t, data }); busy($('#kSave'), false);
    if (r === undefined) return; closeModal(); toast('Berhasil', 'Tersimpan.');
    const rows = await api('kontenList', { table: t }); if (rows) { S.cache['k_' + t] = rows; S.k.rows = rows; if (S.adm === t) drawKonten(); }
  };
}
async function kAksi(id, aksi) {
  const t = S.k.table, row = S.k.rows.find(r => r.id === id); let alasan = '';
  if (aksi === 'tolak') { alasan = await promptBox('Tolak konten', 'Alasan penolakan'); if (!alasan) return; }
  else if (aksi === 'setujui' && !await confirmBox('Setujui dan terbitkan "' + row.judul + '" ke website?')) return;
  else if (aksi === 'terbitLangsung' && !await confirmBox('Terbitkan langsung tanpa persetujuan Kepala Madrasah?')) return;
  else if (aksi === 'arsip' && !await confirmBox('Arsipkan dan tarik dari website?')) return;
  const next = { ajukan: 'Menunggu Persetujuan', setujui: 'Dipublikasikan', terbitLangsung: 'Dipublikasikan', tolak: 'Ditolak', arsip: 'Diarsipkan', draft: 'Draft' }[aksi];
  const d = await api('kontenStatus', { table: t, id, aksi, alasan }); if (d === undefined) return;
  Object.assign(row, { status: next, alasan_tolak: alasan }); drawKonten(); toast('Berhasil', 'Status: ' + next);
}
async function kHapus(id) {
  const row = S.k.rows.find(r => r.id === id);
  if (!await confirmBox('Hapus "' + row.judul + '" secara permanen?', { danger: true, ok: 'Hapus' })) return;
  if (await api('kontenHapus', { table: S.k.table, id }) !== undefined) { S.k.rows = S.k.rows.filter(r => r.id !== id); S.cache['k_' + S.k.table] = S.k.rows; drawKonten(); toast('Dihapus', 'Data dihapus.'); }
}

ADM.pesan = () => {
  $('#admMain').innerHTML = `<div class="card"><div class="tbl-wrap" id="ptable"></div></div>`;
  swr('pesan', 'pesanList', {}, 'pesan', rows => {
    $('#ptable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Waktu</th><th>Pengirim</th><th>Subjek</th><th>Pesan</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr style="${r.dibaca === 'Ya' ? '' : 'font-weight:700'}">
      <td>${esc(fmtDT(r.waktu))}</td><td>${esc(r.nama)}<div class="hint">${esc(r.kontak)}</div></td><td>${esc(r.subjek || '-')}</td><td class="line2" style="max-width:340px">${esc(r.pesan)}</td>
      <td><button class="icon-btn sm" title="Baca" aria-label="Baca pesan" onclick="bacaPesan(${i})">${ic('open_in_new')}</button></td></tr>`).join('')}</tbody></table>` : emptyBox('mail', 'Belum ada pesan masuk.');
  });
};
function bacaPesan(i) {
  const r = S.cache.pesan[i];
  modal({ title: r.subjek || 'Pesan', body: `<p class="muted" style="font-size:.85rem">${esc(r.nama)} · ${esc(r.kontak)} · ${esc(fmtDT(r.waktu))}</p>${para(r.pesan)}`, foot: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>` });
  if (r.dibaca !== 'Ya') { r.dibaca = 'Ya'; api('pesanTandai', { id: r.id, dibaca: 'Ya' }, true); ADM.pesan(); S.cache.dash = null; }
}

ADM.pengguna = () => {
  $('#admMain').innerHTML = `<div class="toolbar"><input class="input" type="search" placeholder="Cari nama / username…" aria-label="Cari pengguna" oninput="S.uq=this.value;debounce(drawUsers,150)()">
    <select class="input" style="max-width:190px" aria-label="Filter peran" onchange="S.up=this.value;drawUsers()"><option value="">Semua peran</option>${Object.keys(ROLES).map(k => `<option value="${k}">${ROLES[k]}</option>`).join('')}</select><span style="flex:1"></span>
    <button class="btn btn-outline" onclick="dlTemplate()">${ic('download')} Template Excel</button><button class="btn btn-outline" onclick="pickImport()">${ic('upload_file')} Impor Excel</button>
    <button class="btn btn-outline" onclick="akunDialog()">${ic('person_add')} Akun dari Data</button><button class="btn btn-outline" onclick="akunHubungkan()">${ic('link')} Hubungkan</button><button class="btn btn-outline" onclick="uResetMassal()">${ic('lock_reset')} Reset Massal</button><button class="btn btn-outline" onclick="cetakPdf('pengguna',this)">${ic('print')} Cetak PDF</button><button class="btn btn-primary" onclick="uForm()">${ic('person_add')} Tambah</button></div>
    <div class="card"><div class="tbl-wrap" id="utable"></div></div>`;
  swr('users', 'userList', {}, 'pengguna', () => drawUsers());
};
function drawUsers() {
  const q = S.uq.toLowerCase(), rows = (S.cache.users || []).filter(u => (!S.up || u.peran === S.up) && (!q || (u.nama + ' ' + u.username).toLowerCase().includes(q)));
  $('#utable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead><tbody>${rows.map(u => `<tr>
    <td><b>${esc(u.nama)}</b></td><td>${esc(u.username)}</td><td>${esc(u.peranLabel)}</td><td><span class="badge ${u.status === 'Aktif' ? 'b-ok' : 'b-gray'}">${esc(u.status)}</span></td><td>${esc(fmtDT(u.login_terakhir))}</td>
    <td><div class="acts"><button class="icon-btn sm" title="Ubah" aria-label="Ubah pengguna" onclick="uForm('${u.id}')">${ic('edit')}</button><button class="icon-btn sm" title="Reset kata sandi" aria-label="Reset kata sandi" onclick="uReset('${u.id}')">${ic('lock_reset')}</button></div></td></tr>`).join('')}</tbody></table>` : emptyBox('group', 'Belum ada pengguna.');
}
function credBox(title, rows) {
  modal({ title, wide: true, body: `<p class="muted">Catat atau unduh sekarang. Kata sandi awal <b>tidak dapat dilihat lagi</b> setelah jendela ini ditutup; pengguna wajib menggantinya saat login pertama.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Kata sandi awal</th></tr></thead><tbody>${rows.map(r => r.error ? `<tr><td>${esc(r.nama)}</td><td colspan="3" style="color:var(--bad)">${esc(r.error)}</td></tr>` : `<tr><td>${esc(r.nama)}</td><td>${esc(r.username)}</td><td>${esc(r.peran || '')}</td><td style="font-family:monospace">${esc(r.password)}</td></tr>`).join('')}</tbody></table></div>`,
    foot: `<button class="btn btn-outline" id="credCsv">${ic('download')} Unduh CSV</button><button class="btn btn-primary" onclick="closeModal()">Selesai</button>` });
  $('#credCsv').onclick = () => csvDownload('akun_baru.csv', [['nama', 'username', 'peran', 'kata_sandi_awal']].concat(rows.filter(r => !r.error).map(r => [r.nama, r.username, r.peran || '', r.password])));
}
function uForm(id) {
  const u = id ? S.cache.users.find(x => x.id === id) : { nama: '', username: '', peran: 'guru', status: 'Aktif' };
  modal({ title: id ? 'Ubah Pengguna' : 'Tambah Pengguna', body: `
    <div class="field"><label class="label" for="u_n">Nama lengkap <span class="req">*</span></label><input id="u_n" class="input" maxlength="80" value="${esc(u.nama)}"></div>
    <div class="field"><label class="label" for="u_u">Username</label><input id="u_u" class="input" maxlength="30" value="${esc(u.username)}" placeholder="Otomatis dari nama bila kosong"></div>
    <div class="grid g2"><div class="field"><label class="label" for="u_p">Peran</label><select id="u_p" class="input">${Object.keys(ROLES).map(k => `<option value="${k}" ${u.peran === k ? 'selected' : ''}>${ROLES[k]}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="u_s">Status</label><select id="u_s" class="input"><option ${u.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option ${u.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select></div></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="uSave">Simpan</button>` });
  $('#uSave').onclick = async () => {
    const data = { id: id || '', nama: $('#u_n').value, username: $('#u_u').value, peran: $('#u_p').value, status: $('#u_s').value };
    if (!data.nama.trim()) { toast('Periksa', 'Nama wajib diisi.', 'warn'); return; }
    busy($('#uSave'), true, 'Menyimpan…'); const r = await api('userSave', { data }); busy($('#uSave'), false);
    if (r === undefined) return; closeModal();
    const rows = await api('userList'); if (rows) { S.cache.users = rows; drawUsers(); }
    if (r !== true && r.password) credBox('Akun Dibuat', [{ nama: data.nama, username: r.username, peran: ROLES[data.peran], password: r.password }]); else toast('Berhasil', 'Pengguna diperbarui.');
  };
}
async function uReset(id) {
  const u = S.cache.users.find(x => x.id === id);
  if (!await confirmBox('Reset kata sandi ' + u.nama + '? Kata sandi lama tidak akan berlaku.', { ok: 'Reset' })) return;
  const r = await api('userReset', { id }); if (r && r !== true) credBox('Kata Sandi Direset', [{ nama: u.nama, username: r.username, peran: u.peranLabel, password: r.password }]);
}
async function uResetMassal() {
  const q = S.uq.toLowerCase();
  const list = (S.cache.users || []).filter(u => u.peran !== 'super_admin' && (!S.up || u.peran === S.up) && (!q || (u.nama + ' ' + u.username).toLowerCase().includes(q)));
  if (!list.length) { toast('Kosong', 'Tidak ada pengguna pada daftar saat ini.', 'warn'); return; }
  const ruang = S.up ? 'peran ' + ROLES[S.up] : 'semua peran pada daftar';
  if (!await confirmBox('Buat kata sandi baru untuk ' + list.length + ' akun (' + ruang + ')? Kata sandi lama tidak berlaku lagi dan pengguna wajib menggantinya saat masuk.', { ok: 'Reset ' + list.length + ' akun', danger: true })) return;
  const res = [];
  for (let i = 0; i < list.length; i += 40) {
    modal({ title: 'Mereset…', lock: true, body: `<div class="center"><div class="spin" style="margin:0 auto 1rem"></div><p>Memproses ${Math.min(i + 40, list.length)} dari ${list.length}…</p></div>` });
    const d = await api('userResetMassal', { ids: list.slice(i, i + 40).map(u => u.id) });
    if (d === undefined) { closeModal(); break; }
    res.push(...d);
  }
  if (res.length) credBox('Kata Sandi Baru (' + res.length + ' akun)', res);
}
async function dlTemplate() {
  try { await loadLib(LIB.xlsx); } catch (e) { toast('Gagal', e.message, 'bad'); return; }
  const ws = XLSX.utils.aoa_to_sheet([['nama', 'peran', 'username (opsional)'], ['Contoh Nama Guru', 'guru', ''], ['Contoh Nama Siswa', 'siswa', '']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
  const wr = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wr, XLSX.utils.aoa_to_sheet([['Peran yang valid'], ...Object.values(ROLES).filter(x => x !== 'Super Admin').map(x => [x])]), 'Daftar Peran');
  XLSX.utils.book_append_sheet(wb, wr.Sheets['Daftar Peran'], 'Daftar Peran'); XLSX.writeFile(wb, 'Template_Pengguna.xlsx');
}
function pickImport() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv'; i.onchange = () => importFile(i.files[0]); i.click(); }
async function importFile(f) {
  if (!f) return;
  try {
    await loadLib(LIB.xlsx);
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).slice(1).filter(r => String(r[0]).trim())
      .map(r => ({ nama: String(r[0]).trim(), peran: String(r[1]).trim(), username: String(r[2] || '').trim() }));
    if (!rows.length) { toast('Kosong', 'Tidak ada baris data pada berkas.', 'warn'); return; }
    if (rows.length > 400) { toast('Terlalu banyak', 'Maksimal 400 baris per berkas.', 'warn'); return; }
    if (!await confirmBox(`Buat ${rows.length} akun dari berkas "${f.name}"?`)) return;
    const res = [];
    for (let i = 0; i < rows.length; i += 40) {
      modal({ title: 'Mengimpor…', lock: true, body: `<div class="center"><div class="spin" style="margin:0 auto 1rem"></div><p>Memproses ${Math.min(i + 40, rows.length)} dari ${rows.length}…</p></div>` });
      const d = await api('userImport', { rows: rows.slice(i, i + 40) });
      if (d === undefined) { closeModal(); break; } res.push(...d);
    }
    if (res.length) { const u = await api('userList'); if (u) { S.cache.users = u; drawUsers(); } credBox('Hasil Impor (' + res.filter(r => !r.error).length + ' akun dibuat)', res); }
  } catch (e) { closeModal(); toast('Gagal membaca berkas', e.message, 'bad'); }
}

function showPdf(d) {
  const bin = atob(d.base64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: 'application/pdf' }), url = URL.createObjectURL(blob);
  modal({ title: 'Pratinjau ' + d.nama, wide: true, body: `<iframe title="Pratinjau PDF" src="${url}" style="width:100%;height:60vh;border:1px solid var(--border);border-radius:10px"></iframe><p class="hint">Jika pratinjau kosong, klik Unduh.</p>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Tutup</button><button class="btn btn-primary" id="pdfDl">${ic('download')} Unduh PDF</button>` });
  $('#pdfDl').onclick = () => download(d.nama, blob);
}
async function cetakPdf(jenis, btn) {
  busy(btn, true, 'Menyiapkan…'); const d = await api('cetak', { jenis }); busy(btn, false);
  if (d && d !== true) showPdf(d);
}

const SET_GROUPS = [
  { t: 'Identitas & Kop Surat', f: [['nama_yayasan', 'Nama Yayasan'], ['nama_madrasah', 'Nama Madrasah'], ['npsn', 'NPSN'], ['nsm', 'NSM'], ['alamat', 'Alamat lengkap', 'area'], ['logo_id', 'Logo madrasah (PNG)', 'img', 400]] },
  { t: 'Beranda', f: [['hero_title', 'Judul utama'], ['hero_sub', 'Sub judul', 'area'], ['hero_bg_id', 'Gambar latar beranda', 'img', 1800],
    ['stat_1_nilai', 'Statistik 1 — angka'], ['stat_1_label', 'Statistik 1 — label'], ['stat_2_nilai', 'Statistik 2 — angka'], ['stat_2_label', 'Statistik 2 — label'],
    ['stat_3_nilai', 'Statistik 3 — angka'], ['stat_3_label', 'Statistik 3 — label'], ['stat_4_nilai', 'Statistik 4 — angka'], ['stat_4_label', 'Statistik 4 — label']], hint: 'Isi statistik hanya jika datanya sudah terverifikasi; yang kosong tidak ditampilkan.' },
  { t: 'Sambutan Kepala Madrasah', f: [['kepala_nama', 'Nama Kepala Madrasah'], ['kepala_foto_id', 'Foto Kepala Madrasah', 'img', 900], ['sambutan', 'Teks sambutan', 'area']] },
  { t: 'Profil Madrasah', f: [['sejarah', 'Sejarah', 'area'], ['visi', 'Visi', 'area'], ['misi', 'Misi (satu poin per baris)', 'area'], ['tujuan', 'Tujuan pendidikan', 'area'], ['struktur_img_id', 'Bagan struktur organisasi', 'img', 1600]] },
  { t: 'Kontak & Media Sosial', f: [['telp', 'Telepon'], ['wa', 'WhatsApp (mis. 0812…)'], ['email', 'Email resmi'], ['jam_layanan', 'Jam layanan'], ['ig', 'Instagram (URL lengkap)'], ['fb', 'Facebook (URL lengkap)'], ['tiktok', 'TikTok (URL lengkap)'], ['yt', 'YouTube (URL lengkap)'], ['maps_query', 'Lokasi untuk Google Maps']] },
  { t: 'PPDB', f: [['ppdb_aktif', 'Buka pendaftaran online', 'sel'], ['ppdb_tahun', 'Tahun ajaran penerimaan (mis. 2027/2028)'], ['ppdb_tingkat', 'Tingkat penerimaan siswa baru', 'opt', 'X,XI,XII'], ['ppdb_buka', 'Tanggal pendaftaran dibuka', 'date'], ['ppdb_tutup', 'Tanggal pendaftaran ditutup', 'date'],
    ['ppdb_jalur', 'Jalur pendaftaran (pisahkan dengan koma)'], ['ppdb_info', 'Informasi PPDB (persyaratan, jadwal, kontak panitia)', 'area']], hint: 'Pendaftaran online hanya aktif jika dibuka dan tanggal hari ini berada di antara tanggal buka dan tutup.' },
  { t: 'Kesiswaan dan Surat', f: [['pel_ambang1', 'Batas poin peringatan'], ['pel_ambang2', 'Batas poin panggil orang tua'], ['surat_kota', 'Kota pada surat (mis. Merlung)'], ['surat_format', 'Format nomor surat ({no} {bln} {thn})']], hint: 'Contoh format: {no}/MA.SKM/{bln}/{thn} menghasilkan 001/MA.SKM/X/2026. Nomor dibuat otomatis saat surat disetujui.' },
  { t: 'Perpustakaan', f: [['perpus_lama', 'Lama pinjam standar (hari)'], ['perpus_denda', 'Denda per hari keterlambatan (Rp)'], ['perpus_maks', 'Maksimal buku dipinjam per anggota']], hint: 'Isi denda 0 jika perpustakaan tidak menerapkan denda.' },
  { t: 'Karya Siswa', f: [['karya_nama', 'Nama penulis tampil di website', 'opt', 'Lengkap,Inisial']] },
  { t: 'Akademik & Rapor', f: [['tahun_ajaran', 'Tahun ajaran (mis. 2026/2027)'], ['semester', 'Semester aktif', 'opt', 'Ganjil,Genap'], ['sem_mulai', 'Semester mulai', 'date'], ['sem_selesai', 'Semester selesai', 'date'],
    ['bobot_formatif', 'Bobot Formatif (%)'], ['bobot_sumatif', 'Bobot Sumatif (%)'], ['bobot_sas', 'Bobot SAS (%)'], ['nip_kepala', 'NIP Kepala Madrasah'],
    ['ttd_kepala_id', 'Tanda tangan Kepala Madrasah (PNG, latar transparan)', 'imgp', 500]], hint: 'Tahun ajaran dan semester aktif menentukan data nilai dan rapor yang dikerjakan guru.' }
];
ADM.pengaturan = () => swr('cfg', 'settingsGet', {}, 'pengaturan', c => {
  $('#admMain').innerHTML = `<div class="row" style="margin-bottom:1rem"><p class="muted" style="margin:0;flex:1">Perubahan tampil di website setelah disimpan.</p><button class="btn btn-primary" id="setSave" onclick="saveSettings()">${ic('save')} Simpan Pengaturan</button></div>` +
    SET_GROUPS.map((g, gi) => `<details class="card pad" style="margin-bottom:1rem" ${gi === 0 ? 'open' : ''}><summary style="cursor:pointer;font-weight:700;min-height:32px">${g.t}</summary><div style="margin-top:1rem">${g.hint ? `<p class="hint" style="margin-bottom:1rem">${g.hint}</p>` : ''}<div class="grid g2">
      ${g.f.map(([k, l, ty, mx]) => `<div class="field" ${ty === 'area' ? 'style="grid-column:1/-1"' : ''}><label class="label" for="s_${k}">${l}</label>${
        ty === 'area' ? `<textarea id="s_${k}" data-k="${k}" class="input">${esc(c[k])}</textarea>` :
        ty === 'img' ? imgField('s_' + k, c[k], mx).replace(`id="s_${k}"`, `id="s_${k}" data-k="${k}"`) :
        ty === 'imgp' ? imgField('s_' + k, c[k], mx, true).replace(`id="s_${k}"`, `id="s_${k}" data-k="${k}"`) :
        ty === 'opt' ? `<select id="s_${k}" data-k="${k}" class="input">${mx.split(',').map(o => `<option ${c[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` :
        ty === 'sel' ? `<select id="s_${k}" data-k="${k}" class="input"><option ${c[k] === 'Ya' ? 'selected' : ''}>Ya</option><option ${c[k] !== 'Ya' ? 'selected' : ''}>Tidak</option></select>` :
        `<input id="s_${k}" data-k="${k}" class="input" ${ty === 'date' ? 'type="date"' : ''} value="${esc(ty === 'date' ? String(c[k] || '').slice(0, 10) : c[k])}">`}</div>`).join('')}</div></div></details>`).join('');
});
async function saveSettings() {
  const data = {}; $$('#admMain [data-k]').forEach(e => data[e.dataset.k] = e.value);
  const b = $('#setSave'); busy(b, true, 'Menyimpan…'); const r = await api('settingsSave', { data }); busy(b, false);
  if (r === undefined) return; Object.assign(S.cfg, data); S.cache.cfg = Object.assign({}, S.cache.cfg, data); setBrand(); toast('Berhasil', 'Pengaturan disimpan.');
  const d = await pub('bundle'); if (d) { S.cfg = d.cfg; S.berita = d.berita; S.peng = d.pengumuman; }
}

ADM.backup = () => swr('backup', 'backupList', {}, 'backup', d => {
  $('#admMain').innerHTML = `<div class="card pad" style="margin-bottom:1rem"><div class="row"><div style="flex:1;min-width:240px"><h3>Backup Data</h3><p class="muted" style="margin:0;font-size:.88rem">Otomatis setiap hari pukul 02.00 (disimpan 30 hari + arsip tanggal 1). Konten berita dan pengumuman juga diekspor setiap Minggu.</p></div>
    <button class="btn btn-primary" id="bkNow" onclick="backupNow()">${ic('backup')} Backup Sekarang</button></div></div>
    <div class="grid g2"><div class="card"><div class="pad"><h3>Berkas Backup</h3></div><div class="tbl-wrap">${d.files.length ? `<table class="tbl"><thead><tr><th>Nama berkas</th><th>Dibuat</th><th></th></tr></thead><tbody>${d.files.map(f => `<tr><td>${esc(f.nama)}</td><td>${esc(fmtDT(f.dibuat))}</td>
      <td>${/^DB_/.test(f.nama) ? `<button class="btn btn-sm btn-outline" onclick="restore('${f.id}','${esc(f.nama)}')">Pulihkan</button>` : ''}</td></tr>`).join('')}</tbody></table>` : emptyBox('backup', 'Belum ada backup.')}</div></div>
    <div class="card"><div class="pad"><h3>Riwayat</h3></div><div class="tbl-wrap">${d.log.length ? `<table class="tbl"><thead><tr><th>Waktu</th><th>Jenis</th><th>Status</th></tr></thead><tbody>${d.log.map(l => `<tr><td>${esc(fmtDT(l.waktu))}</td><td>${esc(l.jenis)}</td><td><span class="badge ${l.status === 'Berhasil' ? 'b-ok' : 'b-bad'}">${esc(l.status)}</span></td></tr>`).join('')}</tbody></table>` : emptyBox('history', 'Belum ada riwayat.')}</div></div></div>`;
});
async function backupNow() {
  const b = $('#bkNow'); busy(b, true, 'Membuat backup…'); const r = await api('backupNow'); busy(b, false);
  if (r !== undefined) { toast('Berhasil', 'Backup selesai.'); S.cache.backup = null; ADM.backup(); }
}
async function restore(id, nama) {
  if (!await confirmBox('Data saat ini akan ditimpa dengan isi "' + nama + '". Sistem otomatis membuat backup pengaman terlebih dahulu.', { danger: true, ok: 'Pulihkan', type: 'PULIHKAN' })) return;
  modal({ title: 'Memulihkan…', lock: true, body: `<div class="center"><div class="spin" style="margin:0 auto 1rem"></div><p>Mohon tunggu, jangan tutup halaman.</p></div>` });
  const r = await api('backupRestore', { fileId: id, konfirmasi: 'PULIHKAN' }); closeModal();
  if (r !== undefined) { S.cache = {}; S.mods = null; S.refs = null; toast('Berhasil', 'Data dipulihkan. Muat ulang halaman bila ada data yang belum berubah.'); ADM.backup(); }
}

ADM.log = () => {
  $('#admMain').innerHTML = `<div class="card"><div class="tbl-wrap" id="ltable"></div></div>`;
  swr('log', 'logList', {}, 'log', rows => {
    $('#ltable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(fmtDT(a.waktu))}</td><td>${esc(a.pengguna)}</td><td><span class="badge b-sage">${esc(a.aksi)}</span></td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table>` : emptyBox('history', 'Belum ada aktivitas.');
  });
};
const REFKEY = { id_rombel: 'rombel', id_mapel: 'mapel', id_guru: 'guru', id_wali: 'guru', id_siswa: 'siswa', id_ekskul: 'ekskul', id_pejabat: 'pejabat', id_jenis: 'jenis_pel', id_pelapor: 'guru', id_konselor: 'guru', id_pembina: 'guru', id_ruang: 'ruang', id_inventaris: 'inventaris' };
const HARI_URUT = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const xlsDate = v => {
  if (!(v instanceof Date)) return v;
  const d = new Date(v.getTime() + 43200000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
};
const opts = (arr, sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + arr.map(o => `<option value="${esc(o.id)}" ${o.id === sel ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
async function loadRefs(force) {
  if (S.refs && !force && Date.now() - (S.refsAt || 0) < 60000) return S.refs;
  const d = await api('mRefs');
  if (d && d !== true) { S.refs = d; S.refsAt = Date.now(); }
  return S.refs || { rombel: [], guru: [], mapel: [] };
}
function refLabel(k, id) {
  const l = ((S.refs && S.refs[REFKEY[k]]) || []).find(x => x.id === id);
  return l ? l.label : (id ? 'tidak dikenal' : '-');
}
async function loadMods() {
  const d = await api('modSchema');
  S.mods = Array.isArray(d) ? d : [];
  renderMenu();
}
function menuFor(r) {
  const m = [['dashboard', 'space_dashboard', 'Dashboard']];
  if (r === 'siswa') m.push(['portal', 'person', 'Portal Siswa']);
  if (['super_admin', 'kepala', 'tu'].includes(r)) m.push(['_w', '', 'Website'], ['berita', 'newspaper', 'Berita'], ['pengumuman', 'campaign', 'Pengumuman'], ['karya', 'edit_note', 'Karya Siswa'], ['ppdb', 'how_to_reg', 'PPDB Online']);
  if (['siswa', 'guru', 'wali_kelas'].includes(r)) m.push(['_k', '', 'Literasi'], ['karya', 'edit_note', 'Karya Siswa']);
  if (['super_admin', 'tu'].includes(r)) m.push(['pesan', 'mail', 'Pesan Masuk']);
  const mods = (S.mods || []).filter(x => x.menu);
  [...new Set(mods.map(x => x.grp))].forEach(g => {
    m.push(['_' + g, '', g]);
    mods.filter(x => x.grp === g).forEach(x => m.push(['m:' + x.key, x.icon, x.label]));
    if (g === 'Kesiswaan' && ['super_admin', 'kepala', 'tu', 'bk', 'wali_kelas'].includes(r)) m.push(['pelrekap', 'leaderboard', 'Rekap Poin Pelanggaran']);
    if (g === 'Administrasi' && ['super_admin', 'kepala', 'tu'].includes(r)) m.push(['suratkeluar', 'outbox', 'Surat Keluar']);
    if (g === 'Keuangan' && ['super_admin', 'kepala', 'bendahara', 'tu'].includes(r)) m.push(['tagihan', 'receipt_long', 'Tagihan dan Pembayaran']);
    if (g === 'Keuangan' && ['super_admin', 'kepala', 'bendahara'].includes(r)) m.push(['laporankeu', 'insights', 'Laporan Keuangan']);
    if (g === 'Perpustakaan' && ['super_admin', 'kepala', 'pustakawan', 'tu'].includes(r)) m.push(['sirkulasi', 'swap_horiz', 'Peminjaman']);
  });
  const pb = [];
  if (['super_admin', 'guru', 'wali_kelas'].includes(r)) pb.push(['absensi', 'how_to_reg', 'Absensi']);
  if (['super_admin', 'kepala', 'tu', 'guru', 'wali_kelas'].includes(r)) pb.push(['nilai', 'grading', 'Nilai']);
  if (['super_admin', 'kepala', 'tu', 'wali_kelas'].includes(r)) pb.push(['rapor', 'description', 'Rapor']);
  if (pb.length) m.push(['_p', '', 'Pembelajaran'], ...pb);
  if (r === 'super_admin') m.push(['_s', '', 'Sistem'], ['pengguna', 'group', 'Pengguna'], ['pengaturan', 'settings', 'Pengaturan'], ['backup', 'backup', 'Backup & Pemulihan']);
  if (['super_admin', 'kepala'].includes(r)) { if (r !== 'super_admin') m.push(['_s', '', 'Sistem']); m.push(['log', 'history', 'Log Aktivitas']); }
  return m;
}
function renderMenu() {
  $('#admNav').innerHTML = menuFor(S.user.peran).map(([k, i, l]) => k.startsWith('_') ? `<div class="sec">${esc(l)}</div>` :
    `<a class="sl ${S.adm === k ? 'active' : ''}" href="javascript:void(0)" data-k="${esc(k)}" onclick="goA('${esc(k)}')">${ic(i)}${esc(l)}</a>`).join('');
}
function jadwalCard(j) {
  return `<div class="card pad" style="margin-bottom:1.25rem"><h3 style="margin-bottom:.75rem">${ic('today')} Jadwal Hari Ini (${esc(j.hari)})</h3>${j.items.length ?
    `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Jam</th><th>Kelas</th><th>Mata Pelajaran</th><th>Guru</th><th>Ruang</th></tr></thead><tbody>${j.items.map(x => `<tr><td>${esc(x.jam_ke)}</td><td>${esc(x.kelas)}</td><td>${esc(x.mapel)}</td><td>${esc(x.guru)}</td><td>${esc(x.ruang || '-')}</td></tr>`).join('')}</tbody></table></div>` :
    '<p class="muted" style="margin:0">Tidak ada jadwal pelajaran hari ini.</p>'}</div>`;
}

function colLabel(m, k) { const f = m.f.find(x => x.k === k); return f ? f.l : (k === 'id_guru' ? 'Guru' : k); }
function cellOf(m, k, r) {
  const v = r[k], f = m.f.find(x => x.k === k);
  if (f && f.uang) return v === '' || v == null ? '-' : esc(rp(v));
  if (f && f.t === 'pfile') return v ? `<button class="btn btn-outline btn-sm" onclick="privLihat('${esc(v)}')">${ic('visibility')} Lihat</button>` : '-';
  if (REFKEY[k]) {
    const lb = refLabel(k, v);
    if (m.key === 'siswa' && k === 'id_rombel' && r.jk) { const g = kelasGender(lb); if (g && g !== r.jk) return `${esc(lb)} <span class="badge b-bad" title="Jenis kelamin siswa tidak sesuai dengan nama kelas">Tidak sesuai</span>`; }
    return esc(lb);
  }
  if (f && f.t === 'date') return esc(fmtD(v));
  return esc(v === '' || v == null ? '-' : v);
}
async function modPage(key) {
  const m = (S.mods || []).find(x => x.key === key);
  if (!m) { $('#admMain').innerHTML = emptyBox('lock', 'Menu ini tidak tersedia untuk peran Anda.'); return; }
  S.m = { m: m, q: '', f: '', rows: [] };
  const tools = [];
  if (m.w && m.imp) tools.push(`<button class="btn btn-outline" onclick="modTemplate()">${ic('download')} Template Excel</button><button class="btn btn-outline" onclick="modPick()">${ic('upload_file')} Impor Excel</button>`);
  if (S.user.peran !== 'siswa') tools.push(`<button class="btn btn-outline" onclick="modCetak(this)">${ic('print')} Cetak PDF</button>`);
  (m.extra || []).forEach(x => { if (m.w) tools.push(`<button class="btn btn-outline" onclick="modExtra('${esc(x.a)}',this)">${ic(x.i)} ${esc(x.l)}</button>`); });
  if (m.w) tools.push(`<button class="btn btn-primary" onclick="modForm()">${ic('add_circle')} Tambah</button>`);
  $('#admMain').innerHTML = `<div class="toolbar"><input class="input" type="search" placeholder="Cari…" aria-label="Cari" oninput="S.m.q=this.value.toLowerCase();debounce(drawMod,150)()">
    ${m.filter ? '<select class="input" style="max-width:220px" id="mfilter" aria-label="Filter" onchange="S.m.f=this.value;drawMod()"></select>' : ''}<span style="flex:1"></span>${tools.join('')}</div>
    <div class="card"><div class="tbl-wrap" id="mtable">${skeleton()}</div></div>`;
  await loadRefs();
  if (S.adm !== 'm:' + key) return;
  swr('m_' + key, 'mList', { mod: key }, 'm:' + key, rows => { S.m.rows = rows; fillModFilter(); drawMod(); });
}
function drawMod() {
  const m = S.m.m, q = S.m.q;
  const rows = S.m.rows.filter(r => (!S.m.f || r[m.filter] === S.m.f) && (!q || m.list.map(k => REFKEY[k] ? refLabel(k, r[k]) : r[k]).join(' ').toLowerCase().includes(q)));
  if (m.sort === 'hari') rows.sort((a, b) => HARI_URUT.indexOf(a.hari) - HARI_URUT.indexOf(b.hari) || Number(a.jam_ke) - Number(b.jam_ke));
  else if (m.sort === 'tanggal' || m.sort === 'tgl_kegiatan' || m.sort === 'tgl_terima') rows.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  else if (m.sort) rows.sort((a, b) => String(a[m.sort]).localeCompare(String(b[m.sort])));
  $('#mtable').innerHTML = rows.length ? `<table class="tbl"><thead><tr>${m.list.map(k => `<th>${esc(colLabel(m, k))}</th>`).join('')}${m.w ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr>${m.list.map(k => `<td>${cellOf(m, k, r)}</td>`).join('')}${m.w ?
    `<td><div class="acts"><button class="icon-btn sm" title="Ubah" aria-label="Ubah" onclick="modForm('${esc(r.id)}')">${ic('edit')}</button><button class="icon-btn sm" title="Hapus" aria-label="Hapus" onclick="modDel('${esc(r.id)}')">${ic('delete')}</button></div></td>` : ''}</tr>`).join('')}</tbody></table><div class="hint" style="padding:.6rem 1rem">${rows.length} data</div>` : emptyBox('inbox', 'Belum ada data.');
}
function fieldHtml(f, v) {
  const id = 'mf_' + f.k;
  if (f.hide) return `<input type="hidden" id="${id}" value="${esc(v)}">`;
  const lab = `<label class="label" for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</label>`;
  let c;
  if (f.t === 'img') c = imgField(id, v, 1400);
  else if (f.t === 'pfile') c = privField(id, v);
  else if (f.t === 'file') c = fileField(id, v, '');
  else if (f.t === 'area') c = `<textarea id="${id}" class="input" maxlength="2000">${esc(v)}</textarea>`;
  else if (f.t === 'sel') c = `<select id="${id}" class="input"><option value="">—</option>${f.opt.map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.t === 'ref') c = `<select id="${id}" class="input">${opts(S.refs[f.ref] || [], v, '— pilih —')}</select>${(S.refs[f.ref] || []).length ? '' : '<div class="hint" style="color:var(--bad)">Belum ada data. Tambahkan lebih dulu di menu terkait, atau impor siswa lewat Excel (kelas dibuat otomatis).</div>'}`;
  else c = `<input id="${id}" class="input" type="${f.t === 'date' ? 'date' : f.t === 'num' ? 'number' : 'text'}" ${f.t === 'num' ? 'step="any"' : ''} value="${esc(f.t === 'date' ? String(v || '').slice(0, 10) : v)}">`;
  return `<div class="field" ${f.t === 'area' ? 'style="grid-column:1/-1"' : ''}>${lab}${c}</div>`;
}
async function modRefresh(mod, force) {
  if (force || ['rombel', 'guru', 'mapel', 'siswa', 'ekskul', 'pejabat', 'jenis_pel', 'ruang', 'inventaris', 'buku'].includes(mod)) { S.refs = null; await loadRefs(true); }
  Object.keys(S.cache).forEach(k => { if (k.startsWith('m_') && k !== 'm_' + mod) delete S.cache[k]; });
  const rows = await api('mList', { mod });
  if (rows && S.m && S.m.m.key === mod && S.adm === 'm:' + mod) { S.cache['m_' + mod] = rows; S.m.rows = rows; fillModFilter(); drawMod(); }
}
async function modForm(id) {
  const m = S.m.m; await loadRefs();
  const d = id ? S.m.rows.find(r => r.id === id) : {};
  modal({ title: (id ? 'Ubah ' : 'Tambah ') + m.label, wide: true,
    body: `<div class="grid g2">${m.f.map(f => fieldHtml(f, d[f.k] !== undefined && d[f.k] !== '' ? d[f.k] : (f.def !== undefined ? f.def : ''))).join('')}</div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="mSave">${ic('save')} Simpan</button>` });
  $('#mSave').onclick = async () => {
    const data = { id: id || '' };
    m.f.forEach(f => { data[f.k] = $('#mf_' + f.k).value; });
    const miss = m.f.find(f => f.req && !String(data[f.k]).trim());
    if (miss) { toast('Periksa', miss.l + ' wajib diisi.', 'warn'); return; }
    busy($('#mSave'), true, 'Menyimpan…'); const r = await api('mSave', { mod: m.key, data }); busy($('#mSave'), false);
    if (r === undefined) return;
    closeModal(); if (r && r.peringatan) toast('Perhatian', r.peringatan, 'warn'); else toast('Berhasil', 'Data tersimpan.'); modRefresh(m.key);
  };
}
async function modDel(id) {
  const m = S.m.m, r = S.m.rows.find(x => x.id === id);
  if (!await confirmBox('Hapus data "' + (r[m.f[0].k] || r[m.f[1].k] || '') + '" secara permanen?', { danger: true, ok: 'Hapus' })) return;
  if (await api('mDelete', { mod: m.key, id }) !== undefined) { toast('Dihapus', 'Data dihapus.'); modRefresh(m.key); }
}
async function modCetak(btn) {
  const m = S.m.m; busy(btn, true, 'Menyiapkan…');
  const d = await api('mCetak', { mod: m.key, fk: m.filter && S.m.f ? m.filter : '', fv: S.m.f }); busy(btn, false);
  if (d && d !== true) showPdf(d);
}
async function modTemplate() {
  const m = S.m.m;
  try { await loadLib(LIB.xlsx); } catch (e) { toast('Gagal', e.message, 'bad'); return; }
  const ex = m.f.map(f => f.t === 'date' ? '2008-05-17' : f.t === 'sel' ? f.opt[0] : f.t === 'ref' ? 'nama persis seperti di data master' : f.t === 'num' ? '1' : 'contoh');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([m.f.map(f => f.l), ex]), 'Data');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Petunjuk'], ['Isi mulai baris ke-2 dan hapus baris contoh.'], ['Tanggal ditulis 2008-05-17 (tahun-bulan-tanggal).'],
    ['Kolom NIS, NISN, NIP sebaiknya berformat Teks agar angka 0 di depan tidak hilang.'], ['Kelas, mata pelajaran, dan guru diisi dengan nama persis seperti di data master.'], ['Data dengan NIS/kode/nama kelas yang sama akan diperbarui, bukan digandakan.']]), 'Petunjuk');
  XLSX.writeFile(wb, 'Template_' + m.key + '.xlsx');
}
function modPick() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv'; i.onchange = () => modImport(i.files[0]); i.click(); }
async function modImport(f) {
  if (!f) return; const m = S.m.m;
  try {
    await loadLib(LIB.xlsx);
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }).map(r => { const o = {}; Object.keys(r).forEach(k => { o[k] = xlsDate(r[k]); }); return o; })
      .filter(r => Object.values(r).some(v => String(v).trim() !== ''));
    if (!rows.length) { toast('Kosong', 'Tidak ada baris data pada berkas.', 'warn'); return; }
    if (rows.length > 1000) { toast('Terlalu banyak', 'Maksimal 1000 baris per berkas.', 'warn'); return; }
    if (!await confirmBox(`Impor ${rows.length} baris ke ${m.label}?`)) return;
    let baru = 0, ubah = 0, kelasBaru = 0; const err = [], warns = [];
    for (let i = 0; i < rows.length; i += 100) {
      modal({ title: 'Mengimpor…', lock: true, body: `<div class="center"><div class="spin" style="margin:0 auto 1rem"></div><p>Memproses ${Math.min(i + 100, rows.length)} dari ${rows.length}…</p></div>` });
      const d = await api('mImport', { mod: m.key, rows: rows.slice(i, i + 100), offset: i });
      if (d === undefined) { closeModal(); return; }
      baru += d.baru; ubah += d.ubah; kelasBaru += d.kelasBaru || 0; err.push(...d.err); warns.push(...(d.peringatan || []));
    }
    modal({ title: 'Hasil Impor', wide: true, body: `<p><b>${baru}</b> data baru, <b>${ubah}</b> diperbarui, <b>${err.length}</b> baris bermasalah.${kelasBaru ? ' <b>' + kelasBaru + '</b> kelas baru dibuat otomatis (lengkapi wali kelasnya di menu Kelas).' : ''}</p>${err.length ?
      `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Baris</th><th>Masalah</th></tr></thead><tbody>${err.slice(0, 60).map(e => `<tr><td>${e.baris}</td><td>${esc(e.pesan)}</td></tr>`).join('')}</tbody></table></div>${err.length > 60 ? '<p class="hint">Hanya 60 pertama ditampilkan.</p>' : ''}` : ''}${warns.length ? `<h3 style="margin:1rem 0 .5rem">Peringatan (${warns.length}) <span class="badge b-warn">data tetap tersimpan</span></h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Baris</th><th>Peringatan</th></tr></thead><tbody>${warns.slice(0, 60).map(e => `<tr><td>${e.baris}</td><td>${esc(e.pesan)}</td></tr>`).join('')}</tbody></table></div>` : ''}`,
      foot: `<button class="btn btn-primary" onclick="closeModal()">Selesai</button>` });
    modRefresh(m.key, true);
  } catch (e) { closeModal(); toast('Gagal membaca berkas', e.message, 'bad'); }
}

const segs = (sid, cur) => `<div class="segs" role="radiogroup" aria-label="Status kehadiran">${[['H', 'Hadir'], ['S', 'Sakit'], ['I', 'Izin'], ['A', 'Alpa']].map(([v, l]) =>
  `<label class="${cur === v ? 'on-' + v : ''}" title="${l}"><input type="radio" name="st_${sid}" value="${v}" ${cur === v ? 'checked' : ''} onchange="segSet(this)" aria-label="${l}">${v}</label>`).join('')}</div>`;
function segSet(el) { $$('label', el.closest('.segs')).forEach(l => { l.className = ''; }); el.parentElement.className = 'on-' + el.value; }

ADM.absensi = async () => {
  await loadRefs();
  $('#admMain').innerHTML = `<div class="row" style="margin-bottom:1rem"><button class="chip on" id="tabIsi" onclick="absTab('isi')">Isi Absensi</button><button class="chip" id="tabRekap" onclick="absTab('rekap')">Rekap Kehadiran</button></div><div id="absBody"></div>`;
  absTab('isi');
};
function absTab(t) {
  $('#tabIsi').classList.toggle('on', t === 'isi'); $('#tabRekap').classList.toggle('on', t === 'rekap');
  const rb = S.refs.rombel, mine = rb.find(x => x.wali === S.user.ref_id);
  if (t === 'isi') {
    $('#absBody').innerHTML = `<div class="card pad"><div class="grid g4"><div class="field"><label class="label" for="ab_tgl">Tanggal</label><input id="ab_tgl" type="date" class="input" value="${ymd(new Date())}"></div>
      <div class="field"><label class="label" for="ab_rb">Kelas</label><select id="ab_rb" class="input">${opts(rb, mine ? mine.id : '', '— pilih —')}</select></div>
      <div class="field"><label class="label" for="ab_mp">Mata pelajaran</label><select id="ab_mp" class="input">${opts(S.refs.mapel, '', '— pilih —')}</select></div>
      <div class="field"><label class="label" for="ab_jam">Jam ke-</label><select id="ab_jam" class="input">${Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></div></div>
      <button class="btn btn-primary" onclick="absLoad()">${ic('groups')} Tampilkan Siswa</button></div><div id="absRoster" style="margin-top:1rem"></div>`;
  } else {
    const d = new Date(), awal = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    $('#absBody').innerHTML = `<div class="card pad"><div class="grid g3"><div class="field"><label class="label" for="rk_rb">Kelas</label><select id="rk_rb" class="input">${opts(rb, mine ? mine.id : '', '— pilih —')}</select></div>
      <div class="field"><label class="label" for="rk_a">Dari tanggal</label><input id="rk_a" type="date" class="input" value="${awal}"></div>
      <div class="field"><label class="label" for="rk_b">Sampai tanggal</label><input id="rk_b" type="date" class="input" value="${ymd(d)}"></div></div>
      <button class="btn btn-primary" onclick="absRekap()">${ic('table_chart')} Tampilkan Rekap</button></div><div id="absRoster" style="margin-top:1rem"></div>`;
  }
}
async function absLoad() {
  const ok2 = navGuard();
  const p = { tanggal: $('#ab_tgl').value, id_rombel: $('#ab_rb').value, id_mapel: $('#ab_mp').value, jam: $('#ab_jam').value };
  if (!p.tanggal || !p.id_rombel || !p.id_mapel) { toast('Periksa', 'Pilih tanggal, kelas, dan mata pelajaran.', 'warn'); return; }
  S.abp = p; const d = await api('absGet', p); if (d === undefined || !ok2()) return;
  $('#absRoster').innerHTML = d.siswa.length ? `<div class="card pad">${d.ada ? `<p class="hint" style="margin-bottom:.75rem">${ic('info')} Sesi ini sudah pernah diisi. Menyimpan akan memperbarui data.</p>` : ''}
    <div class="row" style="margin-bottom:.75rem"><b>${d.siswa.length} siswa</b><span style="flex:1"></span><button class="btn btn-outline btn-sm" onclick="absSemuaHadir()">Semua Hadir</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>Kehadiran</th></tr></thead><tbody>${d.siswa.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td><td>${segs(s.id, d.tidak_hadir[s.id] || 'H')}</td></tr>`).join('')}</tbody></table></div>
    <div class="field" style="margin-top:1rem"><label class="label" for="ab_cat">Catatan sesi (opsional)</label><input id="ab_cat" class="input" maxlength="200" value="${esc(d.catatan)}"></div>
    <button class="btn btn-primary" id="abSave" onclick="absSimpan()">${ic('save')} Simpan Absensi</button></div>` : `<div class="card">${emptyBox('groups', 'Belum ada siswa aktif di kelas ini.')}</div>`;
}
function absSemuaHadir() { $$('#absRoster input[type=radio][value=H]').forEach(i => { i.checked = true; segSet(i); }); }
async function absSimpan() {
  const th = {}; $$('#absRoster input[type=radio]:checked').forEach(i => { if (i.value !== 'H') th[i.name.slice(3)] = i.value; });
  const b = $('#abSave'); busy(b, true, 'Menyimpan…');
  const r = await api('absSave', Object.assign({}, S.abp, { tidak_hadir: th, catatan: $('#ab_cat').value })); busy(b, false);
  if (r !== undefined) toast('Tersimpan', Object.keys(th).length + ' siswa tidak hadir.');
}
async function absRekap() {
  const ok2 = navGuard();
  const id = $('#rk_rb').value; if (!id) { toast('Periksa', 'Pilih kelas.', 'warn'); return; }
  const d = await api('absRekap', { id_rombel: id, dari: $('#rk_a').value, sampai: $('#rk_b').value }); if (d === undefined || !ok2()) return;
  $('#absRoster').innerHTML = `<div class="card"><div class="pad"><b>${d.sesi}</b> sesi pembelajaran tercatat pada rentang ini.</div><div class="tbl-wrap">${d.siswa.length ? `<table class="tbl"><thead><tr><th>NIS</th><th>Nama</th><th>Sakit</th><th>Izin</th><th>Alpa</th><th>Kehadiran</th></tr></thead><tbody>${d.siswa.map(s => `<tr><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td><td>${s.S}</td><td>${s.I}</td><td>${s.A}</td><td>${s.persen === null ? '-' : s.persen + '%'}</td></tr>`).join('')}</tbody></table>` : emptyBox('groups', 'Tidak ada siswa.')}</div></div>`;
}

const avgOf = (items, jenis, sid) => { const v = items.filter(i => i.jenis === jenis && i.skor[sid] !== undefined && i.skor[sid] !== '').map(i => Number(i.skor[sid])); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
function calcAkhir(f, s, a) {
  const c = S.cfg; let b = { F: Number(c.bobot_formatif) || 0, S: Number(c.bobot_sumatif) || 0, A: Number(c.bobot_sas) || 0 };
  if (b.F + b.S + b.A === 0) b = { F: 1, S: 1, A: 1 };
  let tw = 0, sum = 0;
  if (f !== null) { sum += f * b.F; tw += b.F; } if (s !== null) { sum += s * b.S; tw += b.S; } if (a !== null) { sum += a * b.A; tw += b.A; }
  return tw ? Math.round(sum / tw * 100) / 100 : null;
}
const predOf = n => n === null ? '-' : n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : 'D';
const fx = v => v === null || v === undefined ? '-' : (Math.round(v * 100) / 100);
ADM.nilai = async () => {
  await loadRefs();
  const mine = (S.user.ref_id ? S.refs.rombel.find(x => x.wali === S.user.ref_id) : null);
  $('#admMain').innerHTML = `<div class="card pad"><div class="grid g3"><div class="field"><label class="label" for="nl_rb">Kelas</label><select id="nl_rb" class="input">${opts(S.refs.rombel, mine ? mine.id : '', '— pilih —')}</select></div>
    <div class="field"><label class="label" for="nl_mp">Mata pelajaran</label><select id="nl_mp" class="input">${opts(S.refs.mapel, '', '— pilih —')}</select></div></div>
    <button class="btn btn-primary" onclick="nilaiLoad()">${ic('grading')} Tampilkan Nilai</button></div><div id="nlBody" style="margin-top:1rem"></div>`;
};
async function nilaiLoad() {
  const ok2 = navGuard();
  const p = { id_rombel: $('#nl_rb').value, id_mapel: $('#nl_mp').value };
  if (!p.id_rombel || !p.id_mapel) { toast('Periksa', 'Pilih kelas dan mata pelajaran.', 'warn'); return; }
  const d = await api('nilaiList', p); if (d === undefined || !ok2()) return;
  S.nl = { p: p, d: d }; drawNilai();
}
function drawNilai() {
  const { p, d } = S.nl, canW = ['super_admin', 'guru', 'wali_kelas'].includes(S.user.peran) && (!d.terkunci || S.user.peran === 'super_admin');
  const mine = i => S.user.peran === 'super_admin' || i.id_guru === S.user.ref_id;
  $('#nlBody').innerHTML = `<div class="card pad" style="margin-bottom:1rem"><div class="row"><div style="flex:1"><h3>Penilaian ${esc(d.semester)} ${esc(d.ta)}</h3><p class="muted" style="margin:0;font-size:.85rem">Bobot: Formatif ${esc(S.cfg.bobot_formatif || 0)}%, Sumatif ${esc(S.cfg.bobot_sumatif || 0)}%, SAS ${esc(S.cfg.bobot_sas || 0)}%${d.terkunci ? ' · <b>Rapor sudah disetujui, nilai terkunci.</b>' : ''}</p></div>
    ${canW ? `<button class="btn btn-primary" onclick="nilaiForm()">${ic('add_circle')} Tambah Penilaian</button>` : ''}</div></div>
    <div class="card" style="margin-bottom:1rem"><div class="tbl-wrap">${d.items.length ? `<table class="tbl"><thead><tr><th>Jenis</th><th>Judul</th><th>Terisi</th><th>Rata-rata</th><th></th></tr></thead><tbody>${d.items.map(i => { const v = Object.values(i.skor).map(Number);
      return `<tr><td><span class="badge b-sage">${esc(i.jenis)}</span></td><td>${esc(i.judul)}</td><td>${v.length} / ${d.roster.length}</td><td>${v.length ? fx(v.reduce((a, b) => a + b, 0) / v.length) : '-'}</td>
      <td>${canW && mine(i) ? `<div class="acts"><button class="icon-btn sm" title="Ubah" aria-label="Ubah" onclick="nilaiForm('${esc(i.id)}')">${ic('edit')}</button><button class="icon-btn sm" title="Hapus" aria-label="Hapus" onclick="nilaiHapus('${esc(i.id)}')">${ic('delete')}</button></div>` : ''}</td></tr>`; }).join('')}</tbody></table>` : emptyBox('grading', 'Belum ada penilaian untuk kelas dan mata pelajaran ini.')}</div></div>
    <div class="card"><div class="pad"><h3>Nilai Akhir Sementara</h3></div><div class="tbl-wrap">${d.roster.length ? `<table class="tbl"><thead><tr><th>NIS</th><th>Nama</th><th>Formatif</th><th>Sumatif</th><th>SAS</th><th>Nilai Akhir</th><th>Predikat</th></tr></thead><tbody>${d.roster.map(s => {
      const f = avgOf(d.items, 'Formatif', s.id), sv = avgOf(d.items, 'Sumatif', s.id), a = avgOf(d.items, 'SAS', s.id), ak = calcAkhir(f, sv, a);
      return `<tr><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td><td>${fx(f)}</td><td>${fx(sv)}</td><td>${fx(a)}</td><td><b>${fx(ak)}</b></td><td>${predOf(ak)}</td></tr>`; }).join('')}</tbody></table>` : emptyBox('groups', 'Belum ada siswa aktif di kelas ini.')}</div></div>`;
}
function nilaiForm(id) {
  const { p, d } = S.nl, it = id ? d.items.find(x => x.id === id) : { jenis: 'Formatif', judul: '', skor: {} };
  modal({ title: id ? 'Ubah Penilaian' : 'Tambah Penilaian', wide: true, body: `<div class="grid g2"><div class="field"><label class="label" for="nf_j">Jenis</label><select id="nf_j" class="input">${['Formatif', 'Sumatif', 'SAS'].map(j => `<option ${it.jenis === j ? 'selected' : ''}>${j}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="nf_t">Judul (mis. Formatif 1 - Bab 2)</label><input id="nf_t" class="input" maxlength="100" value="${esc(it.judul)}"></div></div>
    <div class="row" style="margin-bottom:.75rem"><button class="btn btn-outline btn-sm" onclick="nilaiTemplate()">${ic('download')} Template Excel</button><button class="btn btn-outline btn-sm" onclick="nilaiPick()">${ic('upload_file')} Isi dari Excel</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>NIS</th><th>Nama</th><th>Nilai (0-100)</th></tr></thead><tbody>${d.roster.map(s => `<tr><td>${esc(s.nis)}</td><td>${esc(s.nama)}</td><td><input class="input nl-in" type="number" min="0" max="100" step="any" inputmode="decimal" data-sid="${esc(s.id)}" data-nis="${esc(s.nis)}" aria-label="Nilai ${esc(s.nama)}" value="${it.skor[s.id] === undefined ? '' : esc(it.skor[s.id])}"></td></tr>`).join('')}</tbody></table></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="nfSave">${ic('save')} Simpan Nilai</button>` });
  $('#nfSave').onclick = async () => {
    const skor = {}; $$('.nl-in').forEach(i => { if (i.value !== '') skor[i.dataset.sid] = i.value; });
    busy($('#nfSave'), true, 'Menyimpan…');
    const r = await api('nilaiSave', { id: id || '', id_rombel: p.id_rombel, id_mapel: p.id_mapel, jenis: $('#nf_j').value, judul: $('#nf_t').value, skor }); busy($('#nfSave'), false);
    if (r === undefined) return; closeModal(); toast('Tersimpan', r.jumlah + ' nilai tersimpan.'); nilaiLoad();
  };
}
async function nilaiTemplate() {
  try { await loadLib(LIB.xlsx); } catch (e) { toast('Gagal', e.message, 'bad'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['NIS', 'Nama', 'Nilai']].concat(S.nl.d.roster.map(s => [s.nis, s.nama, '']))), 'Nilai');
  XLSX.writeFile(wb, 'Template_Nilai.xlsx');
}
function nilaiPick() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls,.csv'; i.onchange = () => nilaiBaca(i.files[0]); i.click(); }
async function nilaiBaca(f) {
  if (!f) return;
  try {
    await loadLib(LIB.xlsx);
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const byNis = {}; rows.forEach(r => { const k = Object.keys(r).reduce((o, x) => { o[x.trim().toLowerCase()] = r[x]; return o; }, {}); byNis[String(k.nis).trim()] = k.nilai; });
    let n = 0; $$('.nl-in').forEach(i => { const v = byNis[i.dataset.nis]; if (v !== undefined && String(v).trim() !== '') { i.value = String(v).replace(',', '.'); n++; } });
    toast('Terisi', n + ' nilai diisi dari berkas. Periksa lalu klik Simpan.');
  } catch (e) { toast('Gagal membaca berkas', e.message, 'bad'); }
}
async function nilaiHapus(id) {
  if (!await confirmBox('Hapus penilaian ini beserta seluruh nilainya?', { danger: true, ok: 'Hapus' })) return;
  if (await api('nilaiHapus', { id }) !== undefined) { toast('Dihapus', 'Penilaian dihapus.'); nilaiLoad(); }
}

const RAPOR_BADGE = { Draft: 'b-gray', Menunggu: 'b-warn', Disetujui: 'b-ok', Ditolak: 'b-bad' };
ADM.rapor = async () => {
  await loadRefs();
  const mine = (S.user.ref_id ? S.refs.rombel.find(x => x.wali === S.user.ref_id) : null);
  $('#admMain').innerHTML = `<div class="card pad"><div class="grid g3"><div class="field"><label class="label" for="rp_rb">Kelas</label><select id="rp_rb" class="input">${opts(S.refs.rombel, mine ? mine.id : '', '— pilih —')}</select></div></div>
    <button class="btn btn-primary" onclick="raporLoad()">${ic('description')} Tampilkan Rapor</button></div><div id="rpBody" style="margin-top:1rem"></div>`;
  if (mine) raporLoad();
};
async function raporLoad() {
  const ok2 = navGuard();
  const id = $('#rp_rb').value; if (!id) { toast('Periksa', 'Pilih kelas.', 'warn'); return; }
  const d = await api('raporGet', { id_rombel: id }); if (d === undefined || !ok2()) return;
  S.rp = d; drawRapor();
}
function drawRapor() {
  const d = S.rp, r = S.user.peran, sa = r === 'super_admin', kep = sa || r === 'kepala', wali = sa || r === 'wali_kelas', st = d.statusKelas;
  const edit = wali && st !== 'Disetujui';
  const act = [`<button class="btn btn-outline" onclick="raporCetak('')">${ic('print')} Cetak Semua</button>`];
  if (wali && ['Draft', 'Ditolak'].includes(st)) act.push(`<button class="btn btn-primary" onclick="raporAksi('ajukan')">${ic('send')} Ajukan ke Kepala</button>`);
  if (kep && st === 'Menunggu') act.push(`<button class="btn btn-primary" onclick="raporAksi('setujui')">${ic('check_circle')} Setujui</button><button class="btn btn-danger" onclick="raporAksi('tolak')">${ic('cancel')} Tolak</button>`);
  if (sa && st === 'Disetujui') act.push(`<button class="btn btn-outline" onclick="raporAksi('buka')">${ic('lock_open')} Buka Kunci</button>`);
  $('#rpBody').innerHTML = `<div class="card pad" style="margin-bottom:1rem"><div class="row"><div style="flex:1;min-width:220px"><h3>Kelas ${esc(d.rombel.nama)} <span class="badge ${RAPOR_BADGE[st]}">${esc(st)}</span></h3>
    <p class="muted" style="margin:0;font-size:.85rem">${esc(d.semester)} ${esc(d.ta)} · Wali kelas: ${esc(d.rombel.wali.nama || 'belum ditetapkan')}</p></div>${act.join('')}</div></div>
    <div class="card"><div class="tbl-wrap">${d.siswa.length ? `<table class="tbl"><thead><tr><th>NIS</th><th>Nama</th>${d.mapel.map(m => `<th title="${esc(m.nama)}">${esc(m.nama.slice(0, 14))}</th>`).join('')}<th>Rata</th><th>S</th><th>I</th><th>A</th><th style="min-width:220px">Catatan Wali</th><th></th></tr></thead><tbody>${d.siswa.map(s => `<tr><td>${esc(s.nis)}</td><td><b>${esc(s.nama)}</b></td>
      ${d.mapel.map(m => { const n = s.nilai[m.id]; return `<td ${n && n.akhir !== null && n.akhir < m.kkm ? 'style="color:var(--bad);font-weight:700"' : ''}>${n ? fx(n.akhir) : '-'}</td>`; }).join('')}<td><b>${fx(s.rata)}</b></td><td>${s.S}</td><td>${s.I}</td><td>${s.A}</td>
      <td>${edit ? `<input class="input" maxlength="500" aria-label="Catatan ${esc(s.nama)}" value="${esc(s.catatan)}" onchange="raporCatatan('${esc(s.id)}',this)">` : esc(s.catatan || '-')}</td>
      <td><button class="icon-btn sm" title="Cetak rapor" aria-label="Cetak rapor ${esc(s.nama)}" onclick="raporCetak('${esc(s.id)}')">${ic('print')}</button></td></tr>`).join('')}</tbody></table>` : emptyBox('groups', 'Belum ada siswa aktif di kelas ini.')}</div></div>
    <p class="hint" style="margin-top:.75rem">Nilai merah berada di bawah KKM. Setelah disetujui Kepala Madrasah, nilai dan catatan dikunci.</p>`;
}
async function raporCatatan(sid, el) {
  const r = await api('raporSave', { id_rombel: S.rp.rombel.id, id_siswa: sid, catatan: el.value });
  if (r !== undefined) { const s = S.rp.siswa.find(x => x.id === sid); if (s) s.catatan = el.value; toast('Tersimpan', 'Catatan disimpan.'); }
}
async function raporAksi(aksi) {
  const msg = { ajukan: 'Ajukan rapor kelas ini ke Kepala Madrasah? Pastikan catatan sudah lengkap.', setujui: 'Setujui rapor seluruh kelas? Nilai akan dikunci.', tolak: 'Kembalikan rapor kelas ini ke wali kelas?', buka: 'Buka kunci rapor kelas ini?' }[aksi];
  if (!await confirmBox(msg, { danger: aksi === 'tolak' || aksi === 'buka' })) return;
  if (await api('raporStatus', { id_rombel: S.rp.rombel.id, aksi }) !== undefined) { toast('Berhasil', 'Status rapor diperbarui.'); raporLoad(); }
}
async function raporCetak(sid) {
  toast('Menyiapkan', 'Membuat PDF rapor, mohon tunggu…', 'warn');
  const d = await api('raporCetak', { id_rombel: S.rp.rombel.id, id_siswa: sid }); if (d && d !== true) showPdf(d);
}

ADM.portal = () => swr('portal', 'siswaSaya', {}, 'portal', d => {
  const p = d.profil, h = d.hadir, tuntas = d.nilai.filter(n => n.akhir !== null).length;
  $('#admMain').innerHTML = `<div class="card pad" style="margin-bottom:1.25rem"><h2>${esc(p.nama)}</h2><p class="muted" style="margin:0">NIS ${esc(p.nis)} · Kelas ${esc(p.kelas)}${p.wali ? ' · Wali kelas: ' + esc(p.wali) : ''} · ${esc(d.semester)} ${esc(d.ta)}</p></div>
    <div class="grid g4" style="margin-bottom:1.25rem"><div class="card kpi"><small>Sakit</small><b>${h.S}</b></div><div class="card kpi info"><small>Izin</small><b>${h.I}</b></div><div class="card kpi warn"><small>Alpa</small><b>${h.A}</b></div><div class="card kpi gold"><small>Status Rapor</small><b style="font-size:1.2rem">${esc(d.statusRapor)}</b></div></div>
    <div class="card" style="margin-bottom:1.25rem"><div class="pad"><h3>Nilai ${esc(d.semester)}</h3></div><div class="tbl-wrap">${d.nilai.length ? `<table class="tbl"><thead><tr><th>Mata Pelajaran</th><th>KKM</th><th>Formatif</th><th>Sumatif</th><th>SAS</th><th>Nilai Akhir</th><th>Predikat</th></tr></thead><tbody>${d.nilai.map(n => `<tr><td>${esc(n.mapel)}</td><td>${n.kkm}</td><td>${fx(n.f)}</td><td>${fx(n.s)}</td><td>${fx(n.sas)}</td><td><b ${n.akhir !== null && n.akhir < n.kkm ? 'style="color:var(--bad)"' : ''}>${fx(n.akhir)}</b></td><td>${esc(n.pred)}</td></tr>`).join('')}</tbody></table>` : emptyBox('grading', 'Nilai belum tersedia.')}</div></div>
    ${tagihanCard(d.tagihan)}<div class="card"><div class="pad"><h3>Jadwal Pelajaran</h3></div><div class="tbl-wrap">${d.jadwal.length ? `<table class="tbl"><thead><tr><th>Hari</th><th>Jam</th><th>Mata Pelajaran</th><th>Guru</th><th>Ruang</th></tr></thead><tbody>${d.jadwal.map(j => `<tr><td>${esc(j.hari)}</td><td>${esc(j.jam_ke)}</td><td>${esc(j.mapel)}</td><td>${esc(j.guru)}</td><td>${esc(j.ruang || '-')}</td></tr>`).join('')}</tbody></table>` : emptyBox('calendar_month', 'Jadwal belum tersedia.')}</div></div>`;
});

function akunDialog() {
  modal({ title: 'Buat Akun dari Data', body: `<p class="muted">Membuat akun login otomatis untuk siswa atau guru yang belum punya akun. Username siswa adalah NIS. Kata sandi dibuat acak dan wajib diganti saat login pertama.</p>
    <div class="row"><button class="btn btn-primary" onclick="akunBuat('siswa')">${ic('school')} Akun Siswa</button><button class="btn btn-primary" onclick="akunBuat('guru')">${ic('badge')} Akun Guru</button></div>` });
}
async function akunBuat(jenis) {
  closeModal(); const b = await api('akunBelum', { jenis }); if (b === undefined) return;
  if (!b.length) { toast('Info', 'Semua ' + jenis + ' aktif sudah punya akun.'); return; }
  if (!await confirmBox('Buat ' + b.length + ' akun ' + jenis + ' sekarang?')) return;
  const res = [];
  for (let i = 0; i < b.length; i += 40) {
    modal({ title: 'Membuat akun…', lock: true, body: `<div class="center"><div class="spin" style="margin:0 auto 1rem"></div><p>Memproses ${Math.min(i + 40, b.length)} dari ${b.length}…</p></div>` });
    const d = await api('akunDariData', { jenis, ids: b.slice(i, i + 40).map(x => x.id) });
    if (d === undefined) { closeModal(); break; } res.push(...d);
  }
  const u = await api('userList'); if (u) { S.cache.users = u; if (S.adm === 'pengguna') drawUsers(); }
  if (res.length) credBox('Akun Baru (' + res.length + ' akun)', res); else closeModal();
}
async function akunHubungkan() {
  if (!await confirmBox('Cocokkan akun yang sudah ada dengan data siswa/guru berdasarkan nama (atau NIS untuk siswa)? Hanya pencocokan yang tunggal yang diproses.', { ok: 'Hubungkan' })) return;
  const r = await api('akunHubungkan'); if (r === undefined) return;
  modal({ title: 'Hasil Penghubungan', body: `<p><b>${r.siswa}</b> akun siswa dan <b>${r.guru}</b> akun guru/staf terhubung.</p><p class="muted">${r.lewat} akun dilewati karena nama tidak ditemukan atau tidak unik. Pengguna perlu keluar dan masuk lagi agar perubahan berlaku.</p>`,
    foot: `<button class="btn btn-primary" onclick="closeModal()">Selesai</button>` });
}
const fileB64 = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(new Error('Gagal membaca berkas.')); fr.readAsDataURL(f); });
const photo = (id, w, cls) => `<div class="frame ${cls || ''}"><img class="bg" alt="" aria-hidden="true" loading="lazy" src="${img(id, 120)}"><img class="fg" alt="" loading="lazy" src="${img(id, w)}"></div>`;
const photoUrl = (url, cls) => `<div class="frame ${cls || ''}"><img class="fg" alt="" loading="lazy" src="${url}"></div>`;
const heroMini = (eyebrow, title) => `<section class="hero" style="padding:2.5rem 0"><div class="wrap"><div class="eyebrow" style="color:#F6DE9C">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div></section>`;
const PP_BADGE = { 'Draft': 'b-gray', 'Menunggu Verifikasi': 'b-warn', 'Perlu Perbaikan': 'b-bad', 'Terverifikasi': 'b-info', 'Dalam Seleksi': 'b-info', 'Diterima': 'b-ok', 'Tidak Diterima': 'b-bad', 'Mengundurkan Diri': 'b-gray' };
const PP_JENIS = [['KK', 'Kartu Keluarga (KK)', true], ['Akta', 'Akta Kelahiran', true], ['Foto', 'Pas Foto (latar polos)', true], ['Ijazah', 'Ijazah / Surat Keterangan Lulus (jika sudah ada)', false], ['Lainnya', 'Dokumen pendukung (sertifikat prestasi, dll.)', false]];
const KARYA_BADGE = { 'Draft': 'b-gray', 'Diajukan': 'b-warn', 'Disetujui Guru': 'b-info', 'Perlu Revisi': 'b-bad', 'Dipublikasikan': 'b-ok', 'Diarsipkan': 'b-gray' };
const KARYA_KAT = ['Esai', 'Artikel', 'Opini', 'Cerpen', 'Puisi', 'Laporan Kegiatan'];

PUB.ppdb = async () => {
  const c = S.cfg;
  $('#pubMain').innerHTML = heroMini('Penerimaan Peserta Didik Baru', 'PPDB Online') + `<section class="section"><div class="wrap" style="max-width:900px"><div id="ppStatus"></div>
    ${c.ppdb_info ? `<div class="card pad prose" style="margin-bottom:1rem">${para(c.ppdb_info)}</div>` : ''}
    <div class="row" style="margin-bottom:1rem"><button class="chip on" id="ppT1" onclick="ppTab('daftar')">Formulir Pendaftaran</button><button class="chip" id="ppT2" onclick="ppTab('cek')">Cek Status / Unggah Berkas</button></div><div id="ppBody">${skeleton(1)}</div></div></section>`;
  const d = await pub('ppdbInfo');
  S.ppInfo = d && d !== true ? d : { open: false, msg: 'Informasi pendaftaran belum dapat dimuat.', jalur: ['Reguler'], tahun: '' };
  if (S.page !== 'ppdb') return;
  $('#ppStatus').innerHTML = `<div class="card pad" style="margin-bottom:1rem;border-left:4px solid ${S.ppInfo.open ? 'var(--primary)' : 'var(--warn)'}"><b>${S.ppInfo.open ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup'}</b> · Tahun ajaran ${esc(S.ppInfo.tahun || '-')}${S.ppInfo.open ? '' : '<br>' + esc(S.ppInfo.msg)}</div>`;
  ppTab('daftar');
};
function ppTab(t) {
  $('#ppT1').classList.toggle('on', t === 'daftar'); $('#ppT2').classList.toggle('on', t === 'cek');
  if (t === 'cek') {
    $('#ppBody').innerHTML = `<form class="card pad" onsubmit="ppCek(event)" novalidate><h3 style="margin-bottom:.5rem">Cek Status Pendaftaran</h3><p class="muted" style="font-size:.88rem">Masukkan nomor pendaftaran dan tanggal lahir calon siswa.</p>
      <div class="grid g2"><div class="field"><label class="label" for="ck_no">Nomor Pendaftaran</label><input id="ck_no" class="input" placeholder="PPDB-2027-0001" autocomplete="off"></div>
      <div class="field"><label class="label" for="ck_tgl">Tanggal Lahir</label><input id="ck_tgl" type="date" class="input"></div></div><button class="btn btn-primary" id="ckBtn" type="submit">${ic('search')} Cek Status</button></form><div id="ppHasil" style="margin-top:1rem"></div>`;
    return;
  }
  if (!S.ppInfo.open) { $('#ppBody').innerHTML = `<div class="card">${emptyBox('event_busy', S.ppInfo.msg || 'Pendaftaran belum dibuka.')}</div>`; return; }
  const f = (k, l, req, inner) => `<div class="field"><label class="label" for="pp_${k}">${l}${req ? ' <span class="req">*</span>' : ''}</label>${inner}</div>`;
  const inp = (k, ex) => `<input id="pp_${k}" class="input" ${ex || ''}>`;
  $('#ppBody').innerHTML = `<form class="card pad" onsubmit="ppDaftar(event)" novalidate><h3 style="margin-bottom:1rem">Data Calon Siswa</h3><div class="grid g2">
    ${f('nama', 'Nama Lengkap', 1, inp('nama', 'maxlength="100" autocomplete="name"'))}${f('jk', 'Jenis Kelamin', 1, '<select id="pp_jk" class="input"><option value="">— pilih —</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>')}
    ${f('tempat_lahir', 'Tempat Lahir', 1, inp('tempat_lahir', 'maxlength="80"'))}${f('tgl_lahir', 'Tanggal Lahir', 1, inp('tgl_lahir', 'type="date"'))}
    ${f('nisn', 'NISN (10 digit, jika ada)', 0, inp('nisn', 'inputmode="numeric" maxlength="10"'))}${f('jalur', 'Jalur Pendaftaran', 1, `<select id="pp_jalur" class="input">${(S.ppInfo.jalur || ['Reguler']).map(j => `<option>${esc(j)}</option>`).join('')}</select>`)}
    ${f('asal_sekolah', 'Asal Sekolah', 1, inp('asal_sekolah', 'maxlength="100"'))}${f('tahun_lulus', 'Tahun Lulus', 0, inp('tahun_lulus', 'inputmode="numeric" maxlength="4"'))}</div>
    <div class="field"><label class="label" for="pp_alamat">Alamat Lengkap <span class="req">*</span></label><textarea id="pp_alamat" class="input" maxlength="300"></textarea></div>
    <h3 style="margin:1rem 0">Data Orang Tua / Wali</h3><div class="grid g2">${f('nama_wali', 'Nama Orang Tua / Wali', 1, inp('nama_wali', 'maxlength="100"'))}${f('no_wa', 'Nomor WhatsApp', 1, inp('no_wa', 'inputmode="tel" maxlength="16" placeholder="08xxxxxxxxxx"'))}
    ${f('email', 'Email (opsional)', 0, inp('email', 'type="email" maxlength="100"'))}</div>
    <input id="pp_web" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
    <label class="field row" style="flex-wrap:nowrap;font-size:.85rem;margin-top:1rem"><input type="checkbox" id="pp_setuju" style="width:20px;height:20px;flex:none"> Saya menyatakan data yang diisi benar dan menyetujui data diproses untuk keperluan penerimaan peserta didik baru.</label>
    <button class="btn btn-primary" id="ppBtn" type="submit">${ic('arrow_forward')} Simpan dan Lanjut Unggah Berkas</button></form>`;
}
async function ppDaftar(e) {
  e.preventDefault();
  const g = k => $('#pp_' + k).value, b = $('#ppBtn');
  const data = { nama: g('nama'), jk: g('jk'), tempat_lahir: g('tempat_lahir'), tgl_lahir: g('tgl_lahir'), nisn: g('nisn'), jalur: g('jalur'), asal_sekolah: g('asal_sekolah'), tahun_lulus: g('tahun_lulus'),
    alamat: g('alamat'), nama_wali: g('nama_wali'), no_wa: g('no_wa'), email: g('email'), setuju: $('#pp_setuju').checked, website: g('web') };
  busy(b, true, 'Menyimpan…'); const r = await pub('ppdbDaftar', data); busy(b, false);
  if (!r || r === true) return;
  S.pp = { nomor: r.nomor, tgl_lahir: data.tgl_lahir, berkas: [] };
  ppUnggahView(null); window.scrollTo(0, 0);
}
function ppUnggahView(cek) {
  const p = S.pp, ada = {}; (p.berkas || []).forEach(x => { ada[x.jenis] = x.nama_file; });
  $('#ppBody').innerHTML = `<div class="card pad"><div class="center"><div class="eyebrow">Nomor Pendaftaran</div><div style="font-size:1.8rem;font-weight:800;color:var(--primary)" id="ppNomor">${esc(p.nomor)}</div>
    <p class="muted" style="font-size:.88rem">Simpan nomor ini dan tanggal lahir calon siswa untuk mengecek status dan melengkapi berkas.</p></div>
    ${cek && cek.catatan ? `<div class="card pad" style="border-left:4px solid var(--bad);margin:1rem 0"><b>Catatan panitia:</b><br>${esc(cek.catatan)}</div>` : ''}
    <h3 style="margin:1rem 0 .25rem">Unggah Berkas</h3><p class="hint" style="margin-bottom:1rem">Format JPG, PNG, atau PDF, maksimal 2,5 MB per berkas. Berkas hanya dapat dilihat oleh panitia. Tanda * wajib diunggah.</p>
    ${PP_JENIS.map(([j, l, w]) => `<div class="field"><label class="label" for="ppf_${j}">${l}${w ? ' <span class="req">*</span>' : ''}</label><div class="row" style="flex-wrap:nowrap"><input id="ppf_${j}" type="file" class="input" accept="image/png,image/jpeg,application/pdf" onchange="ppUnggah('${j}',this)">
      <span id="pps_${j}" class="badge ${ada[j] ? 'b-ok' : 'b-gray'}" style="min-width:76px;justify-content:center">${ada[j] ? 'Terunggah' : 'Belum'}</span></div></div>`).join('')}
    <button class="btn btn-primary" id="ppKirim" onclick="ppKirim()">${ic('send')} Kirim Pendaftaran</button></div>`;
}
async function ppUnggah(j, input) {
  const f = input.files[0]; if (!f) return;
  const st = $('#pps_' + j); st.textContent = 'Mengunggah…'; st.className = 'badge b-warn';
  try {
    let data, mime;
    if (f.type === 'application/pdf') { if (f.size > 2500000) throw new Error('PDF maksimal 2,5 MB.'); data = await fileB64(f); mime = f.type; }
    else { const im = await fileToImage(f, 1600); data = im.data; mime = im.mime; }
    const r = await pub('ppdbBerkas', { nomor: S.pp.nomor, tgl_lahir: S.pp.tgl_lahir, jenis: j, mime: mime, data: data, name: f.name });
    if (r && r !== true) { S.pp.berkas = r; st.textContent = 'Terunggah'; st.className = 'badge b-ok'; } else { st.textContent = 'Gagal'; st.className = 'badge b-bad'; }
  } catch (e) { toast('Gagal', e.message, 'bad'); st.textContent = 'Gagal'; st.className = 'badge b-bad'; }
  input.value = '';
}
async function ppKirim() {
  const b = $('#ppKirim'); busy(b, true, 'Mengirim…');
  const r = await pub('ppdbKirim', { nomor: S.pp.nomor, tgl_lahir: S.pp.tgl_lahir }); busy(b, false);
  if (!r) return;
  $('#ppBody').innerHTML = `<div class="card pad center"><div class="spin-ok" style="font-size:3rem;color:var(--primary)">${ic('check_circle')}</div><h2>Pendaftaran Terkirim</h2><p>Nomor pendaftaran Anda</p>
    <div style="font-size:1.8rem;font-weight:800;color:var(--primary)">${esc(S.pp.nomor)}</div><p class="muted">Panitia akan memeriksa berkas Anda. Cek status secara berkala lewat menu Cek Status.</p>
    <div class="row" style="justify-content:center"><button class="btn btn-primary" onclick="ppBukti()">${ic('download')} Unduh Bukti Pendaftaran</button><button class="btn btn-outline" onclick="ppTab('cek')">Cek Status</button></div></div>`;
  window.scrollTo(0, 0);
}
async function ppBukti() { const d = await pub('ppdbBukti', { nomor: S.pp.nomor, tgl_lahir: S.pp.tgl_lahir }); if (d && d !== true) showPdf(d); }
async function ppCek(e) {
  e.preventDefault(); const b = $('#ckBtn'); busy(b, true, 'Memeriksa…');
  const nomor = $('#ck_no').value.trim(), tgl = $('#ck_tgl').value, d = await pub('ppdbCek', { nomor: nomor, tgl_lahir: tgl }); busy(b, false);
  if (!d || d === true) return;
  S.pp = { nomor: d.nomor, tgl_lahir: tgl, berkas: d.berkas };
  const wajib = d.wajib.map(j => `<span class="badge ${d.berkas.some(x => x.jenis === j) ? 'b-ok' : 'b-bad'}">${esc(j)}</span>`).join(' ');
  $('#ppHasil').innerHTML = `<div class="card pad"><div class="row"><div style="flex:1"><div class="eyebrow">${esc(d.nomor)}</div><h3>${esc(d.nama)}</h3><p class="muted" style="margin:0;font-size:.85rem">Jalur ${esc(d.jalur)} · ${esc(d.tahun)}</p></div><span class="badge ${PP_BADGE[d.status] || 'b-gray'}" style="font-size:.85rem">${esc(d.status)}</span></div>
    ${d.catatan ? `<div class="card pad" style="border-left:4px solid var(--bad);margin-top:1rem"><b>Catatan panitia:</b><br>${esc(d.catatan)}</div>` : ''}
    <p style="margin:1rem 0 .25rem"><b>Berkas wajib:</b> ${wajib}</p><div class="row" style="margin-top:1rem">${d.bolehUnggah ? `<button class="btn btn-primary" onclick="ppUnggahView(S.ppCek)">${ic('upload_file')} Unggah / Perbaiki Berkas</button>` : ''}${d.status !== 'Draft' ? `<button class="btn btn-outline" onclick="ppBukti()">${ic('download')} Unduh Bukti</button>` : ''}</div></div>`;
  S.ppCek = d;
}

PUB.galeri = async () => {
  $('#pubMain').innerHTML = heroMini('Dokumentasi', 'Galeri Kegiatan') + `<section class="section"><div class="wrap"><div id="galBar" class="row" style="margin-bottom:1rem"></div><div id="galGrid">${skeleton(3)}</div></div></section>`;
  if (!S.galeri) { const d = await pub('galeri'); S.galeri = d && d !== true ? d : []; }
  if (S.page === 'galeri') drawGaleri();
};
function drawGaleri() {
  const cats = [...new Set(S.galeri.map(g => g.kategori))], k = S.gk || '';
  $('#galBar').innerHTML = `<button class="chip ${k ? '' : 'on'}" onclick="S.gk='';drawGaleri()">Semua</button>${cats.map(c => `<button class="chip ${k === c ? 'on' : ''}" data-cat="${esc(c)}" onclick="S.gk=this.dataset.cat;drawGaleri()">${esc(c)}</button>`).join('')}`;
  const list = S.galeri.map((g, i) => [g, i]).filter(([g]) => !k || g.kategori === k);
  $('#galGrid').innerHTML = list.length ? `<div class="gal">${list.map(([g, i]) => `<button onclick="galBuka(${i})" aria-label="${esc(g.judul)}">${g.file_id ? photo(g.file_id, 600, 'r43') : g.video ? photoUrl(`https:\/\/img.youtube.com/vi/${esc(g.video)}/hqdefault.jpg`, 'r43') : `<div class="thumb-ph">${ic('image')}</div>`}${g.video ? '<span class="play">Video</span>' : ''}<div class="cap">${esc(g.judul)}</div></button>`).join('')}</div>` : emptyBox('photo_library', 'Belum ada foto di galeri.');
}
function galBuka(i) {
  const g = S.galeri[i];
  modal({ title: g.judul, wide: true, body: `${g.file_id ? photo(g.file_id, 1400, 'auto') : ''}<p class="meta" style="margin:.75rem 0 0"><span class="badge b-sage">${esc(g.kategori)}</span>${g.tgl ? `<span>${esc(fmtD(g.tgl))}</span>` : ''}</p>${g.deskripsi ? `<div class="prose" style="margin-top:.5rem">${para(g.deskripsi)}</div>` : ''}`,
    foot: `${g.video ? `<a class="btn btn-primary" href="https:\/\/www.youtube.com/watch?v=${esc(g.video)}" target="_blank" rel="noopener">${ic('play_circle')} Tonton di YouTube</a>` : ''}<button class="btn btn-outline" onclick="closeModal()">Tutup</button>` });
}

PUB.unduhan = async () => {
  $('#pubMain').innerHTML = heroMini('Dokumen Publik', 'Unduhan') + `<section class="section"><div class="wrap" style="max-width:960px" id="dlBody">${skeleton(1)}</div></section>`;
  if (!S.unduhan) { const d = await pub('unduhan'); S.unduhan = d && d !== true ? d : []; }
  if (S.page !== 'unduhan') return;
  const cats = [...new Set(S.unduhan.map(x => x.kategori))];
  $('#dlBody').innerHTML = S.unduhan.length ? cats.map(c => `<h3 style="margin:1.5rem 0 .75rem">${esc(c)}</h3><div class="grid">${S.unduhan.filter(x => x.kategori === c).map(x => `<div class="card pad dl-row"><div style="flex:1;min-width:200px"><b>${esc(x.judul)}</b>${x.periode ? ` <span class="badge b-sage">${esc(x.periode)}</span>` : ''}${x.deskripsi ? `<div class="muted" style="font-size:.85rem">${esc(x.deskripsi)}</div>` : ''}</div>
    <a class="btn btn-primary btn-sm" href="https:\/\/drive.google.com/uc?export=download&id=${encodeURIComponent(x.file_id)}" target="_blank" rel="noopener">${ic('download')} Unduh</a></div>`).join('')}</div>`).join('') : emptyBox('folder_open', 'Belum ada dokumen untuk diunduh.');
};

PUB.karya = async () => {
  $('#pubMain').innerHTML = heroMini('Ruang Literasi', 'Karya Siswa') + `<section class="section"><div class="wrap"><p class="muted" style="max-width:70ch">Esai, artikel, dan karya tulis siswa yang telah ditinjau guru. Mari semangati penulis-penulis muda kita.</p><div id="kyBar" class="row" style="margin-bottom:1rem"></div><div id="kyBody">${skeleton(3)}</div></div></section>`;
  if (!S.karya) { const d = await pub('karya'); S.karya = d && d !== true ? d : []; }
  if (S.page === 'karya') drawKarya();
};
const karyaCard = k => `<article class="card card-hover pad" style="cursor:pointer" tabindex="0" role="link" aria-label="${esc(k.judul)}" onclick="go('karya-detail','${esc(k.slug)}')" onkeydown="if(event.key==='Enter')go('karya-detail','${esc(k.slug)}')">
  <div class="meta"><span class="badge b-sage">${esc(k.kategori)}</span>${k.unggulan ? '<span class="badge b-gold" style="background:var(--warn-bg);color:var(--warn)">Karya Pilihan</span>' : ''}</div><h3 class="line2" style="margin:.5rem 0">${esc(k.judul)}</h3>
  <p class="muted line3" style="font-size:.85rem">${esc(k.ringkasan)}</p><div class="meta"><span>${esc(k.nama)}${k.kelas ? ' · ' + esc(k.kelas) : ''}</span><span>${esc(fmtD(k.tgl_terbit))}</span></div></article>`;
function drawKarya() {
  const cats = [...new Set(S.karya.map(x => x.kategori))], k = S.kk || '', pilihan = S.karya.filter(x => x.unggulan);
  $('#kyBar').innerHTML = `<button class="chip ${k ? '' : 'on'}" onclick="S.kk='';drawKarya()">Semua</button>${cats.map(c => `<button class="chip ${k === c ? 'on' : ''}" data-cat="${esc(c)}" onclick="S.kk=this.dataset.cat;drawKarya()">${esc(c)}</button>`).join('')}`;
  const list = S.karya.filter(x => !k || x.kategori === k);
  $('#kyBody').innerHTML = (pilihan.length && !k ? `<h3 style="margin-bottom:.75rem">Karya Pilihan</h3><div class="grid g3" style="margin-bottom:1.5rem">${pilihan.map(karyaCard).join('')}</div><h3 style="margin-bottom:.75rem">Semua Karya</h3>` : '') +
    (list.length ? `<div class="grid g3">${list.map(karyaCard).join('')}</div>` : emptyBox('edit_note', 'Belum ada karya yang diterbitkan.'));
}
PUB['karya-detail'] = async slug => {
  $('#pubMain').innerHTML = `<section class="section"><div class="wrap">${skeleton(1)}</div></section>`;
  const d = await pub('karyaDetail', { slug: slug });
  if (!d || d === true) { go('karya'); return; }
  $('#pubMain').innerHTML = `<section class="section"><div class="wrap" style="max-width:780px"><button class="btn btn-ghost btn-sm" onclick="go('karya')">${ic('arrow_back')} Kembali</button><article class="card pad" style="margin-top:1rem;padding:1.5rem">
    <div class="meta"><span class="badge b-sage">${esc(d.kategori)}</span><span>${esc(fmtD(d.tgl_terbit))}</span></div><h1 style="font-size:1.8rem;margin:.75rem 0">${esc(d.judul)}</h1><p class="muted">Oleh <b>${esc(d.nama)}</b>${d.kelas ? ' · ' + esc(d.kelas) : ''}</p><div class="prose">${para(d.isi)}</div></article></div></section>`;
};

function pickFile(input, targetId, nameId) {
  const f = input.files[0]; if (!f) return;
  (async () => {
    try {
      if (f.size > 4000000) throw new Error('Ukuran berkas maksimal 4 MB.');
      if (!f.type) throw new Error('Format berkas tidak dikenali.');
      toast('Mengunggah', 'Mohon tunggu…', 'warn');
      const d = await api('uploadDok', { data: await fileB64(f), mime: f.type, name: f.name });
      if (d === undefined) return;
      $('#' + targetId).value = d.id; if (nameId && $('#' + nameId)) $('#' + nameId).value = d.nama;
      $('#' + targetId + '_p').innerHTML = `<span class="badge b-ok">${esc(d.nama)}</span>`;
      toast('Berhasil', 'Berkas diunggah.');
    } catch (e) { toast('Gagal', e.message, 'bad'); }
    input.value = '';
  })();
}
const fileField = (id, val, nameVal) => `<input type="hidden" id="${id}" value="${esc(val || '')}"><div id="${id}_p">${val ? `<span class="badge b-ok">${esc(nameVal || 'Berkas tersimpan')}</span>` : ''}</div>
  <input type="file" class="input" style="margin-top:.4rem" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onchange="pickFile(this,'${id}','mf_nama_file')" aria-label="Pilih berkas">`;

ADM.ppdb = () => swr('ppdb', 'ppdbList', {}, 'ppdb', d => { S.pd = d; if (!S.pdf) S.pdf = { q: '', st: '', jl: '' }; drawPpdb(); });
function drawPpdb() {
  const d = S.pd, rows = d.rows.filter(x => x.status !== 'Draft'), cnt = s => rows.filter(x => x.status === s).length;
  const kpi = (l, v, c) => `<div class="card kpi ${c || ''}"><small>${l}</small><b>${v}</b></div>`;
  $('#admMain').innerHTML = `<div class="grid g4" style="margin-bottom:1.25rem">${kpi('Total Pendaftar', rows.length)}${kpi('Menunggu Verifikasi', cnt('Menunggu Verifikasi'), 'warn')}${kpi('Perlu Perbaikan', cnt('Perlu Perbaikan'), 'warn')}${kpi('Terverifikasi / Seleksi', cnt('Terverifikasi') + cnt('Dalam Seleksi'), 'info')}${kpi('Diterima', cnt('Diterima'), 'gold')}</div>
    <div class="toolbar"><input class="input" type="search" placeholder="Cari nama / nomor / NISN…" aria-label="Cari" oninput="S.pdf.q=this.value.toLowerCase();debounce(drawPpdbTable,150)()" value="${esc(S.pdf.q)}">
    <select class="input" style="max-width:210px" aria-label="Filter status" onchange="S.pdf.st=this.value;drawPpdbTable()"><option value="">Semua status</option>${d.status.filter(x => x !== 'Draft').map(x => `<option ${S.pdf.st === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <select class="input" style="max-width:180px" aria-label="Filter jalur" onchange="S.pdf.jl=this.value;drawPpdbTable()"><option value="">Semua jalur</option>${d.jalur.map(x => `<option ${S.pdf.jl === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><span style="flex:1"></span>
    <button class="btn btn-outline" onclick="ppdbExport()">${ic('table_view')} Ekspor Excel</button><button class="btn btn-outline" onclick="ppdbCetak(this)">${ic('print')} Cetak PDF</button></div>
    <div class="card"><div class="tbl-wrap" id="pdTable"></div></div><p class="hint" style="margin-top:.5rem">Tahun penerimaan ${esc(d.tahun)}. Pendaftar yang belum mengirim formulir tidak ditampilkan.</p>`;
  drawPpdbTable();
}
function ppdbFiltered() {
  const f = S.pdf;
  return S.pd.rows.filter(x => x.status !== 'Draft' && (!f.st || x.status === f.st) && (!f.jl || x.jalur === f.jl) && (!f.q || (x.nama + ' ' + x.no_pendaftaran + ' ' + x.nisn).toLowerCase().includes(f.q)));
}
function drawPpdbTable() {
  const rows = ppdbFiltered();
  $('#pdTable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>No. Pendaftaran</th><th>Nama</th><th>Asal Sekolah</th><th>Jalur</th><th>Berkas</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x => `<tr>
    <td style="font-family:monospace">${esc(x.no_pendaftaran)}</td><td><b>${esc(x.nama)}</b><div class="hint">${esc(x.nisn || 'NISN -')}</div></td><td>${esc(x.asal_sekolah)}</td><td>${esc(x.jalur)}</td>
    <td><span class="badge ${x.berkas >= S.pd.wajib ? 'b-ok' : 'b-warn'}">${x.berkas} berkas</span></td><td><span class="badge ${PP_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span>${x.siswa_id ? ' <span class="badge b-sage">Siswa</span>' : ''}</td>
    <td><button class="icon-btn sm" title="Lihat detail" aria-label="Lihat detail ${esc(x.nama)}" onclick="ppdbDetail('${esc(x.id)}')">${ic('open_in_new')}</button></td></tr>`).join('')}</tbody></table>` : emptyBox('how_to_reg', 'Belum ada pendaftar yang sesuai.');
}
async function ppdbDetail(id) {
  const d = await api('ppdbGet', { id: id }); if (d === undefined) return;
  const x = d.data, canW = ['super_admin', 'tu'].includes(S.user.peran), row = (a, b) => `<tr><td style="width:36%;color:var(--muted)">${a}</td><td>${esc(b || '-')}</td></tr>`;
  S.pdcur = { id: id, x: x, saran: d.saran };
  modal({ title: x.nama, wide: true, body: `<div class="row" style="margin-bottom:.75rem"><span class="badge ${PP_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span><span style="font-family:monospace">${esc(x.no_pendaftaran)}</span></div>
    ${x.catatan ? `<p class="hint" style="color:var(--bad)">Catatan: ${esc(x.catatan)}</p>` : ''}<div class="grid g2"><div><h3 style="margin-bottom:.5rem">Data Pendaftar</h3><table class="tbl"><tbody>${row('NISN', x.nisn)}${row('Jenis Kelamin', x.jk === 'L' ? 'Laki-laki' : 'Perempuan')}${row('Tempat, Tgl Lahir', x.tempat_lahir + ', ' + fmtD(x.tgl_lahir))}${row('Alamat', x.alamat)}${row('Asal Sekolah', x.asal_sekolah + (x.tahun_lulus ? ' (' + x.tahun_lulus + ')' : ''))}${row('Jalur', x.jalur)}${row('Orang Tua/Wali', x.nama_wali)}${row('WhatsApp', x.no_wa)}${row('Email', x.email)}</tbody></table></div>
    <div><h3 style="margin-bottom:.5rem">Berkas</h3>${d.berkas.length ? d.berkas.map(b => `<div class="row" style="justify-content:space-between;margin-bottom:.4rem"><span><span class="badge b-sage">${esc(b.jenis)}</span> ${esc(b.nama_file)}</span><button class="btn btn-outline btn-sm" onclick="ppdbLihat('${esc(b.id)}')">Lihat</button></div>`).join('') : '<p class="muted">Belum ada berkas.</p>'}
    <h3 style="margin:1rem 0 .5rem">Riwayat Status</h3>${d.riwayat.map(r => `<div style="font-size:.82rem;margin-bottom:.35rem"><span class="badge ${PP_BADGE[r.status] || 'b-gray'}">${esc(r.status)}</span> ${esc(fmtDT(r.waktu))} · ${esc(r.oleh)}${r.catatan ? '<br><span class="muted">' + esc(r.catatan) + '</span>' : ''}</div>`).join('')}</div></div>
    ${canW && x.status !== 'Draft' && !x.siswa_id ? `<h3 style="margin:1rem 0 .5rem">Ubah Status</h3><div class="grid g2"><div class="field"><label class="label" for="pd_st">Status</label><select id="pd_st" class="input">${S.pd.status.filter(s => s !== 'Draft').map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="pd_cat">Catatan (wajib untuk Perlu Perbaikan / Tidak Diterima)</label><input id="pd_cat" class="input" maxlength="300"></div></div>` : ''}`,
    foot: `${S.user.peran === 'super_admin' ? `<button class="btn btn-danger" onclick="ppdbHapus('${esc(id)}')">${ic('delete')} Hapus</button>` : ''}${canW && x.status === 'Diterima' && !x.siswa_id ? `<button class="btn btn-outline" onclick="ppdbPindahForm()">${ic('school')} Pindahkan ke Data Siswa</button>` : ''}
    ${canW && x.status !== 'Draft' && !x.siswa_id ? `<button class="btn btn-primary" id="pdSave">${ic('save')} Simpan Status</button>` : '<button class="btn btn-outline" onclick="closeModal()">Tutup</button>'}` });
  if ($('#pdSave')) $('#pdSave').onclick = async () => {
    const r = await api('ppdbStatus', { id: id, status: $('#pd_st').value, catatan: $('#pd_cat').value });
    if (r !== undefined) { closeModal(); toast('Berhasil', 'Status diperbarui.'); S.cache.ppdb = null; ADM.ppdb(); }
  };
}
async function ppdbLihat(bid) {
  const d = await api('ppdbBerkasLihat', { id: bid }); if (d === undefined) return;
  const url = 'data:' + d.mime + ';base64,' + d.base64;
  modal({ title: d.nama, wide: true, body: d.mime === 'application/pdf' ? `<iframe title="Berkas" src="${url}" style="width:100%;height:65vh;border:1px solid var(--border);border-radius:10px"></iframe><p class="hint">Jika pratinjau kosong, klik Unduh.</p>` : `<img alt="${esc(d.nama)}" style="max-width:100%;border-radius:10px" src="${url}">`,
    foot: `<button class="btn btn-outline" id="pdDl">${ic('download')} Unduh</button><button class="btn btn-primary" onclick="ppdbDetail(S.pdcur.id)">Kembali</button>` });
  $('#pdDl').onclick = () => { const bin = atob(d.base64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); download(d.nama, new Blob([arr], { type: d.mime })); };
}
async function ppdbPindahForm() {
  await loadRefs(true);
  const sr = S.pdcur.saran;
  modal({ title: 'Pindahkan ke Data Siswa', body: `<p class="muted">Data pendaftar akan disalin menjadi siswa aktif. Tentukan NIS dan kelasnya.</p><div class="field"><label class="label" for="pi_nis">NIS <span class="req">*</span></label><input id="pi_nis" class="input" maxlength="30"></div>
    <div class="field"><label class="label" for="pi_rb">Kelas</label><select id="pi_rb" class="input">${opts(S.refs.rombel, sr ? sr.id : '', '— pilih nanti —')}</select>${sr ? `<div class="hint" style="color:var(--primary)">Saran sistem: <b>${esc(sr.nama)}</b> (${sr.jumlah} siswa saat ini), ${esc(sr.alasan)}.</div>` : ''}</div>`,
    foot: `<button class="btn btn-outline" onclick="ppdbDetail(S.pdcur.id)">Batal</button><button class="btn btn-primary" id="piOk">Pindahkan</button>` });
  $('#piOk').onclick = async () => {
    const r = await api('ppdbPindah', { id: S.pdcur.id, nis: $('#pi_nis').value, id_rombel: $('#pi_rb').value });
    if (r !== undefined) { closeModal(); if (r.peringatan) toast('Perhatian', r.peringatan, 'warn'); else toast('Berhasil', 'Pendaftar dipindahkan ke Data Siswa.'); S.cache.ppdb = null; Object.keys(S.cache).forEach(k => { if (k.startsWith('m_')) delete S.cache[k]; }); ADM.ppdb(); }
  };
}
async function ppdbHapus(id) {
  if (!await confirmBox('Hapus pendaftar ini beserta seluruh berkasnya secara permanen?', { danger: true, ok: 'Hapus' })) return;
  if (await api('ppdbHapus', { id: id }) !== undefined) { toast('Dihapus', 'Data pendaftar dihapus.'); S.cache.ppdb = null; ADM.ppdb(); }
}
async function ppdbCetak(btn) {
  busy(btn, true, 'Menyiapkan…'); const d = await api('ppdbCetak', { status: S.pdf.st }); busy(btn, false);
  if (d && d !== true) showPdf(d);
}
async function ppdbExport() {
  try { await loadLib(LIB.xlsx); } catch (e) { toast('Gagal', e.message, 'bad'); return; }
  const rows = ppdbFiltered(), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No. Pendaftaran', 'Nama', 'NISN', 'L/P', 'Asal Sekolah', 'Jalur', 'Berkas', 'Status']].concat(rows.map(x => [x.no_pendaftaran, x.nama, x.nisn, x.jk, x.asal_sekolah, x.jalur, x.berkas, x.status]))), 'Pendaftar');
  XLSX.writeFile(wb, 'Pendaftar_PPDB.xlsx');
}

const karyaMgrRole = () => ['super_admin', 'kepala', 'tu'].includes(S.user.peran);
const karyaCanEdit = x => { const r = S.user.peran; if (r === 'siswa') return ['Draft', 'Perlu Revisi'].includes(x.status); if (karyaMgrRole()) return true; return x.staf && x.pembuat === S.user.nama && x.status !== 'Dipublikasikan'; };
const karyaCanDel = x => { const r = S.user.peran; if (r === 'siswa') return x.status === 'Draft'; if (karyaMgrRole()) return true; return x.staf && x.pembuat === S.user.nama && x.status === 'Draft'; };
ADM.karya = () => swr('karya', 'karyaList', {}, 'karya', rows => { S.ky = rows; if (S.kyf === undefined) S.kyf = ''; drawKaryaAdm(); });
function drawKaryaAdm() {
  const siswa = S.user.peran === 'siswa', rows = S.ky.filter(x => !S.kyf || x.status === S.kyf);
  $('#admMain').innerHTML = `<div class="toolbar"><select class="input" style="max-width:220px" aria-label="Filter status" onchange="S.kyf=this.value;drawKaryaAdm()"><option value="">Semua status</option>${Object.keys(KARYA_BADGE).map(s => `<option ${S.kyf === s ? 'selected' : ''}>${s}</option>`).join('')}</select><span style="flex:1"></span>
    <button class="btn btn-primary" onclick="karyaForm()">${ic('edit_note')} ${siswa ? 'Tulis Karya' : 'Tambah Karya'}</button></div>
    <div class="card"><div class="tbl-wrap">${rows.length ? `<table class="tbl"><thead><tr><th>Judul</th><th>Kategori</th>${siswa ? '' : '<th>Penulis</th>'}<th>Status</th><th>Diperbarui</th><th></th></tr></thead><tbody>${rows.map(x => `<tr><td style="min-width:220px"><b>${esc(x.judul)}</b>${x.unggulan === 'Ya' ? ' <span class="badge b-gray">Pilihan</span>' : ''}${x.status === 'Perlu Revisi' && x.komentar ? `<div class="hint" style="color:var(--bad)">Komentar: ${esc(x.komentar)}</div>` : ''}</td><td>${esc(x.kategori)}</td>${siswa ? '' : `<td>${esc(x.penulis_nama)}<div class="hint">${esc(x.kelas)}${x.staf ? ' · input staf' : ''}</div></td>`}
      <td><span class="badge ${KARYA_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span></td><td>${esc(fmtDT(x.diperbarui))}</td><td><div class="acts">${karyaCanEdit(x) ? `<button class="icon-btn sm" title="Ubah" aria-label="Ubah" onclick="karyaForm('${esc(x.id)}')">${ic('edit')}</button>` : ''}
      <button class="icon-btn sm" title="${siswa ? 'Baca' : 'Tinjau dan terbitkan'}" aria-label="${siswa ? 'Baca' : 'Tinjau'}" onclick="karyaTinjau('${esc(x.id)}')">${ic('visibility')}</button>${karyaCanDel(x) ? `<button class="icon-btn sm" title="Hapus" aria-label="Hapus" onclick="karyaHapus('${esc(x.id)}')">${ic('delete')}</button>` : ''}</div></td></tr>`).join('')}</tbody></table>` : emptyBox('edit_note', siswa ? 'Belum ada karya. Klik Tulis Karya untuk mulai menulis.' : 'Belum ada karya. Klik Tambah Karya untuk menginput tulisan siswa, atau tunggu karya yang diajukan siswa.')}</div></div>`;
}
async function karyaForm(id) {
  const siswa = S.user.peran === 'siswa', mgr = karyaMgrRole();
  let d = { judul: '', kategori: 'Esai', isi: '', penulis_nama: '', kelas: '', penulis_id: '' };
  if (id) { d = await api('karyaGet', { id: id }); if (d === undefined) return; }
  const staf = !siswa && !d.penulis_id;
  modal({ title: id ? 'Ubah Karya' : (siswa ? 'Tulis Karya' : 'Tambah Karya'), wide: true, body: `${staf ? `<div class="grid g2"><div class="field"><label class="label" for="ky_p">Nama penulis (siswa) <span class="req">*</span></label><input id="ky_p" class="input" maxlength="80" value="${esc(d.penulis_nama)}"></div>
    <div class="field"><label class="label" for="ky_kl">Kelas</label><input id="ky_kl" class="input" maxlength="40" value="${esc(d.kelas)}" placeholder="mis. XI IPS 1"></div></div>` : ''}
    <div class="grid g2"><div class="field"><label class="label" for="ky_j">Judul <span class="req">*</span></label><input id="ky_j" class="input" maxlength="150" value="${esc(d.judul)}"></div>
    <div class="field"><label class="label" for="ky_k">Jenis tulisan</label><select id="ky_k" class="input">${KARYA_KAT.map(k => `<option ${d.kategori === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div></div>
    ${d.status === 'Perlu Revisi' && d.komentar ? `<div class="card pad" style="border-left:4px solid var(--bad);margin-bottom:1rem"><b>Komentar:</b><br>${esc(d.komentar)}</div>` : ''}
    <div class="field"><label class="label" for="ky_i">Isi tulisan <span class="req">*</span></label><textarea id="ky_i" class="input" style="min-height:260px" maxlength="8000" oninput="$('#kyCnt').textContent=this.value.length">${esc(d.isi)}</textarea><div class="hint">Minimal 100 karakter. <span id="kyCnt">${String(d.isi || '').length}</span> / 8000. Pisahkan paragraf dengan satu baris kosong. Teks akan tampil rata kiri-kanan di website.</div></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button>${staf || siswa ? `<button class="btn btn-outline" id="kySave">${ic('save')} Simpan Draf</button>` : `<button class="btn btn-primary" id="kySave">${ic('save')} Simpan Perubahan</button>`}
    ${staf && mgr ? `<button class="btn btn-primary" id="kySend">${ic('publish')} Simpan dan Terbitkan</button>` : (siswa || staf) ? `<button class="btn btn-primary" id="kySend">${ic('send')} ${siswa ? 'Simpan dan Ajukan ke Guru' : 'Simpan dan Ajukan'}</button>` : ''}` });
  const save = async aksi => {
    const data = { id: id || '', judul: $('#ky_j').value, kategori: $('#ky_k').value, isi: $('#ky_i').value };
    if (staf) { data.penulis_nama = $('#ky_p').value; data.kelas = $('#ky_kl').value; }
    const r = await api('karyaSave', { data: data }); if (r === undefined) return;
    if (aksi && await api('karyaStatus', { id: r.id, aksi: aksi }) === undefined) return;
    closeModal(); toast('Berhasil', aksi === 'terbitkan' ? 'Karya diterbitkan ke website.' : aksi === 'ajukan' ? 'Karya diajukan.' : 'Tersimpan.'); S.cache.karya = null; S.karya = null; ADM.karya();
  };
  $('#kySave').onclick = () => save('');
  if ($('#kySend')) $('#kySend').onclick = () => save(staf && mgr ? 'terbitkan' : 'ajukan');
}
async function karyaTinjau(id) {
  const d = await api('karyaGet', { id: id }); if (d === undefined) return;
  const r = S.user.peran, sa = r === 'super_admin', guru = sa || ['guru', 'wali_kelas'].includes(r), mgr = karyaMgrRole(), staf = !d.penulis_id, pencipta = staf && d.pembuat === S.user.nama, b = [];
  if (guru && d.status === 'Diajukan') b.push(['setujuGuru', 'check_circle', 'Setujui', 'btn-primary']);
  if ((guru || mgr) && ['Diajukan', 'Disetujui Guru'].includes(d.status)) b.push(['kembali', 'undo', 'Minta Revisi', 'btn-outline']);
  if (staf && (pencipta || mgr) && !mgr && ['Draft', 'Perlu Revisi'].includes(d.status)) b.push(['ajukan', 'send', 'Ajukan', 'btn-primary']);
  if (mgr && (d.status === 'Disetujui Guru' || (staf && ['Draft', 'Diajukan', 'Perlu Revisi'].includes(d.status)) || (sa && ['Draft', 'Diajukan', 'Perlu Revisi', 'Diarsipkan'].includes(d.status)))) b.push(['terbitkan', 'publish', 'Terbitkan ke Website', 'btn-primary']);
  if (mgr && d.status === 'Dipublikasikan') b.push(['unggulan', 'star', d.unggulan === 'Ya' ? 'Cabut Karya Pilihan' : 'Jadikan Karya Pilihan', 'btn-outline'], ['arsip', 'inventory_2', 'Arsipkan', 'btn-outline']);
  const needKom = b.some(x => x[0] === 'kembali' || x[0] === 'setujuGuru');
  modal({ title: d.judul, wide: true, body: `<div class="meta" style="margin-bottom:.75rem"><span class="badge ${KARYA_BADGE[d.status] || 'b-gray'}">${esc(d.status)}</span><span class="badge b-sage">${esc(d.kategori)}</span><span>${esc(d.penulis_nama)}${d.kelas ? ' · ' + esc(d.kelas) : ''}</span></div>
    <div class="prose" style="max-height:45vh;overflow:auto;padding-right:.5rem">${para(d.isi)}</div>${d.komentar ? `<p class="hint" style="margin-top:.75rem"><b>Komentar terakhir${d.reviewer ? ' (' + esc(d.reviewer) + ')' : ''}:</b> ${esc(d.komentar)}</p>` : ''}
    ${needKom ? `<div class="field" style="margin-top:1rem"><label class="label" for="ky_kom">Komentar untuk penulis (wajib saat meminta revisi)</label><input id="ky_kom" class="input" maxlength="400"></div>` : ''}`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Tutup</button>${b.map(([a, i, l, c]) => `<button class="btn ${c}" data-a="${a}">${ic(i)} ${l}</button>`).join('')}` });
  $$('.m-foot [data-a]').forEach(btn => { btn.onclick = async () => {
    const r2 = await api('karyaStatus', { id: id, aksi: btn.dataset.a, komentar: $('#ky_kom') ? $('#ky_kom').value : '' });
    if (r2 !== undefined) { closeModal(); toast('Berhasil', 'Status karya diperbarui.'); S.cache.karya = null; S.karya = null; ADM.karya(); }
  }; });
}
async function karyaHapus(id) {
  if (!await confirmBox('Hapus karya ini secara permanen?', { danger: true, ok: 'Hapus' })) return;
  if (await api('karyaHapus', { id: id }) !== undefined) { toast('Dihapus', 'Karya dihapus.'); S.cache.karya = null; S.karya = null; ADM.karya(); }
}
const SURAT_BADGE = { 'Draft': 'b-gray', 'Menunggu Persetujuan': 'b-warn', 'Disetujui': 'b-ok', 'Ditolak': 'b-bad' };
const PEL_BADGE = { 'Aman': 'b-ok', 'Peringatan': 'b-warn', 'Panggil Orang Tua': 'b-bad' };
const SURAT_JENIS = ['Surat Keterangan', 'Surat Undangan', 'Surat Tugas', 'Surat Edaran', 'Surat Umum'];
const suratTemplate = (j, c) => ({
  'Surat Keterangan': `Yang bertanda tangan di bawah ini, Kepala ${c.nama_madrasah}, menerangkan bahwa:\n\nNama : ...............\nNIS / NISN : ...............\nKelas : ...............\n\nadalah benar siswa aktif pada ${c.nama_madrasah}.\n\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`,
  'Surat Undangan': `Dengan hormat,\n\nSehubungan dengan ..............., kami mengundang Bapak/Ibu untuk hadir pada:\n\nHari/Tanggal : ...............\nWaktu : ...............\nTempat : ...............\nAcara : ...............\n\nDemikian undangan ini kami sampaikan. Atas perhatian dan kehadiran Bapak/Ibu diucapkan terima kasih.`,
  'Surat Tugas': `Yang bertanda tangan di bawah ini menugaskan:\n\nNama : ...............\nJabatan : ...............\n\nuntuk melaksanakan ...............\n\nDemikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.`,
  'Surat Edaran': `Dengan hormat,\n\nDipermaklumkan kepada seluruh ...............  bahwa ...............\n\nDemikian surat edaran ini disampaikan untuk dilaksanakan sebagaimana mestinya.`,
  'Surat Umum': `Dengan hormat,\n\n...............\n\nDemikian disampaikan, atas perhatian Bapak/Ibu diucapkan terima kasih.`
}[j] || '');

function privField(id, val) {
  return `<input type="hidden" id="${id}" value="${esc(val || '')}"><div id="${id}_p">${val ? '<span class="badge b-ok">Berkas tersimpan (privat)</span>' : ''}</div>
    <input type="file" class="input" style="margin-top:.4rem" accept=".pdf,.jpg,.jpeg,.png" onchange="pickPriv(this,'${id}')" aria-label="Pilih berkas">`;
}
async function pickPriv(input, id) {
  const f = input.files[0]; if (!f) return;
  try {
    toast('Mengunggah', 'Mohon tunggu…', 'warn');
    let data, mime;
    if (f.type === 'application/pdf') { if (f.size > 4000000) throw new Error('PDF maksimal 4 MB.'); data = await fileB64(f); mime = f.type; }
    else { const im = await fileToImage(f, 1800); data = im.data; mime = im.mime; }
    const d = await api('uploadPriv', { data: data, mime: mime, name: f.name });
    if (d === undefined) return;
    $('#' + id).value = d.id; $('#' + id + '_p').innerHTML = `<span class="badge b-ok">${esc(d.nama)} (privat)</span>`;
    toast('Berhasil', 'Berkas diunggah.');
  } catch (e) { toast('Gagal', e.message, 'bad'); }
  input.value = '';
}
async function privLihat(id) {
  const d = await api('privLihat', { id: id }); if (d === undefined) return;
  const url = 'data:' + d.mime + ';base64,' + d.base64;
  modal({ title: 'Pratinjau Berkas', wide: true, body: d.mime === 'application/pdf' ? `<iframe title="Berkas" src="${url}" style="width:100%;height:65vh;border:1px solid var(--border);border-radius:10px"></iframe><p class="hint">Jika pratinjau kosong, klik Unduh.</p>` : `<img alt="Berkas" style="max-width:100%;border-radius:10px;background:#fff" src="${url}">`,
    foot: `<button class="btn btn-outline" id="pvDl">${ic('download')} Unduh</button><button class="btn btn-primary" onclick="closeModal()">Tutup</button>` });
  $('#pvDl').onclick = () => { const bin = atob(d.base64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); download('berkas.' + (d.mime === 'application/pdf' ? 'pdf' : d.mime === 'image/png' ? 'png' : 'jpg'), new Blob([arr], { type: d.mime })); };
}
function fillModFilter() {
  const m = S.m.m, el = $('#mfilter'); if (!m.filter || !el) return;
  if (REFKEY[m.filter]) { el.innerHTML = opts(S.refs[REFKEY[m.filter]] || [], S.m.f, 'Semua ' + colLabel(m, m.filter)); return; }
  const v = [...new Set(S.m.rows.map(r => r[m.filter]).filter(x => x !== '' && x != null))].sort();
  el.innerHTML = `<option value="">Semua ${esc(colLabel(m, m.filter))}</option>` + v.map(x => `<option ${String(x) === S.m.f ? 'selected' : ''}>${esc(x)}</option>`).join('');
}
async function modExtra(a, btn) {
  busy(btn, true, 'Memproses…'); const r = await api(a); busy(btn, false);
  if (r !== undefined) { toast('Selesai', r && r.jumlah !== undefined ? r.jumlah + ' data diproses.' : 'Selesai.'); modRefresh(S.m.m.key, true); }
}

ADM.pelrekap = async () => {
  await loadRefs(true);
  const mine = (S.user.ref_id ? S.refs.rombel.find(x => x.wali === S.user.ref_id) : null), wali = S.user.peran === 'wali_kelas';
  $('#admMain').innerHTML = `<div class="card pad"><div class="row"><div class="field" style="min-width:220px;margin:0"><label class="label" for="pr_rb">Kelas</label><select id="pr_rb" class="input" ${wali ? 'disabled' : ''}>${opts(S.refs.rombel, mine ? mine.id : '', 'Semua kelas')}</select></div>
    <button class="btn btn-primary" onclick="pelRekapLoad()">${ic('leaderboard')} Tampilkan Rekap</button></div></div><div id="prBody" style="margin-top:1rem">${skeleton(1)}</div>`;
  pelRekapLoad();
};
async function pelRekapLoad() {
  const ok2 = navGuard();
  const d = await api('pelRekap', { id_rombel: $('#pr_rb').value }); if (d === undefined || !ok2()) return;
  S.pr = d;
  $('#prBody').innerHTML = `<div class="card"><div class="pad"><p class="hint" style="margin:0">Peringatan mulai ${d.ambang1} poin, panggil orang tua mulai ${d.ambang2} poin (dapat diubah di Pengaturan).</p></div><div class="tbl-wrap">${d.rows.length ? `<table class="tbl"><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Jumlah</th><th>Total Poin</th><th>Status</th><th></th></tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.nis)}</td><td><b>${esc(r.nama)}</b></td><td>${esc(r.kelas)}</td><td>${r.jumlah}</td><td><b>${r.total}</b></td>
    <td><span class="badge ${PEL_BADGE[r.status]}">${esc(r.status)}</span></td><td>${r.jumlah ? `<button class="icon-btn sm" title="Rincian" aria-label="Rincian ${esc(r.nama)}" onclick="pelRincian('${esc(r.id)}')">${ic('open_in_new')}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : emptyBox('groups', 'Tidak ada siswa.')}</div></div>`;
}
async function pelRincian(sid) {
  const rows = await api('mList', { mod: 'pelanggaran' }); if (rows === undefined) return;
  const s = S.pr.rows.find(x => x.id === sid), list = rows.filter(x => x.id_siswa === sid).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  modal({ title: 'Rincian Pelanggaran: ' + s.nama, wide: true, body: `<p class="muted">${esc(s.kelas)} · Total ${s.total} poin</p>${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Pelanggaran</th><th>Poin</th><th>Keterangan</th><th>Tindak Lanjut</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(fmtD(x.tanggal))}</td><td>${esc(x.jenis_nama)}</td><td>${esc(x.poin)}</td><td>${esc(x.keterangan || '-')}</td><td>${esc(x.tindak_lanjut || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Tidak ada catatan yang dapat Anda lihat.</p>'}`,
    foot: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>` });
}

ADM.suratkeluar = () => swr('surat', 'suratList', {}, 'suratkeluar', rows => { S.sk = rows; if (S.skf === undefined) S.skf = ''; drawSurat(); });
function drawSurat() {
  const r = S.user.peran, sa = r === 'super_admin', kep = sa || r === 'kepala', ed = sa || r === 'tu', rows = S.sk.filter(x => !S.skf || x.status === S.skf);
  $('#admMain').innerHTML = `<div class="toolbar"><select class="input" style="max-width:230px" aria-label="Filter status" onchange="S.skf=this.value;drawSurat()"><option value="">Semua status</option>${Object.keys(SURAT_BADGE).map(s => `<option ${S.skf === s ? 'selected' : ''}>${s}</option>`).join('')}</select><span style="flex:1"></span>
    ${ed ? `<button class="btn btn-primary" onclick="suratForm()">${ic('edit_document')} Buat Surat</button>` : ''}</div>
    <div class="card"><div class="tbl-wrap">${rows.length ? `<table class="tbl"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Jenis</th><th>Tujuan / Perihal</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x => {
      const b = (i, t, fn) => `<button class="icon-btn sm" title="${t}" aria-label="${t}" onclick="${fn}">${ic(i)}</button>`, a = [], dr = ['Draft', 'Ditolak'].includes(x.status);
      if (ed && (dr || sa)) a.push(b('edit', 'Ubah', `suratForm('${esc(x.id)}')`));
      if (ed && dr) a.push(b('send', 'Ajukan ke Kepala', `suratAksi('${esc(x.id)}','ajukan')`));
      if (kep && x.status === 'Menunggu Persetujuan') a.push(b('check_circle', 'Setujui dan beri nomor', `suratAksi('${esc(x.id)}','setujui')`), b('cancel', 'Tolak', `suratAksi('${esc(x.id)}','tolak')`));
      a.push(b('print', 'Cetak PDF', `suratCetak('${esc(x.id)}')`));
      if (ed && (x.status === 'Draft' || sa)) a.push(b('delete', 'Hapus', `suratHapus('${esc(x.id)}')`));
      return `<tr><td style="font-family:monospace">${esc(x.nomor || '-')}</td><td>${esc(fmtD(x.tanggal))}</td><td>${esc(x.jenis)}</td><td style="min-width:220px"><b>${esc(x.perihal)}</b><div class="hint">${esc(x.tujuan || '-')}</div>${x.alasan_tolak ? `<div class="hint" style="color:var(--bad)">Ditolak: ${esc(x.alasan_tolak)}</div>` : ''}</td>
      <td><span class="badge ${SURAT_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span>${x.disetujui_oleh ? `<div class="hint">oleh ${esc(x.disetujui_oleh)}</div>` : ''}</td><td><div class="acts">${a.join('')}</div></td></tr>`; }).join('')}</tbody></table>` : emptyBox('outbox', 'Belum ada surat keluar.')}</div></div>
    <p class="hint" style="margin-top:.5rem">Nomor surat dibuat otomatis saat Kepala Madrasah menyetujui. Tanda tangan muncul pada PDF setelah surat disetujui.</p>`;
}
async function suratForm(id) {
  await loadRefs(true);
  let d = { jenis: 'Surat Umum', tanggal: ymd(new Date()), tujuan: '', perihal: '', lampiran: '', isi: '', id_pejabat: '' };
  if (id) { d = await api('suratGet', { id: id }); if (d === undefined) return; }
  const pj = S.refs.pejabat || [], first = d.id_pejabat || (pj[0] ? pj[0].id : '');
  modal({ title: id ? 'Ubah Surat' : 'Buat Surat Keluar', wide: true, body: `<div class="grid g2"><div class="field"><label class="label" for="sf_j">Jenis Surat</label><select id="sf_j" class="input" onchange="suratTpl(this.value)">${SURAT_JENIS.map(j => `<option ${d.jenis === j ? 'selected' : ''}>${j}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="sf_t">Tanggal Surat</label><input id="sf_t" type="date" class="input" value="${esc(String(d.tanggal).slice(0, 10))}"></div>
    <div class="field"><label class="label" for="sf_p">Perihal <span class="req">*</span></label><input id="sf_p" class="input" maxlength="150" value="${esc(d.perihal)}"></div>
    <div class="field"><label class="label" for="sf_l">Lampiran</label><input id="sf_l" class="input" maxlength="60" value="${esc(d.lampiran)}" placeholder="mis. 1 berkas"></div>
    <div class="field"><label class="label" for="sf_k">Kepada (tujuan)</label><input id="sf_k" class="input" maxlength="200" value="${esc(d.tujuan)}"></div>
    <div class="field"><label class="label" for="sf_pj">Penandatangan</label><select id="sf_pj" class="input">${pj.length ? opts(pj, first, '') : '<option value="">Kepala Madrasah (dari Pengaturan)</option>'}</select></div></div>
    <div class="field"><label class="label" for="sf_i">Isi Surat <span class="req">*</span></label><textarea id="sf_i" class="input" style="min-height:240px" maxlength="6000">${esc(d.isi)}</textarea><div class="hint">Template terisi otomatis saat jenis surat dipilih dan isinya masih kosong. Pisahkan paragraf dengan satu baris kosong.</div></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-outline" id="sfSave">${ic('save')} Simpan Draf</button><button class="btn btn-primary" id="sfSend">${ic('send')} Simpan dan Ajukan ke Kepala</button>` });
  if (!id) suratTpl($('#sf_j').value);
  const save = async ajukan => {
    const data = { id: id || '', jenis: $('#sf_j').value, tanggal: $('#sf_t').value, perihal: $('#sf_p').value, lampiran: $('#sf_l').value, tujuan: $('#sf_k').value, id_pejabat: $('#sf_pj').value, isi: $('#sf_i').value };
    const r = await api('suratSave', { data: data }); if (r === undefined) return;
    if (ajukan && await api('suratStatus', { id: r.id, aksi: 'ajukan' }) === undefined) return;
    closeModal(); toast('Berhasil', ajukan ? 'Surat diajukan ke Kepala Madrasah.' : 'Draf tersimpan.'); S.cache.surat = null; ADM.suratkeluar();
  };
  $('#sfSave').onclick = () => save(false); $('#sfSend').onclick = () => save(true);
}
function suratTpl(j) {
  const t = $('#sf_i'); if (!t) return;
  const cur = t.value.trim(), prev = SURAT_JENIS.map(x => suratTemplate(x, S.cfg).trim());
  if (!cur || prev.includes(cur)) t.value = suratTemplate(j, S.cfg);
}
async function suratAksi(id, aksi) {
  let alasan = '';
  if (aksi === 'tolak') { alasan = await promptBox('Tolak surat', 'Alasan penolakan'); if (!alasan) return; }
  else if (aksi === 'setujui' && !await confirmBox('Setujui surat ini? Nomor surat akan dibuat otomatis dan surat tidak dapat diubah lagi.')) return;
  else if (aksi === 'ajukan' && !await confirmBox('Ajukan surat ini ke Kepala Madrasah?')) return;
  if (await api('suratStatus', { id: id, aksi: aksi, alasan: alasan }) !== undefined) { toast('Berhasil', 'Status surat diperbarui.'); S.cache.surat = null; ADM.suratkeluar(); }
}
async function suratCetak(id) {
  toast('Menyiapkan', 'Membuat PDF surat…', 'warn');
  const d = await api('suratCetak', { id: id }); if (d && d !== true) showPdf(d);
}
async function suratHapus(id) {
  if (!await confirmBox('Hapus surat ini?', { danger: true, ok: 'Hapus' })) return;
  if (await api('suratHapus', { id: id }) !== undefined) { toast('Dihapus', 'Surat dihapus.'); S.cache.surat = null; ADM.suratkeluar(); }
}
const rp = n => 'Rp ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ymNow = () => ymd(new Date()).slice(0, 7);
const TG_BADGE = { 'Lunas': 'b-ok', 'Belum Lunas': 'b-warn' };

function tagihanCard(t) {
  const list = t || [], tot = list.reduce((a, x) => a + x.sisa, 0);
  return `<div class="card" style="margin-bottom:1.25rem"><div class="pad"><h3>Tagihan Pembayaran</h3>${list.length ? `<p class="muted" style="margin:0;font-size:.85rem">Total belum dibayar: <b>${rp(tot)}</b>. Pembayaran dilakukan melalui Bendahara madrasah.</p>` : ''}</div><div class="tbl-wrap">${list.length ?
    `<table class="tbl"><thead><tr><th>Bulan</th><th>Jenis</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(x.label)}</td><td>${esc(x.jenis)}</td><td>${rp(x.nominal)}</td><td>${rp(x.dibayar)}</td><td><b>${rp(x.sisa)}</b></td><td><span class="badge ${TG_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span></td></tr>`).join('')}</tbody></table>` : emptyBox('receipt_long', 'Belum ada tagihan.')}</div></div>`;
}
function keuCards(k) {
  const c = (l, v, cls) => `<div class="card kpi ${cls || ''}"><small>${l}</small><b style="font-size:1.4rem">${rp(v)}</b></div>`;
  return `<div class="grid g4" style="margin-bottom:1.25rem">${c('Pemasukan Bulan Ini', k.masukBulan)}${c('Pengeluaran Bulan Ini', k.keluarBulan, 'warn')}${c('Saldo Kas', k.saldo, 'gold')}${c('Tunggakan SPP', k.tunggakan, 'info')}</div>`;
}

ADM.tagihan = async () => {
  await loadRefs(true);
  const canW = ['super_admin', 'bendahara'].includes(S.user.peran);
  S.tg = { tab: 'tagihan', bulan: ymNow(), status: '', rb: '', q: '', canW: canW };
  $('#admMain').innerHTML = `<div class="row" style="margin-bottom:1rem"><button class="chip on" id="tgT1" onclick="tgTab('tagihan')">Tagihan</button><button class="chip" id="tgT2" onclick="tgTab('tunggakan')">Tunggakan</button></div><div id="tgBody"></div>`;
  tgTab('tagihan');
};
function tgTab(t) {
  S.tg.tab = t; $('#tgT1').classList.toggle('on', t === 'tagihan'); $('#tgT2').classList.toggle('on', t === 'tunggakan');
  const kelas = opts(S.refs.rombel, S.tg.rb, 'Semua kelas');
  if (t === 'tunggakan') {
    $('#tgBody').innerHTML = `<div class="toolbar"><select class="input" style="max-width:220px" id="tg_rb2" aria-label="Kelas" onchange="S.tg.rb=this.value;tunggakanLoad()">${kelas}</select><span style="flex:1"></span><button class="btn btn-outline" onclick="tunggakanCetak(this)">${ic('print')} Cetak PDF</button></div><div class="card"><div class="tbl-wrap" id="tgTable">${skeleton(1)}</div></div>`;
    tunggakanLoad(); return;
  }
  $('#tgBody').innerHTML = `<div class="toolbar"><div style="display:flex;flex-direction:column"><label class="hint" for="tg_bln">Bulan</label><input id="tg_bln" type="month" class="input" style="max-width:170px" value="${esc(S.tg.bulan)}" onchange="S.tg.bulan=this.value;tagihanLoad()"></div>
    <select class="input" style="max-width:170px" aria-label="Status" onchange="S.tg.status=this.value;tagihanLoad()"><option value="">Semua status</option><option ${S.tg.status === 'Belum Lunas' ? 'selected' : ''}>Belum Lunas</option><option ${S.tg.status === 'Lunas' ? 'selected' : ''}>Lunas</option></select>
    <select class="input" style="max-width:200px" aria-label="Kelas" onchange="S.tg.rb=this.value;tagihanLoad()">${kelas}</select>
    <input class="input" type="search" placeholder="Cari nama / NIS…" aria-label="Cari" oninput="S.tg.q=this.value.toLowerCase();debounce(drawTagihan,150)()"><span style="flex:1"></span>
    ${S.tg.canW ? `<button class="btn btn-outline" onclick="tagihanForm()">${ic('add_card')} Tagihan Manual</button><button class="btn btn-primary" onclick="sppDialog()">${ic('auto_mode')} Buat Tagihan SPP</button>` : ''}</div>
    <div class="card"><div class="tbl-wrap" id="tgTable">${skeleton(1)}</div></div>`;
  tagihanLoad();
}
async function tagihanLoad() {
  const ok2 = navGuard();
  const d = await api('tagihanList', { bulan: S.tg.bulan, status: S.tg.status, id_rombel: S.tg.rb }); if (d === undefined || !ok2()) return;
  S.tg.rows = d.rows; drawTagihan();
}
function drawTagihan() {
  const rows = S.tg.rows.filter(x => !S.tg.q || (x.nama + ' ' + x.nis).toLowerCase().includes(S.tg.q)), tot = k => rows.reduce((a, x) => a + x[k], 0);
  $('#tgTable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Kelas</th><th>Nama</th><th>Bulan</th><th>Jenis</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.kelas)}</td><td><b>${esc(x.nama)}</b><div class="hint">${esc(x.nis)}</div></td><td>${esc(bulanLbl(x.bulan))}</td><td>${esc(x.jenis)}</td><td>${rp(x.nominal)}</td><td>${rp(x.dibayar)}</td><td><b>${rp(x.sisa)}</b></td>
    <td><span class="badge ${TG_BADGE[x.status] || 'b-gray'}">${esc(x.status)}</span></td><td><div class="acts">${S.tg.canW && x.sisa > 0 ? `<button class="btn btn-primary btn-sm" onclick="bayarForm('${esc(x.id)}')">Bayar</button>` : ''}
    <button class="icon-btn sm" title="Riwayat pembayaran" aria-label="Riwayat pembayaran ${esc(x.nama)}" onclick="riwayatBayar('${esc(x.id)}')">${ic('receipt_long')}</button>${S.tg.canW ? `<button class="icon-btn sm" title="Ubah tagihan" aria-label="Ubah tagihan" onclick="tagihanForm('${esc(x.id)}')">${ic('edit')}</button>` : ''}</div></td></tr>`).join('')}
    <tr style="font-weight:700;background:var(--surface2)"><td colspan="4">Jumlah (${rows.length} tagihan)</td><td>${rp(tot('nominal'))}</td><td>${rp(tot('dibayar'))}</td><td>${rp(tot('sisa'))}</td><td colspan="2"></td></tr></tbody></table>` : emptyBox('receipt_long', 'Belum ada tagihan. Klik Buat Tagihan SPP untuk membuatnya dari tarif.');
}
const bulanLbl = ym => { const m = String(ym).match(/^(\d{4})-(\d{2})$/); return m ? ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(m[2])] + ' ' + m[1] : ym; };
function sppDialog() {
  modal({ title: 'Buat Tagihan SPP', body: `<p class="muted">Membuat tagihan SPP bulan terpilih untuk seluruh siswa aktif sesuai Tarif SPP tingkat masing-masing. Siswa yang sudah punya tagihan bulan itu dilewati.</p>
    <div class="field"><label class="label" for="sp_bln">Bulan tagihan</label><input id="sp_bln" type="month" class="input" value="${esc(S.tg.bulan || ymNow())}"></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="spOk">Buat Tagihan</button>` });
  $('#spOk').onclick = async () => {
    const bln = $('#sp_bln').value; busy($('#spOk'), true, 'Membuat…');
    const r = await api('sppGenerate', { bulan: bln }); busy($('#spOk'), false); if (r === undefined) return;
    modal({ title: 'Hasil', body: `<p><b>${r.dibuat}</b> tagihan dibuat untuk ${esc(bulanLbl(bln))}.</p><p class="muted">${r.dilewati} siswa sudah punya tagihan bulan ini${r.tanpaTarif ? `, <b style="color:var(--bad)">${r.tanpaTarif} siswa dilewati karena belum ada Tarif SPP untuk tingkatnya</b> (atur di menu Tarif SPP)` : ''}.</p>`,
      foot: `<button class="btn btn-primary" onclick="closeModal()">Selesai</button>` });
    S.tg.bulan = bln; tgTab('tagihan');
  };
}
async function tagihanForm(id) {
  await loadRefs(true);
  const t = id ? S.tg.rows.find(x => x.id === id) : { id_siswa: '', bulan: S.tg.bulan, jenis: 'Lainnya', nominal: '', keterangan: '' };
  modal({ title: id ? 'Ubah Tagihan' : 'Tagihan Manual', body: `${id ? `<p><b>${esc(t.nama)}</b> · ${esc(t.kelas)}</p>` : `<div class="field"><label class="label" for="tf_s">Siswa <span class="req">*</span></label><select id="tf_s" class="input">${opts(S.refs.siswa || [], '', '— pilih siswa —')}</select></div>`}
    <div class="grid g2"><div class="field"><label class="label" for="tf_b">Bulan</label><input id="tf_b" type="month" class="input" value="${esc(t.bulan)}"></div><div class="field"><label class="label" for="tf_j">Jenis (mis. Seragam, Kegiatan)</label><input id="tf_j" class="input" maxlength="40" value="${esc(t.jenis)}"></div>
    <div class="field"><label class="label" for="tf_n">Nominal (Rp) <span class="req">*</span></label><input id="tf_n" type="number" min="1" class="input" value="${esc(t.nominal)}"></div><div class="field"><label class="label" for="tf_k">Keterangan</label><input id="tf_k" class="input" maxlength="120" value="${esc(t.keterangan || '')}"></div></div>`,
    foot: `${id ? `<button class="btn btn-danger" id="tfDel">${ic('delete')} Hapus</button>` : ''}<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="tfOk">Simpan</button>` });
  $('#tfOk').onclick = async () => {
    const data = { id: id || '', id_siswa: id ? t.id_siswa : $('#tf_s').value, bulan: $('#tf_b').value, jenis: $('#tf_j').value, nominal: $('#tf_n').value, keterangan: $('#tf_k').value };
    const r = await api('tagihanSave', { data: data }); if (r !== undefined) { closeModal(); toast('Berhasil', 'Tagihan disimpan.'); tagihanLoad(); }
  };
  if ($('#tfDel')) $('#tfDel').onclick = async () => { if (!await confirmBox('Hapus tagihan ini?', { danger: true, ok: 'Hapus' })) return; if (await api('tagihanHapus', { id: id }) !== undefined) { toast('Dihapus', 'Tagihan dihapus.'); tagihanLoad(); } };
}
function bayarForm(id) {
  const t = S.tg.rows.find(x => x.id === id);
  modal({ title: 'Catat Pembayaran', body: `<p><b>${esc(t.nama)}</b> · ${esc(t.kelas)}<br><span class="muted">${esc(t.jenis)} ${esc(bulanLbl(t.bulan))} · Sisa tagihan <b>${rp(t.sisa)}</b></span></p>
    <div class="grid g2"><div class="field"><label class="label" for="by_j">Jumlah dibayar (Rp)</label><input id="by_j" type="number" min="1" max="${t.sisa}" class="input" value="${t.sisa}"></div><div class="field"><label class="label" for="by_t">Tanggal</label><input id="by_t" type="date" class="input" value="${ymd(new Date())}"></div>
    <div class="field"><label class="label" for="by_m">Metode</label><select id="by_m" class="input"><option>Tunai</option><option>Transfer</option></select></div><div class="field"><label class="label" for="by_c">Catatan</label><input id="by_c" class="input" maxlength="120"></div></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="byOk">${ic('payments')} Simpan Pembayaran</button>` });
  $('#byOk').onclick = async () => {
    busy($('#byOk'), true, 'Menyimpan…');
    const r = await api('bayar', { id_tagihan: id, jumlah: $('#by_j').value, tanggal: $('#by_t').value, metode: $('#by_m').value, catatan: $('#by_c').value }); busy($('#byOk'), false);
    if (r === undefined) return;
    modal({ title: 'Pembayaran Tercatat', body: `<p style="font-size:1.1rem"><b>${esc(r.no_kwitansi)}</b></p><p class="muted">${r.sisa > 0 ? 'Sisa tagihan ' + rp(r.sisa) + '.' : 'Tagihan ini sudah <b>LUNAS</b>.'}</p>`,
      foot: `<button class="btn btn-outline" onclick="closeModal()">Tutup</button><button class="btn btn-primary" onclick="kwitansiCetak('${esc(r.id)}')">${ic('print')} Cetak Kwitansi</button>` });
    tagihanLoad();
  };
}
async function kwitansiCetak(id) { const d = await api('kwitansiCetak', { id: id }); if (d && d !== true) showPdf(d); }
async function riwayatBayar(id) {
  const t = S.tg.rows.find(x => x.id === id), d = await api('riwayatBayar', { id_tagihan: id }); if (d === undefined) return;
  modal({ title: 'Riwayat Pembayaran', wide: true, body: `<p><b>${esc(t.nama)}</b> · ${esc(t.jenis)} ${esc(bulanLbl(t.bulan))} · Tagihan ${rp(t.nominal)} · Sisa <b>${rp(t.sisa)}</b></p>${d.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kwitansi</th><th>Tanggal</th><th>Jumlah</th><th>Metode</th><th>Penerima</th><th></th></tr></thead><tbody>${d.map(x => `<tr><td style="font-family:monospace">${esc(x.no_kwitansi)}</td><td>${esc(fmtD(x.tanggal))}</td><td>${rp(x.jumlah)}</td><td>${esc(x.metode)}</td><td>${esc(x.penerima)}</td>
    <td><div class="acts"><button class="icon-btn sm" title="Cetak kwitansi" aria-label="Cetak kwitansi" onclick="kwitansiCetak('${esc(x.id)}')">${ic('print')}</button>${S.tg.canW ? `<button class="icon-btn sm" title="Batalkan pembayaran" aria-label="Batalkan pembayaran" onclick="bayarBatal('${esc(x.id)}')">${ic('undo')}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada pembayaran.</p>'}`,
    foot: `<button class="btn btn-primary" onclick="closeModal()">Tutup</button>` });
}
async function bayarBatal(id) {
  if (!await confirmBox('Batalkan pembayaran ini? Pencatatan kas ikut dihapus dan tagihan kembali terbuka.', { danger: true, ok: 'Batalkan' })) return;
  if (await api('bayarBatal', { id: id }) !== undefined) { toast('Dibatalkan', 'Pembayaran dibatalkan.'); closeModal(); tagihanLoad(); }
}
async function tunggakanLoad() {
  const ok2 = navGuard();
  const d = await api('tunggakan', { id_rombel: S.tg.rb }); if (d === undefined || !ok2()) return;
  $('#tgTable').innerHTML = d.rows.length ? `<table class="tbl"><thead><tr><th>Kelas</th><th>Nama</th><th>Orang Tua / Wali</th><th>Bulan</th><th>Total Tunggakan</th><th></th></tr></thead><tbody>${d.rows.map(x => `<tr><td>${esc(x.kelas)}</td><td><b>${esc(x.nama)}</b><div class="hint">${esc(x.nis)}</div></td><td>${esc(x.ortu || '-')}</td><td>${x.bulan}</td><td><b>${rp(x.total)}</b></td>
    <td>${waLink(x.wa) ? `<a class="btn btn-outline btn-sm" href="${waLink(x.wa)}?text=${encodeURIComponent('Assalamu\'alaikum, kami dari bendahara ' + (S.cfg.nama_madrasah || 'madrasah') + '. Mohon informasi tunggakan pembayaran ' + x.nama + ' sebesar ' + rp(x.total) + '. Terima kasih.')}" target="_blank" rel="noopener">${ic('chat')} WhatsApp</a>` : ''}</td></tr>`).join('')}
    <tr style="font-weight:700;background:var(--surface2)"><td colspan="4">Total (${d.rows.length} siswa)</td><td colspan="2">${rp(d.total)}</td></tr></tbody></table>` : emptyBox('verified', 'Tidak ada tunggakan. Alhamdulillah.');
}
async function tunggakanCetak(btn) { busy(btn, true, 'Menyiapkan…'); const d = await api('tunggakanCetak', { id_rombel: S.tg.rb }); busy(btn, false); if (d && d !== true) showPdf(d); }

ADM.laporankeu = () => {
  const th = new Date().getFullYear();
  $('#admMain').innerHTML = `<div class="card pad"><div class="row"><div class="field" style="margin:0"><label class="label" for="lk_th">Tahun</label><select id="lk_th" class="input">${[0, 1, 2, 3, 4].map(i => `<option>${th - i}</option>`).join('')}</select></div>
    <div class="field" style="margin:0"><label class="label" for="lk_bl">Bulan (untuk cetak)</label><select id="lk_bl" class="input"><option value="">Setahun penuh</option>${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((b, i) => `<option value="${('0' + (i + 1)).slice(-2)}">${b}</option>`).join('')}</select></div>
    <button class="btn btn-primary" onclick="laporanKeuLoad()">${ic('insights')} Tampilkan</button><button class="btn btn-outline" onclick="laporanKeuCetak(this)">${ic('print')} Cetak PDF</button></div></div><div id="lkBody" style="margin-top:1rem">${skeleton(2)}</div>`;
  laporanKeuLoad();
};
async function laporanKeuLoad() {
  const ok2 = navGuard();
  const d = await api('keuRingkas', { tahun: $('#lk_th').value }); if (d === undefined || !ok2()) return;
  const kpi = (l, v, c) => `<div class="card kpi ${c || ''}"><small>${l}</small><b style="font-size:1.4rem">${rp(v)}</b></div>`;
  $('#lkBody').innerHTML = `<div class="grid g4" style="margin-bottom:1.25rem">${kpi('Saldo Kas', d.saldo, 'gold')}${kpi('Pemasukan ' + d.tahun, d.masukTahun)}${kpi('Pengeluaran ' + d.tahun, d.keluarTahun, 'warn')}${kpi('Tunggakan SPP', d.tunggakan, 'info')}</div>
    <div class="grid g2"><div class="card pad"><h3 style="margin-bottom:.75rem">Pemasukan dan Pengeluaran per Bulan</h3><div style="height:260px"><canvas id="chKeu" role="img" aria-label="Grafik pemasukan dan pengeluaran per bulan"></canvas></div></div>
    <div class="card"><div class="pad"><h3>Per Kategori ${esc(d.tahun)}</h3></div><div class="tbl-wrap">${d.kategori.length ? `<table class="tbl"><thead><tr><th>Kategori</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>${d.kategori.map(k => `<tr><td>${esc(k.k)}</td><td>${rp(k.masuk)}</td><td>${rp(k.keluar)}</td></tr>`).join('')}</tbody></table>` : emptyBox('account_balance_wallet', 'Belum ada transaksi kas.')}</div></div></div>`;
  loadLib(LIB.chart).then(() => {
    if (!$('#chKeu')) return; if (S.charts.k) S.charts.k.destroy();
    const cs = getComputedStyle(document.documentElement), txt = cs.getPropertyValue('--muted').trim();
    S.charts.k = new Chart($('#chKeu'), { type: 'bar', data: { labels: d.bulan.map(m => m.label), datasets: [{ label: 'Pemasukan', data: d.bulan.map(m => m.masuk), backgroundColor: cs.getPropertyValue('--primary').trim(), borderRadius: 4 }, { label: 'Pengeluaran', data: d.bulan.map(m => m.keluar), backgroundColor: '#C9A34A', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: txt } } }, scales: { y: { beginAtZero: true, ticks: { color: txt } }, x: { ticks: { color: txt } } } } });
  }).catch(() => { const c = $('#chKeu'); if (c && c.parentElement) c.parentElement.innerHTML = '<p class="muted">Grafik tidak dapat dimuat.</p>'; });
}
async function laporanKeuCetak(btn) { busy(btn, true, 'Menyiapkan…'); const d = await api('keuCetak', { tahun: $('#lk_th').value, bulan: $('#lk_bl').value }); busy(btn, false); if (d && d !== true) showPdf(d); }

ADM.sirkulasi = () => {
  S.sr = { tab: 'dipinjam', canW: ['super_admin', 'pustakawan'].includes(S.user.peran) };
  $('#admMain').innerHTML = `<div class="row" style="margin-bottom:1rem"><button class="chip on" id="srT1" onclick="srTab('dipinjam')">Sedang Dipinjam</button><button class="chip" id="srT2" onclick="srTab('riwayat')">Riwayat</button><button class="chip" id="srT3" onclick="srTab('laporan')">Laporan</button></div><div id="srBody"></div>`;
  srTab('dipinjam');
};
async function srTab(t) {
  const ok2 = navGuard();
  S.sr.tab = t; [1, 2, 3].forEach((n, i) => $('#srT' + n).classList.toggle('on', ['dipinjam', 'riwayat', 'laporan'][i] === t));
  $('#srBody').innerHTML = skeleton(1);
  if (t === 'laporan') {
    const d = await api('perpusLaporan'); if (d === undefined || !ok2()) return;
    const k = (l, v, c) => `<div class="card kpi ${c || ''}"><small>${l}</small><b>${v}</b></div>`;
    $('#srBody').innerHTML = `<div class="grid g4" style="margin-bottom:1.25rem">${k('Judul / Eksemplar', d.judul + ' / ' + d.eksemplar)}${k('Dipinjam Saat Ini', d.dipinjam, 'info')}${k('Terlambat', d.terlambat, 'warn')}${k('Peminjaman Bulan Ini', d.bulanIni, 'gold')}</div>
      <div class="card"><div class="pad"><h3>Buku Terpopuler</h3><p class="muted" style="margin:0;font-size:.85rem">Total denda tercatat: ${rp(d.dendaTotal)}</p></div><div class="tbl-wrap">${d.populer.length ? `<table class="tbl"><thead><tr><th>No</th><th>Judul</th><th>Dipinjam</th></tr></thead><tbody>${d.populer.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.judul)}</td><td>${x.jumlah} kali</td></tr>`).join('')}</tbody></table>` : emptyBox('menu_book', 'Belum ada data peminjaman.')}</div></div>`;
    return;
  }
  const d = await api('pinjamList', { status: t === 'riwayat' ? 'Dikembalikan' : 'Dipinjam' }); if (d === undefined || !ok2()) return;
  const dip = t !== 'riwayat';
  $('#srBody').innerHTML = `${dip && S.sr.canW ? `<div class="toolbar"><span style="flex:1"></span><button class="btn btn-primary" onclick="pinjamForm()">${ic('add_circle')} Pinjamkan Buku</button></div>` : ''}<div class="card"><div class="tbl-wrap">${d.length ? `<table class="tbl"><thead><tr><th>Buku</th><th>Peminjam</th><th>Pinjam</th><th>${dip ? 'Jatuh Tempo' : 'Kembali'}</th><th>${dip ? 'Keterlambatan' : 'Denda'}</th><th></th></tr></thead><tbody>${d.map(x => `<tr>
    <td><b>${esc(x.judul)}</b></td><td>${esc(x.nama)}<div class="hint">${esc(x.kelas)}</div></td><td>${esc(fmtD(x.tgl_pinjam))}</td><td>${esc(fmtD(dip ? x.jatuh_tempo : x.tgl_kembali))}</td>
    <td>${dip ? (x.telat ? `<span class="badge b-bad">${x.telat} hari · ${rp(x.denda)}</span>` : '<span class="badge b-ok">Tepat waktu</span>') : (x.denda ? rp(x.denda) : '-')}</td><td>${dip && S.sr.canW ? `<button class="btn btn-outline btn-sm" onclick="kembaliBuku('${esc(x.id)}')">${ic('assignment_return')} Kembalikan</button>` : ''}</td></tr>`).join('')}</tbody></table>` : emptyBox('menu_book', dip ? 'Tidak ada buku yang sedang dipinjam.' : 'Belum ada riwayat pengembalian.')}</div></div>`;
}
async function pinjamForm() {
  await loadRefs(true);
  const buku = (S.refs.buku || []).filter(b => b.tersedia > 0);
  modal({ title: 'Pinjamkan Buku', body: `<div class="field"><label class="label" for="pj_b">Buku (hanya yang tersedia)</label><select id="pj_b" class="input">${opts(buku, '', '— pilih buku —')}</select></div>
    <div class="grid g2"><div class="field"><label class="label" for="pj_t">Jenis anggota</label><select id="pj_t" class="input" onchange="pinjamAnggota()"><option value="siswa">Siswa</option><option value="guru">Guru</option></select></div>
    <div class="field"><label class="label" for="pj_h">Lama pinjam (hari)</label><input id="pj_h" type="number" min="1" max="60" class="input" value="${esc(S.cfg.perpus_lama || 7)}"></div></div>
    <div class="field"><label class="label" for="pj_a">Anggota</label><select id="pj_a" class="input"></select></div>`,
    foot: `<button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="pjOk">Simpan Peminjaman</button>` });
  pinjamAnggota();
  $('#pjOk').onclick = async () => {
    busy($('#pjOk'), true, 'Menyimpan…');
    const r = await api('pinjam', { id_buku: $('#pj_b').value, tipe: $('#pj_t').value, id_anggota: $('#pj_a').value, hari: $('#pj_h').value }); busy($('#pjOk'), false);
    if (r !== undefined) { closeModal(); toast('Berhasil', 'Jatuh tempo ' + fmtD(r.jatuh_tempo) + '.'); S.refs = null; srTab('dipinjam'); }
  };
}
function pinjamAnggota() { const g = $('#pj_t').value === 'guru'; $('#pj_a').innerHTML = opts(g ? S.refs.guru : (S.refs.siswa || []), '', '— pilih anggota —'); }
async function kembaliBuku(id) {
  const r = await api('kembali', { id: id });
  if (r !== undefined) { toast(r.denda ? 'Ada denda' : 'Berhasil', r.denda ? 'Terlambat ' + r.telat + ' hari, denda ' + rp(r.denda) + '.' : 'Buku dikembalikan tepat waktu.', r.denda ? 'warn' : 'ok'); S.refs = null; srTab('dipinjam'); }
}
const kelasGender = nama => {
  const n = String(nama || '').toLowerCase(), l = /\b(putra|putera|ikhwan)\b/.test(n), p = /\b(putri|puteri|akhwat)\b/.test(n);
  return l && !p ? 'L' : p && !l ? 'P' : '';
};
