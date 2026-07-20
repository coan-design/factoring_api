import { ApiProperty } from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6, description: 'Senha em texto plano, sera armazenada como hash' })
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({ enum: PerfilUsuario })
  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
