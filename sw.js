/* =====================================================================
   Service worker «Электроосмотр»
   Кэширует оболочку приложения и локальные библиотеки, чтобы приложение
   открывалось без интернета (щитовая, подвал, плохая связь).

   Обновление: если поменяли файлы в vendor/ или иконки — поднимите
   версию кэша ниже (v1 → v2). Сама страница обновляется автоматически.
   ===================================================================== */

const CACHE = 'elektroosmotr-v2';

const SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/maskable-512.png',
    './icons/apple-touch-icon.png',
    './vendor/jszip.min.js',
    './vendor/xlsx.full.min.js'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            /* Каждый файл кэшируем отдельно: если одного нет, установка не падает */
            return Promise.all(SHELL.map(function (url) {
                return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
                    return null;
                });
            }));
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                return key === CACHE ? null : caches.delete(key);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET') return;

    let url;
    try {
        url = new URL(request.url);
    } catch (err) {
        return;
    }
    /* Чужие домены (CDN) не перехватываем */
    if (url.origin !== self.location.origin) return;

    /* Страница: сначала сеть, при отсутствии — кэш */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then(function (response) {
                const copy = response.clone();
                caches.open(CACHE).then(function (cache) {
                    cache.put('./index.html', copy);
                }).catch(function () { /* квота */ });
                return response;
            }).catch(function () {
                return caches.match('./index.html').then(function (hit) {
                    return hit || caches.match('./');
                });
            })
        );
        return;
    }

    /* Остальные файлы: кэш, с фоновым обновлением */
    event.respondWith(
        caches.match(request).then(function (hit) {
            if (hit) {
                fetch(request).then(function (response) {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then(function (cache) {
                            cache.put(request, copy);
                        }).catch(function () { /* квота */ });
                    }
                }).catch(function () { /* офлайн — остаёмся на кэше */ });
                return hit;
            }
            return fetch(request).then(function (response) {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(function (cache) {
                        cache.put(request, copy);
                    }).catch(function () { /* квота */ });
                }
                return response;
            });
        })
    );
});
