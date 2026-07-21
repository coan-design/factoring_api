import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusNegociacao, TipoNegociacao } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAllNegociacoesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ enum: StatusNegociacao })
  @IsOptional()
  @IsEnum(StatusNegociacao)
  status?: StatusNegociacao;

  @ApiPropertyOptional({ enum: TipoNegociacao })
  @IsOptional()
  @IsEnum(TipoNegociacao)
  tipoNegociacao?: TipoNegociacao;
}
