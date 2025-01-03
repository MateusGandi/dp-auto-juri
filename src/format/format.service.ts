import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as pdf from 'pdf-parse';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { ScrapingService } from 'src/scraping/scraping.service';
import { HTTPRequest } from 'src/axios/axios.config';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class FormatService {
  private scrapingService = new ScrapingService();
  private pedidosRegex = /^[a-z]+\)[^)]+/gm;
  private HTTPRequest = new HTTPRequest();

  formatarData() {
    const meses = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    const data = new Date();

    const dia = String(data.getDate()).padStart(2, '0');
    const mes = meses[data.getMonth()];
    const ano = data.getFullYear();

    return `Goiânia, ${dia} de ${mes} de ${ano}.`;
  }

  async formatarConteudoAdicional(
    pedidosArray: any,
    numProcesso: string,
    index: number,
  ) {
    const { iaKey, prompt } = await this.HTTPRequest.queryOne('ia-config');
    const { data } = await this.HTTPRequest.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${iaKey}`,
      {
        contents: [
          {
            parts: [
              {
                text:
                  prompt +
                  pedidosArray.map((item: any) => `\t${item}`).join('\n'),
              },
            ],
          },
        ],
      },
    );
    return `${index + 1}. Nº ${numProcesso} - ${data.candidates[0].content.parts[0].text}`;
  }

  getJsonConteudoAdicional(pedido: string, dados: any, templateData: any) {
    return {
      alvo_titulo: dados.alvo_titulo,
      num_processo_completo: dados.num_processo_completo,
      nome_cliente: dados.nome_cliente,
      lista_processos: dados.lista_processos,
      conteudo_adicional: pedido,
      pedido_final: templateData.pedido_final,
      local_e_data: this.formatarData(),
      adv_responsavel: templateData.adv_responsavel,
      adv_responsavel_cabecalho: templateData.adv_responsavel_cabecalho,
      oab_code: templateData.oab_code,
      adv_email: templateData.adv_email,
      adv_telefone: templateData.adv_telefone,
    };
  }

  translateLocalProcessDocument = async (pdfPath: string) => {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath); // Leitura síncrona

      const pdfData = await pdf(pdfBuffer);
      const pdfText = pdfData.text;
      console.log('pdfText', pdfText);
      const pedidosArray = pdfText.match(this.pedidosRegex) || [
        'Nenhum pedido encontrado',
      ];

      fs.unlinkSync(pdfPath);
      return pedidosArray;
    } catch (error) {
      console.error('Erro ao processar o documento:', error);
      return [];
    }
  };

  getFinalDocumentEditable = async (pedidos: string, dados: any) => {
    try {
      const { name } = await this.HTTPRequest.queryOne('arquivos-template');
      const docxTemplatePath = path.join(
        __dirname,
        `../../documentos/arquivos-template/${name}`,
      );
      const nomeArquivo = `${Date.now()}-${dados.nome_cliente.toLowerCase().replaceAll(' ', '-')}.docx`;
      const outputDocxPath = path.join(
        __dirname,
        `../../documentos/arquivos/${nomeArquivo}`,
      );
      const templateData = await this.HTTPRequest.queryOne('all-config');
      const conteudoAdicional = this.getJsonConteudoAdicional(
        pedidos,
        dados,
        templateData,
      );
      const docxBuffer = fs.readFileSync(docxTemplatePath);
      const zip = new PizZip(docxBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
      doc.render(conteudoAdicional);
      const newDocxBuffer = doc.getZip().generate({ type: 'nodebuffer' });
      console.log(outputDocxPath);
      fs.writeFileSync(outputDocxPath, newDocxBuffer);
      await this.HTTPRequest.insert('arquivos', [
        { name: nomeArquivo, created: new Date() },
      ]);
      return nomeArquivo;
    } catch (error) {
      console.error('Erro ao processar o documento:', error);
      return null;
    }
  };

  translateLocalBernaDocument = async (pdfBernaPath: string) => {
    try {
      const pdfBuffer = fs.readFileSync(pdfBernaPath);
      const pdfData = await pdf(pdfBuffer);
      let pdfText = pdfData.text;

      // Normalização do texto (remover múltiplos espaços e quebras de linha)
      pdfText = pdfText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ');

      // Regex ajustada para capturar o índice e o número do processo corretamente
      const processosRegex = /(Arquivado|Ativo|Status)\s*(\d*\.\d{1,2})?/g;

      const processosArray = [];
      let resultados = [];
      let match: any;

      // Executa a regex na string
      while ((match = processosRegex.exec(pdfText)) !== null) {
        const status = match[1];
        const processo = match[2] || 'Status'; // Se não houver número, atribui uma string vazia
        resultados.push(status, processo);
      }
      // Filtra os resultados para remover "Status"
      resultados = resultados.filter((item) => item !== 'Status');

      for (let i = 0; i < resultados.length; i += 2) {
        processosArray.push({
          numeroProcesso: resultados[i].substring(1),
          status: resultados[i + 1],
        }); // Garante que o processo seja vazio se não houver número
      }

      fs.unlinkSync(pdfBernaPath);
      // Retorna os processos em formato de array de objetos
      return processosArray;
    } catch (error) {
      console.error('Erro ao processar o documento:', error);
      throw error;
    }
  };

  getIaConfig = async () => {
    try {
      return await this.HTTPRequest.queryOne('ia-config');
    } catch (err) {
      console.error('Erro ao obter dados de configuração', err.message);
      throw err;
    }
  };
  getMarkdownConfig = async () => {
    try {
      const dados = await this.HTTPRequest.queryOne('all-config');
      const login = await this.HTTPRequest.queryOne('login');
      return { dados, login };
    } catch (err) {
      console.error('Erro ao obter dados de configuração', err.message);
      throw err;
    }
  };

  updateIaConfig = async (newData: any) => {
    try {
      return await this.HTTPRequest.update('ia-config', [newData]);
    } catch (err) {
      console.error('Erro ao obter dados de configuração', err.message);
      throw err;
    }
  };
  updateMarkdownConfig = async (newData: { login: any; dados: any }) => {
    try {
      const { login, dados } = newData;
      return await Promise.all([
        await this.HTTPRequest.update('all-config', [dados]),
        await this.HTTPRequest.update('login', [login]),
      ]);
    } catch (err) {
      console.error('Erro ao obter dados de configuração', err.message);
      throw err;
    }
  };

  getIAResponse = async (pergunta: string) => {
    try {
      const { iaKey } = await this.HTTPRequest.queryOne('ia-config');
      const { data } = await this.HTTPRequest.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${iaKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: 'Em portugues BR, me responda: ' + pergunta,
                },
              ],
            },
          ],
        },
      );
      return { resposta: data.candidates[0].content.parts[0].text };
    } catch (err) {
      console.error('Erro ao processar o pergunta:', err.message);
      throw err;
    }
  };

  iniciarFluxo = async (numProcesso: string) => {
    const { urlArquivo, dados } =
      await this.scrapingService.buscarArquivoBerna(numProcesso);

    const processoList = await this.translateLocalBernaDocument(urlArquivo);

    const clausulasFinais: any = {};

    const urlsArquivosProcessos =
      await this.scrapingService.buscarArquivoProcesso(
        processoList.map(({ numeroProcesso }) => numeroProcesso),
      );

    for (const processo of urlsArquivosProcessos) {
      const clausulas = await this.translateLocalProcessDocument(
        processo.localUrl,
      );

      if (clausulas && clausulas.length > 0) {
        clausulasFinais[processo.numProcesso] = clausulas;
      } else {
        clausulasFinais[processo.numProcesso] = ['Não encontrado'];
      }
    }

    const clausulasFormated = await Promise.all(
      Object.keys(clausulasFinais).map((key, index) =>
        this.formatarConteudoAdicional(clausulasFinais[key], key, index),
      ),
    );
    const arquivo = await this.getFinalDocumentEditable(
      clausulasFormated.join('\t\t'),
      { ...dados, lista_processos: Object.keys(clausulasFinais).join(', ') },
    );

    fs.unlink('../../cookies.json', () =>
      console.log('arquivo cookies.json removido'),
    );
    return {
      arquivo: arquivo,
      clausulasFinais,
    };
  };
}
