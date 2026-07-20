import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class AdicionarItemEmprestimoDto {
  @ApiProperty()
  @IsUUID()
  emprestimoId: string;

  @ApiProperty({ description: 'Taxa de juros aplicada ao principal do emprestimo nesta negociacao' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  taxaJuros: number;
}
