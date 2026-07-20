import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AdicionarItemEmprestimoDto {
  @ApiProperty({ description: 'Emprestimo entra inteiro na negociacao (todas as parcelas, pagas ou nao)' })
  @IsUUID()
  emprestimoId: string;
}
