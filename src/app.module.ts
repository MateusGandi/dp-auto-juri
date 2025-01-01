import { Module } from '@nestjs/common';
import { FormatModule } from './format/format.module';
import { ScrapingModule } from './scraping/scraping.module';
import { ArquivoModule } from './arquivo/arquivo.module';

@Module({
  imports: [FormatModule, ScrapingModule, ArquivoModule],
})
export class AppModule {}
