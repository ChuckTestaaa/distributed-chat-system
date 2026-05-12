FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install
COPY package*.json ./
RUN npm install

# Copy source code
COPY src ./src
COPY package*.json ./

# No frontend build needed (hosted on Vercel)

EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
