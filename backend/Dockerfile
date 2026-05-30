FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM node:22-alpine AS backend-deps

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate --schema ./prisma/schema.prisma


FROM node:22-alpine AS backend-build

WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ .

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4100

COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-build /app/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 4100

CMD ["sh", "-c", "npx prisma db push --schema ./prisma/schema.prisma --accept-data-loss && node dist/server.js"]
