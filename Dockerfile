FROM node:20.11.1

# Instalar o pacote do Google Chrome e bibliotecas necessárias
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r apify && useradd -rm -g apify -G audio,video apify

# Determinar o caminho do Google Chrome instalado
RUN which google-chrome-stable || true

# Configurar o caminho do Google Chrome no Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
 
# Instalar o NestJS CLI
RUN npm install -g @nestjs/cli

WORKDIR /app

# Copiar arquivos do projeto
COPY package*.json ./
RUN npm install
COPY . .

# Expor a porta 4607
EXPOSE 4607

CMD ["npm", "run", "start"]
