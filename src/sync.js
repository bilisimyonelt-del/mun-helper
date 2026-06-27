// Çevrimiçi/çevrimdışı durum takibi ve dinleyiciler.
const listeners = new Set();

export function isOnline() {
  return navigator.onLine;
}

export function onStatusChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) {
    try { cb(isOnline()); } catch (e) { console.error(e); }
  }
}

window.addEventListener('online', notify);
window.addEventListener('offline', notify);
