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
import { PerfilUsuario, StatusRecebivel } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RecebiveisService } from './recebiveis.service';
import { CreateRecebivelDto } from './dto/create-recebivel.dto';
import { UpdateRecebivelDto } from './dto/update-recebivel.dto';
import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';

@ApiTags('recebiveis')
@ApiBearerAuth()
@Controller('recebiveis')
export class RecebiveisController {
  constructor(private readonly recebiveisService: RecebiveisService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  create(@Body() dto: CreateRecebivelDto) {
    return this.recebiveisService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'clienteId', required: false })
  @ApiQuery({ name: 'status', enum: StatusRecebivel, required: false })
  findAll(@Query('clienteId') clienteId?: string, @Query('status') status?: StatusRecebivel) {
    return this.recebiveisService.findAll(clienteId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recebiveisService.findOne(id);
  }

  @Get(':id/vencido')
  verificarVencido(@Param('id') id: string) {
    return this.recebiveisService.verificarVencido(id);
  }

  @Get(':id/quitado')
  verificarQuitado(@Param('id') id: string) {
    return this.recebiveisService.verificarQuitado(id);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  update(@Param('id') id: string, @Body() dto: UpdateRecebivelDto) {
    return this.recebiveisService.update(id, dto);
  }

  @Patch(':id/pagamento')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  registrarPagamento(@Param('id') id: string, @Body() dto: RegistrarPagamentoDto) {
    return this.recebiveisService.registrarPagamento(id, dto.valor);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.recebiveisService.remove(id);
  }
}
