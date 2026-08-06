const CACHE_NAME = 'anima-hf-images-v1';

self.addEventListener('install', event => {
    // Activate worker immediately
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // Take control of all clients immediately
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only intercept HuggingFace image requests
    if (url.hostname === 'huggingface.co' && url.pathname.includes('/resolve/main/images/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse; // Instant load from Cache Storage
                }

                try {
                    // <img> tags make 'no-cors' requests by default, which return opaque responses (status 0, ok: false).
                    // We must force 'cors' mode so Hugging Face returns a 200 OK that we can cache.
                    const fetchOptions = {
                        mode: event.request.mode === 'no-cors' ? 'cors' : event.request.mode,
                        credentials: 'omit',
                        headers: event.request.headers
                    };
                    
                    const fetchRequest = new Request(event.request, fetchOptions);
                    const networkResponse = await fetch(fetchRequest);
                    
                    // Only cache successful responses (200 OK)
                    if (networkResponse && networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    
                    return networkResponse;
                } catch (error) {
                    console.warn('Service Worker fetch failed for:', event.request.url, error);
                    throw error;
                }
            })
        );
    }
});
