const CACHE_NAME = 'tatenugrana-v1.0.0';
const BASE_PATH = '/';

const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'favicon.ico',
  
  // Icons 
  BASE_PATH + 'icons/favicon-96x96.png',
  BASE_PATH + 'icons/apple-touch-icon.png',
  BASE_PATH + 'icons/web-app-manifest-192x192.png',
  BASE_PATH + 'icons/web-app-manifest-512x512.png',
  
  // CSS
  BASE_PATH + 'css/design-system.css',
  BASE_PATH + 'css/layout.css',
  BASE_PATH + 'css/components.css',
  BASE_PATH + 'css/sidebar.css',
  BASE_PATH + 'css/cards.css',
  BASE_PATH + 'css/mobile.css',
  BASE_PATH + 'css/overrides.css',
  BASE_PATH + 'css/setup-wizard.css',
  
  // JS Core
  BASE_PATH + 'js/main.js',
  BASE_PATH + 'js/auth.js',
  BASE_PATH + 'js/firebase-config.js',
  BASE_PATH + 'js/firebase-schema.js',
  BASE_PATH + 'js/firestore-service.js',
  
  // JS Core
  BASE_PATH + 'js/core/app.js',
  BASE_PATH + 'js/core/navigation.js',
  
  // Pages
  BASE_PATH + 'pages/inicio.html',
  BASE_PATH + 'pages/setup.html',
  BASE_PATH + 'pages/transacoes.html',
  BASE_PATH + 'pages/contas.html',
  BASE_PATH + 'pages/conta-detalhes.html',
  BASE_PATH + 'pages/configuracoes.html',
  
  // Controllers
  BASE_PATH + 'js/pages/overview-controller.js',
  BASE_PATH + 'js/pages/transacoes-controller.js',
  BASE_PATH + 'js/pages/contas-controller.js',
  BASE_PATH + 'js/pages/conta-detalhes-controller.js',
  BASE_PATH + 'js/pages/setup.js',
  BASE_PATH + 'js/pages/configuracoes.js',
  
  // External CDN
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto:', CACHE_NAME);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const requestUrl = new URL(event.request.url);

  // Ignora requisições para domínios externos do Firebase e permite que o navegador as gerencie
  if (requestUrl.hostname.includes('googleapis.com') ||
      requestUrl.hostname.includes('gstatic.com')) {
    return;
  }
  
  // Para todas as outras requisições (incluindo seus arquivos locais), prossiga com a estratégia de cache
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request.clone())
          .then(fetchResponse => {
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }
            
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return fetchResponse;
          })
          .catch(() => {
            if (event.request.url.endsWith('.html') || event.request.url === BASE_PATH) {
              return caches.match(BASE_PATH + 'index.html');
            }
          });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});