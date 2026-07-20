import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class AdicionarItemRecebivelDto {
  @ApiProperty()
  @IsUUID()
  recebivelId: string;

  @ApiProperty({ description: 'Prazo em dias considerado para o calculo do desagio' })
  @IsInt()
  @Min(0)
  quantidadeDias: number;

  @ApiProperty({ description: 'Taxa de desagio, em fracao decimal (ex.: 0.03 = 3%)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  taxaDesagio: number;
}
