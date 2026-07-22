import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmprestimosService } from './emprestimos.service';
import { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import { UpdateEmprestimoDto } from './dto/update-emprestimo.dto';
import { FindAllEmprestimosQueryDto } from './dto/find-all-emprestimos-query.dto';

const TIPOS_CONTRATO_ACEITOS = /^(image\/jpeg|image\/png|application\/pdf)$/;
const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;

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
  @ApiQuery({
    name: 'comSaldoDevedor',
    required: false,
    type: Boolean,
    description: 'true = com parcelas em aberto; false = quitados',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  findAll(@Query() query: FindAllEmprestimosQueryDto) {
    return this.emprestimosService.findAll(query);
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

  @Post(':id/contrato')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { arquivo: { type: 'string', format: 'binary' } },
    },
  })
  uploadContrato(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: TIPOS_CONTRATO_ACEITOS })
        .addMaxSizeValidator({ maxSize: TAMANHO_MAXIMO_ARQUIVO })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    arquivo: Express.Multer.File,
  ) {
    return this.emprestimosService.salvarContrato(id, arquivo);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.emprestimosService.remove(id);
  }
}
