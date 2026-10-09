# Imagem base oficial do Node, versão Alpine (Linux mínimo: imagem pequena, menos superfície de ataque).
FROM node:22-alpine

WORKDIR /app

# Copiamos primeiro SÓ os manifestos. Se as dependências não mudarem, esta camada vem da cache
# e o "npm ci" não volta a correr. Ordem das linhas = eficiência da cache.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# O código muda com frequência, por isso fica numa camada posterior.
COPY src ./src

# Princípio do menor privilégio: o processo não corre como root.
USER node

EXPOSE 3000
CMD ["node", "src/index.js"]
