# Build stage
FROM node:16.17.1-buster-slim AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app's source code
COPY . .

# Build your TypeScript project
RUN npm run build

# Production stage
FROM node:16.17.1-buster-slim AS production

# Install pdftk in the production image
RUN apt-get update && apt-get install -y pdftk && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the compiled code from the build stage
COPY --from=builder /usr/src/app/dist ./dist

# Make your app's port available to the world outside this container
EXPOSE 3000

# Run the app using npm start
CMD ["npm", "start"]

