# ⚽ Dima Prono — Pronostics Coupe du Monde entre amis

Une petite appli web **fun et facile** pour pronostiquer les matchs de la Coupe du Monde
avec tes amis, gagner des points et grimper sur le **podium**. Une **surprise** attend les 3 premiers ! 🎁

## ✨ Fonctionnalités

- 📅 **Prochains matchs** pré-remplis (quarts, demies, finale 2026) — 100 % modifiables
- ⚽ **Pronostics de score** par match, avec drapeaux et jolis boutons
- 🏆 **Classement à points** en direct :
  - Score exact = **3 pts**
  - Bon résultat (bon vainqueur / match nul) = **1 pt**
  - (barème réglable par l'organisateur)
- 👀 **Classement + détail** : voir le total de chacun *et* tous ses pronos
  (cachés jusqu'au coup d'envoi pour éviter la triche)
- 🎁 **Podium animé** avec confettis et une **surprise pour le top 3**
- ⚙️ **Espace Organisateur** (protégé par code) : saisir les résultats,
  gérer les matchs/joueurs, définir les récompenses
- 💾 Fonctionne hors-ligne (données enregistrées dans le navigateur) +
  **export / import** pour sauvegarder ou partager

## 🚀 Utilisation

Ouvre simplement `index.html` dans un navigateur — aucune installation.

1. Chaque ami crée son **profil** (pseudo + avatar).
2. Tout le monde rentre ses **pronos** pour les prochains matchs.
3. L'organisateur saisit les **résultats** au fur et à mesure (onglet ⚙️ Orga, code par défaut : `1234`).
4. Le **classement** se met à jour tout seul et le **podium** révèle les gagnants 🎉

## 🌐 Mode en ligne partagé (chacun son téléphone)

Par défaut l'appli marche en **local** (données sur l'appareil). Pour que **chaque
ami joue depuis son propre téléphone avec un classement commun en direct**, il suffit
de brancher une base **Vercel KV / Upstash Redis** au projet Vercel :

1. Sur Vercel → projet `dimaprono` → onglet **Storage** → **Create Database** →
   **KV (Upstash Redis)** → **Connect** au projet.
2. Vercel injecte automatiquement les variables (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).
   **Redeploy** le projet.

L'appli détecte la base toute seule : le badge passe de **🟡 Local** à **🟢 En ligne · partagé**,
et tous les pronos/résultats sont synchronisés entre les téléphones (rafraîchissement auto).
Sans base configurée, l'appli continue de fonctionner en local, rien ne casse.

La logique serveur est dans `api/store.js` (fonction serverless Vercel).

## 🎨 Personnalisation

- Le logo s'affiche automatiquement si tu déposes ton image dans `assets/logo.png`
  (un logo SVG assorti est utilisé par défaut).
- Modifie les équipes, dates, barème et surprises depuis l'onglet **Orga**.

## 📁 Structure

```
index.html          → la page
assets/styles.css   → le design (thème or & noir)
assets/app.js       → toute la logique (pronos, points, classement, podium)
assets/logo.svg     → logo par défaut (remplaçable par assets/logo.png)
```

Bon prono ! 🥇
