/* =====================================================================
   minuteur.js — chrono des séries (appli musculation élève), v6.0, 21/11/2026
   Inspiré du chrono de l'appli cross training : plein écran, décompte 3 s, son / vibreur / muet
   (même réglage, même clé eps_sound_mode), écran gardé allumé, reprise juste après une mise en veille
   (les temps sont calculés à partir de l'heure, pas d'un compteur).
   Une série : chrono qui monte (ou qui descend pour un atelier en secondes), dessin de l'atelier,
   consignes du mobile et, pour le coach, le point clé et les signes à surveiller.
   Puis la récupération du mobile en compte à rebours (± 15 s), bips à 3-2-1, et la série suivante.
   ===================================================================== */
(function(root){
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MODES = [['sound','🔊 Son'],['vibrate','📳 Vibreur'],['silent','🔇 Muet']];
function mode(){try{return localStorage.getItem('eps_sound_mode') || 'sound'}catch(e){return 'sound'}}
function modeSuivant(){const i = MODES.findIndex(x => x[0] === mode()), n = MODES[(i + 1) % MODES.length][0];try{localStorage.setItem('eps_sound_mode', n)}catch(e){}return n}
const libMode = () => (MODES.find(x => x[0] === mode()) || MODES[0])[1];
let ac = null, lock = null;
function son(f, d, v){const m = mode();if(m === 'silent')return;
  if(m === 'vibrate'){try{navigator.vibrate && navigator.vibrate(Math.round(Math.min(d, .5) * 400) + 40)}catch(e){}return}
  try{ac = ac || new (window.AudioContext || window.webkitAudioContext)();if(ac.state === 'suspended')ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;o.frequency.value = f;g.gain.setValueAtTime(v || .3, t);g.gain.exponentialRampToValueAtTime(.001, t + d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t + d)}catch(e){}}
const bip = () => son(880, .12), go = () => son(1320, .45, .4), fin = () => [[523, 0], [659, 120], [784, 240], [1047, 380]].forEach(([f, d]) => setTimeout(() => son(f, d === 380 ? .4 : .1, .45), d));
async function eveil(on){try{if(on && navigator.wakeLock)lock = await navigator.wakeLock.request('screen');else if(lock){lock.release();lock = null}}catch(e){}}
const mmss = s => {s = Math.max(0, Math.round(s));return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')};
const nb = v => Array.isArray(v) ? v[1] : (+v || 0);
const txt = v => Array.isArray(v) ? v[0] + ' à ' + v[1] : String(v);
const CONSIGNE = {
  tonif:'Rythme régulier, respiration continue : pas de vitesse.',
  volume:'Descente lente (2-3 s), sans à-coup : cherche la brûlure en fin de série.',
  puiss:'Le plus vite possible à la montée. La vitesse baisse : la série s\'arrête.'};

/* o : {at, nom, img, mob, mobNom, series, reps, temps, charge, chargeTxt, recupS, cle, signes[], crit[], partenaire, onFait()} */
function ouvrir(o){
  const N = Math.max(1, nb(o.series)), PREP = 3;
  let serie = 1, phase = 'prep', t0 = Date.now(), recup = o.recupS || 90, tick = null, dernier = -1, voirCoach = true;
  const div = document.createElement('div');div.className = 'chm';div.setAttribute('role', 'dialog');div.setAttribute('aria-modal', 'true');
  document.body.appendChild(div);document.documentElement.classList.add('chrono-ouvert');eveil(true);
  const ecoule = () => (Date.now() - t0) / 1000;
  function changer(p){phase = p;t0 = Date.now();dernier = -1;rendu()}
  function boucle(){
    const e = ecoule(), s = Math.ceil(e);
    if(phase === 'prep'){const r = PREP - e;if(r <= 0){go();return changer('serie')}if(Math.ceil(r) !== dernier){dernier = Math.ceil(r);bip()}}
    else if(phase === 'serie' && o.temps){const r = nb(o.reps) - e;if(r <= 0){go();return finSerie()}if(r <= 3 && Math.ceil(r) !== dernier){dernier = Math.ceil(r);bip()}}
    else if(phase === 'repos'){const r = recup - e;if(r <= 0){go();serie++;return changer('serie')}if(r <= 3 && Math.ceil(r) !== dernier){dernier = Math.ceil(r);bip()}else if(Math.round(r) === 10 && dernier !== 10){dernier = 10;son(660, .15)}}
    const el = div.querySelector('.chm-temps');if(el)el.textContent = affTemps();
    const ba = div.querySelector('.chm-barre i');if(ba)ba.style.width = progr() + '%';
  }
  function affTemps(){const e = ecoule();
    if(phase === 'prep')return String(Math.max(1, Math.ceil(PREP - e)));
    if(phase === 'serie')return o.temps ? mmss(nb(o.reps) - e) : mmss(e);
    if(phase === 'repos')return mmss(recup - e);return ''}
  function progr(){const e = ecoule();return phase === 'repos' ? Math.min(100, e / recup * 100) : phase === 'serie' && o.temps ? Math.min(100, e / nb(o.reps) * 100) : 0}
  function finSerie(){if(serie >= N){fin();changer('fini')}else changer('repos')}
  function fermer(){clearInterval(tick);eveil(false);document.removeEventListener('visibilitychange', vis);div.remove();document.documentElement.classList.remove('chrono-ouvert')}
  function vis(){if(document.visibilityState === 'visible'){eveil(true);boucle()}}
  function coach(){return `<details class="chm-coach"${voirCoach ? ' open' : ''}><summary>👀 Coach${o.partenaire ? ' (' + esc(o.partenaire) + ')' : ''} : ce que tu vérifies</summary>
    ${o.cle ? `<p class="chm-cle">🎯 <b>Point clé :</b> ${esc(o.cle)}</p>` : ''}
    ${o.crit && o.crit.length ? `<ul>${o.crit.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${o.signes && o.signes.length ? `<p class="small"><b>Signes de fatigue à repérer :</b> ${o.signes.map(esc).join(' · ')}</p>` : ''}</details>`}
  function rendu(){
    const tete = `<div class="chm-tete"><div><b>${esc(o.nom)}</b><br><span>${esc(o.mobNom || '')}${o.chargeTxt ? ' · ' + esc(o.chargeTxt) : ''}</span></div>
      <div class="chm-bts"><button type="button" class="chm-mini" data-c="son">${libMode()}</button><button type="button" class="chm-mini" data-c="quitter">✕</button></div></div>`;
    const pastilles = `<div class="chm-series">${Array.from({length:N}, (_, i) => `<span class="${i + 1 < serie || phase === 'fini' || (phase === 'repos' && i + 1 === serie) ? 'ok' : i + 1 === serie || (phase === 'repos' && i === serie) ? 'ici' : ''}">${i + 1}</span>`).join('')}</div>`;
    let corps = '';
    if(phase === 'prep')corps = `<p class="chm-etat">Prêt ? Série ${serie}</p><div class="chm-temps chm-gros">${affTemps()}</div>${o.approche && serie === 1 ? `<p class="chm-consigne">🔸 Série d'approche avant : ${esc(o.approche)}</p>` : ''}`;
    else if(phase === 'serie')corps = `<p class="chm-etat serie">Série ${serie} / ${N} · ${o.temps ? esc(txt(o.reps)) + ' s' : esc(txt(o.reps)) + ' répétitions'}</p>
      <div class="chm-temps">${affTemps()}</div>${o.temps ? '<div class="chm-barre"><i></i></div>' : ''}
      <img class="chm-img" src="${esc(o.img || '')}" alt="" onerror="this.remove()">
      <p class="chm-consigne">${o.rappel ? '📋 ' + esc(o.rappel) : esc(CONSIGNE[o.mob] || '')}</p>${coach()}
      <button type="button" class="chm-bt ok" data-c="finserie">✓ Série terminée</button>`;
    else if(phase === 'repos')corps = `<p class="chm-etat repos">Récupération${o.partenaire ? ` · au tour de ${esc(o.partenaire)}` : ''}</p>
      <div class="chm-temps">${affTemps()}</div><div class="chm-barre"><i></i></div>
      <div class="chm-rangee"><button type="button" class="chm-mini" data-c="moins">− 15 s</button><button type="button" class="chm-mini" data-c="plus">+ 15 s</button></div>
      <p class="chm-consigne">Ensuite : série ${serie + 1} / ${N}${o.chargeTxt ? ' à ' + esc(o.chargeTxt) : ''}. Respire, bois un peu, prépare la charge.</p>
      <img class="chm-img petit" src="${esc(o.img || '')}" alt="" onerror="this.remove()">
      <button type="button" class="chm-bt" data-c="pret">Je suis prêt : série suivante</button>`;
    else corps = `<p class="chm-etat ok">🎉 Exercice terminé : ${N} série${N > 1 ? 's' : ''}</p>
      <p class="chm-consigne">Note maintenant ton ressenti, et ton coach son avis.</p>
      ${o.onFait ? `<button type="button" class="chm-bt ok" data-c="fait">✓ Fait comme prévu</button>` : ''}<button type="button" class="chm-bt" data-c="quitter">Fermer</button>`;
    div.className = 'chm ph-' + phase;
    const ruban = {prep:'⏳ PRÊT ?', serie:'💪 TRAVAIL', repos:'⏸ REPOS', fini:'✓ TERMINÉ'}[phase];
    div.innerHTML = `<div class="chm-ruban">${ruban}${phase === 'serie' ? `<small>série ${serie} / ${N}</small>` : phase === 'repos' ? `<small>prochaine série : ${serie + 1} / ${N}</small>` : ''}</div><div class="chm-in">${tete}${pastilles}${corps}</div>`;
    boucle();
  }
  div.addEventListener('toggle', ev => {if(ev.target.matches && ev.target.matches('.chm-coach'))voirCoach = ev.target.open}, true);
  div.addEventListener('click', ev => {const b = ev.target.closest('[data-c]');if(!b)return;const c = b.dataset.c;
    if(c === 'son'){modeSuivant();b.textContent = libMode();if(mode() !== 'silent')bip();return}
    if(c === 'quitter'){if(phase !== 'fini' && phase !== 'prep' && !confirm('Quitter le chrono ?'))return;fermer();return}
    if(c === 'finserie'){finSerie();return}
    if(c === 'pret'){serie++;changer('serie');go();return}
    if(c === 'moins'){recup = Math.max(15, recup - 15);boucle();return}
    if(c === 'plus'){recup += 15;boucle();return}
    if(c === 'fait'){fermer();o.onFait && o.onFait();return}
  });
  document.addEventListener('visibilitychange', vis);
  tick = setInterval(boucle, 250);rendu();
}
root.MinuteurM = {ouvrir};
})(window);

/* =====================================================================
   v6.0 — chrono binôme : écran coupé en deux (A en haut, B en bas).
   Celui qui travaille est en vert, celui qui récupère en rouge : il regarde son partenaire
   (point clé, ✓ tenu / ✗ à revoir). « Série finie » : au tour du partenaire, qui a d'abord un
   temps de transition (orange) pour changer les disques, puis touche « JE SUIS PRÊT » : rien ne
   démarre tout seul. La récupération minimale du mobile reste imposée en Volume et Puissance.
   Affichage : la structure n'est réécrite que quand elle change ; chaque seconde, seuls les
   chiffres changent (plus de clignotement des dessins).
   p : [{prenom, nom (exercice), img, mob, mobNom, rappel, series, reps, temps, chargeTxt, compo, recupS, cle, bloque, approche}, {...}]
   onFin({cle:[a,b], faites:[n,n]})
   ===================================================================== */
(function(root){
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmss = s => {s = Math.max(0, Math.round(s));return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')};
const nb = v => Array.isArray(v) ? v[1] : (+v || 0);
let ac = null, lock = null;
function son(f, d){let m = 'sound';try{m = localStorage.getItem('eps_sound_mode') || 'sound'}catch(e){}if(m === 'silent')return;
  if(m === 'vibrate'){try{navigator.vibrate && navigator.vibrate(200)}catch(e){}return}
  try{ac = ac || new (window.AudioContext || window.webkitAudioContext)();if(ac.state === 'suspended')ac.resume();const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;o.frequency.value = f;g.gain.setValueAtTime(.35, t);g.gain.exponentialRampToValueAtTime(.001, t + d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t + d)}catch(e){}}
async function eveil(on){try{if(on && navigator.wakeLock)lock = await navigator.wakeLock.request('screen');else if(lock){lock.release();lock = null}}catch(e){}}
const CLE_TR = 'mue-transition';
function lireTr(){try{const v = parseInt(localStorage.getItem(CLE_TR), 10);return isFinite(v) ? Math.max(0, Math.min(90, v)) : 20}catch(e){return 20}}
function ecrireTr(v){try{localStorage.setItem(CLE_TR, String(v))}catch(e){}}
/* chiffre qui change chaque seconde : <span class="dyn">…</span> (la structure ne bouge pas) */
const dyn = t => `<span class="dyn">${esc(t)}</span>`;

function binome(P, opts){
  const N = P.map(p => Math.max(1, nb(p.series)));
  const st = P.map(() => ({faites:0, repos:null, bip:false, depart:null, trans:null, cle:null, finTr:false}));
  let qui = 0, tick = null, TR = lireTr(), cleStruct = '';
  st[0].trans = Date.now();
  const div = document.createElement('div');div.className = 'chb';div.setAttribute('role', 'dialog');div.setAttribute('aria-modal', 'true');document.body.appendChild(div);
  document.documentElement.classList.add('chrono-ouvert');eveil(true);
  const fini = i => st[i].faites >= N[i];
  const reposRestant = i => st[i].repos == null ? 0 : P[i].recupS - (Date.now() - st[i].repos) / 1000;
  const pills = i => `<div class="chb-pills" aria-label="séries">${Array.from({length:N[i]}, (_, k) => `<span class="${k < st[i].faites ? 'ok' : k === st[i].faites && qui === i ? 'ici' : ''}">${k + 1}</span>`).join('')}</div>`;
  const rappel = p => p.rappel ? `<p class="chb-rap">📋 ${esc(p.rappel)}</p>` : '';
  function moitie(i){
    const p = P[i], s = st[i], o = 1 - i, autre = P[o], now = Date.now();
    if(fini(i))return `<section class="chb-m fin"><div class="chb-l"><b>${esc(p.prenom)}</b> · ✓ TERMINÉ</div><p>${esc(p.nom)} : ${N[i]} séries faites.${!fini(o) ? ` Tu restes coach de ${esc(autre.prenom)} jusqu'à la fin.` : ''}</p>${!fini(o) ? coach(i) : ''}</section>`;
    if(qui === i){
      /* 1. préparation : transition pour changer les disques, puis « JE SUIS PRÊT » */
      if(s.depart == null){
        const r = reposRestant(i), tr = s.trans == null ? 0 : TR - (now - s.trans) / 1000;
        const bloque = r > 0 && (p.bloque || fini(o)) && s.repos != null, attentionRec = r > 0 && s.repos != null && !bloque;
        return `<section class="chb-m prep"><div class="chb-l"><b>${esc(p.prenom)}</b> · 🔧 PRÉPARE TA CHARGE</div>${pills(i)}
          <p class="chb-charge"><b>${esc(p.chargeTxt || p.nom)}</b>${p.chargeTxt ? ' · ' + esc(p.nom) : ''}${p.compo ? `<br><span>${esc(p.compo)}</span>` : ''}</p>
          ${s.faites === 0 && p.approche ? `<p class="chb-rap">🔸 Série d'approche avant : ${esc(p.approche)}</p>` : ''}
          ${tr > 0 ? `<p class="chb-rec">Temps pour changer les disques : <b>${dyn(mmss(tr))}</b></p>` : `<p class="chb-rec">${s.faites || i ? 'Barre prête ? Partenaire en place pour parer ?' : 'Barre chargée ? Partenaire en place ?'}</p>`}
          ${bloque ? `<p class="chb-att">⏸ Récupération obligatoire${p.bloque ? ' en ' + esc(p.mobNom || '') : ''} : encore ${dyn(mmss(r))}</p>` : attentionRec ? `<p class="chb-att">⚠️ Récupération conseillée : encore ${dyn(mmss(r))}</p>` : ''}
          <div class="chb-tr"><span>Transition</span><button type="button" data-b="tr" data-v="-5" aria-label="moins 5 secondes">−5 s</button><b>${TR} s</b><button type="button" data-b="tr" data-v="5" aria-label="plus 5 secondes">+5 s</button></div>
          <button type="button" class="chb-bt" data-b="pret"${bloque ? ' disabled' : ''}>${bloque ? 'Attends la fin de ta récupération' : '✋ JE SUIS PRÊT'}</button></section>`;
      }
      /* 2. décompte 3 s */
      if(now < s.depart)return `<section class="chb-m prep"><div class="chb-l"><b>${esc(p.prenom)}</b> · ⏳ ATTENTION…</div><div class="chb-t">${dyn(String(Math.max(1, Math.ceil((s.depart - now) / 1000))))}</div>${pills(i)}<p>${esc(p.nom)}${p.chargeTxt ? ' · ' + esc(p.chargeTxt) : ''}</p></section>`;
      /* 3. travail */
      const e = (now - s.depart) / 1000;
      return `<section class="chb-m trav"><div class="chb-l"><b>${esc(p.prenom)}</b> · 💪 TRAVAIL</div>${pills(i)}
        <div class="chb-ligne"><img src="${esc(p.img || '')}" alt="" onerror="this.remove()"><div><div class="chb-t">${dyn(p.temps ? mmss(nb(p.reps) - e) : mmss(e))}</div>
        <p><b>Série ${s.faites + 1}/${N[i]}</b> · ${esc(String(nb(p.reps)))} ${p.temps ? 's' : 'rép.'}${p.chargeTxt ? ' · ' + esc(p.chargeTxt) : ''}<br>${esc(p.nom)}</p></div></div>
        ${rappel(p)}<button type="button" class="chb-bt" data-b="fin">✓ Série finie</button></section>`;
    }
    const r = reposRestant(i);
    return `<section class="chb-m rep"><div class="chb-l"><b>${esc(p.prenom)}</b> · ⏸ REPOS</div>${pills(i)}
      <p class="chb-rec">${s.repos == null ? 'Tu commences après ' + esc(autre.prenom) + '.' : r <= 0 ? 'Récupération minimale faite ✓' : 'Récupération : encore <b>' + dyn(mmss(r)) + '</b>'}</p>${coach(i)}</section>`;
  }
  function coach(i){const o = 1 - i, a = P[o], c = st[o].cle;
    return `<div class="chb-coach">👀 <b>Tu regardes ${esc(a.prenom)}</b>${a.cle ? ` : 🎯 ${esc(a.cle)}` : ''}<div class="chb-cb"><button type="button" class="${c === '1' ? 'on' : ''}" data-b="cle" data-o="${o}" data-v="1" aria-pressed="${c === '1'}">✓ Tenu</button><button type="button" class="${c === '0' ? 'on' : ''}" data-b="cle" data-o="${o}" data-v="0" aria-pressed="${c === '0'}">✗ À revoir</button></div></div>`}
  /* rendu : structure réécrite seulement si elle change, sinon mise à jour des chiffres */
  function rendu(force){
    let h;
    if(fini(0) && fini(1))h = `<div class="chb-fin"><h2>🎉 Binôme terminé</h2>${P.map((p, i) => `<p><b>${esc(p.prenom)}</b> : ${esc(p.nom)}, ${st[i].faites} séries${st[i].cle ? ` · point clé ${st[i].cle === '1' ? 'tenu ✓' : 'à revoir'} (vu par ${esc(P[1 - i].prenom)})` : ''}</p>`).join('')}
        <p>Enregistre, puis chacun note son ressenti et son coach écrit son conseil.</p><button type="button" class="chb-bt" data-b="ok">✓ Enregistrer les deux</button><button type="button" class="chb-bt sec" data-b="quit">Fermer sans enregistrer</button></div>`;
    else h = `<button type="button" class="chb-x" data-b="quit" aria-label="Quitter">✕</button>${moitie(0)}${moitie(1)}`;
    const k = h.replace(/<span class="dyn">[^<]*<\/span>/g, '#');
    if(force || k !== cleStruct){cleStruct = k;div.innerHTML = h;return}
    const v = [...h.matchAll(/<span class="dyn">([^<]*)<\/span>/g)].map(m => m[1]), els = div.querySelectorAll('.dyn');
    els.forEach((el, n) => {const t = (v[n] || '').replace(/&amp;/g, '&');if(el.textContent !== t)el.textContent = t});
  }
  function bascule(){const i = qui;st[i].faites++;st[i].repos = Date.now();st[i].bip = false;st[i].depart = null;son(1320, .35);
    const o = 1 - i;if(!fini(o))qui = o;st[qui].trans = Date.now();st[qui].finTr = false;st[qui].depart = null;if(fini(0) && fini(1))son(880, .6);rendu()}
  div.addEventListener('click', ev => {const b = ev.target.closest('[data-b]');if(!b || b.disabled)return;const a = b.dataset.b;
    if(a === 'fin'){bascule();return}
    if(a === 'pret'){st[qui].depart = Date.now() + 3000;son(880, .12);rendu();return}
    if(a === 'tr'){TR = Math.max(0, Math.min(90, TR + +b.dataset.v));ecrireTr(TR);rendu();return}
    if(a === 'cle'){const o = +b.dataset.o;st[o].cle = st[o].cle === b.dataset.v ? null : b.dataset.v;rendu();return}
    if(a === 'ok'){fermer();opts.onFin && opts.onFin({cle:st.map(s => s.cle), faites:st.map(s => s.faites)});return}
    if(a === 'quit'){if(!(fini(0) && fini(1)) && !confirm('Quitter le chrono binôme ? Rien ne sera enregistré.'))return;fermer();return}
  });
  let dernier = -1;
  function boucle(){const now = Date.now(), s = st[qui];
    if(s.depart != null && !fini(qui)){if(now < s.depart){const r = Math.ceil((s.depart - now) / 1000);if(r !== dernier){dernier = r;son(880, .12)}}else if(dernier !== 0){dernier = 0;son(1320, .4)}}
    else dernier = -1;
    if(s.depart == null && s.trans != null && !s.finTr && TR > 0 && now - s.trans >= TR * 1000){s.finTr = true;son(660, .2)}
    P.forEach((p, i) => {if(st[i].repos != null && !st[i].bip && reposRestant(i) <= 0){st[i].bip = true;son(660, .2)}});
    rendu()}
  function vis(){if(document.visibilityState === 'visible'){eveil(true);boucle()}}
  function fermer(){clearInterval(tick);eveil(false);document.removeEventListener('visibilitychange', vis);div.remove();document.documentElement.classList.remove('chrono-ouvert')}
  document.addEventListener('visibilitychange', vis);
  tick = setInterval(boucle, 250);rendu(true);
}
root.MinuteurM = Object.assign(root.MinuteurM || {}, {binome});
})(window);
