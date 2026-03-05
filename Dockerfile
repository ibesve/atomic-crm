# =============================================================================
# AtomicCRM – Multi-Stage Docker Build
# Stage 1: Build the Vite SPA
# Stage 2: Serve with nginx:alpine
# =============================================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts && rm -f .npmrc

# Copy source
COPY . .

# Build-time environment variables (baked into the SPA bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SB_PUBLISHABLE_KEY
ARG VITE_INBOUND_EMAIL=""
ARG VITE_IS_DEMO="false"

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SB_PUBLISHABLE_KEY=${VITE_SB_PUBLISHABLE_KEY}
ENV VITE_INBOUND_EMAIL=${VITE_INBOUND_EMAIL}
ENV VITE_IS_DEMO=${VITE_IS_DEMO}

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine

# Remove default site
RUN rm /etc/nginx/conf.d/default.conf

# SPA-aware nginx config: all routes → index.html
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_vary on;
    gzip_min_length 256;

    # Cache static assets
    location ~* \.(?:css|js|gif|jpe?g|png|ico|svg|woff2?|ttf|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri =404;
    }

    # Service Worker – no cache
    location = /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        try_files $uri =404;
    }

    # PWA manifest
    location = /manifest.json {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    # Auth callback (static HTML)
    location = /auth-callback.html {
        try_files $uri =404;
    }

    # SPA fallback: any non-file route → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
