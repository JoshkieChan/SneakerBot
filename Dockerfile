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

# Ensure data and logs directories exist with correct permissions
RUN mkdir -p data logs && \
    touch data/trades.json && chmod 666 data/trades.json && \
    chmod -R 777 data logs

# Environment variables will be injected at runtime
# CMD specifies the new modular entry point
CMD ["node", "index.js"]
