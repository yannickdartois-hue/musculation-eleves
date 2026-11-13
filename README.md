# Musculation · Élève · CA5 Terminale · Lycée Georges Pompidou

Appli du binôme pour le cycle de musculation (9 séances) : questionnaire « Je me situe », test 10 RM jugé par le partenaire (+ 1 / No REP), charges calculées et disques à mettre, séances préremplies (on ne note que les différences), ressentis (note, mot, sensation) avec contrôle de cohérence par mobile, avis du partenaire, projet S6-S9 avec ajustements justifiés, choix AFL2/AFL3 et rôle, export du carnet (fichier JSON pour le Nuage) et QR « Mots et défi » sans nom.

- Contenu : `muscu-donnees.js`, **identique** à celui de `cycle-musculation` (le modifier là-bas puis le recopier).
- Données : sur le téléphone (localStorage), carnet protégé par un code à 4 chiffres (empreinte seulement).
- Hors ligne : `sw.js` (cache `musculation-eleves-vN`, n'efface que ses propres caches) ; mise à jour par `eps-maj.js`.
- Démo : bouton sur l'accueil ou adresse `?demo`.
- Pas encore en v1.0 : code de cours (avec l'outil prof), lecture des carnets par l'outil prof, transmission en direct par Grist.
