# syntax=docker/dockerfile:1

# Contrairement au portail, l'image finale n'est pas un nginx : Studio a besoin d'un
# backend qui parle aux bases, donc le même processus Node sert le bundle et le BFF.
#
# SQLite passe par le module node:sqlite de Node lui-même : pas de better-sqlite3,
# donc pas de compilation native à prévoir dans l'image alpine.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Seules les dépendances de production : ni Vite ni esbuild n'ont de raison d'être
# dans l'image finale, le bundle est déjà construit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

# Les connexions ajoutées depuis l'interface sont écrites ici, sur un volume. Le
# dossier est créé et donné à l'utilisateur node dès la construction : monté vide, un
# volume hérite des droits du point de montage, et un conteneur non-root ne pourrait
# plus rien y écrire.
RUN mkdir -p /data && chown node:node /data

# Le processus tourne sous l'utilisateur node, présent dans l'image officielle : un
# serveur exposé n'a pas besoin de root, et cette console parle aux bases.
USER node

VOLUME ["/data"]

EXPOSE 5555

# Docker n'a alors plus à deviner l'état du service : la sonde interroge Postgres,
# donc un conteneur sain garantit que la console est réellement utilisable.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5555/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
