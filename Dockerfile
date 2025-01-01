FROM node:18-alpine

RUN npm install -g @nestjs/cli

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4607

CMD ["npm", "run", "start"]