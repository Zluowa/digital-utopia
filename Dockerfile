# @input: Digital Utopia source code
# @output: Running engine on port 4000, auto-bootstraps world if missing
# @position: One-command Docker deployment

FROM node:20-slim AS base
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Engine
COPY engine/package*.json engine/
RUN cd engine && npm install --omit=dev

# Frontend
COPY frontend-new/package*.json frontend-new/
RUN cd frontend-new && npm install --omit=dev

# Source
COPY engine/ engine/
COPY frontend-new/ frontend-new/
COPY templates/ templates/
COPY shared/ shared/
COPY package.json tsconfig.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV PORT=4000
ENV WORLD=genesis
ENV AGENTS=alice,bob,charlie
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
