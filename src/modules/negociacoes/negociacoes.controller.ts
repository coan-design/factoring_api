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
import { PerfilUsuario, StatusNegociacao } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NegociacoesService } from './negociacoes.service';
import { CreateNegociacaoDto } from './dto/create-negociacao.dto';
import { UpdateNegociacaoDto } from './dto/update-negociacao.dto';
import { AdicionarItemRecebivelDto } from './dto/adicionar-item-recebivel.dto';
import { AdicionarItemEmprestimoDto } from './dto/adicionar-item-emprestimo.dto';
import { RegistrarPagamentoNegociacaoDto } from './dto/registrar-pagamento-negociacao.dto';

@ApiTags('negociacoes')
@ApiBearerAuth()
@Controller('negociacoes')
export class NegociacoesController {
  constructor(private readonly negociacoesService: NegociacoesService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  create(@Body() dto: CreateNegociacaoDto, @CurrentUser() usuario: AuthenticatedUser) {
    return this.negociacoesService.create(dto, usuario.id);
  }

  @Get()
  @ApiQuery({ name: 'clienteId', required: false })
  @ApiQuery({ name: 'status', enum: StatusNegociacao, required: false })
  findAll(@Query('clienteId') clienteId?: string, @Query('status') status?: StatusNegociacao) {
    return this.negociacoesService.findAll(clienteId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.negociacoesService.findOne(id);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  update(@Param('id') id: string, @Body() dto: UpdateNegociacaoDto) {
    return this.negociacoesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.negociacoesService.remove(id);
  }

  @Post(':id/itens-recebivel')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  adicionarRecebivel(@Param('id') id: string, @Body() dto: AdicionarItemRecebivelDto) {
    return this.negociacoesService.adicionarRecebivel(id, dto);
  }

  @Post(':id/itens-emprestimo')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  adicionarEmprestimo(@Param('id') id: string, @Body() dto: AdicionarItemEmprestimoDto) {
    return this.negociacoesService.adicionarEmprestimo(id, dto);
  }

  @Patch(':id/aprovar')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  aprovar(@Param('id') id: string) {
    return this.negociacoesService.aprovar(id);
  }

  @Patch(':id/cancelar')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  cancelar(@Param('id') id: string) {
    return this.negociacoesService.cancelar(id);
  }

  @Patch(':id/pagamento')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  registrarPagamento(@Param('id') id: string, @Body() dto: RegistrarPagamentoNegociacaoDto) {
    return this.negociacoesService.registrarPagamento(id, dto.valor);
  }

  @Patch(':id/finalizar')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  finalizar(@Param('id') id: string) {
    return this.negociacoesService.finalizar(id);
  }
}
