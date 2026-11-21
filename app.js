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
const ONGLETS = [['seance','🏋️','Séance'],['charges','⚖️','Charges max'],['projet','🎯','Projet'],['carnet','📒','Carnet'],['fiches','📖','Fiches'],['envoyer','📤','Envoyer']];
const SEANCES_IDS = SEANCES.map(s => s.id);
/* v2.0 : S2-S3 tests, S4 tonification, S5 volume, S6 puissance et choix, S7 projet, S8-S9 évaluation */
const MOBILE_DU_JOUR = {S4:'tonif', S5:'volume', S6:'puiss'};
const SEANCE_PROJET = 7, SEANCE_MOBILE = [4, 6];
/* ateliers proposés pour un mobile : le menu (charges), et en Puissance seulement les 6 ateliers poussés vite */
const dispoPour = mob => ATELIERS.filter(a => a.plio ? mob === 'puiss' : a.menu && (mob !== 'puiss' || a.puissance));   // v2.5 : saut sur box, Puissance seulement
const DEF_PARAM = {tonif:{pct:55, series:3, reps:15}, volume:{pct:70, series:4, reps:10}, puiss:{pct:45, series:4, reps:5}};
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
function rendre(){
  const y = window.scrollY;
  if(!B){$('nav').hidden = true;$('btMob').hidden = true;$('sous').textContent = 'Lycée Georges Pompidou · CA5 Terminale';$('main').innerHTML = FICHES_LIBRES ? `<button type="button" class="bt" data-act="fichesRetour" style="margin:4px 0 10px">← Retour</button>` + vueFiches() : accueil();return}
  $('sous').textContent = (B.classe ? B.classe + ' · ' : '') + B.e.map(x => prenom(x.nom)).join(' & ');
  $('nav').hidden = false;$('btMob').hidden = false;
  $('nav').innerHTML = ONGLETS.map(([k, i, t]) => `<button type="button" data-onglet="${k}" class="${k === ONGLET ? 'ici' : ''}"><i>${i}</i>${t}</button>`).join('');
  const qui = `<div class="qui"><span>Qui pratique ?</span>${B.e.map((x, i) => `<button type="button" data-qui="${i}" class="${i === P ? 'ici' : ''}">${esc(prenom(x.nom))}</button>`).join('')}</div>`;
  const demo = DEMO ? `<div class="demo-bandeau"><span>👀 <b>Mode démo</b> : rien n'est enregistré.</span><button type="button" class="bt mini" data-act="quitterDemo">Quitter</button></div>` : '';
  const corps = {seance:vueSeance, charges:vueCharges, projet:vueProjet, carnet:vueCarnet, fiches:vueFiches, envoyer:vueEnvoyer}[ONGLET]();
  $('main').innerHTML = demo + (ONGLET === 'envoyer' || ONGLET === 'fiches' ? '' : qui) + corps;
  window.scrollTo(0, y);
}

/* ================== Accueil ================== */
function accueil(){
  const l = Object.values(CARNETS).sort((a, b) => (b.maj || 0) - (a.maj || 0));
  return `<h2>Mon carnet de musculation</h2>
  ${l.length ? `<section class="carte"><h3>Carnets sur ce téléphone</h3>${l.map(c => `<button type="button" class="bt pleine" style="margin:6px 0;justify-content:flex-start" data-ouvrir="${c.id}">🔒 ${esc(c.e.map(x => x.nom).join(' & '))}${c.classe ? ` <span class="muted small">· ${esc(c.classe)}</span>` : ''}</button>`).join('')}</section>` : ''}
  <section class="carte"><h3>📖 Fiches d'exercice</h3><p class="small muted">Les fiches des ateliers et le répertoire de l'échauffement, en libre consultation.</p><button type="button" class="bt pleine" data-act="fichesLibres">Voir les fiches</button></section>
  <section class="carte"><h3>📷 QR de la classe</h3><p class="small muted">Scanne le QR affiché par le professeur : il donne la liste de la classe${Object.keys(CLASSES).length ? ' (classe' + (Object.keys(CLASSES).length > 1 ? 's' : '') + ' reçue' + (Object.keys(CLASSES).length > 1 ? 's' : '') + ' : ' + esc(Object.keys(CLASSES).join(', ')) + ')' : ''} et ouvre la séance du jour.</p><button type="button" class="bt act" data-act="scanClasse">📷 Scanner le QR de la classe</button></section>
  <section class="carte act"><h3>＋ Nouveau binôme</h3>${blocNouveau()}</section>
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
   <p class="small muted">Il protège votre carnet si le téléphone est prêté. Ne l'oubliez pas : le professeur ne peut pas le retrouver.</p>
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
  fenetre(`<h3>🔒 ${esc(c.e.map(x => prenom(x.nom)).join(' & '))}</h3><p>Code secret du binôme :</p><input type="password" inputmode="numeric" maxlength="4" id="oCode" class="code" autocomplete="off"><p class="small" id="oErr" style="color:var(--alerte);font-weight:700;min-height:1.4em"></p><div class="rangee"><button type="button" class="bt act" data-act="valCode" data-id="${id}">Ouvrir</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
  setTimeout(() => {const i = $('oCode');if(i)i.focus()}, 50);
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
  if(o.t !== 'C')throw new Error('Ce n\'est pas le QR de la classe.');
  CLASSES[o.c] = {l:o.l || [], u:o.u || '', ts:o.ts || 0};ecrire('mue-classes', CLASSES);
  if(window.EPSCode){EPSCode.memoriserCle(o.c, o.cc);if(o.cj)await EPSCode.appliquerJour(o.c, o.cj)}
  if(!B)SEL.classe = o.c;
  return 'Classe ' + o.c + ' : ' + (o.l || []).length + ' élèves' + (o.cj && o.cj.d === jour() ? ' · séance ' + o.cj.s + ' ouverte' : '');
}
let FLUX = null;
function scanner(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)return toast('Caméra indisponible sur ce téléphone.');
  fenetre(`<h3>📷 QR de la classe</h3><video playsinline muted style="width:100%;border-radius:12px;background:#000"></video><p class="small" id="scMsg">Vise le QR affiché par le professeur.</p><button type="button" class="bt pleine" data-act="fermerScan">Fermer</button>`);
  const v = document.querySelector('.fen video'), c = document.createElement('canvas'), x = c.getContext('2d', {willReadFrequently:true});let fini = false;
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(st => {FLUX = st;v.srcObject = st;v.play();boucle()}).catch(() => {$('scMsg').textContent = 'Autorise la caméra pour cette page, puis réessaie.'});
  function boucle(){
    if(!FLUX || !document.querySelector('.fen video'))return;
    if(v.readyState >= 2){c.width = v.videoWidth;c.height = v.videoHeight;x.drawImage(v, 0, 0);const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if(r && r.data && !fini){fini = true;decoderQR(r.data).then(recevoirClasse).then(t => {arreterScan();fermerFen();toast('✓ ' + t);rendre()}).catch(e => {$('scMsg').textContent = e.message;setTimeout(() => fini = false, 1500)})}}
    requestAnimationFrame(boucle);
  }
}
function arreterScan(){if(FLUX)FLUX.getTracks().forEach(t => t.stop());FLUX = null}

/* ================== Fenêtres ================== */
function fenetre(html){$('couche').innerHTML = `<div class="fen" data-fond><div role="dialog" aria-modal="true">${html}</div></div>`}
function fermerFen(){arreterScan();$('couche').innerHTML = ''}
function panneauMobiles(){
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>Les 3 mobiles</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>${MOBILES_ORDRE.map(mobileHTML).join('')}
   <h4>Échelle de ressentis</h4>${echelleHTML()}<h4>Sécurité</h4><ul class="ats small">${SECU.regles.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="small"><b>Respiration.</b> ${esc(SECU.respiration)}</p>`);
}

/* ================== Charges : calculs ================== */
function cmDe(e, at){const r = e.rm[at];return r && r.cm ? r.cm : null}
/* v2.2 : charge max avec historique (rien n'est perdu), mise à jour bloquée pendant l'évaluation (S8-S9) */
function majRM(e, at, rec){const old = e.rm[at];rec.hist = ((old && old.hist) || []).concat(old ? [{cm:old.cm, date:old.date, mode:old.mode}] : []);e.rm[at] = rec}
const rmVerrou = e => !!(e.seances.S8 && Object.keys(e.seances.S8).length);
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
  else{mob = MOBILE_DU_JOUR[S];p = Object.assign({}, DEF_PARAM[mob])}
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
  return `<div class="prevu">${parts.join('')}</div>${p.charge ? `<p class="compo">${esc(p.charge.compo)}</p>` : ''}`;
}

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
function vueSeance(){
  const s = seanceById(SEANCE), e = EL();
  const puces = `<div class="puces">${SEANCES_IDS.map(S => {const f = e.seances[S] && Object.keys(e.seances[S]).length;return `<button type="button" data-seance="${S}" class="${S === SEANCE ? 'ici' : ''}${f ? ' fait' : ''}">${S}</button>`}).join('')}</div>`;
  let h = puces + `<div class="rangee" style="justify-content:flex-end"><button type="button" class="bt mini" data-act="scanClasse" data-libre>📷 QR de la classe</button></div><h2>${SEANCE} · ${esc(s.titre)}</h2><p class="muted small">${esc(s.obj)}</p>`;
  const n = +SEANCE.slice(1);
  if(n >= 4)h += carteForme();
  h += carteEchauffement(n === 1);
  if(n === 1)h += carteCircuit() + carteSitue() + carteQRMots();
  if(n === 2 || n === 3)h += carteTest() + carteDefi() + carteQRMots();
  if(n >= SEANCE_MOBILE[0] && n <= SEANCE_MOBILE[1])h += carteMobile(MOBILE_DU_JOUR[SEANCE]) + listeExos(LISTES_DEFAUT[SEANCE]) ;
  if(n >= 4 && n <= SEANCE_PROJET)h += carteAfl();   // v2.1 : l'évaluation AFL2 et AFL3 commence en S4
  if(n === SEANCE_MOBILE[1])h += carteComparer() + carteEchelle();
  if(n >= SEANCE_PROJET){
    const pr = e.projet;
    if(!pr || !pr.exos.length)h += `<section class="carte act"><h3>🎯 Construis d'abord ton projet</h3><p>Mobile, 3 groupes musculaires, 4 à 6 exercices.</p><button type="button" class="bt act" data-onglet="projet">Construire mon projet</button></section>`;
    else h += carteMobile(pr.mob) + listeExos(pr.exos.map(x => x.at), true) + (sea(e, SEANCE).ajust && Object.keys(sea(e, SEANCE).ajust).length ? carteAjustements() : '') + carteAnalyse();

  }
  return h;
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
  return `<section class="carte"><h3>🔥 Notre échauffement · ${faites}/${P.length}</h3>
   <p class="small muted">Environ 18 min, à faire à deux : une coche vaut pour le binôme. Touche une partie quand elle est faite, ou coche les exercices dans « Voir le détail ».</p>
   <div class="wtimer" id="wtimer"${WT ? '' : ' hidden'}><span id="wtt">0:00</span><button type="button" class="bt mini" data-wta="stop">Arrêter</button></div>
   ${parts}
   <div class="rangee" style="margin-top:8px"><button type="button" class="bt mini" data-act="pouls">❤️ Prendre mon pouls</button>${ech.pouls ? `<b>${ech.pouls} puls/min</b>` : ''}</div>
   ${n <= 3 ? `<h4>${s1 ? 'Après 2-3 min de course' : 'Début d\'échauffement'} : note et mot</h4>${ressentiHTML('ech.debut', ech.debut)}<h4>Fin d'échauffement : note et mot</h4>${ressentiHTML('ech.fin', ech.fin)}` : ''}</section>`;
}
const ECH_ITEM = {};ECHAUF_LIB.forEach(g => g.l.forEach(x => {ECH_ITEM[x[0]] = x}));
const OUV_ECH = new Set();
const ACTIV_POUR = {act_scap:['dc','dch','rowh','rowb','pullover'], act_y:['oiseau','tirage','dm'], act_pont:['hip'], act_gm:['sdtj','rowb'], act_fente:['fentes','squath'], act_squat:['squath','sbox']};
function exosDuJour(n){const e = EL();if(n >= SEANCE_PROJET)return ((e.projet && e.projet.exos) || []).map(x => x.at);if(n >= 4)return B.listes[SEANCE] || LISTES_DEFAUT[SEANCE] || [];return []}
function partiesEch(n){
  const jour = exosDuJour(n), nb = (has, l) => l.filter(has).length;
  const cardio = ['corde','jjack','genoux','talons','chasses','squatjack','burpee','fente_m','chenille','ours','crabe'];
  const mob = ['mob_cheville','mob_genou','mob_hanche','mob_buste','mob_epaule','mob_poignet'];
  const act = ['act_scap','act_y','act_pont','act_gm','act_fente','act_squat'];
  const star = act.filter(k => ACTIV_POUR[k].some(a => jour.includes(a)));
  const renf = ['squat','pompes_mur','pompes_step','pompes_genoux','pompes','dips','gainage','gainlat','crunch','crunch_inv','deadbug','birddog','mclimb','taps','rtwist'];
  const puiss = SEANCE === 'S6' || (n >= SEANCE_PROJET && EL().projet && EL().projet.mob === 'puiss');
  if(puiss)renf.unshift('sjump');
  const P = [
   {k:'P1', t:'1 · Cardio', min:5, r:'Course ou corde à sauter, puis 4 exercices au choix', intro:'Jusqu\'à la sensation de chaleur et un léger essoufflement.', l:cardio, compte:h => nb(h, cardio) + ' / 4 au choix', ok:h => h('P1') || nb(h, cardio) >= 4},
   {k:'P2', t:'2 · Articulaire', min:2, r:'Chevilles, genoux, hanches, buste, épaules, poignets', intro:'Dans cet ordre, de bas en haut : 10 cercles dans chaque sens.', l:mob, compte:h => nb(h, mob) + ' / 6', ok:h => h('P2') || nb(h, mob) === mob.length},
   {k:'P3', t:'3 · Activation', min:4, r:star.length ? '4 au choix : les ★ préparent tes exercices du jour' : '4 au choix, 10 répétitions lentes', intro:'Le placement des ateliers, sans charge.', l:act, star, compte:h => nb(h, act) + ' / 4 au choix', ok:h => h('P3') || nb(h, act) >= 4},
   {k:'P4', t:'4 · Renforcement', min:4, r:'4 au choix, à ton niveau', intro:'Pompes : choisis ton niveau, du mur aux pompes classiques.' + (puiss ? ' Séance Puissance : le squat jump en plus.' : ''), l:renf, compte:h => nb(h, renf) + ' / 4 au choix', ok:h => h('P4') || nb(h, renf) >= 4}];
  if(n >= 4 && jour.length){const sp = jour.map(at => 'sp:' + at);
    P.push({k:'P5', t:'5 · Spécifique', min:3, r:'1 série de 10 sans charge de chaque exercice du jour', intro:'En soignant le placement : c\'est le geste de ta série, sans le poids.', compte:h => nb(h, sp) + ' / ' + sp.length, ok:h => h('P5') || nb(h, sp) === sp.length,
      l:jour.map(at => {const a = atelier(at);return {html:`<button type="button" class="wcard${(sea(EL(), SEANCE).ech || {}).wc && sea(EL(), SEANCE).ech.wc.includes('sp:' + at) ? ' on' : ''}" data-wc="sp:${at}"><img src="${imgAtelier(at) || ''}" alt="" loading="lazy"><b>${esc(a.nom)}</b><span>${esc(POINT_CLE[at] || '')}</span></button>`}})});}
  else if(n === 2 || n === 3)P.push({k:'P5', t:'5 · Spécifique', min:3, r:'1 série de 10 sans charge des ateliers que tu vas tester', l:[], ok:h => h('P5')});
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
/* v2.12 : chrono des séries (minuteur.js) : temps de travail, récupération du mobile, dessin, point clé pour le coach */
function lancerChrono(at){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at);if(!p)return toast('Pas de paramètres prévus pour cet exercice.');
  const M = MOBILES[p.mob] || {}, aut = autre();
  const ch = p.charge && p.charge.charge ? fmtKg(p.charge.charge) : (a.type === 'variante' && a.niveaux && p.niv != null ? 'Niv. ' + (p.niv + 1) : '');
  MinuteurM.ouvrir({at, nom:a.nom, img:imgAtelier(at), mob:p.mob, mobNom:M.nom, series:p.series, reps:p.reps, temps:!!a.temps, chargeTxt:ch,
    recupS:M.recupS || 90, cle:POINT_CLE[at] || '', crit:a.crit || [], signes:SIGNES, partenaire:aut ? prenom(aut.nom) : '',
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
   ${CIRCUIT_S1.map((id, i) => {const a = atelier(id);return `<div class="ex${c[id] ? ' fait' : ''}"><header>${vignette(id)}<b style="flex:1">${i + 1}. ${esc(a.nom)}</b><button type="button" class="bt mini${c[id] ? ' ok' : ''}" data-circuit="${id}">${c[id] ? '✓ Fait' : 'Fait'}</button></header></div>`}).join('')}</section>`;
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
function carteTest(){
  const e = EL();
  const nb = ATELIERS_TEST.filter(id => e.rm[id]).length, bas = ATELIERS_TEST.some(id => e.rm[id] && atelier(id).zone === 'bas');
  return `<section class="carte"><h3>Test 10 RM · ${esc(prenom(e.nom))}</h3><p class="small">La charge la plus lourde soulevée 10 fois sans No REP, en montant progressivement. Le partenaire tient le téléphone et juge.</p>
   <p class="retour ${nb >= OBJ_TESTS[0] ? 'ok' : 'non'}"><b>${nb} charge${nb > 1 ? 's' : ''} max</b> sur ${ATELIERS_TEST.length} ateliers · objectif ${OBJ_TESTS[0]} à ${OBJ_TESTS[1]} à la fin de la S3 (4 à 5 par séance)${bas ? '' : ' · pense à un atelier du bas du corps'}.</p>
   ${ATELIERS_TEST.slice().sort((x, y) => (e.rm[x] ? 1 : 0) - (e.rm[y] ? 1 : 0)).map(id => {const a = atelier(id), r = e.rm[id];return `<div class="ex${r ? ' fait' : ''}"><header>${vignette(id)}<b style="flex:1">${esc(a.nom)}</b>${r ? `<span><b>${fmtKg(r.cm)}</b> <span class="small muted">${r.mode === 'direct' ? 'saisie directe' : 'test'}</span></span>` : ''}</header>
     <div class="rangee"><button type="button" class="bt mini act" data-test="${id}">${r ? 'Refaire le test' : 'Commencer le test'}</button><button type="button" class="bt mini" data-direct="${id}">Saisie directe</button></div></div>`}).join('')}</section>`;
}
let T = null; // test en cours
function ouvrirTest(at){
  const a = atelier(at), e = EL(), pas = pasMontee(a.support);
  const dep = chargeReelle(a.support, a.depart || SUPPORTS[a.support].vide || 4);
  T = {at, el:P, series:[], charge:dep ? dep.charge : 4, cpt:0, norep:0, suite:0, phase:'serie', pas, recupFin:0};
  rendreTest();
}
function rendreTest(){
  if(!T){const x = $('ecranTest');if(x)x.remove();return}
  const a = atelier(T.at), e = B.e[T.el], r = chargeReelle(a.support, T.charge);
  let el = $('ecranTest');if(!el){el = document.createElement('div');el.className = 'ecran';el.id = 'ecranTest';document.body.appendChild(el)}
  const series = `<div class="series">${T.series.map((s, i) => `<span class="${s.valides >= 10 ? 'ok' : ''}">S${i + 1} : ${fmtKg(s.charge)} × ${s.valides}${s.norep ? ` (${s.norep} No REP)` : ''}</span>`).join('')}</div>`;
  let h = `<div class="rangee" style="justify-content:space-between"><h3>Test 10 RM · ${esc(a.nom)}</h3><button type="button" class="bt mini" data-act="annulerTest">Quitter</button></div><p class="muted small">${esc(prenom(e.nom))} soulève, le partenaire juge. Série ${T.series.length + (T.phase === 'serie' ? 1 : 0)} sur 5 au maximum.</p>${series}`;
  if(T.phase === 'serie'){
    h += `<div class="charge-grande">${fmtKg(T.charge)}</div><p class="compo" style="text-align:center">${r ? esc(r.compo) : ''}</p>
     ${T.cpt === 0 ? `<div class="rangee" style="justify-content:center"><button type="button" class="bt mini" data-tcharge="-1">− ${fmtKg(T.pas)}</button><button type="button" class="bt mini" data-tcharge="1">+ ${fmtKg(T.pas)}</button></div>` : ''}
     <div class="compteur">${T.cpt}<small>répétitions valides${T.norep ? ` · ${T.norep} No REP` : ''}</small></div>
     <div class="rangee"><button type="button" class="bt ok geant" data-act="tPlus">+ 1</button><button type="button" class="bt danger geant" data-act="tNo">No REP</button></div>
     <p class="small muted">No REP : amplitude incomplète, trajet déformé, charge non freinée. Deux No REP de suite arrêtent la série.</p>
     <button type="button" class="bt pleine" data-act="tFinSerie" style="margin-top:8px">L'élève s'arrête : fin de la série</button>`;
  } else if(T.phase === 'recup'){
    h += `<p class="retour ok">10 répétitions valides ! On monte : ${fmtKg(T.charge)}.</p>${T.series.length === 1 ? `<h4>Ressenti à la 1re série</h4>${ressentiHTML('test.' + T.at + '.premiere', (e.tests[T.at] || {ressentis:{}}).ressentis.premiere)}` : ''}
     <div class="chrono" id="tChrono">2:00</div><p class="small muted" style="text-align:center">Récupération : le partenaire fait sa série pendant ce temps.</p>
     <button type="button" class="bt act pleine" data-act="tSuivante">Série suivante à ${fmtKg(T.charge)}</button>`;
  } else {
    const best = meilleure(T.series);
    h += best ? `<p class="retour ok">Charge max estimée : <b style="font-size:26px">${fmtKg(best.cm)}</b><br><span class="small">d'après ${fmtKg(best.charge)} × ${best.valides} (Brzycki)</span></p>` : `<p class="retour non">Pas de série d'au moins 3 répétitions : recommence plus léger.</p>`;
    h += `<h4>Ressenti à la dernière série</h4>${ressentiHTML('test.' + T.at + '.derniere', (e.tests[T.at] || {ressentis:{}}).ressentis.derniere)}`;
    h += best ? `<button type="button" class="bt ok pleine" data-act="tValider">✓ Je valide (partenaire)</button>` : `<button type="button" class="bt act pleine" data-act="tRecommencer">Recommencer plus léger</button>`;
  }
  el.innerHTML = h;
}
function meilleure(series){
  let b = null;
  series.forEach(s => {const v = Math.min(10, s.valides), cm = brzycki(s.charge, v);if(cm && (!b || cm > b.cm))b = {cm, charge:s.charge, valides:v}});
  return b;
}
function finSerie(){
  T.series.push({charge:T.charge, valides:T.cpt, norep:T.norep});
  const ok = T.cpt >= 10;T.cpt = 0;T.norep = 0;T.suite = 0;
  if(ok && T.series.length < 5){const p = chargesPossibles(atelier(T.at).support), suiv = p.find(c => c >= T.charge + T.pas - 1e-9);if(suiv){T.charge = suiv;T.phase = 'recup';T.recupFin = Date.now() + 120000;rendreTest();return}}
  T.phase = 'fin';rendreTest();
}
setInterval(() => {const c = $('tChrono');if(!c || !T)return;const r = Math.max(0, Math.round((T.recupFin - Date.now()) / 1000));c.textContent = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');if(r === 0)c.style.color = 'var(--ok)'}, 500);
function validerTest(){
  const e = B.e[T.el], best = meilleure(T.series);if(!best)return;
  majRM(e, T.at, {cm:best.cm, charge:best.charge, reps:best.valides, date:jour(), mode:'test'});
  const t = e.tests[T.at] = e.tests[T.at] || {ressentis:{}};t.series = T.series;t.date = jour();
  sauver();T = null;rendreTest();rendre();toast('Charge max enregistrée');
}
function saisieDirecte(at){
  const a = atelier(at);
  fenetre(`<h3>Saisie directe · ${esc(a.nom)}</h3><p class="small">Une série réussie proprement : la charge (${esc(SUPPORTS[a.support].unite)}) et le nombre de répétitions (3 à 10).</p>
   <label class="ch">Charge (kg)</label><input type="number" inputmode="decimal" id="dCh"><label class="ch">Répétitions</label><input type="number" inputmode="numeric" id="dRp" min="3" max="10">
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
  return `<section class="carte"><h3>Défi par équipes</h3><p class="small">Votre équipe (donnée par le professeur) :</p><div class="chips">${['A','B','C','D'].map(x => `<button type="button" class="${B.equipe === x ? 'ici' : ''}" data-equipe="${x}">Équipe ${x}</button>`).join('')}</div>
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
  return `<h3 style="margin-top:16px">Les exercices · ${esc(prenom(e.nom))}</h3>${projet ? '' : `<p class="small muted">Liste du binôme ; <button type="button" class="lien" data-act="changerListe">changer un exercice</button>.</p>`}` + ids.map(at => carteExo(at, at === (s.exCle && ids.includes(s.exCle) ? s.exCle : ids[0]))).join('');
}
const OUVERT = new Set();   // fiches terminées rouvertes à la main
function carteExo(at, estCle){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at), ex = (sea(e, SEANCE).exos || {})[at] || {};
  const r = ex.ressenti || {}, coh = ex.coh, aut = autre(), n = +SEANCE.slice(1);
  const fini = n >= 4 && ex.real && ficheFinie(ex, p, aut, estCle);
  const etat = fini ? ' fait' : ex.real && coh && !coh.ok && n < 4 ? ' alerte' : '';
  let h = `<div class="ex${etat}" id="ex-${at}"><header>${vignette(at)}<b style="flex:1">${esc(a.nom)}</b><span class="small muted">${esc(a.groupe)}</span></header>`;
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
    if(n >= 4)h += carteMoi(at, ex, p);
    else h += `<h4>Mon ressenti</h4>${ressentiHTML('exos.' + at + '.ressenti', r, true)}${coh ? `<p class="retour ${coh.stop ? 'stop' : coh.ok ? 'ok' : 'non'}">${esc(coh.msg)}</p>` : ''}`;
    if(fini)h += `<button type="button" class="lien" data-replier="${at}">Replier la fiche</button>`;
  }
  return h + '</div>';
}
function niveauCoach(){return NIV_COACH_M[SEANCE] || 1}
function coachFini(ex, estCle){const av = ex.avis || {}, niv = niveauCoach();
  return !!(av.cle && av.conseil && (!estCle || niv < 2 || av.propres != null) && (!estCle || niv < 3 || (av.obj && av.obj.k && av.obj.v !== '' && av.obj.v != null)))}
function ficheFinie(ex, p, aut, estCle){
  const nx = ex.next || {}, av = ex.avis || {}, niv = niveauCoach();
  const moi = ex.ressenti && ex.ressenti.note && ex.rir && nx.c && (nx.ok !== false || (nx.pq || '').trim());
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
function carteMoi(at, ex, p){
  const e = EL(), r = ex.ressenti || {}, nx = ex.next || {}, coh = ex.coh, sens = p ? sensSuite(p.mob, ex) : null;
  const prop = p && sens != null ? ajuster(p.mob, p, sens) : null, ok = nx.c ? choixCoherent(sens, nx.c) : null;
  return `<div class="bcm moi"><h4><span>✎</span> Fin de l'exercice · ${esc(prenom(e.nom))} écrit</h4>
   ${ressentiHTML('exos.' + at + '.ressenti', r, true, true)}${coh && coh.stop ? `<p class="retour stop">⛔ ${esc(coh.msg)}</p>` : ''}
   <p class="bti">Combien aurais-tu pu en faire encore, propres ?</p><div class="seg">${RIR_Q.map(([k, t]) => `<button type="button" class="${ex.rir === k ? 'ici' : ''}" data-rir="${at}" data-v="${k}">${t}</button>`).join('')}</div>
   ${(() => {const sg = suggestionRM(e, at, ex, p);return sg ? `<div class="rappel"><p class="small">📈 <b>Ta charge max semble avoir monté</b> : ${sg.reps} rép. à ${fmtKg(sg.charge)} avec de la réserve, soit environ <b>${fmtKg(sg.cm)} → ${fmtKg(sg.est)}</b>. Les charges prévues monteront.</p><div class="rangee"><button type="button" class="bt mini ok" data-majrm="${at}">Mettre à jour</button><button type="button" class="bt mini" data-nonrm="${at}">Non, pas sûr</button></div></div>` : ex.rmMaj ? `<p class="small okc">📈 Charge max mise à jour : ${fmtKg(ex.rmMaj)}.</p>` : ''})()}
   <p class="bti">La prochaine fois, je…</p><div class="choix2">${NEXT_Q.map(([k, t]) => `<button type="button" class="${nx.c === k ? 'ici' : ''}" data-next="${at}" data-v="${k}">${esc(t)}</button>`).join('')}</div>
   ${nx.c && prop ? `<p class="retour ${ok === false ? 'non' : 'ok'}">${ex.rir && p ? esc(msgReserve(p.mob, ex.rir)) + ' ' : ''}L'appli proposait : <b>${esc(prop.txt.replace(/\.$/, ''))}</b>. ${ok === false ? 'Ton choix est différent : dis pourquoi.' : 'Ton choix va dans le même sens ✓'}</p>
     <input type="text" class="pq" maxlength="160" data-pq="${at}" value="${esc(nx.pq || '')}" placeholder="${ok === false ? 'Pourquoi ? ex. le dos s\'arrondissait à la fin' : 'Pourquoi (facultatif)'}">` : ''}</div>`;
}
function carteCoachM(at, ex, p, a, aut, estCle){
  const e = EL(), av = ex.avis || {}, niv = niveauCoach(), P_ = esc(prenom(e.nom)), nS = (av.signes || []).length;
  const pc = POINT_CLE[at] || (a.crit || [])[0] || '', objL = OBJ_M.filter(([k]) => k !== 'charge' || a.type === 'charge'), pr = p ? p.reps : 10;
  const monte = ex.next && ['serie', 'reps', 'chargeP'].includes(ex.next.c), defaut = av.cle === '0' || nS;
  return `<div class="bcm coach"><h4><span>⏱</span> Pendant les séries · ${esc(prenom(aut.nom))} coache ${P_}</h4><p class="small muted">Niveau ${niv} : ${['', 'je constate', 'je compte', 'je fixe un objectif'][niv]}${niv > 1 ? estCle ? ' · ⭐ exercice clé' : ` · <button type="button" class="lien" data-excle="${at}">⭐ en faire l'exercice clé</button>` : ''}</p>
   <p class="bti">Point clé : ${esc(pc)}</p><div class="seg deux">${[['1','✓ Tenu'],['0','À revoir']].map(([v, t]) => `<button type="button" class="${av.cle === v ? 'ici' + (v === '0' ? ' rouge' : '') : ''}" data-clevu="${at}" data-v="${v}">${t}</button>`).join('')}</div>
   <details class="sig"${nS ? ' open' : ''}><summary>▸ Signes de fatigue${nS ? ` <b>(${nS})</b>` : ''}</summary><div class="chips">${SIGNES.map(sg => `<button type="button" class="${(av.signes || []).includes(sg) ? 'ici' : ''}" data-signe="${esc(sg)}" data-at="${at}">${esc(sg)}</button>`).join('')}</div></details>
   ${niv >= 2 && estCle ? `<p class="bti">Répétitions propres, dernière série</p><div class="pas"><button type="button" data-propres="${at}" data-d="-1" aria-label="moins">−</button><b>${av.propres != null ? av.propres : '–'}</b><span>/ ${pr}</span><button type="button" data-propres="${at}" data-d="1" aria-label="plus">+</button></div>` : ''}
   <p class="bti">Ton conseil</p><div class="chips">${conseilsPour(ex).map(c => `<button type="button" class="${av.conseil === c ? 'ici' : ''}" data-conseil="${esc(c)}" data-at="${at}">${esc(c)}</button>`).join('')}</div>
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
  fenetre(`<h3>Exercices de ${S} (${esc(MOBILES[mob].nom)})</h3><p class="small muted">Gardez au moins un exercice du haut du corps et un du bas${mob === 'puiss' ? ' (en Puissance : squat haltères ou hip thrust)' : ''}.</p>
   ${l.map((id, i) => `<label class="ch">Exercice ${i + 1}</label><select data-liste="${i}">${dispo.map(a => `<option value="${a.id}"${a.id === id ? ' selected' : ''}>${esc(a.nom)} · ${a.zone}</option>`).join('')}</select>`).join('')}
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
  return `<section class="carte act"><h3>Comparer et choisir · ${esc(prenom(e.nom))}</h3><table class="tb"><tr><th>Mobile</th><th>Note moyenne</th><th>Cohérent</th><th>Mes mots</th></tr>
   ${Object.keys(MOBILE_DU_JOUR).map(S => {const m = MOBILE_DU_JOUR[S], st = statsMobile(e, S);return `<tr><td><b style="color:${MOBILES[m].coul}">${MOBILES[m].nom}</b></td><td>${st ? st.moy : '—'}</td><td>${st ? st.ok + '/' + st.n : '—'}</td><td>${st ? esc(st.mots.join(', ')) : ''}</td></tr>`}).join('')}</table>
   ${e.situe && suggestion(e.situe) ? `<p class="small muted">En S1, « Je me situe » suggérait : ${MOBILES[suggestion(e.situe)].nom}.</p>` : ''}
   <h4>Mon mobile pour le projet</h4><div class="mob-choix">${MOBILES_ORDRE.map(m => `<button type="button" class="${c.mob === m ? 'ici' : ''}" style="--mc:${MOBILES[m].coul}" data-choix="${m}"><img src="${MOB_IMG[m]}" alt=""><span>${c.mob === m ? '✓ ' : ''}${MOBILES[m].nom}</span></button>`).join('')}</div>
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
    if(nx.c === 'chargeP')px.pct = b('pct', 5);
    if(nx.c === 'chargeM')px.pct = b('pct', -5);
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
  const e = EL(), verrou = e.seances.S8 && Object.keys(e.seances.S8).length, rep = EVAL.repartitions.find(r => r[0] === e.afl.rep);
  if(rep && !OUVERT.has('afl'))return `<section class="carte"><button type="button" class="resume" data-ouvrir="afl"><span>🎯</span><span><b>Mon évaluation :</b> ${esc(rep[1])}<br><small>AFL2 : mes analyses · AFL3 : mon coaching (S4 à S7)</small></span><span class="small">✎</span></button></section>`;
  return `<section class="carte act"><h3>Mon évaluation AFL2 et AFL3</h3><p class="small">Elle commence en S4 : tes analyses de fin d'exercice comptent en AFL2, ton coaching du partenaire en AFL3. Choisis ta répartition des 8 points ; ${verrou ? '<b>verrouillée depuis la S8</b>' : 'elle se verrouille quand tu commences la S8'}.</p>
   <div class="choix2">${EVAL.repartitions.map(([k, t]) => `<button type="button" class="${e.afl.rep === k ? 'ici' : ''}" data-afl="${k}"${verrou ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>
   <p class="small muted">Rôle AFL3 : ${esc(EVAL.roles[0][1])} pour tous. ${esc(EVAL.roles[0][2])}</p>${rep ? `<button type="button" class="lien" data-replier="afl">Replier</button>` : ''}</section>`;
}

/* ================== Vue : charges ================== */
function vueCharges(){
  const e = EL(), ats = ATELIERS.filter(a => a.menu), nb = ats.filter(a => e.rm[a.id]).length;
  return `<h2>Mes charges max · ${esc(prenom(e.nom))}</h2><p class="retour ${nb >= OBJ_TESTS[0] ? 'ok' : 'non'}"><b>${nb} / ${ats.length}</b> charges max · objectif ${OBJ_TESTS[0]} à ${OBJ_TESTS[1]} à la fin de la S3. Un atelier sans charge max ne peut pas entrer dans ton projet.</p>
   <section class="carte"><p class="small">${rmVerrou(e) ? '🔒 <b>Évaluation en cours (S8-S9)</b> : les charges max ne bougent plus.' : 'Tu as progressé ? Touche <b>Modifier</b> avec une série réussie proprement (3 à 10 répétitions). L\'ancienne valeur reste dans l\'historique.'}</p><table class="tb"><tr><th>Atelier</th><th>Charge max</th><th></th></tr>${ats.map(a => {const r = e.rm[a.id], h = r && r.hist && r.hist.length ? r.hist : null;return `<tr><td>${esc(a.nom)} <span class="small muted">${esc(a.groupe)}</span>${imgAtelier(a.id) ? `<br><img class="ch-vign" src="${imgAtelier(a.id)}" alt="" loading="lazy">` : ''}</td><td>${r ? `${h ? `<span class="small muted">${h.map(x => fmtKg(x.cm)).join(' → ')} →</span> ` : ''}<b>${fmtKg(r.cm)}</b>${h && r.cm > h[0].cm ? ` <b class="okc">+${Math.round(100 * (r.cm / h[0].cm - 1))} %</b>` : ''}<br><span class="small muted">${esc(MODE_RM[r.mode] || r.mode)} · ${esc(r.date)}</span>` : '—'}</td><td><button type="button" class="bt mini" data-calc="${a.id}"${r ? '' : ' disabled'}>%</button> <button type="button" class="bt mini" data-direct="${a.id}"${rmVerrou(e) ? ' disabled' : ''}>${r ? 'Modifier' : '✏️ Saisir'}</button></td></tr>`}).join('')}</table></section>
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
      <div class="calc-res">${cm ? `<span>Ta charge max estimée</span><b>${fmtKg(cm)}</b><small>${fmtKg(ch)} × ${rp} rép. → ${fmtKg(ch)} × 36 ÷ (37 − ${rp})</small><button type="button" class="bt act" data-act="calcUtiliser" data-cm="${cm}">Voir mes charges à chaque % →</button>` : `<span>Entre une charge et 3 à 10 répétitions</span>`}</div>
      <p class="small muted">Plus la série est courte (3 à 6 répétitions), plus l'estimation est juste. Au-delà de 10, elle n'est plus fiable.</p>`;
  } else {
    const cm = num(CALC.cm), p = +CALC.p, r = cm > 0 ? chargeReelle(CALC.sup, cm * p / 100) : null, mob = MOBILES_ORDRE.filter(k => p >= MOBILES[k].pct[0] && p <= MOBILES[k].pct[1]);
    corps = `<label class="ch">Ma charge max (kg)</label><input class="calc-gros" type="number" inputmode="decimal" id="cCm" value="${CALC.cm}" placeholder="ex. 30">
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
  if(n < m.nbEx[0] || n > m.nbEx[1])l.push([false, `${m.nom} : ${m.nbEx[0] === m.nbEx[1] ? m.nbEx[0] : m.nbEx[0] + ' à ' + m.nbEx[1]} exercices (tu en as ${n}).`]);else l.push([true, `${n} exercices.`]);
  ['haut', 'bas'].forEach(z => {if(!zones.has(z))l.push([false, `Il manque un exercice ${z === 'haut' ? 'du haut du corps' : 'du bas du corps'} (développement harmonieux).`])});
  if(zones.has('haut') && zones.has('bas'))l.push([true, 'Haut et bas du corps : équilibré.']);
  pr.exos.forEach(x => {const a = atelier(x.at);if(a.plio){if(pr.mob !== 'puiss')l.push([false, `${a.nom} : réservé au mobile Puissance. Remplace-le.`])}else if(!a.menu)l.push([false, `${a.nom} : n'est plus proposé (poids du corps, à l'échauffement). Remplace-le.`]);else if(pr.mob === 'puiss' && !a.puissance)l.push([false, `${a.nom} : ne se travaille pas en Puissance (geste lent ou dos chargé).`])});
  const d = dureeProjet(pr.mob, pr.exos);l.push([d <= 60, `Durée estimée en binôme : ${d} min ${d <= 60 ? '(tient dans la séance)' : '(trop long : enlève un exercice ou une série)'}.`]);
  pr.exos.forEach(x => {const a = atelier(x.at);if(a.places)l.push([true, `${a.nom} : ${a.places} binômes au maximum en même temps, prévois une variante.`]);
    if(a.type === 'charge' && !cmDe(EL(), x.at))l.push([false, `${a.nom} : pas de charge max (saisie directe dans Charges).`])});
  return l;
}
function vueProjet(){
  const e = EL(), pr = e.projet;
  if(!pr){const m = (e.choix && e.choix.mob) || null;
    return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2><section class="carte act"><p>Choisis ton mobile${m ? ` (en S6 tu as choisi : <b>${MOBILES[m].nom}</b>)` : ''} :</p><div class="mob-choix">${MOBILES_ORDRE.map(k => `<button type="button" class="${m === k ? 'ici' : ''}" style="--mc:${MOBILES[k].coul}" data-nouveau-projet="${k}"><img src="${MOB_IMG[k]}" alt=""><span>${MOBILES[k].nom}</span></button>`).join('')}</div></section>${MOBILES_ORDRE.map(mobileHTML).join('')}`}
  const m = MOBILES[pr.mob], ctrl = controleProjet(pr);
  const dispo = dispoPour(pr.mob).filter(a => !pr.exos.some(x => x.at === a.id));
  return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2>
   <div class="mob-bandeau"><img src="${MOB_IMG[pr.mob]}" alt=""><span>Mon mobile : ${esc(m.nom)} · ${esc(m.theme)}</span></div>
   <section class="carte"><p>Mobile : <b style="color:${m.coul}">${m.nom}</b> (${m.theme}) · ${m.pct[0]}-${m.pct[1]} % · ${m.series[0]}-${m.series[1]} séries · ${m.reps[0]}-${m.reps[1]} rép. · récup ${m.recup}</p><button type="button" class="lien" data-act="changerMobile">changer de mobile</button></section>
   ${pr.exos.map((x, i) => {const a = atelier(x.at);return `<div class="ex"><header><b>${i + 1}. ${esc(a.nom)}</b><button type="button" class="bt mini danger" data-retirer="${i}">Retirer</button></header><p class="small muted">${esc(a.groupe)} · ${a.zone}</p>
     <div class="rangee">${pasHTML(i, 'series', x.series, 'séries')}${a.temps ? '' : pasHTML(i, 'reps', x.reps, 'rép.')}${a.type === 'charge' ? pasHTML(i, 'pct', x.pct, '%') : ''}</div>
     ${a.niveaux ? `<div class="chips">${a.niveaux.map((t, k) => `<button type="button" class="${x.niv === k ? 'ici' : ''}" data-pniv="${i}" data-k="${k}" title="${esc(t)}">Niv. ${k + 1}</button>`).join('')}</div>` : ''}</div>`}).join('')}
   <section class="carte"><label class="ch" for="ajEx">Ajouter un exercice</label><select id="ajEx"><option value="">—</option>${['haut', 'bas'].map(z => `<optgroup label="${z === 'haut' ? 'Haut du corps' : 'Bas du corps'}">${dispo.filter(a => a.zone === z).map(a => `<option value="${a.id}">${esc(a.nom)}</option>`).join('')}</optgroup>`).join('')}</select></section>
   <section class="carte ${ctrl.every(c => c[0]) ? 'info' : ''}"><h3>Vérification</h3>${ctrl.map(([ok, t]) => `<p class="small">${ok ? '✅' : '⚠️'} ${esc(t)}</p>`).join('')}</section>
   ${e.ajust.length ? `<section class="carte"><h3>Mes ajustements</h3>${e.ajust.map(a => `<p class="small"><b>${a.S} · ${esc(atelier(a.at).nom)}</b> : ${esc(a.txt)}${a.pourquoi ? ' · « ' + esc(a.pourquoi) + ' »' : ''}</p>`).join('')}</section>` : ''}`;
}
function pasHTML(i, k, v, u){return `<span class="rangee" style="gap:4px"><button type="button" class="bt mini" data-pas="${i}" data-k="${k}" data-d="-1">−</button><b style="min-width:64px;text-align:center">${v} ${u}</b><button type="button" class="bt mini" data-pas="${i}" data-k="${k}" data-d="1">+</button></span>`}
function bornes(mob, k){const m = MOBILES[mob];return k === 'pct' ? m.pct : k === 'series' ? m.series : m.reps}

/* ================== Vue : carnet ================== */
function vueCarnet(){
  const e = EL();
  return `<h2>Carnet · ${esc(e.nom)}</h2>
   ${e.situe && suggestion(e.situe) ? `<p>Je me situe : mobile suggéré <b>${MOBILES[suggestion(e.situe)].nom}</b>.</p>` : ''}
   ${e.choix && e.choix.mob ? `<div class="mob-bandeau"><img src="${MOB_IMG[e.choix.mob]}" alt=""><span>Mon mobile : ${esc(MOBILES[e.choix.mob].nom)}</span></div><p>Mobile choisi : <b>${MOBILES[e.choix.mob].nom}</b>${e.choix.pourquoi ? ' · « ' + esc(e.choix.pourquoi) + ' »' : ''}</p>` : ''}
   ${SEANCES_IDS.map(S => {const s = e.seances[S];if(!s || !Object.keys(s).length)return '';const ex = Object.entries(s.exos || {});
     return `<section class="carte"><h3>${S} · ${esc(seanceById(S).titre)}</h3>${s.forme ? `<p class="small">Forme : ${FORME[s.forme - 1][1]} ${FORME[s.forme - 1][2]}</p>` : ''}${s.ech && s.ech.pouls ? `<p class="small">Pouls d'échauffement : ${s.ech.pouls}</p>` : ''}
      ${ex.length ? `<table class="tb"><tr><th>Exercice</th><th>Réalisé</th><th>Ressenti</th></tr>${ex.map(([at, x]) => `<tr><td>${esc(atelier(at).nom)}</td><td>${x.real ? `${x.real.series}×${x.real.reps}${x.real.charge ? ' · ' + fmtKg(x.real.charge) : ''}` : '—'}</td><td>${x.ressenti && x.ressenti.note ? `${x.ressenti.note}${x.ressenti.mot ? ' · ' + esc(x.ressenti.mot) : ''} ${x.coh ? (x.coh.ok ? '✅' : '⚠️') : ''}` : '—'}</td></tr>`).join('')}</table>` : ''}
      ${s.analyse ? `<p class="small"><b>Analyse :</b> ${esc(s.analyse)}</p>` : ''}</section>`}).join('')}
   <section class="carte"><h3>Charges max</h3>${Object.keys(e.rm).length ? Object.entries(e.rm).map(([at, r]) => `<p class="small">${esc(atelier(at).nom)} : <b>${fmtKg(r.cm)}</b> (${r.mode === 'direct' ? 'saisie directe' : 'test'}, ${esc(r.date)})</p>`).join('') : '<p class="small muted">Pas encore de test.</p>'}</section>`;
}

/* ================== Vue : envoyer ================== */
function vueEnvoyer(){
  const der = (B.envois || []).slice(-1)[0];
  return `<h2>Envoyer le carnet</h2>
   <section class="carte act"><h3>📤 Fichier pour le Nuage</h3><p>En fin de séance : télécharge le fichier du carnet, puis dépose-le dans le dossier Nuage donné par le professeur.</p>
    <button type="button" class="bt act pleine" data-act="exporter">Télécharger le carnet</button>${CLASSES[B.classe] && CLASSES[B.classe].u ? `<a class="bt pleine" style="margin-top:8px" href="${esc(CLASSES[B.classe].u)}" target="_blank" rel="noopener">☁️ Ouvrir le dépôt Nuage de la classe</a>` : ''}${navigator.share ? `<button type="button" class="bt pleine" style="margin-top:8px" data-act="partager">Partager le fichier</button>` : ''}
    <p class="small muted">${der ? 'Dernier envoi : ' + esc(der) : 'Pas encore envoyé.'}</p></section>
   <section class="carte"><h3>Mots et défi</h3><p class="small">S1, S2 et S3 : le QR pour le nuage de mots de la classe et le défi.</p><div class="rangee">${['S1', 'S2', 'S3'].map(S => `<button type="button" class="bt mini" data-qr-s="${S}">QR ${S}</button>`).join('')}</div></section>
   <section class="carte"><h3>Ce téléphone</h3><p class="small">Les noms restent sur ce téléphone et dans le fichier envoyé au professeur. Rien n'est envoyé ailleurs.</p><div class="rangee"><button type="button" class="bt mini" data-act="fermerCarnet">Fermer le carnet</button><button type="button" class="bt mini danger" data-act="supprimer">Supprimer ce carnet</button></div></section>`;
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
  return {id:'demo0000', v:1, app:'musculation-eleves', classe:'DÉMO', cree:jour(), equipe:'B', listes:{}, motsClasse:['ça tape', 'lourd'], envois:[], e:[e1, e2]};
}

/* ================== Événements ================== */
document.addEventListener('toggle', ev => {const d = ev.target;if(d.dataset && d.dataset.wdet){d.open ? OUV_ECH.add(d.dataset.wdet) : OUV_ECH.delete(d.dataset.wdet)}}, true);
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,[data-fond]');if(!t)return;
  if(t.matches('[data-fond]')){if(ev.target === t)fermerFen();return}
  const d = t.dataset;
  if(d.onglet){ONGLET = d.onglet;rendre();window.scrollTo(0, 0);return}
  if(d.qui != null){P = +d.qui;rendre();return}
  if(d.seance){SEANCE = d.seance;rendre();window.scrollTo(0, 0);return}
  if(d.ouvrir){ouvrir(d.ouvrir);return}
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
  if(d.calcmode){CALC.mode = d.calcmode;rendreCalc();return}
  if(d.crp){CALC.rp = Math.min(10, Math.max(3, +CALC.rp + +d.crp));rendreCalc();return}
  if(d.cp){CALC.p = +d.cp;rendreCalc();return}
  if(d.wc){const k = d.wc, on = (sea(EL(), SEANCE).ech || {}).wc, etait = !!(on && on.includes(k));
    B.e.forEach(e => {const x = sea(e, SEANCE);x.ech = x.ech || {};x.ech.wc = x.ech.wc || [];const i = x.ech.wc.indexOf(k);if(etait && i >= 0)x.ech.wc.splice(i, 1);else if(!etait && i < 0)x.ech.wc.push(k)});
    sauver();rendre();return}
  if(d.wtim){wTimer(+d.wtim);return}
  if(d.wta === 'stop'){if(WT){clearInterval(WT.i);WT = null}const w = $('wtimer');if(w)w.hidden = true;return}
  if(d.poster){ouvrirPoster(d.poster);return}
  if(d.ech){ouvrirEchauf(d.ech);return}
  if(d.test){ouvrirTest(d.test);return}
  if(d.direct){saisieDirecte(d.direct);return}
  if(d.tcharge){const p = chargesPossibles(atelier(T.at).support), c = +d.tcharge > 0 ? p.find(x => x >= T.charge + T.pas - 1e-9) : [...p].reverse().find(x => x <= T.charge - T.pas + 1e-9);if(c != null)T.charge = c;rendreTest();return}
  if(d.equipe){B.equipe = d.equipe;sauver();rendre();return}
  if(d.niv != null && d.at){EL().niv[d.at] = +d.niv;sauver();rendre();return}
  if(d.fait){const p = prevuDe(EL(), SEANCE, d.fait), s = sea(EL(), SEANCE);s.exos = s.exos || {};const ex = s.exos[d.fait] = s.exos[d.fait] || {};
    ex.real = {series:p ? p.series : 3, reps:p ? p.reps : 10, charge:p && p.charge ? p.charge.charge : null, niv:p ? p.niv : null, diff:false};sauver();rendre();return}
  if(d.modif){modifierExo(d.modif);return}
  if(d.signe){const v = avisDe(d.at);v.signes = v.signes || [];const i = v.signes.indexOf(d.signe);i < 0 ? v.signes.push(d.signe) : v.signes.splice(i, 1);sauver();rendre();return}
  if(d.conseil){const v = avisDe(d.at);v.conseil = v.conseil === d.conseil ? '' : d.conseil;sauver();rendre();return}
  if(d.choix && !d.aj){const e = EL();e.choix = Object.assign(e.choix || {}, {mob:d.choix, date:jour()});sauver();rendre();return}
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
  if(d.nouveauProjet){const m = d.nouveauProjet, dp = DEF_PARAM[m];EL().projet = {mob:m, exos:[], cree:jour()};sauver();rendre();return}
  if(d.retirer != null){EL().projet.exos.splice(+d.retirer, 1);sauver();rendre();return}
  if(d.pas != null){const pr = EL().projet, x = pr.exos[+d.pas], k = d.k, [lo, hi] = bornes(pr.mob, k), step = k === 'pct' ? 5 : k === 'reps' ? 1 : 1;
    x[k] = Math.max(lo, Math.min(hi, x[k] + step * +d.d));sauver();rendre();return}
  if(d.pniv != null){EL().projet.exos[+d.pniv].niv = +d.k;sauver();rendre();return}
  if(d.qrS){SEANCE = d.qrS;afficherQRMots();return}
  switch(d.act){
    case 'creer': creer();break;
    case 'scanClasse': scanner();break;
    case 'fermerScan': fermerFen();break;
    case 'demo': DEMO = true;B = binomeDemo();P = 0;ONGLET = 'seance';SEANCE = 'S5';rendre();window.scrollTo(0, 0);break;
    case 'quitterDemo': DEMO = false;B = null;rendre();break;
    case 'mobiles': panneauMobiles();break;
    case 'calcUtiliser': CALC.cm = +d.cm;CALC.mode = 'pct';rendreCalc();break;
    case 'fichesLibres': FICHES_LIBRES = true;rendre();window.scrollTo(0, 0);break;
    case 'fichesRetour': FICHES_LIBRES = false;rendre();window.scrollTo(0, 0);break;
    case 'calcLibre': calcLibre();break;
    case 'fermerFen': fermerFen();break;
    case 'valCode': validerCode(d.id);break;
    case 'pouls': if(window.EPSPouls)EPSPouls.ouvrir({titre:'Pouls en fin d\'échauffement', onFC:v => {const s = sea(EL(), SEANCE);s.ech = s.ech || {};s.ech.pouls = v;sauver();rendre()}});else{const v = parseInt(prompt('Pulsations par minute :'), 10);if(v){const s = sea(EL(), SEANCE);s.ech = s.ech || {};s.ech.pouls = v;sauver();rendre()}}break;
    case 'qrMots': afficherQRMots();break;
    case 'changerListe': changerListe();break;
    case 'valListe': {const l = [...document.querySelectorAll('[data-liste]')].map(s => s.value);B.listes[SEANCE] = l;sauver();fermerFen();rendre();break}
    case 'valModif': {const a = atelier(d.at), s = sea(EL(), SEANCE), p = prevuDe(EL(), SEANCE, d.at) || {};s.exos = s.exos || {};const ex = s.exos[d.at] = s.exos[d.at] || {};
      const se = parseInt($('mSe').value, 10), rp = parseInt($('mRp').value, 10), ch = $('mCh') ? num($('mCh').value) : null;
      if(!se || !rp)return toast('Séries et répétitions.');if(!a.temps && rp < 3)return toast('Jamais moins de 3 répétitions.');
      ex.real = {series:se, reps:rp, charge:ch, niv:p.niv, diff:true};sauver();fermerFen();rendre();break}
    case 'valDirect': {const ch = num($('dCh').value), rp = parseInt($('dRp').value, 10), cm = brzycki(ch, rp);if(!cm){$('dRes').textContent = 'Une charge et 3 à 10 répétitions.';return}
      if(rmVerrou(EL()))return toast('Charges max bloquées pendant l\'évaluation (S8-S9).');majRM(EL(), d.at, {cm, charge:ch, reps:rp, date:jour(), mode:'direct'});sauver();fermerFen();rendre();toast('Charge max : ' + fmtKg(cm));break}
    case 'annulerTest': if(T.series.length && !confirm('Quitter le test sans enregistrer ?'))return;T = null;rendreTest();rendre();break;
    case 'tPlus': T.cpt++;T.suite = 0;if(T.cpt >= 10)finSerie();else rendreTest();break;
    case 'tNo': T.norep++;T.suite++;if(T.suite >= 2)finSerie();else rendreTest();break;
    case 'tFinSerie': finSerie();break;
    case 'tSuivante': T.phase = 'serie';rendreTest();break;
    case 'tValider': validerTest();break;
    case 'tRecommencer': {const p = chargesPossibles(atelier(T.at).support), c = [...p].reverse().find(x => x <= T.charge - 2 * T.pas + 1e-9);T.series = [];T.cpt = 0;T.norep = 0;T.phase = 'serie';if(c != null)T.charge = c;rendreTest();break}
    case 'changerMobile': if(confirm('Changer de mobile ? Tes exercices restent, leurs paramètres sont remis au milieu des fourchettes du nouveau mobile.')){const pr = EL().projet, ord = MOBILES_ORDRE, m = ord[(ord.indexOf(pr.mob) + 1) % 3];
      fenetre(`<h3>Nouveau mobile</h3><div class="mob-choix">${ord.map(k => `<button type="button" style="--mc:${MOBILES[k].coul}" data-chg-mob="${k}"><img src="${MOB_IMG[k]}" alt=""><span>${MOBILES[k].nom}</span></button>`).join('')}</div><button type="button" class="bt" data-act="fermerFen">Annuler</button>`)}break;
    case 'exporter': exporter();break;
    case 'partager': partager();break;
    case 'fermerCarnet': B = null;DEMO = false;rendre();break;
    case 'supprimer': if(DEMO){B = null;DEMO = false;rendre();break}
      if(!(B.envois || []).length && !confirm('Ce carnet n\'a jamais été envoyé. Le supprimer quand même ?'))return;
      if(prompt('Pour supprimer, tape SUPPRIMER') !== 'SUPPRIMER')return;delete CARNETS[B.id];ecrire(CLE, CARNETS);B = null;rendre();break;
  }
  if(d.chgMob){const pr = EL().projet;pr.mob = d.chgMob;const dp = DEF_PARAM[d.chgMob];pr.exos.forEach(x => Object.assign(x, {pct:dp.pct, series:dp.series, reps:dp.reps}));sauver();fermerFen();rendre()}
});
document.addEventListener('change', ev => {
  const t = ev.target, d = t.dataset;
  if(d.texte === 'choix'){const e = EL();e.choix = Object.assign(e.choix || {}, {pourquoi:t.value.trim()});sauver();return}
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

/* ---------- Code du cours (eps-code.js) : la saisie d'une séance n'est ouverte qu'en cours ---------- */
if(window.EPSCode)EPSCode.eleve({app:'mue', classe:() => B && !DEMO ? B.classe || '' : '', seance:() => SEANCE, seances:() => SEANCES_IDS,
  nom:x => x + ' · ' + (seanceById(x) || {titre:''}).titre, ouvrir:x => {SEANCE = x;ONGLET = 'seance';rendre()}, zone:'#main',
  actif:() => !!B && ONGLET === 'seance', libreSel:'.puces button,.qui button,[data-fiche],[data-poster],[data-ech],[data-libre],details summary,[data-act="mobiles"]', demo:() => DEMO, bandeau:true});

/* ---------- Démarrage ---------- */
if(/[?&]demo\b/.test(location.search)){DEMO = true;B = binomeDemo();SEANCE = 'S5'}
rendre();
if('serviceWorker' in navigator)window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
