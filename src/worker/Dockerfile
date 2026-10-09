# Build em DOIS estágios: o TypeScript precisa de devDependencies (typescript, @types/*),
# mas a imagem final só precisa do JavaScript compilado e das dependências de produção.

# Estágio 1: compilar TypeScript → dist/
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Estágio 2: imagem final. Sem TypeScript, sem código-fonte .ts.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

USER node

# O worker não expõe portas: não atende pedidos HTTP, só consome mensagens.
CMD ["node", "dist/src/index.js"]
