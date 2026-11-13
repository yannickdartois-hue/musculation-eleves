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
let B = null;          // carnet ouvert
let P = 0;             // élève qui pratique (index dans B.e)
let ONGLET = 'seance';
let SEANCE = 'S1';
let DEMO = false;
const ONGLETS = [['seance','🏋️','Séance'],['charges','⚖️','Charges'],['projet','🎯','Projet'],['carnet','📒','Carnet'],['envoyer','📤','Envoyer']];
const SEANCES_IDS = SEANCES.map(s => s.id);
const MOBILE_DU_JOUR = {S3:'tonif', S4:'volume', S5:'puiss'};
const LISTES_DEFAUT = {S3:['pompes','rowh','fentes','montee','crunch','gainage'], S4:['dch','rowh','fentes','gainage'], S5:['sjump','fsaut','lancer','dch','dm']};
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
  if(!B){$('nav').hidden = true;$('btMob').hidden = true;$('sous').textContent = 'Lycée Georges Pompidou · CA5 Terminale';$('main').innerHTML = accueil();return}
  $('sous').textContent = (B.classe ? B.classe + ' · ' : '') + B.e.map(x => prenom(x.nom)).join(' & ');
  $('nav').hidden = false;$('btMob').hidden = false;
  $('nav').innerHTML = ONGLETS.map(([k, i, t]) => `<button type="button" data-onglet="${k}" class="${k === ONGLET ? 'ici' : ''}"><i>${i}</i>${t}</button>`).join('');
  const qui = `<div class="qui"><span>Qui pratique ?</span>${B.e.map((x, i) => `<button type="button" data-qui="${i}" class="${i === P ? 'ici' : ''}">${esc(prenom(x.nom))}</button>`).join('')}</div>`;
  const demo = DEMO ? `<div class="demo-bandeau"><span>👀 <b>Mode démo</b> : rien n'est enregistré.</span><button type="button" class="bt mini" data-act="quitterDemo">Quitter</button></div>` : '';
  const corps = {seance:vueSeance, charges:vueCharges, projet:vueProjet, carnet:vueCarnet, envoyer:vueEnvoyer}[ONGLET]();
  $('main').innerHTML = demo + (ONGLET === 'envoyer' ? '' : qui) + corps;
  window.scrollTo(0, y);
}

/* ================== Accueil ================== */
function accueil(){
  const l = Object.values(CARNETS).sort((a, b) => (b.maj || 0) - (a.maj || 0));
  return `<h2>Mon carnet de musculation</h2>
  ${l.length ? `<section class="carte"><h3>Carnets sur ce téléphone</h3>${l.map(c => `<button type="button" class="bt pleine" style="margin:6px 0;justify-content:flex-start" data-ouvrir="${c.id}">🔒 ${esc(c.e.map(x => x.nom).join(' & '))}${c.classe ? ` <span class="muted small">· ${esc(c.classe)}</span>` : ''}</button>`).join('')}</section>` : ''}
  <section class="carte act"><h3>＋ Nouveau binôme</h3><p class="small muted">Un carnet par binôme, sur le téléphone de l'un des deux. Écris le prénom ET le nom de chacun (comme sur Pronote).</p>
   <label class="ch" for="nClasse">Classe</label><input type="text" id="nClasse" placeholder="ex. TG3" maxlength="12" autocomplete="off">
   <label class="ch" for="nE1">Élève 1 : prénom et nom</label><input type="text" id="nE1" placeholder="ex. Léa MARTIN" autocomplete="off" maxlength="60">
   <label class="ch" for="nE2">Élève 2 : prénom et nom</label><input type="text" id="nE2" placeholder="ex. Hugo BERNARD" autocomplete="off" maxlength="60">
   <label class="ch" for="nE3">Élève 3, s'il y a un trinôme (facultatif)</label><input type="text" id="nE3" autocomplete="off" maxlength="60">
   <label class="ch" for="nCode">Code secret du binôme (4 chiffres)</label><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="nCode" class="code" autocomplete="off">
   <p class="small muted">Il protège votre carnet si le téléphone est prêté. Ne l'oubliez pas : le professeur ne peut pas le retrouver.</p>
   <button type="button" class="bt act pleine" data-act="creer">Créer le carnet</button></section>
  <section class="carte"><h3>👀 Découvrir l'appli</h3><p class="small muted">Un binôme fictif déjà rempli, pour voir tous les écrans. Rien n'est enregistré.</p><button type="button" class="bt" data-act="demo">Essayer l'appli (démo)</button></section>
  <section class="carte info"><h3>Sans carnet</h3><div class="rangee"><button type="button" class="bt mini" data-act="mobiles">📋 Les 3 mobiles</button><button type="button" class="bt mini" data-act="calcLibre">🧮 Calculette</button></div></section>`;
}
async function creer(){
  const classe = $('nClasse').value.trim(), noms = ['nE1', 'nE2', 'nE3'].map(i => $(i).value.trim().replace(/\s+/g, ' ')).filter(Boolean), code = $('nCode').value.trim();
  if(noms.length < 2)return toast('Écris les deux élèves du binôme.');
  if(noms.some(n => n.split(' ').length < 2))return toast('Prénom ET nom pour chaque élève, ex. Léa MARTIN.');
  if(!/^\d{4}$/.test(code))return toast('Le code secret : 4 chiffres.');
  const id = uid();
  B = {id, v:1, app:'musculation-eleves', classe, cree:jour(), maj:Date.now(), equipe:'', listes:{}, motsClasse:[], envois:[], e:noms.map(nouvelEleve), code:await empreinte(id, code)};
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

/* ================== Fenêtres ================== */
function fenetre(html){$('couche').innerHTML = `<div class="fen" data-fond><div role="dialog" aria-modal="true">${html}</div></div>`}
function fermerFen(){$('couche').innerHTML = ''}
function panneauMobiles(){
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>Les 3 mobiles</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>${MOBILES_ORDRE.map(mobileHTML).join('')}
   <h4>Échelle de ressentis</h4>${echelleHTML()}<h4>Sécurité</h4><ul class="ats small">${SECU.regles.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="small"><b>Respiration.</b> ${esc(SECU.respiration)}</p>`);
}

/* ================== Charges : calculs ================== */
function cmDe(e, at){const r = e.rm[at];return r && r.cm ? r.cm : null}
function prevuDe(e, S, at){
  const a = atelier(at);let mob, p;
  if(+S.slice(1) >= 6){const pr = e.projet;mob = pr && pr.mob;const x = pr && pr.exos.find(z => z.at === at);p = x ? {pct:x.pct, series:x.series, reps:x.reps, niv:x.niv} : null}
  else{mob = MOBILE_DU_JOUR[S];p = Object.assign({}, DEF_PARAM[mob])}
  if(!mob || !p)return null;
  if(a.type === 'variante' && p.niv == null)p.niv = e.niv[at] != null ? e.niv[at] : Math.min(1, (a.niveaux || []).length - 1);
  const s = sea(e, S);if(s.forme && s.forme <= 2 && +S.slice(1) >= 3)p.series = Math.max(2, p.series - 1);
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
function ressentiHTML(cle, r, avecSens){
  r = r || {};
  return `<div class="notes" role="group" aria-label="Note de 1 à 10">${ECHELLE.map(([n, t]) => `<button type="button" title="${esc(t)}" style="background:${couleurNote(n)}" class="${r.note === n ? 'ici' : ''}" data-note="${n}" data-cle="${cle}">${n}</button>`).join('')}</div>
   ${r.note ? `<p class="small muted">${r.note} : ${esc(ECHELLE[r.note - 1][1])} · ${esc(ECHELLE[r.note - 1][2])}</p>` : ''}
   <div class="chips">${vocab(EL()).map(m => `<button type="button" class="${r.mot === m ? 'ici' : ''}" data-mot="${esc(m)}" data-cle="${cle}">${esc(m)}</button>`).join('')}<button type="button" data-autremot data-cle="${cle}">✏️ autre mot</button></div>
   ${avecSens ? `<div class="chips">${SENSATIONS.map(([k, t]) => `<button type="button" class="${r.sens === k ? 'ici' : ''}${k === 'douleur' ? ' stop' : ''}" data-sens="${k}" data-cle="${cle}">${esc(t)}</button>`).join('')}</div>` : ''}`;
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
    if(ex && ex.ressenti && ex.ressenti.note && pr)ex.coh = coherence(pr.mob, ex.ressenti.note, ex.ressenti.sens)}
  sauver();
}

/* ================== Vue : séance ================== */
function vueSeance(){
  const s = seanceById(SEANCE), e = EL();
  const puces = `<div class="puces">${SEANCES_IDS.map(S => {const f = e.seances[S] && Object.keys(e.seances[S]).length;return `<button type="button" data-seance="${S}" class="${S === SEANCE ? 'ici' : ''}${f ? ' fait' : ''}">${S}</button>`}).join('')}</div>`;
  let h = puces + `<h2>${SEANCE} · ${esc(s.titre)}</h2><p class="muted small">${esc(s.obj)}</p>`;
  const n = +SEANCE.slice(1);
  if(n >= 3)h += carteForme();
  if(n <= 2)h += carteEchauffement(n === 1);
  if(n === 1)h += carteCircuit() + carteSitue() + carteQRMots();
  if(n === 2)h += carteTest() + carteDefi() + carteQRMots();
  if(n >= 3 && n <= 5)h += carteMobile(MOBILE_DU_JOUR[SEANCE]) + listeExos(LISTES_DEFAUT[SEANCE]) ;
  if(n === 5)h += carteComparer() + carteEchelle();
  if(n >= 6){
    const pr = e.projet;
    if(!pr || !pr.exos.length)h += `<section class="carte act"><h3>🎯 Construis d'abord ton projet</h3><p>Mobile, 3 groupes musculaires, 4 à 6 exercices.</p><button type="button" class="bt act" data-onglet="projet">Construire mon projet</button></section>`;
    else h += carteMobile(pr.mob) + listeExos(pr.exos.map(x => x.at), true) + (n <= 7 ? carteAjustements() : carteAnalyse());
    if(n === 6)h += carteAfl();
  }
  return h;
}
function carteForme(){
  const s = sea(EL(), SEANCE), n = +SEANCE.slice(1);
  return `<section class="carte"><h3>Mon état de forme aujourd'hui</h3><div class="chips">${FORME.map(([v, i, t]) => `<button type="button" class="${s.forme === v ? 'ici' : ''}" data-forme="${v}">${i} ${t}</button>`).join('')}</div>
   ${s.forme && s.forme <= 2 ? `<p class="retour non">Séance allégée aujourd'hui : une série de moins sur chaque exercice${n >= 6 ? ' (ton projet ne change pas)' : ''}.</p>` : ''}</section>`;
}
function carteEchauffement(s1){
  const s = sea(EL(), SEANCE), ech = s.ech || {};
  return `<section class="carte"><h3>Échauffement</h3><p class="small">${esc(ECH_BASE)}</p>
   <div class="rangee"><button type="button" class="bt mini" data-act="pouls">❤️ Prendre mon pouls</button>${ech.pouls ? `<b>${ech.pouls} puls/min</b>` : ''}</div>
   <h4>${s1 ? 'Après 2-3 min de course' : 'Début d\'échauffement'} : note et mot</h4>${ressentiHTML('ech.debut', ech.debut)}
   <h4>Fin d'échauffement : note et mot</h4>${ressentiHTML('ech.fin', ech.fin)}</section>`;
}
function ficheAtelier(a){
  return `<details><summary>Fiche : placement, respiration, sécurité</summary><p class="small muted">${esc(a.muscles)} · ${esc(SUPPORTS[a.support].nom)}</p><ul class="ats small">${a.crit.map(c => `<li>${esc(c)}</li>`).join('')}</ul><p class="small"><b>Respiration.</b> ${esc(a.resp)}</p><p class="small"><b>Sécurité.</b> ${esc(a.secu)}</p>${a.moins ? `<p class="small"><b>− Plus facile.</b> ${esc(a.moins)}</p>` : ''}${a.plus ? `<p class="small"><b>+ Plus difficile.</b> ${esc(a.plus)}</p>` : ''}</details>`;
}
function carteCircuit(){
  const s = sea(EL(), 'S1'), c = s.circuit || {};
  const fait = CIRCUIT_S1.filter(id => c[id]).length;
  return `<section class="carte"><h3>Circuit · 12 ateliers</h3><p class="small">5 min par atelier : 2 × 10 répétitions chacun, charge légère. On apprend le geste. <b>${fait}/12</b> faits.</p>
   ${CIRCUIT_S1.map((id, i) => {const a = atelier(id);return `<div class="ex${c[id] ? ' fait' : ''}"><header><b>${a.n}. ${esc(a.nom)}</b><button type="button" class="bt mini${c[id] ? ' ok' : ''}" data-circuit="${id}">${c[id] ? '✓ Fait' : 'Fait'}</button></header>${ficheAtelier(a)}</div>`}).join('')}</section>`;
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
   ${m ? `<p class="retour ok">Mobile suggéré : <b>${MOBILES[m].nom}</b> (${MOBILES[m].theme}). Tu les essaieras tous les trois avant de choisir en S5.</p>` : ''}</section>`;
}
/* ---------- Test 10 RM ---------- */
function carteTest(){
  const e = EL();
  return `<section class="carte"><h3>Test 10 RM · ${esc(prenom(e.nom))}</h3><p class="small">La charge la plus lourde soulevée 10 fois sans No REP, en montant progressivement. Le partenaire tient le téléphone et juge.</p>
   ${ATELIERS_TEST.map(id => {const a = atelier(id), r = e.rm[id];return `<div class="ex${r ? ' fait' : ''}"><header><b>${esc(a.nom)}</b>${r ? `<span><b>${fmtKg(r.cm)}</b> <span class="small muted">${r.mode === 'direct' ? 'saisie directe' : 'test'}</span></span>` : ''}</header>
     <div class="rangee"><button type="button" class="bt mini act" data-test="${id}">${r ? 'Refaire le test' : 'Commencer le test'}</button><button type="button" class="bt mini" data-direct="${id}">Saisie directe</button></div>${ficheAtelier(a)}</div>`}).join('')}</section>`;
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
  e.rm[T.at] = {cm:best.cm, charge:best.charge, reps:best.valides, date:jour(), mode:'test'};
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
   <p>Votre binôme rapporte <b>${fmtKg(d.kg)}</b> et <b>${d.q}</b> points de qualité.</p><p class="small muted">Kilos : la meilleure charge à 10 répétitions de chacun, sur les 6 ateliers. Qualité : + 1 par série sans No REP, + 2 par montée progressive, − 1 par No REP.</p></section>`;
}
/* ---------- QR « Mots et défi » (aucun nom) ---------- */
function carteQRMots(){return `<section class="carte info"><h3>Fin de séance : mots${SEANCE === 'S2' ? ' et défi' : ''}</h3><p class="small">Montre ce QR au professeur : il ajoute vos mots au nuage de la classe${SEANCE === 'S2' ? ' et vos points au défi' : ''}. Aucun nom n'est transmis.</p><button type="button" class="bt act" data-act="qrMots">Afficher le QR</button></section>`}
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
  if(SEANCE === 'S2' && B.equipe){const d = defiBinome();o.defi = {e:B.equipe, kg:d.kg, q:d.q}}
  const txt = await chaineQR(o);
  fenetre(`<h3>Mots${o.defi ? ' et défi' : ''} · ${SEANCE}</h3><div class="qr">${svgQR(txt)}</div><p class="small">${m.debut.length + m.fin.length} mot(s)${o.defi ? ` · équipe ${o.defi.e} : ${fmtKg(o.defi.kg)}, ${o.defi.q} pts de qualité` : SEANCE === 'S2' ? ' · ⚠️ choisis ton équipe pour le défi' : ''}</p><button type="button" class="bt pleine" data-act="fermerFen">Fermer</button>`);
}
/* ---------- Mobile du jour et exercices ---------- */
function carteMobile(mob){return mob ? `<details class="carte"><summary>📋 Le mobile ${esc(MOBILES[mob].nom)} : paramètres et sensation attendue</summary>${mobileHTML(mob)}</details>` : ''}
function listeExos(ids, projet){
  const e = EL(), S = SEANCE, s = sea(e, S);s.exos = s.exos || {};
  if(!projet){const l = B.listes[S];if(l)ids = l}
  return `<h3 style="margin-top:16px">Les exercices · ${esc(prenom(e.nom))}</h3>${projet ? '' : `<p class="small muted">Liste du binôme ; <button type="button" class="lien" data-act="changerListe">changer un exercice</button>.</p>`}` + ids.map(at => carteExo(at)).join('');
}
function carteExo(at){
  const e = EL(), a = atelier(at), p = prevuDe(e, SEANCE, at), ex = (sea(e, SEANCE).exos || {})[at] || {};
  const r = ex.ressenti || {}, coh = ex.coh, aut = autre();
  const etat = ex.real ? (coh && !coh.ok ? ' alerte' : ' fait') : '';
  let h = `<div class="ex${etat}" id="ex-${at}"><header><b>${esc(a.nom)}</b><span class="small muted">${esc(a.groupe)}</span></header>${prevuTexte(a, p)}`;
  if(a.type === 'charge' && !(p && p.charge))h += `<p class="small">Pas encore de charge max sur cet atelier : <button type="button" class="lien" data-direct="${at}">saisie directe</button> (une série réussie entre 3 et 10 répétitions).</p>`;
  if(a.type === 'variante' && a.niveaux)h += `<div class="chips">${a.niveaux.map((t, i) => `<button type="button" class="${p && p.niv === i ? 'ici' : ''}" data-niv="${i}" data-at="${at}" title="${esc(t)}">Niv. ${i + 1}</button>`).join('')}</div>`;
  h += ficheAtelier(a);
  if(!ex.real)h += `<div class="rangee"><button type="button" class="bt ok" data-fait="${at}">✓ Fait comme prévu</button><button type="button" class="bt" data-modif="${at}">Fait autrement</button></div>`;
  else h += `<p class="small">✓ Réalisé : ${ex.real.series} séries × ${ex.real.reps}${a.temps ? ' s' : ' rép.'}${ex.real.charge ? ' à ' + fmtKg(ex.real.charge) : ''}${ex.real.diff ? ' <b>(différent du prévu)</b>' : ''} <button type="button" class="lien" data-modif="${at}">modifier</button></p>
    <h4>Mon ressenti</h4>${ressentiHTML('exos.' + at + '.ressenti', r, true)}
    ${coh ? `<p class="retour ${coh.stop ? 'stop' : coh.ok ? 'ok' : 'non'}">${coh.ok ? '✅ ' : coh.stop ? '⛔ ' : '⚠️ '}${esc(coh.msg)}</p>` : ''}
    ${aut ? `<details${ex.avis ? ' open' : ''}><summary>👀 Avis du partenaire (${esc(prenom(aut.nom))})</summary><p class="small">Signes vus pendant la série :</p><div class="chips">${SIGNES.map(sg => `<button type="button" class="${ex.avis && ex.avis.signes.includes(sg) ? 'ici' : ''}" data-signe="${esc(sg)}" data-at="${at}">${esc(sg)}</button>`).join('')}</div>
      <p class="small">Un conseil :</p><div class="chips">${CONSEILS.map(c => `<button type="button" class="${ex.avis && ex.avis.conseil === c ? 'ici' : ''}" data-conseil="${esc(c)}" data-at="${at}">${esc(c)}</button>`).join('')}</div></details>` : ''}`;
  return h + '</div>';
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
  const dispo = ATELIERS.filter(a => mob === 'puiss' ? (a.puissance || a.type === 'charge') : !a.puissance);
  fenetre(`<h3>Exercices de ${S} (${esc(MOBILES[mob].nom)})</h3><p class="small muted">Gardez au moins un exercice du haut du corps, un du bas et un du tronc${mob === 'puiss' ? ' (en Puissance : sauts pour le bas du corps)' : ''}.</p>
   ${l.map((id, i) => `<label class="ch">Exercice ${i + 1}</label><select data-liste="${i}">${dispo.map(a => `<option value="${a.id}"${a.id === id ? ' selected' : ''}>${esc(a.nom)} · ${a.zone}</option>`).join('')}</select>`).join('')}
   <div class="rangee" style="margin-top:12px"><button type="button" class="bt act" data-act="valListe">Enregistrer</button><button type="button" class="bt" data-act="fermerFen">Annuler</button></div>`);
}
/* ---------- S5 : comparer, choisir, échelle ---------- */
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
   ${['S3', 'S4', 'S5'].map(S => {const m = MOBILE_DU_JOUR[S], st = statsMobile(e, S);return `<tr><td><b style="color:${MOBILES[m].coul}">${MOBILES[m].nom}</b></td><td>${st ? st.moy : '—'}</td><td>${st ? st.ok + '/' + st.n : '—'}</td><td>${st ? esc(st.mots.join(', ')) : ''}</td></tr>`}).join('')}</table>
   ${e.situe && suggestion(e.situe) ? `<p class="small muted">En S1, « Je me situe » suggérait : ${MOBILES[suggestion(e.situe)].nom}.</p>` : ''}
   <h4>Mon mobile pour le projet</h4><div class="chips">${MOBILES_ORDRE.map(m => `<button type="button" class="${c.mob === m ? 'ici' : ''}" data-choix="${m}">${MOBILES[m].nom} · ${MOBILES[m].theme}</button>`).join('')}</div>
   <label class="ch" for="choixPq">Pourquoi ? Quelle sensation te le dit ?</label><textarea id="choixPq" data-texte="choix">${esc(c.pourquoi || '')}</textarea></section>`;
}
function carteEchelle(){
  const e = EL(), voc = vocab(e);
  return `<section class="carte"><h3>Mon échelle de ressentis</h3><p class="small">Pour chaque niveau, ton mot à toi (pris dans les mots de la classe ou le tien).</p>
   ${ECHELLE.map(([n, t, d, c]) => `<div class="rangee" style="margin:4px 0"><span style="background:${c};border-radius:10px;min-width:44px;text-align:center;font:800 22px/44px var(--d);color:#1c2128">${n}</span><span class="small" style="flex:1">${esc(t)}</span><select data-echelle="${n}" style="flex:1.2;min-height:44px"><option value="">—</option>${[...new Set(voc.concat(e.echelle[n] ? [e.echelle[n]] : []))].map(m => `<option${e.echelle[n] === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`).join('')}
   <p class="small"><button type="button" class="lien" data-autremot data-cle="echelle">✏️ ajouter un mot à ma liste</button></p></section>`;
}
/* ---------- S6-S9 : ajustements, analyse, AFL ---------- */
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
  const e = EL(), verrou = e.seances.S7 && Object.keys(e.seances.S7).length;
  return `<section class="carte"><h3>Mon évaluation AFL2 et AFL3</h3><p class="small">Choix à faire en S6 ; ${verrou ? '<b>verrouillé depuis la S7</b>' : 'il se verrouille dès que tu commences la S7'}.</p>
   <h4>Répartition des 8 points</h4><div class="chips">${EVAL.repartitions.map(([k, t]) => `<button type="button" class="${e.afl.rep === k ? 'ici' : ''}" data-afl="${k}"${verrou ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>
   <h4>Mon rôle évalué (AFL3)</h4>${EVAL.roles.map(([k, t, d]) => `<button type="button" class="bt pleine${e.afl.role === k ? ' noir' : ''}" style="margin:4px 0;justify-content:flex-start;text-align:left;height:auto;padding:8px 14px;flex-direction:column;align-items:flex-start" data-role="${k}"${verrou ? ' disabled' : ''}><span>${esc(t)}</span><span class="small" style="font-weight:400">${esc(d)}</span></button>`).join('')}</section>`;
}

/* ================== Vue : charges ================== */
function vueCharges(){
  const e = EL(), ats = ATELIERS.filter(a => a.type === 'charge');
  return `<h2>Mes charges · ${esc(prenom(e.nom))}</h2>
   <section class="carte"><table class="tb"><tr><th>Atelier</th><th>Charge max</th><th></th></tr>${ats.map(a => {const r = e.rm[a.id];return `<tr><td>${esc(a.nom)}${a.test ? ' <span class="small muted">test</span>' : ''}</td><td>${r ? `<b>${fmtKg(r.cm)}</b><br><span class="small muted">${r.mode === 'direct' ? 'saisie directe' : 'test'} · ${esc(r.date)}</span>` : '—'}</td><td><button type="button" class="bt mini" data-calc="${a.id}"${r ? '' : ' disabled'}>%</button> <button type="button" class="bt mini" data-direct="${a.id}">✏️</button></td></tr>`}).join('')}</table></section>
   <section class="carte info"><h3>🧮 Calculette libre</h3><p class="small">Tape une charge max et choisis le matériel : l'appli donne les charges de 30 à 80 % et les disques à mettre.</p><button type="button" class="bt" data-act="calcLibre">Ouvrir la calculette</button></section>`;
}
function tableauCharges(sup, cm){
  return `<table class="tb"><tr><th>%</th><th>Charge réelle</th><th>Mobile</th></tr>${[30,40,50,55,60,65,70,75,80].map(p => {const r = chargeReelle(sup, cm * p / 100), mobs = MOBILES_ORDRE.filter(k => p >= MOBILES[k].pct[0] && p <= MOBILES[k].pct[1]);
    return `<tr><td><b>${p} %</b></td><td>${r ? `<b>${fmtKg(r.charge)}</b><br><span class="small muted">${esc(r.compo)}</span>` : '—'}</td><td>${mobs.map(k => `<span style="color:${MOBILES[k].coul};font-weight:700">${MOBILES[k].court}</span>`).join(' ')}</td></tr>`}).join('')}</table>`;
}
function calcAtelier(at){const a = atelier(at), cm = cmDe(EL(), at);fenetre(`<div class="rangee" style="justify-content:space-between"><h3>${esc(a.nom)} · ${fmtKg(cm)}</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>${tableauCharges(a.support, cm)}`)}
function calcLibre(){
  fenetre(`<div class="rangee" style="justify-content:space-between"><h3>🧮 Calculette</h3><button type="button" class="bt mini" data-act="fermerFen">Fermer</button></div>
   <label class="ch">Charge max (kg)</label><input type="number" inputmode="decimal" id="lCm">
   <p class="small">ou une série réussie : <input type="number" inputmode="decimal" id="lCh" placeholder="charge" style="width:110px;display:inline-block"> kg × <input type="number" inputmode="numeric" id="lRp" placeholder="rép." style="width:90px;display:inline-block"></p>
   <label class="ch">Matériel</label><select id="lSup">${Object.entries(SUPPORTS).filter(([k, s]) => s.disques || s.fixes).map(([k, s]) => `<option value="${k}">${esc(s.nom)}</option>`).join('')}</select><div id="lRes" style="margin-top:10px"></div>`);
}
function majCalcLibre(){
  const z = $('lRes');if(!z)return;let cm = num($('lCm').value);const ch = num($('lCh').value), rp = parseInt($('lRp').value, 10);
  if(ch && rp){const b = brzycki(ch, rp);if(b){cm = b;$('lCm').value = b}else{z.innerHTML = '<p class="small muted">Entre 3 et 10 répétitions.</p>';return}}
  z.innerHTML = cm > 0 ? tableauCharges($('lSup').value, cm) : '<p class="small muted">Tape une charge max.</p>';
}

/* ================== Vue : projet ================== */
function controleProjet(pr){
  const m = MOBILES[pr.mob], l = [], zones = new Set(pr.exos.map(x => atelier(x.at).zone));
  const n = pr.exos.length;
  if(n < m.nbEx[0] || n > m.nbEx[1])l.push([false, `${m.nom} : ${m.nbEx[0] === m.nbEx[1] ? m.nbEx[0] : m.nbEx[0] + ' à ' + m.nbEx[1]} exercices (tu en as ${n}).`]);else l.push([true, `${n} exercices.`]);
  ['haut', 'bas', 'tronc'].forEach(z => {if(!zones.has(z))l.push([false, `Il manque un exercice ${z === 'haut' ? 'du haut du corps' : z === 'bas' ? 'du bas du corps' : 'du tronc'} (développement harmonieux).`])});
  if(zones.size === 3)l.push([true, 'Haut du corps, bas du corps et tronc : équilibré.']);
  const d = dureeProjet(pr.mob, pr.exos);l.push([d <= 60, `Durée estimée en binôme : ${d} min ${d <= 60 ? '(tient dans la séance)' : '(trop long : enlève un exercice ou une série)'}.`]);
  pr.exos.forEach(x => {const a = atelier(x.at);if(a.places)l.push([true, `${a.nom} : ${a.places} binômes au maximum en même temps, prévois une variante.`]);
    if(a.type === 'charge' && !cmDe(EL(), x.at))l.push([false, `${a.nom} : pas de charge max (saisie directe dans Charges).`])});
  return l;
}
function vueProjet(){
  const e = EL(), pr = e.projet;
  if(!pr){const m = (e.choix && e.choix.mob) || null;
    return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2><section class="carte act"><p>Choisis ton mobile${m ? ` (en S5 tu as choisi : <b>${MOBILES[m].nom}</b>)` : ''} :</p><div class="chips">${MOBILES_ORDRE.map(k => `<button type="button" class="${m === k ? 'ici' : ''}" data-nouveau-projet="${k}">${MOBILES[k].nom}</button>`).join('')}</div></section>${MOBILES_ORDRE.map(mobileHTML).join('')}`}
  const m = MOBILES[pr.mob], ctrl = controleProjet(pr);
  const dispo = ATELIERS.filter(a => pr.mob === 'puiss' ? (a.puissance || a.type === 'charge') : !a.puissance).filter(a => !pr.exos.some(x => x.at === a.id));
  return `<h2>Mon projet · ${esc(prenom(e.nom))}</h2>
   <section class="carte"><p>Mobile : <b style="color:${m.coul}">${m.nom}</b> (${m.theme}) · ${m.pct[0]}-${m.pct[1]} % · ${m.series[0]}-${m.series[1]} séries · ${m.reps[0]}-${m.reps[1]} rép. · récup ${m.recup}</p><button type="button" class="lien" data-act="changerMobile">changer de mobile</button></section>
   ${pr.exos.map((x, i) => {const a = atelier(x.at);return `<div class="ex"><header><b>${i + 1}. ${esc(a.nom)}</b><button type="button" class="bt mini danger" data-retirer="${i}">Retirer</button></header><p class="small muted">${esc(a.groupe)} · ${a.zone}</p>
     <div class="rangee">${pasHTML(i, 'series', x.series, 'séries')}${a.temps ? '' : pasHTML(i, 'reps', x.reps, 'rép.')}${a.type === 'charge' ? pasHTML(i, 'pct', x.pct, '%') : ''}</div>
     ${a.niveaux ? `<div class="chips">${a.niveaux.map((t, k) => `<button type="button" class="${x.niv === k ? 'ici' : ''}" data-pniv="${i}" data-k="${k}" title="${esc(t)}">Niv. ${k + 1}</button>`).join('')}</div>` : ''}</div>`}).join('')}
   <section class="carte"><label class="ch" for="ajEx">Ajouter un exercice</label><select id="ajEx"><option value="">—</option>${['haut', 'bas', 'tronc'].map(z => `<optgroup label="${z === 'haut' ? 'Haut du corps' : z === 'bas' ? 'Bas du corps' : 'Tronc'}">${dispo.filter(a => a.zone === z).map(a => `<option value="${a.id}">${esc(a.nom)}</option>`).join('')}</optgroup>`).join('')}</select></section>
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
   ${e.choix && e.choix.mob ? `<p>Mobile choisi : <b>${MOBILES[e.choix.mob].nom}</b>${e.choix.pourquoi ? ' · « ' + esc(e.choix.pourquoi) + ' »' : ''}</p>` : ''}
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
    <button type="button" class="bt act pleine" data-act="exporter">Télécharger le carnet</button>${navigator.share ? `<button type="button" class="bt pleine" style="margin-top:8px" data-act="partager">Partager le fichier</button>` : ''}
    <p class="small muted">${der ? 'Dernier envoi : ' + esc(der) : 'Pas encore envoyé.'}</p></section>
   <section class="carte"><h3>Mots et défi</h3><p class="small">S1 et S2 : le QR pour le nuage de mots de la classe et le défi.</p><div class="rangee">${['S1', 'S2'].map(S => `<button type="button" class="bt mini" data-qr-s="${S}">QR ${S}</button>`).join('')}</div></section>
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
  rm(e1, [['dch', 14], ['dc', 24], ['rowh', 12], ['curlb', 16], ['extri', 14], ['dm', 8], ['fentes', 10]]);
  rm(e2, [['dch', 22], ['dc', 40], ['rowh', 18], ['curlb', 26], ['extri', 22], ['dm', 13], ['fentes', 16]]);
  e1.tests.dc = {series:[{charge:12, valides:10, norep:0}, {charge:16, valides:10, norep:0}, {charge:20, valides:7, norep:1}], ressentis:{premiere:{note:4, mot:'léger'}, derniere:{note:8, mot:'ça brûle'}}};
  e1.seances.S1 = {ech:{pouls:148, debut:{note:3, mot:'chaud'}, fin:{note:5, mot:'essoufflé'}}, circuit:Object.fromEntries(CIRCUIT_S1.slice(0, 10).map(x => [x, true]))};
  e1.seances.S3 = {forme:4, exos:{pompes:{real:{series:3, reps:15}, ressenti:{note:6, mot:'ça picote', sens:'locale'}}, rowh:{real:{series:3, reps:15, charge:7}, ressenti:{note:4, mot:'léger', sens:'rien'}}}};
  e1.seances.S4 = {forme:3, exos:{dch:{real:{series:4, reps:10, charge:8}, ressenti:{note:8, mot:'ça gonfle', sens:'brulure'}}, fentes:{real:{series:4, reps:10, charge:7}, ressenti:{note:8, mot:'ça brûle', sens:'brulure'}}}};
  e1.seances.S5 = {forme:4, exos:{sjump:{real:{series:4, reps:5}, ressenti:{note:6, mot:'compact', sens:'tension'}}}};
  [['S3', 'tonif'], ['S4', 'volume'], ['S5', 'puiss']].forEach(([S, m]) => Object.values(e1.seances[S].exos).forEach(x => x.coh = coherence(m, x.ressenti.note, x.ressenti.sens)));
  e1.choix = {mob:'volume', pourquoi:"C'est en Volume que j'ai senti mes muscles gonfler, et c'est ce que je cherche."};
  e1.echelle = {3:'léger', 5:'chaud', 6:'ça picote', 7:'ça brûle', 8:'ça gonfle', 10:'je bloque'};
  e1.projet = {mob:'volume', exos:[{at:'dch', series:4, reps:10, pct:70}, {at:'rowh', series:4, reps:10, pct:70}, {at:'fentes', series:4, reps:10, pct:70}, {at:'gainage', series:4, reps:10, pct:70, niv:1}]};
  e1.afl = {rep:'4/4', role:'coach'};
  return {id:'demo0000', v:1, app:'musculation-eleves', classe:'DÉMO', cree:jour(), equipe:'B', listes:{}, motsClasse:['ça tape', 'lourd'], envois:[], e:[e1, e2]};
}

/* ================== Événements ================== */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,[data-fond]');if(!t)return;
  if(t.matches('[data-fond]')){if(ev.target === t)fermerFen();return}
  const d = t.dataset;
  if(d.onglet){ONGLET = d.onglet;rendre();window.scrollTo(0, 0);return}
  if(d.qui != null){P = +d.qui;rendre();return}
  if(d.seance){SEANCE = d.seance;rendre();window.scrollTo(0, 0);return}
  if(d.ouvrir){ouvrir(d.ouvrir);return}
  if(d.note && d.cle){const o = d.cle === 'echelle' ? null : objetCle(d.cle, true);if(o){o.note = +d.note;apresRessenti(d.cle)}T ? rendreTest() : rendre();return}
  if(d.mot != null && d.cle){const o = objetCle(d.cle, true);o.mot = o.mot === d.mot ? '' : d.mot;apresRessenti(d.cle);T ? rendreTest() : rendre();return}
  if(t.hasAttribute('data-autremot')){const m = (prompt('Ton mot :') || '').trim().slice(0, 30);if(!m)return;B.motsClasse = [...new Set((B.motsClasse || []).concat(m))];
    if(d.cle !== 'echelle'){const o = objetCle(d.cle, true);o.mot = m;apresRessenti(d.cle)}else sauver();T ? rendreTest() : rendre();return}
  if(d.sens && d.cle){const o = objetCle(d.cle, true);o.sens = d.sens;apresRessenti(d.cle);rendre();return}
  if(d.forme){sea(EL(), SEANCE).forme = +d.forme;sauver();rendre();return}
  if(d.circuit){const s = sea(EL(), 'S1');s.circuit = s.circuit || {};s.circuit[d.circuit] = !s.circuit[d.circuit];sauver();rendre();return}
  if(d.situe){const e = EL();e.situe = e.situe || {};if(d.multi){const l = e.situe[d.situe] = e.situe[d.situe] || [];const i = l.indexOf(d.v);i < 0 ? l.push(d.v) : l.splice(i, 1)}else e.situe[d.situe] = d.v;sauver();rendre();return}
  if(d.test){ouvrirTest(d.test);return}
  if(d.direct){saisieDirecte(d.direct);return}
  if(d.tcharge){const p = chargesPossibles(atelier(T.at).support), c = +d.tcharge > 0 ? p.find(x => x >= T.charge + T.pas - 1e-9) : [...p].reverse().find(x => x <= T.charge - T.pas + 1e-9);if(c != null)T.charge = c;rendreTest();return}
  if(d.equipe){B.equipe = d.equipe;sauver();rendre();return}
  if(d.niv != null && d.at){EL().niv[d.at] = +d.niv;sauver();rendre();return}
  if(d.fait){const p = prevuDe(EL(), SEANCE, d.fait), s = sea(EL(), SEANCE);s.exos = s.exos || {};const ex = s.exos[d.fait] = s.exos[d.fait] || {};
    ex.real = {series:p ? p.series : 3, reps:p ? p.reps : 10, charge:p && p.charge ? p.charge.charge : null, niv:p ? p.niv : null, diff:false};sauver();rendre();return}
  if(d.modif){modifierExo(d.modif);return}
  if(d.signe){const ex = sea(EL(), SEANCE).exos[d.at];ex.avis = ex.avis || {par:autre() ? autre().nom : '', signes:[], conseil:''};const i = ex.avis.signes.indexOf(d.signe);i < 0 ? ex.avis.signes.push(d.signe) : ex.avis.signes.splice(i, 1);sauver();rendre();return}
  if(d.conseil){const ex = sea(EL(), SEANCE).exos[d.at];ex.avis = ex.avis || {par:autre() ? autre().nom : '', signes:[], conseil:''};ex.avis.conseil = ex.avis.conseil === d.conseil ? '' : d.conseil;sauver();rendre();return}
  if(d.choix && !d.aj){const e = EL();e.choix = Object.assign(e.choix || {}, {mob:d.choix, date:jour()});sauver();rendre();return}
  if(d.aj){const e = EL(), pr = e.projet, x = pr.exos.find(z => z.at === d.aj), s = sea(e, SEANCE), coh = s.exos[d.aj].coh, prop = ajuster(pr.mob, x, coh.sens), pq = ($('pq-' + d.aj) || {}).value || '';
    if(!pq.trim() && !confirm('Sans justification, cet ajustement ne compte pas dans ton analyse. Continuer ?'))return;
    s.ajust = s.ajust || {};s.ajust[d.aj] = {choix:d.choix, pourquoi:pq.trim(), avant:Object.assign({}, x)};
    if(d.choix === 'ok')Object.assign(x, prop.p);
    e.ajust.push({S:SEANCE, at:d.aj, txt:d.choix === 'ok' ? prop.txt : 'gardé tel quel', pourquoi:pq.trim(), date:jour()});sauver();rendre();return}
  if(d.annulerAj){const e = EL(), s = sea(e, SEANCE), a = s.ajust[d.annulerAj];if(a && a.avant){const x = e.projet.exos.find(z => z.at === d.annulerAj);Object.assign(x, a.avant)}delete s.ajust[d.annulerAj];
    const i = e.ajust.map(z => z.S + z.at).lastIndexOf(SEANCE + d.annulerAj);if(i >= 0)e.ajust.splice(i, 1);sauver();rendre();return}
  if(d.afl){EL().afl.rep = d.afl;sauver();rendre();return}
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
    case 'demo': DEMO = true;B = binomeDemo();P = 0;ONGLET = 'seance';SEANCE = 'S4';rendre();window.scrollTo(0, 0);break;
    case 'quitterDemo': DEMO = false;B = null;rendre();break;
    case 'mobiles': panneauMobiles();break;
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
      EL().rm[d.at] = {cm, charge:ch, reps:rp, date:jour(), mode:'direct'};sauver();fermerFen();rendre();toast('Charge max : ' + fmtKg(cm));break}
    case 'annulerTest': if(T.series.length && !confirm('Quitter le test sans enregistrer ?'))return;T = null;rendreTest();rendre();break;
    case 'tPlus': T.cpt++;T.suite = 0;if(T.cpt >= 10)finSerie();else rendreTest();break;
    case 'tNo': T.norep++;T.suite++;if(T.suite >= 2)finSerie();else rendreTest();break;
    case 'tFinSerie': finSerie();break;
    case 'tSuivante': T.phase = 'serie';rendreTest();break;
    case 'tValider': validerTest();break;
    case 'tRecommencer': {const p = chargesPossibles(atelier(T.at).support), c = [...p].reverse().find(x => x <= T.charge - 2 * T.pas + 1e-9);T.series = [];T.cpt = 0;T.norep = 0;T.phase = 'serie';if(c != null)T.charge = c;rendreTest();break}
    case 'changerMobile': if(confirm('Changer de mobile ? Tes exercices restent, leurs paramètres sont remis au milieu des fourchettes du nouveau mobile.')){const pr = EL().projet, ord = MOBILES_ORDRE, m = ord[(ord.indexOf(pr.mob) + 1) % 3];
      fenetre(`<h3>Nouveau mobile</h3><div class="chips">${ord.map(k => `<button type="button" data-chg-mob="${k}">${MOBILES[k].nom}</button>`).join('')}</div><button type="button" class="bt" data-act="fermerFen">Annuler</button>`)}break;
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
  if(t.id === 'ajEx' && t.value){const pr = EL().projet, a = atelier(t.value), dp = DEF_PARAM[pr.mob];pr.exos.push({at:t.value, series:dp.series, reps:dp.reps, pct:dp.pct, niv:a.niveaux ? Math.min(1, a.niveaux.length - 1) : null});sauver();rendre();return}
  if(t.id === 'lSup')majCalcLibre();
});
document.addEventListener('input', ev => {if(['lCm', 'lCh', 'lRp'].includes(ev.target.id))majCalcLibre()});
document.addEventListener('keydown', ev => {if(ev.key === 'Enter' && ev.target.id === 'oCode'){const b = document.querySelector('[data-act="valCode"]');if(b)b.click()}});
$('btMob').onclick = panneauMobiles;
window.addEventListener('eps-avant-maj', () => sauver());

/* ---------- Démarrage ---------- */
if(/[?&]demo\b/.test(location.search)){DEMO = true;B = binomeDemo();SEANCE = 'S4'}
rendre();
if('serviceWorker' in navigator)window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
