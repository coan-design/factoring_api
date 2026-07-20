import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreateUsuarioDto } from './create-usuario.dto';

export class UpdateUsuarioDto extends PartialType(OmitType(CreateUsuarioDto, ['senha'] as const)) {
  @ApiPropertyOptional({ minLength: 6, description: 'Informe apenas para alterar a senha' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;
}
