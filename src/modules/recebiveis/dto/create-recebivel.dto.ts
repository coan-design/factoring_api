import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecebivel } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
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

  @ApiProperty()
  @IsDateString()
  dataEmissao: string;

  @ApiProperty()
  @IsDateString()
  dataVencimento: string;

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

  @ApiPropertyOptional({ description: 'Obrigatorio quando tipo = CHEQUE' })
  @ValidateIf((o) => o.tipo === TipoRecebivel.CHEQUE)
  @IsDateString()
  dataBomPara?: string;

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
