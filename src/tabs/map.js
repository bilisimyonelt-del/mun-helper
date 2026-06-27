import { el, clear, openModal, toast, confirmDialog, formatDateTime } from '../ui.js';
import { fetchAll, create, remove, cached, getProfile, saveProfile } from '../api.js';

const TABLE = 'map_links';

function normalizeUrl(u) {
  const v = (u || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v;
}

export function renderMap(container) {
  clear(container);
  const list = el('div', { class: 'card-list' });

  // --- Harita linkleri ---
  const linksSection = el('section', { class: 'section' }, [
    el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Harita & Genel Bilgi' }),
      el('button', { class: 'btn btn-primary', text: '+ Harita Linki', onClick: openLinkForm })
    ]),
    list
  ]);

  function paint(rows) {
    clear(list);
    if (!rows.length) {
      list.append(el('p', { class: 'empty', text: 'Henüz harita linki yok.' }));
      return;
    }
    for (const r of rows) list.append(card(r));
  }

  function card(r) {
    return el('div', { class: 'card card-compact' }, [
      r._pending ? el('span', { class: 'pending-badge', text: 'senkron bekliyor' }) : null,
      el('div', { class: 'card-row' }, [
        el('div', { class: 'card-main' }, [
          el('a', { class: 'link-title', href: normalizeUrl(r.url), target: '_blank', rel: 'noopener noreferrer', text: r.label }),
          el('div', { class: 'card-sub link-url', text: r.url }),
          el('div', { class: 'card-date', text: formatDateTime(r.created_at) })
        ]),
        el('button', { class: 'btn btn-danger btn-sm', text: 'Sil', onClick: () => del(r) })
      ])
    ]);
  }

  async function del(r) {
    if (!(await confirmDialog(`"${r.label}" linkini silmek istediğine emin misin?`))) return;
    await remove(TABLE, r.id);
    paint(cached(TABLE));
    toast('Link silindi.');
  }

  function openLinkForm() {
    const label = el('input', { type: 'text', required: true, placeholder: 'Örn. Doğu cephesi haritası' });
    const url = el('input', { type: 'url', required: true, placeholder: 'https://...' });

    const form = el('form', { class: 'form', id: 'ml-form' }, [
      field('Başlık *', label),
      field('Bağlantı (URL) *', url)
    ]);
    const submit = el('button', { class: 'btn btn-primary', text: 'Kaydet', type: 'submit', form: 'ml-form' });
    const m = openModal({
      title: 'Yeni Harita Linki',
      body: form,
      footer: [el('button', { class: 'btn btn-ghost', type: 'button', text: 'İptal', onClick: () => m.close() }), submit]
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!label.value.trim() || !url.value.trim()) { toast('Başlık ve URL gerekli.', 'error'); return; }
      submit.disabled = true;
      await create(TABLE, { label: label.value.trim(), url: normalizeUrl(url.value) });
      m.close();
      paint(cached(TABLE));
      toast('Link eklendi.');
    });
  }

  // --- Ülke Profili ---
  const profileText = el('textarea', {
    class: 'profile-text',
    rows: '12',
    placeholder: 'Hükümet tipi, müttefikler, askeri/ekonomik güç, kaynaklar... kendi notların.'
  });
  const saveStatus = el('span', { class: 'save-status', text: '' });
  const saveBtn = el('button', { class: 'btn btn-primary', text: 'Profili Kaydet', onClick: doSave });

  async function doSave() {
    saveBtn.disabled = true;
    saveStatus.textContent = 'Kaydediliyor...';
    await saveProfile(profileText.value);
    saveStatus.textContent = '✓ Kaydedildi · ' + formatDateTime(new Date().toISOString());
    saveBtn.disabled = false;
  }

  // Yazmayı bıraktıktan sonra otomatik kaydet (debounce).
  let t;
  profileText.addEventListener('input', () => {
    clearTimeout(t);
    saveStatus.textContent = 'değişiklik var...';
    t = setTimeout(doSave, 1500);
  });

  const profileSection = el('section', { class: 'section' }, [
    el('h2', { class: 'section-title', text: 'Ülke Profili' }),
    profileText,
    el('div', { class: 'profile-actions' }, [saveBtn, saveStatus])
  ]);

  container.append(linksSection, profileSection);

  // Veri yükle.
  paint(cached(TABLE));
  fetchAll(TABLE).then(paint);
  getProfile().then(content => { profileText.value = content || ''; });
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}
