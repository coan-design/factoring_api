import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class RegistrarPagamentoParcelaDto {
  @ApiProperty({ description: 'Valor pago a ser somado ao valorPago da parcela' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
}
