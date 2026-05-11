FROM docker.io/library/node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm install est plus tolerant que npm ci (qui exige package-lock.json strict)
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
# Angular 17+ output : dist/<projectName>/browser/
# angular.json -> outputPath = dist/ng-tailadmin
RUN npm run build -- --configuration=production

FROM docker.io/library/nginx:alpine
# Copie le contenu Angular (browser/ pour Angular 17+)
COPY --from=build /app/dist/ng-tailadmin/browser /usr/share/nginx/html
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
