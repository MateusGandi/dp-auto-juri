import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { HTTPRequest } from 'src/axios/axios.config';
import axios from 'axios';

@Controller('documentos')
export class ArquivoController {
  private HTTPRequest = new HTTPRequest();

  constructor() {}

  // Configuração de armazenamento do Multer
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(
        __dirname,
        '..',
        '..',
        'documentos',
        'arquivos-template',
      );
      fs.mkdir(uploadPath, { recursive: true }, (err) => {
        if (err) {
          console.error('Erro ao criar diretório:', err);
          return cb(err, '');
        }
        cb(null, uploadPath);
      });
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now(); // Adiciona timestamp ao nome do arquivo
      cb(null, `${uniqueSuffix}_${file.originalname}`);
    },
  });

  // Configuração do Multer
  upload = multer({
    storage: this.storage,
    fileFilter: (req, file, cb) => {
      // Filtro de arquivos (pode ser ajustado para validar tipos específicos)
      cb(null, true);
    },
  });

  @Get(':nomePasta/:file')
  async buscarArquivo(@Req() req: Request, @Res() res: Response) {
    try {
      const { nomePasta, file } = req.params;

      if (!file) {
        return res
          .status(400)
          .json({ error: "Parâmetro 'file' não fornecido na consulta." });
      }

      const caminhoDoArquivo = path.join(
        __dirname,
        '..',
        '..',
        'documentos',
        nomePasta,
        file,
      );

      if (!fs.existsSync(caminhoDoArquivo)) {
        return res.status(404).json({ error: 'Arquivo não encontrado.' });
      }

      res.sendFile(caminhoDoArquivo);
    } catch (error) {
      console.error('Erro ao buscar arquivo:', error);
      res.status(500).json({ error: 'Erro interno ao buscar o arquivo.' });
    }
  }

  // Endpoint para upload de arquivos
  @Post('/template/upload-document')
  async uploadArquivos(@Req() req: any, @Res() res: Response) {
    this.upload.array('arquivos', 5)(req, res, async (err: any) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      try {
        const processados = req.files.map((file: any) => ({
          name: file.filename,
          created: new Date().toISOString(),
        }));

        const arquivos = await this.HTTPRequest.insert(
          'arquivos-template',
          processados,
        );

        res.status(200).json({
          message: 'Upload de arquivos bem-sucedido',
          arquivoProcessados: arquivos,
        });
      } catch (error) {
        console.error('Erro ao processar upload:', error);
        res
          .status(500)
          .json({ error: 'Erro ao salvar os arquivos no banco de dados.' });
      }
    });
  }

  // Endpoint para deletar arquivo
  @Delete('/:nomePasta/:file')
  async deletarArquivo(@Req() req: Request, @Res() res: Response) {
    const { nomePasta, file } = req.params;
    const { data } = await axios.get(
      `https://srv488264.hstgr.cloud/conection/mongo?document=${nomePasta}`,
    );
    const { parametros, _id } = data;
    const arquivoToRemove = parametros.find(({ name }) => name === file);

    if (!arquivoToRemove) {
      throw new BadRequestException('Arquivo não encontrado');
    }
    const caminhoDoArquivo = path.join(
      __dirname,
      '..',
      '..',
      'documentos',
      nomePasta,
      arquivoToRemove.name,
    );
    if (!fs.existsSync(caminhoDoArquivo)) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    await this.HTTPRequest.delete(_id, arquivoToRemove._id);
    fs.unlink(caminhoDoArquivo, (err) => {
      if (err) {
        console.error('Erro ao deletar arquivo:', err);
        return res.status(500).json({ error: 'Erro ao deletar o arquivo.' });
      }

      res.status(200).json({ message: 'Arquivo removido com sucesso.' });
    });
  }

  @Get('/:documentoMongo')
  async getArquivo(@Param('documentoMongo') documentoMongo: string) {
    if (!documentoMongo) {
      throw new BadRequestException('Documento mongo não informado');
    }
    const { data } = await axios.get(
      `https://srv488264.hstgr.cloud/conection/mongo?document=${documentoMongo}`,
    );
    return data;
  }
}
