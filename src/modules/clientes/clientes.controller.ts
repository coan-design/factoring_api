import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PerfilUsuario, StatusCliente } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'status', enum: StatusCliente, required: false })
  findAll(@Query('status') status?: StatusCliente) {
    return this.clientesService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Patch(':id/ativar')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  ativar(@Param('id') id: string) {
    return this.clientesService.ativar(id);
  }

  @Patch(':id/inativar')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  inativar(@Param('id') id: string) {
    return this.clientesService.inativar(id);
  }
}
