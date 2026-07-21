import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusCliente } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUS_NEGOCIACAO_ABERTOS } from '../../common/constants/negociacao.constants';
import { montarRespostaPaginada } from '../../common/utils/pagination.util';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FindAllClientesQueryDto } from './dto/find-all-clientes-query.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClienteDto) {
    const existente = await this.prisma.cliente.findUnique({ where: { cpfCnpj: dto.cpfCnpj } });
    if (existente) {
      throw new ConflictException('Ja existe um cliente cadastrado com este CPF/CNPJ');
    }

    return this.prisma.cliente.create({
      data: { ...dto, status: StatusCliente.ATIVO },
      include: { endereco: true },
    });
  }

  async findAll(query: FindAllClientesQueryDto) {
    const where: Prisma.ClienteWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.tipoCliente ? { tipoCliente: query.tipoCliente } : {}),
      ...(query.busca
        ? {
            OR: [
              { nome: { contains: query.busca, mode: 'insensitive' } },
              { cpfCnpj: { contains: query.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        include: { endereco: true },
        orderBy: { nome: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return montarRespostaPaginada(data, total, query);
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { endereco: true },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente nao encontrado');
    }
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);
    return this.prisma.cliente.update({
      where: { id },
      data: dto,
      include: { endereco: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.cliente.delete({ where: { id } });
  }

  /** Cliente.ativar(): so faz sentido transicionar um cliente INATIVO para ATIVO. */
  async ativar(id: string) {
    const cliente = await this.findOne(id);
    if (cliente.status === StatusCliente.ATIVO) {
      throw new ConflictException('Cliente ja esta ativo');
    }
    return this.prisma.cliente.update({
      where: { id },
      data: { status: StatusCliente.ATIVO },
      include: { endereco: true },
    });
  }

  /**
   * Cliente.inativar(): so permite inativar se nao houver negociacoes em aberto
   * (EM_ANALISE ou APROVADA) vinculadas ao cliente.
   */
  async inativar(id: string) {
    const cliente = await this.findOne(id);
    if (cliente.status === StatusCliente.INATIVO) {
      throw new ConflictException('Cliente ja esta inativo');
    }

    const negociacaoAberta = await this.prisma.negociacao.findFirst({
      where: { clienteId: id, status: { in: STATUS_NEGOCIACAO_ABERTOS } },
    });
    if (negociacaoAberta) {
      throw new ConflictException(
        'Nao e possivel inativar o cliente: existem negociacoes em aberto',
      );
    }

    return this.prisma.cliente.update({
      where: { id },
      data: { status: StatusCliente.INATIVO },
      include: { endereco: true },
    });
  }
}
