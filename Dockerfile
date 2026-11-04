FROM node:22-slim
WORKDIR /app

# Install first so dependency layers cache between code-only deploys.
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

# Migrations and the idempotent question seed run on every boot, so a deploy that
# adds a migration or new questions needs no extra step.
CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/db/seed/seed.js && node server/dist/index.js"]
