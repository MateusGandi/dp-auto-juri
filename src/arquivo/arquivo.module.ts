import { Module } from '@nestjs/common';
import { ArquivoController } from './arquivo.controller';

@Module({
  controllers: [ArquivoController],
})
export class ArquivoModule {}
