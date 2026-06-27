import { getClient } from './supabase.js';
import { getRoom } from './auth.js';
import { STORAGE_BUCKET } from './config.js';
import { isOnline } from './sync.js';

// Fotoğraf yükleme/silme - Supabase Storage.
// Dosyalar "<oda_kodu>/<tablo>/<uuid>.<ext>" yolunda saklanır.

function extOf(file) {
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  if (dot > -1) return name.slice(dot + 1).toLowerCase();
  if (file.type && file.type.includes('/')) return file.type.split('/')[1];
  return 'jpg';
}

export async function uploadPhoto(file, table) {
  if (!isOnline()) {
    throw new Error('offline');
  }
  const client = getClient();
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  const path = `${getRoom()}/${table}/${id}.${extOf(file)}`;

  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deletePhoto(path) {
  if (!path) return;
  const client = getClient();
  if (!client || !isOnline()) return; // çevrimdışıyken sessizce geç
  try {
    await client.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (e) {
    console.warn('Fotoğraf silinemedi', e);
  }
}
