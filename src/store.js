import { getRoom } from './auth.js';

// ---------------------------------------------------------------------------
// Yerel önbellek (okuma) + yazma kuyruğu (outbox).
// Çevrimdışıyken veriler buradan gösterilir; yazma işlemleri kuyruğa alınır,
// bağlantı gelince gönderilir.
// Tüm anahtarlar oda koduna göre ayrılır.
// ---------------------------------------------------------------------------

function cacheKey(table) {
  return `mun:cache:${getRoom()}:${table}`;
}
function outboxKey() {
  return `mun:outbox:${getRoom()}`;
}

// ---- Okuma önbelleği -------------------------------------------------------
export function readCache(table) {
  try {
    const raw = localStorage.getItem(cacheKey(table));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeCache(table, rows) {
  try {
    localStorage.setItem(cacheKey(table), JSON.stringify(rows));
  } catch (e) {
    console.warn('Önbelleğe yazılamadı', e);
  }
}

// ---- Outbox (yazma kuyruğu) ------------------------------------------------
export function readOutbox() {
  try {
    const raw = localStorage.getItem(outboxKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeOutbox(ops) {
  localStorage.setItem(outboxKey(), JSON.stringify(ops));
}

export function outboxCount() {
  return readOutbox().length;
}

// Yerel (henüz senkron edilmemiş) kayıt id'leri "local-" ile başlar.
export function makeLocalId() {
  return 'local-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
}
export function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('local-');
}

// Bir işlemi kuyruğa ekle. Aynı yerel kaydı zinciri akıllıca birleştirir:
//  - yerel bir kayıt silinirse, bekleyen insert iptal edilir.
//  - yerel bir kayıt güncellenirse, bekleyen insert üzerine yazılır.
export function enqueue(op) {
  const ops = readOutbox();

  if (op.type === 'delete' && isLocalId(op.id)) {
    // Henüz sunucuya gitmemiş bir kaydı sil: sadece bekleyen insert'i kaldır.
    const filtered = ops.filter(o => !(o.type === 'insert' && o.record && o.record.id === op.id));
    writeOutbox(filtered);
    return;
  }

  if (op.type === 'update' && isLocalId(op.id)) {
    const pending = ops.find(o => o.type === 'insert' && o.record && o.record.id === op.id);
    if (pending) {
      Object.assign(pending.record, op.patch);
      writeOutbox(ops);
      return;
    }
  }

  ops.push(op);
  writeOutbox(ops);
}

export function clearOutbox() {
  writeOutbox([]);
}
