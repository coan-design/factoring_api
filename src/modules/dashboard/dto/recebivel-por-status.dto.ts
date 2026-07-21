import { ApiProperty } from '@nestjs/swagger';
import { StatusRecebivel } from '@prisma/client';

export class RecebivelPorStatusDto {
  @ApiProperty({ enum: StatusRecebivel, example: StatusRecebivel.PENDENTE })
  status: StatusRecebivel;

  @ApiProperty({ example: 145 })
  quantidade: number;

  @ApiProperty({
    example: 58,
    description:
      'Percentual inteiro (0-100). A soma de percentual de todos os itens do array fecha em 100 (o maior grupo absorve o arredondamento).',
  })
  percentual: number;
}
