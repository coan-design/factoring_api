import { ApiProperty } from '@nestjs/swagger';
import { TipoAjusteNegociacao } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class AdicionarItemAjusteDto {
  @ApiProperty({ enum: TipoAjusteNegociacao })
  @IsEnum(TipoAjusteNegociacao)
  tipo: TipoAjusteNegociacao;

  @ApiProperty({ description: 'Motivo do ajuste (ex.: multa por atraso, correcao monetaria)' })
  @IsString()
  @MinLength(3)
  descricao: string;

  @ApiProperty({ description: 'Sempre positivo -- o sinal (soma ou subtrai) vem de tipo' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
}
