# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Exécuté par l'entrypoint nginx à chaque démarrage, avant le lancement du serveur.
COPY docker-entrypoint.d/40-portal-config.sh /docker-entrypoint.d/40-portal-config.sh
RUN chmod +x /docker-entrypoint.d/40-portal-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
