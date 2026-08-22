FROM node:22-alpine AS builder
WORKDIR /app

COPY src/Frontend/package*.json ./
RUN npm ci

COPY src/Frontend/ ./
ARG VITE_SUPPORT_EMAIL=kdcldhhh@vimaru.edu.vn
ENV VITE_SUPPORT_EMAIL=${VITE_SUPPORT_EMAIL}
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=builder /app/dist .
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
