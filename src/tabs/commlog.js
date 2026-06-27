import { el, clear, openModal, toast, confirmDialog, formatDateTime, nowLocalInput, localInputToISO } from '../ui.js';
import { fetchAll, create, remove, cached } from '../api.js';

const TABLE = 'comm_log';

export function renderCommLog(container) {
  clear(container);
  const list = el('div', { class: 'card-list' });

  container.append(
    el('div', { class: 'tab-head' }, [
      el('h1', { text: 'İletişim Günlüğü' }),
      el('button', { class: 'btn btn-primary', text: '+ Yeni Kayıt', onClick: openForm })
    ]),
    el('p', { class: 'tab-desc', text: 'Gizli görüşmeler ve anlaşmalar — kiminle, ne zaman, ne konuşuldu.' }),
    list
  );

  function paint(rows) {
    clear(list);
    if (!rows.length) {
      list.append(el('p', { class: 'empty', text: 'Henüz kayıt yok.' }));
      return;
    }
    for (const r of rows) list.append(card(r));
  }

  function card(r) {
    return el('div', { class: 'card' }, [
      r._pending ? el('span', { class: 'pending-badge', text: 'senkron bekliyor' }) : null,
      el('div', { class: 'card-title-row' }, [
        el('h3', { class: 'card-title', text: r.who || 'Bilinmeyen' }),
        el('span', { class: 'card-date', text: formatDateTime(r.happened_at) })
      ]),
      el('p', { class: 'card-text', text: r.content }),
      el('div', { class: 'card-actions' }, [
        el('button', { class: 'btn btn-danger btn-sm', text: 'Sil', onClick: () => del(r) })
      ])
    ]);
  }

  async function del(r) {
    if (!(await confirmDialog('Bu kaydı silmek istediğine emin misin?'))) return;
    await remove(TABLE, r.id);
    paint(cached(TABLE));
    toast('Kayıt silindi.');
  }

  function openForm() {
    const who = el('input', { type: 'text', placeholder: 'Kiminle? (kişi/delegasyon)' });
    const when = el('input', { type: 'datetime-local', value: nowLocalInput() });
    const content = el('textarea', { rows: '5', required: true, placeholder: 'Ne konuşuldu / ne anlaşıldı?' });

    const form = el('form', { class: 'form', id: 'cl-form' }, [
      field('Kiminle', who),
      field('Tarih / Saat', when),
      field('Konuşulan / Anlaşılan *', content)
    ]);

    const submit = el('button', { class: 'btn btn-primary', text: 'Kaydet', type: 'submit', form: 'cl-form' });
    const m = openModal({
      title: 'Yeni İletişim Kaydı',
      body: form,
      footer: [el('button', { class: 'btn btn-ghost', type: 'button', text: 'İptal', onClick: () => m.close() }), submit]
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!content.value.trim()) { toast('İçerik gerekli.', 'error'); return; }
      submit.disabled = true;
      await create(TABLE, {
        who: who.value.trim(),
        happened_at: localInputToISO(when.value),
        content: content.value.trim()
      });
      m.close();
      paint(cached(TABLE));
      toast('Kayıt eklendi.');
    });
  }

  paint(cached(TABLE));
  fetchAll(TABLE).then(paint);
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}
