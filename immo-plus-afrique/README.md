# IKK Group, site vitrine du programme IMMO+ Afrique

Site d'une page, en HTML, CSS et JavaScript simples. Aucun outil à installer, aucune
étape de compilation. Le dossier entier est le site.

## Le regarder

Deux façons, et elles ne montrent pas la même chose.

1. **Double-cliquer sur `index.html`.** Le site s'ouvre dans le navigateur avec le héros
   dessiné. C'est déjà la vraie page.
2. **Avec un petit serveur local**, depuis ce dossier :
   ```bash
   npx http-server -p 8080     # ou : python3 -m http.server 8080
   ```
   puis ouvrir `http://localhost:8080`. C'est le seul moyen de voir la vidéo au scroll
   quand elle sera là, parce que les navigateurs refusent de charger un fichier vidéo
   depuis une adresse `file://`.

## Ajouter la vidéo du héros plus tard

Déposer le fichier ici, sous ce nom exact :

```
assets/video/hero-scrub.mp4
```

Rien d'autre à faire. La page va le chercher au chargement, et si elle le trouve, la
vidéo remplace le héros dessiné et défile avec la molette. Si le fichier n'existe pas,
si le réseau coupe, ou si le visiteur est sur téléphone, le héros dessiné reste, et
la page est complète.

Pour que le défilement soit fluide, encoder la vidéo avec des images clés rapprochées :

```bash
ffmpeg -i source.mp4 -an -vf "scale=1920:-2,fps=30" \
  -c:v libx264 -profile:v high -crf 22 -g 6 -keyint_min 6 -sc_threshold 0 \
  -movflags +faststart assets/video/hero-scrub.mp4
```

## Remplacer le logo par ton fichier d'origine

Le logo de la page est une **version vectorielle redessinée** de la marque IKK Group,
faite à partir de l'image. Elle est en SVG, donc nette à toutes les tailles, animable
partie par partie, et elle pèse deux kilo-octets.

Le dessin de référence est dans `assets/img/logo.svg`. Le même dessin est recopié
directement dans `index.html` à quatre endroits, parce que les animations ont besoin
d'atteindre chaque arc séparément :

1. l'ouverture de page, `<div class="ouv">`
2. l'en-tête, `<a class="nav__mark">`
3. le filigrane de la section investisseurs, `<div class="ghost">`
4. le pied de page, `<div class="foot__brand">`

Pour mettre le fichier d'origine à la place, envoie-le et je fais l'échange. Si tu veux
le faire toi-même avec une image simple, remplace chaque bloc `<svg class="mark ...">`
par `<img src="assets/img/logo.png" alt="IKK Group">`. Les animations de l'arbre ne
joueront alors plus, parce qu'une image ne s'anime pas partie par partie.

## L'ouverture de page

Au premier chargement, un panneau bleu marine construit le logo : la barre dorée se
trace, le tronc pousse, les trois arcs s'ouvrent l'un après l'autre, puis le nom
apparaît et le rideau se lève. Deux secondes et demie en tout.

Elle ne se rejoue pas à chaque page : `sessionStorage` retient qu'elle a déjà été vue.
Le visiteur peut la couper d'un clic, d'un défilement ou d'une touche. Elle est
entièrement écrite en CSS et se termine toute seule, même si le JavaScript échoue.
Elle ne se joue pas du tout si le système demande à réduire les animations.

Pour la désactiver définitivement, supprimer le bloc `<div class="ouv">` dans
`index.html`.

## Changer le numéro WhatsApp

Le numéro affiché est un numéro d'exemple. Il apparaît à trois endroits :

- `assets/js/site.js`, première ligne utile : `const WA_NUM = '2250700000000';`
- `index.html`, dans les liens `href="https://wa.me/2250700000000?text=..."`
- `index.html`, le numéro écrit en toutes lettres dans le pied de page et le lien `tel:`

Un simple remplacement de `2250700000000` dans les deux fichiers suffit, plus le
numéro lisible dans le pied de page.

## Ce que la page fait

- Héros dessiné en SVG, quatre plans de parallaxe pilotés par le défilement, poussière
  d'harmattan sur un canvas, phrases qui se relaient, puis titre qui se pose.
- Une seule boucle d'animation, qui s'arrête d'elle-même dès qu'il n'y a plus rien à bouger.
- Apparitions au défilement, traits qui se dessinent, compteurs de chiffres.
- Simulateur de financement qui prépare le message WhatsApp avec les chiffres du visiteur.
- Plan de masse avec repères cliquables, au doigt comme au clavier.
- Formulaire final qui n'enregistre rien et ouvre WhatsApp avec le message déjà écrit.
- Réglage « mouvement réduit » du système respecté : tout devient fixe et lisible.
- Sans JavaScript, la page reste lisible, les liens WhatsApp marchent et les questions s'ouvrent.

## Mesures relevées

Sur un téléphone simulé, réseau bridé à 1,6 Mbit/s et processeur ralenti quatre fois :

| Mesure | Valeur |
|---|---|
| Poids total chargé | 227 Ko |
| Premier affichage | 1,8 s |
| Page prête | 2,0 s |
| Images par seconde pendant le défilement du héros | 58 |

Les polices représentent 122 Ko de ce total. Elles sont hébergées avec le site, donc
aucune requête ne part vers un autre domaine.

Ces chiffres sont mesurés sans compression, parce que le petit serveur de test n'en
fait pas. Un vrai hébergeur compresse le code : 44 Ko de HTML deviennent 11 Ko, 36 Ko
de CSS deviennent 9 Ko, 24 Ko de JavaScript deviennent 7 Ko. Soit 28 Ko de code au
lieu de 112, et un poids réel autour de 150 Ko.
