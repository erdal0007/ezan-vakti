const CACHE = "ezan-vakti-v4";
const CORE = ["./", "./index.html", "./ezan.mp3", "./manifest.json", "./hilal-192.png", "./hilal-512.png"];

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
  if (range) {
    const buf = await res.arrayBuffer();
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = (m && m[2]) ? Number(m[2]) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes"
      }
    });
  }
  return res;
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith(".mp3")) {
    if (url.origin === location.origin) e.respondWith(handleAudio(e.request));
    return; // Kur'an CDN sesleri: tarayıcı doğal akışla çalar
  }
  // Kur'an metni: önce ağ, çevrimdışıysa önbellekten (okunan sureler kaydedilir)
  if (url.hostname === "api.alquran.cloud") {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
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
