# Build stage
FROM node:20 AS build
WORKDIR /app
COPY frontend-angular/package*.json ./
RUN npm config set registry https://registry.npmjs.org \
 && if [ -f package-lock.json ]; then npm ci; else npm install --legacy-peer-deps; fi
COPY frontend-angular/ ./
RUN npm run build -- --configuration production

# Serve stage
FROM nginx:1.27-alpine
COPY frontend-angular/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html
EXPOSE 80
