self.addEventListener('install', (event) => {
  console.log('Service Worker do Patrão Digital instalado!');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado!');
});

// Responde às requisições da internet e cala o aviso "no-op" do Chrome
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Se a pessoa estiver sem internet no celular, mostra isso em vez do "dinossauro" do Chrome
      return new Response(
        'Você está offline. Conecte-se à internet para usar o Patrão Digital.',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    })
  );
});