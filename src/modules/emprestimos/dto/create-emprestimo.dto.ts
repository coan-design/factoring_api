import { ApiProperty } from '@nestjs/swagger';
import { TipoJuros } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateEmprestimoDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorEmprestado: number;

  @ApiProperty({ enum: TipoJuros })
  @IsEnum(TipoJuros)
  tipoJuros: TipoJuros;

  @ApiProperty({ description: 'Taxa de juros ao mes, em fracao decimal (ex.: 0.025 = 2,5%)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  taxaJuros: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantidadeParcelas: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-01' })
  @Type(() => Date)
  @IsDate()
  dataContratacao: Date;
}
