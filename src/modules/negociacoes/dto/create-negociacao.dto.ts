import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormaPagamento, TipoNegociacao } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateNegociacaoDto {
  @ApiProperty({ description: 'Numero/identificador legivel da negociacao' })
  @IsString()
  numero: string;

  @ApiProperty()
  @IsString()
  titulo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ enum: TipoNegociacao })
  @IsEnum(TipoNegociacao)
  tipoNegociacao: TipoNegociacao;

  @ApiProperty({ enum: FormaPagamento })
  @IsEnum(FormaPagamento)
  formaPagamento: FormaPagamento;

  @ApiPropertyOptional({ default: 0, description: 'Tarifas fixas cobradas na negociacao' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorTarifas?: number;
}
