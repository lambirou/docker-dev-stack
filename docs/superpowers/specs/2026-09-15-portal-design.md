# Portail de la stack de développement — design

Date : 2026-09-15
Statut : validé

## Contexte

Le dépôt `dev-stack` expose onze services locaux derrière Traefik, joignables sur des
domaines `.test` / `.localhost` et sur leurs ports directs. Retrouver la bonne URL ou le
bon identifiant demande aujourd'hui d'ouvrir le README. Le dossier `portal/` existe mais
est vide.

## Objectif

Une page d'accueil unique pour la stack : toutes les URL au même endroit, l'état de
chaque service en un coup d'œil, et le rappel des identifiants de développement.

### Hors périmètre

Authentification, persistance serveur, favoris, métriques, édition de la liste des
services depuis l'interface, internationalisation. L'interface est en français, comme
le reste du dépôt.

## Décision d'architecture

**Retenu : application statique React avec sonde de disponibilité côté navigateur.**
La liste des services est déclarée dans le code, la sonde tourne dans l'onglet ouvert,
l'image de production est un nginx qui sert des fichiers. Aucun backend, aucune surface
supplémentaire à maintenir.

Deux alternatives ont été écartées :

| Alternative | Raison du rejet |
| --- | --- |
| Lecture de l'API Traefik (`/api/http/services`) | Impose un middleware CORS et ne couvre pas les services sans label Traefik (postgres, mariadb, redis). |
| Backend Node branché sur le socket Docker | État réel des conteneurs, mais second service à maintenir et socket Docker exposé. Disproportionné. |

La sonde est isolée derrière un hook (`useHealth`) : basculer vers l'une de ces deux
approches plus tard ne toucherait que ce fichier.

## Structure

```
portal/
  Dockerfile              # node:22-alpine (build) -> nginx:1.29-alpine (service)
  nginx.conf              # fallback SPA, gzip, cache des assets
  package.json
  vite.config.js          # plugins react + @tailwindcss/vite
  index.html
  src/
    main.jsx
    App.jsx
    index.css             # @import "tailwindcss" + bloc @theme
    data/services.js      # source de vérité : la liste des services
    data/recherche.js     # index Fuse.js et fonction de recherche
    hooks/useHealth.js    # sonde périodique
    hooks/useTheme.js     # bascule sombre/clair, persistée
    components/
      Header.jsx          # titre, recherche, bascule de thème, rafraîchissement
      ServiceGrid.jsx     # regroupement par catégorie
      ServiceCard.jsx     # une carte
      StatusDot.jsx       # pastille d'état
      CopyButton.jsx      # copie dans le presse-papier
```

Stack : Vite 7, React 19, Tailwind CSS v4 (configuration CSS-first via `@theme`, sans
`tailwind.config.js`) et Fuse.js pour la recherche. JavaScript et non TypeScript : le
reste du dépôt n'en utilise pas.

## Modèle de données

Chaque service est un objet de `src/data/services.js` :

```js
{
  id: "minio",
  nom: "MinIO",
  role: "Stockage objet compatible S3",
  categorie: "stockage",
  urlTest: "https://minio.test",
  urlLocalhost: "https://minio.localhost",
  portDirect: 9001,                 // port hôte de l'interface web
  portsAnnexes: [                   // affichés, non cliquables
    { label: "API S3", port: 9000 }
  ],
  sonde: "http://localhost:9001",   // null si le service ne parle pas HTTP
  motsCles: ["s3", "objet", "bucket", "upload", "aws", "blob"],
  identifiants: [
    { label: "Utilisateur", valeur: "devadmin" },
    { label: "Mot de passe", variable: "MINIO_ROOT_PASSWORD" }
  ]
}
```

Ajouter un service à la stack se résume à ajouter une entrée dans ce fichier.

Le champ `motsCles` rassemble synonymes, sigles et cas d'usage. Il existe pour que la
recherche réponde à un besoin — `s3`, `jwt`, `smtp`, `cache`, `graphe` — et pas
seulement à un nom de produit que l'utilisateur doit déjà connaître.

### Services couverts

Les douze services de la stack, portail compris, répartis en quatre catégories :

L'ordre du tableau `categories` fixe l'ordre des sections : l'outillage vient en tête.

| Catégorie | Services |
| --- | --- |
| Outillage | traefik, mailpit, it-tools, portal |
| Données | postgres, mariadb, phpmyadmin, neo4j |
| Recherche et vecteurs | qdrant, meilisearch |
| Cache et stockage | redis, redisinsight, minio |

Les services sans interface web (postgres, mariadb, redis) apparaissent comme cartes
informatives : pas de lien principal, pas de sonde, une pastille neutre marquée `TCP`
et la chaîne de connexion affichée avec un bouton de copie.

## Sonde de disponibilité

`useHealth` interroge chaque service dont `sonde` n'est pas nul :

- Requête `fetch(url, { mode: "no-cors", cache: "no-store" })` avec `AbortController`
  et délai maximal de 5 secondes.
- Résolution de la promesse : `joignable`. Rejet ou expiration du délai : `injoignable`.
- État initial : `vérification`.
- Rythme : au montage, toutes les 15 secondes, au retour du focus sur l'onglet, et à la
  demande via le bouton de rafraîchissement.

**La sonde vise le port direct sur `localhost`, pas le domaine `.test`.** Les ports sont
publiés par Compose et répondent même sans entrée dans le fichier hosts ; sonder `.test`
afficherait toute la stack en rouge sur une machine où `setup-hosts.ps1` n'a pas été lancé.

Une réponse opaque ne permet pas de lire le code HTTP : un 401 de Qdrant compte comme
joignable. C'est le sens voulu — la question posée est *est-ce que le conteneur répond*,
pas *est-ce qu'il est sain*. L'interface emploie donc le mot `joignable` et non `sain`.

## Interface

Page unique, thème sombre par défaut, bascule vers le thème clair persistée dans
`localStorage`.

- **En-tête** : titre, compteur `n/m services joignables`, champ de recherche (focus par
  la touche `/`), bouton de rafraîchissement, bascule de thème.
- **Grille** : sections par catégorie, cartes en grille responsive (1 colonne en mobile,
  2 en tablette, 3 en large).
- **Carte** : nom, rôle, pastille d'état, lien principal `.test`, lien secondaire
  `.localhost`, port direct cliquable, ports annexes en texte, et bloc identifiants
  repliable.
- **Recherche** : recherche floue Fuse.js sur le nom (poids 4), l'identifiant (3), les
  mots-clés (2), le rôle (2) et le libellé de la catégorie (1). Seuil de 0,25, position
  et diacritiques ignorés : `qdrnt` trouve Qdrant, `donnees` la section Données, `s3`
  MinIO et `jwt` IT Tools. Le seuil est serré parce que les mots-clés élargissent le
  corpus indexé : à 0,35, un terme court comme `rag` remontait toute la stack. Les
  sections vides disparaissent. Le regroupement par catégorie est conservé pendant la
  recherche, donc le classement Fuse ne joue qu'à l'intérieur de chaque section.

## Identifiants

Le bloc identifiants affiche l'utilisateur et le **nom de la variable** `.env`
(`POSTGRES_PASSWORD`), jamais sa valeur. Un build statique figerait les mots de passe
dans l'image Docker et dans le bundle JavaScript servi à tout le réseau local.

Le bouton de copie copie la valeur affichée : nom d'utilisateur, nom de variable ou
chaîne de connexion.

## Conteneurisation

`Dockerfile` multi-étapes :

1. `node:22-alpine` — `npm ci` puis `npm run build`.
2. `nginx:1.29-alpine` — copie de `dist/` vers `/usr/share/nginx/html`, configuration
   personnalisée, exposition du port 80.

`nginx.conf` : `try_files` avec repli sur `index.html`, gzip actif, `Cache-Control:
immutable` sur `/assets/` et `no-cache` sur `index.html`.

## Intégration à la stack

**docker-compose.yml** — nouveau service, ancre `*common` incluse :

```yaml
portal:
  <<: *common
  build: ./portal
  container_name: dev-portal
  ports: ["${PORTAL_PORT:-8080}:80"]
  labels:
    traefik.enable: "true"
    traefik.http.routers.portal.rule: Host(`portal.test`) || Host(`portal.localhost`)
    traefik.http.routers.portal.entrypoints: web
    traefik.http.routers.portal-tls.rule: Host(`portal.test`) || Host(`portal.localhost`)
    traefik.http.routers.portal-tls.entrypoints: websecure
    traefik.http.routers.portal-tls.tls: "true"
    traefik.http.services.portal.loadbalancer.server.port: "80"
```

Le port 8080 est libre sur l'hôte : Traefik publie son tableau de bord sur 8090,
phpMyAdmin sur 8306, Mailpit sur 8025.

**.env et .env.example** : ajout de `PORTAL_PORT=8080`.

**scripts/lib.ps1** : ajout de `'portal'` à `Get-StackHostnames`, ce qui propage
l'entrée `portal.test` au fichier hosts et aux messages d'installation.

**scripts/verify.ps1** : un point de contrôle supplémentaire sur le routage
`https://portal.test`, aligné sur les contrôles existants.

**README.md** : une ligne dans le tableau des services et une mention du portail comme
point d'entrée de la stack.

## Développement

```powershell
cd portal
npm install
npm run dev      # http://localhost:5173
```

Le serveur Vite tourne hors Docker. Les sondes visent `localhost:<port>` et fonctionnent
donc à l'identique en développement et dans le conteneur.

`docker compose up -d --build portal` reconstruit l'image après modification.

## Critères de réussite

1. `npm run build` passe sans avertissement.
2. `docker compose up -d --build portal` démarre le conteneur en état `running`.
3. `https://portal.test` et `http://localhost:8080` affichent la grille complète.
4. Les cartes des services démarrés passent en `joignable` en moins de 5 secondes.
5. Arrêter un service (`docker compose stop mailpit`) fait passer sa carte en
   `injoignable` au cycle suivant.
6. La recherche, la bascule de thème et les boutons de copie fonctionnent.
7. `scripts/verify.ps1` passe, portail inclus.
8. Aucun mot de passe en clair dans `portal/dist`.
