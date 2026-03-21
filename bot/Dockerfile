FROM ghcr.io/puppeteer/puppeteer:latest
USER root
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p data logs && chmod 777 data logs
CMD ["node", "index.js"]
