import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecebivel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateRecebivelDto {
  @ApiProperty({ enum: TipoRecebivel })
  @IsEnum(TipoRecebivel)
  tipo: TipoRecebivel;

  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Valor de face do recebivel' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorNominal: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-06-01' })
  @Type(() => Date)
  @IsDate()
  dataEmissao: Date;

  @ApiProperty({ type: String, format: 'date', example: '2026-08-01' })
  @Type(() => Date)
  @IsDate()
  dataVencimento: Date;

  // --- Cheque ---
  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @IsString()
  banco?: string;

  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @IsString()
  agencia?: string;

  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @IsString()
  conta?: string;

  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @IsString()
  numeroCheque?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @Type(() => Date)
  @IsDate()
  dataBomPara?: Date;

  // --- Duplicata ---
  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = DUPLICATA' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.DUPLICATA)
  @IsString()
  numeroNotaFiscal?: string;

  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = DUPLICATA' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.DUPLICATA)
  @IsBoolean()
  aceite?: boolean;
}
