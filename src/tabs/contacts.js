import { el, clear, openModal, toast, confirmDialog, thumb, photoPicker } from '../ui.js';
import { fetchAll, create, update, remove, cached } from '../api.js';
import { uploadPhoto, deletePhoto } from '../photos.js';
import { isOnline } from '../sync.js';

const TABLE = 'contacts';

const CATS = {
  ally:     { label: 'Müttefik', cls: 'cat-ally' },
  opponent: { label: 'Muhalif',  cls: 'cat-opponent' },
  neutral:  { label: 'Nötr',     cls: 'cat-neutral' }
};

export function renderContacts(container) {
  clear(container);
  let filter = 'all';
  const list = el('div', { class: 'card-list' });
  const filterBar = el('div', { class: 'filter-bar' });

  container.append(
    el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Kişiler & Müttefikler' }),
      el('button', { class: 'btn btn-primary', text: '+ Yeni Kişi', onClick: () => openForm(null) })
    ]),
    filterBar,
    list
  );

  function buildFilters() {
    clear(filterBar);
    const opts = [['all', 'Tümü'], ['ally', 'Müttefik'], ['opponent', 'Muhalif'], ['neutral', 'Nötr']];
    for (const [val, lbl] of opts) {
      filterBar.append(el('button', {
        class: 'filter-btn' + (filter === val ? ' active' : ''),
        text: lbl,
        onClick: () => { filter = val; buildFilters(); paint(cached(TABLE)); }
      }));
    }
  }

  function paint(rows) {
    const data = filter === 'all' ? rows : rows.filter(r => r.category === filter);
    clear(list);
    if (!data.length) {
      list.append(el('p', { class: 'empty', text: 'Bu kategoride kişi yok.' }));
      return;
    }
    for (const r of data) list.append(card(r));
  }

  function card(r) {
    const cat = CATS[r.category] || CATS.neutral;
    return el('div', { class: `card ${cat.cls}` }, [
      r._pending ? el('span', { class: 'pending-badge', text: 'senkron bekliyor' }) : null,
      el('div', { class: 'card-row' }, [
        r.photo_url ? thumb(r.photo_url) : el('div', { class: 'avatar-fallback', text: (r.name || '?')[0].toUpperCase() }),
        el('div', { class: 'card-main' }, [
          el('div', { class: 'card-title-row' }, [
            el('h3', { class: 'card-title', text: r.name }),
            el('span', { class: `chip ${cat.cls}`, text: cat.label })
          ]),
          r.country_role ? el('div', { class: 'card-sub', text: r.country_role }) : null,
          r.note ? el('p', { class: 'card-text', text: r.note }) : null
        ])
      ]),
      el('div', { class: 'card-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Düzenle', onClick: () => openForm(r) }),
        el('button', { class: 'btn btn-danger btn-sm', text: 'Sil', onClick: () => del(r) })
      ])
    ]);
  }

  async function del(r) {
    if (!(await confirmDialog(`"${r.name}" kişisini silmek istediğine emin misin?`))) return;
    await remove(TABLE, r.id);
    if (r.photo_path) deletePhoto(r.photo_path);
    paint(cached(TABLE));
    toast('Kişi silindi.');
  }

  function openForm(existing) {
    const editing = Boolean(existing);
    let photoFile = null;
    let removeExistingPhoto = false;

    const name = el('input', { type: 'text', required: true, placeholder: 'İsim', value: existing?.name || '' });
    const role = el('input', { type: 'text', placeholder: 'Ülke / Rol', value: existing?.country_role || '' });
    const note = el('textarea', { rows: '3', placeholder: 'Bu kişiyle ilgili notlar...' }, existing?.note || '');

    const cat = el('select', {}, Object.entries(CATS).map(([val, c]) =>
      el('option', { value: val, ...(existing?.category === val ? { selected: true } : {}) }, c.label)));
    if (!existing) cat.value = 'neutral';

    const picker = photoPicker(f => {
      photoFile = f;
      if (f === null) removeExistingPhoto = true;
    }, existing?.photo_url || null);

    const form = el('form', { class: 'form', id: 'c-form' }, [
      field('İsim *', name),
      field('Ülke / Rol', role),
      field('Kategori', cat),
      field('Not', note),
      el('div', {}, [el('div', { class: 'field-label', text: 'Fotoğraf (opsiyonel)' }), picker])
    ]);

    const submit = el('button', { class: 'btn btn-primary', text: 'Kaydet', type: 'submit', form: 'c-form' });
    const m = openModal({
      title: editing ? 'Kişiyi Düzenle' : 'Yeni Kişi',
      body: form,
      footer: [el('button', { class: 'btn btn-ghost', type: 'button', text: 'İptal', onClick: () => m.close() }), submit]
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!name.value.trim()) { toast('İsim gerekli.', 'error'); return; }
      submit.disabled = true;
      submit.textContent = 'Kaydediliyor...';

      let photo = {};
      if (photoFile) {
        if (!isOnline()) {
          toast('Çevrimdışısın: kayıt fotoğrafsız işlenecek.', 'warn');
        } else {
          try {
            const up = await uploadPhoto(photoFile, TABLE);
            photo = { photo_url: up.url, photo_path: up.path };
            if (editing && existing.photo_path) deletePhoto(existing.photo_path);
          } catch {
            toast('Fotoğraf yüklenemedi.', 'warn');
          }
        }
      } else if (editing && removeExistingPhoto) {
        photo = { photo_url: null, photo_path: null };
        if (existing.photo_path) deletePhoto(existing.photo_path);
      }

      const payload = {
        name: name.value.trim(),
        country_role: role.value.trim(),
        category: cat.value,
        note: note.value.trim(),
        ...photo
      };

      if (editing) {
        await update(TABLE, existing.id, { ...payload, updated_at: new Date().toISOString() });
        toast('Kişi güncellendi.');
      } else {
        await create(TABLE, { ...payload, updated_at: new Date().toISOString() });
        toast('Kişi eklendi.');
      }

      m.close();
      paint(cached(TABLE));
    });
  }

  buildFilters();
  paint(cached(TABLE));
  fetchAll(TABLE).then(paint);
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}
