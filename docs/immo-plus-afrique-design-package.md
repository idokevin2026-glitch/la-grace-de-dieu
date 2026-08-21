# Dossier de conception, IKK Group

Document de travail. Il n'est pas publié avec le site. Le site vit dans `immo-plus-afrique/`.

## 1. Producteur

- **Palier** : 1, un seul plan continu de 6 secondes défilé au scroll.
- **État des crédits Higgsfield au moment du build** : 0 crédit, formule gratuite, générations illimitées inactives.
- **Décision** : le site est construit en entier avec un héros dessiné à la main (SVG, dégradés, particules, parallaxe).
  Le moteur de scrub vidéo est déjà câblé et attend le fichier `assets/video/hero-scrub.mp4`.
  Le jour où le fichier existe, la vidéo prend le relais toute seule. Aucune reconstruction.
- **Coût quand la vidéo sera générée** : environ 2 crédits l'image de départ, 10 à 55 crédits la vidéo selon le modèle,
  2 crédits par image de section.
- **Mobile** : image fixe composée à la place du scrub, par choix. Les autres animations tournent partout.
- **Images réelles** : aucune pour l'instant. Le pied de page annonce que les visuels sont provisoires
  et seront remplacés par les vraies photos du chantier.

## 2. Chercheur, la langue des vrais clients

Sources lues : témoignages d'acheteurs ivoiriens, articles sur les arnaques foncières, analyses de marché 2026.

**Les peurs, dans leurs mots**
- Le même terrain vendu à plusieurs acheteurs. Environ 30 % des litiges civils touchent au foncier.
- Attestations villageoises, faux papiers, usurpation d'identité.
- « L'argent des nouveaux acheteurs sert à gérer les anciens. »
- Le chantier qui ne sort jamais de terre, la livraison qui glisse de mois en mois.
- Les prestations changées en cours de route, le bien non conforme aux plans.

**Ce qu'ils veulent, dans leurs mots**
- « Fini les photos truquées, c'est la banque qui supervise. »
- Un ACD vérifiable au Ministère de la Construction.
- Les coordonnées d'acheteurs déjà livrés sur un programme précédent.
- Côté diaspora : du revenu, pas seulement la maison de famille.
  « La plus-value sur trois ans a dépassé 25 % et la location est assurée toute l'année. »

**Les chiffres**
- Déficit de 600 000 logements sur le Grand Abidjan, 400 000 à 800 000 sur le pays.
- Environ 40 000 unités demandées chaque année.
- Cocody : les prix montent de 5 à 8 % par an.
- Le segment 30 à 80 millions FCFA est celui qui trouve preneur.

**Action unique du site** : ouvrir une discussion WhatsApp.

## 3. Direction artistique

**Le parti pris** : la chaleur d'Abidjan à l'heure dorée, tenue par une rigueur de maison de luxe.
Fond terre profonde, jamais noir pur. Texte sable, jamais blanc pur. L'or en très petites doses.

**Jetons de couleur**
| Jeton | Valeur | Rôle |
|---|---|---|
| `--nuit` | `#141009` | fond profond, terre brûlée |
| `--terre` | `#1E1811` | fond des sections alternées |
| `--ecorce` | `#2A2118` | cartes, bordures épaisses |
| `--sable` | `#F0E4D2` | texte principal |
| `--sable-doux` | `#B9A98F` | texte secondaire |
| `--or` | `#E3A63F` | accent rare, jamais en aplat large |
| `--or-clair` | `#F6CF86` | halo, dégradé de titre |
| `--lagune` | `#1E6F68` | second accent, la lagune Ébrié |
| `--kola` | `#C24B32` | alerte chaude, chiffres clés |

**Trio typographique**
- Display : **Fraunces**, serif douce et chaude, taille optique. Jamais Inter, jamais Roboto.
- Texte : **Manrope**.
- Étiquettes : **Space Mono**, majuscules, très espacé.

**La marque** : IKK Group, redessinée en SVG à partir du logo fourni. Arbre à trois arcs
(crème, or, terre cuite) sur socle doré. Le bleu marine du logo entre dans la palette
comme sol de la marque : il sert de fond à l'ouverture de page, et nulle part ailleurs,
pour ne pas concurrencer l'heure dorée d'Abidjan.

| Jeton ajouté | Valeur | Rôle |
|---|---|---|
| `--marine` | `#14293A` | le bleu du logo, fond de l'ouverture |
| `--creme` | `#F4EFE4` | le crème du logo, tronc et mot IKK |

Le doré du site a été aligné sur celui du logo (`#E4A82F`) et la terre cuite aussi
(`#C1663F`), pour que la page et la marque parlent d'une seule voix.

**Élément signature** : le trait d'horizon. Une ligne SVG unique qui se dessine au scroll et devient
tour à tour la ligne de la lagune, la silhouette du Plateau, le plan de masse du projet.

**Motif** : les trois arcs du logo, repris au centre des traits de séparation. La croix
de visée reste sur les puces et les repères de plan, où elle sert de marqueur.

**Couche vectorielle dessinée à la main**
1. Silhouette du Plateau et de la lagune, trois plans de parallaxe.
2. Palmiers et pirogue en avant-plan, plan le plus rapide.
3. Voile de poussière d'harmattan, particules à niveau chuchoté.
4. Plan de masse du projet en SVG, tracé au scroll, avec points chauds cliquables.

**Fond fixe** : un dégradé d'heure dorée fixé derrière toute la page, qui se réchauffe vers le bas.

## 4. Carte des bandes du héros

| Bande | Progression | Texte | Place à l'écran |
|---|---|---|---|
| 1 | 0 à 22 % | Abidjan grandit de 40 000 logements par an. | bas gauche |
| 2 | 26 à 48 % | Le pays en manque 600 000. | bas gauche |
| 3 | 52 à 74 % | Nous en construisons, avec les papiers en règle. | bas gauche |
| Repos | 78 à 100 % | IMMO+ Afrique. Bâtir juste, à Abidjan. | centre bas |

Les bornes sont un point de départ, validées ensuite au test du scroll rapide.

## 5. Le site sous le héros

1. **La promesse** : trois lignes, le ton du projet.
2. **Le problème, dans leurs mots** : les trois peurs, écrites sans détour.
3. **Le projet** : trois piliers à traitement égal, résidences, clinique, galerie.
4. **La preuve** : six garanties qui répondent une par une aux objections trouvées.
5. **Le simulateur** : le moment interactif. Le visiteur choisit son logement et son apport,
   voit le prix, la mensualité et le rendement locatif, puis part sur WhatsApp avec le message déjà écrit.
6. **Le plan de masse** : SVG tracé au scroll, points chauds.
7. **Les étapes** : quatre étapes, de la visite à la remise des clés.
8. **Investisseurs** : les chiffres du marché, le rendement, le déficit.
9. **Questions** : les vraies objections, répondues franchement.
10. **Action finale** : nom, besoin, bouton WhatsApp avec message pré-rempli.
11. **Pied de page** : mentions, et l'avis honnête sur les visuels provisoires.

## 6. Où vont les messages

Pas de serveur. Le formulaire final n'envoie rien nulle part : il assemble un message et ouvre WhatsApp
avec ce message déjà écrit. Le visiteur appuie sur envoyer dans WhatsApp. C'est honnête et ça marche
sur un site statique. Numéro d'exemple en place : +225 07 00 00 00 00, à remplacer par le vrai.
