# IMMO+ Afrique, site vitrine

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
| Poids total chargé | 213 Ko |
| Premier affichage | 1,5 s |
| Page prête | 1,7 s |
| Images par seconde pendant le défilement du héros | 59 |

Les polices représentent 122 Ko de ce total. Elles sont hébergées avec le site, donc
aucune requête ne part vers un autre domaine.
