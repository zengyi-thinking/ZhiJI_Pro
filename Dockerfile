FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

RUN mkdir -p /data

ENV PORT=3000
ENV CREATION_AI_BASE_URL=https://example.com/v1
ENV CREATION_AI_API_KEY=replace-me
ENV MEMORY_STORAGE_PATH=/data/memories.json
ENV MODEL_BABY_ORCHESTRATOR=gpt-5-chat-latest
ENV MODEL_EMOTION_AGENT=gpt-5-mini
ENV MODEL_IMAGE_PERCEPTION=gpt-4o
ENV MODEL_AUDIO_TRANSCRIBE=gpt-4o-transcribe
ENV MODEL_AUDIO_TTS=gpt-4o-mini-tts
ENV MODEL_EMBEDDING=text-embedding-3-small
ENV MODEL_MODERATION=text-moderation-latest
ENV MODEL_IMAGE_GENERATION=gpt-image-1-mini

EXPOSE 3000

CMD ["npm", "start"]
