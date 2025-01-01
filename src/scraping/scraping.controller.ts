import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScrapingService } from './scraping.service';

@Controller('scraping')
export class ScrapingController {
  constructor(private readonly scrapingService: ScrapingService) {}

  @Get('buscar-arquivo-berna/:processoNumero')
  async interactWithPage(@Param('processoNumero') processoNumero: string) {
    return await this.scrapingService.buscarArquivoBerna(processoNumero);
  }
}
