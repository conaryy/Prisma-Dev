FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY data ./data
COPY sql ./sql
COPY src ./src

EXPOSE 4000

CMD ["node", "src/server.js"]
