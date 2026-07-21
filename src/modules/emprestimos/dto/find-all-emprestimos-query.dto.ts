import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAllEmprestimosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({
    description:
      'true = so emprestimos com pelo menos uma parcela nao paga; false = so emprestimos com todas as parcelas pagas (quitados)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  comSaldoDevedor?: boolean;
}
