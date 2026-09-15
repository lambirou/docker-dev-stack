#!/bin/sh
# Écrit /config.json au démarrage du conteneur, à partir des variables que docker
# compose transmet depuis le fichier .env. Le portail lit ce fichier à l'exécution :
# aucun identifiant n'entre dans le bundle Vite, et changer .env ne demande qu'un
# « docker compose up -d portal » pour que les cartes affichent les bonnes valeurs.
#
# Seules les variables des services de la stack sont exportées, jamais l'environnement
# complet du conteneur. Le même filtre est appliqué par le serveur de développement
# dans portal/vite.config.js.
set -eu

CIBLE=${PORTAL_CONFIG_PATH:-/usr/share/nginx/html/config.json}
FILTRE='^(POSTGRES|MARIADB|QDRANT|MEILI|NEO4J|REDIS|MINIO)_[A-Z0-9_]*='

echappe() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

{
  printf '{'
  printenv | grep -E "$FILTRE" | sort | (
    premier=1
    while IFS= read -r ligne; do
      nom=${ligne%%=*}
      valeur=${ligne#*=}
      [ -n "$valeur" ] || continue
      [ "$premier" = 1 ] || printf ','
      premier=0
      printf '"%s":"%s"' "$nom" "$(echappe "$valeur")"
    done
  )
  printf '}\n'
} > "$CIBLE"

echo "portal: config.json généré depuis l'environnement ($CIBLE)"
