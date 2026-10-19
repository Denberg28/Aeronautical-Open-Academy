FROM node:24.19.0-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 ACADEMY_DATA_DIR=/data
EXPOSE 8787
CMD ["node", "src/main.mjs"]
