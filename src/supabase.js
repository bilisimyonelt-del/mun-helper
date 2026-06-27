import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Supabase istemcisi, girilen oda koduna göre oluşturulur.
// Oda kodu her isteğe "x-room-code" başlığı olarak eklenir; sunucudaki RLS
// politikaları bu başlığa bakarak erişimi kısıtlar.
let client = null;

export function initSupabase(roomCode) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { 'x-room-code': roomCode }
    }
  });
  return client;
}

export function getClient() {
  return client;
}

export function hasClient() {
  return client !== null;
}
