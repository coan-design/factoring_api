import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { TipoCliente } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClienteDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty({ description: 'CPF ou CNPJ, apenas digitos' })
  @IsString()
  cpfCnpj: string;

  @ApiProperty({ enum: TipoCliente })
  @IsEnum(TipoCliente)
  tipoCliente: TipoCliente;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  telefone: string;

  @ApiPropertyOptional({ description: 'ID de um Endereco ja cadastrado' })
  @IsOptional()
  @IsUUID()
  enderecoId?: string;
}
