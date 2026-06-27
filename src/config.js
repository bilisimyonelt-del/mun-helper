// Ortam değişkenleri (Vite build sırasında enjekte edilir).
// Bu değerler .env dosyasından gelir; repoda gerçek değer YOKTUR.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const STORAGE_BUCKET = 'mun-photos';

// Oda kodu uygulamada çalışma anında girilir; burada SAKLANMAZ/GÖMÜLMEZ.
export const ROOM_KEY = 'mun:room-code';
export const THEME_KEY = 'mun:theme';

// Her tablonun listeleme sırası (en yeni üstte için azalan).
export const TABLES = {
  crisis_updates: { orderBy: 'happened_at', asc: false },
  contacts:       { orderBy: 'created_at',  asc: false },
  proposals:      { orderBy: 'created_at',  asc: false },
  comm_log:       { orderBy: 'happened_at', asc: false },
  map_links:      { orderBy: 'created_at',  asc: false }
};

// Yapılandırma eksikse erken uyaralım.
export function isConfigured() {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
}
