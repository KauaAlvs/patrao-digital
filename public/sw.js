// public/sw.js

self.addEventListener('install', (event) => {
  console.log('Service Worker do Patrão Digital instalado!');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado!');
});

// Sem esse evento fetch, o Chrome não reconhece como PWA
self.addEventListener('fetch', (event) => {
  // Por enquanto, apenas deixa a internet funcionar normalmente
});