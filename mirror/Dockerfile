# ─────────────────────────────────────────────────────────────
# V FOR X — censorship-resistant mirror image
# Multi-stage: builds the static export, serves it with nginx.
# Optionally pins to a bundled kubo (IPFS) sidecar via compose.
#
#   docker build -t vfx-mirror .
#   docker run -d -p 8080:80 --name vfx vfx-mirror
#
# Build a specific ref:
#   docker build --build-arg VFX_REF=v1.2.0 -t vfx-mirror:v1.2.0 .
# ─────────────────────────────────────────────────────────────

# ── stage 1: build the static export ─────────────────────────
FROM node:22-alpine AS builder
ARG VFX_REPO=https://github.com/mouracleiton/v_for_vigilance.git
ARG VFX_REF=main
RUN apk add --no-cache git
WORKDIR /build
RUN git clone --depth 1 --branch "${VFX_REF}" "${VFX_REPO}" repo \
    && cd "$(find repo -maxdepth 2 -name package.json -printf '%h\n' | head -n1)" \
    && cp -R . /build/src
WORKDIR /build/src
RUN npm ci --no-audit --no-fund \
    && npm run build

# ── stage 2: serve with hardened nginx ───────────────────────
FROM nginx:alpine AS runtime
LABEL org.opencontainers.image.title="V FOR X — mirror node" \
      org.opencontainers.image.description="Censorship-resistant static mirror of V FOR X" \
      org.opencontainers.image.source="https://github.com/mouracleiton/v_for_vigilance"
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /build/src/out/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
