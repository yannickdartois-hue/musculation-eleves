/* =====================================================================
   minuteur.js — chrono des séries (appli musculation élève), v2.12, 21/11/2026
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
    if(phase === 'prep')corps = `<p class="chm-etat">Prêt ? Série ${serie}</p><div class="chm-temps chm-gros">${affTemps()}</div>`;
    else if(phase === 'serie')corps = `<p class="chm-etat serie">Série ${serie} / ${N} · ${o.temps ? esc(txt(o.reps)) + ' s' : esc(txt(o.reps)) + ' répétitions'}</p>
      <div class="chm-temps">${affTemps()}</div>${o.temps ? '<div class="chm-barre"><i></i></div>' : ''}
      <img class="chm-img" src="${esc(o.img || '')}" alt="" onerror="this.remove()">
      <p class="chm-consigne">${esc(CONSIGNE[o.mob] || '')}</p>${coach()}
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
