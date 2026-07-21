import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusRecebivel, TipoRecebivel } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAllRecebiveisQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ enum: StatusRecebivel })
  @IsOptional()
  @IsEnum(StatusRecebivel)
  status?: StatusRecebivel;

  @ApiPropertyOptional({ enum: TipoRecebivel })
  @IsOptional()
  @IsEnum(TipoRecebivel)
  tipo?: TipoRecebivel;

  @ApiPropertyOptional({ description: 'dataVencimento >= (para telas de "vencendo em breve")' })
  @IsOptional()
  @IsDateString()
  dataVencimentoInicio?: string;

  @ApiPropertyOptional({ description: 'dataVencimento <=' })
  @IsOptional()
  @IsDateString()
  dataVencimentoFim?: string;
}
