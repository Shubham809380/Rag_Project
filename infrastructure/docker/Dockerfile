# Sovereign Workbench — air-gapped deployment image.
# Deliberately tiny: Node runtime only. The model gateway (Ollama) runs as a
# sibling container on the compose network; the app NEVER receives an external
# API key here. Egress is disabled by SOVEREIGN_EGRESS=deny at runtime.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV SOVEREIGN_EGRESS=deny
WORKDIR /app
RUN groupadd -r workbench && useradd -r -g workbench workbench
COPY --from=build /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/sovereign && chown -R workbench:workbench /app/sovereign
# pdf.js + @napi-rs/canvas need native binaries for the target platform.
RUN npm rebuild @napi-rs/canvas pdfjs-dist --platform=linux --arch=x64 || true
USER workbench
EXPOSE 4877
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4877/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]