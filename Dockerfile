FROM node:20

# Instalar dependências necessárias para o Google Chrome
RUN apt-get update && apt-get install -y \
  wget \
  gnupg2 \
  ca-certificates \
  curl \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libx11-xcb1 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Baixar e instalar o Google Chrome
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN dpkg -i google-chrome-stable_current_amd64.deb || apt-get install -f

# Definir variável de ambiente para o Puppeteer usar o Google Chrome instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Instalar o NestJS CLI
RUN npm install -g @nestjs/cli

WORKDIR /app

# Copiar os arquivos do projeto
COPY package*.json ./ 

RUN npm install

COPY . .

# Expor a porta 4607
EXPOSE 4607

CMD ["npm", "run", "start"]
