import { Module } from '@nestjs/common';
import { NegociacoesService } from './negociacoes.service';
import { NegociacoesController } from './negociacoes.controller';

@Module({
  controllers: [NegociacoesController],
  providers: [NegociacoesService],
  exports: [NegociacoesService],
})
export class NegociacoesModule {}
