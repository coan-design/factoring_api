import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindReceitaMensalQueryDto {
  @ApiPropertyOptional({
    default: 6,
    minimum: 1,
    maximum: 24,
    description: 'Janela em meses, incluindo o mes atual',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  meses: number = 6;
}
