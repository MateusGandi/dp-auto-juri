import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  Sse,
} from '@nestjs/common';
import { FormatService } from './format.service';
import { Observable } from 'rxjs';
import { Response, response } from 'express';

@Controller('automacao')
export class FormatController {
  constructor(private readonly formatService: FormatService) {}

  @Get('arquivo/:processoNumero')
  async getArquivoComprobatorio(
    @Param('processoNumero') processoNumero: string,
  ) {
    try {
      const resp = await this.formatService.iniciarFluxo(processoNumero);

      return resp;
    } catch (error) {
      return { message: error.message };
    }
  }

  @Post('/IA/interact')
  async interact(@Body('pergunta') pergunta: string) {
    if (pergunta.length > 300) {
      throw new BadRequestException(
        'Número de carateres não pode ser superior a 300.',
      );
    }

    return await this.formatService.getIAResponse(pergunta);
  }

  @Get('/IA/config')
  async getIaConfig() {
    return await this.formatService.getIaConfig();
  }
  @Put('/IA/config')
  async updateIaConfig(@Body('data') data: any) {
    return await this.formatService.updateIaConfig(data);
  }

  @Get('/markdown/config')
  async getMarkdownConfig() {
    return await this.formatService.getMarkdownConfig();
  }
  @Put('/markdown/config')
  async updateMarkdownConfig(@Body('data') data: { login: any; dados: any }) {
    return await this.formatService.updateMarkdownConfig(data);
  }
}
