import { Module } from '@nestjs/common';
import { FormatService } from './format.service';
import { FormatController } from './format.controller';
import { ScrapingModule } from 'src/scraping/scraping.module';

@Module({
  imports: [ScrapingModule],
  controllers: [FormatController],
  providers: [FormatService],
})
export class FormatModule {}
