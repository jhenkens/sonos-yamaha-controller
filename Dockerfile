FROM node:alpine
WORKDIR /app

RUN apk add --no-cache git

COPY package.json /app
RUN npm install
COPY . /app

ENV CONFIG_FILE /config/config.json

ENTRYPOINT ["node", "index.js"]
