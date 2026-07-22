import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateMinhaSenhaDto {
  @ApiProperty()
  @IsString()
  senhaAtual: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  novaSenha: string;
}
