import { el, clear, openModal, toast, confirmDialog, formatDateTime, thumb, photoPicker, nowLocalInput, localInputToISO } from '../ui.js';
import { fetchAll, create, remove, cached } from '../api.js';
import { uploadPhoto, deletePhoto } from '../photos.js';
import { isOnline } from '../sync.js';

const TABLE = 'crisis_updates';

export function renderTimeline(container) {
  clear(container);
  const list = el('div', { class: 'card-list' });

  container.append(
    el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Kriz Güncellemeleri' }),
      el('button', { class: 'btn btn-primary', text: '+ Yeni Güncelleme', onClick: openForm })
    ]),
    list
  );

  function paint(rows) {
    clear(list);
    if (!rows.length) {
      list.append(el('p', { class: 'empty', text: 'Henüz güncelleme yok. "+ Yeni Güncelleme" ile başla.' }));
      return;
    }
    for (const r of rows) list.append(card(r));
  }

  function card(r) {
    const stats = Array.isArray(r.stats) ? r.stats : [];
    return el('div', { class: 'card' }, [
      r._pending ? el('span', { class: 'pending-badge', text: 'senkron bekliyor' }) : null,
      el('div', { class: 'card-row' }, [
        el('div', { class: 'card-main' }, [
          el('h3', { class: 'card-title', text: r.title }),
          el('div', { class: 'card-date', text: formatDateTime(r.happened_at) }),
          r.description ? el('p', { class: 'card-text', text: r.description }) : null,
          stats.length ? el('div', { class: 'chips' },
            stats.map(s => el('span', { class: 'chip chip-stat', text: `${s.label}: ${s.value}` }))) : null
        ]),
        r.photo_url ? thumb(r.photo_url) : null
      ]),
      el('div', { class: 'card-actions' }, [
        el('button', { class: 'btn btn-danger btn-sm', text: 'Sil', onClick: () => del(r) })
      ])
    ]);
  }

  async function del(r) {
    if (!(await confirmDialog('Bu güncellemeyi silmek istediğine emin misin?'))) return;
    await remove(TABLE, r.id);
    if (r.photo_path) deletePhoto(r.photo_path);
    paint(cached(TABLE));
    toast('Güncelleme silindi.');
  }

  function openForm() {
    let photoFile = null;
    const statsBox = el('div', { class: 'stats-editor' });

    function addStatRow(label = '', value = '') {
      const lblIn = el('input', { type: 'text', placeholder: 'Etiket (örn. Kayıp)', value: label });
      const valIn = el('input', { type: 'text', placeholder: 'Değer (örn. 500)', value });
      const row = el('div', { class: 'stat-row' }, [
        lblIn, valIn,
        el('button', { class: 'icon-btn', type: 'button', text: '✕', title: 'Kaldır', onClick: () => row.remove() })
      ]);
      statsBox.append(row);
    }

    const title = el('input', { type: 'text', required: true, placeholder: 'Örn. Sınır çatışması başladı' });
    const when = el('input', { type: 'datetime-local', value: nowLocalInput() });
    const desc = el('textarea', { rows: '4', placeholder: 'Ne oldu? Detaylar...' });

    const form = el('form', { class: 'form' }, [
      field('Başlık *', title),
      field('Tarih / Saat', when),
      field('Açıklama', desc),
      el('div', {}, [
        el('div', { class: 'field-label', text: 'Sayısal veriler (etiket: değer)' }),
        statsBox,
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Sayısal veri ekle', onClick: () => addStatRow() })
      ]),
      el('div', {}, [
        el('div', { class: 'field-label', text: 'Fotoğraf (opsiyonel)' }),
        photoPicker(f => { photoFile = f; })
      ])
    ]);

    const submit = el('button', { class: 'btn btn-primary', text: 'Kaydet', type: 'submit', form: 'tl-form' });
    form.id = 'tl-form';

    const m = openModal({
      title: 'Yeni Kriz Güncellemesi',
      body: form,
      footer: [el('button', { class: 'btn btn-ghost', type: 'button', text: 'İptal', onClick: () => m.close() }), submit]
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!title.value.trim()) { toast('Başlık gerekli.', 'error'); return; }
      submit.disabled = true;
      submit.textContent = 'Kaydediliyor...';

      const stats = [...statsBox.querySelectorAll('.stat-row')].map(row => {
        const [l, v] = row.querySelectorAll('input');
        return { label: l.value.trim(), value: v.value.trim() };
      }).filter(s => s.label || s.value);

      let photo = {};
      if (photoFile) {
        if (!isOnline()) {
          toast('Çevrimdışısın: kayıt fotoğrafsız eklenecek. Bağlanınca fotoğrafı tekrar ekle.', 'warn');
        } else {
          try {
            const up = await uploadPhoto(photoFile, TABLE);
            photo = { photo_url: up.url, photo_path: up.path };
          } catch {
            toast('Fotoğraf yüklenemedi, kayıt fotoğrafsız ekleniyor.', 'warn');
          }
        }
      }

      await create(TABLE, {
        title: title.value.trim(),
        happened_at: localInputToISO(when.value),
        description: desc.value.trim(),
        stats,
        ...photo
      });

      m.close();
      paint(cached(TABLE));
      toast('Güncelleme eklendi.');
    });
  }

  // İlk çizim: önbellek + ardından sunucu.
  paint(cached(TABLE));
  fetchAll(TABLE).then(paint);
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}
