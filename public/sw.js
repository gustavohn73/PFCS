// public/sw.js
const CACHE_VERSION = 'v2.0.0'; // Incrementar quando houver mudanças importantes
const CACHE_NAME = `tatenugrana-${CACHE_VERSION}`;
const BASE_PATH = '/';

const STATIC_ASSETS = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'manifest.json',

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
    BASE_PATH + 'js/core/app.js',
    BASE_PATH + 'js/core/navigation.js',

    // Pages HTML
    BASE_PATH + 'pages/inicio.html',
    BASE_PATH + 'pages/setup.html',
    BASE_PATH + 'pages/transacoes.html',
    BASE_PATH + 'pages/contas.html',
    BASE_PATH + 'pages/conta-detalhes.html',
    BASE_PATH + 'pages/configuracoes.html',
    BASE_PATH + 'pages/lancamento.html'
];

// Recursos que SEMPRE vêm da rede (não cachear)
const NETWORK_ONLY = [
    'firebaseapp.com',
    'googleapis.com',
    'firebasestorage.googleapis.com'
];

// Install - cachear recursos estáticos
self.addEventListener('install', event => {
    console.log(`[SW] 🔧 Instalando versão ${CACHE_VERSION}...`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] 📦 Cache aberto:', CACHE_NAME);
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] ✅ Recursos cacheados com sucesso');
                return self.skipWaiting(); // Ativa imediatamente
            })
            .catch(error => {
                console.error('[SW] ❌ Erro ao cachear recursos:', error);
            })
    );
});

// Activate - limpar caches antigos
self.addEventListener('activate', event => {
    console.log('[SW] 🚀 Ativando...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName.startsWith('tatenugrana-')) {
                            console.log('[SW] 🗑️ Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] ✅ Service Worker ativado');
                return self.clients.claim(); // Controla todas as páginas imediatamente
            })
    );
});

// Fetch - estratégia de cache
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora requisições que não são GET
    if (request.method !== 'GET') return;

    // Network-only para Firebase e APIs externas
    if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
        event.respondWith(fetch(request));
        return;
    }

    // Estratégia: Cache First, fallback para Network
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[SW] 📦 Servindo do cache:', url.pathname);

                    // Atualiza em background (stale-while-revalidate)
                    fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, networkResponse);
                            });
                        }
                    }).catch(() => { }); // Ignora erros de rede silenciosamente

                    return cachedResponse;
                }

                // Não está no cache, busca da rede
                console.log('[SW] 🌐 Buscando da rede:', url.pathname);
                return fetch(request)
                    .then(response => {
                        // Não cachear respostas de erro
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Cachear a resposta para uso futuro
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });

                        return response;
                    })
                    .catch(error => {
                        console.error('[SW] ❌ Erro na requisição:', url.pathname, error);

                        // Página offline genérica (se houver)
                        if (request.destination === 'document') {
                            return caches.match('/offline.html');
                        }

                        throw error;
                    });
            })
    );
});

// Mensagens do cliente (para forçar atualização)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] ⚡ Forçando atualização...');
        self.skipWaiting();
    }
});