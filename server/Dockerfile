FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
COPY shared/ ./shared/
RUN npm install --workspace=server --workspace=shared --ignore-scripts
COPY server/ ./server/
RUN npm run build --workspace=server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/shared/ ./shared/
COPY package.json ./
RUN npm install --workspace=server --omit=dev --ignore-scripts
EXPOSE 3001
CMD ["node", "server/dist/server/src/index.js"]
