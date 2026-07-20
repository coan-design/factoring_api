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
import { PerfilUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmprestimosService } from './emprestimos.service';
import { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import { UpdateEmprestimoDto } from './dto/update-emprestimo.dto';

@ApiTags('emprestimos')
@ApiBearerAuth()
@Controller('emprestimos')
export class EmprestimosController {
  constructor(private readonly emprestimosService: EmprestimosService) {}

  @Post()
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  create(@Body() dto: CreateEmprestimoDto) {
    return this.emprestimosService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'clienteId', required: false })
  findAll(@Query('clienteId') clienteId?: string) {
    return this.emprestimosService.findAll(clienteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emprestimosService.findOne(id);
  }

  @Get(':id/valor-total')
  async calcularValorTotal(@Param('id') id: string) {
    const valorTotal = await this.emprestimosService.calcularValorTotal(id);
    return { valorTotal };
  }

  @Get(':id/saldo-devedor')
  async calcularSaldoDevedor(@Param('id') id: string) {
    const saldoDevedor = await this.emprestimosService.calcularSaldoDevedor(id);
    return { saldoDevedor };
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  update(@Param('id') id: string, @Body() dto: UpdateEmprestimoDto) {
    return this.emprestimosService.update(id, dto);
  }

  @Post(':id/gerar-parcelas')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  gerarParcelas(@Param('id') id: string) {
    return this.emprestimosService.gerarParcelas(id);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.emprestimosService.remove(id);
  }
}
