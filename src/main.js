import './style.css';
import { isConfigured, THEME_KEY } from './config.js';
import { isLoggedIn, restoreSession, login, logout, getRoom } from './auth.js';
import { isOnline, onStatusChange } from './sync.js';
import { flushOutbox, exportAll } from './api.js';
import { outboxCount } from './store.js';
import { el, clear, toast } from './ui.js';

import { renderTimeline } from './tabs/timeline.js';
import { renderContacts } from './tabs/contacts.js';
import { renderProposals } from './tabs/proposals.js';
import { renderCommLog } from './tabs/commlog.js';
import { renderMap } from './tabs/map.js';

const TABS = [
  { id: 'timeline',  label: 'Kriz',       icon: '⏱️', render: renderTimeline },
  { id: 'contacts',  label: 'Kişiler',    icon: '👥', render: renderContacts },
  { id: 'proposals', label: 'Teklifler',  icon: '📝', render: renderProposals },
  { id: 'commlog',   label: 'İletişim',   icon: '💬', render: renderCommLog },
  { id: 'map',       label: 'Harita',     icon: '🗺️', render: renderMap }
];

const root = document.getElementById('app');
let activeTab = 'timeline';
let statusEls = {};

// ---- Tema ------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#1f2937' : '#2563eb');
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// ---- Başlangıç -------------------------------------------------------------
function start() {
  initTheme();
  if (!isConfigured()) return renderConfigMissing();
  if (isLoggedIn()) {
    restoreSession();
    renderApp();
  } else {
    renderLogin();
  }
}

// ---- Yapılandırma eksik ----------------------------------------------------
function renderConfigMissing() {
  clear(root);
  root.append(el('div', { class: 'gate' }, [
    el('div', { class: 'gate-card' }, [
      el('h1', { text: 'Yapılandırma eksik' }),
      el('p', { text: 'VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam değişkenleri tanımlı değil.' }),
      el('p', { class: 'muted', text: '.env dosyanı (yerelde) ya da Cloudflare Pages ortam değişkenlerini ayarlayıp tekrar derle. Ayrıntılar README.md içinde.' })
    ])
  ]));
}

// ---- Giriş (oda kodu) ------------------------------------------------------
function renderLogin() {
  clear(root);
  const input = el('input', { type: 'text', class: 'room-input', placeholder: 'Oda kodu', autocomplete: 'off' });
  const btn = el('button', { class: 'btn btn-primary btn-block', text: 'Giriş' });

  const form = el('form', { class: 'gate-card' }, [
    el('div', { class: 'gate-logo' }, [el('img', { src: '/icon.svg', alt: '', width: '64', height: '64' })]),
    el('h1', { text: 'MUN Kriz Yardımcısı' }),
    el('p', { class: 'muted', text: 'Ekibinle paylaştığın oda kodunu gir. Aynı kodu giren herkes aynı verileri görür.' }),
    input,
    btn,
    el('p', { class: 'hint', text: 'İpucu: tahmin edilmesi zor, uzun bir kod seç (ör. mun-kriz-2026-X7q9). Kod bir şifre gibidir.' })
  ]);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) { toast('Oda kodu boş olamaz.', 'error'); return; }
    try {
      login(code);
      renderApp();
      tryFlush();
      toast(`"${code}" odasına girildi.`);
    } catch (err) {
      toast(err.message || 'Giriş başarısız.', 'error');
    }
  });

  root.append(el('div', { class: 'gate' }, [form]));
}

// ---- Ana uygulama ----------------------------------------------------------
function renderApp() {
  clear(root);

  const onlineDot = el('span', { class: 'dot' });
  const onlineText = el('span', { class: 'status-text' });
  const pendingBadge = el('span', { class: 'pending-count' });
  statusEls = { onlineDot, onlineText, pendingBadge };

  const topbar = el('header', { class: 'topbar' }, [
    el('div', { class: 'brand' }, [
      el('img', { src: '/icon.svg', alt: '', width: '28', height: '28' }),
      el('span', { class: 'brand-name', text: 'MUN Kriz' }),
      el('span', { class: 'room-badge', text: getRoom() })
    ]),
    el('div', { class: 'topbar-status' }, [onlineDot, onlineText, pendingBadge]),
    el('div', { class: 'topbar-actions' }, [
      el('button', { class: 'icon-btn', title: 'Yedekle / Dışa Aktar (JSON)', text: '⬇️', onClick: doExport }),
      el('button', { class: 'icon-btn', title: 'Tema değiştir', text: '🌓', onClick: toggleTheme }),
      el('button', { class: 'icon-btn', title: 'Yenile', text: '🔄', onClick: () => renderActive() }),
      el('button', { class: 'icon-btn', title: 'Çıkış (oda kodunu sıfırla)', text: '🚪', onClick: doLogout })
    ])
  ]);

  const nav = el('nav', { class: 'mainnav' },
    TABS.map(t => el('button', {
      class: 'navbtn' + (t.id === activeTab ? ' active' : ''),
      dataset: { tab: t.id },
      onClick: () => switchTab(t.id)
    }, [
      el('span', { class: 'navbtn-icon', text: t.icon }),
      el('span', { class: 'navbtn-label', text: t.label })
    ]))
  );

  const content = el('main', { class: 'content', id: 'content' });

  root.append(el('div', { class: 'app-shell' }, [topbar, nav, content]));

  updateStatus();
  renderActive();
}

function switchTab(id) {
  activeTab = id;
  document.querySelectorAll('.navbtn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === id));
  renderActive();
}

function renderActive() {
  const content = document.getElementById('content');
  if (!content) return;
  const tab = TABS.find(t => t.id === activeTab);
  tab.render(content);
}

// ---- Durum göstergesi ------------------------------------------------------
function updateStatus() {
  const online = isOnline();
  const { onlineDot, onlineText, pendingBadge } = statusEls;
  if (!onlineDot) return;
  onlineDot.className = 'dot ' + (online ? 'dot-online' : 'dot-offline');
  onlineText.textContent = online ? 'Çevrimiçi' : 'Çevrimdışı';
  const n = outboxCount();
  pendingBadge.textContent = n ? `· ${n} bekliyor` : '';
}

// ---- Senkron ---------------------------------------------------------------
async function tryFlush() {
  if (!isOnline()) return;
  const res = await flushOutbox();
  updateStatus();
  if (res.done > 0) {
    toast(`${res.done} bekleyen değişiklik senkronlandı.`);
    renderActive();
  }
}

onStatusChange(online => {
  updateStatus();
  if (online) {
    toast('Bağlantı geri geldi, senkronlanıyor...');
    tryFlush();
  } else {
    toast('Çevrimdışısın. Değişiklikler kaydedilip sonra gönderilecek.', 'warn');
  }
});

// Sekmeye/pencereye dönünce ve periyodik olarak tazele (modal açık değilse).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isLoggedIn() && !document.querySelector('.modal-overlay')) {
    tryFlush();
    renderActive();
  }
});
setInterval(() => {
  if (isLoggedIn() && isOnline() && !document.hidden && !document.querySelector('.modal-overlay')) {
    renderActive();
  }
}, 30000);

// ---- Dışa aktarma ----------------------------------------------------------
async function doExport() {
  toast('Veriler toplanıyor...');
  try {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = el('a', { href: url, download: `mun-yedek-${getRoom()}-${stamp}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Yedek indirildi.');
  } catch (e) {
    console.error(e);
    toast('Dışa aktarma başarısız.', 'error');
  }
}

// ---- Çıkış -----------------------------------------------------------------
function doLogout() {
  if (outboxCount() > 0 && !confirm('Senkronlanmamış değişiklikler var. Yine de çıkmak istiyor musun?')) return;
  logout();
  renderLogin();
}

start();
