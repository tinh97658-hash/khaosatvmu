# Stage 1: Build production static files
FROM node:22-alpine AS builder
WORKDIR /app

COPY src/Frontend/package*.json ./
RUN npm ci

COPY src/Frontend/ ./
ARG VITE_SUPPORT_EMAIL=kdcldhhh@vimaru.edu.vn
ENV VITE_SUPPORT_EMAIL=${VITE_SUPPORT_EMAIL}
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

# Xóa file mặc định của Nginx
RUN rm -rf ./*

# Copy bản build SPA và file cấu hình Nginx
COPY --from=builder /app/dist .
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
