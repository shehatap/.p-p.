FROM node:20-slim

# Install Python, pip, and system deps for PDF generation
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Install only production Node deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy pre-built dist (no build step needed)
COPY dist/ ./dist/

# Copy server scripts and assets
COPY server/generate_proposal.py ./server/
COPY server/parse_estimate.py ./server/
COPY server/assets/ ./server/assets/

# Expose port
EXPOSE 5000

ENV NODE_ENV=production
ENV PYTHON_CMD=python3

CMD ["node", "dist/index.cjs"]
