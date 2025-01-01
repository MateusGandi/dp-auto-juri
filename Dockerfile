FROM node:16-alpine as production

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install --force

COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]
