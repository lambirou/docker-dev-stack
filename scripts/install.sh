#!/usr/bin/env bash
# Installe et démarre la stack de développement complète sur macOS, Linux ou WSL.
# Équivalent POSIX de scripts/install.ps1.
#
#   ./scripts/install.sh                       installation standard
#   ./scripts/install.sh --with-hosts --with-tls   + domaines .test et certificats
#
# Les étapes qui touchent la machine (fichier hosts, autorité de certification)
# sont optionnelles et demandent sudo.
set -euo pipefail
. "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"

SKIP_DOCKER=0
WITH_HOSTS=0
WITH_TLS=0
NO_VERIFY=0
ASSUME_OUI=0

usage() {
  cat <<'AIDE'
Usage: ./scripts/install.sh [options]

  --skip-docker   ne pas vérifier ni installer Docker
  --with-hosts    ajouter les domaines .test dans /etc/hosts (sudo)
  --with-tls      générer les certificats HTTPS avec mkcert (sudo)
  --no-verify     sauter le contrôle final
  -y, --yes       répondre oui à toutes les confirmations
  -h, --help      afficher cette aide
AIDE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-docker) SKIP_DOCKER=1 ;;
    --with-hosts)  WITH_HOSTS=1 ;;
    --with-tls)    WITH_TLS=1 ;;
    --no-verify)   NO_VERIFY=1 ;;
    -y|--yes)      ASSUME_OUI=1 ;;
    -h|--help)     usage; exit 0 ;;
    *) erreur "option inconnue : $1"; usage; exit 2 ;;
  esac
  shift
done
export ASSUME_OUI

SCRIPTS="$RACINE_DEPOT/scripts"
DEBUT=$(date +%s)

printf '\n  Dev Stack - installation (%s)\n' "$(systeme)"
printf '  %s\n' "$RACINE_DEPOT"

if [ "$SKIP_DOCKER" -eq 0 ]; then
  bash "$SCRIPTS/install-docker.sh"
else
  etape 'Docker'
  note 'étape ignorée (--skip-docker)'
fi

etape 'Configuration'

ENV_FICHIER="$RACINE_DEPOT/.env"
if [ -f "$ENV_FICHIER" ]; then
  ok '.env déjà présent, conservé tel quel'
else
  cp "$RACINE_DEPOT/.env.example" "$ENV_FICHIER"
  ok '.env créé depuis .env.example'
  note 'pense à remplacer les mots de passe par défaut'
fi

# Colima, Rancher Desktop ou Podman n'exposent pas /var/run/docker.sock :
# Traefik et Dockhand ont besoin du vrai chemin pour parler au moteur.
SOCKET=$(socket_docker)
if [ "$SOCKET" != '/var/run/docker.sock' ]; then
  definir_dotenv_si_vide "$ENV_FICHIER" DOCKER_SOCKET "$SOCKET" \
    'Socket du moteur Docker, détecté à l installation (Colima, Rancher, Podman).'
  note "socket Docker non standard détecté : $SOCKET"
fi

for dossier in postgres mariadb qdrant meilisearch neo4j redis traefik-manager; do
  mkdir -p "$RACINE_DEPOT/data/$dossier"
done
case "$(systeme)" in
  linux|wsl)
    # Les conteneurs écrivent leurs dumps dans /backups sous leur propre uid
    # (999 pour postgres, 7474 pour neo4j...) : sans écriture pour tous, le
    # montage hôte leur est interdit. Poste de développement, pas de production.
    chmod 0777 "$RACINE_DEPOT/data"/* 2>/dev/null || true
    ;;
esac
ok "dossiers d'échange vérifiés"

etape 'Validation du docker-compose.yml'
if ! compose config --quiet; then
  erreur 'le fichier docker-compose.yml est invalide'
  exit 1
fi
ok 'syntaxe valide'

etape 'Téléchargement des images'
note 'environ 2 Go au premier passage'
if ! compose pull --quiet; then
  erreur 'le téléchargement des images a échoué'
  exit 1
fi
ok 'images à jour'

etape 'Démarrage'
if compose up -d --wait --wait-timeout 180; then
  ok 'tous les services sont démarrés'
else
  note 'certains services ne sont pas encore sains, vérification détaillée ci-dessous'
fi

[ "$WITH_HOSTS" -eq 1 ] && bash "$SCRIPTS/setup-hosts.sh"
[ "$WITH_TLS" -eq 1 ] && bash "$SCRIPTS/setup-tls.sh" --accept-root-ca

if [ "$NO_VERIFY" -eq 0 ]; then
  bash "$SCRIPTS/verify.sh" || true
fi

etape 'Terminé'
ok "installation effectuée en $(( $(date +%s) - DEBUT )) secondes"
cat <<'CONSOLES'

  Consoles web :
    phpMyAdmin     http://localhost:8306
    MinIO          http://localhost:9001
    Mailpit        http://localhost:8025
    RedisInsight   http://localhost:5540
    Qdrant         http://localhost:6333/dashboard
    Neo4j          http://localhost:7474
    Traefik        http://localhost:8090
CONSOLES
printf '\n'
[ "$WITH_HOSTS" -eq 0 ] && note 'pour les URL en .test : ./scripts/setup-hosts.sh'
[ "$WITH_TLS" -eq 0 ] && note 'pour du HTTPS sans avertissement : ./scripts/setup-tls.sh'
exit 0
