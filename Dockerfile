# syntax=docker/dockerfile:1.7
FROM node:20.20-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.28.1 typescript@5.9.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY types ./types
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --no-frozen-lockfile && pnpm db:generate && pnpm build

FROM node:20.20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini && chown node:node /app
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps ./apps
USER node
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","apps/api/dist/main.js"]
