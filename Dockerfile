FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci --include=dev --production=false
RUN npm install --no-save typescript
COPY . .
RUN node --eval "require('node:fs').rmSync('dist',{recursive:true,force:true})"
RUN ./node_modules/.bin/tsc -p tsconfig.json

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN mkdir -p /data
EXPOSE 8080
CMD ["npm", "start"]
