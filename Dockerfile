FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY index.ts ./
COPY tools ./tools
COPY guards ./guards
COPY prompts ./prompts
COPY transport ./transport
COPY scripts ./scripts
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY content ./content
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js", "--port", "3000"]
