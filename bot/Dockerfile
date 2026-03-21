FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure browsers are installed
RUN npx playwright install chromium

CMD ["node", "index.js"]
