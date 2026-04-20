FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
ARG VITE_API_BASE_URL
ARG VITE_AUTH_PORTAL_URL
ARG VITE_PORTAL_DASHBOARD_URL
ARG VITE_PORTAL_KEAMANAN_URL
ARG VITE_PORTAL_K3_URL
ARG VITE_PORTAL_K2S_URL
ARG VITE_SSO_ENABLED
ARG VITE_SSO_AUTH_BASE_URL
ARG VITE_SSO_AUTHORIZE_URL
ARG VITE_SSO_TOKEN_URL
ARG VITE_SSO_LOGOUT_URL
ARG VITE_SSO_CLIENT_ID
ARG VITE_SSO_REDIRECT_URI
ARG VITE_SSO_SCOPE
COPY backend ./backend
COPY frontend ./frontend
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-deps /app/frontend/node_modules ./frontend/node_modules
RUN printf '%s\n' \
  "VITE_API_BASE_URL=${VITE_API_BASE_URL}" \
  "VITE_AUTH_PORTAL_URL=${VITE_AUTH_PORTAL_URL}" \
  "VITE_PORTAL_DASHBOARD_URL=${VITE_PORTAL_DASHBOARD_URL}" \
  "VITE_PORTAL_KEAMANAN_URL=${VITE_PORTAL_KEAMANAN_URL}" \
  "VITE_PORTAL_K3_URL=${VITE_PORTAL_K3_URL}" \
  "VITE_PORTAL_K2S_URL=${VITE_PORTAL_K2S_URL}" \
  "VITE_SSO_ENABLED=${VITE_SSO_ENABLED}" \
  "VITE_SSO_AUTH_BASE_URL=${VITE_SSO_AUTH_BASE_URL}" \
  "VITE_SSO_AUTHORIZE_URL=${VITE_SSO_AUTHORIZE_URL}" \
  "VITE_SSO_TOKEN_URL=${VITE_SSO_TOKEN_URL}" \
  "VITE_SSO_LOGOUT_URL=${VITE_SSO_LOGOUT_URL}" \
  "VITE_SSO_CLIENT_ID=${VITE_SSO_CLIENT_ID}" \
  "VITE_SSO_REDIRECT_URI=${VITE_SSO_REDIRECT_URI}" \
  "VITE_SSO_SCOPE=${VITE_SSO_SCOPE}" \
  > /app/frontend/.env.production
WORKDIR /app/frontend
RUN npm run build
WORKDIR /app/backend
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/frontend/dist ../frontend/dist
RUN mkdir -p ./uploads
EXPOSE 3107
CMD ["sh", "-lc", "npx prisma db push && node dist/main.js"]
