// Paylaşılan UI yardımcıları: element oluşturma, modal, toast, lightbox, onay,
// tarih biçimleme.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---- Tarih biçimleme -------------------------------------------------------
export function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// datetime-local input için "YYYY-MM-DDTHH:mm" değeri (yerel saat).
export function nowLocalInput() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToISO(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

export function isoToLocalInput(iso) {
  if (!iso) return nowLocalInput();
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Toast -----------------------------------------------------------------
let toastBox;
export function toast(message, type = 'info') {
  if (!toastBox) {
    toastBox = el('div', { class: 'toast-box' });
    document.body.append(toastBox);
  }
  const t = el('div', { class: `toast toast-${type}`, text: message });
  toastBox.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

// ---- Modal -----------------------------------------------------------------
export function openModal({ title, body, footer }) {
  const overlay = el('div', { class: 'modal-overlay' });
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const panel = el('div', { class: 'modal-panel' }, [
    el('div', { class: 'modal-head' }, [
      el('h2', { class: 'modal-title', text: title || '' }),
      el('button', { class: 'icon-btn', text: '✕', title: 'Kapat', onClick: close })
    ]),
    el('div', { class: 'modal-body' }, body ? [body] : []),
    footer ? el('div', { class: 'modal-foot' }, footer) : null
  ]);

  overlay.append(panel);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);

  return { overlay, close };
}

// ---- Onay (sil vb.) --------------------------------------------------------
export function confirmDialog(message, { okText = 'Sil', danger = true } = {}) {
  return new Promise(resolve => {
    const okBtn = el('button', {
      class: danger ? 'btn btn-danger' : 'btn btn-primary',
      text: okText,
      onClick: () => { m.close(); resolve(true); }
    });
    const cancelBtn = el('button', {
      class: 'btn btn-ghost',
      text: 'İptal',
      onClick: () => { m.close(); resolve(false); }
    });
    const m = openModal({
      title: 'Emin misin?',
      body: el('p', { class: 'confirm-text', text: message }),
      footer: [cancelBtn, okBtn]
    });
  });
}

// ---- Lightbox (büyük fotoğraf) ---------------------------------------------
export function lightbox(url) {
  const overlay = el('div', { class: 'lightbox-overlay' });
  const img = el('img', { class: 'lightbox-img', src: url, alt: '' });
  overlay.append(img);
  overlay.addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  });
  document.body.append(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);
}

export function thumb(url, onClick) {
  return el('img', {
    class: 'thumb',
    src: url,
    alt: 'fotoğraf',
    loading: 'lazy',
    onClick: onClick || (() => lightbox(url))
  });
}

// ---- Fotoğraf seçici (kamera VEYA galeri) ----------------------------------
// onPick(file) çağrılır. Seçilen dosyanın önizleme URL'sini de döndürür.
export function photoPicker(onPick, currentUrl) {
  const wrap = el('div', { class: 'photo-picker' });
  const preview = el('div', { class: 'photo-preview' });

  let previewUrl = currentUrl || null;
  function renderPreview() {
    clear(preview);
    if (previewUrl) {
      preview.append(thumb(previewUrl, () => lightbox(previewUrl)));
      preview.append(el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', text: 'Fotoğrafı kaldır',
        onClick: () => { previewUrl = null; onPick(null); renderPreview(); }
      }));
    }
  }

  const cameraInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden-file' });
  const galleryInput = el('input', { type: 'file', accept: 'image/*', class: 'hidden-file' });

  function handle(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    previewUrl = URL.createObjectURL(file);
    onPick(file);
    renderPreview();
  }
  cameraInput.addEventListener('change', () => handle(cameraInput));
  galleryInput.addEventListener('change', () => handle(galleryInput));

  wrap.append(
    el('div', { class: 'photo-btns' }, [
      el('button', { class: 'btn btn-ghost', type: 'button', text: '📷 Kamera', onClick: () => cameraInput.click() }),
      el('button', { class: 'btn btn-ghost', type: 'button', text: '🖼️ Galeri', onClick: () => galleryInput.click() })
    ]),
    cameraInput, galleryInput, preview
  );
  renderPreview();
  return wrap;
}
