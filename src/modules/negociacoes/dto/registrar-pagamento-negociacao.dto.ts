import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class RegistrarPagamentoNegociacaoDto {
  @ApiProperty({ description: 'Valor pago a ser abatido do saldo da negociacao' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
}
