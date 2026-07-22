import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusParcela } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { montarRespostaPaginada } from '../../common/utils/pagination.util';
import { CreateEmprestimoDto } from './dto/create-emprestimo.dto';
import { UpdateEmprestimoDto } from './dto/update-emprestimo.dto';
import { FindAllEmprestimosQueryDto } from './dto/find-all-emprestimos-query.dto';
import { calcularSaldoDevedorEmprestimo, calcularValorParcela } from './emprestimo.rules';

function adicionarMeses(data: Date, meses: number): Date {
  const resultado = new Date(data);
  resultado.setMonth(resultado.getMonth() + meses);
  return resultado;
}

@Injectable()
export class EmprestimosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateEmprestimoDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) {
      throw new NotFoundException('Cliente nao encontrado');
    }

    const emprestimo = await this.prisma.emprestimo.create({ data: dto });
    await this.gerarParcelas(emprestimo.id);

    return this.findOne(emprestimo.id);
  }

  async findAll(query: FindAllEmprestimosQueryDto) {
    const where: Prisma.EmprestimoWhereInput = {
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.comSaldoDevedor === true
        ? { parcelas: { some: { status: { not: StatusParcela.PAGA } } } }
        : {}),
      // "quitado" exige ao menos uma parcela gerada, senao o `every` seria vacuamente verdadeiro
      // para emprestimos sem parcelas ainda.
      ...(query.comSaldoDevedor === false
        ? {
            AND: [
              { parcelas: { some: {} } },
              { parcelas: { every: { status: StatusParcela.PAGA } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.emprestimo.findMany({
        where,
        include: { parcelas: true },
        orderBy: { dataContratacao: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.emprestimo.count({ where }),
    ]);

    return montarRespostaPaginada(data, total, query);
  }

  async findOne(id: string) {
    const emprestimo = await this.prisma.emprestimo.findUnique({
      where: { id },
      include: { parcelas: { orderBy: { numero: 'asc' } } },
    });
    if (!emprestimo) {
      throw new NotFoundException('Emprestimo nao encontrado');
    }
    return emprestimo;
  }

  async update(id: string, dto: UpdateEmprestimoDto) {
    await this.findOne(id);
    return this.prisma.emprestimo.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.emprestimo.delete({ where: { id } });
  }

  /**
   * Emprestimo.gerarParcelas(): cria N ParcelaEmprestimo (quantidadeParcelas) com valor
   * fixo calculado conforme tipoJuros/taxaJuros, vencendo mensalmente a partir da
   * dataContratacao. Idempotente: nao gera novamente se ja existem parcelas.
   */
  async gerarParcelas(emprestimoId: string) {
    const emprestimo = await this.prisma.emprestimo.findUnique({ where: { id: emprestimoId } });
    if (!emprestimo) {
      throw new NotFoundException('Emprestimo nao encontrado');
    }

    const parcelaExistente = await this.prisma.parcelaEmprestimo.findFirst({
      where: { emprestimoId },
    });
    if (parcelaExistente) {
      throw new ConflictException('Parcelas ja foram geradas para este emprestimo');
    }

    const valorParcela = calcularValorParcela(
      emprestimo.valorEmprestado,
      emprestimo.taxaJuros,
      emprestimo.quantidadeParcelas,
      emprestimo.tipoJuros,
    );

    const parcelas: Prisma.ParcelaEmprestimoCreateManyInput[] = Array.from(
      { length: emprestimo.quantidadeParcelas },
      (_, indice) => ({
        emprestimoId,
        numero: indice + 1,
        valor: valorParcela,
        valorPago: 0,
        dataVencimento: adicionarMeses(emprestimo.dataContratacao, indice + 1),
        status: StatusParcela.PENDENTE,
      }),
    );

    await this.prisma.parcelaEmprestimo.createMany({ data: parcelas });

    return this.prisma.parcelaEmprestimo.findMany({
      where: { emprestimoId },
      orderBy: { numero: 'asc' },
    });
  }

  /** Emprestimo.calcularValorTotal(): soma dos valores das parcelas geradas. */
  async calcularValorTotal(emprestimoId: string): Promise<Prisma.Decimal> {
    await this.findOne(emprestimoId);

    const resultado = await this.prisma.parcelaEmprestimo.aggregate({
      where: { emprestimoId },
      _sum: { valor: true },
    });

    if (resultado._sum.valor === null) {
      throw new BadRequestException('Parcelas ainda nao foram geradas para este emprestimo');
    }

    return resultado._sum.valor;
  }

  /** Emprestimo.calcularSaldoDevedor(): quanto ainda falta receber deste emprestimo hoje. */
  async calcularSaldoDevedor(emprestimoId: string): Promise<Prisma.Decimal> {
    await this.findOne(emprestimoId);

    const parcelas = await this.prisma.parcelaEmprestimo.findMany({ where: { emprestimoId } });
    if (parcelas.length === 0) {
      throw new BadRequestException('Parcelas ainda nao foram geradas para este emprestimo');
    }

    return calcularSaldoDevedorEmprestimo(parcelas);
  }

  /** Sobe o contrato assinado (imagem ou PDF) e grava a URL retornada pelo storage. */
  async salvarContrato(id: string, arquivo: Express.Multer.File) {
    await this.findOne(id);

    const url = await this.storageService.upload(`emprestimos/${id}`, arquivo);
    await this.prisma.emprestimo.update({ where: { id }, data: { contratoUrl: url } });

    return { url };
  }
}
