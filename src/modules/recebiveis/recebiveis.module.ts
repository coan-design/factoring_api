import { Module } from '@nestjs/common';
import { RecebiveisService } from './recebiveis.service';
import { RecebiveisController } from './recebiveis.controller';
import { NegociacoesModule } from '../negociacoes/negociacoes.module';

@Module({
  imports: [NegociacoesModule],
  controllers: [RecebiveisController],
  providers: [RecebiveisService],
  exports: [RecebiveisService],
})
export class RecebiveisModule {}
