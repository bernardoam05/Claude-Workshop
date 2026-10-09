# Build em DOIS estágios (multi-stage build).

# Estágio 1: compilar. Precisa de Node e das devDependencies (vite, plugin-react).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Estágio 2: imagem final. Só Nginx + ficheiros estáticos gerados.
# O Node e o node_modules NÃO vão para a imagem final: é mais pequena e tem menos coisas para atacar.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
