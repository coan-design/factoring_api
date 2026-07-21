import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusCliente, TipoCliente } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAllClientesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: StatusCliente })
  @IsOptional()
  @IsEnum(StatusCliente)
  status?: StatusCliente;

  @ApiPropertyOptional({ enum: TipoCliente })
  @IsOptional()
  @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;

  @ApiPropertyOptional({ description: 'Busca textual por nome ou cpfCnpj (case-insensitive)' })
  @IsOptional()
  @IsString()
  busca?: string;
}
