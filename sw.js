/* Hors ligne : l'appli est gardée sur le téléphone après la 1re ouverture.
   À chaque mise en ligne : augmenter VERSION (musculation-eleves-vN). */
const VERSION='musculation-eleves-v1.2';
// Toutes les applis partagent le même stockage (même adresse github.io) : on n'efface QUE les anciennes versions de CETTE appli.
const MES_CACHES=/^musculation-eleves-v\d+(?:\.\d+)?$/;
const sous3s=p=>{p.catch(()=>{});return Promise.race([p,new Promise((_,non)=>setTimeout(()=>non(new Error('réseau lent')),3000))])};
const FICHIERS=['./','index.html','app.js','muscu-donnees.js','aide.js','eps-aide.js','eps-maj.js','eps-rappel.js','eps-pouls.js','qrcode.js','jsqr.js','eps-code.js','eps-charte-v1.css',
  'img/avatars/stop.webp',
  ...['img/ateliers/curlb.jpg','img/ateliers/mollets.jpg','img/ateliers/montee.jpg','img/ateliers/crunch.jpg','img/ateliers/squat.jpg','img/ateliers/extri.jpg','img/ateliers/rowb.jpg','img/ateliers/tirage.jpg','img/ateliers/elev.jpg','img/ateliers/twist.jpg','img/ateliers/dc.jpg','img/ateliers/fentes.jpg','img/ateliers/rowh.jpg','img/ateliers/curlh.jpg','img/ateliers/gainage.jpg','img/ateliers/pompes.jpg','img/ateliers/gainlat.jpg','img/ateliers/dips.jpg','img/ateliers/dch.jpg','img/ateliers/ecarte.jpg','img/ateliers/dm.jpg'],'manifest.webmanifest','icon-32.png','icon-180.png','icon-192.png','icon-512.png',
  'polices/archivo.woff2','polices/atkinson-400.woff2','polices/atkinson-700.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FICHIERS.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>MES_CACHES.test(k)&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  const net=fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.status===200){const c=r.clone();caches.open(VERSION).then(x=>x.put(e.request,c))}return r});
  e.respondWith(sous3s(net).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(h=>h||net)));
});
