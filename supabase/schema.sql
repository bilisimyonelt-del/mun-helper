-- ============================================================================
-- MUN Kriz Yardımcısı - Supabase Şeması
-- ----------------------------------------------------------------------------
-- Bu dosyayı Supabase Dashboard -> SQL Editor'a yapıştırıp "Run" de.
-- Tabloları, Row Level Security (RLS) politikalarını ve Storage bucket'ını
-- oluşturur.
--
-- GÜVENLİK MODELİ:
--   Veriler "oda kodu"na göre ayrılır (room_id sütunu). Her istek, oda kodunu
--   "x-room-code" HTTP başlığıyla gönderir. RLS politikaları yalnızca doğru
--   oda kodu gönderildiğinde o odanın verilerine erişime izin verir.
--   Böylece oda kodu HİÇBİR YERE gömülmeden, sunucu tarafında zorlanan bir
--   erişim anahtarı gibi davranır.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyon: İstek başlığındaki oda kodunu döndürür.
-- ---------------------------------------------------------------------------
create or replace function public.current_room()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-room-code',
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- 1) Kriz Güncellemeleri (Timeline)
-- ---------------------------------------------------------------------------
create table if not exists public.crisis_updates (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  title       text not null,
  happened_at timestamptz not null default now(),
  description text,
  stats       jsonb not null default '[]'::jsonb,   -- [{ "label": "Kayıp", "value": "500" }, ...]
  photo_url   text,
  photo_path  text,
  created_at  timestamptz not null default now()
);
create index if not exists crisis_updates_room_idx on public.crisis_updates (room_id, happened_at desc);

-- ---------------------------------------------------------------------------
-- 2) Kişiler & Müttefikler
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null,
  name         text not null,
  country_role text,
  category     text not null default 'neutral',  -- 'ally' | 'opponent' | 'neutral'
  note         text,
  photo_url    text,
  photo_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_room_idx on public.contacts (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) Notlar & Teklifler
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  title       text not null,
  description text,
  status      text not null default 'pending',   -- 'pending' | 'accepted' | 'rejected'
  supporters  text,
  created_at  timestamptz not null default now()
);
create index if not exists proposals_room_idx on public.proposals (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) İletişim Günlüğü
-- ---------------------------------------------------------------------------
create table if not exists public.comm_log (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  who         text,
  happened_at timestamptz not null default now(),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comm_log_room_idx on public.comm_log (room_id, happened_at desc);

-- ---------------------------------------------------------------------------
-- 5a) Harita Linkleri
-- ---------------------------------------------------------------------------
create table if not exists public.map_links (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null,
  label      text not null,
  url        text not null,
  created_at timestamptz not null default now()
);
create index if not exists map_links_room_idx on public.map_links (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5b) Ülke Profili (oda başına tek satır)
-- ---------------------------------------------------------------------------
create table if not exists public.country_profile (
  room_id    text primary key,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.crisis_updates  enable row level security;
alter table public.contacts        enable row level security;
alter table public.proposals       enable row level security;
alter table public.comm_log        enable row level security;
alter table public.map_links       enable row level security;
alter table public.country_profile enable row level security;

-- Her tablo için: yalnızca geçerli (boş olmayan) oda koduyla eşleşen satırlara erişim.
-- "anon" rolü (tarayıcıdaki anon key) için geçerli.

do $$
declare
  t text;
begin
  foreach t in array array[
    'crisis_updates', 'contacts', 'proposals', 'comm_log', 'map_links', 'country_profile'
  ]
  loop
    execute format('drop policy if exists room_select on public.%I;', t);
    execute format('drop policy if exists room_insert on public.%I;', t);
    execute format('drop policy if exists room_update on public.%I;', t);
    execute format('drop policy if exists room_delete on public.%I;', t);

    execute format($f$
      create policy room_select on public.%I
        for select to anon, authenticated
        using (room_id = public.current_room() and public.current_room() <> '');
    $f$, t);

    execute format($f$
      create policy room_insert on public.%I
        for insert to anon, authenticated
        with check (room_id = public.current_room() and public.current_room() <> '');
    $f$, t);

    execute format($f$
      create policy room_update on public.%I
        for update to anon, authenticated
        using (room_id = public.current_room() and public.current_room() <> '')
        with check (room_id = public.current_room() and public.current_room() <> '');
    $f$, t);

    execute format($f$
      create policy room_delete on public.%I
        for delete to anon, authenticated
        using (room_id = public.current_room() and public.current_room() <> '');
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- STORAGE (Fotoğraflar)
-- ============================================================================
-- "mun-photos" adında public bir bucket oluştur.
-- Dosyalar "<oda_kodu>/<tablo>/<dosya>.jpg" yolunda saklanır.
insert into storage.buckets (id, name, public)
values ('mun-photos', 'mun-photos', true)
on conflict (id) do nothing;

-- Storage politikaları
drop policy if exists "mun_photos_read"   on storage.objects;
drop policy if exists "mun_photos_insert" on storage.objects;
drop policy if exists "mun_photos_delete" on storage.objects;

-- Okuma: bucket public olduğu için herkes URL ile görebilir.
create policy "mun_photos_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'mun-photos');

-- Yükleme: yalnızca dosya, kullanıcının oda kodu klasörü altındaysa.
create policy "mun_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'mun-photos'
    and (storage.foldername(name))[1] = public.current_room()
    and public.current_room() <> ''
  );

-- Silme: yalnızca kendi oda klasöründen.
create policy "mun_photos_delete" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'mun-photos'
    and (storage.foldername(name))[1] = public.current_room()
    and public.current_room() <> ''
  );
