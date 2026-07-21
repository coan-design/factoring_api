import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const PAGE_SIZE_MAXIMO = 100;

/**
 * Query params de paginacao comuns a todos os endpoints de listagem. Cada modulo cria seu
 * proprio FindAllXxxQueryDto estendendo esta classe e adicionando os filtros especificos --
 * assim page/pageSize sao validados uma unica vez, aqui, em vez de repetidos por controller.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Pagina (1-indexed)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: PAGE_SIZE_MAXIMO,
    description: 'Itens por pagina',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAXIMO)
  pageSize: number = 20;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}
