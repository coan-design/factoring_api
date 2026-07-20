import { Module } from '@nestjs/common';
import { ParcelasEmprestimoService } from './parcelas-emprestimo.service';
import { ParcelasEmprestimoController } from './parcelas-emprestimo.controller';

@Module({
  controllers: [ParcelasEmprestimoController],
  providers: [ParcelasEmprestimoService],
  exports: [ParcelasEmprestimoService],
})
export class ParcelasEmprestimoModule {}
