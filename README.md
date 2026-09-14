# Dev Stack Docker

Environnement de developpement local : bases relationnelles, moteurs vectoriels, recherche,
graphe, cache, stockage objet et outillage, le tout derriere un reverse proxy Traefik.

## Services

| Service | Image | Role | URL | Port direct |
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

Chaque service reste joignable en direct sur son port : le proxy est un confort, pas un passage oblige.

## Prerequis

Docker Desktop. Valide avec Docker 29.7.2 et Compose v5.5.1.

## Demarrage

```powershell
Copy-Item .env.example .env   # puis ajuster les mots de passe
docker compose up -d
docker compose ps
```

Le premier demarrage telecharge environ 2 Go d'images. Neo4j met 20 a 30 secondes
a devenir sain, les autres services sont prets en quelques secondes.

## Noms de domaine en .test

Windows ne resout ni `.test` ni `.localhost` au niveau DNS. Les navigateurs mappent
`*.localhost` sur 127.0.0.1 tout seuls, mais aucun ne le fait pour `.test`.
Pour activer les URL `.test` partout, y compris depuis `curl` et le code applicatif,
dans un **PowerShell administrateur** :

```powershell
$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$names = "traefik","minio","mail","redis","qdrant","meilisearch","neo4j","phpmyadmin"
Add-Content $hostsFile ($names | ForEach-Object { "127.0.0.1 $($_).test" })
```

Le fichier hosts de Windows ne gere pas les jokers : une ligne par nom, et une ligne
de plus a chaque nouveau service.

Chaque service repond sur deux domaines equivalents, par exemple `minio.test` et
`minio.localhost`. Le second marche dans le navigateur sans toucher au fichier hosts.

## HTTPS

Traefik ecoute sur le port 443 et sert **tous** les services en HTTPS. Le port 80
reste actif en parallele : aucune redirection forcee, les deux protocoles fonctionnent.

Par defaut Traefik presente un certificat auto-signe qu'il genere lui-meme. Ca marche,
mais le navigateur affiche un avertissement a chaque domaine.

Pour des certificats reconnus par le navigateur, utiliser mkcert, qui installe une
autorite de certification locale dans le magasin Windows :

```powershell
winget install FiloSottile.mkcert
mkcert -install
cd config\traefik\certs
mkcert -cert-file local.pem -key-file local-key.pem "*.test" "*.localhost" localhost 127.0.0.1 ::1
cd ..\..\..
Copy-Item config\traefik\dynamic\tls.yml.example config\traefik\dynamic\tls.yml
docker compose restart traefik
```

A savoir avant de lancer `mkcert -install` : la commande ajoute une autorite racine
au magasin de certificats de la machine. C'est le prix a payer pour du HTTPS local
sans avertissement, et ca reste reversible avec `mkcert -uninstall`.

Let's Encrypt n'est pas une option ici : les domaines `.test` ne sont pas resolvables
publiquement, donc aucune validation ACME ne peut aboutir.

Pour forcer la redirection HTTP vers HTTPS, ajouter au bloc `command` de traefik :

```yaml
- --entrypoints.web.http.redirections.entrypoint.to=websecure
- --entrypoints.web.http.redirections.entrypoint.scheme=https
```

## Identifiants

Tous definis dans `.env`, valeurs de developpement uniquement.

| Service | Utilisateur | Mot de passe |
| --- | --- | --- |
| Postgres | `dev` | `devpass` (base `devdb`) |
| MariaDB | `dev` / root | `devpass` / `rootpass` |
| Neo4j | `neo4j` | `devpassword` |
| Redis | - | `devpass` |
| MinIO | `devadmin` | `devadminpass` |
| Qdrant | cle API | `devkey` (en-tete `api-key`) |
| Meilisearch | cle maitre | `devmasterkey_min16chars` |

Dans RedisInsight, ajouter la base avec l'hote `redis` et le port `6379` : la connexion
part de l'interieur du reseau Docker, pas de `localhost`.

## Ou vivent les donnees

Les donnees des bases sont dans des **volumes Docker nommes**, pas dans `./data`.
Ce choix est impose par Windows : Postgres refuse de demarrer sur un montage de disque
Windows car il exige des permissions `0700` sur son repertoire, impossible a obtenir la.
MariaDB et Neo4j ont le meme genre de contrainte.

Le dossier `./data` sert de zone d'echange avec l'hote :

| Dossier hote | Monte dans | Usage |
| --- | --- | --- |
| `data/postgres` | postgres:/backups | dumps SQL |
| `data/mariadb` | mariadb:/backups | dumps SQL |
| `data/qdrant` | qdrant:/qdrant/snapshots | snapshots |
| `data/meilisearch` | meilisearch:/dumps | dumps |
| `data/neo4j` | neo4j:/import | fichiers a importer |

Le dossier `./config` contient la configuration montee en lecture seule : script
d'initialisation Postgres, fichier de reglages MariaDB, configuration dynamique Traefik.

Le script `config/postgres/init/01-extensions.sql` active `vector`, `pg_trgm` et
`uuid-ossp`. Il ne s'execute qu'au tout premier demarrage, quand le volume est vide.
Le modifier plus tard n'a aucun effet sans `docker compose down -v`, qui detruit les donnees.

## Commandes utiles

```powershell
docker compose up -d                 # demarrer
docker compose stop                  # arreter sans rien perdre
docker compose down                  # supprimer les conteneurs, garder les volumes
docker compose logs -f neo4j         # suivre les logs d'un service
docker compose restart traefik       # recharger le proxy
docker compose ps                    # etat et sante
docker stats --no-stream             # consommation memoire
```

Acces aux consoles :

```powershell
docker compose exec postgres psql -U dev -d devdb
docker compose exec mariadb mariadb -udev -pdevpass devdb
docker compose exec redis redis-cli -a devpass
docker compose exec neo4j cypher-shell -u neo4j -p devpassword
```

## Sauvegarde et restauration

Les dumps s'ecrivent dans le conteneur vers `/backups`, qui correspond a `./data/<service>`
sur l'hote. Ca evite les problemes d'encodage des redirections PowerShell.

```powershell
docker compose exec postgres sh -c 'pg_dump -U dev devdb > /backups/devdb.sql'
docker compose exec postgres sh -c 'psql -U dev devdb < /backups/devdb.sql'

docker compose exec mariadb sh -c 'mariadb-dump -udev -pdevpass devdb > /backups/devdb.sql'
docker compose exec mariadb sh -c 'mariadb -udev -pdevpass devdb < /backups/devdb.sql'
```

## Notes sur les versions

Les images sont epinglees volontairement. MariaDB 12.3 et Neo4j 5.26 sont les versions
LTS de leurs branches respectives.

**MinIO merite une mise en garde.** Le depot `minio/minio` a ete supprime de Docker Hub,
et l'image la plus recente disponible sur Quay.io date du 7 septembre 2025. La console
web de l'edition communautaire a par ailleurs ete amputee en mai 2025 : il ne reste que
la creation et la navigation dans les buckets, toute l'administration passe par le client
`mc`. En pratique, ce conteneur tourne sans correctif depuis plus d'un an. Acceptable
pour du developpement local non expose ; a remplacer par Garage, SeaweedFS ou RustFS
si ce point devient genant.

## Depannage

**Le port 80 est deja pris.** Changer `TRAEFIK_HTTP_PORT` dans `.env`, les URL deviennent
`http://minio.test:8000`. Sous Windows, le coupable habituel est IIS ou un service http.sys.

**Une URL `.test` renvoie 404 juste apres le demarrage.** Le service repond mais n'est pas
encore pret. Neo4j est le plus lent. Verifier avec `docker compose ps` que la sante est verte.

**`.test` ne resout pas.** Les entrees du fichier hosts sont manquantes, voir plus haut.
En attendant, utiliser l'equivalent en `.localhost` dans le navigateur.

**Le navigateur refuse le certificat.** Normal tant que mkcert n'est pas installe :
le certificat auto-signe de Traefik n'est reconnu par personne.

**Traefik affiche un avertissement `aliasHeadersStrategy` au demarrage.** Recommandation
de durcissement de Traefik v3.7 concernant l'usurpation d'en-tetes vers les backends PHP.
Sans consequence sur une stack locale.
