FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY public ./public
COPY server.js ./
ENV NODE_ENV=production
ENV PORT=4173
ENV LOCAL_MODEL=off
EXPOSE 4173
CMD ["node", "server.js"]
