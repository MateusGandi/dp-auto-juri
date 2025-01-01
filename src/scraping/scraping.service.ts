import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

import { HTTPRequest } from 'src/axios/axios.config';

const COOKIE_FILE = path.resolve(__dirname, '..', '..', 'cookies.json');
const DOWNLOAD_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'documentos',
  'downloads',
);

// Verifica se o diretório de download existe, se não, cria
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH);
}

@Injectable()
export class ScrapingService {
  private HTTPRequest = new HTTPRequest();

  private async saveCookies(page: puppeteer.Page) {
    const cookies = await page.cookies();
    const currentUrl = page.url(); // Captura a URL atual da página
    const cookieData = { cookies, currentUrl, timestamp: Date.now() }; // Salva a URL junto com os cookies e timestamp
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2));
    console.log('Cookies e URL salvos.');
  }

  private async loadCookies(page: puppeteer.Page) {
    if (fs.existsSync(COOKIE_FILE)) {
      const cookieData = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
      const cookies = cookieData.cookies;
      const lastSaved = cookieData.timestamp;
      const savedUrl = cookieData.currentUrl;

      // Verifica se os cookies têm mais de 30 minutos
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutos em milissegundos
      const currentTime = Date.now();

      if (currentTime - lastSaved > thirtyMinutes) {
        console.log('Cookies expiraram. Reautenticando...');
        return null; // Retorna null para forçar o login e salvar novos cookies
      }

      await page.setCookie(...cookies);
      console.log('Cookies e URL carregados.');
      return savedUrl;
    } else {
      console.log('Nenhum cookie encontrado.');
      return null;
    }
  }

  private async scrollToBottom(page: puppeteer.Page) {
    await page.evaluate(async () => {
      const scrollInterval = 100;
      const scrollStep = 100;

      const scrollableElement = document.scrollingElement || document.body;

      while (
        scrollableElement.scrollTop + window.innerHeight <
        scrollableElement.scrollHeight
      ) {
        scrollableElement.scrollBy(0, scrollStep);
        await new Promise((resolve) => setTimeout(resolve, scrollInterval));
      }
    });
  }

  async buscarArquivoBerna(processoNumero: string) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const loadedCookies = await this.loadCookies(page);

    if (!loadedCookies) {
      const url = 'https://projudi.tjgo.jus.br/LogOn?PaginaAtual=-200';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const { login, senha } = await this.HTTPRequest.queryOne('login');
      try {
        console.log('Fazendo login...');
        await page.type('input#login', login);
        await page.type('input#senha', senha);
        await page.click("input[name='entrar']");
        await page.waitForSelector('#menuPrinciapl');
        await this.saveCookies(page);

        console.log('Login realizado com sucesso!');
      } catch (error) {
        console.error('Erro ao fazer login:', error.message);
      }
    } else {
      console.log('Já está logado com cookies válidos.');
      const url = loadedCookies;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    try {
      await page.evaluate(() => {
        const menuItem = document
          .querySelector('#menuPrinciapl')
          .querySelectorAll('ul')[2]
          .querySelectorAll('a')[1];
        menuItem.click();
      });

      await page.waitForSelector('iframe#Principal');

      const iframeElement = await page.$('iframe#Principal');
      const iframe: any = await iframeElement.contentFrame();

      await iframe.waitForSelector('input#ProcessoNumero', { visible: true });

      await iframe.type('input#ProcessoNumero', processoNumero);

      await iframe.evaluate(() => {
        const element: any = document.querySelectorAll('.imgIcons')[1];
        element.click();
      });

      await iframe.click("input[name='imgSubmeter']");

      await iframe.waitForSelector('#TabelaArquivos');

      await this.scrollToBottom(iframe);

      const dadosPagina = await iframe.evaluate(async () => {
        try {
          return {
            alvo_titulo: `AO ${document.querySelectorAll('.VisualizaDados')[7].querySelectorAll('span')[0].textContent.toUpperCase()}`,
            num_processo_completo: document
              .querySelector('#span_proc_numero')
              .textContent.trim(),
            nome_cliente: document
              .querySelector("span[title='Nome da Parte']")
              .textContent.trim()
              .toUpperCase(),
          };
        } catch (error) {
          return null;
        }
      });

      const linkToSave = await iframe.evaluate(async () => {
        const element = [
          ...document
            .querySelector('#TabelaArquivos')
            .querySelectorAll('.filtro_coluna_movimentacao'),
        ].find((item) => item.textContent.includes('mesmas partes'));
        if (element) {
          element.parentElement
            .querySelectorAll('.colunaMinima')[1]
            .querySelector('a')
            .click();
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const linkComponent: any = element.parentElement.nextElementSibling
            .querySelectorAll('tr td ul li div')[2]
            .querySelector('div a');
          return linkComponent ? linkComponent.href : null;
        }
        return null;
      });

      if (linkToSave) {
        const timestamp = Date.now();
        const fileName = `processo_${processoNumero.replace(/\./g, '_')}_${timestamp}.pdf`;

        const filePath = path.join(DOWNLOAD_PATH, fileName);

        await page.goto(linkToSave, { waitUntil: 'domcontentloaded' });

        await page.pdf({ path: filePath, format: 'A4' });
        return {
          urlArquivo: filePath,
          dados: dadosPagina,
        };
      } else {
        console.error('Elemento não encontrado ou link inválido.');
      }
    } catch (error) {
      console.log(error);
      fs.unlink('../../cookies.json', () =>
        console.log('arquivo cookies.json removido'),
      );
      console.error('Erro ao interagir com a página:', error.message);
    } finally {
      await browser.close();
    }
  }

  async buscarArquivoProcesso(
    processoNumeros: string[],
  ): Promise<{ numProcesso: string; localUrl: string }[]> {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const loadedCookies = await this.loadCookies(page);
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_PATH,
    });

    if (!loadedCookies) {
      const url = 'https://projudi.tjgo.jus.br/LogOn?PaginaAtual=-200';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const { login, senha } = await this.HTTPRequest.queryOne('login');

      try {
        console.log('Fazendo login...');
        await page.type('input#login', login);
        await page.type('input#senha', senha);
        await page.click("input[name='entrar']");
        await page.waitForSelector('#menuPrinciapl');
        await this.saveCookies(page);

        console.log('Login realizado com sucesso!');
      } catch (error) {
        console.error('Erro ao fazer login:', error.message);
      }
    } else {
      console.log('Já está logado com cookies válidos.');
      const url = loadedCookies;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    const urlsArquivosProcessos: any = [];
    try {
      for (const numProcesso of processoNumeros) {
        await page.evaluate(() => {
          const menuItem = document
            .querySelector('#menuPrinciapl')
            .querySelectorAll('ul')[2]
            .querySelectorAll('a')[1];
          menuItem.click();
        });

        await page.waitForSelector('iframe#Principal');

        const iframeElement = await page.$('iframe#Principal');
        const iframe: any = await iframeElement.contentFrame();

        await iframe.waitForSelector('input#ProcessoNumero', { visible: true });
        console.log('numProcesso', numProcesso);
        await iframe.type('input#ProcessoNumero', numProcesso);

        await iframe.evaluate(() => {
          const element: any = document.querySelectorAll('.imgIcons')[1];
          element.click();
        });

        await iframe.click("input[name='imgSubmeter']");

        await this.scrollToBottom(iframe);
        await iframe
          .waitForSelector('#dialog', { timeout: 3000 })
          .then(async () => {
            //tecla ok e pede permissão
          });
        await iframe.waitForSelector('#TabelaArquivos', { visible: true });

        const file = await iframe.evaluate(async () => {
          const element = [
            ...document
              .querySelector('#TabelaArquivos')
              .querySelectorAll('.filtro_coluna_movimentacao'),
          ].find((item) => item.textContent.includes('Peticão Enviada'));
          if (!element) return null;

          element.parentElement
            .querySelectorAll('.colunaMinima')[1]
            .querySelector('a')
            .click();
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const linkComponent: any = element.parentElement.nextElementSibling
            .querySelectorAll('tr td ul li div')[2]
            .querySelector('div a');

          const numProcesso = document
            .querySelector('#span_proc_numero')
            .textContent.split('.')[0]
            .trim();
          const timestamp = Date.now();
          const fileName = `processo_${numProcesso.replace(/\./g, '_')}_${timestamp}.pdf`;
          if (!linkComponent) return null;
          const pastName = linkComponent.title.split(' ')[0];
          linkComponent.setAttribute('download', fileName);

          if (linkComponent.href.includes('http')) {
            console.log('baixando arquivo normal');
            linkComponent.click();
          }
          return {
            name: fileName,
            href: linkComponent.href,
            pastName: pastName,
          };
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (!fs.existsSync(path.join(DOWNLOAD_PATH, file.pastName))) {
          // Abra uma nova aba para acessar o link
          const newPage = await browser.newPage();
          await newPage.goto(file.href, { waitUntil: 'domcontentloaded' });

          // Realize o download do arquivo na nova aba
          await newPage.evaluate(() => {
            const link = document.createElement('a');
            link.href = window.location.href;
            link.download = ''; // Nome do arquivo, se necessário
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
          });

          console.log('Arquivo baixado na nova aba.');

          // Feche a nova aba
          await newPage.close();

          console.log('Nova aba fechada. Retornando à aba principal.');
        }

        if (file) {
          await this.modificarArquivo(file);

          urlsArquivosProcessos.push({
            numProcesso: numProcesso,
            localUrl: path.join(DOWNLOAD_PATH, file.name),
          });
        } else {
          console.error('Elemento não encontrado ou link inválido.');
          urlsArquivosProcessos.push('Não encontrado');
        }
      }

      return urlsArquivosProcessos;
    } catch (error) {
      console.log(error);
      console.error('Erro ao interagir com a página:', error.message);
      return [];
    } finally {
      await browser.close();
    }
  }

  async modificarArquivo(file: {
    pastName: string;
    name: string;
  }): Promise<string> {
    const downloadFilePath = path.join(DOWNLOAD_PATH, file.pastName);
    return new Promise((resolve, reject) => {
      const checkDownload = setInterval(() => {
        if (fs.existsSync(downloadFilePath)) {
          clearInterval(checkDownload);
          const newFileName = path.join(DOWNLOAD_PATH, file.name);
          fs.renameSync(downloadFilePath, newFileName);
          resolve(newFileName);
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(checkDownload);
        reject(null);
      }, 90000);
    });
  }
}
