import { ROOM_KEY } from './config.js';
import { initSupabase } from './supabase.js';

// Basit oda kodu yönetimi.
// Oda kodu yalnızca bu cihazın localStorage'ında tutulur (oturum kalıcılığı için)
// ve hiçbir zaman kaynak koda gömülmez.

let currentRoom = null;

export function getRoom() {
  if (currentRoom) return currentRoom;
  currentRoom = localStorage.getItem(ROOM_KEY);
  return currentRoom;
}

export function isLoggedIn() {
  return Boolean(getRoom());
}

export function login(roomCode) {
  const code = (roomCode || '').trim();
  if (!code) throw new Error('Oda kodu boş olamaz.');
  currentRoom = code;
  localStorage.setItem(ROOM_KEY, code);
  initSupabase(code);
  return code;
}

export function logout() {
  currentRoom = null;
  localStorage.removeItem(ROOM_KEY);
}

// Uygulama açılışında, kayıtlı oda kodu varsa istemciyi hazırla.
export function restoreSession() {
  const code = getRoom();
  if (code) {
    initSupabase(code);
    return true;
  }
  return false;
}
