FROM node:20-slim

# Set working directory
WORKDIR /app

# Install OpenSSL (needed for Prisma if used, though not explicitly in dependencies, good practice for Next.js apps often)
RUN apt-get update -y && apt-get install -y openssl

# Copy project files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3004

# Start the app
CMD ["npm", "run", "start"]
