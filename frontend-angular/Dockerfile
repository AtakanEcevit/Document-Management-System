# ---------- Build stage ----------
    FROM node:20 AS build
    WORKDIR /app
    
    # Copy manifests first
    COPY frontend-angular/package.json frontend-angular/package-lock.json* ./
    RUN if [ -f package-lock.json ]; then npm ci; else npm install --legacy-peer-deps; fi
    
    # Copy the source and build to a flat path
    COPY frontend-angular/ ./
    # 👇 force output to dist/app and add a debug ls so you can see what's there in build logs
    RUN npm run build -- --configuration production --output-path=dist/app \
     && ls -lahR dist || true
    
    # ---------- Serve stage ----------
    FROM nginx:1.27-alpine
    COPY frontend-angular/nginx.conf /etc/nginx/conf.d/default.conf
    RUN rm -rf /usr/share/nginx/html/*
    COPY --from=build /app/dist/app/ /usr/share/nginx/html
    EXPOSE 80
    