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
import { PerfilUsuario, StatusRecebivel, TipoRecebivel } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RecebiveisService } from './recebiveis.service';
import { CreateRecebivelDto } from './dto/create-recebivel.dto';
import { UpdateRecebivelDto } from './dto/update-recebivel.dto';
import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';
import { FindAllRecebiveisQueryDto } from './dto/find-all-recebiveis-query.dto';
import { UploadDocumentoRecebivelDto } from './dto/upload-documento-recebivel.dto';

const TIPOS_IMAGEM_ACEITOS = /^(image\/jpeg|image\/png)$/;
const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;

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
  @ApiQuery({ name: 'tipo', enum: TipoRecebivel, required: false })
  @ApiQuery({ name: 'dataVencimentoInicio', required: false, type: String })
  @ApiQuery({ name: 'dataVencimentoFim', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  findAll(@Query() query: FindAllRecebiveisQueryDto) {
    return this.recebiveisService.findAll(query);
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

  @Post(':id/documentos')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        lado: { type: 'string', enum: ['FRENTE', 'VERSO'] },
        arquivo: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadDocumento(
    @Param('id') id: string,
    @Body() dto: UploadDocumentoRecebivelDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: TIPOS_IMAGEM_ACEITOS })
        .addMaxSizeValidator({ maxSize: TAMANHO_MAXIMO_ARQUIVO })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    arquivo: Express.Multer.File,
  ) {
    return this.recebiveisService.salvarDocumento(id, dto.lado, arquivo);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.recebiveisService.remove(id);
  }
}
