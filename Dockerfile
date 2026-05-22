FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/notes

ENV PORT=8080
EXPOSE $PORT

CMD ["node", "server.js"]
