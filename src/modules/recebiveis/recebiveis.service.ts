import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusRecebivel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecebivelDto } from './dto/create-recebivel.dto';
import { UpdateRecebivelDto } from './dto/update-recebivel.dto';
import { calcularValorAbertoAposPagamento, estaQuitado, estaVencido } from './recebivel.rules';

@Injectable()
export class RecebiveisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecebivelDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) {
      throw new NotFoundException('Cliente nao encontrado');
    }

    return this.prisma.recebivel.create({
      data: {
        ...dto,
        valorAberto: dto.valorNominal,
        status: StatusRecebivel.PENDENTE,
      },
    });
  }

  findAll(clienteId?: string, status?: StatusRecebivel) {
    return this.prisma.recebivel.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { dataVencimento: 'asc' },
    });
  }

  async findOne(id: string) {
    const recebivel = await this.prisma.recebivel.findUnique({ where: { id } });
    if (!recebivel) {
      throw new NotFoundException('Recebivel nao encontrado');
    }
    return recebivel;
  }

  async update(id: string, dto: UpdateRecebivelDto) {
    await this.findOne(id);
    return this.prisma.recebivel.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.recebivel.delete({ where: { id } });
  }

  /** Recebivel.estaVencido() exposto como consulta. */
  async verificarVencido(id: string): Promise<boolean> {
    const recebivel = await this.findOne(id);
    return estaVencido(recebivel);
  }

  /** Recebivel.estaQuitado() exposto como consulta. */
  async verificarQuitado(id: string): Promise<boolean> {
    const recebivel = await this.findOne(id);
    return estaQuitado(recebivel);
  }

  /**
   * Recebivel.registrarPagamento(valor): abate valorAberto, nunca deixa negativo,
   * e recalcula o status (QUITADO se zerou, VENCIDO se passou do vencimento, ou mantem).
   */
  async registrarPagamento(id: string, valor: number) {
    const recebivel = await this.findOne(id);

    if (recebivel.status === StatusRecebivel.QUITADO) {
      throw new BadRequestException('Recebivel ja esta quitado');
    }

    let novoValorAberto;
    try {
      novoValorAberto = calcularValorAbertoAposPagamento(recebivel.valorAberto, valor);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const quitado = novoValorAberto.equals(0);
    const novoStatus = quitado
      ? StatusRecebivel.QUITADO
      : estaVencido({ dataVencimento: recebivel.dataVencimento, status: recebivel.status })
        ? StatusRecebivel.VENCIDO
        : recebivel.status;

    return this.prisma.recebivel.update({
      where: { id },
      data: { valorAberto: novoValorAberto, status: novoStatus },
    });
  }
}
