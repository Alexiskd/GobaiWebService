# Étape 1 : build du frontend React/Vite.
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Étape 2 : build du serveur Rust.
FROM rust:1-bookworm AS build
WORKDIR /app/server
COPY server/ ./
RUN cargo build --release

# Étape 3 : image d'exécution minimale.
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /app/server/target/release/gobai-server /usr/local/bin/gobai-server
COPY --from=frontend /app/frontend/dist /app/static
ENV GOBAI_STATIC_DIR=/app/static \
    PORT=10000
EXPOSE 10000
CMD ["gobai-server"]
