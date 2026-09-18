# Dev Stack Docker

Environnement de développement local : bases relationnelles, moteurs vectoriels, recherche,
graphe, cache, stockage objet et outillage, le tout derrière un reverse proxy Traefik.

![Le portail de la stack : une carte par service, avec son état, ses domaines et son port direct](docs/screenshot.png)

## Services

| Service | Image | Rôle | URL | Port direct |
| --- | --- | --- | --- | --- |
| portal | build local (`nginx:1.29-alpine`) | Portail d'accès à la stack, derrière une page de connexion | https://dev.test | aucun |
| postgres | `pgvector/pgvector:pg17` | Relationnel + vecteurs | - | 5432 |
| mariadb | `mariadb:12.3` | Relationnel | - | 3306 |
| phpmyadmin | `phpmyadmin:5` | UI MariaDB | https://phpmyadmin.dev.test | 8306 |
| prisma-studio | build local (`node:22-alpine`) | Console PostgreSQL, derrière la page de connexion | https://prisma.dev.test | 5555 |
| qdrant | `qdrant/qdrant:v1.19.0` | Base vectorielle | https://qdrant.dev.test | 6333, gRPC 6334 |
| meilisearch | `getmeili/meilisearch:v1` | Recherche plein texte | https://meilisearch.dev.test | 7700 |
| neo4j | `neo4j:5.26-community` | Base graphe | https://neo4j.dev.test | 7474, bolt 7687 |
| redis | `redis:8-alpine` | Cache / files | - | 6379 |
| redisinsight | `redis/redisinsight:latest` | UI Redis | https://redis.dev.test | 5540 |
| minio | `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z` | Stockage objet S3 | https://minio.dev.test | API 9000, console 9001 |
| mailpit | `axllent/mailpit:v1.31.1` | Capture des mails | https://mail.dev.test | UI 8025, SMTP 1025 |
| it-tools | `corentinth/it-tools:2024.10.22-7ca5933` | Boîte à outils dev (encodage, JSON, crypto, réseau) | https://tools.dev.test | 8081 |
| dockhand | `fnsys/dockhand:v1.0.48` | Gestion des conteneurs Docker | https://containers.dev.test | 8082 |
| traefik-manager | `ghcr.io/chr0nzz/traefik-manager:1.13.5` | UI de configuration de Traefik (routes, middlewares) | https://proxy.dev.test | 8083 |
| tinyauth | `ghcr.io/tinyauthapp/tinyauth:v5.2.0` | Page de connexion partagée, middleware d'authentification de la stack | https://auth.dev.test | aucun |
| traefik | `traefik:v3.7` | Reverse proxy | https://traefik.dev.test | 80, 443, API 8090 |

Toutes les URL ci-dessus sont servies en HTTPS : le port 80 redirige en 301 vers 443.

Chaque service reste joignable en direct sur son port, en HTTP simple et sans passer par
le proxy : le reverse proxy est un confort, pas un passage obligé. Seules exceptions, le
portail et tinyauth : ni l'un ni l'autre ne publie de port, le passage par Traefik — et
donc par la page de connexion — est obligatoire.

## Installation

Tout est scriptable, sur les trois systèmes. Les scripts sont idempotents :
les relancer ne casse rien et ne duplique rien.

**Windows** — dans un PowerShell **administrateur** :

```powershell
.\scripts\install.ps1 -WithHosts -WithTls
```

**macOS, Linux et WSL** — dans un terminal ordinaire, `sudo` est demandé au moment voulu :

```bash
chmod +x scripts/*.sh          # une seule fois, si le bit exécutable manque
./scripts/install.sh --with-hosts --with-tls
```

Le script installe Docker s'il manque, crée le `.env`, télécharge les images,
démarre les services, ajoute les domaines `.test` au fichier hosts, génère les
certificats HTTPS, puis vérifie les 44 points de contrôle.

Sans droits élevés, la version réduite fonctionne aussi — `.\scripts\install.ps1`
ou `./scripts/install.sh`. Les deux options qui touchent la machine sont alors
ignorées et signalées en fin d'exécution.

### Les scripts

Chaque script existe en deux versions au comportement identique : `.ps1` pour
Windows, `.sh` pour macOS, Linux et WSL.

| Script | Rôle | Droits élevés |
| --- | --- | --- |
| `install` | Orchestrateur complet | selon les options |
| `install-docker` | Installe Docker et attend le moteur | oui si absent |
| `setup-hosts` | Écrit les entrées `.test` dans le fichier hosts | oui |
| `setup-tls` | Installe mkcert et génère les certificats | oui |
| `verify` | Contrôle santé et routage de toute la stack | non |
| `lib` | Fonctions partagées, non exécutable seul | - |

Les options de l'orchestrateur se correspondent une à une :

| Effet | Windows | macOS / Linux |
| --- | --- | --- |
| Sauter la vérification Docker | `-SkipDocker` | `--skip-docker` |
| Ajouter les domaines `.test` | `-WithHosts` | `--with-hosts` |
| Générer les certificats | `-WithTls` | `--with-tls` |
| Sauter le contrôle final | `-NoVerify` | `--no-verify` |
| Répondre oui à tout | - | `-y` |

Pour retirer les entrées du fichier hosts : `.\scripts\setup-hosts.ps1 -Remove`
ou `./scripts/setup-hosts.sh --remove`.

### Installation manuelle

```bash
cp .env.example .env     # Copy-Item .env.example .env sous Windows
docker compose up -d
docker compose ps
```

## Prérequis

| Système | Moteur | Installé par le script via |
| --- | --- | --- |
| Windows 10/11 | Docker Desktop (WSL 2) | winget |
| macOS 13+ | Docker Desktop | Homebrew |
| Linux, WSL | Docker Engine + plugin compose v2 | get.docker.com |

Validé avec Docker 29.7.2 et Compose v5.5.1. Compose **v2** est obligatoire :
le `docker-compose` v1 de certains dépôts ne connaît pas `--wait`.

Sur macOS, OrbStack et Colima font aussi l'affaire à la place de Docker Desktop.
Sur Linux, ton compte doit appartenir au groupe `docker` : le script l'ajoute,
mais il faut fermer puis rouvrir la session pour que ça prenne effet.

Le premier démarrage télécharge environ 2 Go d'images. Neo4j met 20 à 30 secondes
à devenir sain, les autres services sont prêts en quelques secondes.

### Moteurs Docker alternatifs

Traefik et Dockhand ont besoin de parler au moteur par son socket. Docker Desktop
et Docker Engine l'exposent sur `/var/run/docker.sock`, mais pas Colima
(`~/.colima/default/docker.sock`), Rancher Desktop ni Podman. `install.sh` lit le
contexte Docker courant et renseigne `DOCKER_SOCKET` dans le `.env` ; en
installation manuelle, il suffit de remplir cette variable soi-même.

## Noms de domaine en .dev.test

Tous les services vivent sous un domaine parent commun, `dev.test`. Ce niveau
supplémentaire n'est pas cosmétique : le cookie de session de tinyauth est posé
dessus, ce qui permet à une seule page de connexion de couvrir n'importe quel service
de la stack — voir la section Authentification.

Le portail, lui, occupe le domaine nu : `https://dev.test`. C'est la porte d'entrée de
la stack, et tinyauth accepte l'hôte qui est exactement le domaine de son cookie.

Aucun système ne résout `.test` au niveau DNS. Les navigateurs mappent `*.localhost`
sur 127.0.0.1 tout seuls, mais aucun ne le fait pour `.test`. Pour activer les URL
`.dev.test` partout, y compris depuis `curl` et le code applicatif :

```powershell
.\scripts\setup-hosts.ps1          # Windows, PowerShell administrateur
```

```bash
./scripts/setup-hosts.sh           # macOS, Linux, WSL — sudo demandé
```

Équivalent manuel sous Windows :

```powershell
$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$names = "auth","traefik","minio","mail","redis","qdrant","meilisearch","neo4j","phpmyadmin","prisma","tools","containers","proxy"
Add-Content $hostsFile "127.0.0.1 dev.test"        # le portail, sur le domaine nu
Add-Content $hostsFile ($names | ForEach-Object { "127.0.0.1 $($_).dev.test" })
```

Et sous macOS ou Linux :

```bash
echo "127.0.0.1 dev.test" | sudo tee -a /etc/hosts >/dev/null   # le portail
for n in auth traefik minio mail redis qdrant meilisearch neo4j phpmyadmin prisma tools containers proxy; do
  echo "127.0.0.1 $n.dev.test" | sudo tee -a /etc/hosts >/dev/null
done
```

Le fichier hosts ne gère les jokers sur aucun système : une ligne par nom, et une
ligne de plus à chaque nouveau service. Sur macOS, `/etc/resolver/test` couplé à
dnsmasq permet de router tout le TLD d'un coup ; sur Linux, dnsmasq ou
systemd-resolved font la même chose. Les deux sortent du cadre de ces scripts,
qui s'en tiennent au fichier hosts pour rester lisibles et réversibles.

Chaque service répond sur deux domaines équivalents, par exemple `minio.dev.test` et
`minio.dev.localhost`. Le second marche dans le navigateur sans toucher au fichier hosts.

## HTTPS

La stack est **entièrement servie en HTTPS**. Traefik écoute sur le port 443, et le
port 80 ne sert plus qu'à rediriger : toute requête HTTP reçoit un **301** vers son
équivalent HTTPS, quel que soit le domaine visé.

La redirection est posée sur l'entrypoint lui-même, pas sur chaque routeur. Deux
conséquences utiles : elle couvre aussi les hôtes inconnus, et chaque service n'a plus
qu'un seul routeur — `websecure`, avec `tls: "true"` — au lieu de la paire
`<service>` / `<service>-tls` d'avant. L'entrypoint `websecure` est par ailleurs déclaré
`asDefault=true` : un service ajouté sans préciser son entrypoint atterrit en HTTPS,
et un oubli d'étiquette ne peut plus ouvrir un accès en clair par mégarde.

Les ports directs, eux, restent inchangés et en HTTP simple : `localhost:8306` pour
phpMyAdmin, `localhost:9001` pour MinIO, etc. Ils ne passent pas par le proxy, donc ni
par le TLS ni par la page de connexion — c'est un confort de débogage, à garder en tête.

Par défaut Traefik présente un certificat auto-signé qu'il génère lui-même. Ça marche,
mais le navigateur affiche un avertissement à chaque domaine.

Pour des certificats reconnus par le navigateur, utiliser mkcert, qui installe une
autorité de certification locale dans le magasin de confiance du système :

```powershell
.\scripts\setup-tls.ps1           # Windows
```

```bash
./scripts/setup-tls.sh            # macOS, Linux, WSL
```

Le script demande confirmation avant de toucher au magasin de certificats, et
installe mkcert lui-même : winget sous Windows, Homebrew sous macOS, le
gestionnaire de paquets sous Linux — avec repli sur le binaire officiel dans
`~/.local/bin` quand la distribution ne le fournit pas.

Équivalent manuel sous Windows :

```powershell
winget install FiloSottile.mkcert
mkcert -install
cd config\traefik\certs
mkcert -cert-file local.pem -key-file local-key.pem "dev.test" "*.dev.test" "dev.localhost" "*.dev.localhost" localhost 127.0.0.1 ::1
cd ..\..\..
Copy-Item config\traefik\dynamic\tls.yml.example config\traefik\dynamic\tls.yml
docker compose restart traefik
```

Et sous macOS ou Linux :

```bash
brew install mkcert nss                      # macOS
sudo apt install mkcert libnss3-tools        # Debian, Ubuntu
mkcert -install
cd config/traefik/certs
mkcert -cert-file local.pem -key-file local-key.pem "dev.test" "*.dev.test" "dev.localhost" "*.dev.localhost" localhost 127.0.0.1 ::1
chmod 0644 local.pem local-key.pem           # Traefik lit la clé en non-root
cd ../../..
cp config/traefik/dynamic/tls.yml.example config/traefik/dynamic/tls.yml
docker compose restart traefik
```

Le paquet nss / libnss3-tools n'est pas décoratif : sans lui, mkcert installe
l'autorité pour le système mais pas pour Firefox, qui tient son propre magasin.

Le domaine nu `dev.test` est listé en plus du joker : un certificat pour `*.dev.test`
ne couvre que les noms d'un niveau en dessous, jamais le domaine lui-même. Sans cette
entrée, le portail serait le seul service à déclencher un avertissement.

À savoir avant de lancer `mkcert -install` : la commande ajoute une autorité racine
au magasin de certificats de la machine. C'est le prix à payer pour du HTTPS local
sans avertissement, et ça reste réversible avec `mkcert -uninstall`.

Let's Encrypt n'est pas une option ici : les domaines `.test` ne sont pas résolvables
publiquement, donc aucune validation ACME ne peut aboutir.

Pour revenir à un port 80 servi en clair plutôt qu'en redirection, retirer ces trois
lignes du bloc `command` de traefik, puis redonner un routeur `web` aux services voulus :

```yaml
- --entrypoints.web.http.redirections.entrypoint.to=websecure
- --entrypoints.web.http.redirections.entrypoint.scheme=https
- --entrypoints.web.http.redirections.entrypoint.permanent=true
```

Le `permanent=true` renvoie un 301 plutôt qu'un 302. Les navigateurs le mettent en
cache : après un premier passage, ils vont directement en HTTPS sans repasser par le
port 80. Pratique en usage courant, gênant pendant un test de bascule — d'où le
rappel, si le comportement semble figé, de vider le cache de redirection du navigateur.

## Authentification

Tinyauth est la page de connexion de la stack : une adresse à elle, https://auth.dev.test,
et un middleware Traefik `tinyauth@docker` que n'importe quel routeur peut appeler. Le
portail est le seul à s'en servir par défaut, parce qu'il affiche tous les identifiants.

https://dev.test renvoie donc vers la page de connexion tant qu'aucune session
n'existe ; après connexion avec `dev` / `devauthpass`, le portail s'affiche normalement
et reçoit au passage les en-têtes `Remote-User`, `Remote-Name` et `Remote-Email`. Le
bouton de déconnexion de son en-tête renvoie vers `/logout` sur tinyauth : la session y
est détruite, puis le formulaire de connexion réapparaît.

Deux détails expliquent la forme du montage :

- **Toute la stack vit sous `dev.test`.** Tinyauth pose son cookie de session sur le
  domaine parent de son `TINYAUTH_APP_URL` : `auth.dev.test` donne un cookie valable pour
  `dev.test`, donc pour `phpmyadmin.dev.test` et tous les autres — et pour le portail,
  qui occupe `dev.test` lui-même, un hôte que tinyauth accepte puisqu'il est exactement
  le domaine du cookie. Avec des noms à plat en `service.test`, ce cookie aurait dû porter
  sur le TLD `test` lui-même, ce que les navigateurs refusent — et tinyauth avec eux.
- **Ni le portail ni tinyauth ne publient de port.** `localhost:8080` court-circuiterait
  la page de connexion, et tinyauth n'a besoin de parler qu'à Traefik.

Depuis la bascule en tout-HTTPS, le cookie de session porte l'attribut `Secure`
(`TINYAUTH_AUTH_SECURECOOKIE: "true"`) : le navigateur refuse alors de le renvoyer sur
une origine en clair. C'est possible précisément parce qu'aucun des deux services ne
publie de port et que le port 80 ne fait plus que rediriger — il ne reste aucune
origine HTTP par laquelle la session pourrait fuiter. L'en-tête complet est
`HttpOnly; Secure; SameSite=Lax`, sur `Domain=dev.test`.

Sans les entrées `.dev.test` dans le fichier hosts, mettre
`TINYAUTH_APP_URL=https://auth.dev.localhost` dans le `.env` : c'est la seule URL de
la stack qui doit être absolue, puisque tinyauth y renvoie le navigateur.

Un service protégé suit d'ailleurs le parfum de domaine de cette URL : avec
`auth.dev.test`, c'est `dev.test` qui fonctionne, pas `dev.localhost`, où
le cookie de session n'existe pas. C'est pour ça que la carte du portail ne propose que
son domaine `.test`, là où les services ouverts affichent les deux.

Tinyauth garde sa carte dans le portail, avec son URL et ses identifiants : c'est un
composant de la stack comme un autre, qui se visite et s'inspecte.

### Protéger un autre service

Une seule ligne désormais, dans les `labels` du service visé — chaque service n'a plus
qu'un routeur depuis la bascule en tout-HTTPS :

```yaml
      traefik.http.routers.phpmyadmin.middlewares: tinyauth@docker
```

Puis `docker compose up -d phpmyadmin`. Il n'y a rien d'autre à faire : le service est
déjà sous `dev.test`, le cookie de session vaut donc pour lui. Son port direct, lui,
reste ouvert et contourne la connexion — le retirer aussi si le but est de fermer l'accès.

### Ce que le montage donne à observer

Le trajet complet tient en quatre échanges, tous lisibles depuis les outils réseau du
navigateur ou avec `curl` :

1. `GET https://dev.test/` sans cookie : Traefik interroge le middleware, qui répond
   401, et le navigateur part en 302 vers la page de connexion ;
2. le formulaire poste sur `auth.dev.test`, qui renvoie un `Set-Cookie` de domaine
   `dev.test` — c'est là que se joue tout le montage ;
3. retour sur `https://dev.test/`, cookie en poche : le middleware répond 200 et
   Traefik laisse passer la requête vers nginx ;
4. au passage, les en-têtes `Remote-User`, `Remote-Name` et `Remote-Email` de la réponse
   du middleware sont recopiés vers le portail, qui pourrait y ouvrir une session.

Le bouton de déconnexion illustre la contre-épreuve : `/logout` efface le cookie sur
`dev.test`, donc la session tombe pour tous les services protégés, pas seulement pour
le portail. C'est le même trajet, à l'envers.

Les logs racontent la même histoire : `docker compose logs -f tinyauth`.

### Changer le compte

Tinyauth ne lit que `TINYAUTH_AUTH_USERS`, au format `utilisateur:hash bcrypt` :

```bash
docker compose run --rm tinyauth user create --interactive
```

Répondre **oui** à « Format the output for Docker? » : les `$` du hash sont alors doublés,
ce qu'attend le `.env`. Reporter la ligne obtenue, puis `docker compose up -d tinyauth`.

### Rouvrir le portail

Supprimer la ligne `middlewares: tinyauth@docker` du bloc `labels` du portail et
remettre `ports: ["8080:80"]`. Le service `tinyauth` n'a alors plus de raison d'être.
À noter : `localhost:8080` serait servi en HTTP simple, hors du proxy et donc hors TLS.

## Prisma Studio

Console de la base PostgreSQL, sur https://prisma.dev.test : parcourir les tables,
filtrer, trier, éditer les lignes, suivre les clés étrangères et lancer du SQL.
C'est à Postgres ce que phpMyAdmin est à MariaDB.

Le service n'utilise pas la commande `prisma studio`, qui suppose un projet Prisma et
son `schema.prisma`. Il embarque le composant React `@prisma/studio-core`, comme le
décrit [la documentation d'embarquement](https://www.prisma.io/docs/studio/integrations/embedding) :
Studio ne sait pas ouvrir une connexion, il construit du SQL et le confie à un
**BFF** — *backend for frontend* — qui l'exécute. C'est tout l'intérêt du montage :
la chaîne de connexion reste sur le serveur et **n'atteint jamais le navigateur**.
Aucun schéma Prisma n'est requis, la structure est lue par introspection.

Le même processus Node sert le bundle et l'endpoint `/studio`, donc une seule origine
et aucun CORS à ouvrir. Il tient en deux fichiers :

| Fichier | Rôle |
| --- | --- |
| `apps/prisma-studio/server/index.js` | Le BFF : seul composant qui parle à Postgres |
| `apps/prisma-studio/src/App.jsx` | Le composant `<Studio />` et son adaptateur |

Le BFF implémente les cinq procédures du contrat : `query`, `sequence`, `transaction`
(les éditions multi-lignes sont atomiques), `sql-lint` (l'éditeur souligne les erreurs
avant exécution) et une réponse explicite pour `query-insights`, qui suppose une
télémétrie que cette stack n'a pas.

**La console est derrière tinyauth**, comme le portail. Ce n'est pas décoratif : elle
lit *et écrit* dans la base sans redemander le moindre mot de passe. Le port direct
`localhost:5555`, lui, court-circuite la page de connexion — c'est vrai de tous les
ports publiés de la stack, mais cela se sait pour un accès en écriture. Retirer la
ligne `ports:` du service ferme cet accès.

Deux garde-fous côté serveur : `statement_timeout` à 30 secondes, pour qu'une requête
trop lourde rende la main avec une erreur lisible plutôt que de figer l'onglet, et
`application_name=prisma-studio`, qui rend ces sessions identifiables dans
`pg_stat_activity`. Les écritures demandent toujours une confirmation explicite.

### Pointer une autre base

Par défaut, Studio ouvre la base décrite par les variables `POSTGRES_*`. Pour viser
ailleurs, renseigner `PRISMA_STUDIO_DATABASE_URL` dans le `.env` — elle a la priorité :

```bash
PRISMA_STUDIO_DATABASE_URL=postgresql://user:pass@hote:5432/autre_base
docker compose up -d prisma-studio
```

Depuis un conteneur, l'hôte est le **nom du service** (`postgres`), pas `localhost`.

### Fonctions assistées par IA

Elles sont volontairement absentes. Studio les masque de lui-même quand la prop `llm`
n'est pas fournie : les brancher supposerait une clé d'API et un appel sortant à
chaque requête, ce qu'une stack locale n'a pas à faire sans qu'on le demande. La
télémétrie anonyme du paquet est coupée par `CHECKPOINT_DISABLE=1`.

### Développement

```bash
cd apps/prisma-studio
npm install
npm start            # le BFF, sur 5555
npm run dev          # Vite sur 5174, qui relaie /studio vers le BFF
```

Le thème est accordé sur celui du portail dans `src/index.css`, et non par la prop
`theme` du composant : la documentation la décrit au format shadcn en triplets HSL,
mais la version 0.33 déclare ses variables en `oklch` et n'injecte aucune feuille de
style à partir de cette prop. Le commentaire du fichier le rappelle.

## Identifiants

Tous définis dans `.env`, valeurs de développement uniquement.

| Service | Utilisateur | Mot de passe |
| --- | --- | --- |
| Postgres | `dev` | `devpass` (base `devdb`) |
| MariaDB | `dev` / root | `devpass` / `rootpass` |
| Neo4j | `neo4j` | `devpassword` |
| Redis | - | `devpass` |
| MinIO | `devadmin` | `devadminpass` |
| Qdrant | clé API | `devkey` (en-tête `api-key`) |
| Meilisearch | clé maître | `devmasterkey_min16chars` |
| Traefik Manager | - | `devproxypass` (mot de passe seul, pas de nom d'utilisateur) |
| Tinyauth, donc accès au portail et à Prisma Studio | `dev` | `devauthpass` |

Dans RedisInsight, ajouter la base avec l'hôte `redis` et le port `6379` : la connexion
part de l'intérieur du réseau Docker, pas de `localhost`.

Prisma Studio ne demande rien : sa connexion vit côté serveur et n'est jamais envoyée
au navigateur. Seule la page de connexion de la stack le protège.

### Copier les vraies valeurs depuis le portail

Les cartes du portail affichent les identifiants réels, pas le nom des variables. Elles
lisent `/config.json`, écrit par le conteneur `portal` à chaque démarrage à partir des
variables que `docker-compose.yml` lui transmet depuis `.env`. Aucun identifiant n'entre
donc dans le bundle JavaScript.

Le bouton œil de l'en-tête dévoile les valeurs sensibles, masquées par défaut. Le bouton
de copie, lui, renvoie toujours la valeur réelle, y compris quand elle est masquée à
l'écran, chaînes de connexion comprises.

Après une modification du `.env`, recréer le conteneur pour que le portail suive :

```bash
docker compose up -d portal
```

Conséquence à connaître : le portail expose les identifiants de la stack à quiconque peut
l'ouvrir. C'est précisément pourquoi il est le seul service placé derrière tinyauth — voir
la section Authentification. Pour un cran de plus sur une machine partagée, supprimer le
bloc `environment` du service `portal` fait revenir les cartes aux simples noms de variables.

En développement (`npm run dev` dans `portal/`), Vite sert le même `/config.json` en
relisant le `.env` de la racine à chaque requête.

## Où vivent les données

Les données des bases sont dans des **volumes Docker nommés**, pas dans `./data`.
Ce choix est imposé par Windows : Postgres refuse de démarrer sur un montage de disque
Windows car il exige des permissions `0700` sur son répertoire, impossible à obtenir là.
MariaDB et Neo4j ont le même genre de contrainte.
Le même choix sert la portabilité : les volumes nommés se comportent de façon
identique sur les trois systèmes, là où un bind mount dépend du système de
fichiers de l'hôte.

Le dossier `./data` sert de zone d'échange avec l'hôte :

| Dossier hôte | Monté dans | Usage |
| --- | --- | --- |
| `data/postgres` | postgres:/backups | dumps SQL |
| `data/mariadb` | mariadb:/backups | dumps SQL |
| `data/qdrant` | qdrant:/qdrant/snapshots | snapshots |
| `data/meilisearch` | meilisearch:/dumps | dumps |
| `data/neo4j` | neo4j:/import | fichiers à importer |
| `data/traefik-manager` | traefik-manager:/app/backups | sauvegardes de la config dynamique |

Le dossier `./config` contient la configuration montée en lecture seule : script
d'initialisation Postgres, fichier de réglages MariaDB, configuration dynamique Traefik.

Sous Linux, ces dossiers d'échange ont une contrainte de plus : les conteneurs y
écrivent sous leur propre uid (999 pour Postgres, 7474 pour Neo4j), qui n'est pas
le tien. `install.sh` leur applique donc `chmod 0777` — acceptable sur un poste de
développement, à ne pas reproduire ailleurs. Windows et macOS n'ont pas ce problème :
leurs montages sont traduits par le moteur Docker.

Le script `config/postgres/init/01-extensions.sql` active `vector`, `pg_trgm` et
`uuid-ossp`. Il ne s'exécute qu'au tout premier démarrage, quand le volume est vide.
Le modifier plus tard n'a aucun effet sans `docker compose down -v`, qui détruit les données.

## Commandes utiles

```bash
docker compose up -d                 # démarrer
docker compose stop                  # arrêter sans rien perdre
docker compose down                  # supprimer les conteneurs, garder les volumes
docker compose logs -f neo4j         # suivre les logs d'un service
docker compose restart traefik       # recharger le proxy
docker compose ps                    # état et santé
docker stats --no-stream             # consommation mémoire
```

Accès aux consoles :

```bash
docker compose exec postgres psql -U dev -d devdb
docker compose exec mariadb mariadb -udev -pdevpass devdb
docker compose exec redis redis-cli -a devpass
docker compose exec neo4j cypher-shell -u neo4j -p devpassword
```

## Sauvegarde et restauration

Les dumps s'écrivent dans le conteneur vers `/backups`, qui correspond à `./data/<service>`
sur l'hôte. Ça évite les problèmes d'encodage des redirections PowerShell, et ça
donne la même commande sur les trois systèmes.

```bash
docker compose exec postgres sh -c 'pg_dump -U dev devdb > /backups/devdb.sql'
docker compose exec postgres sh -c 'psql -U dev devdb < /backups/devdb.sql'

docker compose exec mariadb sh -c 'mariadb-dump -udev -pdevpass devdb > /backups/devdb.sql'
docker compose exec mariadb sh -c 'mariadb -udev -pdevpass devdb < /backups/devdb.sql'
```

## Notes sur les versions

Les images sont épinglées volontairement. MariaDB 12.3 et Neo4j 5.26 sont les versions
LTS de leurs branches respectives.

**MinIO mérite une mise en garde.** Le dépôt `minio/minio` a été supprimé de Docker Hub,
et l'image la plus récente disponible sur Quay.io date du 7 septembre 2025. La console
web de l'édition communautaire a par ailleurs été amputée en mai 2025 : il ne reste que
la création et la navigation dans les buckets, toute l'administration passe par le client
`mc`. En pratique, ce conteneur tourne sans correctif depuis plus d'un an. Acceptable
pour du développement local non exposé ; à remplacer par Garage, SeaweedFS ou RustFS
si ce point devient gênant.

**it-tools est figé sur sa dernière version stable**, `2024.10.22-7ca5933`, seule image
taguée publiée depuis. Le développement continue sur le tag `nightly`, reconstruit
régulièrement mais non versionné : à utiliser seulement si un outil récent manque,
en acceptant qu'une mise à jour puisse changer le comportement sans préavis.

**Dockhand a le socket Docker en écriture.** C'est ce qui lui permet de démarrer,
arrêter et supprimer des conteneurs, mais un accès en écriture à `/var/run/docker.sock`
équivaut à un accès root sur la machine hôte. Acceptable pour une stack locale non
exposée ; ne jamais publier `containers.dev.test` au-delà de 127.0.0.1. Pour un usage plus
strict, passer par un socket-proxy en lecture seule, au prix des actions d'écriture.

Dockhand est distribué sous licence **BUSL 1.1**, pas sous une licence open source
classique : usage interne et personnel libre, revente ou hébergement pour des tiers
exclus. Le compte administrateur se crée au premier accès à l'interface, il n'y a rien
à mettre dans `.env`.

**Traefik Manager écrit dans `config/traefik/dynamic`.** C'est tout l'intérêt : les
routeurs, services et middlewares créés depuis l'interface atterrissent dans le dossier
que Traefik surveille déjà (`--providers.file.watch=true`), et sont actifs sans
redémarrage. Ce dossier est donc le seul de `./config` monté en écriture, et
`tls.yml` y apparaît comme un fichier éditable parmi les autres.

Deux fonctions restent éteintes, faute de fichier à leur donner : l'éditeur de
configuration statique et l'onglet Plugins, parce que ce Traefik est configuré par
arguments de ligne de commande et non par un `traefik.yml` ; et l'onglet Certificats,
qui lit un `acme.json` inexistant ici — les certificats viennent de mkcert, d'où
`CERT_RESOLVER=none`.

Le mot de passe de première connexion vient de `TRAEFIK_MANAGER_ADMIN_PASSWORD`. Sans
cette variable, chaque worker gunicorn en tire un au hasard et l'écrit dans ses logs :
deux mots de passe différents pour un seul compte. L'interface demande ensuite d'en
choisir un définitif, stocké dans le volume `traefik-manager-data` ; à partir de là,
la variable n'est plus lue. Il n'y a pas de nom d'utilisateur, seulement un mot de passe.

## Dépannage

**Le port 443 est déjà pris.** Changer `TRAEFIK_HTTPS_PORT` dans `.env` : les URL
deviennent `https://minio.dev.test:8443`. Le port 80 se change de la même façon avec
`TRAEFIK_HTTP_PORT`, mais il ne sert plus qu'à rediriger. Sous Windows, le coupable
habituel est IIS ou un service http.sys ; sous Linux, Apache ou nginx installés par la
distribution ; sous macOS, le serveur web d'un autre environnement de développement.

**Une URL reste bloquée en HTTPS après un retour en arrière.** La redirection est un 301,
que les navigateurs mettent en cache durablement : ils vont directement en HTTPS sans
redemander le port 80. Vider le cache de redirection du navigateur, ou tester en fenêtre
privée. `curl` n'a pas ce comportement et voit toujours la vraie réponse du port 80.

**Le navigateur avertit malgré mkcert, sur `.dev.localhost` uniquement.** Le certificat
couvre bien `*.dev.localhost`, mais ce nom doit figurer dans le certificat régénéré :
relancer `scripts/setup-tls.ps1` (ou `.sh`) si le fichier date d'avant la bascule.

**Une URL `.test` renvoie 404 juste après le démarrage.** Le service répond mais n'est pas
encore prêt. Neo4j est le plus lent. Vérifier avec `docker compose ps` que la santé est verte.

**Un service tout juste ajouté renvoie 404 derrière Traefik.** Le proxy n'expose que les
conteneurs sains : tant que le healthcheck est en `starting`, aucune route n'est créée.
Si le conteneur est `healthy` et que le 404 persiste, Traefik a manqué l'événement Docker,
un `docker compose restart traefik` relit l'inventaire.

**`.test` ne résout pas.** Les entrées du fichier hosts sont manquantes, voir plus haut.
En attendant, utiliser l'équivalent en `.localhost` dans le navigateur.

**Le navigateur refuse le certificat.** Normal tant que mkcert n'est pas installé :
le certificat auto-signé de Traefik n'est reconnu par personne.

**`permission denied` sur `/var/run/docker.sock` (Linux).** Ton compte n'est pas dans
le groupe `docker`. `sudo usermod -aG docker $USER`, puis fermer et rouvrir la session.

**Traefik et Dockhand ne voient aucun conteneur (macOS, Colima, Rancher, Podman).**
Le socket du moteur n'est pas à l'emplacement standard. Renseigner `DOCKER_SOCKET`
dans le `.env` avec le chemin réel, que donne
`docker context inspect --format '{{.Endpoints.docker.Host}}'`, puis
`docker compose up -d traefik dockhand`.

**Les conteneurs ne peuvent pas écrire dans `./data` (Linux).** Ils tournent sous un
uid qui n'est pas le tien : `chmod 0777 data/*` règle le cas sur un poste de
développement.

**Traefik ne lit pas `./config` sur Fedora, RHEL ou CentOS.** SELinux bloque l'accès
aux montages non étiquetés. Étiqueter les dossiers une fois pour toutes avec
`chcon -Rt svirt_sandbox_file_t config data`, ou ajouter le suffixe `,z` aux
montages concernés dans `docker-compose.yml`.

**`bash: ./scripts/install.sh: Permission denied`.** Le bit exécutable manque après le
clone : `chmod +x scripts/*.sh`.

**`/usr/bin/env: 'bash\r': No such file or directory`.** Le dépôt a été cloné avec
`core.autocrlf=true` et les scripts sont arrivés en CRLF. Le `.gitattributes` du dépôt
force pourtant le LF sur les `.sh` : `dos2unix scripts/*.sh` répare l'existant,
`git config core.autocrlf input` évite la récidive.

**Les ports privilégiés 80 et 443 échouent en Docker rootless (Linux).** Le démon
rootless ne peut pas les lier. Soit autoriser
`sudo sysctl net.ipv4.ip_unprivileged_port_start=80`, soit passer `TRAEFIK_HTTP_PORT`
et `TRAEFIK_HTTPS_PORT` à 8000 et 8443 dans le `.env`.

**Traefik affiche un avertissement `aliasHeadersStrategy` au démarrage.** Recommandation
de durcissement de Traefik v3.7 concernant l'usurpation d'en-têtes vers les backends PHP.
Sans conséquence sur une stack locale.
