FROM node:20-alpine

# Criar um novo usuário (não-root)
RUN adduser -D myuser

# Instalar dependências necessárias para o Chromium
RUN apk update && apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ttf-freefont \
  fontconfig \
  libx11 \
  libxcomposite \
  libxdamage \
  libxrandr \
  && rm -rf /var/cache/apk/*

# Definir variável de ambiente para o Puppeteer usar o Chromium instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Instalar o NestJS CLI
RUN npm install -g @nestjs/cli

WORKDIR /app

# Copiar os arquivos do projeto
COPY package*.json ./ 

RUN npm install

COPY . .

# Mudar para o usuário não-root
USER myuser

# Expor a porta 4607
EXPOSE 4607

CMD ["npm", "run", "start"]
