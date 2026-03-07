// מנוע האפליקציה - מופעל ברקע
const CACHE_NAME = 'nashi-app-v1';

self.addEventListener('install', (e) => {
  console.log('[Service Worker] הותקן בהצלחה');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] הופעל בהצלחה');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // כרגע המנוע פשוט נותן לבקשות השרת לעבור כרגיל.
  // בעתיד אפשר להוסיף פה קוד ששומר דפים כדי שהאפליקציה תעבוד גם בלי אינטרנט!
  e.respondWith(fetch(e.request));
});