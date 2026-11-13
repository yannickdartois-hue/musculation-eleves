/* Mode d'emploi de l'appli élève de musculation (bouton « ? »). */
window.EPS_AIDE = {
  appli:'Musculation · Élève',
  bouton:false,
  publics:[
    {id:'eleve', titre:'Élève', chapitres:[
      {t:'Le carnet du binôme', html:`<p>Un carnet par binôme, sur le téléphone de l'un des deux. Écris le <b>prénom ET le nom</b> de chacun, puis un <b>code secret à 4 chiffres</b> : il protège votre carnet. Le professeur ne peut pas le retrouver.</p><p>En haut de l'écran, <b>Qui pratique ?</b> : touche le prénom de celui qui soulève. Le partenaire tient le téléphone.</p>`},
      {t:'Une séance', html:`<ol><li>Onglet <b>Séance</b> : choisis le numéro de la séance (S1 à S9).</li><li>Chaque exercice est <b>déjà prévu</b> (séries, répétitions, charge, disques à mettre). Si tu fais comme prévu, touche <span class="bouton">✓ Fait comme prévu</span>. Sinon, <span class="bouton">Fait autrement</span> et note seulement ce qui a changé.</li><li>Après l'exercice, ton <b>ressenti</b> : une note de 1 à 10, un mot, une sensation. L'appli te dit si c'est cohérent avec ton mobile.</li><li>Le partenaire coche les <b>signes</b> qu'il a vus et donne un conseil.</li></ol>`},
      {t:'Le test 10 RM (S2)', html:`<p>Le partenaire juge : <span class="bouton">+ 1</span> à chaque répétition correcte, <span class="bouton">No REP</span> sinon. À 10 répétitions, l'appli propose la charge suivante et lance 2 min de récupération. La série qui s'arrête avant 10 termine le test. Le partenaire touche <span class="bouton">Je valide</span> : la charge max s'enregistre.</p><p>Absent en S2 ? <b>Saisie directe</b> : une charge et un nombre de répétitions réussis (3 à 10).</p>`},
      {t:'Mes charges et la calculette', html:`<p>Onglet <b>Charges</b> : tes charges max, et pour chacune les charges de 30 à 80 % avec les disques à mettre. La <b>calculette libre</b> marche avec n'importe quelle charge.</p><p>Le bouton <span class="bouton">📋 Mobiles</span>, en bas à droite, rappelle à tout moment les 3 mobiles.</p>`},
      {t:'Mon projet (S6 à S9)', html:`<p>Onglet <b>Projet</b> : ton mobile, puis 4 à 6 exercices (6 en Tonification) sur le haut du corps, le bas du corps et le tronc. L'appli vérifie l'équilibre et la durée. En fin de séance, elle propose un <b>ajustement</b> : tu acceptes ou tu gardes, et tu dis pourquoi en une phrase.</p>`},
      {t:'Envoyer', html:`<p>En fin de séance, onglet <b>Envoyer</b> : <span class="bouton">Télécharger le carnet</span>, puis dépose le fichier dans le dossier Nuage donné par le professeur. En S1 et S2, montre aussi le <b>QR Mots et défi</b> : il ne contient aucun nom.</p>`},
      {t:'Sécurité', html:`<p>Jamais d'effort à 100 %, jamais moins de 3 répétitions. Un pareur au développé couché. <b>Douleur dans une articulation : STOP</b>, tu préviens le professeur.</p>`}
    ]},
    {id:'prof', titre:'Professeur', chapitres:[
      {t:'Principe', html:`<p>L'appli suit le cycle de 9 séances de l'écran de cours <b>cycle-musculation</b> (même fichier de données). Les élèves l'ouvrent sur leur téléphone ; elle marche sans réseau après la première ouverture.</p>`},
      {t:'Données', html:`<p>Les noms restent sur le téléphone et dans le fichier JSON déposé dans le Nuage. Le QR « Mots et défi » (S1-S2) ne contient que des mots, la lettre d'équipe et des totaux : l'écran de cours le scanne dans Outils › Nuage de mots ou Défi.</p>`},
      {t:'Démo', html:`<p>« Essayer l'appli (démo) » sur l'accueil, ou l'adresse avec <b>?demo</b> : un binôme fictif rempli jusqu'à la S5, avec un projet. Rien n'est enregistré.</p>`},
      {t:'Pas encore en v1.0', html:`<p>Le code de cours à 4 chiffres et la lecture des carnets se feront avec l'outil prof (musculation-prof). La transmission en direct par Grist n'est pas branchée.</p>`}
    ]}
  ]
};
