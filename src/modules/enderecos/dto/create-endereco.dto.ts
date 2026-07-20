import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateEnderecoDto {
  @ApiProperty()
  @IsString()
  @Length(8, 9)
  cep: string;

  @ApiProperty()
  @IsString()
  logradouro: string;

  @ApiProperty()
  @IsString()
  numero: string;

  @ApiProperty()
  @IsString()
  bairro: string;

  @ApiProperty()
  @IsString()
  cidade: string;

  @ApiProperty({ description: 'UF, ex.: SP' })
  @IsString()
  @Length(2, 2)
  estado: string;
}
