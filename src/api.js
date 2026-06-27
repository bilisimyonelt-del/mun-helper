import { getClient } from './supabase.js';
import { getRoom } from './auth.js';
import { TABLES } from './config.js';
import { isOnline } from './sync.js';
import {
  readCache, writeCache, enqueue, readOutbox, writeOutbox,
  makeLocalId, isLocalId
} from './store.js';

// ---------------------------------------------------------------------------
// Veri erişim katmanı: çevrimiçiyken Supabase, çevrimdışıyken yerel önbellek +
// yazma kuyruğu (outbox).
// ---------------------------------------------------------------------------

function sortRows(table, rows) {
  const cfg = TABLES[table];
  if (!cfg) return rows;
  const f = cfg.orderBy;
  return [...rows].sort((a, b) => {
    const av = a[f] || '';
    const bv = b[f] || '';
    if (av === bv) return 0;
    const cmp = av < bv ? -1 : 1;
    return cfg.asc ? cmp : -cmp;
  });
}

// Önbelleği oku (anında gösterim için).
export function cached(table) {
  return sortRows(table, readCache(table));
}

// Sunucudan çek; başarılıysa önbelleği güncelle.
export async function fetchAll(table) {
  const cfg = TABLES[table];
  if (!isOnline()) return cached(table);
  try {
    const { data, error } = await getClient()
      .from(table)
      .select('*')
      .order(cfg.orderBy, { ascending: cfg.asc });
    if (error) throw error;
    writeCache(table, data || []);
    return sortRows(table, data || []);
  } catch (e) {
    console.warn(`${table} çekilemedi, önbellek kullanılıyor`, e);
    return cached(table);
  }
}

export async function create(table, payload) {
  const now = new Date().toISOString();
  const record = { room_id: getRoom(), created_at: now, ...payload };

  if (isOnline()) {
    try {
      const { data, error } = await getClient()
        .from(table).insert(record).select().single();
      if (error) throw error;
      writeCache(table, [data, ...readCache(table)]);
      return data;
    } catch (e) {
      console.warn('Çevrimiçi ekleme başarısız, kuyruğa alınıyor', e);
    }
  }

  // Çevrimdışı / hata: yerel kayıt + kuyruk.
  const local = { ...record, id: makeLocalId(), _pending: true };
  writeCache(table, [local, ...readCache(table)]);
  enqueue({ type: 'insert', table, record: local });
  return local;
}

export async function update(table, id, patch) {
  if (isOnline() && !isLocalId(id)) {
    try {
      const { data, error } = await getClient()
        .from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      writeCache(table, readCache(table).map(r => (r.id === id ? data : r)));
      return data;
    } catch (e) {
      console.warn('Çevrimiçi güncelleme başarısız, kuyruğa alınıyor', e);
    }
  }

  const updated = readCache(table).map(r => (r.id === id ? { ...r, ...patch, _pending: true } : r));
  writeCache(table, updated);
  enqueue({ type: 'update', table, id, patch });
  return updated.find(r => r.id === id);
}

export async function remove(table, id) {
  if (isOnline() && !isLocalId(id)) {
    try {
      const { error } = await getClient().from(table).delete().eq('id', id);
      if (error) throw error;
      writeCache(table, readCache(table).filter(r => r.id !== id));
      return;
    } catch (e) {
      console.warn('Çevrimiçi silme başarısız, kuyruğa alınıyor', e);
    }
  }

  writeCache(table, readCache(table).filter(r => r.id !== id));
  enqueue({ type: 'delete', table, id });
}

// ---- Ülke Profili (oda başına tek satır) -----------------------------------
const PROFILE_CACHE = 'mun:profile';
function profileKey() { return `${PROFILE_CACHE}:${getRoom()}`; }

export async function getProfile() {
  if (!isOnline()) {
    return localStorage.getItem(profileKey()) || '';
  }
  try {
    const { data, error } = await getClient()
      .from('country_profile').select('content').eq('room_id', getRoom()).maybeSingle();
    if (error) throw error;
    const content = data?.content || '';
    localStorage.setItem(profileKey(), content);
    return content;
  } catch (e) {
    console.warn('Profil çekilemedi', e);
    return localStorage.getItem(profileKey()) || '';
  }
}

export async function saveProfile(content) {
  localStorage.setItem(profileKey(), content);
  if (isOnline()) {
    try {
      const { error } = await getClient()
        .from('country_profile')
        .upsert({ room_id: getRoom(), content, updated_at: new Date().toISOString() });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('Profil kaydedilemedi, kuyruğa alınıyor', e);
    }
  }
  enqueue({ type: 'profile', content });
}

// ---- Kuyruğu boşalt (bağlantı gelince) -------------------------------------
export async function flushOutbox() {
  if (!isOnline()) return { done: 0, remaining: readOutbox().length };

  const ops = readOutbox();
  const remaining = [];
  let done = 0;

  for (const op of ops) {
    try {
      const client = getClient();
      if (op.type === 'insert') {
        const rec = { ...op.record };
        delete rec.id;          // sunucu yeni uuid üretsin
        delete rec._pending;
        const { error } = await client.from(op.table).insert(rec);
        if (error) throw error;
      } else if (op.type === 'update') {
        if (isLocalId(op.id)) { done++; continue; } // yerel kayıtlar insert'e gömülü
        const { error } = await client.from(op.table).update(op.patch).eq('id', op.id);
        if (error) throw error;
      } else if (op.type === 'delete') {
        if (isLocalId(op.id)) { done++; continue; }
        const { error } = await client.from(op.table).delete().eq('id', op.id);
        if (error) throw error;
      } else if (op.type === 'profile') {
        const { error } = await client.from('country_profile')
          .upsert({ room_id: getRoom(), content: op.content, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      done++;
    } catch (e) {
      console.warn('Kuyruk işlemi başarısız, sonra denenecek', op, e);
      remaining.push(op);
    }
  }

  writeOutbox(remaining);
  return { done, remaining: remaining.length };
}

// ---- Dışa aktarım (tüm veriler tek JSON) -----------------------------------
export async function exportAll() {
  const result = { exportedAt: new Date().toISOString(), room: getRoom(), data: {} };
  for (const table of Object.keys(TABLES)) {
    result.data[table] = await fetchAll(table);
  }
  result.data.country_profile = await getProfile();
  return result;
}
