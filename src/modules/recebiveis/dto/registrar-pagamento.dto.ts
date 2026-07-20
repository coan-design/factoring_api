import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class RegistrarPagamentoDto {
  @ApiProperty({ description: 'Valor pago a ser abatido do valorAberto' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
}
