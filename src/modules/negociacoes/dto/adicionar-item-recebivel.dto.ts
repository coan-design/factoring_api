import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AdicionarItemRecebivelDto {
  @ApiProperty({ description: 'Recebivel entra com o valorLiquido ja calculado no seu proprio cadastro' })
  @IsUUID()
  recebivelId: string;
}
