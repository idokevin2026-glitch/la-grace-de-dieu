# 📖 NATHAN KIDS — Guide d'utilisation

Bienvenue dans votre application de gestion de boutique ! Voici l'essentiel pour
bien démarrer. *(À imprimer ou à garder sur le téléphone.)*

---

## 🔑 Se connecter
- Ouvrez l'application → tapez votre **code PIN à 4 chiffres**.
- **Mme Silué (admin)** : accès à **tout**, y compris les finances (bénéfice, caisse, banque).
- **Vendeuses** : accès aux **ventes** et au **stock**. Les chiffres d'argent (bénéfice, marge, caisse) sont **cachés**. La connexion d'une vendeuse enregistre automatiquement son **pointage** (heure d'arrivée).
- **Se déconnecter** : bouton en haut à droite (la vendeuse « pointe » son départ).

## 🛒 Faire une vente
1. Onglet **Vente**.
2. **Touchez les articles** pour les ajouter au panier (ou 📷 **scannez** le code-barres).
3. Ajustez les quantités avec **−** / **+**.
4. Choisissez le **mode de paiement** : Espèces, Wave, Orange Money, Carte, ou **Crédit**.
   - *Crédit* : entrez le **nom du client** (obligatoire).
5. Touchez **Encaisser**. ✅ La vente est enregistrée et le stock mis à jour tout seul.

## 📦 Gérer le stock
- Onglet **Stock** : liste des articles, recherche, catégories. **Code couleur** : bandeau **bleu** = vêtements, **rose** = cosmétiques.
- **＋ Produit** (admin) : créer un article. Pour le **code-barres**, appuyez sur 📷 pour **scanner le vrai code du produit** (sinon un code est généré).
- **✎ Modifier** (admin) : corriger un article — nom, prix, coût, seuil, fournisseur, et **son code-barres** (scan 📷). Indispensable pour qu'un article soit **reconnu au scan en caisse**.
- Sur un article : **＋ Réassort** (marchandise reçue) ou **± Ajuster** (correction).
- **📋 Inventaire** : compter physiquement le stock ; seuls les écarts sont enregistrés.

> 💡 **Scan en caisse** : un article n'est trouvé au scan que si **son vrai code-barres est enregistré** (via 📷 à la création ou à la modification). Si vous scannez un article inconnu, l'admin peut le créer directement avec ce code.

## ➕ Le menu « Plus »
- L'onglet **Plus** (en bas à droite) regroupe les écrans secondaires : **Crédits**, **Mouvements de stock**, et — pour l'admin — **Pointage vendeuses**, **Caisse & Banque**, **Équipe**.

## 🌐 Français / Anglais
- Le petit bouton **FR / EN** (en haut) bascule toute l'application entre le français et l'anglais.

## 📕 Crédits clients
- Menu **Plus → Crédits** : liste des clients qui doivent de l'argent.
- Quand un client paie : **Marquer payé** → la caisse est créditée automatiquement.

## 🔄 Mouvements de stock
- Menu **Plus → Mouvements de stock** : le journal de toutes les **entrées** (réassort, inventaire) et **sorties** (ventes), avec l'heure et la raison.

## 🕰️ Stock mort
- Menu **Plus → Stock mort** : les articles **encore en stock mais qui ne se vendent plus** (aucune vente depuis 30, 60 ou 90 jours — à choisir en haut).
- Le bandeau indique combien d'articles sont concernés et la **valeur immobilisée** (l'argent « dormant » dans ces invendus).
- Utile pour décider des **promotions / déstockages** et éviter d'immobiliser de la trésorerie.

## ⏱️ Pointage vendeuses *(admin uniquement)*
- Menu **Plus → Pointage vendeuses** : pour chaque vendeuse, l'heure d'**arrivée** (connexion), de **départ** (déconnexion) et le **temps de présence** de la journée.
- Une vendeuse encore connectée affiche **« en cours »**.

## 📊 Rapports
- Onglet **Rapports** : recette et bénéfice (admin) du jour, nombre de ventes, et le graphique **« Cette semaine »** (chiffre d'affaires des 7 derniers jours + meilleur jour).
- Touchez la carte **Fiche du jour** pour le détail : recette, ventes, bénéfice (admin), modes de paiement, articles vendus, opérations — avec boutons **Excel (CSV)** et **PDF**.

## 💰 Caisse & Banque *(admin uniquement)*
- Soldes **Caisse (espèces)** et **Banque** (Wave/OM/carte).
- **Dépôt**, **Retrait**, **Vers banque** (transfert caisse → banque).

## 👥 Gérer l'équipe *(admin uniquement)*
- **＋ Ajouter une vendeuse** : nom + son code PIN (différent des autres).
- **🔑 Réinitialiser le PIN** : si une vendeuse oublie son code, l'admin lui en donne un nouveau **immédiatement** (pas besoin de SMS).
- **Retirer** une vendeuse : elle ne peut plus se connecter (son historique est conservé).

## 👗 L'écran de la vendeuse
- La vendeuse a une **interface simplifiée** : vente, stock, crédits. Elle **ne voit aucun chiffre d'affaires** (ni recette, ni bénéfice, ni caisse/banque, ni rapports) — ces informations restent réservées à l'admin.

## 📶 Ça marche même sans internet !
- Vous pouvez **vendre hors connexion** : les opérations sont mises en file d'attente.
- Un petit **⌛** en haut indique les opérations en attente ; elles partent toutes seules dès que le réseau revient. Le bouton **↻** force la synchronisation.

## 📱 Installer sur le téléphone
- Ouvrez l'appli dans le navigateur → menu (⋮) → **« Ajouter à l'écran d'accueil »**.
- L'appli s'ouvre alors comme une vraie application, en plein écran.

## ❓ Code PIN oublié
- **Vendeuse** : l'admin la réinitialise en 2 secondes (Plus → Équipe → **🔑**). Aucun SMS requis.
- **Admin** : sur l'écran de connexion, **« Code oublié ? »** envoie un **code par SMS** au téléphone de l'admin.
  *(⚠ L'envoi SMS nécessite un fournisseur SMS configuré, ex. Twilio — voir l'administrateur technique. Sans SMS configuré, aucun code n'est reçu.)*

---

## ✅ Conseils
- **Chaque vendeuse a son propre PIN** — ne le partagez pas.
- **Comptez la caisse** en fin de journée et comparez à la **Fiche du jour**.
- Faites un **inventaire** régulièrement pour garder un stock juste.
- Surveillez le bandeau **« Stock à surveiller »** sur l'accueil (articles bientôt épuisés).

Bonne gestion ! 🧸
