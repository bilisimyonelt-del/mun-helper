import { el, clear, openModal, toast, confirmDialog, formatDateTime } from '../ui.js';
import { fetchAll, create, update, remove, cached } from '../api.js';

const TABLE = 'proposals';

const STATUS = {
  pending:  { label: 'Beklemede',     cls: 'st-pending' },
  accepted: { label: 'Kabul Edildi',  cls: 'st-accepted' },
  rejected: { label: 'Reddedildi',    cls: 'st-rejected' }
};

export function renderProposals(container) {
  clear(container);
  const list = el('div', { class: 'card-list' });

  container.append(
    el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Notlar & Teklifler' }),
      el('button', { class: 'btn btn-primary', text: '+ Yeni Teklif', onClick: openForm })
    ]),
    list
  );

  function paint(rows) {
    clear(list);
    if (!rows.length) {
      list.append(el('p', { class: 'empty', text: 'Henüz teklif yok.' }));
      return;
    }
    for (const r of rows) list.append(card(r));
  }

  function card(r) {
    const st = STATUS[r.status] || STATUS.pending;
    const statusSelect = el('select', { class: `status-select ${st.cls}` },
      Object.entries(STATUS).map(([val, s]) =>
        el('option', { value: val, ...(r.status === val ? { selected: true } : {}) }, s.label)));
    statusSelect.addEventListener('change', async () => {
      await update(TABLE, r.id, { status: statusSelect.value });
      paint(cached(TABLE));
      toast('Durum güncellendi.');
    });

    return el('div', { class: 'card' }, [
      r._pending ? el('span', { class: 'pending-badge', text: 'senkron bekliyor' }) : null,
      el('div', { class: 'card-title-row' }, [
        el('h3', { class: 'card-title', text: r.title }),
        el('span', { class: `chip ${st.cls}`, text: st.label })
      ]),
      el('div', { class: 'card-date', text: formatDateTime(r.created_at) }),
      r.description ? el('p', { class: 'card-text', text: r.description }) : null,
      r.supporters ? el('p', { class: 'card-text small' }, [el('strong', { text: 'Destekleyenler: ' }), r.supporters]) : null,
      el('div', { class: 'card-actions' }, [
        el('label', { class: 'inline-label', text: 'Durum:' }), statusSelect,
        el('button', { class: 'btn btn-danger btn-sm', text: 'Sil', onClick: () => del(r) })
      ])
    ]);
  }

  async function del(r) {
    if (!(await confirmDialog('Bu teklifi silmek istediğine emin misin?'))) return;
    await remove(TABLE, r.id);
    paint(cached(TABLE));
    toast('Teklif silindi.');
  }

  function openForm() {
    const title = el('input', { type: 'text', required: true, placeholder: 'Teklif başlığı' });
    const desc = el('textarea', { rows: '4', placeholder: 'Teklifin açıklaması...' });
    const status = el('select', {}, Object.entries(STATUS).map(([val, s]) => el('option', { value: val }, s.label)));
    const supporters = el('textarea', { rows: '2', placeholder: 'Destekleyen kişiler/delegasyonlar...' });

    // Sekme 2'deki kişilerden hızlı ekleme.
    const contacts = cached('contacts');
    const chipRow = el('div', { class: 'chips contact-chips' });
    if (contacts.length) {
      for (const c of contacts) {
        chipRow.append(el('button', {
          class: 'chip chip-clickable', type: 'button', text: c.name,
          onClick: () => {
            const cur = supporters.value.trim();
            const names = cur ? cur.split(',').map(s => s.trim()) : [];
            if (!names.includes(c.name)) {
              supporters.value = cur ? `${cur}, ${c.name}` : c.name;
            }
          }
        }));
      }
    }

    const form = el('form', { class: 'form', id: 'p-form' }, [
      field('Başlık *', title),
      field('Açıklama', desc),
      field('Durum', status),
      field('Destekleyenler', supporters),
      contacts.length ? el('div', {}, [
        el('div', { class: 'field-label', text: 'Kişilerden seç (eklemek için dokun)' }),
        chipRow
      ]) : null
    ]);

    const submit = el('button', { class: 'btn btn-primary', text: 'Kaydet', type: 'submit', form: 'p-form' });
    const m = openModal({
      title: 'Yeni Teklif / Not',
      body: form,
      footer: [el('button', { class: 'btn btn-ghost', type: 'button', text: 'İptal', onClick: () => m.close() }), submit]
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!title.value.trim()) { toast('Başlık gerekli.', 'error'); return; }
      submit.disabled = true;
      await create(TABLE, {
        title: title.value.trim(),
        description: desc.value.trim(),
        status: status.value,
        supporters: supporters.value.trim()
      });
      m.close();
      paint(cached(TABLE));
      toast('Teklif eklendi.');
    });
  }

  paint(cached(TABLE));
  fetchAll(TABLE).then(paint);
}

function field(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]);
}
