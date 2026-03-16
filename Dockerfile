# Use a Puppeteer-optimized Node image
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install dependencies or handle permissions
USER root

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Ensure history.json exists so the volume mount doesn't create a directory
RUN touch agent/rules/history.json && chmod 666 agent/rules/history.json

# Environment variables will be injected at runtime
# CMD specifies how to run the bot
CMD ["node", "scripts/monitor.js"]
