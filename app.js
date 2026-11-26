/* =====================================================================
   app.js — appli élève de musculation CA5 Terminale (Lycée G. Pompidou)
   Un carnet par binôme (ou trinôme), sur le téléphone d'un des élèves.
   Contenu (ateliers, mobiles, séances, calculs) : muscu-donnees.js, le même
   fichier que l'écran de cours cycle-musculation.
   Données : sur le téléphone seulement (localStorage). Envoi : fichier JSON
   (Nuage) en fin de séance ; QR « Mots et défi » sans aucun nom.
   ===================================================================== */
'use strict';
const CLE = 'mue-carnets', CLE_DERNIER = 'mue-dernier';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lire = (k, d) => {try{const v = localStorage.getItem(k);return v ? JSON.parse(v) : d}catch(e){return d}};
const ecrire = (k, v) => {try{localStorage.setItem(k, JSON.stringify(v));return true}catch(e){toast('Mémoire du téléphone pleine : envoie et supprime les anciens carnets.');return false}};
const jour = () => {const d = new Date();return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const num = v => {const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));return isFinite(n) ? n : null};
function toast(t){const d = document.createElement('div');d.textContent = t;d.style.cssText = 'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);background:#1c2128;color:#fff;padding:12px 18px;border-radius:14px;z-index:99;font-weight:700;max-width:90vw;text-align:center';document.body.appendChild(d);setTimeout(() => d.remove(), 2600)}

/* ---------- État ---------- */
let CARNETS = lire(CLE, {});
let CLASSES = lire('mue-classes', {});   // reçues par le QR de la classe : {classe:{l:[noms], u:lien Nuage}}
let SEL = {classe:'', noms:[]};          // choix en cours pour un nouveau binôme
let B = null;          // carnet ouvert
let P = 0;             // élève qui pratique (index dans B.e)
let ONGLET = 'seance';
let FICHES_LIBRES = false;   // v2.6 : onglet Fiches consultable depuis l'accueil, sans carnet
let SEANCE = 'S1';
let DEMO = false;
/* v4.0 : une phrase en tête de chaque onglet pour dire à quoi il sert */
const AIDE_ONGLET = {seance:"✏️ <b>On remplit ici pendant le cours</b> : échauffement, exercices, chrono, ressentis, coaching. Tout s'enregistre dans ton carnet.",
 charges:"⚖️ <b>Tes charges max</b> (une par atelier) et la calculette : la charge à mettre selon le %.",
 projet:"🎯 <b>À partir de la S7</b> : ton programme (mobile, exercices, séries, %). L'onglet Séance le suit ensuite.",
 carnet:"📒 <b>Lecture seule</b> : le résumé de tout ce que tu as saisi dans Séance, séance par séance. Rien à remplir ici.",
 fiches:"📖 <b>Pour consulter</b> : les 3 mobiles, les fiches des ateliers et l'échauffement.",
 envoyer:"📤 <b>En fin de séance</b> : envoie ton carnet au professeur (QR code ou fichier)."};
const ONGLETS = [['seance','🏋️','Séance'],['charges','⚖️','Charges max'],['projet','🎯','Projet'],['carnet','📒','Carnet'],['fiches','📖','Fiches'],['envoyer','📤','Au prof']];
const SEANCES_IDS = SEANCES.map(s => s.id);
/* v2.0 : S2-S3 tests, S4 tonification, S5 volume, S6 puissance et choix, S7 projet, S8-S9 évaluation */
const MOBILE_DU_JOUR = {S4:'tonif', S5:'volume', S6:'puiss'};
const SEANCE_PROJET = 7, SEANCE_MOBILE = [4, 6], SEANCE_EVAL = 9;
/* ateliers proposés pour un mobile : le menu (charges), et en Puissance seulement les 6 ateliers poussés vite */
const dispoPour = mob => ATELIERS.filter(a => a.plio ? mob === 'puiss' : a.menu && (mob !== 'puiss' || a.puissance));   // v2.5 : saut sur box, Puissance seulement
const DEF_PARAM = {tonif:{pct:50, series:3, reps:20}, volume:{pct:65, series:4, reps:12}, puiss:{pct:45, series:4, reps:5}};   // v4.1 : 1er couple (2e en Puissance)
const TEMPS = {tonif:'30 à 45 s', volume:'40 à 60 s', puiss:'15 s'};
const FORME = [[1,'😫','Très fatigué'],[2,'😕','Fatigué'],[3,'😐','Normal'],[4,'🙂','En forme'],[5,'😀','Très en forme']];

const nouvelEleve = nom => ({nom, situe:null, rm:{}, tests:{}, seances:{}, niv:{}, choix:null, echelle:{}, projet:null, afl:{rep:'', role:''}, ajust:[]});
const EL = () => B.e[P];
const autre = () => B.e.length > 1 ? B.e[(P + 1) % B.e.length] : null;
function sea(e, S){e.seances[S] = e.seances[S] || {};return e.seances[S]}
function sauver(){if(!B || DEMO)return;B.maj = Date.now();CARNETS[B.id] = B;ecrire(CLE, CARNETS)}
const initiales = nom => String(nom).split(/\s+/).filter(Boolean).map(m => m[0].toUpperCase()).join('');
const prenom = nom => String(nom).split(/\s+/)[0];

/* ---------- Code secret du binôme (empreinte, jamais le code en clair) ---------- */
async function empreinte(id, code){
  try{const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mue|' + id + '|' + code));return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('')}
  catch(e){let h = 0;for(const c of 'mue|' + id + '|' + code)h = (h * 31 + c.charCodeAt(0)) | 0;return 'x' + h}
}

/* ================== Rendu général ================== */
/* v6.0 : après une action, l'élément touché reste au même endroit de l'écran (plus de saut en haut de page) */
let ANCRE = null;
function selAncre(el){if(el.id)return '#' + CSS.escape(el.id);
  const a = [...el.attributes].filter(x => x.name.startsWith('data-')).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
  return a ? el.tagName.toLowerCase() + a : null}
function rendre(){
  const y = window.scrollY, main = $('main');let anc = null;
  try{if(ANCRE && main.contains(ANCRE)){const sel = selAncre(ANCRE);if(sel)anc = {sel, top:ANCRE.getBoundingClientRect().top}}}catch(e){}
  ANCRE = null;
  if(!B){$('nav').hidden = true;$('btMob').hidden = true;$('sous').textContent = 'Lycée Georges Pompidou · CA5 Terminale';$('main').innerHTML = FICHES_LIBRES ? `<button type="button" class="bt" data-act="fichesRetour" style="margin:4px 0 10px">← Retour</button>` + vueFiches() : accueil();return}
  $('sous').textContent = (B.classe ? B.classe + ' · ' : '') + B.e.map(x => prenom(x.nom)).join(' & ');
  $('nav').hidden = false;$('btMob').hidden = false;
  $('nav').innerHTML = ONGLETS.map(([k, i, t]) => `<button type="button" data-onglet="${k}" class="${k === ONGLET ? 'ici' : ''}"><i>${i}</i>${t}</button>`).join('');
  const qui = `<div class="qui"><span>Qui pratique ?</span>${B.e.map((x, i) => `<button type="button" data-qui="${i}" class="${i === P ? 'ici' : ''}">${esc(prenom(x.nom))}</button>`).join('')}</div>`;
  const demo = DEMO ? `<div class="demo-bandeau"><span>👀 <b>Mode démo</b> : rien n'est enregistré.</span><button type="button" class="bt mini" data-act="quitterDemo">Quitter</button></div>` : '';
  const corps = {seance:vueSeance, charges:vueCharges, projet:vueProjet, carnet:vueCarnet, fiches:vueFiches, envoyer:vueEnvoyer}[ONGLET]();
  main.style.minHeight = main.offsetHeight + 'px';
  main.innerHTML = demo + `<p class="onglet-aide">${AIDE_ONGLET[ONGLET] || ''}</p>` + (ONGLET === 'envoyer' || ONGLET === 'fiches' ? '' : qui) + corps;
  const bs = $('btnSeance');if(bs)EPSSeances.bouton(bs, {cle:'musculation-eleves:seance', rang:SEANCES_IDS.indexOf(SEANCE), total:SEANCES_IDS.length, texte:SEANCE + ' <span aria-hidden="true">▾</span>'});
  window.scrollTo(0, y);
  if(anc){try{const n = main.querySelector(anc.sel);if(n){const d = n.getBoundingClientRect().top - anc.top;if(Math.abs(d) > 1)window.scrollBy(0, d)}}catch(e){}}
  main.style.minHeight = '';
}

/* ================== Accueil ================== */
function accueil(){
  const l = Object.values(CARNETS).sort((a, b) => (b.maj || 0) - (a.maj || 0));
  return `<h2>Mon carnet de musculation</h2>
  ${l.length ? `<section class="carte"><h3>Carnets sur ce téléphone</h3>${l.map(c => `<button type="button" class="bt pleine" style="margin:6px 0;justify-content:flex-start" data-carnet="${c.id}">🔒 ${esc(c.e.map(x => x.nom).join(' & '))}${c.classe ? ` <span class="muted small">· ${esc(c.classe)}</span>` : ''}</button>`).join('')}</section>` : ''}
  <section class="carte"><h3>📖 Fiches d'exercice</h3><p class="small muted">Les fiches des ateliers et le répertoire de l'échauffement, en libre consultation.</p><button type="button" class="bt pleine" data-act="fichesLibres">Voir les fiches</button></section>
  <section class="carte"><h3>📷 QR de la classe</h3><p class="small muted">Scanne le QR affiché par le professeur : il donne la liste de la classe${Object.keys(CLASSES).length ? ' (classe' + (Object.keys(CLASSES).length > 1 ? 's' : '') + ' reçue' + (Object.keys(CLASSES).length > 1 ? 's' : '') + ' : ' + esc(Object.keys(CLASSES).join(', ')) + ')' : ''} et ouvre la séance du jour.</p><button type="button" class="bt act" data-act="scanClasse">📷 Scanner le QR de la classe</button></section>
  <section class="carte act"><h3>＋ Nouveau binôme</h3>${blocNouveau()}</section>
  <section class="carte"><h3>📥 Récupérer un carnet</h3><p class="small muted">Changement de téléphone : choisis le fichier .json téléchargé depuis l'onglet « Au prof ». Rien n'est écrasé sans ton accord.</p><button type="button" class="bt" data-act="importer">📥 Choisir le fichier du carnet</button></section>
  <section class="carte"><h3>👀 Découvrir l'appli</h3><p class="small muted">Un binôme fictif déjà rempli, pour voir tous les écrans. Rien n'est enregistré.</p><button type="button" class="bt" data-act="demo">Essayer l'appli (démo)</button></section>
  <section class="carte info"><h3>Sans carnet</h3><div class="rangee"><button type="button" class="bt mini" data-act="mobiles">📋 Les 3 mobiles</button><button type="button" class="bt mini" data-act="calcLibre">🧮 Calculette</button></div></section>`;
}
function blocNouveau(){
  const cl = Object.keys(CLASSES).sort();
  if(cl.length && !CLASSES[SEL.classe])SEL.classe = cl.length === 1 ? cl[0] : '';
  const pris = new Set(Object.values(CARNETS).filter(c => c.classe === SEL.classe).flatMap(c => c.e.map(x => x.nom)));
  const choix = cl.length ? `<p class="small">1. Ta classe :</p><div class="chips">${cl.map(c => `<button type="button" class="${c === SEL.classe ? 'ici' : ''}" data-selclasse="${esc(c)}">${esc(c)}</button>`).join('')}</div>
   ${SEL.classe ? `<p class="small">2. Touchez vos noms (2, ou 3 pour un trinôme) :</p><div class="chips">${CLASSES[SEL.classe].l.map(n => `<button type="button" class="${SEL.noms.includes(n) ? 'ici' : ''}" data-selnom="${esc(n)}"${pris.has(n) ? ' title="déjà dans un carnet sur ce téléphone"' : ''}>${pris.has(n) ? '✓ ' : ''}${esc(n)}</button>`).join('')}</div>
   ${SEL.noms.length ? `<p><b>${esc(SEL.noms.join(' & '))}</b></p>` : ''}` : ''}` : `<p class="retour non">Scannez d'abord le <b>QR de la classe</b> (ci-dessous) : la liste des élèves s'affichera ici.</p>`;
  return `${choix}<details${cl.length ? '' : ' open'}><summary>${cl.length ? 'Un nom manque dans la liste ?' : 'Pas de QR ? Écrire les noms'}</summary><p class="small muted">Prénom ET nom, comme sur Pronote.</p>
   ${cl.length ? '' : `<label class="ch" for="nClasse">Classe</label><input type="text" id="nClasse" placeholder="ex. TG3" maxlength="20" autocomplete="off">`}
   <label class="ch" for="nE1">Élève (prénom et nom)</label><input type="text" id="nE1" autocomplete="off" maxlength="60"><label class="ch" for="nE2">Élève (prénom et nom)</label><input type="text" id="nE2" autocomplete="off" maxlength="60"></details>
   <p class="small">${cl.length ? '3' : '2'}. Code secret du binôme (4 chiffres) :</p><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="nCode" class="code" autocomplete="off">
   <p class="small muted">Il protège votre carnet si le téléphone est prêté. En cas d'oubli : « Code oublié ? », puis montrez le QR au professeur.</p>
   <button type="button" class="bt act pleine" data-act="creer">Créer le carnet</button>`;
}
async function creer(){
  const classe = SEL.classe || ($('nClasse') ? $('nClasse').value.trim() : ''), code = $('nCode').value.trim();
  const noms = SEL.noms.concat(['nE1', 'nE2'].map(i => $(i) ? $(i).value.trim().replace(/\s+/g, ' ') : '').filter(Boolean));
  if(noms.length < 2)return toast('Choisissez les deux élèves du binôme.');
  if(noms.length > 3)return toast('3 élèves au maximum.');
  if(noms.some(n => n.split(' ').length < 2))return toast('Prénom ET nom pour chaque élève, ex. Léa MARTIN.');
  if(!/^\d{4}$/.test(code))return toast('Le code secret : 4 chiffres.');
  const id = uid();
  B = {id, v:1, app:'musculation-eleves', classe, cree:jour(), maj:Date.now(), equipe:'', listes:{}, motsClasse:[], envois:[], e:noms.map(nouvelEleve), code:await empreinte(id, code)};SEL = {classe:'', noms:[]};
  P = 0;ONGLET = 'seance';SEANCE = 'S1';sauver();ecrire(CLE_DERNIER, id);rendre();window.scrollTo(0, 0);
}
function ouvrir(id){
  const c = CARNETS[id];if(!c)return;
  fenetre(`<h3>🔒 ${esc(c.e.map(x => prenom(x.nom)).join(' & '))}</h3><p>Code secret du binôme :</p><input type="password" inputmode="numeric" maxlength="4" id="oCode" class="code" autocomplete="off"><p class="small" id="oErr" style="color:var(--alerte);font-weight:700;min-height:1.4em"></p><div class="rangee"><button type="button" class="bt act" data-act="valCode" data-id="${id}">Ouvrir</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div><p class="center" style="margin-top:10px"><button type="button" class="bt" data-act="codeOubli" data-id="${id}">🔑 Code oublié ?</button></p>`);
  setTimeout(() => {const i = $('oCode');if(i)i.focus()}, 50);
}
/* Code oublié (même principe que l'appli gym) : un QR à montrer au professeur, qui le scanne et lit le code.
   Le QR porte l'empreinte du code (jamais le code) : l'outil prof retrouve le code à partir de l'empreinte. */
async function codeOubli(id){
  const c = CARNETS[id];if(!c)return;
  let svg;try{svg = svgQR(await chaineQR({a:'MUS', v:1, t:'O', c:c.classe || '', n:c.e.map(x => x.nom), i:id, h:c.code}))}catch(e){return toast('QR impossible : ' + e.message)}
  fenetre(`<h3>🔑 Code oublié</h3><p><b>Montrez ce QR au professeur</b> : il le scanne et vous dit votre code.</p><div class="qr" style="max-width:300px;margin:10px auto">${svg}</div><p class="small muted">Rien à rescanner ensuite : tapez simplement le code donné par le professeur.</p><div class="rangee"><button type="button" class="bt act" data-act="carnetCode" data-id="${id}">J'ai mon code</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
async function validerCode(id){
  const c = CARNETS[id];if(!c)return;
  if(await empreinte(id, $('oCode').value.trim()) !== c.code){$('oErr').textContent = 'Code faux.';return}
  B = c;P = 0;ONGLET = 'seance';SEANCE = seanceEnCours();ecrire(CLE_DERNIER, id);fermerFen();rendre();window.scrollTo(0, 0);
}
function seanceEnCours(){ // première séance sans saisie, sinon la dernière
  for(const S of SEANCES_IDS)if(!B.e.some(e => (e.seances[S] && Object.keys(e.seances[S]).length) || (S === 'S2' && Object.keys(e.tests).length)))return S;
  return 'S9';
}

/* ================== QR de la classe ================== */
function b64urlToBytes(t){t = t.replace(/-/g, '+').replace(/_/g, '/');while(t.length % 4)t += '=';const b = atob(t), u = new Uint8Array(b.length);for(let i = 0;i < b.length;i++)u[i] = b.charCodeAt(i);return u}
async function decoderQR(txt){
  const m = /^MUS([01]):([A-Za-z0-9_-]+)$/.exec(String(txt || '').trim());if(!m)throw new Error('Ce QR ne vient pas des applis de musculation.');
  let bytes = b64urlToBytes(m[2]);
  if(m[1] === '1'){if(typeof DecompressionStream !== 'function')throw new Error('Téléphone trop ancien pour lire ce QR : mets-le à jour.');bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
  const o = JSON.parse(new TextDecoder().decode(bytes));if(!o || o.a !== 'MUS')throw new Error('QR non reconnu.');return o;
}
async function recevoirClasse(o){
  if(o.t === 'T'){   // v5.0 : QR du tirage au sort (outil prof)
    if(!B)throw new Error('Ouvre d\'abord ton carnet, puis scanne le QR du tirage.');
    const n = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');let k = 0;
    B.e.forEach(e => {const x = Object.entries(o.r || {}).find(([nom]) => n(nom) === n(e.nom));if(x){e.tirage = {l:x[1], src:'qr', date:jour()};k++}});
    if(!k)throw new Error('Ce QR ne contient pas vos noms (classe ' + (o.c || '?') + ').');
    sauver();return 'Tirage reçu pour ' + k + ' élève' + (k > 1 ? 's' : '');
  }
  if(o.t !== 'C')throw new Error('Ce n\'est pas le QR de la classe.');
  CLASSES[o.c] = {l:o.l || [], u:o.u || '', ts:o.ts || 0};ecrire('mue-classes', CLASSES);
  if(window.EPSCode){EPSCode.memoriserCle(o.c, o.cc);if(o.cj)await EPSCode.appliquerJour(o.c, o.cj)}
  if(!B)SEL.classe = o.c;
  return 'Classe ' + o.c + ' : ' + (o.l || []).length + ' élèves' + (o.cj && o.cj.d === jour() ? ' · séance ' + o.cj.s + ' ouverte' : '');
}
let FLUX = null;
function scanner(traiter, titre){   // traiter(texte) → message ; par défaut : QR de la classe
  traiter = traiter || (t => decoderQR(t).then(recevoirClasse));
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)return toast('Caméra indisponible sur ce téléphone.');
  fenetre(`<h3>${titre || '📷 QR de la classe'}</h3><video playsinline muted style="width:100%;border-radius:12px;background:#000"></video><p class="small" id="scMsg">Vise le QR affiché par le professeur.</p><button type="button" class="bt pleine" data-act="fermerScan">Fermer</button>`);
  const v = document.querySelector('.fen video'), c = document.createElement('canvas'), x = c.getContext('2d', {willReadFrequently:true});let fini = false;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(st => {FLUX = st;v.srcObject = st;v.play();boucle()}).catch(() => {$('scMsg').textContent = 'Autorise la caméra pour cette page, puis réessaie.'});
  function boucle(){
    if(!FLUX || !document.querySelector('.fen video'))return;
    if(v.readyState >= 2){c.width = v.videoWidth;c.height = v.videoHeight;x.drawImage(v, 0, 0);const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if(r && r.data && !fini){fini = true;Promise.resolve().then(() => traiter(r.data)).then(t => {arreterScan();fermerFen();toast('✓ ' + t);rendre()}).catch(e => {$('scMsg').textContent = e.message;setTimeout(() => fini = false, 1500)})}}
    requestAnimationFrame(boucle);
  }
}
function arreterScan(){if(FLUX)FLUX.getTracks().forEach(t => t.stop());FLUX = null}

/* ================== Fenêtres ================== */
function fenetre(html){$('couche').innerHTML = `<div class="fen" data-fond><div role="dialog" aria-modal="true">${html}</div></div>`}
/* v6.9 : liste des séances : grande piste (repères cliquables) + boutons, pour l'élève qui pratique */
function ouvrirSeances(){
  const e = EL(), L = SEANCES_IDS.map(S => ({id:S, n:S, etat:e.seances[S] && Object.keys(e.seances[S]).length ? 'fait' : '', abs:absent(e, S)}));
  fenetre(`<h3>Changer de séance</h3><p class="small">Touche une séance sur la piste ou dans la liste · ✓ = remplie</p>
    ${EPSSeances.piste({rang:SEANCES_IDS.indexOf(SEANCE), seances:L, centre:SEANCE + ' / ' + L.length, attr:x => `data-seance="${x.id}"`})}
    <div class="se-grille">${L.map(x => `<button type="button" data-seance="${x.id}" class="${x.id === SEANCE ? 'ici' : ''} ${x.etat}${x.abs ? ' abs' : ''}"${x.abs ? ' title="absent(e)"' : ''}>${x.id}${x.etat ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="rangee"><button type="button" class="bt" data-act="fermerFen">Fermer</button></div>`);
}
/* les repères de la piste sont dans un dessin (pas des boutons) : leur toucher est traité ici */
document.addEventListener('click', ev => {const g = ev.target.closest && ev.target.closest('.eps-se-rep[data-seance]');if(!g)return;
  fermerFen();SEANCE = g.dataset.seance;rendre();window.scrollTo(0, 0)});
function fermerFen(){arreterScan();$('couche').innerHTML = ''}
function panneauMobiles(){
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>Les 3 mobiles</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>${MOBILES_ORDRE.map(mobileHTML).join('')}
   <h4>Échelle de ressentis</h4>${echelleHTML()}<h4>Sécurité</h4><ul class="ats small">${SECU.regles.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="small"><b>Respiration.</b> ${esc(SECU.respiration)}</p>`);
}

/* ================== Charges : calculs ================== */
function cmDe(e, at){const r = e.rm[at];return r && r.cm ? r.cm : null}
/* v2.2 : charge max avec historique (rien n'est perdu), mise à jour bloquée pendant l'évaluation (S8-S9) */
function majRM(e, at, rec){const old = e.rm[at];rec.hist = ((old && old.hist) || []).concat(old ? [{cm:old.cm, date:old.date, mode:old.mode, S:old.S || ''}] : []);e.rm[at] = rec}   // v6.4 : la séance est gardée dans l'historique
const rmVerrou = e => !!(e.seances.S9 && Object.keys(e.seances.S9).length);   // v5.0 : évaluation en S9
const MODE_RM = {test:'test', direct:'saisie directe', seance:'mise à jour en séance'};
/* estimation d'après la série réalisée + les répétitions en réserve (Brzycki prolongé à 15 répétitions au total, prudent : borne basse de la réserve).
   Seulement en Volume : en Tonification (15-20 rép.) la formule ne vaut plus, en Puissance la réserve ne dit rien. */
function suggestionRM(e, at, ex, p){
  if(!ex.real || !p || p.mob !== 'volume' || rmVerrou(e) || ex.rmNon || ex.rmMaj)return null;
  const a = atelier(at), cm = cmDe(e, at), r = ex.real, plus = {12:1, 34:3, 5:5}[ex.rir];
  if(a.type !== 'charge' || !cm || !plus || !(r.charge > 0) || r.reps < p.reps)return null;
  const tot = r.reps + plus;if(tot > 15)return null;
  const est = Math.round(r.charge * 36 / (37 - tot) * 2) / 2;
  return est >= cm * 1.05 ? {cm, est, charge:r.charge, reps:r.reps} : null;
}
function prevuDe(e, S, at){
  const a = atelier(at);let mob, p;
  if(+S.slice(1) >= SEANCE_PROJET){const pr = e.projet;mob = pr && pr.mob;let x = pr && pr.exos.find(z => z.at === at);const sx = ((e.seances[S] || {}).exos || {})[at];if(x && sx && sx.next && sx.next.avant)x = sx.next.avant;   // v2.1 : le choix « prochaine fois » ne change pas la séance en cours
    p = x ? {pct:x.pct, series:x.series, reps:x.reps, niv:x.niv} : null}
  else{mob = MOBILE_DU_JOUR[S];p = Object.assign({}, DEF_PARAM[mob]);if(S === 'S6'){const c = MOBILES.puiss.couples[e.puissOk ? 1 : 0];p.pct = c[0];p.reps = c[1]}}
  if(!mob || !p)return null;
  if(a.type === 'variante' && p.niv == null)p.niv = e.niv[at] != null ? e.niv[at] : Math.min(1, (a.niveaux || []).length - 1);
  if(mob === 'puiss' && a.puissPct)p.pct = Math.min(a.puissPct[1], Math.max(a.puissPct[0], p.pct));   // v2.0 : fourchette propre à l'atelier
  const s = sea(e, S);if(s.forme && s.forme <= 2 && +S.slice(1) >= 4)p.series = Math.max(2, p.series - 1);
  let charge = null;
  if(a.type === 'charge'){const cm = cmDe(e, at);if(cm)charge = chargeReelle(a.support, cm * p.pct / 100)}
  return Object.assign(p, {mob, charge});
}
function prevuTexte(a, p){
  if(!p)return '';
  const m = MOBILES[p.mob];
  const parts = [`<span><b>${p.series}</b> séries</span>`];
  if(a.temps)parts.push(`<span><b>${TEMPS[p.mob]}</b></span>`);else parts.push(`<span><b>${p.reps}</b> rép.</span>`);
  parts.push(`<span>récup <b>${m.recup}</b></span>`);
  if(a.type === 'charge')parts.push(p.charge ? `<span><b>${fmtKg(p.charge.charge)}</b> ${esc(p.charge.unite)} · ${p.pct} %</span>` : `<span>⚠️ pas de charge max</span>`);
  else if(a.niveaux)parts.push(`<span>niveau <b>${p.niv + 1}</b> : ${esc(a.niveaux[p.niv])}</span>`);
  const ap = approche(a, p);
  return `<div class="prevu">${parts.join('')}</div>${p.charge ? `<p class="compo">${esc(p.charge.compo)}</p>` : ''}${ap ? `<p class="approche">🔸 Série d'approche : <b>${ap.txt}</b> <span class="small muted">${esc(ap.compo)}</span></p>` : ''}`;
}
/* v5.1 : vocabulaire « niveau » pour les ateliers sans charge (saut sur box) */
function varianteTxt(at, t){return atelier(at).type === 'variante' ? String(t).replace(/Couple suivant \(\+ lourd\)/, 'Niveau suivant').replace(/Couple précédent \(\+ léger\)/, 'Niveau précédent').replace(/la charge/g, 'le niveau').replace(/de charge/g, 'de niveau').replace(/charge/g, 'niveau') : t}
/* v5.1 : série d'approche à environ 50 % de la charge de travail, 8 répétitions */
function approche(a, p){if(!p || a.type !== 'charge' || !p.charge)return null;const r = chargeReelle(a.support, p.charge.charge * 0.5);return r ? {txt:fmtKg(r.charge) + ' × 8', compo:r.compo} : null}

/* ================== Ressentis ================== */
function vocab(e){
  const perso = Object.values(e.echelle || {}).filter(Boolean);
  return [...new Set(perso.concat(B.motsClasse || [], MOTS_DEPART))].slice(0, 14);
}
const couleurNote = n => (ECHELLE.find(x => x[0] === n) || [])[3] || '#eee';
function ressentiHTML(cle, r, avecSens, ferme){
  r = r || {};
  const motChoisi = r.mot ? `<span class="chip-sel">· ${esc(r.mot)}</span>` : '';
  const sensChoisi = (avecSens && r.sens) ? `<span class="chip-sel">· ${esc(SENSATIONS.find(([k])=>k===r.sens)?.[1]||r.sens)}</span>` : '';
  const ouvert = !r.mot && !ferme; // ouvert par défaut si pas encore de mot (fermé sur la fiche d'analyse v2.1)
  const v = r.note || 0;
  return `<div class="rS ${v ? '' : 'vide'}"><div class="rS-bar"></div><input type="range" class="rSR" min="1" max="10" step="1" value="${v || 5}" data-cle="${cle}" aria-label="Note de ressenti de 1 à 10">
   <div class="rS-t">${ECHELLE.map(([n]) => `<span class="${n === v ? 'on' : ''}">${n}</span>`).join('')}</div>
   <div class="rS-l" style="${v ? `background:${couleurNote(v)}` : ''}">${v ? `<b>${v}</b><span>${esc(ECHELLE[v - 1][1])}<small>${esc(ECHELLE[v - 1][2])}</small></span>` : '<span>Fais glisser le rond sur ton ressenti</span>'}</div></div>
   <details class="volet-mots"${ouvert ? ' open' : ''}>
     <summary>Choisir un mot ${motChoisi}${sensChoisi}</summary>
     <div class="chips">${vocab(EL()).map(m => `<button type="button" class="${r.mot === m ? 'ici' : ''}" data-mot="${esc(m)}" data-cle="${cle}">${esc(m)}</button>`).join('')}<button type="button" data-autremot data-cle="${cle}">✏️ autre mot</button></div>
     ${avecSens ? `<div class="chips">${SENSATIONS.map(([k, t]) => `<button type="button" class="${r.sens === k ? 'ici' : ''}${k === 'douleur' ? ' stop' : ''}" data-sens="${k}" data-cle="${cle}">${esc(t)}</button>`).join('')}</div>` : ''}
   </details>`;
}
/* cle = "chemin" dans la séance de l'élève : ex. "ech.debut" ou "exos.rowh.ressenti" ou "test.dc.premiere" */
function objetCle(cle, creer){
  const e = EL(), parts = cle.split('.');
  let o = parts[0] === 'test' ? (e.tests[parts[1]] = e.tests[parts[1]] || {ressentis:{}}).ressentis : sea(e, SEANCE);
  const reste = parts[0] === 'test' ? parts.slice(2) : parts;
  for(let i = 0;i < reste.length;i++){const k = reste[i];if(!o[k]){if(!creer)return null;o[k] = {}}o = o[k]}
  return o;
}
function apresRessenti(cle){
  const p = cle.split('.');
  if(p[0] === 'exos'){const ex = sea(EL(), SEANCE).exos[p[1]], pr = prevuDe(EL(), SEANCE, p[1]);
    if(ex && ex.ressenti && ex.ressenti.note && pr){ex.coh = coherence(pr.mob, ex.ressenti.note, ex.ressenti.sens);majOk(p[1])}}
  sauver();
}

/* ================== Vue : séance ================== */
/* v6.0 : la séance est découpée en séquences repliables (modèle de l'appli demi-fond) :
   une seule ouverte à la fois, elle se replie quand l'élève la termine et la suivante s'ouvre.
   Chaque élève a sa propre progression (seances[S].seq). */
function vueSeance(){
  const s = seanceById(SEANCE), e = EL(), n = +SEANCE.slice(1);
  /* v6.9 : sélecteur de séance « piste » : séance en cours à gauche, bouton compact à droite (la liste s'ouvre au toucher) */
  const fS = e.seances[SEANCE] && Object.keys(e.seances[SEANCE]).length;
  const puces = `<div class="se-bandeau"><b class="se-num">Séance ${n}<small> / ${SEANCES_IDS.length}</small></b>${fS ? '<span class="se-fait">✓ faite</span>' : absent(e, SEANCE) ? '<span class="se-fait abs">absent(e)</span>' : ''}<button type="button" id="btnSeance" class="se-bt" data-act="seancesListe" aria-label="Séance ${n} sur ${SEANCES_IDS.length} : changer de séance"></button></div>`;
  let h = puces + `<div class="rangee" style="justify-content:flex-end"><button type="button" class="bt mini" data-act="scanClasse" data-libre>📷 QR de la classe</button></div><h2>${SEANCE} · ${esc(s.titre)}</h2><p class="muted small">${esc(s.obj)}</p>` + carteAbsence();
  const L = sequences(n), sq = etatSeq(e, SEANCE), ouv = seqOuverte(L, sq);
  const faitesN = L.filter(x => sq.fini[x.k]).length;
  h += `<div class="seq-prog" aria-label="progression"><span>Séquences terminées : ${faitesN} / ${L.length}</span><span class="seq-barre"><i style="width:${Math.round(faitesN / L.length * 100)}%"></i></span></div>`;
  L.forEach((x, i) => {
    const fini = !!sq.fini[x.k], ouvert = x.k === ouv, st = fini ? ['fini', '✓ Terminé'] : ouvert || (x.commence && x.commence()) ? ['cours', '◐ En cours'] : ['faire', '○ À réaliser'];
    h += `<section class="seq st-${st[0]}${ouvert ? ' ouv' : ''}" id="seq-${x.k}"><button type="button" class="seq-tete" data-seq="${x.k}" aria-expanded="${ouvert}"><span class="seq-n">${fini ? '✓' : i + 1}</span><span class="seq-t"><b>Séquence ${i + 1} · ${esc(x.t)}</b><small>${st[1]}</small></span><span class="seq-ch" aria-hidden="true">${ouvert ? '▴' : '▾'}</span></button>`;
    if(ouvert){
      const b = x.bouton ? x.bouton() : {txt:'Séquence terminée', ok:true};
      h += `<div class="seq-corps"><p class="seq-obj">🎯 <b>Objectif :</b> ${esc(x.obj)}</p><p class="seq-faire">👉 ${x.faire}</p>${x.corps()}
       <div class="seq-fin"><p class="small"><b>Pour valider :</b> ${esc(x.valid)}</p>${fini ? `<p class="retour ok">✓ Séquence terminée. Tu peux encore corriger ce qu'elle contient.</p>` : `<button type="button" class="bt ${b.ok ? 'ok' : ''} pleine seq-bt" data-seqfin="${x.k}"${b.bloque ? ' disabled' : ''}${b.conf ? ` data-conf="${esc(b.conf)}"` : ''}>${b.txt}</button>${b.aide ? `<p class="small muted">${b.aide}</p>` : ''}`}</div></div>`;
    }
    h += '</section>';
  });
  return h;
}
function etatSeq(e, S){const s = sea(e, S);s.seq = s.seq || {fini:{}};s.seq.fini = s.seq.fini || {};return s.seq}
function seqOuverte(L, sq){if(sq.ouv !== undefined && (sq.ouv === '' || L.some(x => x.k === sq.ouv)))return sq.ouv;const x = L.find(z => !sq.fini[z.k]);return x ? x.k : ''}
function exosFaits(ids){const ex = sea(EL(), SEANCE).exos || {};return ids.filter(at => ex[at] && ex[at].real).length}
function boutonEntrainement(ids){
  const f = exosFaits(ids), r = ids.length - f;
  return r <= 0 ? {txt:'✓ J\'ai fini mes exercices', ok:true} : {txt:`Terminer quand même (${r} exercice${r > 1 ? 's' : ''} non fait${r > 1 ? 's' : ''})`, conf:`${r} exercice(s) ne sont pas notés comme faits. Terminer quand même ?`, aide:'Coche « Fait comme prévu » ou lance le chrono sur chaque exercice.'};
}
function sequences(n){
  const e = EL(), S = SEANCE, L = [];
  /* Séquence 1 : échauffement (toutes les séances) */
  L.push({k:'ech', t:'Je prépare mon corps à l\'effort', obj:'Élever la température du corps, mobiliser les articulations et activer les muscles du jour pour travailler en sécurité.',
    faire:'Fais les 4 étapes dans l\'ordre et coche chacune quand elle est faite. Chacun coche sur son profil (« Qui pratique ? »).',
    valid:'les 4 étapes cochées, dont le gainage obligatoire. Le bouton s\'active alors.', commence:() => ((sea(e, S).ech || {}).wc || []).length > 0,
    corps:() => (n >= 4 ? carteForme() : '') + carteEchauffement(n === 1),
    bouton:() => {const P_ = partiesEch(n), wc = (sea(e, S).ech || {}).wc || [], has = k => wc.includes(k), f = P_.filter(x => x.ok(has)).length;
      return f === P_.length ? {txt:'✓ TERMINER L\'ÉCHAUFFEMENT', ok:true} : {txt:`TERMINER L'ÉCHAUFFEMENT (${f} / ${P_.length})`, bloque:true, aide:'Coche d\'abord les 4 étapes.'}}});
  if(n === 1){
    L.push({k:'circuit', t:'Je découvre les ateliers', obj:'Découvrir les 14 ateliers et leur placement, sans charge lourde.', faire:'Fais le circuit avec ton binôme : lis la fiche (image ou titre), fais l\'atelier, coche-le. Puis réponds à « Je me situe ».',
      valid:'le circuit et « Je me situe » remplis.', corps:() => carteCircuit() + carteSitue(), commence:() => Object.keys(sea(e, 'S1').circuit || {}).length > 0});
    L.push({k:'fin', t:'Je fais le point', obj:'Partager tes mots avec la classe.', faire:'Montre le QR de fin de séance au professeur.', valid:'QR montré au professeur.', corps:() => carteQRMots()});
  }
  if(n === 2 || n === 3){
    L.push({k:'test', t:'Je détermine mes charges de référence (10 RM)', obj:'Trouver, pour chaque atelier, la charge que tu soulèves 10 fois proprement : elle sert à calculer toutes tes charges ensuite.',
      faire:`Lis le mode d'emploi, puis fais 4 à 5 tests aujourd'hui${n === 3 ? ' : seuls les ateliers qu\'il te reste sont proposés' : ''}. Ton partenaire compte et juge.`,
      valid:'tes tests du jour enregistrés. Un test non fait reste « à rattraper » plus tard.', corps:() => carteTest(), commence:() => Object.values(e.rm).some(r => r.S === S),
      bouton:() => ({txt:'✓ J\'ai fini mes tests du jour', ok:true})});
    L.push({k:'fin', t:'Défi par équipes et mots de la séance', obj:'Additionner vos kilos pour votre équipe et partager vos mots.', faire:'Choisissez votre équipe, puis montrez le QR au professeur.', valid:'QR montré au professeur.', corps:() => carteDefi() + carteQRMots()});
  }
  if(n >= SEANCE_MOBILE[0] && n <= SEANCE_MOBILE[1]){
    const mob = MOBILE_DU_JOUR[S], ids = listeDe(S);
    L.push({k:'train', t:`Je m'entraîne · ${MOBILES[mob].nom}`, obj:`Découvrir le mobile ${MOBILES[mob].nom} (${MOBILES[mob].theme.toLowerCase()}) et ressentir ses effets.`,
      faire:'Vérifie tes charges, lance le chrono (binôme ou séries), puis note ton ressenti après chaque exercice. Ton partenaire coache.',
      valid:'chaque exercice noté comme fait, ressenti rempli.', commence:() => exosFaits(ids) > 0,
      corps:() => carteMobile(mob) + (n === 6 ? carteNiveauPuiss() : '') + carteReglesListe() + carteRattrapage(ids) + listeExos(LISTES_DEFAUT[S]),
      bouton:() => boutonEntrainement(ids)});
  }
  if(n === SEANCE_PROJET)L.push({k:'choix', t:'Je choisis mon mobile et je construis mon projet', obj:'Choisir un mobile en t\'appuyant sur tes ressentis des S4 à S6, et construire ton programme.',
    faire:'Compare les 3 mobiles, choisis le tien et explique pourquoi, puis construis ton projet (3 à 6 exercices) dans l\'onglet Projet.', valid:'mobile choisi et projet construit (3 exercices au moins).',
    corps:() => carteComparer() + (e.projet && e.projet.exos.length ? `<p class="retour ok">Projet construit : ${e.projet.exos.length} exercices. <button type="button" class="lien" data-onglet="projet">le voir</button></p>` : `<button type="button" class="bt act pleine" data-onglet="projet">🎯 Construire mon projet</button>`),
    commence:() => !!(e.choix && e.choix.mob), bouton:() => e.projet && e.projet.exos.length >= 3 ? {txt:'✓ Mon projet est prêt', ok:true} : {txt:'Construis d\'abord ton projet (3 exercices au moins)', bloque:true}});
  if(n >= SEANCE_PROJET && n < SEANCE_EVAL){
    const pr = e.projet, ids = pr && pr.exos.length ? jourDe(e, S) : [];
    L.push({k:'train', t:'Je m\'entraîne · mon projet', obj:'Réaliser ton programme et observer si tes sensations correspondent à ton mobile.', faire:'Choisis tes 3 exercices du jour, lance le chrono, note tes ressentis. Ton partenaire coache.',
      valid:'tes 3 exercices notés comme faits.', commence:() => exosFaits(ids) > 0,
      corps:() => !pr || !pr.exos.length ? `<section class="carte act"><h3>🎯 Construis d'abord ton projet</h3><p>3 à 6 exercices, haut et bas du corps.</p><button type="button" class="bt act" data-onglet="projet">Construire mon projet</button></section>`
        : carteMobile(pr.mob) + carteJour(e) + carteRattrapage(ids) + listeExos(ids, true),
      bouton:() => ids.length ? boutonEntrainement(ids) : {txt:'Construis d\'abord ton projet', bloque:true}});
  }
  if(n === SEANCE_EVAL){
    const pr = e.projet, t = tirageDe(e);
    L.push({k:'train', t:'Je réalise mon évaluation', obj:'Réaliser les 3 exercices tirés au sort avec les paramètres de ton projet.', faire:'Scanne le QR du tirage, puis réalise et note chaque exercice.', valid:'les 3 exercices tirés notés comme faits.',
      commence:() => t.length > 0, corps:() => pr ? carteMobile(pr.mob) + carteTirage(e) + (t.length ? listeExos(t, true) : '') : `<p class="retour non">Pas de projet dans ce carnet.</p>`,
      bouton:() => t.length ? boutonEntrainement(t) : {txt:'Scanne d\'abord le tirage', bloque:true}});
  }
  if(n >= SEANCE_MOBILE[0]){
    L.push({k:'bilan', t:'Je fais mon bilan', obj:'Observer, analyser et réguler : savoir quoi changer la prochaine fois.',
      faire:'Réponds en touchant les choix (30 secondes). C\'est ton bilan à toi, même en binôme.', valid:'les questions OBSERVER, ANALYSER et RÉGULER remplies.',
      commence:() => !!sea(e, S).bilan,
      corps:() => carteBilan() + (n >= SEANCE_PROJET && n < SEANCE_EVAL && sea(e, S).ajust && Object.keys(sea(e, S).ajust).length ? carteAjustements() : '') + (n >= SEANCE_PROJET ? carteAnalyse() : '') + (n === SEANCE_MOBILE[1] ? carteEchelle() : '') + (n >= 4 && n <= 8 ? carteAfl() : ''),
      bouton:() => bilanComplet(e, S) ? {txt:'✓ Valider mon bilan', ok:true} : {txt:'Valider mon bilan', bloque:true, aide:'Réponds d\'abord à chaque question.'}});
  }
  return L;
}
/* ---------- v6.0 : bilan individuel (dès la S4) ---------- */
const BILAN = [
 ['OBSERVER', 'obj', 'Mon objectif de séance est-il atteint ?', [['oui','Oui'],['partiel','En partie'],['non','Non']]],
 ['OBSERVER', 'cons', 'Ai-je respecté les consignes de mon mobile (répétitions, rythme, récupération) ?', [['oui','Oui'],['partiel','En partie'],['non','Non']]],
 ['ANALYSER', 'vecu', 'Mon effort était…', [['facile','Trop facile'],['adapte','Adapté'],['dur','Difficile'],['trop','Trop difficile']]],
 ['RÉGULER', 'reg', 'La prochaine fois, je…', [['garder','Garde tout pareil'],['plus','Augmente un peu'],['moins','Diminue'],['tech','Travaille d\'abord la technique']]],
 ['RÉGULER', 'sur', '… sur quoi ?', [['charge','La charge'],['reps','Les répétitions'],['series','Les séries'],['recup','La récupération']]],
 ['COACHING', 'role', 'Mon rôle pour mon partenaire aujourd\'hui', [['pareur','Pareur'],['obs','Observateur'],['coach','Coach']]]];
const bilanLib = (k, v) => {const q = BILAN.find(x => x[1] === k);return q ? ((q[3].find(c => c[0] === v) || [])[1] || '') : ''};
const bilanQs = (e, b) => BILAN.filter(q => (q[1] !== 'sur' || ['plus', 'moins'].includes(b.reg)) && (q[1] !== 'role' || B.e.length > 1));
function bilanComplet(e, S){const b = (e.seances[S] || {}).bilan;return !!b && bilanQs(e, b).every(q => b[q[1]])}
function carteBilan(){
  const e = EL(), s = sea(e, SEANCE), b = s.bilan || {}, so = seanceById(SEANCE);
  let blocPrec = '', h = '';
  bilanQs(e, b).forEach(([bloc, k, q, ch]) => {
    if(bloc !== blocPrec){h += `<p class="bil-bloc">${bloc}</p>`;blocPrec = bloc}
    h += `<p class="bti">${esc(q)}</p><div class="seg${ch.length === 3 ? ' trois' : ''}">${ch.map(([v, t]) => `<button type="button" class="${b[k] === v ? 'ici' : ''}" data-bil="${k}" data-v="${v}" aria-pressed="${b[k] === v}">${esc(t)}</button>`).join('')}</div>`;
  });
  const inco = b.vecu === 'facile' && b.reg === 'moins' ? 'Trop facile, et tu diminues ? Vérifie ton choix.' : b.vecu === 'trop' && b.reg === 'plus' ? 'Trop difficile, et tu augmentes ? Pense d\'abord à la sécurité.' : '';
  return `<section class="carte bilan"><h3>📝 Mon bilan · ${esc(prenom(e.nom))}</h3><p class="small muted">Objectif de la séance : ${esc(so.obj)}</p>${h}
   ${inco ? `<p class="retour non">⚠️ ${esc(inco)}</p>` : ''}
   <label class="ch" for="bilR">Ce que j'ai réussi (facultatif)</label><input type="text" id="bilR" data-biltxt="reussi" maxlength="90" value="${esc(b.reussi || '')}" placeholder="ex. dos droit sur toutes les séries">
   <label class="ch" for="bilA">À améliorer la prochaine fois (facultatif)</label><input type="text" id="bilA" data-biltxt="ameliorer" maxlength="90" value="${esc(b.ameliorer || '')}" placeholder="ex. respecter la récupération">
   ${bilanComplet(e, SEANCE) ? '<p class="retour ok">✓ Bilan complet.</p>' : ''}</section>`;
}
function carteForme(){
  const s = sea(EL(), SEANCE), n = +SEANCE.slice(1);
  return `<section class="carte"><h3>Mon état de forme aujourd'hui</h3><div class="chips">${FORME.map(([v, i, t]) => `<button type="button" class="${s.forme === v ? 'ici' : ''}" data-forme="${v}">${i} ${t}</button>`).join('')}</div>
   ${s.forme && s.forme <= 2 ? `<p class="retour non">Séance allégée aujourd'hui : une série de moins sur chaque exercice${n >= SEANCE_PROJET ? ' (ton projet ne change pas)' : ''}.</p>` : ''}</section>`;
}
function carteEchauffement(s1){   // v3.0 : échauffement guidé en 5 parties, cases à cocher, photos repliées (modèle de l'appli athlétisme)
  const S = SEANCE, n = +S.slice(1), s = sea(EL(), S), ech = s.ech || {}, wc = ech.wc || [], has = k => wc.includes(k);
  const P = partiesEch(n), faites = P.filter(x => x.ok(has)).length;
  const carte = (id, etoile) => {const it = ECH_ITEM[id];if(!it)return '';
    return `<button type="button" class="wcard${has(id) ? ' on' : ''}" data-wc="${id}"><img src="${imgEchauf(id)}" alt="" loading="lazy"><b>${etoile ? '★ ' : ''}${esc(it[1])}</b><span>${esc(it[2])}</span></button>`};
  const parts = P.map(x => {const ok = x.ok(has);
    return `<div class="wpart${ok ? ' on' : ''}"><button type="button" class="wpart-bt" data-wc="${x.k}" aria-pressed="${has(x.k)}"><span class="wpart-c">${ok ? '✓' : ''}</span><span><b>${esc(x.t)}</b><br><span class="small">${esc(x.r)}</span></span></button>
     <button type="button" class="wpart-min" data-wtim="${x.min * 60}" aria-label="Minuteur ${x.min} min">⏱ ${x.min}′</button>
     <details class="wdet"${OUV_ECH.has(x.k) ? ' open' : ''} data-wdet="${x.k}"><summary>Voir le détail${x.compte ? ' · ' + x.compte(has) : ''}</summary>${x.intro ? `<p class="small muted">${esc(x.intro)}</p>` : ''}<div class="wgrid">${x.l.map(id => typeof id === 'string' ? carte(id, (x.star || []).includes(id)) : id.html).join('')}</div></details></div>`}).join('');
  const aut = autre(), renf = renfEch();
  return `<section class="carte"><h3>🔥 Mon échauffement · ${esc(prenom(EL().nom))} · ${faites}/${P.length}</h3>
   <p class="small muted">Environ 15 min. Touche une étape quand elle est faite, ou coche les exercices dans « Voir le détail ». Les coches sont à toi : ton partenaire coche sur son profil${aut ? `, ou touche « Copier pour ${esc(prenom(aut.nom))} » s'il a fait la même chose` : ''}.</p>
   <div class="wtimer" id="wtimer"${WT ? '' : ' hidden'}><span id="wtt">0:00</span><button type="button" class="bt mini" data-wta="stop">Arrêter</button></div>
   ${parts}
   ${aut && wc.length ? `<button type="button" class="bt mini" data-act="copierEch">📋 Copier mes coches pour ${esc(prenom(aut.nom))}</button>` : ''}
   <details class="wdet renf"${OUV_ECH.has('renf') ? ' open' : ''} data-wdet="renf"><summary>💪 Exercices au poids du corps (facultatifs)</summary><p class="small muted">Pompes, gainage, abdominaux : en complément, si tu as le temps. Ils ne comptent pas dans les 4 étapes.</p><div class="wgrid">${renf.map(id => carte(id)).join('')}</div></details>
   <div class="rangee" style="margin-top:8px"><button type="button" class="bt mini" data-act="pouls">❤️ Prendre mon pouls</button>${ech.pouls ? `<b>${ech.pouls} puls/min</b>` : ''}</div>
   ${n <= 3 ? `<h4>${s1 ? 'Après 2-3 min de course' : 'Début d\'échauffement'} : note et mot</h4>${ressentiHTML('ech.debut', ech.debut)}<h4>Fin d'échauffement : note et mot</h4>${ressentiHTML('ech.fin', ech.fin)}` : ''}</section>`;
}
const ECH_ITEM = {};ECHAUF_LIB.forEach(g => g.l.forEach(x => {ECH_ITEM[x[0]] = x}));
const OUV_ECH = new Set();
const ACTIV_POUR = {act_scap:['dc','dch','rowh','rowb','pullover'], act_y:['oiseau','tirage','dm'], act_pont:['hip'], act_gm:['sdtj','rowb'], act_fente:['fentes','squath'], act_squat:['squath','sbox']};
function exosDuJour(n){const e = EL();if(n === SEANCE_EVAL)return tirageDe(e);if(n >= SEANCE_PROJET)return jourDe(e, SEANCE);if(n >= 4)return B.listes[SEANCE] || LISTES_DEFAUT[SEANCE] || [];return []}
function renfEch(){const l = ['squat','pompes_mur','pompes_step','pompes_genoux','pompes','dips','gainlat','crunch','crunch_inv','deadbug','birddog','mclimb','taps','rtwist'];
  const n = +SEANCE.slice(1), puiss = SEANCE === 'S6' || (n >= SEANCE_PROJET && EL().projet && EL().projet.mob === 'puiss');if(puiss)l.unshift('sjump');return l.filter(id => ECH_ITEM[id])}
function partiesEch(n){
  const jour = exosDuJour(n), nb = (has, l) => l.filter(has).length;
  const cardio = ['corde','jjack','genoux','talons','chasses','squatjack','burpee','fente_m','chenille','ours','crabe'];   // v5.1 : 2 au choix, renforcement facultatif
  const mob = ['mob_cheville','mob_genou','mob_hanche','mob_buste','mob_epaule','mob_poignet'];
  const act = ['act_scap','act_y','act_pont','act_gm','act_fente','act_squat'];
  const star = act.filter(k => ACTIV_POUR[k].some(a => jour.includes(a)));
  const puiss = SEANCE === 'S6' || (n >= SEANCE_PROJET && EL().projet && EL().projet.mob === 'puiss');
  const P = [
   {k:'P1', t:'1 · Cardio', min:5, r:'5 à 6 min : course ou corde à sauter, puis 2 exercices au choix', intro:'Jusqu\'à la sensation de chaleur et un léger essoufflement.' + (puiss ? ' Séance Puissance : le squat jump en mise en route.' : ''), l:(puiss ? ['sjump'] : []).concat(cardio), star:puiss ? ['sjump'] : [], compte:h => nb(h, cardio.concat('sjump')) + ' / 2 au choix', ok:h => h('P1') || nb(h, cardio.concat('sjump')) >= 2},
   {k:'P2', t:'2 · Articulaire', min:2, r:'Chevilles, genoux, hanches, buste, épaules, poignets', intro:'Dans cet ordre, de bas en haut : 10 cercles dans chaque sens.', l:mob, compte:h => nb(h, mob) + ' / 6', ok:h => h('P2') || nb(h, mob) === mob.length},
   {k:'P3', t:'3 · Activation + gainage obligatoire', min:4, r:'Gainage (planche 20 à 30 s) obligatoire, puis 3 au choix' + (star.length ? ' : les ★ préparent tes exercices du jour' : ', 10 répétitions lentes'), intro:'Obligatoire pour tous : une série de gainage (planche 20 à 30 s) pour activer la sangle abdominale, sans aller jusqu\'à la fatigue : elle doit protéger ton dos pendant les charges. Puis le placement des ateliers, sans charge.', l:['gainage'].concat(act), star:['gainage'].concat(star), compte:h => (h('gainage') ? 'gainage ✓ · ' : 'gainage à faire · ') + nb(h, act) + ' / 3 au choix', ok:h => h('P3') || (h('gainage') && nb(h, act) >= 3)}];
  if(n >= 4 && jour.length){const sp = jour.map(at => 'sp:' + at);
    P.push({k:'P5', t:'4 · Spécifique', min:3, r:'La série d\'approche de chaque exercice du jour', intro:'Environ 50 % de ta charge de travail, 8 répétitions, en soignant le placement.', compte:h => nb(h, sp) + ' / ' + sp.length, ok:h => h('P5') || nb(h, sp) === sp.length,
      l:jour.map(at => {const a = atelier(at);return {html:`<button type="button" class="wcard${(sea(EL(), SEANCE).ech || {}).wc && sea(EL(), SEANCE).ech.wc.includes('sp:' + at) ? ' on' : ''}" data-wc="sp:${at}"><img src="${imgAtelier(at) || ''}" alt="" loading="lazy"><b>${esc(a.nom)}</b><span>${(() => {const ap = approche(a, prevuDe(EL(), SEANCE, at));return ap ? '🔸 ' + esc(ap.txt) : esc(POINT_CLE[at] || '')})()}</span></button>`}})});}
  else P.push({k:'P5', t:'4 · Spécifique', min:3, r:n === 1 ? '1 série légère (barre à vide) sur le premier atelier du circuit' : '1 série légère (barre à vide, 10 répétitions) sur le premier atelier que tu vas tester', l:[], ok:h => h('P5')});
  return P;
}
/* minuteur d'une partie de l'échauffement */
let WT = null;
function wTimer(sec){clearInterval(WT && WT.i);const fin = Date.now() + sec * 1000, el = $('wtimer');if(!el)return;el.hidden = false;
  const maj = () => {const r = Math.max(0, Math.round((fin - Date.now()) / 1000)), t = $('wtt');if(t)t.textContent = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');
    if(r <= 0){clearInterval(WT.i);WT = null;try{navigator.vibrate && navigator.vibrate(300);const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain();o.frequency.value = 1320;g.gain.value = .3;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime + .5)}catch(e){}
      const w = $('wtimer');if(w)w.hidden = true;toast('⏱ Temps écoulé : partie suivante')}};
  WT = {fin, i:setInterval(maj, 500)};maj();
}
/* v6.0 : le titre ouvre la même fiche que l'image */
function titreFiche(id, txt){return `<button type="button" class="titre-fiche" data-fiche="${id}">${esc(txt || atelier(id).nom)}</button>`}
function vignette(id){
  const im = imgAtelier(id), a = atelier(id);
  return im ? `<button type="button" class="vign-bt" data-fiche="${id}" aria-label="Fiche : ${esc(a.nom)}"><img class="vign" src="${im}" alt="" loading="lazy"></button>`
            : `<button type="button" class="bt mini fiche-bt" data-fiche="${id}">📄 Fiche</button>`;
}
function ouvrirFiche(id){
  const a = atelier(id), im = imgAtelier(id);
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>${a.n ? a.n + '. ' : ''}${esc(a.nom)}</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>${im ? `<img class="illu" src="${im}" alt="${esc(a.nom)}">` : ''}
   <p class="small muted">${esc(a.muscles)} · ${esc(SUPPORTS[a.support].nom)}</p><h4>Placement</h4><ul class="ats">${a.crit.map(c => `<li>${esc(c)}</li>`).join('')}</ul><h4>Respiration</h4><p>${esc(a.resp)}</p><h4>Sécurité</h4><p>${esc(a.secu)}</p>
   ${a.niveaux ? `<h4>Niveaux</h4><ol class="ats">${a.niveaux.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : ''}${a.moins ? `<p class="small"><b>− Plus facile.</b> ${esc(a.moins)}</p>` : ''}${a.plus ? `<p class="small"><b>+ Plus difficile.</b> ${esc(a.plus)}</p>` : ''}
   ${ficheImg(id) ? `<button type="button" class="bt pleine" data-poster="${id}" style="margin-top:10px">📖 Voir la fiche complète</button>` : ''}
   <button type="button" class="bt pleine" data-act="fermerFen" style="margin-top:10px">Fermer</button>`);
}
/* ================== v5.0 : organisation du cycle ================== */
const listeDe = S => (B.listes && B.listes[S]) || LISTES_DEFAUT[S] || [];
const dejaFait = at => SEANCE === 'S5' ? listeDe('S4').includes(at) : SEANCE === 'S6' ? listeDe('S4').concat(listeDe('S5')).includes(at) : false;
function reglesListe(S){
  const l = listeDe(S), err = [], ok = [];
  if(l.length < 3 || l.length > 4)err.push(`3 ou 4 exercices (vous en avez ${l.length}).`);
  const z = new Set(l.map(at => atelier(at).zone));if(!z.has('haut') || !z.has('bas'))err.push('Au moins un exercice du haut et un du bas du corps.');
  if(S === 'S5'){const d = l.filter(at => listeDe('S4').includes(at));if(d.length)err.push(`Interdit : déjà fait en S4 (${d.map(at => atelier(at).nom).join(', ')}). Changez-le.`);else ok.push('Tous différents de la S4 ✓')}
  if(S === 'S6'){const av = listeDe('S4').concat(listeDe('S5')), nv = l.filter(at => !av.includes(at));if(nv.length < 2)err.push(`Au moins 2 exercices jamais faits en S4 et S5 (vous en avez ${nv.length}). Changez-en.`);else ok.push(`${nv.length} exercices nouveaux ✓`)}
  B.e.forEach(e => {const sans = l.filter(at => atelier(at).type === 'charge' && !cmDe(e, at));if(sans.length)err.push(`${prenom(e.nom)} n'a pas de charge max sur : ${sans.map(at => atelier(at).nom).join(', ')}.`)});
  return {err, ok};
}
function carteReglesListe(){const r = reglesListe(SEANCE);
  return r.err.length ? `<section class="carte alerte-c"><h3>⚠️ À corriger avant de commencer</h3><ul class="ats small">${r.err.map(t => `<li>${esc(t)}</li>`).join('')}</ul><button type="button" class="bt act" data-act="changerListe">Changer les exercices</button></section>` : r.ok.length ? `<p class="retour ok">${r.ok.map(esc).join(' · ')}</p>` : ''}
/* S6 : niveau de puissance (découverte pour tous, confirmé débloqué par le professeur avec son QR) */
function carteNiveauPuiss(){
  const e = EL(), c = MOBILES.puiss.couples;
  return `<section class="carte"><h3>⚡ Mon niveau en Puissance · ${esc(prenom(e.nom))}</h3><div class="chips"><span class="chip-niv${e.puissOk ? '' : ' ici'}">Découverte · ${coupleTxt(c[0])}</span><span class="chip-niv${e.puissOk ? ' ici' : ''}">${e.puissOk ? '✓' : '🔒'} Confirmé · ${coupleTxt(c[1])}, puis ${coupleTxt(c[2])}</span></div>
   <p class="small">${e.puissOk ? 'Niveau confirmé validé par ton professeur.' : 'Tout le monde commence en découverte : trajet parfait d\'abord, puis vitesse. Le niveau confirmé se débloque sur avis du professeur.'}</p>${e.puissOk ? '' : '<button type="button" class="bt mini" data-act="debloquerPuiss">Le professeur débloque (QR)</button>'}</section>`;
}
/* Chantier 9 : plus de code tapé. Le professeur montre le QR « Niveau confirmé » (classe + jour, signé avec la clé de la classe). */
async function validerPuiss(t){
  const S = ' Demande au professeur d\'afficher le QR « Niveau confirmé » du jour.';
  let o;try{o = await decoderQR(t)}catch(e){throw new Error('Ce QR n\'est pas un QR de musculation.' + S)}
  if(o.t !== 'P')throw new Error('Ce n\'est pas le QR « Niveau confirmé ».' + S);
  const c = B.classe || '';
  if(o.c !== c)throw new Error('Ce QR est celui de la classe ' + o.c + ', pas de la tienne (' + c + ').' + S);
  if(o.d !== EPSCode.jour())throw new Error('Ce QR n\'est pas celui d\'aujourd\'hui. Vérifie aussi la date du téléphone.' + S);
  const cle = (EPSCode.cleDe && EPSCode.cleDe(c)) || '';
  if(!cle)throw new Error('Scanne d\'abord le QR de la classe, puis ce QR.');
  let ok = false;try{ok = String(o.k) === await EPSCode.code(cle, c, o.d, 'PUISS')}catch(e){}
  if(!ok)throw new Error('Ce QR ne permet pas de débloquer le niveau (abîmé ou modifié).' + S);
  EL().puissOk = jour();sauver();rendre();return '⚡ Niveau confirmé débloqué pour ' + prenom(EL().nom);
}
function debloquerPuiss(){
  fenetre(`<h3>⚡ Niveau confirmé · ${esc(prenom(EL().nom))}</h3><p>Le professeur affiche le <b>QR « Niveau confirmé »</b> : scanne-le pour débloquer le niveau.</p>
   <div class="rangee"><button type="button" class="bt act" data-act="${DEMO ? 'valPuiss' : 'scanPuiss'}">📷 Scanner le QR du professeur</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
/* S7-S8 : 3 exercices du projet par séance */
function jourDe(e, S){
  const pool = ((e.projet && e.projet.exos) || []).map(x => x.at), s = sea(e, S);
  if(s.jour && s.jour.length && s.jour.every(at => pool.includes(at)))return s.jour;
  const faitsS7 = Object.keys((e.seances.S7 || {}).exos || {}).filter(at => e.seances.S7.exos[at].real);
  const ord = S === 'S8' ? pool.filter(at => !faitsS7.includes(at)).concat(pool.filter(at => faitsS7.includes(at))) : pool;
  const r = [], zones = z => ord.find(at => atelier(at).zone === z && !r.includes(at));
  ['haut', 'bas'].forEach(z => {const at = zones(z);if(at && r.length < 3)r.push(at)});
  ord.forEach(at => {if(r.length < 3 && !r.includes(at))r.push(at)});
  return r;
}
function carteJour(e){
  const pool = e.projet.exos.map(x => x.at), j = jourDe(e, SEANCE), z = new Set(j.map(at => atelier(at).zone));
  const ok = j.length === 3 && z.has('haut') && z.has('bas');
  return `<section class="carte"><h3>Mes 3 exercices aujourd'hui · ${esc(prenom(e.nom))}</h3><p class="small muted">Choisis 3 exercices de ton projet${SEANCE === 'S8' ? ' (les mêmes qu\'en S7 ou d\'autres : le tirage de la S9 se fait parmi tous ceux réalisés en S7 et S8)' : ''}.</p>
   <div class="chips">${pool.map(at => `<button type="button" class="${j.includes(at) ? 'ici' : ''}" data-jour="${at}">${j.includes(at) ? '✓ ' : ''}${esc(atelier(at).nom)}</button>`).join('')}</div>
   ${ok ? '' : `<p class="retour non">${j.length !== 3 ? '3 exercices exactement.' : 'Au moins un du haut et un du bas du corps.'}</p>`}</section>`;
}
/* S9 : exercices tirés au sort par l'outil prof (QR du tirage), ou recopiés à la main */
const realisesProjet = e => [...new Set(['S7', 'S8'].flatMap(S => Object.entries((e.seances[S] || {}).exos || {}).filter(([, x]) => x.real).map(([at]) => at)))];
const tirageDe = e => (e.tirage && e.tirage.l) || [];
function carteTirage(e){
  const t = tirageDe(e), r = realisesProjet(e);
  if(t.length)return `<section class="carte act"><h3>🎲 Mes 3 exercices tirés au sort</h3><p>${t.map(at => `<b>${esc(atelier(at).nom)}</b>`).join(' · ')}</p><p class="small muted">${e.tirage.src === 'qr' ? 'Reçu par le QR du professeur.' : 'Recopié à la main.'} <button type="button" class="lien" data-act="refaireTirage">corriger</button></p></section>`;
  return `<section class="carte act"><h3>🎲 Tirage au sort de l'évaluation</h3><p>Scanne le <b>QR du tirage</b> affiché par le professeur.</p><button type="button" class="bt act pleine" data-act="scanClasse">📷 Scanner le QR du tirage</button>
   <details style="margin-top:8px"><summary class="small">Pas de caméra ? Recopie les 3 exercices annoncés</summary><div class="chips">${r.map(at => `<button type="button" class="${(e.tirageMan || []).includes(at) ? 'ici' : ''}" data-tman="${at}">${esc(atelier(at).nom)}</button>`).join('')}</div>${r.length ? '' : '<p class="small muted">Aucun exercice réalisé en S7 et S8 dans ce carnet.</p>'}
   <button type="button" class="bt mini" data-act="valTirage">Valider ces 3 exercices</button></details></section>`;
}
/* v4.0 : chrono binôme */
function exosEleve(e){const n = +SEANCE.slice(1);if(n === SEANCE_EVAL)return tirageDe(e);if(n >= SEANCE_PROJET)return jourDe(e, SEANCE);return B.listes[SEANCE] || LISTES_DEFAUT[SEANCE] || []}
function choixBinome(){
  const opt = (e, i) => {const l = exosEleve(e), s = sea(e, SEANCE).exos || {}, def = l.find(at => !(s[at] && s[at].real)) || l[0];
    if(!l.length)return `<p class="retour non">${esc(prenom(e.nom))} n'a pas encore d'exercices pour cette séance${+SEANCE.slice(1) >= SEANCE_PROJET ? ' (projet à construire dans l\'onglet Projet)' : ''}.</p>`;
    return `<label class="ch">${esc(prenom(e.nom))}</label><select id="cb${i}">${l.map(at => `<option value="${at}"${at === def ? ' selected' : ''}>${esc(atelier(at).nom)}${s[at] && s[at].real ? ' ✓ fait' : ''}</option>`).join('')}</select>`};
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>⏱ Chrono binôme</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>
   <p class="small">Choisissez l'exercice de chacun. ${prenom(B.e[0].nom)} commence.</p>${B.e.slice(0, 2).map(opt).join('')}
   ${B.e.slice(0, 2).every(e => exosEleve(e).length) ? `<button type="button" class="bt act pleine" data-act="goBinome" style="margin-top:12px">▶ Lancer</button>` : ''}`);
}
function lancerBinome(){
  if(window.EPSSifflet && EPSSifflet.choix() === null)return EPSSifflet.demander(lancerBinome);
  const E2 = B.e.slice(0, 2), ats = [$('cb0').value, $('cb1').value];fermerFen();
  const P = E2.map((e, i) => {const at = ats[i], a = atelier(at), p = prevuDe(e, SEANCE, at) || {}, M = MOBILES[p.mob] || {};
    const ch = p.charge && p.charge.charge ? fmtKg(p.charge.charge) : (a.niveaux && p.niv != null ? 'Niv. ' + (p.niv + 1) : '');
    const ap = approche(a, p);return {prenom:prenom(e.nom), nom:a.nom, img:imgAtelier(at), mob:p.mob, mobNom:M.nom, bloque:p.mob === 'volume' || p.mob === 'puiss', approche:ap ? ap.txt : '', rappel:rappelMobile(p.mob), compo:p.charge ? p.charge.compo : '', series:p.series || 3, reps:p.reps || 10, temps:!!a.temps, chargeTxt:ch, recupS:M.recupS || 90, cle:POINT_CLE[at] || ''}});
  MinuteurM.binome(P, {onFin:r => {
    E2.forEach((e, i) => {const at = ats[i], s = sea(e, SEANCE);s.exos = s.exos || {};const x = s.exos[at] = s.exos[at] || {}, p = prevuDe(e, SEANCE, at);
      if(r.faites[i] > 0)x.real = {series:r.faites[i], reps:p ? p.reps : 10, charge:p && p.charge ? p.charge.charge : null, niv:p ? p.niv : null, diff:!!(p && r.faites[i] !== p.series)};
      if(r.cle[i]){x.avis = x.avis || {signes:[], conseil:''};x.avis.par = E2[1 - i].nom;x.avis.cle = r.cle[i]}});
    sauver();rendre();toast('Enregistré pour vous deux : notez vos ressentis et vos conseils.')}});
}
/* v6.0 : rappel court des attendus du mobile, affiché pendant le chrono */
function rappelMobile(mob){const M = MOBILES[mob];return M ? `${M.nom} (${M.theme.toLowerCase()}) : ${M.exec.charAt(0).toLowerCase() + M.exec.slice(1)} · récup ${M.recup}` : ''}
/* v2.12 : chrono des séries (minuteur.js) : temps de travail, récupération du mobile, dessin, point clé pour le coach */
function lancerChrono(at){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at);if(!p)return toast('Pas de paramètres prévus pour cet exercice.');
  const M = MOBILES[p.mob] || {}, aut = autre();
  const ch = p.charge && p.charge.charge ? fmtKg(p.charge.charge) : (a.type === 'variante' && a.niveaux && p.niv != null ? 'Niv. ' + (p.niv + 1) : '');
  if(window.EPSSifflet && EPSSifflet.choix() === null)return EPSSifflet.demander(() => lancerChrono(at));
  MinuteurM.ouvrir({at, nom:a.nom, img:imgAtelier(at), mob:p.mob, mobNom:M.nom, rappel:rappelMobile(p.mob), series:p.series, reps:p.reps, temps:!!a.temps, chargeTxt:ch,
    recupS:M.recupS || 90, approche:(approche(a, p) || {}).txt || '', cle:POINT_CLE[at] || '', crit:a.crit || [], signes:SIGNES, partenaire:aut ? prenom(aut.nom) : '',
    onFait:() => {const b = document.createElement('button');b.type = 'button';b.dataset.fait = at;b.hidden = true;document.body.appendChild(b);b.click();b.remove()}});
}
/* v2.6 : fiches d'exercice complètes et répertoire de l'échauffement */
function ouvrirPoster(id){
  const src = ficheImg(id);
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>${esc(FICHES[id])}</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>
   <a href="${src}" target="_blank" rel="noopener"><img class="poster" src="${src}" alt="Fiche : ${esc(FICHES[id])}"></a>
   <p class="small muted">Touche la fiche pour l'ouvrir en grand et zoomer.</p><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`);
}
function ouvrirEchauf(id){
  let it = null;ECHAUF_LIB.forEach(g => g.l.forEach(x => {if(x[0] === id)it = x}));if(!it)return;
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>${esc(it[1])}</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>
   <img class="illu" src="${imgEchauf(id)}" alt="${esc(it[1])}"><p>${esc(it[2])}</p><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`);
}
function vueFiches(){
  const ids = Object.keys(FICHES);
  return `<h2>🎯 Les 3 mobiles</h2><section class="carte"><p class="small muted">Touche une affiche pour voir le tableau complet : %, séries, répétitions, récupération, sensation attendue.</p><div class="mob-choix">${MOBILES_ORDRE.map(m => `<button type="button" style="--mc:${MOBILES[m].coul}" data-act="mobiles"><img src="${MOB_IMG[m]}" alt=""><span>${MOBILES[m].nom}</span></button>`).join('')}</div></section>
   <h2>📖 Fiches d'exercice</h2>
   ${[['haut','💪 Haut du corps'],['tronc','🧱 Tronc'],['bas','🦵 Bas du corps']].map(([z, t]) => {
     const l = ids.filter(id => (atelier(id) || {}).zone === z).sort((x, y) => atelier(x).groupe.localeCompare(atelier(y).groupe, 'fr') || FICHES[x].localeCompare(FICHES[y], 'fr'));
     const tr = z === 'tronc' ? ['gainage','gainlat','crunch','crunch_inv','deadbug','birddog','mclimb','taps','rtwist'].filter(k => ECH_ITEM[k]) : [];
     return `<section class="carte"><h3>${t}</h3>${l.length ? `<div class="fiches-grille">${l.map(id => `<button type="button" class="fiche-vig" data-poster="${id}"><img src="${imgAtelier(id) || ficheImg(id)}" alt="" loading="lazy"><span>${esc(FICHES[id])}</span><small class="muted">${esc(atelier(id).groupe)}</small></button>`).join('')}</div>` : ''}
      ${tr.length ? `<p class="small muted">Pas d'atelier à charge pour le tronc : abdominaux et gainage au poids du corps.</p><div class="fiches-grille">${tr.map(k => `<button type="button" class="fiche-vig" data-ech="${k}"><img src="${imgEchauf(k)}" alt="" loading="lazy"><span>${esc(ECH_ITEM[k][1])}</span><small class="muted">Abdominaux</small></button>`).join('')}</div>` : ''}</section>`}).join('')}
   <h2>🔥 Échauffement</h2>${ECHAUF_LIB.map(g => `<section class="carte"><h3>${esc(g.t)}</h3><p class="small muted">${esc(g.i)}</p><div class="ech-liste">${g.l.map(([id, nom, txt]) => `<button type="button" class="ech-it" data-ech="${id}"><img src="${imgEchauf(id)}" alt="" loading="lazy"><span><b>${esc(nom)}</b><br><span class="small">${esc(txt)}</span></span></button>`).join('')}</div></section>`).join('')}`;
}
function ficheAtelier(a){
  const im = imgAtelier(a.id);
  return `<details><summary>Fiche : placement, respiration, sécurité</summary>${im ? `<img class="illu" src="${im}" alt="${esc(a.nom)}" loading="lazy">` : ''}<p class="small muted">${esc(a.muscles)} · ${esc(SUPPORTS[a.support].nom)}</p><ul class="ats small">${a.crit.map(c => `<li>${esc(c)}</li>`).join('')}</ul><p class="small"><b>Respiration.</b> ${esc(a.resp)}</p><p class="small"><b>Sécurité.</b> ${esc(a.secu)}</p>${a.moins ? `<p class="small"><b>− Plus facile.</b> ${esc(a.moins)}</p>` : ''}${a.plus ? `<p class="small"><b>+ Plus difficile.</b> ${esc(a.plus)}</p>` : ''}</details>`;
}
function carteCircuit(){
  const s = sea(EL(), 'S1'), c = s.circuit || {};
  const fait = CIRCUIT_S1.filter(id => c[id]).length;
  return `<section class="carte"><h3>Circuit · ${CIRCUIT_S1.length} ateliers</h3><p class="small">4 min par atelier : 2 × 10 répétitions chacun, charge légère. On apprend le geste. <b>${fait}/${CIRCUIT_S1.length}</b> faits.</p>
   ${CIRCUIT_S1.map((id, i) => {const a = atelier(id);return `<div class="ex${c[id] ? ' fait' : ''}"><header>${vignette(id)}${titreFiche(id, (i + 1) + '. ' + a.nom)}<button type="button" class="bt mini${c[id] ? ' ok' : ''}" data-circuit="${id}">${c[id] ? '✓ Fait' : 'Fait'}</button></header></div>`}).join('')}</section>`;
}
const QUESTIONS = [
 {k:'freq', q:"Combien de fois par semaine fais-tu une activité physique (club, AS, salle, vélo, marche…) ?", o:['0','1','2','3','4','5 ou plus']},
 {k:'bien', q:"Après une activité physique, te sens-tu mieux dans ton corps et dans ta tête ?", o:['Oui','Un peu','Non']},
 {k:'ecran', q:"Combien de temps par jour passes-tu sur un écran (téléphone, console, TV) ?", o:['Moins de 2 h','2 à 4 h','Plus de 4 h']},
 {k:'envie', multi:true, q:"Pour te sentir mieux, qu'aimerais-tu ? (plusieurs choix)", o:[
   ['tonus',"Gagner en tonus, ne plus être essoufflé dans les escaliers",'tonif'],
   ['dos',"Me redresser, être moins voûté",'tonif'],
   ['defoul',"Me défouler après une journée assis",'tonif'],
   ['galbe',"Avoir des muscles plus volumineux, plus dessinés",'volume'],
   ['groupe',"Développer un groupe musculaire précis",'volume'],
   ['sport',"Améliorer ma détente, ma vitesse, être plus efficace dans mon sport",'puiss']]}
];
function suggestion(r){
  if(!r || !r.envie || !r.envie.length)return null;
  const sc = {tonif:0, volume:0, puiss:0};
  QUESTIONS[3].o.forEach(([k, , m]) => {if(r.envie.includes(k))sc[m]++});
  if(r.ecran === 'Plus de 4 h' || r.freq === '0' || r.freq === '1')sc.tonif += .5;
  return MOBILES_ORDRE.slice().sort((a, b) => sc[b] - sc[a])[0];
}
function carteSitue(){
  const e = EL(), r = e.situe || {};
  const m = suggestion(r);
  return `<section class="carte act"><h3>Je me situe · ${esc(prenom(e.nom))}</h3>
   ${QUESTIONS.map(Q => `<p><b>${esc(Q.q)}</b></p><div class="chips">${Q.o.map(o => {const [k, t] = Array.isArray(o) ? o : [o, o];const on = Q.multi ? (r[Q.k] || []).includes(k) : r[Q.k] === k;return `<button type="button" class="${on ? 'ici' : ''}" data-situe="${Q.k}" data-v="${esc(k)}"${Q.multi ? ' data-multi="1"' : ''}>${esc(t)}</button>`}).join('')}</div>`).join('')}
   ${m ? `<p class="retour ok">Mobile suggéré : <b>${MOBILES[m].nom}</b> (${MOBILES[m].theme}). Tu les essaieras tous les trois (S4 à S6) avant de choisir en S6.</p>` : ''}</section>`;
}
/* ---------- Test 10 RM ---------- */
/* ---------- v6.0 : absences et rattrapage (suivi individuel) ---------- */
const absent = (e, S) => !!(e.abs && e.abs[S || SEANCE]);
function carteAbsence(){
  if(B.e.length < 2 && !absent(EL()))return '';
  return `<div class="abs-l"><span>Absent(e) aujourd'hui ?</span>${B.e.map((x, i) => `<button type="button" class="${absent(x) ? 'ici' : ''}" data-abs="${i}" aria-pressed="${absent(x)}">${absent(x) ? '✗ ' : ''}${esc(prenom(x.nom))}${absent(x) ? ' absent(e)' : ''}</button>`).join('')}</div>
   ${absent(EL()) ? `<p class="retour non">${esc(prenom(EL().nom))} est noté(e) <b>absent(e) en ${SEANCE}</b> : rien n'est attendu aujourd'hui. Ce qui n'a pas été fait reste <b>à rattraper</b> plus tard, sans bloquer la suite.</p>` : ''}`;
}
/* statut d'un atelier du test pour un élève */
function statutTest(e, id){
  if(e.rm[id])return {k:'ok', t:'✓ Validé'};
  if(T && T.at === id && B.e[T.el] === e)return {k:'cours', t:'◐ En cours'};
  const n = +SEANCE.slice(1);
  if(n > 3 || (n === 3 && absent(e, 'S2')))return {k:'ratt', t:'⏳ À rattraper'};
  return {k:'faire', t:'○ À réaliser'};
}
function protocole10RM(ouvert){
  return `<details class="carte info protocole"${ouvert ? ' open' : ''}><summary>📘 Mode d'emploi du test 10 RM</summary><ol class="ats small">
   <li><b>Le 10 RM</b>, c'est la charge la plus lourde que tu soulèves <b>10 fois de suite, proprement</b>, sans aide et avec la technique de la fiche.</li>
   <li><b>Avant de commencer</b> : lis la fiche de l'exercice (touche l'image ou le titre).</li>
   <li><b>Première charge</b> : légère, une charge que tu pourrais soulever 15 fois (l'appli en propose une).</li>
   <li><b>Les 10 répétitions</b> : amplitude complète, montée et descente contrôlées. Ton partenaire compte à voix haute et touche <b>No REP</b> si une répétition est mal faite.</li>
   <li><b>La charge était-elle adaptée ?</b> Après 10 répétitions, dis combien tu aurais encore pu en faire : <b>5 ou plus</b> → on ajoute 5 kg de chaque côté ; <b>2 à 4</b> → 2 kg de chaque côté (1 kg sur un haltère) ; <b>0 ou 1</b> → c'est ton 10 RM.</li>
   <li><b>Diminuer</b> : si tu n'arrives pas à 10 répétitions propres, la série s'arrête ; ta dernière charge réussie 10 fois compte.</li>
   <li><b>Quand arrêter</b> : à la première série ratée, dès que la technique se dégrade, ou après 5 séries. 2 min de récupération entre deux séries. <b>Jamais de répétition forcée, jamais d'aide pour finir.</b></li>
   <li><b>Enregistrer</b> : ton partenaire valide. L'appli garde ton 10 RM et en déduit ta charge max estimée, qui sert à calculer tes charges en % dans les séances suivantes.</li></ol></details>`;
}
function carteTest(){
  const e = EL();
  const nb = ATELIERS_TEST.filter(id => e.rm[id]).length, bas = ATELIERS_TEST.some(id => e.rm[id] && atelier(id).zone === 'bas');
  const restants = ATELIERS_TEST.filter(id => !e.rm[id]), faits = ATELIERS_TEST.filter(id => e.rm[id]);
  const ligne = id => {const a = atelier(id), r = e.rm[id], st = statutTest(e, id);
    return `<div class="ex${r ? ' fait' : ''}"><header>${vignette(id)}${titreFiche(id)}<span class="statut st-${st.k}">${st.t}</span></header>
     ${r ? `<p class="small">${r.dix ? `10 RM : <b>${fmtKg(r.dix)}</b> · ` : r.charge ? `${fmtKg(r.charge)} × ${r.reps} · ` : ''}charge max estimée <b>${fmtKg(r.cm)}</b> <span class="muted">(${MODE_RM[r.mode] || r.mode})</span></p>` : ''}
     <div class="rangee"><button type="button" class="bt mini act" data-test="${id}">${r ? 'Refaire le test' : 'Commencer le test'}</button><button type="button" class="bt mini" data-direct="${id}">Saisie directe</button></div></div>`};
  return `${protocole10RM(!nb)}<section class="carte"><h3>Mes tests 10 RM · ${esc(prenom(e.nom))}</h3>
   <p class="retour ${nb >= OBJ_TESTS[0] ? 'ok' : 'non'}"><b>${nb} / ${ATELIERS_TEST.length}</b> charges de référence · objectif ${OBJ_TESTS[0]} à ${OBJ_TESTS[1]} à la fin de la S3 (4 à 5 par séance)${bas ? '' : ' · pense à un atelier du bas du corps'}.</p>
   ${restants.length ? `<h4>${SEANCE === 'S2' ? 'À réaliser' : 'Il te reste'} (${restants.length})</h4>${restants.map(ligne).join('')}` : `<p class="retour ok">Tous tes ateliers ont une charge de référence ✓</p>`}
   ${faits.length ? `<details class="deja"><summary>Déjà validés (${faits.length}) : voir ou refaire</summary>${faits.map(ligne).join('')}</details>` : ''}</section>`;
}
/* S4 et après : les charges de référence qui manquent pour les exercices du jour */
function carteRattrapage(ids){
  const e = EL(), m = (ids || []).filter(at => atelier(at).type === 'charge' && !e.rm[at]);
  if(!m.length || absent(e))return '';
  return `<section class="carte alerte-c"><h3>⏳ À rattraper · ${esc(prenom(e.nom))}</h3><p class="small">Pas encore de charge de référence sur ${m.length > 1 ? 'ces exercices' : 'cet exercice'} : fais le test 10 RM au début de l'exercice (5 min environ), ou une saisie directe si tu connais ta charge. Rien n'est bloqué.</p>
   ${m.map(at => `<div class="rangee ratt"><b>${esc(atelier(at).nom)}</b><button type="button" class="bt mini act" data-test="${at}">Test 10 RM</button><button type="button" class="bt mini" data-direct="${at}">Saisie directe</button></div>`).join('')}</section>`;
}
let T = null; // test en cours
function ouvrirTest(at){
  const a = atelier(at), e = EL(), pas = pasMontee(a.support);
  const dep = chargeReelle(a.support, a.depart || SUPPORTS[a.support].vide || 4);
  T = {at, el:P, series:[], charge:dep ? dep.charge : 4, cpt:0, norep:0, suite:0, phase:'serie', pas, recupFin:0, reserve:''};
  rendreTest();
}
/* v6.0 : détail de la charge (barre, par côté, total) et réglage avec les vrais disques */
function detailCharge(sup, charge){
  const s = SUPPORTS[sup];if(!s)return '';
  if(s.fixes)return `<p class="detail-ch"><span>Haltère fixe : <b>${fmtKg(charge)}</b></span></p>`;
  if(!s.disques)return '';
  const cote = +((charge - s.vide) / 2).toFixed(2), d = disquesCote(sup, charge);
  return `<p class="detail-ch"><span>${esc(s.nom)} : <b>${fmtKg(s.vide)}</b></span><span>Par côté : <b>${fmtKg(cote)}</b>${d.length ? ` (${d.map(x => String(x).replace('.', ',')).join(' + ')})` : ' (aucun disque)'}</span><span>Total : <b>${fmtKg(charge)}</b>${s.unite === 'par haltère' ? ' par haltère' : ''}</span></p>`;
}
function reglageCharge(sup){
  const s = SUPPORTS[sup];if(!s)return '';
  if(s.fixes)return `<div class="disq"><button type="button" data-tfix="-1">− haltère plus léger</button><button type="button" data-tfix="1">+ haltère plus lourd</button></div>`;
  return `<p class="small" style="text-align:center;margin:6px 0 2px">Disques <b>de chaque côté</b>${s.unite === 'par haltère' ? ' de l\'haltère' : ' de la barre'} :</p>
   <div class="disq">${[10, 5, 2, 1].map(d => `<button type="button" class="moins" data-tdisq="-${d}" aria-label="retirer ${d} kg de chaque côté">− ${d}</button>`).join('')}</div>
   <div class="disq">${[1, 2, 5, 10].map(d => `<button type="button" class="plus" data-tdisq="${d}" aria-label="ajouter ${d} kg de chaque côté">+ ${d}</button>`).join('')}</div>`;
}
/* montée conseillée selon la réserve annoncée après 10 répétitions */
function monteeConseillee(sup, base, reserve){
  const s = SUPPORTS[sup], p = chargesPossibles(sup);if(!s || reserve === '01')return base;
  if(s.fixes){const i = p.indexOf(base), k = reserve === '5' ? 2 : 1;return p[Math.min(p.length - 1, i + k)] != null ? p[Math.min(p.length - 1, i + k)] : base}
  const cote = s.vide <= 2 ? (reserve === '5' ? 2 : 1) : (reserve === '5' ? 5 : 2);
  return +(base + 2 * cote).toFixed(1);
}
function rendreTest(){
  if(!T){const x = $('ecranTest');if(x)x.remove();return}
  const a = atelier(T.at), e = B.e[T.el];
  let el = $('ecranTest');if(!el){el = document.createElement('div');el.className = 'ecran';el.id = 'ecranTest';document.body.appendChild(el)}
  const series = `<div class="series">${T.series.map((s, i) => `<span class="${s.valides >= 10 ? 'ok' : ''}">S${i + 1} : ${fmtKg(s.charge)} × ${s.valides}${s.norep ? ` (${s.norep} No REP)` : ''}</span>`).join('')}</div>`;
  let h = `<div class="rangee" style="justify-content:space-between"><h3>Test 10 RM · ${titreFiche(T.at)}</h3><button type="button" class="bt mini" data-act="annulerTest">Quitter</button></div><p class="muted small">${esc(prenom(e.nom))} soulève, le partenaire compte et juge. Série ${T.series.length + (T.phase === 'serie' ? 1 : 0)} sur 5 au maximum.</p>${series}`;
  if(T.phase === 'serie'){
    h += `<div class="charge-grande">${fmtKg(T.charge)}</div>${detailCharge(a.support, T.charge)}
     ${T.cpt === 0 ? reglageCharge(a.support) : ''}
     <div class="compteur">${T.cpt}<small>répétitions valides${T.norep ? ` · ${T.norep} No REP` : ''}</small></div>
     <div class="rangee"><button type="button" class="bt ok geant" data-act="tPlus">+ 1</button><button type="button" class="bt danger geant" data-act="tNo">No REP</button></div>
     <p class="small muted">No REP : amplitude incomplète, trajet déformé, charge non freinée. Deux No REP de suite arrêtent la série.</p>
     <button type="button" class="bt pleine" data-act="tFinSerie" style="margin-top:8px">L'élève s'arrête : fin de la série</button>`;
  } else if(T.phase === 'recup'){
    const R = [['5', '5 ou plus'], ['24', '2 à 4'], ['01', '0 ou 1']];
    h += `<p class="retour ok">✓ 10 répétitions propres à ${fmtKg(T.base)}.</p>
     <p class="bti">Combien de répétitions propres te restait-il ?</p><div class="seg trois">${R.map(([k, t]) => `<button type="button" class="${T.reserve === k ? 'ici' : ''}" data-treserve="${k}">${t}</button>`).join('')}</div>
     ${T.reserve === '01' ? `<p class="retour ok">Tu es à ton <b>10 RM</b> : arrête-toi ici, inutile de forcer.</p><button type="button" class="bt ok pleine" data-act="tStop">✓ Terminer : ${fmtKg(T.base)} est mon 10 RM</button>`
      : T.reserve ? `<p class="small">On monte : prochaine série à <b>${fmtKg(T.charge)}</b>. Tu peux l'ajuster avec les disques.</p><div class="charge-grande petite">${fmtKg(T.charge)}</div>${detailCharge(a.support, T.charge)}${reglageCharge(a.support)}` : ''}
     ${T.series.length === 1 ? `<h4>Ressenti à la 1re série</h4>${ressentiHTML('test.' + T.at + '.premiere', (e.tests[T.at] || {ressentis:{}}).ressentis.premiere)}` : ''}
     <div class="chrono" id="tChrono">2:00</div><p class="small muted" style="text-align:center">Récupération (2 min) : le partenaire fait sa série pendant ce temps.</p>
     ${T.reserve && T.reserve !== '01' ? `<button type="button" class="bt act pleine" data-act="tSuivante">Série suivante à ${fmtKg(T.charge)}</button>` : ''}
     ${T.reserve !== '01' ? `<button type="button" class="bt pleine" data-act="tStop" style="margin-top:8px">J'arrête ici</button>` : ''}`;
  } else {
    const best = meilleure(T.series), dix = dixRM(T.series);
    h += best ? `<p class="retour ok">${dix ? `Ton 10 RM : <b style="font-size:26px">${fmtKg(dix)}</b><br>` : `Pas de série complète de 10 : estimation d'après ${fmtKg(best.charge)} × ${best.valides}.<br>`}<span class="small">Charge max estimée : <b>${fmtKg(best.cm)}</b> (elle sert à calculer tes charges en %).</span></p>` : `<p class="retour non">Pas de série d'au moins 3 répétitions : recommence plus léger.</p>`;
    h += `<h4>Ressenti à la dernière série</h4>${ressentiHTML('test.' + T.at + '.derniere', (e.tests[T.at] || {ressentis:{}}).ressentis.derniere)}`;
    h += best ? `<button type="button" class="bt ok pleine" data-act="tValider">✓ Je valide (partenaire)</button>` : `<button type="button" class="bt act pleine" data-act="tRecommencer">Recommencer plus léger</button>`;
  }
  el.innerHTML = h;
}
const dixRM = series => {const l = series.filter(s => s.valides >= 10).map(s => s.charge);return l.length ? Math.max(...l) : null};
function meilleure(series){
  let b = null;
  series.forEach(s => {const v = Math.min(10, s.valides), cm = brzycki(s.charge, v);if(cm && (!b || cm > b.cm))b = {cm, charge:s.charge, valides:v}});
  return b;
}
function finSerie(){
  T.series.push({charge:T.charge, valides:T.cpt, norep:T.norep});
  const ok = T.cpt >= 10;T.cpt = 0;T.norep = 0;T.suite = 0;
  if(ok && T.series.length < 5){T.base = T.charge;T.reserve = '';T.phase = 'recup';T.recupFin = Date.now() + 120000;T.repSif = 0;rendreTest();return}
  T.phase = 'fin';rendreTest();
}
setInterval(() => {const c = $('tChrono');if(!c || !T)return;const r = Math.max(0, Math.round((T.recupFin - Date.now()) / 1000));c.textContent = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');if(r === 0){c.style.color = 'var(--ok)';if(!T.repSif){T.repSif = 1;try{window.EPSSifflet && EPSSifflet.reprise()}catch(e){}}}}, 500);
function validerTest(){
  const e = B.e[T.el], best = meilleure(T.series);if(!best)return;
  if(rmVerrou(e))return toast('Charges max bloquées pendant l\'évaluation (S9).');
  majRM(e, T.at, {cm:best.cm, charge:best.charge, reps:best.valides, dix:dixRM(T.series), date:jour(), mode:'test', S:SEANCE});
  const t = e.tests[T.at] = e.tests[T.at] || {ressentis:{}};t.series = T.series;t.date = jour();
  sauver();T = null;rendreTest();rendre();toast('Charge de référence enregistrée');
}
function saisieDirecte(at){
  const a = atelier(at);
  fenetre(`<h3>Saisie directe · ${esc(a.nom)}</h3><p class="small">Tu connais déjà ta charge, sans refaire de test : indique une série réussie <b>proprement</b>, sans aide. Idéalement 10 répétitions (ton 10 RM) ; entre 3 et 10 accepté.</p>
   <label class="ch">Charge totale (kg, ${esc(SUPPORTS[a.support].unite)})</label><input type="number" inputmode="decimal" id="dCh"><label class="ch">Répétitions réussies</label><input type="number" inputmode="numeric" id="dRp" min="3" max="10" value="10">
   <p class="small" id="dRes"></p><div class="rangee"><button type="button" class="bt act" data-act="valDirect" data-at="${at}">Enregistrer</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
/* ---------- Défi ---------- */
function defiBinome(){
  let kg = 0, q = 0;
  B.e.forEach(e => ATELIERS_TEST.forEach(id => {const t = e.tests[id];if(!t || !t.series)return;
    const dix = t.series.filter(s => s.valides >= 10).map(s => s.charge);if(dix.length)kg += Math.max(...dix);
    t.series.forEach(s => {if(!s.norep)q++;q -= s.norep});
    if(t.series.length >= 2 && t.series.every((s, i) => !i || s.charge > t.series[i - 1].charge))q += 2}));
  return {kg:Math.round(kg * 10) / 10, q};
}
function carteDefi(){
  const d = defiBinome();
  return `<section class="carte"><h3>🏆 Défi par équipes (S2 et S3)</h3><p class="small"><b>À quoi ça sert ?</b> Le professeur partage la classe en 4 équipes. Les kilos de vos tests 10 RM s'ajoutent à ceux de votre équipe, et l'écran du professeur affiche le classement de la classe. Ça ne change <b>rien</b> à vos charges ni à vos séances.</p>
   <p class="small"><b>Touchez la lettre de l'équipe annoncée par le professeur</b>, puis montrez le QR de fin de séance :</p><div class="chips">${['A','B','C','D'].map(x => `<button type="button" class="${B.equipe === x ? 'ici' : ''}" data-equipe="${x}">Équipe ${x}</button>`).join('')}</div>
   <p>Votre binôme rapporte <b>${fmtKg(d.kg)}</b> et <b>${d.q}</b> points de qualité.</p><p class="small muted">Kilos : la meilleure charge à 10 répétitions de chacun, sur tous les ateliers testés en S2 et S3. Qualité : + 1 par série sans No REP, + 2 par montée progressive, − 1 par No REP.</p></section>`;
}
/* ---------- QR « Mots et défi » (aucun nom) ---------- */
function carteQRMots(){return `<section class="carte info"><h3>Fin de séance : mots${SEANCE === 'S2' || SEANCE === 'S3' ? ' et défi' : ''}</h3><p class="small">Montre ce QR au professeur : il ajoute vos mots au nuage de la classe${SEANCE === 'S2' || SEANCE === 'S3' ? ' et vos points au défi' : ''}. Aucun nom n'est transmis.</p><button type="button" class="bt act" data-act="qrMots">Afficher le QR</button></section>`}
function motsSeance(S){
  const debut = [], fin = [];
  B.e.forEach(e => {const s = e.seances[S] || {}, ech = s.ech || {};if(ech.debut && ech.debut.mot)debut.push(ech.debut.mot);if(ech.fin && ech.fin.mot)fin.push(ech.fin.mot);
    if(S === 'S2')Object.values(e.tests).forEach(t => {const r = t.ressentis || {};if(r.premiere && r.premiere.mot)debut.push(r.premiere.mot);if(r.derniere && r.derniere.mot)fin.push(r.derniere.mot)})});
  return {debut, fin};
}
async function chaineQR(o){
  const json = new TextEncoder().encode(JSON.stringify(o));
  const b64 = u => {let s = '';u.forEach(x => s += String.fromCharCode(x));return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')};
  if(typeof CompressionStream === 'function'){try{const c = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());return 'MUS1:' + b64(c)}catch(e){}}
  return 'MUS0:' + b64(json);
}
function svgQR(txt){const q = qrcode(0, 'M');q.addData(txt);q.make();return q.createSvgTag({cellSize:6, margin:2, scalable:true})}
/* ---------- v6.4 : QR de séance pour le professeur (un par binôme et par séance) ----------
   Contient seulement la séance choisie, pour chaque élève (avec son nom), + ses charges de référence
   en abrégé, son projet / choix / répartition AFL dès la S7. Si c'est trop long : plusieurs QR à la suite. */
const RM_COURT = r => {const h = (r.hist || []).map(x => [x.cm, x.S || '', x.date || '', x.mode || '']);return [r.cm, r.dix || 0, r.mode || '', r.S || '', r.date || '', h]};
function donneesSeance(e, S){
  const s = JSON.parse(JSON.stringify(e.seances[S] || {}));delete s.seq;
  const o = {e:e.nom, D:s, rm:{}};
  Object.entries(e.rm || {}).forEach(([at, r]) => {if(r && r.cm)o.rm[at] = RM_COURT(r)});
  if(absent(e, S))o.ab = 1;
  if(+S.slice(1) >= SEANCE_PROJET){if(e.projet)o.pr = e.projet;if(e.choix)o.ch = e.choix;const aj = (e.ajust || []).filter(a => a.S === S);if(aj.length)o.aj = aj}
  if(e.afl && (e.afl.rep || e.afl.role))o.af = e.afl;
  if(e.tirage && S === 'S9')o.ti = e.tirage.l;
  return o;
}
const QR_MAX = 900;
async function qrsSeance(S){
  const ts = Math.round(Date.now() / 1000), o = {a:'MUS', v:1, t:'G', c:B.classe || '', s:S, d:jour(), ts, id:B.id.slice(0, 8) + S + ts.toString(36), b:B.id, R:B.e.map(e => donneesSeance(e, S))};
  if(B.listes && B.listes[S])o.l = B.listes[S];
  const txt = await chaineQR(o);if(txt.length <= QR_MAX)return [txt];
  const n = Math.ceil(txt.length / QR_MAX), k8 = o.id.slice(-6), L = [];
  for(let i = 0;i < n;i++)L.push(`MUSP:${k8}:${i + 1}/${n}:` + txt.slice(i * QR_MAX, (i + 1) * QR_MAX));
  return L;
}
let QRS = null;
async function afficherQRSeance(S){
  const vide = B.e.every(e => !Object.keys(e.seances[S] || {}).length && !absent(e, S));
  if(vide && !confirm(`Rien n'est rempli en ${S}. Montrer quand même le QR ?`))return;
  QRS = {S, L:await qrsSeance(S), i:0};
  if(!DEMO){B.envois = (B.envois || []).concat(S + ' QR ' + new Date().toLocaleString('fr-FR'));sauver()}
  dessinerQRSeance();
}
function dessinerQRSeance(){
  const q = QRS;if(!q)return;const n = q.L.length;
  fenetre(`<h3>📲 Séance ${q.S} pour le prof</h3><p class="small">${B.e.map(e => esc(prenom(e.nom))).join(' & ')} · montre ce QR à la tablette du professeur.</p>
   ${n > 1 ? `<p class="retour non" style="text-align:center">QR <b>${q.i + 1} sur ${n}</b> : le prof les scanne tous, dans n'importe quel ordre.</p>` : ''}
   <div class="qr">${svgQR(q.L[q.i])}</div>
   ${n > 1 ? `<div class="rangee" style="justify-content:center"><button type="button" class="bt" data-act="qrPrec"${q.i ? '' : ' disabled'}>◀ Précédent</button><button type="button" class="bt act" data-act="qrSuiv"${q.i < n - 1 ? '' : ' disabled'}>Suivant ▶</button></div>` : ''}
   <button type="button" class="bt pleine" data-act="fermerFen" style="margin-top:8px">Fermer</button>`);
}
async function afficherQRMots(){
  const m = motsSeance(SEANCE), o = {a:'MUS', t:'mots', b:B.id.slice(0, 8), s:SEANCE, debut:m.debut, fin:m.fin};
  if((SEANCE === 'S2' || SEANCE === 'S3') && B.equipe){const d = defiBinome();o.defi = {e:B.equipe, kg:d.kg, q:d.q}}
  const txt = await chaineQR(o);
  fenetre(`<h3>Mots${o.defi ? ' et défi' : ''} · ${SEANCE}</h3><div class="qr">${svgQR(txt)}</div><p class="small">${m.debut.length + m.fin.length} mot(s)${o.defi ? ` · équipe ${o.defi.e} : ${fmtKg(o.defi.kg)}, ${o.defi.q} pts de qualité` : SEANCE === 'S2' ? ' · ⚠️ choisis ton équipe pour le défi' : ''}</p><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`);
}
/* ---------- Mobile du jour et exercices ---------- */
function carteMobile(mob){return mob ? `<div class="mob-bandeau"><img src="${MOB_IMG[mob]}" alt=""><span>${SEANCE_MOBILE[0] <= +SEANCE.slice(1) && +SEANCE.slice(1) <= SEANCE_MOBILE[1] ? 'Aujourd\'hui, je découvre le mobile' : 'Mon mobile'} ${esc(MOBILES[mob].nom)} · ${esc(MOBILES[mob].theme)}</span></div><details class="carte"><summary>📋 Le mobile ${esc(MOBILES[mob].nom)} : paramètres et sensation attendue</summary>${mobileHTML(mob)}</details>` : ''}
function listeExos(ids, projet){
  const e = EL(), S = SEANCE, s = sea(e, S);s.exos = s.exos || {};
  if(!projet){const l = B.listes[S];if(l)ids = l}
  const pres = B.e.slice(0, 2).filter(x => !absent(x));
  const bin = B.e.length > 1 && pres.length < 2 ? `<p class="small muted">Partenaire absent : utilise le « chrono des séries » de chaque exercice.</p>` : B.e.length > 1 && window.MinuteurM && MinuteurM.binome ? `<section class="carte chb-pub"><h3>⏱ Chrono binôme</h3><p class="small">Un seul écran pour vous deux : l'un travaille (vert), l'autre récupère et le regarde (rouge). « Série finie » : le partenaire a un temps de transition (orange) pour changer ses disques, puis touche « JE SUIS PRÊT ».</p><button type="button" class="bt act pleine" data-act="chronoBinome">Lancer le chrono binôme</button></section>` : '';
  return bin + `<h3 style="margin-top:16px">Les exercices · ${esc(prenom(e.nom))}</h3>${projet ? '' : `<p class="small muted">Liste du binôme ; <button type="button" class="lien" data-act="changerListe">changer un exercice</button>.</p>`}` + ids.map(at => carteExo(at, at === (s.exCle && ids.includes(s.exCle) ? s.exCle : ids[0]))).join('');
}
const OUVERT = new Set();   // fiches terminées rouvertes à la main
function carteExo(at, estCle){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at), ex = (sea(e, SEANCE).exos || {})[at] || {};
  const r = ex.ressenti || {}, coh = ex.coh, aut = autre(), n = +SEANCE.slice(1);
  const fini = n >= 4 && ex.real && ficheFinie(ex, p, aut, estCle);
  const etat = fini ? ' fait' : ex.real && coh && !coh.ok && n < 4 ? ' alerte' : '';
  let h = `<div class="ex${etat}" id="ex-${at}"><header>${vignette(at)}${titreFiche(at)}<span class="small muted">${esc(a.groupe)}</span></header>`;
  if(fini && !OUVERT.has(at))return h + resumeFiche(at, ex, p) + '</div>';
  h += rappelPrec(at, ex) + prevuTexte(a, p);
  if(a.type === 'charge' && !(p && p.charge))h += `<p class="small">Pas encore de charge max sur cet atelier : <button type="button" class="lien" data-direct="${at}">saisie directe</button> (une série réussie entre 3 et 10 répétitions).</p>`;
  if(a.type === 'variante' && a.niveaux)h += `<div class="chips">${a.niveaux.map((t, i) => `<button type="button" class="${p && p.niv === i ? 'ici' : ''}" data-niv="${i}" data-at="${at}" title="${esc(t)}">Niv. ${i + 1}</button>`).join('')}</div>`;
  if(n >= 4 && aut){const av = ex.avis || {};
    if(ex.real && coachFini(ex, estCle) && !OUVERT.has('c-' + at))h += `<button type="button" class="resume coachR" data-ouvrir="c-${at}"><span>⏱</span><span><b>${esc(prenom(aut.nom))}</b> : point clé ${av.cle === '1' ? 'tenu ✓' : 'à revoir'}${av.propres != null ? ` · ${av.propres} propres` : ''}<br><small>« ${esc(av.conseil)} »</small></span><span class="small">✎</span></button>`;
    else h += carteCoachM(at, ex, p, a, aut, estCle) + (ex.real && coachFini(ex, estCle) ? `<button type="button" class="lien" data-replier="c-${at}">Replier le coaching</button>` : '');}
  if(!ex.real && n >= 4 && p && window.MinuteurM)h += `<button type="button" class="bt act pleine chrono-bt" data-chrono="${at}">⏱ Lancer le chrono des séries</button>`;
  if(!ex.real)h += `<div class="rangee"><button type="button" class="bt ok" data-fait="${at}">✓ Fait comme prévu</button><button type="button" class="bt" data-modif="${at}">Fait autrement</button></div>`;
  else{
    h += `<p class="small">✓ Réalisé : ${ex.real.series} séries × ${ex.real.reps}${a.temps ? ' s' : ' rép.'}${ex.real.charge ? ' à ' + fmtKg(ex.real.charge) : ''}${ex.real.diff ? ' <b>(différent du prévu)</b>' : ''} <button type="button" class="lien" data-modif="${at}">modifier</button></p>`;
    if(p && p.mob === 'puiss')h += `<div class="rangee"><button type="button" class="bt mini${ex.vit ? ' danger' : ''}" data-vit="${at}">⚡ ${ex.vit ? 'La vitesse a baissé (noté)' : 'La vitesse a baissé avant la fin'}</button></div>`;
    if(n >= 4)h += carteMoi(at, ex, p, estCle);
    else h += `<h4>Mon ressenti</h4>${ressentiHTML('exos.' + at + '.ressenti', r, true)}${coh ? `<p class="retour ${coh.stop ? 'stop' : coh.ok ? 'ok' : 'non'}">${esc(coh.msg)}</p>` : ''}`;
    if(fini)h += `<button type="button" class="lien" data-replier="${at}">Replier la fiche</button>`;
  }
  return h + '</div>';
}
function niveauCoach(){return NIV_COACH_M[SEANCE] || 1}
function coachFini(ex, estCle){const av = ex.avis || {}, niv = niveauCoach();
  if(!estCle)return !!av.cle;   // v5.1 : hors exercice clé, le point clé suffit
  return !!(av.cle && av.conseil && (!estCle || niv < 2 || av.propres != null) && (!estCle || niv < 3 || (av.obj && av.obj.k && av.obj.v !== '' && av.obj.v != null)))}
function ficheFinie(ex, p, aut, estCle){
  const nx = ex.next || {}, av = ex.avis || {}, niv = niveauCoach();
  const moi = ex.ressenti && ex.ressenti.note && ex.rir && (!estCle || (nx.c && (nx.ok !== false || (nx.pq || '').trim())));
  const coach = !aut || coachFini(ex, estCle);
  return !!(moi && coach);
}
function resumeFiche(at, ex, p){
  const nx = ex.next || {}, av = ex.avis || {}, rq = RIR_Q.find(q => q[0] === ex.rir) || [], nq = NEXT_Q.find(q => q[0] === nx.c) || [];
  return `<button type="button" class="resume" data-ouvrir="${at}"><span class="rN" style="background:${couleurNote(ex.ressenti.note)}">${ex.ressenti.note}</span><span>réserve ${esc(rq[1] || '')} · <b>${esc(nq[1] || '')}</b>${av.conseil ? `<br><small>Coach : ${av.cle === '0' ? 'point clé à revoir · ' : ''}« ${esc(av.conseil)} »</small>` : ''}</span><span class="small">✎</span></button>`;
}
/* séance précédente sur le même atelier : conseil et objectif du coach */
function precedent(at){const n = +SEANCE.slice(1), e = EL();for(let k = n - 1;k >= 4;k--){const x = ((e.seances['S' + k] || {}).exos || {})[at];if(x && x.avis && (x.avis.conseil || (x.avis.obj && x.avis.obj.k)))return {S:'S' + k, x}}return null}
function rappelPrec(at, ex){
  const pr = precedent(at);if(!pr)return '';const av = pr.x.avis, qui = av.par ? prenom(av.par) : 'Ton coach', o = av.obj && av.obj.k && av.obj.v !== '' && av.obj.v != null ? av.obj : null, lib = o ? (OBJ_M.find(z => z[0] === o.k) || [])[1] : '';
  const tenu = o && ex.real ? objTenuM(o, ex.real) : null;
  return `<div class="rappel">${av.conseil ? `<p class="small"><b>${esc(qui)}</b> t'avait conseillé (${pr.S}) : « ${esc(av.conseil)} »</p>` : ''}${o ? `<p class="small">🎯 Objectif : <b>${esc(lib)} ${esc(String(o.v))}</b>${tenu == null ? '' : tenu ? ' · <b class="okc">tenu ✓</b>' : ' · pas tenu'}</p>` : ''}
   ${av.conseil && ex.real ? `<div class="rangee"><span class="small">Ce conseil t'a aidé ?</span><span class="chips">${[['1','oui'],['0','non']].map(([v, t]) => `<button type="button" class="${ex.aide === v ? 'ici' : ''}" data-aide="${at}" data-v="${v}">${t}</button>`).join('')}</span></div>` : ''}</div>`;
}
function carteMoi(at, ex, p, estCle){
  const e = EL(), r = ex.ressenti || {}, nx = ex.next || {}, coh = ex.coh, sens = p ? sensSuite(p.mob, ex) : null;
  const prop = p && sens != null ? ajuster(p.mob, p, sens) : null, ok = nx.c ? choixCoherent(sens, nx.c) : null;
  return `<div class="bcm moi"><h4><span>✎</span> Fin de l'exercice · ${esc(prenom(e.nom))} écrit</h4>
   ${ressentiHTML('exos.' + at + '.ressenti', r, true, true)}${coh && coh.stop ? `<p class="retour stop">⛔ ${esc(coh.msg)}</p>` : ''}
   <p class="bti">Combien aurais-tu pu en faire encore, propres ?</p><div class="seg">${RIR_Q.map(([k, t]) => `<button type="button" class="${ex.rir === k ? 'ici' : ''}" data-rir="${at}" data-v="${k}">${t}</button>`).join('')}</div>
   ${(() => {const sg = suggestionRM(e, at, ex, p);return sg ? `<div class="rappel"><p class="small">📈 <b>Ta charge max semble avoir monté</b> : ${sg.reps} rép. à ${fmtKg(sg.charge)} avec de la réserve, soit environ <b>${fmtKg(sg.cm)} → ${fmtKg(sg.est)}</b>. Les charges prévues monteront.</p><div class="rangee"><button type="button" class="bt mini ok" data-majrm="${at}">Mettre à jour</button><button type="button" class="bt mini" data-nonrm="${at}">Non, pas sûr</button></div></div>` : ex.rmMaj ? `<p class="small okc">📈 Charge max mise à jour : ${fmtKg(ex.rmMaj)}.</p>` : ''})()}
   ${estCle ? '' : `<p class="small muted">Exercice simple : ressenti et réserve suffisent. L'analyse complète se fait sur ⭐ l'exercice clé.</p>`}
   ${!estCle ? '' : `<p class="bti">La prochaine fois, je…</p><div class="choix2">${NEXT_Q.map(([k, t]) => `<button type="button" class="${nx.c === k ? 'ici' : ''}" data-next="${at}" data-v="${k}">${esc(varianteTxt(at, t))}</button>`).join('')}</div>`}
   ${estCle && nx.c && prop ? `<p class="retour ${ok === false ? 'non' : 'ok'}">${ex.rir && p ? esc(msgReserve(p.mob, ex.rir)) + ' ' : ''}L'appli proposait : <b>${esc(varianteTxt(at, prop.txt.replace(/\.$/, '')))}</b>. ${ok === false ? 'Ton choix est différent : dis pourquoi.' : 'Ton choix va dans le même sens ✓'}</p>
     <input type="text" class="pq" maxlength="160" data-pq="${at}" value="${esc(nx.pq || '')}" placeholder="${ok === false ? 'Pourquoi ? ex. le dos s\'arrondissait à la fin' : 'Pourquoi (facultatif)'}">` : ''}</div>`;
}
function carteCoachM(at, ex, p, a, aut, estCle){
  const e = EL(), av = ex.avis || {}, niv = niveauCoach(), P_ = esc(prenom(e.nom)), nS = (av.signes || []).length;
  const pc = POINT_CLE[at] || (a.crit || [])[0] || '', objL = OBJ_M.filter(([k]) => k !== 'charge' || a.type === 'charge'), pr = p ? p.reps : 10;
  const monte = ex.next && ['serie', 'reps', 'chargeP'].includes(ex.next.c), defaut = av.cle === '0' || nS;
  return `<div class="bcm coach"><h4><span>⏱</span> Pendant les séries · ${esc(prenom(aut.nom))} coache ${P_}</h4><p class="small muted">Niveau ${niv} : ${['', 'je constate', 'je compte', 'je fixe un objectif'][niv]}${niv > 1 ? estCle ? ' · ⭐ exercice clé' : ` · <button type="button" class="lien" data-excle="${at}">⭐ en faire l'exercice clé</button>` : ''}</p>
   <p class="bti">Point clé : ${esc(pc)}</p><div class="seg deux">${[['1','✓ Tenu'],['0','À revoir']].map(([v, t]) => `<button type="button" class="${av.cle === v ? 'ici' + (v === '0' ? ' rouge' : '') : ''}" data-clevu="${at}" data-v="${v}">${t}</button>`).join('')}</div>
   ${!estCle ? `<p class="small muted">Hors exercice clé : le point clé suffit (tu peux aussi le cocher dans le chrono binôme).</p>` : ''}${!estCle ? '' : `<details class="sig"${nS ? ' open' : ''}><summary>▸ Signes de fatigue${nS ? ` <b>(${nS})</b>` : ''}</summary><div class="chips">${SIGNES.map(sg => `<button type="button" class="${(av.signes || []).includes(sg) ? 'ici' : ''}" data-signe="${esc(sg)}" data-at="${at}">${esc(sg)}</button>`).join('')}</div></details>
   ${niv >= 2 && estCle ? `<p class="bti">Répétitions propres, dernière série</p><div class="pas"><button type="button" data-propres="${at}" data-d="-1" aria-label="moins">−</button><b>${av.propres != null ? av.propres : '–'}</b><span>/ ${pr}</span><button type="button" data-propres="${at}" data-d="1" aria-label="plus">+</button></div>` : ''}
   <p class="bti">Ton conseil</p><div class="chips">${conseilsPour(ex).map(c => `<button type="button" class="${av.conseil === c ? 'ici' : ''}" data-conseil="${esc(c)}" data-at="${at}">${esc(c)}</button>`).join('')}</div>`}
   ${niv >= 3 && estCle ? `<p class="bti">Objectif pour ${P_} la prochaine fois</p><div class="seg">${objL.map(([k, t]) => `<button type="button" class="${av.obj && av.obj.k === k ? 'ici' : ''}" data-objk="${at}" data-v="${k}">${t.replace(' (kg)', '')}</button>`).join('')}</div>
     ${av.obj && av.obj.k ? `<input type="number" inputmode="decimal" data-objv="${at}" value="${esc(av.obj.v != null ? String(av.obj.v) : '')}" placeholder="${(OBJ_M.find(z => z[0] === av.obj.k) || [])[1]}" style="max-width:160px;margin-top:6px">` : ''}` : ''}
   ${defaut && monte ? `<p class="retour non">⚠️ ${esc(prenom(aut.nom))} a vu un défaut, et ${P_} veut augmenter : corrige d'abord la posture.</p>` : ''}</div>`;
}
function modifierExo(at){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at) || {}, ex = (sea(e, SEANCE).exos || {})[at] || {}, re = ex.real || {};
  fenetre(`<h3>Fait autrement · ${esc(a.nom)}</h3><p class="small muted">Note seulement ce qui a changé par rapport au prévu.</p>
   <label class="ch">Séries faites</label><input type="number" inputmode="numeric" id="mSe" value="${re.series || p.series || ''}">
   <label class="ch">${a.temps ? 'Secondes tenues' : 'Répétitions par série'}</label><input type="number" inputmode="numeric" id="mRp" value="${re.reps || p.reps || ''}">
   ${a.type === 'charge' ? `<label class="ch">Charge (kg, ${esc(SUPPORTS[a.support].unite)})</label><input type="number" inputmode="decimal" id="mCh" value="${re.charge || (p.charge ? p.charge.charge : '')}">` : ''}
   <div class="rangee" style="margin-top:12px"><button type="button" class="bt act" data-act="valModif" data-at="${at}">Enregistrer</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
function changerListe(){
  const S = SEANCE, l = B.listes[S] || LISTES_DEFAUT[S], mob = MOBILE_DU_JOUR[S];
  const dispo = dispoPour(mob);
  fenetre(`<h3>Exercices de ${S} (${esc(MOBILES[mob].nom)})</h3><p class="small muted">3 ou 4 exercices. ${S === 'S5' ? 'Aucun exercice de la S4. ' : S === 'S6' ? 'Au moins 2 exercices jamais faits en S4 et S5. ' : ''}Gardez au moins un exercice du haut du corps et un du bas${mob === 'puiss' ? ' (en Puissance : squat haltères ou hip thrust)' : ''}.</p>
   ${[0, 1, 2, 3].map(i => {const id = l[i] || '';return `<label class="ch">Exercice ${i + 1}${i === 3 ? ' (facultatif)' : ''}</label><select data-liste="${i}">${i === 3 ? '<option value="">— aucun —</option>' : ''}${dispo.map(a => `<option value="${a.id}"${a.id === id ? ' selected' : ''}>${esc(a.nom)} · ${a.zone}${dejaFait(a.id) ? ' · déjà fait' : ''}</option>`).join('')}</select>`}).join('')}
   <div class="rangee" style="margin-top:12px"><button type="button" class="bt act" data-act="valListe">Enregistrer</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
/* ---------- S6 : comparer, choisir, échelle ---------- */
function statsMobile(e, S){
  const ex = Object.values((e.seances[S] || {}).exos || {}).filter(x => x.ressenti && x.ressenti.note);
  if(!ex.length)return null;
  const moy = ex.reduce((a, x) => a + x.ressenti.note, 0) / ex.length, ok = ex.filter(x => x.coh && x.coh.ok).length;
  const mots = [...new Set(ex.map(x => x.ressenti.mot).filter(Boolean))].slice(0, 4);
  return {moy:Math.round(moy * 10) / 10, ok, n:ex.length, mots};
}
function carteComparer(){
  const e = EL(), c = e.choix || {};
  return `<section class="carte act"><h3>Comparer les 3 mobiles et choisir · ${esc(prenom(e.nom))}</h3><table class="tb"><tr><th>Mobile</th><th>Note moyenne</th><th>Cohérent</th><th>Mes mots</th></tr>
   ${Object.keys(MOBILE_DU_JOUR).map(S => {const m = MOBILE_DU_JOUR[S], st = statsMobile(e, S);return `<tr><td><b style="color:${MOBILES[m].coul}">${MOBILES[m].nom}</b></td><td>${st ? st.moy : '—'}</td><td>${st ? st.ok + '/' + st.n : '—'}</td><td>${st ? esc(st.mots.join(', ')) : ''}</td></tr>`}).join('')}</table>
   ${e.situe && suggestion(e.situe) ? `<p class="small muted">En S1, « Je me situe » suggérait : ${MOBILES[suggestion(e.situe)].nom}.</p>` : ''}
   <h4>Mon mobile pour le projet</h4>${e.projet && e.projet.exos && e.projet.exos.length ? `<p class="retour ok">Mobile définitif : <b>${MOBILES[c.mob || e.projet.mob].nom}</b>. Il ne change plus.</p>` : `<div class="mob-choix">${MOBILES_ORDRE.map(m => {const bloque = m === 'puiss' && !e.puissOk;return `<button type="button" class="${c.mob === m ? 'ici' : ''}${bloque ? ' bloque' : ''}" style="--mc:${MOBILES[m].coul}" data-choix="${m}"><img src="${MOB_IMG[m]}" alt=""><span>${c.mob === m ? '✓ ' : bloque ? '🔒 ' : ''}${MOBILES[m].nom}</span></button>`}).join('')}</div>
   ${!e.puissOk ? `<p class="small muted">🔒 Puissance : seulement si ton professeur a validé le niveau confirmé (en S6, ou maintenant avec son QR « Niveau confirmé »).</p><button type="button" class="bt mini" data-act="debloquerPuiss">Débloquer (code du prof)</button>` : ''}<p class="small"><b>Attention :</b> ce choix est définitif dès que ton projet est construit.</p>`}
   <label class="ch" for="choixPq">Pourquoi ? Quelle sensation te le dit ?</label><textarea id="choixPq" data-texte="choix">${esc(c.pourquoi || '')}</textarea></section>`;
}
function carteEchelle(){
  const e = EL(), voc = vocab(e);
  return `<section class="carte"><h3>Mon échelle de ressentis</h3><p class="small">Pour chaque niveau, ton mot à toi (pris dans les mots de la classe ou le tien).</p>
   ${ECHELLE.map(([n, t, d, c]) => `<div class="rangee" style="margin:4px 0"><span style="background:${c};border-radius:10px;min-width:44px;text-align:center;font:800 22px/44px var(--d);color:#1c2128">${n}</span><span class="small" style="flex:1">${esc(t)}</span><select data-echelle="${n}" style="flex:1.2;min-height:44px"><option value="">—</option>${[...new Set(voc.concat(e.echelle[n] ? [e.echelle[n]] : []))].map(m => `<option${e.echelle[n] === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`).join('')}
   <p class="small"><button type="button" class="lien" data-autremot data-cle="echelle">✏️ ajouter un mot à ma liste</button></p></section>`;
}
/* ---------- S7-S9 : ajustements, analyse, AFL ---------- */
/* v2.1 : « La prochaine fois, je… ». En projet (S7-S9), le choix modifie les paramètres du projet (annulable). */
function exoCourant(at){const s = sea(EL(), SEANCE);s.exos = s.exos || {};return s.exos[at] = s.exos[at] || {}}
function avisDe(at){const x = exoCourant(at);x.avis = x.avis || {par:autre() ? autre().nom : '', signes:[], conseil:''};if(autre())x.avis.par = autre().nom;return x.avis}
function majOk(at){const x = exoCourant(at), p = prevuDe(EL(), SEANCE, at);if(x.next && x.next.c)x.next.ok = choixCoherent(p ? sensSuite(p.mob, x) : null, x.next.c)}
function choisirSuite(at, v){
  const e = EL(), s = sea(e, SEANCE);s.exos = s.exos || {};const x = s.exos[at] = s.exos[at] || {};
  const nx = x.next = x.next || {}, pr = e.projet, px = +SEANCE.slice(1) >= SEANCE_PROJET && pr && pr.exos ? pr.exos.find(z => z.at === at) : null;
  if(px && nx.avant){Object.assign(px, nx.avant);delete nx.avant;const i = e.ajust.map(z => z.S + z.at).lastIndexOf(SEANCE + at);if(i >= 0)e.ajust.splice(i, 1)}
  nx.c = nx.c === v ? '' : v;majOk(at);
  if(px && nx.c){
    const m = MOBILES[pr.mob] || {}, b = (k, d) => Math.min(m[k][1], Math.max(m[k][0], px[k] + d));nx.avant = Object.assign({}, px);
    if(nx.c === 'serie')px.series = b('series', 1);
    if(nx.c === 'reps')px.reps = b('reps', 2);
    if(nx.c === 'chargeP' || nx.c === 'chargeM'){const c = m.couples, i = Math.min(c.length - 1, Math.max(0, coupleIdx(pr.mob, px.pct) + (nx.c === 'chargeP' ? 1 : -1)));px.pct = c[i][0];if(!atelier(at).temps)px.reps = c[i][1]}
    e.ajust = e.ajust || [];e.ajust.push({S:SEANCE, at, txt:(NEXT_Q.find(q => q[0] === nx.c) || [])[1], pourquoi:nx.pq || '', date:jour()});
  }
  sauver();rendre();
}
function carteAjustements(){
  const e = EL(), pr = e.projet, s = sea(e, SEANCE), ex = s.exos || {};
  const l = pr.exos.filter(x => ex[x.at] && ex[x.at].coh);
  if(!l.length)return `<section class="carte info"><h3>Pour la prochaine séance</h3><p class="small">Note tes ressentis : l'appli te proposera un ajustement pour chaque exercice.</p></section>`;
  s.ajust = s.ajust || {};
  return `<section class="carte act"><h3>Pour la prochaine séance</h3><p class="small muted">L'appli propose, tu décides et tu justifies en une phrase (c'est noté en analyse).</p>${l.map(x => {
    const a = atelier(x.at), coh = ex[x.at].coh, prop = ajuster(pr.mob, x, coh.sens), d = s.ajust[x.at];
    return `<div class="ex${d ? ' fait' : ''}"><header><b>${esc(a.nom)}</b></header><p class="small">${coh.ok ? '✅' : '⚠️'} ${esc(coh.msg)}</p><p><b>Proposition :</b> ${esc(prop.txt)}</p>
     ${d ? `<p class="small">✓ ${d.choix === 'ok' ? 'Accepté' : 'Gardé tel quel'}${d.pourquoi ? ' : « ' + esc(d.pourquoi) + ' »' : ''} <button type="button" class="lien" data-annuler-aj="${x.at}">changer</button></p>`
      : `<label class="ch">Pourquoi ? (une phrase)</label><input type="text" id="pq-${x.at}" maxlength="160" placeholder="ex. ça ne brûlait qu'à la dernière série"><div class="rangee" style="margin-top:8px"><button type="button" class="bt ok mini" data-aj="${x.at}" data-choix="ok">J'accepte</button><button type="button" class="bt mini" data-aj="${x.at}" data-choix="garde">Je garde</button></div>`}</div>`}).join('')}</section>`;
}
function carteAnalyse(){
  const s = sea(EL(), SEANCE);
  return `<section class="carte act"><h3>Mon analyse</h3><p class="small">En 2 phrases : ce qui était conforme à ton mobile, ce que tu changerais.</p><textarea data-texte="analyse">${esc(s.analyse || '')}</textarea></section>`;
}
function carteAfl(){
  const e = EL(), verrou = e.seances.S9 && Object.keys(e.seances.S9).length, rep = EVAL.repartitions.find(r => r[0] === e.afl.rep);
  if(rep && !OUVERT.has('afl'))return `<section class="carte"><button type="button" class="resume" data-ouvrir="afl"><span>🎯</span><span><b>Mon évaluation :</b> ${esc(rep[1])}<br><small>AFL2 : mes analyses · AFL3 : mon coaching (S4 à S7)</small></span><span class="small">✎</span></button></section>`;
  return `<section class="carte act"><h3>Mon évaluation AFL2 et AFL3</h3><p class="small">Elle commence en S4 : tes analyses de fin d'exercice comptent en AFL2, ton coaching du partenaire en AFL3. Choisis ta répartition des 8 points ; ${verrou ? '<b>verrouillée depuis la S8</b>' : 'elle se verrouille quand tu commences la S8'}.</p>
   <div class="choix2">${EVAL.repartitions.map(([k, t]) => `<button type="button" class="${e.afl.rep === k ? 'ici' : ''}" data-afl="${k}"${verrou ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>
   <p class="small muted">Rôle AFL3 : ${esc(EVAL.roles[0][1])} pour tous. ${esc(EVAL.roles[0][2])}</p>${rep ? `<button type="button" class="lien" data-replier="afl">Replier</button>` : ''}</section>`;
}

/* ================== Vue : charges ================== */
function vueCharges(){
  const e = EL(), ats = ATELIERS.filter(a => a.menu), nb = ats.filter(a => e.rm[a.id]).length;
  return `<h2>Mes charges max · ${esc(prenom(e.nom))}</h2><p class="retour ${nb >= OBJ_TESTS[0] ? 'ok' : 'non'}"><b>${nb} / ${ats.length}</b> charges max · objectif ${OBJ_TESTS[0]} à ${OBJ_TESTS[1]} à la fin de la S3. Un atelier sans charge max ne peut pas entrer dans ton projet.</p>
   <section class="carte"><p class="small">${rmVerrou(e) ? '🔒 <b>Évaluation en cours (S9)</b> : les charges max ne bougent plus.' : 'Tu as progressé ? Touche <b>Modifier</b> avec une série réussie proprement (3 à 10 répétitions). L\'ancienne valeur reste dans l\'historique.'}</p><p class="small">ℹ️ <b>Charge max estimée</b> : ce n'est pas le poids que tu peux soulever une fois, c'est une estimation (± 10 %) calculée à partir de ta meilleure série de 3 à 10 répétitions. Elle sert à calculer tes charges. <b>Ne la vérifie jamais.</b></p><table class="tb"><tr><th>Atelier</th><th>Charge max estimée</th><th></th></tr>${ats.map(a => {const r = e.rm[a.id], h = r && r.hist && r.hist.length ? r.hist : null;return `<tr><td>${esc(a.nom)} <span class="small muted">${esc(a.groupe)}</span>${imgAtelier(a.id) ? `<br><img class="ch-vign" src="${imgAtelier(a.id)}" alt="" loading="lazy">` : ''}</td><td>${r ? `${h ? `<span class="small muted">${h.map(x => fmtKg(x.cm)).join(' → ')} →</span> ` : ''}<b>${fmtKg(r.cm)}</b>${h && r.cm > h[0].cm ? ` <b class="okc">+${Math.round(100 * (r.cm / h[0].cm - 1))} %</b>` : ''}<br><span class="small muted">${esc(MODE_RM[r.mode] || r.mode)} · ${esc(r.date)}</span>` : '—'}</td><td><button type="button" class="bt mini" data-calc="${a.id}"${r ? '' : ' disabled'}>%</button> <button type="button" class="bt mini" data-direct="${a.id}"${rmVerrou(e) ? ' disabled' : ''}>${r ? 'Modifier' : '✏️ Saisir'}</button></td></tr>`}).join('')}</table></section>
   <section class="carte info calc-pub"><h3>🧮 Calculette</h3><p class="small">① Ta charge max → la charge à mettre pour chaque pourcentage, disques compris.<br>② Une série (tant de kilos × tant de répétitions) → ta charge max.</p><button type="button" class="bt act pleine" data-act="calcLibre">Ouvrir la calculette</button></section>`;
}
function tableauCharges(sup, cm){
  return `<table class="tb"><tr><th>%</th><th>Charge réelle</th><th>Mobile</th></tr>${[30,40,50,55,60,65,70,75,80].map(p => {const r = chargeReelle(sup, cm * p / 100), mobs = MOBILES_ORDRE.filter(k => p >= MOBILES[k].pct[0] && p <= MOBILES[k].pct[1]);
    return `<tr><td><b>${p} %</b></td><td>${r ? `<b>${fmtKg(r.charge)}</b><br><span class="small muted">${esc(r.compo)}</span>` : '—'}</td><td>${mobs.map(k => `<span style="color:${MOBILES[k].coul};font-weight:700">${MOBILES[k].court}</span>`).join(' ')}</td></tr>`}).join('')}</table>`;
}
function calcAtelier(at){calcLibre(at)}
/* v3.7 : calculette modernisée : 2 modes (charge max → %, série → charge max), atelier ou matériel, curseur de % */
let CALC = {mode:'pct', at:'', sup:'hreg', cm:'', ch:'', rp:8, p:60};
function calcLibre(at){
  const e = B ? EL() : null;
  if(at){CALC.at = at;CALC.sup = atelier(at).support;const cm = e && cmDe(e, at);if(cm)CALC.cm = cm;CALC.mode = 'pct'}
  fenetre(`<div class="calc"><div class="rangee" style="justify-content:space-between"><h3>🧮 Calculette</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div><div id="calcZ"></div></div>`);
  rendreCalc();
}
function rendreCalc(){
  const z = $('calcZ');if(!z)return;const e = B ? EL() : null;
  const ats = ATELIERS.filter(a => a.menu && a.type === 'charge');
  const supOk = Object.entries(SUPPORTS).filter(([k, s]) => s.disques || s.fixes);
  const onglets = `<div class="calc-seg"><button type="button" class="${CALC.mode === 'pct' ? 'ici' : ''}" data-calcmode="pct">① J'ai ma charge max</button><button type="button" class="${CALC.mode === 'cm' ? 'ici' : ''}" data-calcmode="cm">② Trouver ma charge max</button></div>`;
  const choixAt = `<label class="ch">Atelier</label><select id="cAt"><option value="">— Matériel libre —</option>${ats.map(a => `<option value="${a.id}"${CALC.at === a.id ? ' selected' : ''}>${esc(a.nom)}${e && e.rm[a.id] ? ' · ' + fmtKg(e.rm[a.id].cm) : ''}</option>`).join('')}</select>
    ${CALC.at ? `<p class="small muted">${esc(SUPPORTS[CALC.sup].nom)}${SUPPORTS[CALC.sup].unite ? ' · ' + esc(SUPPORTS[CALC.sup].unite) : ''}</p>` : `<label class="ch">Matériel</label><select id="cSup">${supOk.map(([k, s]) => `<option value="${k}"${CALC.sup === k ? ' selected' : ''}>${esc(s.nom)}</option>`).join('')}</select>`}`;
  let corps = '';
  if(CALC.mode === 'cm'){
    const ch = num(CALC.ch), rp = +CALC.rp, cm = ch && brzycki(ch, rp);
    corps = `<div class="calc-serie"><div><label class="ch">Charge soulevée (kg)</label><input class="calc-gros" type="number" inputmode="decimal" id="cCh" value="${CALC.ch}" placeholder="ex. 20"></div>
      <div><label class="ch">Répétitions réussies</label><div class="calc-pas"><button type="button" data-crp="-1">−</button><b>${rp}</b><button type="button" data-crp="1">+</button></div></div></div>
      <div class="calc-res">${cm ? `<span>Ta charge max estimée (± 10 %)</span><b>${fmtKg(cm)}</b><small>${fmtKg(ch)} × ${rp} rép. → ${fmtKg(ch)} × 36 ÷ (37 − ${rp})</small><button type="button" class="bt act" data-act="calcUtiliser" data-cm="${cm}">Voir mes charges à chaque % →</button>` : `<span>Entre une charge et 3 à 10 répétitions</span>`}</div>
      <p class="small muted">Plus la série est courte (3 à 6 répétitions), plus l'estimation est juste. Au-delà de 10, elle n'est plus fiable.</p>`;
  } else {
    const cm = num(CALC.cm), p = +CALC.p, r = cm > 0 ? chargeReelle(CALC.sup, cm * p / 100) : null, mob = MOBILES_ORDRE.filter(k => p >= MOBILES[k].pct[0] && p <= MOBILES[k].pct[1]);
    corps = `<label class="ch">Ma charge max estimée (kg)</label><input class="calc-gros" type="number" inputmode="decimal" id="cCm" value="${CALC.cm}" placeholder="ex. 30">
      ${cm > 0 ? `<div class="calc-res" id="cRes"><span>À <b>${p} %</b>${mob.length ? ' · ' + mob.map(k => `<i style="background:${MOBILES[k].coul}">${MOBILES[k].nom}</i>`).join(' ') : ''}</span><b>${r ? fmtKg(r.charge) : '—'}</b>${r ? `<small>${esc(r.compo)}</small>` : ''}</div>
      <input type="range" id="cP" min="30" max="85" step="5" value="${p}" class="calc-curseur" aria-label="Pourcentage">
      <div class="calc-grille">${[40,50,55,60,65,70,75,80].map(q => {const x = chargeReelle(CALC.sup, cm * q / 100), mb = MOBILES_ORDRE.filter(k => q >= MOBILES[k].pct[0] && q <= MOBILES[k].pct[1]);
        return `<button type="button" class="${q === p ? 'ici' : ''}" data-cp="${q}" style="--mc:${mb.length ? MOBILES[mb[0]].coul : '#94a3b8'}"><span>${q} %</span><b>${x ? fmtKg(x.charge) : '—'}</b><small>${mb.map(k => MOBILES[k].court).join(' · ')}</small></button>`}).join('')}</div>` : '<div class="calc-res"><span>Tape ta charge max, ou calcule-la avec ②</span></div>'}`;
  }
  z.innerHTML = onglets + choixAt + corps;
}
function majCalcLibre(){rendreCalc()}

/* ================== Vue : projet ================== */
function controleProjet(pr){
  const m = MOBILES[pr.mob], l = [], zones = new Set(pr.exos.map(x => atelier(x.at).zone));
  const n = pr.exos.length;
  if(n < 3 || n > 6)l.push([false, `Projet : 3 à 6 exercices (tu en as ${n}). À chaque séance (S7, S8), tu en fais 3.`]);else l.push([true, `${n} exercices : tu en fais 3 par séance. Le tirage de la S9 se fait parmi ceux réalisés en S7 et S8.`]);
  ['haut', 'bas'].forEach(z => {if(!zones.has(z))l.push([false, `Il manque un exercice ${z === 'haut' ? 'du haut du corps' : 'du bas du corps'} (développement harmonieux).`])});
  if(zones.has('haut') && zones.has('bas'))l.push([true, 'Haut et bas du corps : équilibré.']);
  pr.exos.forEach(x => {const a = atelier(x.at);if(a.plio){if(pr.mob !== 'puiss')l.push([false, `${a.nom} : réservé au mobile Puissance. Remplace-le.`])}else if(!a.menu)l.push([false, `${a.nom} : n'est plus proposé (poids du corps, à l'échauffement). Remplace-le.`]);else if(pr.mob === 'puiss' && !a.puissance)l.push([false, `${a.nom} : ne se travaille pas en Puissance (geste lent ou dos chargé).`])});
  const d = dureeProjet(pr.mob, pr.exos.slice(0, 3));l.push([d <= 60, `Durée de 3 exercices en binôme : ${d} min ${d <= 60 ? '(tient dans la séance)' : '(trop long : enlève un exercice ou une série)'}.`]);
  pr.exos.forEach(x => {const a = atelier(x.at);if(a.places)l.push([true, `${a.nom} : ${a.places} binômes au maximum en même temps, prévois une variante.`]);
    if(a.type === 'charge' && !cmDe(EL(), x.at))l.push([false, `${a.nom} : pas de charge max (saisie directe dans Charges).`])});
  return l;
}
function vueProjet(){
  const e = EL(), pr = e.projet;
  if(!pr){const m = (e.choix && e.choix.mob) || null;
    if(+SEANCE.slice(1) < SEANCE_PROJET && !m)return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2><section class="carte"><p>Le projet commence en <b>S7</b> : tu choisiras alors ton mobile définitif, après avoir éprouvé les trois (S4 Tonification, S5 Volume, S6 Puissance).</p></section>${MOBILES_ORDRE.map(mobileHTML).join('')}`;
    return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2><section class="carte act"><p>${m ? `Ton mobile : <b>${MOBILES[m].nom}</b>. Touche-le pour construire ton projet (il devient définitif).` : 'Choisis ton mobile définitif :'}</p><div class="mob-choix">${MOBILES_ORDRE.map(k => {const bl = k === 'puiss' && !e.puissOk;return `<button type="button" class="${m === k ? 'ici' : ''}${bl ? ' bloque' : ''}" style="--mc:${MOBILES[k].coul}" data-nouveau-projet="${k}"><img src="${MOB_IMG[k]}" alt=""><span>${bl ? '🔒 ' : ''}${MOBILES[k].nom}</span></button>`}).join('')}</div>${!e.puissOk ? '<p class="small muted">🔒 Puissance : sur avis du professeur (niveau confirmé).</p>' : ''}</section>${MOBILES_ORDRE.map(mobileHTML).join('')}`}
  const m = MOBILES[pr.mob], ctrl = controleProjet(pr);
  const dispo = dispoPour(pr.mob).filter(a => !pr.exos.some(x => x.at === a.id));
  return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2>
   <div class="mob-bandeau"><img src="${MOB_IMG[pr.mob]}" alt=""><span>Mon mobile : ${esc(m.nom)} · ${esc(m.theme)}</span></div>
   <section class="carte"><p>Mobile : <b style="color:${m.coul}">${m.nom}</b> (${m.theme}) · ${m.pct[0]}-${m.pct[1]} % · ${m.series[0]}-${m.series[1]} séries · ${m.reps[0]}-${m.reps[1]} rép. · récup ${m.recup}</p><span class="small muted">· mobile définitif</span></section>
   ${pr.exos.map((x, i) => {const a = atelier(x.at);return `<div class="ex"><header><b>${i + 1}. ${esc(a.nom)}</b><button type="button" class="bt mini danger" data-retirer="${i}">Retirer</button></header><p class="small muted">${esc(a.groupe)} · ${a.zone}</p>
     <div class="rangee">${pasHTML(i, 'series', x.series, 'séries')}${a.temps || a.type === 'charge' ? '' : pasHTML(i, 'reps', x.reps, 'rép.')}</div>
     ${a.type === 'charge' ? `<div class="chips couples">${m.couples.map((c, k) => `<button type="button" class="${x.pct === c[0] && x.reps === c[1] ? 'ici' : ''}" data-couple="${i}" data-k="${k}">${k + 1}) ${coupleTxt(c)}</button>`).join('')}</div>${m.couples.some(c => x.pct === c[0] && x.reps === c[1]) ? '' : `<p class="small muted">Actuellement ${x.pct} % × ${x.reps} : choisis un couple.</p>`}` : ''}
     ${a.niveaux ? `<div class="chips">${a.niveaux.map((t, k) => `<button type="button" class="${x.niv === k ? 'ici' : ''}" data-pniv="${i}" data-k="${k}" title="${esc(t)}">Niv. ${k + 1}</button>`).join('')}</div>` : ''}</div>`}).join('')}
   <section class="carte"><label class="ch" for="ajEx">Ajouter un exercice</label><select id="ajEx"><option value="">—</option>${['haut', 'bas'].map(z => `<optgroup label="${z === 'haut' ? 'Haut du corps' : 'Bas du corps'}">${dispo.filter(a => a.zone === z).map(a => `<option value="${a.id}">${esc(a.nom)}</option>`).join('')}</optgroup>`).join('')}</select></section>
   <section class="carte ${ctrl.every(c => c[0]) ? 'info' : ''}"><h3>Vérification</h3>${ctrl.map(([ok, t]) => `<p class="small">${ok ? '✅' : '⚠️'} ${esc(t)}</p>`).join('')}</section>
   ${e.ajust.length ? `<section class="carte"><h3>Mes ajustements</h3>${e.ajust.map(a => `<p class="small"><b>${a.S} · ${esc(atelier(a.at).nom)}</b> : ${esc(a.txt)}${a.pourquoi ? ' · « ' + esc(a.pourquoi) + ' »' : ''}</p>`).join('')}</section>` : ''}`;
}
function pasHTML(i, k, v, u){return `<span class="rangee" style="gap:4px"><button type="button" class="bt mini" data-pas="${i}" data-k="${k}" data-d="-1">−</button><b style="min-width:64px;text-align:center">${v} ${u}</b><button type="button" class="bt mini" data-pas="${i}" data-k="${k}" data-d="1">+</button></span>`}
function bornes(mob, k){const m = MOBILES[mob];return k === 'pct' ? m.pct : k === 'series' ? m.series : m.reps}

/* ================== Vue : carnet ================== */
function resumeBilan(b){return ['obj', 'cons', 'vecu', 'reg', 'sur', 'role'].filter(k => b[k]).map(k => `${{obj:'objectif', cons:'consignes', vecu:'effort', reg:'prochaine fois', sur:'sur', role:'rôle'}[k]} : ${esc(bilanLib(k, b[k]))}`).join(' · ') + (b.reussi ? ` · réussi : « ${esc(b.reussi)} »` : '') + (b.ameliorer ? ` · à améliorer : « ${esc(b.ameliorer)} »` : '')}
function carteHistoBilans(e){
  const l = SEANCES_IDS.filter(S => +S.slice(1) >= SEANCE_MOBILE[0] && (e.seances[S] || {}).bilan);
  if(!l.length)return '';
  return `<section class="carte"><h3>📝 Mes bilans</h3><div class="tb-defil"><table class="tb"><tr><th>Séance</th><th>Objectif</th><th>Consignes</th><th>Effort</th><th>Prochaine fois</th><th>Rôle</th></tr>
   ${l.map(S => {const b = e.seances[S].bilan;return `<tr><td><b>${S}</b></td><td>${esc(bilanLib('obj', b.obj))}</td><td>${esc(bilanLib('cons', b.cons))}</td><td>${esc(bilanLib('vecu', b.vecu))}</td><td>${esc(bilanLib('reg', b.reg))}${b.sur ? ' · ' + esc(bilanLib('sur', b.sur)) : ''}</td><td>${esc(bilanLib('role', b.role))}</td></tr>`}).join('')}</table></div>
   ${l.filter(S => e.seances[S].bilan.ameliorer).map(S => `<p class="small">${S} · à améliorer : « ${esc(e.seances[S].bilan.ameliorer)} »</p>`).join('')}</section>`;
}
function vueCarnet(){
  const e = EL();
  return `<h2>Carnet · ${esc(e.nom)}</h2>
   ${e.situe && suggestion(e.situe) ? `<p>Je me situe : mobile suggéré <b>${MOBILES[suggestion(e.situe)].nom}</b>.</p>` : ''}
   ${e.choix && e.choix.mob ? `<div class="mob-bandeau"><img src="${MOB_IMG[e.choix.mob]}" alt=""><span>Mon mobile : ${esc(MOBILES[e.choix.mob].nom)}</span></div><p>Mobile choisi : <b>${MOBILES[e.choix.mob].nom}</b>${e.choix.pourquoi ? ' · « ' + esc(e.choix.pourquoi) + ' »' : ''}</p>` : ''}
   ${SEANCES_IDS.map(S => {const s = e.seances[S];if(!s || !Object.keys(s).length)return '';const ex = Object.entries(s.exos || {});
     return `<section class="carte"><h3>${S} · ${esc(seanceById(S).titre)}</h3>${absent(e, S) ? '<p class="retour non">Absent(e) à cette séance.</p>' : ''}${s.forme ? `<p class="small">Forme : ${FORME[s.forme - 1][1]} ${FORME[s.forme - 1][2]}</p>` : ''}${s.ech && s.ech.pouls ? `<p class="small">Pouls d'échauffement : ${s.ech.pouls}</p>` : ''}
      ${ex.length ? `<table class="tb"><tr><th>Exercice</th><th>Réalisé</th><th>Ressenti</th></tr>${ex.map(([at, x]) => `<tr><td>${esc(atelier(at).nom)}</td><td>${x.real ? `${x.real.series}×${x.real.reps}${x.real.charge ? ' · ' + fmtKg(x.real.charge) : ''}` : '—'}</td><td>${x.ressenti && x.ressenti.note ? `${x.ressenti.note}${x.ressenti.mot ? ' · ' + esc(x.ressenti.mot) : ''} ${x.coh ? (x.coh.ok ? '✅' : '⚠️') : ''}` : '—'}</td></tr>`).join('')}</table>` : ''}
      ${s.analyse ? `<p class="small"><b>Analyse :</b> ${esc(s.analyse)}</p>` : ''}${s.bilan ? `<p class="small"><b>Bilan :</b> ${resumeBilan(s.bilan)}</p>` : ''}</section>`}).join('')}
   ${carteHistoBilans(e)}
   <section class="carte"><h3>Charges de référence</h3>${Object.keys(e.rm).length ? Object.entries(e.rm).map(([at, r]) => `<p class="small">${esc(atelier(at).nom)} : ${r.dix ? `10 RM <b>${fmtKg(r.dix)}</b> · ` : ''}charge max estimée <b>${fmtKg(r.cm)}</b> (${MODE_RM[r.mode] || r.mode}, ${esc(r.date)})</p>`).join('') : '<p class="small muted">Pas encore de test.</p>'}
    ${ATELIERS_TEST.some(id => !e.rm[id]) ? `<p class="small">⏳ À rattraper : ${ATELIERS_TEST.filter(id => !e.rm[id]).map(id => esc(atelier(id).nom)).join(', ')}.</p>` : ''}</section>`;
}

/* ================== Vue : envoyer ================== */
function vueEnvoyer(){
  const der = (B.envois || []).slice(-1)[0], n = +SEANCE.slice(1);
  const manque = n >= SEANCE_MOBILE[0] ? B.e.filter(x => !absent(x) && x.seances[SEANCE] && Object.keys(x.seances[SEANCE]).length && !bilanComplet(x, SEANCE)) : [];
  return `<h2>Envoyer le carnet</h2>${manque.length ? `<p class="retour non">Il manque le bilan de ${manque.map(x => esc(prenom(x.nom))).join(' et de ')} en ${SEANCE} (30 secondes) : onglet Séance, dernière séquence.</p>` : ''}
   <section class="carte act"><h3>📲 QR de la séance pour le prof</h3><p>En fin de séance, montrez ce QR à la tablette du professeur : il range la séance de chacun de vous dans sa fiche.</p>
    <div class="puces">${SEANCES_IDS.map(S => `<button type="button" class="${S === SEANCE ? 'ici' : ''}${B.e.some(x => Object.keys(x.seances[S] || {}).length) ? ' fait' : ''}" data-qrseance="${S}">${S}</button>`).join('')}</div>
    <button type="button" class="bt act pleine" data-qrseance="${SEANCE}">📲 Montrer le QR de la ${SEANCE}</button>
    <p class="small muted">Une autre séance à rattraper ? Touche son numéro.</p></section>
   <section class="carte"><h3>📤 Secours : fichier pour le Nuage</h3><p>En fin de séance : télécharge le fichier du carnet, puis dépose-le dans le dossier Nuage donné par le professeur.</p>
    <button type="button" class="bt act pleine" data-act="exporter">Télécharger le carnet</button>${CLASSES[B.classe] && CLASSES[B.classe].u ? `<a class="bt pleine" style="margin-top:8px" href="${esc(CLASSES[B.classe].u)}" target="_blank" rel="noopener">☁️ Ouvrir le dépôt Nuage de la classe</a>` : ''}${navigator.share ? `<button type="button" class="bt pleine" style="margin-top:8px" data-act="partager">Partager le fichier</button>` : ''}
    <p class="small muted">${der ? 'Dernier envoi : ' + esc(der) : 'Pas encore envoyé.'}</p></section>
   <section class="carte"><h3>Mots et défi</h3><p class="small">S1, S2 et S3 : le QR pour le nuage de mots de la classe et le défi.</p><div class="rangee">${['S1', 'S2', 'S3'].map(S => `<button type="button" class="bt mini" data-qr-s="${S}">QR ${S}</button>`).join('')}</div></section>
   <section class="carte"><h3>Ce téléphone</h3><p class="small">Les noms restent sur ce téléphone, dans le QR lu par la tablette du professeur et dans le fichier envoyé au professeur. Rien n'est envoyé ailleurs.</p><div class="rangee"><button type="button" class="bt mini" data-act="fermerCarnet">Fermer le carnet</button><button type="button" class="bt mini danger" data-act="supprimer">Supprimer ce carnet</button></div></section>`;
}
function fichierCarnet(){
  const o = JSON.parse(JSON.stringify(B));delete o.code;o.exporte = new Date().toISOString();o.version = MUSCU_VERSION;
  const nom = `muscu_${(B.classe || 'classe').replace(/[^\w-]+/g, '')}_${B.e.map(x => initiales(x.nom)).join('-')}_${jour()}.json`;
  return {nom, blob:new Blob([JSON.stringify(o, null, 1)], {type:'application/json'})};
}
function exporter(){
  const f = fichierCarnet(), a = document.createElement('a');a.href = URL.createObjectURL(f.blob);a.download = f.nom;document.body.appendChild(a);a.click();setTimeout(() => {URL.revokeObjectURL(a.href);a.remove()}, 1000);
  if(!DEMO){B.envois = (B.envois || []).concat(new Date().toLocaleString('fr-FR'));sauver()}toast('Fichier téléchargé : dépose-le dans le Nuage');rendre();
}
async function partager(){
  const f = fichierCarnet(), file = new File([f.blob], f.nom, {type:'application/json'});
  try{await navigator.share({files:[file], title:'Carnet de musculation'});if(!DEMO){B.envois = (B.envois || []).concat(new Date().toLocaleString('fr-FR'));sauver()}rendre()}catch(e){if(e.name !== 'AbortError')exporter()}
}

/* ================== v6.0 : récupérer un carnet (fichier JSON exporté) ================== */
let IMPORT = null;
const numVersion = v => String(v || '').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
const cmpVersion = (a, b) => {const x = numVersion(a), y = numVersion(b);for(let i = 0;i < 3;i++){if((x[i] || 0) !== (y[i] || 0))return (x[i] || 0) - (y[i] || 0)}return 0};
function choisirImport(){
  const inp = document.createElement('input');inp.type = 'file';inp.accept = '.json,application/json';
  inp.onchange = () => {const f = inp.files && inp.files[0];if(!f)return;if(f.size > 3e6)return toast('Fichier trop gros pour un carnet.');
    const r = new FileReader();r.onload = () => verifierImport(String(r.result));r.onerror = () => toast('Lecture du fichier impossible.');r.readAsText(f)};
  inp.click();
}
function verifierImport(txt){
  let o = null;try{o = JSON.parse(txt)}catch(e){return fenetre(`<h3>Fichier illisible</h3><p>Ce fichier n'est pas un carnet de musculation (format JSON abîmé).</p><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`)}
  const err = [];
  if(!o || o.app !== 'musculation-eleves')err.push('Ce fichier ne vient pas de l\'appli Musculation élève.');
  else{if(typeof o.id !== 'string' || !o.id)err.push('Identifiant du carnet manquant.');
    if(!Array.isArray(o.e) || !o.e.length || o.e.length > 3 || o.e.some(x => !x || typeof x.nom !== 'string' || typeof x.rm !== 'object' || typeof x.seances !== 'object'))err.push('Liste des élèves abîmée.');
    if(o.version && cmpVersion(o.version, MUSCU_VERSION) > 0)err.push(`Fichier fait avec une version plus récente (${esc(o.version)}) : mets d'abord l'appli à jour.`)}
  if(err.length)return fenetre(`<h3>Import impossible</h3><ul class="ats">${err.map(t => `<li>${t}</li>`).join('')}</ul><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`);
  IMPORT = o;const deja = CARNETS[o.id], nbRm = o.e.reduce((a, x) => a + Object.keys(x.rm || {}).length, 0);
  fenetre(`<h3>📥 Récupérer ce carnet ?</h3><p><b>${esc(o.e.map(x => x.nom).join(' & '))}</b>${o.classe ? ' · ' + esc(o.classe) : ''}</p>
   <p class="small">Exporté le ${o.exporte ? esc(new Date(o.exporte).toLocaleString('fr-FR')) : '?'} · version ${esc(o.version || 'ancienne')} · ${nbRm} charge(s) de référence.</p>
   ${o.version && cmpVersion(o.version, MUSCU_VERSION) < 0 ? `<p class="small muted">Fichier d'une version plus ancienne : il reste lisible, rien n'est perdu.</p>` : ''}
   ${deja ? `<p class="retour non">⚠️ Ce carnet existe déjà sur ce téléphone (modifié le ${esc(new Date(deja.maj || 0).toLocaleString('fr-FR'))}). Il sera <b>remplacé</b> par le fichier ; l'actuel est gardé en copie de sécurité.</p>` : ''}
   <p class="small">Choisissez un code secret du binôme (4 chiffres) pour ce téléphone :</p><input type="password" inputmode="numeric" maxlength="4" id="iCode" class="code" autocomplete="off"><p class="small" id="iErr" style="color:var(--alerte);font-weight:700;min-height:1.3em"></p>
   <div class="rangee"><button type="button" class="bt act" data-act="valImport">${deja ? 'Remplacer' : 'Récupérer'}</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
async function validerImport(){
  const o = IMPORT, code = ($('iCode') || {}).value || '';if(!o)return;
  if(!/^\d{4}$/.test(code.trim())){$('iErr').textContent = 'Le code secret : 4 chiffres.';return}
  if(CARNETS[o.id]){const sv = lire('mue-sauvegardes', []);sv.push({date:new Date().toISOString(), carnet:CARNETS[o.id]});ecrire('mue-sauvegardes', sv.slice(-5))}
  const c = JSON.parse(JSON.stringify(o));delete c.exporte;c.importe = new Date().toISOString();c.maj = Date.now();c.code = await empreinte(c.id, code.trim());
  c.listes = c.listes || {};c.envois = c.envois || [];c.motsClasse = c.motsClasse || [];c.e.forEach(x => {x.tests = x.tests || {};x.niv = x.niv || {};x.echelle = x.echelle || {};x.afl = x.afl || {rep:'', role:''};x.ajust = x.ajust || []});
  CARNETS[c.id] = c;if(!ecrire(CLE, CARNETS))return;IMPORT = null;fermerFen();rendre();toast('Carnet récupéré : ouvre-le avec votre code.');
}

/* ================== Démo ================== */
function binomeDemo(){
  const e1 = nouvelEleve('Léa MARTIN'), e2 = nouvelEleve('Hugo BERNARD');
  e1.situe = {freq:'2', bien:'Oui', ecran:'2 à 4 h', envie:['galbe', 'tonus']};e2.situe = {freq:'4', bien:'Oui', ecran:'Moins de 2 h', envie:['sport']};
  const rm = (e, l) => l.forEach(([at, cm]) => e.rm[at] = {cm, charge:Math.round(cm * .75), reps:10, date:'2026-11-17', mode:'test'});
  rm(e1, [['dch', 14], ['dc', 24], ['rowh', 12], ['curlb', 16], ['extri', 14], ['dm', 8], ['fentes', 10], ['squath', 16], ['hip', 30], ['rowb', 20]]);
  e1.rm.dch.hist = [{cm:12, date:'2026-11-10', mode:'test'}];   // v2.2 : historique de démonstration
  rm(e2, [['dch', 22], ['dc', 40], ['rowh', 18], ['curlb', 26], ['extri', 22], ['dm', 13], ['fentes', 16], ['squath', 24], ['sdtj', 20]]);
  e1.tests.dc = {series:[{charge:12, valides:10, norep:0}, {charge:16, valides:10, norep:0}, {charge:20, valides:7, norep:1}], ressentis:{premiere:{note:4, mot:'léger'}, derniere:{note:8, mot:'ça brûle'}}};
  e1.seances.S1 = {ech:{pouls:148, debut:{note:3, mot:'chaud'}, fin:{note:5, mot:'essoufflé'}}, circuit:Object.fromEntries(CIRCUIT_S1.slice(0, 10).map(x => [x, true]))};
  e1.seances.S4 = {forme:4, exos:{dch:{real:{series:3, reps:15, charge:7}, ressenti:{note:6, mot:'ça picote', sens:'locale'}}, rowh:{real:{series:3, reps:15, charge:7}, ressenti:{note:4, mot:'léger', sens:'rien'}}}};
  e1.seances.S5 = {forme:3, exos:{dch:{real:{series:4, reps:10, charge:10}, ressenti:{note:8, mot:'ça gonfle', sens:'brulure'}}, squath:{real:{series:4, reps:10, charge:11}, ressenti:{note:8, mot:'ça brûle', sens:'brulure'}}}};
  e1.seances.S6 = {forme:4, exos:{hip:{real:{series:4, reps:5, charge:14}, ressenti:{note:6, mot:'compact', sens:'tension'}}}};
  [['S4', 'tonif'], ['S5', 'volume'], ['S6', 'puiss']].forEach(([S, m]) => Object.values(e1.seances[S].exos).forEach(x => x.coh = coherence(m, x.ressenti.note, x.ressenti.sens)));
  const H = 'Hugo BERNARD';   // v2.1 : analyses et coaching de démonstration
  Object.assign(e1.seances.S4.exos.dch, {rir:'34', next:{c:'garde', ok:true}, avis:{par:H, cle:'0', signes:[], conseil:'Ralentis la descente'}});
  Object.assign(e1.seances.S4.exos.rowh, {rir:'5', next:{c:'reps', ok:true}, avis:{par:H, cle:'1', signes:[], conseil:'Tu peux monter la charge'}});
  Object.assign(e1.seances.S5.exos.dch, {aide:'1', rir:'0', next:{c:'chargeP', ok:false, pq:''}, avis:{par:H, cle:'0', signes:["Dos qui s'arrondit ou se creuse"], conseil:''}});
  Object.assign(e1.seances.S6.exos.hip, {rir:'34', next:{c:'garde', ok:true}, avis:{par:H, cle:'1', signes:[], propres:5, conseil:'Plus vite à la montée', obj:{k:'reps', v:12}}});
  e1.afl = {rep:'4/4', role:'coach'};
  e1.choix = {mob:'volume', pourquoi:"C'est en Volume que j'ai senti mes muscles gonfler, et c'est ce que je cherche."};
  e1.echelle = {3:'léger', 5:'chaud', 6:'ça picote', 7:'ça brûle', 8:'ça gonfle', 10:'je bloque'};
  e1.projet = {mob:'volume', exos:[{at:'dch', series:4, reps:10, pct:70}, {at:'rowh', series:4, reps:10, pct:70}, {at:'squath', series:4, reps:10, pct:70}, {at:'hip', series:4, reps:10, pct:70}]};
  return {id:'demo0000', v:1, app:'musculation-eleves', classe:'DÉMO', cree:jour(), equipe:'B', listes:{}, motsClasse:['intense', 'lourd'], envois:[], e:[e1, e2]};
}

/* ================== Événements ================== */
document.addEventListener('toggle', ev => {const d = ev.target;if(d.dataset && d.dataset.wdet){d.open ? OUV_ECH.add(d.dataset.wdet) : OUV_ECH.delete(d.dataset.wdet)}}, true);
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,[data-fond]');if(!t)return;
  if(t.matches('[data-fond]')){if(ev.target === t)fermerFen();return}
  const d = t.dataset;ANCRE = t;
  if(d.onglet){ONGLET = d.onglet;rendre();window.scrollTo(0, 0);return}
  if(d.qui != null){P = +d.qui;rendre();return}
  if(d.seance){if(t.closest('.se-grille'))fermerFen();SEANCE = d.seance;rendre();window.scrollTo(0, 0);return}
  if(d.act === 'seancesListe'){ouvrirSeances();return}
  if(d.carnet){ouvrir(d.carnet);return}
  if(d.selclasse){SEL = {classe:d.selclasse, noms:[]};rendre();return}
  if(d.selnom){const i = SEL.noms.indexOf(d.selnom);i < 0 ? (SEL.noms.length < 3 ? SEL.noms.push(d.selnom) : toast('3 élèves au maximum.')) : SEL.noms.splice(i, 1);rendre();return}
  if(d.note && d.cle){const o = d.cle === 'echelle' ? null : objetCle(d.cle, true);if(o){o.note = +d.note;apresRessenti(d.cle)}T ? rendreTest() : rendre();return}
  if(d.mot != null && d.cle){const o = objetCle(d.cle, true);o.mot = o.mot === d.mot ? '' : d.mot;apresRessenti(d.cle);T ? rendreTest() : rendre();return}
  if(t.hasAttribute('data-autremot')){const m = (prompt('Ton mot :') || '').trim().slice(0, 30);if(!m)return;B.motsClasse = [...new Set((B.motsClasse || []).concat(m))];
    if(d.cle !== 'echelle'){const o = objetCle(d.cle, true);o.mot = m;apresRessenti(d.cle)}else sauver();T ? rendreTest() : rendre();return}
  if(d.sens && d.cle){const o = objetCle(d.cle, true);o.sens = d.sens;apresRessenti(d.cle);rendre();return}
  if(d.forme){sea(EL(), SEANCE).forme = +d.forme;sauver();rendre();return}
  if(d.next && d.v){choisirSuite(d.next, d.v);return}
  if(d.rir && d.v){const x = exoCourant(d.rir);x.rir = x.rir === d.v ? '' : d.v;majOk(d.rir);sauver();rendre();return}
  if(d.aide && d.v){const x = exoCourant(d.aide);x.aide = x.aide === d.v ? '' : d.v;sauver();rendre();return}
  if(d.clevu){const v = avisDe(d.clevu);v.cle = v.cle === d.v ? '' : d.v;sauver();rendre();return}
  if(d.propres){const v = avisDe(d.propres), p = prevuDe(EL(), SEANCE, d.propres), mx = p ? p.reps : 30;v.propres = Math.max(0, Math.min(mx, (v.propres != null ? v.propres : mx) + (v.propres != null ? +d.d : 0)));sauver();rendre();return}
  if(d.objk){const v = avisDe(d.objk);v.obj = v.obj && v.obj.k === d.v ? null : {k:d.v, v:''};sauver();rendre();return}
  if(d.majrm){const e = EL(), x = exoCourant(d.majrm), p = prevuDe(e, SEANCE, d.majrm), sg = suggestionRM(e, d.majrm, x, p);if(sg){majRM(e, d.majrm, {cm:sg.est, charge:sg.charge, reps:x.real.reps, date:jour(), mode:'seance', S:SEANCE});x.rmMaj = sg.est;sauver();toast('Charge max : ' + fmtKg(sg.est))}rendre();return}
  if(d.nonrm){exoCourant(d.nonrm).rmNon = true;sauver();rendre();return}
  if(d.excle){sea(EL(), SEANCE).exCle = d.excle;sauver();rendre();return}
  if(d.ouvrir){OUVERT.add(d.ouvrir);rendre();return}
  if(d.replier){OUVERT.delete(d.replier);rendre();const z = $('ex-' + d.replier);if(z)z.scrollIntoView({block:'nearest'});return}
  if(d.vit){const s = sea(EL(), SEANCE);s.exos = s.exos || {};const x = s.exos[d.vit] = s.exos[d.vit] || {};x.vit = !x.vit;majOk(d.vit);sauver();rendre();return}
  if(d.circuit){const s = sea(EL(), 'S1');s.circuit = s.circuit || {};s.circuit[d.circuit] = !s.circuit[d.circuit];sauver();rendre();return}
  if(d.situe){const e = EL();e.situe = e.situe || {};if(d.multi){const l = e.situe[d.situe] = e.situe[d.situe] || [];const i = l.indexOf(d.v);i < 0 ? l.push(d.v) : l.splice(i, 1)}else e.situe[d.situe] = d.v;sauver();rendre();return}
  if(d.fiche){ouvrirFiche(d.fiche);return}
  if(d.chrono){lancerChrono(d.chrono);return}
  if(d.jour){const e = EL(), s = sea(e, SEANCE), j = jourDe(e, SEANCE).slice(), i = j.indexOf(d.jour);if(i >= 0)j.splice(i, 1);else{if(j.length >= 3)return toast('3 exercices : retire-en un d\'abord.');j.push(d.jour)}s.jour = j;sauver();rendre();return}
  if(d.tman){const e = EL(), l = e.tirageMan = e.tirageMan || [], i = l.indexOf(d.tman);i >= 0 ? l.splice(i, 1) : (l.length < 3 ? l.push(d.tman) : toast('3 exercices.'));rendre();return}
  if(d.calcmode){CALC.mode = d.calcmode;rendreCalc();return}
  if(d.crp){CALC.rp = Math.min(10, Math.max(3, +CALC.rp + +d.crp));rendreCalc();return}
  if(d.cp){CALC.p = +d.cp;rendreCalc();return}
  if(d.wc){const k = d.wc, on = (sea(EL(), SEANCE).ech || {}).wc, etait = !!(on && on.includes(k));
    {const x = sea(EL(), SEANCE);x.ech = x.ech || {};x.ech.wc = x.ech.wc || [];const i = x.ech.wc.indexOf(k);if(etait && i >= 0)x.ech.wc.splice(i, 1);else if(!etait && i < 0)x.ech.wc.push(k);
     if(k === 'P3' && !etait && !x.ech.wc.includes('gainage'))x.ech.wc.push('gainage')}
    sauver();rendre();return}
  if(d.wtim){wTimer(+d.wtim);return}
  if(d.wta === 'stop'){if(WT){clearInterval(WT.i);WT = null}const w = $('wtimer');if(w)w.hidden = true;return}
  if(d.poster){ouvrirPoster(d.poster);return}
  if(d.ech){ouvrirEchauf(d.ech);return}
  if(d.test){ouvrirTest(d.test);return}
  if(d.direct){saisieDirecte(d.direct);return}
  if(d.tdisq){const sp = SUPPORTS[atelier(T.at).support];T.charge = Math.max(sp.vide, +(T.charge + 2 * +d.tdisq).toFixed(1));rendreTest();return}
  if(d.tfix){const p = chargesPossibles(atelier(T.at).support), k = p.indexOf(T.charge), n = p[Math.max(0, Math.min(p.length - 1, (k < 0 ? 0 : k) + +d.tfix))];if(n != null)T.charge = n;rendreTest();return}
  if(d.treserve){T.reserve = d.treserve;T.charge = monteeConseillee(atelier(T.at).support, T.base, d.treserve);rendreTest();return}
  if(d.seq){const sq = etatSeq(EL(), SEANCE), L = sequences(+SEANCE.slice(1)), cur = seqOuverte(L, sq);sq.ouv = cur === d.seq ? '' : d.seq;sauver();rendre();return}
  if(d.seqfin){if(d.conf && !confirm(d.conf))return;const sq = etatSeq(EL(), SEANCE), L = sequences(+SEANCE.slice(1));sq.fini[d.seqfin] = jour();
    const i = L.findIndex(x => x.k === d.seqfin), nx = L.slice(i + 1).concat(L.slice(0, i)).find(x => !sq.fini[x.k]);sq.ouv = nx ? nx.k : '';ANCRE = null;sauver();rendre();
    const z = $('seq-' + (nx ? nx.k : d.seqfin));if(z){z.scrollIntoView({block:'start'});window.scrollBy(0, -70)}toast(nx ? 'Séquence terminée ✓ Suite : ' + nx.t : 'Toutes les séquences sont terminées ✓');return}
  if(d.bil){const s = sea(EL(), SEANCE), b = s.bilan = s.bilan || {};b[d.bil] = b[d.bil] === d.v ? '' : d.v;if(d.bil === 'reg' && !['plus', 'moins'].includes(b.reg))delete b.sur;b.date = jour();sauver();rendre();return}
  if(d.abs != null){const x = B.e[+d.abs];x.abs = x.abs || {};if(x.abs[SEANCE])delete x.abs[SEANCE];else x.abs[SEANCE] = jour();sauver();rendre();return}
  if(d.equipe){B.equipe = d.equipe;sauver();rendre();return}
  if(d.niv != null && d.at){EL().niv[d.at] = +d.niv;sauver();rendre();return}
  if(d.fait){const p = prevuDe(EL(), SEANCE, d.fait), s = sea(EL(), SEANCE);s.exos = s.exos || {};const ex = s.exos[d.fait] = s.exos[d.fait] || {};
    ex.real = {series:p ? p.series : 3, reps:p ? p.reps : 10, charge:p && p.charge ? p.charge.charge : null, niv:p ? p.niv : null, diff:false};sauver();rendre();return}
  if(d.modif){modifierExo(d.modif);return}
  if(d.signe){const v = avisDe(d.at);v.signes = v.signes || [];const i = v.signes.indexOf(d.signe);i < 0 ? v.signes.push(d.signe) : v.signes.splice(i, 1);sauver();rendre();return}
  if(d.conseil){const v = avisDe(d.at);v.conseil = v.conseil === d.conseil ? '' : d.conseil;sauver();rendre();return}
  if(d.choix && !d.aj){const e = EL();if(e.projet && e.projet.exos && e.projet.exos.length)return toast('Mobile définitif : ton projet est construit.');if(d.choix === 'puiss' && !e.puissOk)return toast('Puissance : demande à ton professeur de débloquer le niveau confirmé.');e.choix = Object.assign(e.choix || {}, {mob:d.choix, date:jour()});sauver();rendre();return}
  if(d.aj){const e = EL(), pr = e.projet, x = pr.exos.find(z => z.at === d.aj), s = sea(e, SEANCE), coh = s.exos[d.aj].coh, prop = ajuster(pr.mob, x, coh.sens), pq = ($('pq-' + d.aj) || {}).value || '';
    if(!pq.trim() && !confirm('Sans justification, cet ajustement ne compte pas dans ton analyse. Continuer ?'))return;
    s.ajust = s.ajust || {};s.ajust[d.aj] = {choix:d.choix, pourquoi:pq.trim(), avant:Object.assign({}, x)};
    if(d.choix === 'ok')Object.assign(x, prop.p);
    e.ajust.push({S:SEANCE, at:d.aj, txt:d.choix === 'ok' ? prop.txt : 'gardé tel quel', pourquoi:pq.trim(), date:jour()});sauver();rendre();return}
  if(d.annulerAj){const e = EL(), s = sea(e, SEANCE), a = s.ajust[d.annulerAj];if(a && a.avant){const x = e.projet.exos.find(z => z.at === d.annulerAj);Object.assign(x, a.avant)}delete s.ajust[d.annulerAj];
    const i = e.ajust.map(z => z.S + z.at).lastIndexOf(SEANCE + d.annulerAj);if(i >= 0)e.ajust.splice(i, 1);sauver();rendre();return}
  if(d.afl){EL().afl.rep = d.afl;EL().afl.role = 'coach';OUVERT.delete('afl');sauver();rendre();return}
  if(d.role){EL().afl.role = d.role;sauver();rendre();return}
  if(d.calc){calcAtelier(d.calc);return}
  if(d.nouveauProjet){const m = d.nouveauProjet, dp = DEF_PARAM[m];if(m === 'puiss' && !EL().puissOk)return toast('Puissance : sur avis du professeur.');EL().choix = Object.assign(EL().choix || {}, {mob:m, date:EL().choix && EL().choix.date || jour()});EL().projet = {mob:m, exos:[], cree:jour()};sauver();rendre();return}
  if(d.retirer != null){EL().projet.exos.splice(+d.retirer, 1);sauver();rendre();return}
  if(d.couple != null){const pr = EL().projet, x = pr.exos[+d.couple], c = MOBILES[pr.mob].couples[+d.k];x.pct = c[0];x.reps = c[1];sauver();rendre();return}
  if(d.pas != null){const pr = EL().projet, x = pr.exos[+d.pas], k = d.k, [lo, hi] = bornes(pr.mob, k), step = k === 'pct' ? 5 : k === 'reps' ? 1 : 1;
    x[k] = Math.max(lo, Math.min(hi, x[k] + step * +d.d));sauver();rendre();return}
  if(d.pniv != null){EL().projet.exos[+d.pniv].niv = +d.k;sauver();rendre();return}
  if(d.qrS){SEANCE = d.qrS;afficherQRMots();return}
  if(d.qrseance){afficherQRSeance(d.qrseance);return}
  switch(d.act){
    case 'creer': creer();break;
    case 'scanClasse': scanner();break;
    case 'scanPuiss': scanner(validerPuiss, '⚡ QR Niveau confirmé');break;
    case 'fermerScan': fermerFen();break;
    case 'demo': DEMO = true;B = binomeDemo();P = 0;ONGLET = 'seance';SEANCE = 'S5';rendre();window.scrollTo(0, 0);break;
    case 'quitterDemo': DEMO = false;B = null;rendre();break;
    case 'mobiles': panneauMobiles();break;
    case 'debloquerPuiss': debloquerPuiss();break;
    case 'valPuiss': {if(!DEMO)break;EL().puissOk = jour();fermerFen();rendre();toast('⚡ Démo : niveau confirmé débloqué.');break}
    case 'valTirage': {const e = EL(), l = e.tirageMan || [];if(l.length !== 3)return toast('Choisis exactement 3 exercices.');e.tirage = {l:l.slice(), src:'manuel', date:jour()};sauver();rendre();break}
    case 'refaireTirage': if(confirm('Effacer le tirage enregistré ?')){delete EL().tirage;EL().tirageMan = [];sauver();rendre()}break;
    case 'chronoBinome': choixBinome();break;
    case 'copierEch': {const src = (sea(EL(), SEANCE).ech || {}).wc || [], aut = autre();if(!aut)break;const x = sea(aut, SEANCE);x.ech = x.ech || {};x.ech.wc = [...new Set((x.ech.wc || []).concat(src))];sauver();toast('Coches copiées pour ' + prenom(aut.nom));rendre();break}
    case 'goBinome': lancerBinome();break;
    case 'calcUtiliser': CALC.cm = +d.cm;CALC.mode = 'pct';rendreCalc();break;
    case 'fichesLibres': FICHES_LIBRES = true;rendre();window.scrollTo(0, 0);break;
    case 'fichesRetour': FICHES_LIBRES = false;rendre();window.scrollTo(0, 0);break;
    case 'calcLibre': calcLibre();break;
    case 'fermerFen': fermerFen();break;
    case 'valCode': validerCode(d.id);break;
    case 'codeOubli': codeOubli(d.id);break;
    case 'carnetCode': ouvrir(d.id);break;
    case 'pouls': if(window.EPSPouls)EPSPouls.ouvrir({titre:'Pouls en fin d\'échauffement', onFC:v => {const s = sea(EL(), SEANCE);s.ech = s.ech || {};s.ech.pouls = v;sauver();rendre()}});else{const v = parseInt(prompt('Pulsations par minute :'), 10);if(v){const s = sea(EL(), SEANCE);s.ech = s.ech || {};s.ech.pouls = v;sauver();rendre()}}break;
    case 'qrMots': afficherQRMots();break;
    case 'changerListe': changerListe();break;
    case 'valListe': {const l = [...new Set([...document.querySelectorAll('[data-liste]')].map(s => s.value).filter(Boolean))];if(l.length < 3)return toast('3 exercices différents au minimum.');B.listes[SEANCE] = l;sauver();fermerFen();rendre();break}
    case 'valModif': {const a = atelier(d.at), s = sea(EL(), SEANCE), p = prevuDe(EL(), SEANCE, d.at) || {};s.exos = s.exos || {};const ex = s.exos[d.at] = s.exos[d.at] || {};
      const se = parseInt($('mSe').value, 10), rp = parseInt($('mRp').value, 10), ch = $('mCh') ? num($('mCh').value) : null;
      if(!se || !rp)return toast('Séries et répétitions.');if(!a.temps && rp < 3)return toast('Jamais moins de 3 répétitions.');
      ex.real = {series:se, reps:rp, charge:ch, niv:p.niv, diff:true};sauver();fermerFen();rendre();break}
    case 'valDirect': {const ch = num($('dCh').value), rp = parseInt($('dRp').value, 10), cm = brzycki(ch, rp);if(!cm){$('dRes').textContent = 'Une charge et 3 à 10 répétitions.';return}
      if(rmVerrou(EL()))return toast('Charges max bloquées pendant l\'évaluation (S9).');majRM(EL(), d.at, {cm, charge:ch, reps:rp, dix:rp === 10 ? ch : null, date:jour(), mode:'direct', S:SEANCE});sauver();fermerFen();rendre();toast((rp === 10 ? '10 RM : ' + fmtKg(ch) + ' · ' : '') + 'charge max estimée ' + fmtKg(cm));break}
    case 'annulerTest': if(T.series.length && !confirm('Quitter le test sans enregistrer ?'))return;T = null;rendreTest();rendre();break;
    case 'tPlus': T.cpt++;T.suite = 0;if(T.cpt >= 10)finSerie();else rendreTest();break;
    case 'tNo': T.norep++;T.suite++;if(T.suite >= 2)finSerie();else rendreTest();break;
    case 'tFinSerie': finSerie();break;
    case 'tSuivante': T.phase = 'serie';rendreTest();break;
    case 'tStop': T.phase = 'fin';rendreTest();break;
    case 'tValider': validerTest();break;
    case 'tRecommencer': {const p = chargesPossibles(atelier(T.at).support), c = [...p].reverse().find(x => x <= T.charge - 2 * T.pas + 1e-9);T.series = [];T.cpt = 0;T.norep = 0;T.phase = 'serie';if(c != null)T.charge = c;rendreTest();break}
    case 'changerMobile': if(confirm('Changer de mobile ? Tes exercices restent, leurs paramètres sont remis au milieu des fourchettes du nouveau mobile.')){const pr = EL().projet, ord = MOBILES_ORDRE, m = ord[(ord.indexOf(pr.mob) + 1) % 3];
      fenetre(`<h3>Nouveau mobile</h3><div class="mob-choix">${ord.map(k => `<button type="button" style="--mc:${MOBILES[k].coul}" data-chg-mob="${k}"><img src="${MOB_IMG[k]}" alt=""><span>${MOBILES[k].nom}</span></button>`).join('')}</div><button type="button" class="bt" data-act="fermerFen">Annuler</button>`)}break;
    case 'exporter': exporter();break;
    case 'importer': choisirImport();break;
    case 'qrPrec': if(QRS && QRS.i > 0){QRS.i--;dessinerQRSeance()}break;
    case 'qrSuiv': if(QRS && QRS.i < QRS.L.length - 1){QRS.i++;dessinerQRSeance()}break;
    case 'valImport': validerImport();break;
    case 'partager': partager();break;
    case 'fermerCarnet': B = null;DEMO = false;rendre();break;
    case 'supprimer': if(DEMO){B = null;DEMO = false;rendre();break}
      if(!(B.envois || []).length && !confirm('Ce carnet n\'a jamais été envoyé. Le supprimer quand même ?'))return;
      if(prompt('Pour supprimer, tape SUPPRIMER') !== 'SUPPRIMER')return;delete CARNETS[B.id];ecrire(CLE, CARNETS);B = null;rendre();break;
  }
  if(d.chgMob){const pr = EL().projet;pr.mob = d.chgMob;const dp = DEF_PARAM[d.chgMob];pr.exos.forEach(x => Object.assign(x, {pct:dp.pct, series:dp.series, reps:dp.reps}));sauver();fermerFen();rendre()}
});
document.addEventListener('change', ev => {
  const t = ev.target, d = t.dataset;ANCRE = t;
  if(d.texte === 'choix'){const e = EL();e.choix = Object.assign(e.choix || {}, {pourquoi:t.value.trim()});sauver();return}
  if(d.biltxt){const s = sea(EL(), SEANCE), b = s.bilan = s.bilan || {};b[d.biltxt] = t.value.trim();sauver();return}
  if(d.texte === 'analyse'){sea(EL(), SEANCE).analyse = t.value.trim();sauver();return}
  if(d.echelle){EL().echelle[d.echelle] = t.value;sauver();return}
  if(d.pq){const x = sea(EL(), SEANCE).exos[d.pq];if(x){x.next = Object.assign(x.next || {}, {pq:t.value.trim()});sauver()}return}
  if(d.objv){const x = sea(EL(), SEANCE).exos[d.objv];if(x && x.avis && x.avis.obj){x.avis.obj.v = num(t.value);sauver()}return}
  if(t.classList.contains('rSR') && d.cle){const o = objetCle(d.cle, true);o.note = +t.value;apresRessenti(d.cle);T ? rendreTest() : rendre();return}
  if(t.id === 'ajEx' && t.value){const pr = EL().projet, a = atelier(t.value), dp = DEF_PARAM[pr.mob];pr.exos.push({at:t.value, series:dp.series, reps:dp.reps, pct:dp.pct, niv:a.niveaux ? Math.min(1, a.niveaux.length - 1) : null});sauver();rendre();return}
  if(t.id === 'lSup')majCalcLibre();
  if(t.id === 'cAt'){CALC.at = t.value;if(t.value){CALC.sup = atelier(t.value).support;const cm = B && cmDe(EL(), t.value);if(cm)CALC.cm = cm}rendreCalc()}
  if(t.id === 'cSup'){CALC.sup = t.value;rendreCalc()}
});
document.addEventListener('input', ev => {if(['lCm', 'lCh', 'lRp'].includes(ev.target.id))majCalcLibre();
  {const t = ev.target, z = () => {const p = t.selectionStart;rendreCalc();const n = $(t.id);if(n){n.focus();try{n.setSelectionRange(p, p)}catch(x){}}};
   if(t.id === 'cCm'){CALC.cm = t.value;z()}else if(t.id === 'cCh'){CALC.ch = t.value;z()}else if(t.id === 'cP'){CALC.p = +t.value;const tmp = document.createElement('div');const sl = $('cP');sl.id = 'cPx';rendreCalc();const n = $('cP');n.replaceWith(sl);sl.id = 'cP'}}
  if(ev.target.classList.contains('rSR')){const v = +ev.target.value, w = ev.target.closest('.rS'), l = w.querySelector('.rS-l');w.classList.remove('vide');l.style.background = couleurNote(v);l.innerHTML = `<b>${v}</b><span>${esc(ECHELLE[v - 1][1])}<small>${esc(ECHELLE[v - 1][2])}</small></span>`;w.querySelectorAll('.rS-t span').forEach((x, i) => x.classList.toggle('on', i + 1 === v))}});
document.addEventListener('keydown', ev => {if(ev.key === 'Enter' && ev.target.id === 'oCode'){const b = document.querySelector('[data-act="valCode"]');if(b)b.click()}});
$('btMob').onclick = panneauMobiles;
window.addEventListener('eps-avant-maj', () => sauver());

/* ---------- Séance du jour (eps-code.js v2) : la saisie n'est ouverte qu'en cours, avec le QR du jour du professeur ---------- */
if(window.EPSCode)EPSCode.eleve({app:'mue', qrApp:'MUS', scanner:v => scanner(async t => {let o;try{o = await decoderQR(t)}catch(e){throw new Error('Ce QR n’est pas un QR de cette appli. Demande le QR du jour à ton professeur.')}await v(o);return recevoirClasse(o)}, '📷 QR du jour'), classe:() => B && !DEMO ? B.classe || '' : '', seance:() => SEANCE, seances:() => SEANCES_IDS,
  nom:x => x + ' · ' + (seanceById(x) || {titre:''}).titre, ouvrir:x => {SEANCE = x;ONGLET = 'seance';rendre()}, zone:'#main',
  actif:() => !!B && ONGLET === 'seance', libreSel:'.seq-tete,.titre-fiche,.protocole summary,.puces button,.se-bt,.qui button,[data-fiche],[data-poster],[data-ech],[data-libre],details summary,[data-act="mobiles"]', demo:() => DEMO, bandeau:true});

/* ---------- Démarrage ---------- */
if(/[?&]demo\b/.test(location.search)){DEMO = true;B = binomeDemo();SEANCE = 'S5'}
rendre();
if('serviceWorker' in navigator)window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
