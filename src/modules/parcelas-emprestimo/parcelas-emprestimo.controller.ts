import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParcelasEmprestimoService } from './parcelas-emprestimo.service';
import { RegistrarPagamentoParcelaDto } from './dto/registrar-pagamento-parcela.dto';
import { FindAllParcelasQueryDto } from './dto/find-all-parcelas-query.dto';

@ApiTags('parcelas-emprestimo')
@ApiBearerAuth()
@Controller('parcelas-emprestimo')
export class ParcelasEmprestimoController {
  constructor(private readonly parcelasService: ParcelasEmprestimoService) {}

  @Get()
  @ApiQuery({ name: 'emprestimoId', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  findAllByEmprestimo(@Query() query: FindAllParcelasQueryDto) {
    return this.parcelasService.findAllByEmprestimo(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parcelasService.findOne(id);
  }

  @Get(':id/quitada')
  verificarQuitada(@Param('id') id: string) {
    return this.parcelasService.verificarQuitada(id);
  }

  @Patch(':id/pagamento')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  registrarPagamento(@Param('id') id: string, @Body() dto: RegistrarPagamentoParcelaDto) {
    return this.parcelasService.registrarPagamento(id, dto.valor);
  }
}
