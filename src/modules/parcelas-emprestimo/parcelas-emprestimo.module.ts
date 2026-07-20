import { Module } from '@nestjs/common';
import { ParcelasEmprestimoService } from './parcelas-emprestimo.service';
import { ParcelasEmprestimoController } from './parcelas-emprestimo.controller';
import { NegociacoesModule } from '../negociacoes/negociacoes.module';

@Module({
  imports: [NegociacoesModule],
  controllers: [ParcelasEmprestimoController],
  providers: [ParcelasEmprestimoService],
  exports: [ParcelasEmprestimoService],
})
export class ParcelasEmprestimoModule {}
