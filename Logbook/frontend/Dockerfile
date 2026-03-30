FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_LOGBOOK_API_BASE_URL
ARG VITE_AUTH_PORTAL_URL
ENV VITE_LOGBOOK_API_BASE_URL=${VITE_LOGBOOK_API_BASE_URL}
ENV VITE_AUTH_PORTAL_URL=${VITE_AUTH_PORTAL_URL}
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.logbook.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
