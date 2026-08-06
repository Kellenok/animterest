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
                    // Fetch from network (browser automatically follows 302 redirect)
                    const networkResponse = await fetch(event.request);
                    
                    // Only cache successful responses (not errors)
                    // networkResponse.ok is true for 200 OK (the final CloudFront response)
                    if (networkResponse && networkResponse.ok) {
                        // Store the final 200 OK response against the original HF url
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
