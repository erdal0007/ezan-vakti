const CACHE = "ezan-vakti-v9";
const CORE = ["./", "./index.html", "./ezan.mp3", "./turku.mp3", "./manifest.json", "./hilal-192.png", "./hilal-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ses dosyaları: range (parça) isteklerini önbellekten 206 yanıtıyla karşıla
async function handleAudio(req) {
  const cache = await caches.open(CACHE);
  let res = await cache.match(req.url, {ignoreSearch: true});
  if (!res) {
    try {
      res = await fetch(req.url);
      if (res.ok) cache.put(req.url, res.clone());
    } catch (err) {
      return new Response("", {status: 404});
    }
  }
  const range = req.headers.get("range");
  if (range && res.ok) {
    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = 0, end = size - 1;
    if (m && m[1] !== "") {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
    } else if (m && m[2] !== "") {
      start = Math.max(0, size - Number(m[2])); // son N bayt (bytes=-N)
    }
    if (start >= size || start > end) {
      return new Response("", {status: 416, headers: {"Content-Range": `bytes */${size}`}});
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes"
      }
    });
  }
  return res;
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return; // yalnızca GET önbelleğe alınabilir
  const url = new URL(e.request.url);
  if (url.pathname.endsWith(".mp3")) {
    if (url.origin === location.origin) e.respondWith(handleAudio(e.request));
    return; // Kur'an CDN sesleri: tarayıcı doğal akışla çalar
  }
  // Kur'an metni: önce ağ, çevrimdışıysa önbellekten (okunan sureler kaydedilir)
  if (url.hostname === "api.alquran.cloud") {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { // hata yanıtları (429/500) çevrimdışı kopyayı ezmesin
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => new Response("", {status: 200})))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, {ignoreSearch: true}).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

// Vakit bildirimine dokununca uygulamayı öne getir / aç
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow ? self.clients.openWindow("./index.html") : undefined;
    })
  );
});
