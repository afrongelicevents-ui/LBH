/*
 * LBH field service worker — lets field staff reopen their job pages with
 * no signal. Only field pages and the app's own static files are cached;
 * everything else goes straight to the network. Saves made offline are
 * NOT handled here: the page keeps them on the phone (IndexedDB) and sends
 * them when the connection returns.
 */
const CACHE = "lbh-field-v1";
// English pages have no locale prefix (/field); others do (/sn/field).
const FIELD_PAGE = /^\/((en|sn|nd)\/)?field(\/|$)/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lbh-field-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear") {
    event.waitUntil(caches.delete(CACHE));
  } else if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(
          data.urls.slice(0, 200).map((u) => {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin) return null;
            if (!url.pathname.startsWith("/_next/static/") && !FIELD_PAGE.test(url.pathname)) return null;
            return fetch(url, { credentials: "same-origin" })
              .then((res) => (res.ok && !res.redirected ? cache.put(url, res) : null))
              .catch(() => null);
          })
        )
      )
    );
  }
});

function isRsc(request) {
  return request.headers.get("RSC") === "1" || new URL(request.url).searchParams.has("_rsc");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Site images: network first (so new photos show), cache as offline fallback.
  if (url.pathname.startsWith("/images/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error()))
    );
    return;
  }

  // App code/styles: content-hashed file names, safe to serve from cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (!FIELD_PAGE.test(url.pathname)) return;

  // In-app navigation data: network only. When it fails, Next.js falls back
  // to a full page load, which is answered from the cache below.
  if (isRsc(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(url.pathname).then(
            (hit) =>
              hit ||
              new Response(
                '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
                  '<body style="font-family:sans-serif;padding:24px;color:#163A2B"><h1>No signal</h1>' +
                  "<p>This page has not been opened on this phone before, so it is not available offline.</p>" +
                  "<p>Photos, videos and notes you already saved are kept on this phone and upload automatically when the signal returns.</p>" +
                  '<p><a href="/field">Back to my jobs</a></p></body>',
                { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
              )
          )
        )
    );
  }
});
