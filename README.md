# Dev Stack Docker

Environnement de développement local : bases relationnelles, moteurs vectoriels, recherche,
graphe, cache, stockage objet et outillage, le tout derrière un reverse proxy Traefik.

## Services

| Service | Image | Rôle | URL | Port direct |
| --- | --- | --- | --- | --- |
| postgres | `pgvector/pgvector:pg17` | Relationnel + vecteurs | - | 5432 |
| mariadb | `mariadb:12.3` | Relationnel | - | 3306 |
| phpmyadmin | `phpmyadmin:5` | UI MariaDB | https://phpmyadmin.test | 8306 |
| qdrant | `qdrant/qdrant:v1.19.0` | Base vectorielle | https://qdrant.test | 6333, gRPC 6334 |
| meilisearch | `getmeili/meilisearch:v1` | Recherche plein texte | https://meilisearch.test | 7700 |
| neo4j | `neo4j:5.26-community` | Base graphe | https://neo4j.test | 7474, bolt 7687 |
| redis | `redis:8-alpine` | Cache / files | - | 6379 |
| redisinsight | `redis/redisinsight:latest` | UI Redis | https://redis.test | 5540 |
| minio | `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z` | Stockage objet S3 | https://minio.test | API 9000, console 9001 |
| mailpit | `axllent/mailpit:v1.31.1` | Capture des mails | https://mail.test | UI 8025, SMTP 1025 |
| traefik | `traefik:v3.7` | Reverse proxy | https://traefik.test | 80, 443, API 8090 |

Chaque service reste joignable en direct sur son port : le proxy est un confort, pas un passage obligé.

## Installation

Tout est scriptable. Depuis la racine du dépôt, dans un PowerShell **administrateur** :

```powershell
.\scripts\install.ps1 -WithHosts -WithTls
```

Le script installe Docker Desktop s'il manque, crée le `.env`, télécharge les images,
démarre les services, ajoute les domaines `.test` au fichier hosts, génère les
certificats HTTPS, puis vérifie les 28 points de contrôle.

Sans droits administrateur, la version réduite fonctionne aussi :

```powershell
.\scripts\install.ps1
```

Les deux options qui touchent la machine sont alors ignorées et signalées en fin
d'exécution. Le script est idempotent : le relancer ne casse rien et ne duplique rien.

### Les scripts

| Script | Rôle | Admin |
| --- | --- | --- |
| `install.ps1` | Orchestrateur complet | selon les options |
| `install-docker.ps1` | Installe Docker Desktop et attend le moteur | oui si absent |
| `setup-hosts.ps1` | Écrit les entrées `.test` dans le fichier hosts | oui |
| `setup-tls.ps1` | Installe mkcert et génère les certificats | oui |
| `verify.ps1` | Contrôle santé et routage de toute la stack | non |
| `lib.ps1` | Fonctions partagées, non exécutable seul | - |

Options de `install.ps1` : `-SkipDocker` saute la vérification Docker, `-WithHosts`
ajoute les domaines `.test`, `-WithTls` génère les certificats, `-NoVerify` saute
le contrôle final.

Pour retirer les entrées du fichier hosts : `.\scripts\setup-hosts.ps1 -Remove`.

### Installation manuelle

```powershell
Copy-Item .env.example .env   # puis ajuster les mots de passe
docker compose up -d
docker compose ps
```

## Prérequis

Docker Desktop. Validé avec Docker 29.7.2 et Compose v5.5.1.
Le premier démarrage télécharge environ 2 Go d'images. Neo4j met 20 à 30 secondes
à devenir sain, les autres services sont prêts en quelques secondes.

## Noms de domaine en .test

Windows ne résout ni `.test` ni `.localhost` au niveau DNS. Les navigateurs mappent
`*.localhost` sur 127.0.0.1 tout seuls, mais aucun ne le fait pour `.test`.
Pour activer les URL `.test` partout, y compris depuis `curl` et le code applicatif,
dans un **PowerShell administrateur** :

```powershell
.\scripts\setup-hosts.ps1
```

Équivalent manuel :

```powershell
$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$names = "traefik","minio","mail","redis","qdrant","meilisearch","neo4j","phpmyadmin"
Add-Content $hostsFile ($names | ForEach-Object { "127.0.0.1 $($_).test" })
```

Le fichier hosts de Windows ne gère pas les jokers : une ligne par nom, et une ligne
de plus à chaque nouveau service.

Chaque service répond sur deux domaines équivalents, par exemple `minio.test` et
`minio.localhost`. Le second marche dans le navigateur sans toucher au fichier hosts.

## HTTPS

Traefik écoute sur le port 443 et sert **tous** les services en HTTPS. Le port 80
reste actif en parallèle : aucune redirection forcée, les deux protocoles fonctionnent.

Par défaut Traefik présente un certificat auto-signé qu'il génère lui-même. Ça marche,
mais le navigateur affiche un avertissement à chaque domaine.

Pour des certificats reconnus par le navigateur, utiliser mkcert, qui installe une
autorité de certification locale dans le magasin Windows :

```powershell
.\scripts\setup-tls.ps1
```

Le script demande confirmation avant de toucher au magasin de certificats. Équivalent manuel :

```powershell
winget install FiloSottile.mkcert
mkcert -install
cd config\traefik\certs
mkcert -cert-file local.pem -key-file local-key.pem "*.test" "*.localhost" localhost 127.0.0.1 ::1
cd ..\..\..
Copy-Item config\traefik\dynamic\tls.yml.example config\traefik\dynamic\tls.yml
docker compose restart traefik
```

À savoir avant de lancer `mkcert -install` : la commande ajoute une autorité racine
au magasin de certificats de la machine. C'est le prix à payer pour du HTTPS local
sans avertissement, et ça reste réversible avec `mkcert -uninstall`.

Let's Encrypt n'est pas une option ici : les domaines `.test` ne sont pas résolvables
publiquement, donc aucune validation ACME ne peut aboutir.

Pour forcer la redirection HTTP vers HTTPS, ajouter au bloc `command` de traefik :

```yaml
- --entrypoints.web.http.redirections.entrypoint.to=websecure
- --entrypoints.web.http.redirections.entrypoint.scheme=https
```

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

Dans RedisInsight, ajouter la base avec l'hôte `redis` et le port `6379` : la connexion
part de l'intérieur du réseau Docker, pas de `localhost`.

## Où vivent les données

Les données des bases sont dans des **volumes Docker nommés**, pas dans `./data`.
Ce choix est imposé par Windows : Postgres refuse de démarrer sur un montage de disque
Windows car il exige des permissions `0700` sur son répertoire, impossible à obtenir là.
MariaDB et Neo4j ont le même genre de contrainte.

Le dossier `./data` sert de zone d'échange avec l'hôte :

| Dossier hôte | Monté dans | Usage |
| --- | --- | --- |
| `data/postgres` | postgres:/backups | dumps SQL |
| `data/mariadb` | mariadb:/backups | dumps SQL |
| `data/qdrant` | qdrant:/qdrant/snapshots | snapshots |
| `data/meilisearch` | meilisearch:/dumps | dumps |
| `data/neo4j` | neo4j:/import | fichiers à importer |

Le dossier `./config` contient la configuration montée en lecture seule : script
d'initialisation Postgres, fichier de réglages MariaDB, configuration dynamique Traefik.

Le script `config/postgres/init/01-extensions.sql` active `vector`, `pg_trgm` et
`uuid-ossp`. Il ne s'exécute qu'au tout premier démarrage, quand le volume est vide.
Le modifier plus tard n'a aucun effet sans `docker compose down -v`, qui détruit les données.

## Commandes utiles

```powershell
docker compose up -d                 # démarrer
docker compose stop                  # arrêter sans rien perdre
docker compose down                  # supprimer les conteneurs, garder les volumes
docker compose logs -f neo4j         # suivre les logs d'un service
docker compose restart traefik       # recharger le proxy
docker compose ps                    # état et santé
docker stats --no-stream             # consommation mémoire
```

Accès aux consoles :

```powershell
docker compose exec postgres psql -U dev -d devdb
docker compose exec mariadb mariadb -udev -pdevpass devdb
docker compose exec redis redis-cli -a devpass
docker compose exec neo4j cypher-shell -u neo4j -p devpassword
```

## Sauvegarde et restauration

Les dumps s'écrivent dans le conteneur vers `/backups`, qui correspond à `./data/<service>`
sur l'hôte. Ça évite les problèmes d'encodage des redirections PowerShell.

```powershell
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

## Dépannage

**Le port 80 est déjà pris.** Changer `TRAEFIK_HTTP_PORT` dans `.env`, les URL deviennent
`http://minio.test:8000`. Sous Windows, le coupable habituel est IIS ou un service http.sys.

**Une URL `.test` renvoie 404 juste après le démarrage.** Le service répond mais n'est pas
encore prêt. Neo4j est le plus lent. Vérifier avec `docker compose ps` que la santé est verte.

**`.test` ne résout pas.** Les entrées du fichier hosts sont manquantes, voir plus haut.
En attendant, utiliser l'équivalent en `.localhost` dans le navigateur.

**Le navigateur refuse le certificat.** Normal tant que mkcert n'est pas installé :
le certificat auto-signé de Traefik n'est reconnu par personne.

**Traefik affiche un avertissement `aliasHeadersStrategy` au démarrage.** Recommandation
de durcissement de Traefik v3.7 concernant l'usurpation d'en-têtes vers les backends PHP.
Sans conséquence sur une stack locale.
