import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatusCliente, StatusNegociacao } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ClientesService', () => {
  let service: ClientesService;
  let prisma: {
    cliente: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    negociacao: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const clienteAtivo = { id: 'c1', nome: 'Cliente 1', status: StatusCliente.ATIVO };
  const clienteInativo = { id: 'c1', nome: 'Cliente 1', status: StatusCliente.INATIVO };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      negociacao: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClientesService);
  });

  describe('findAll', () => {
    it('retorna o envelope paginado com data/total/page/pageSize', async () => {
      prisma.cliente.findMany.mockResolvedValue([clienteAtivo]);
      prisma.cliente.count.mockResolvedValue(1);

      const resultado = await service.findAll({ page: 2, pageSize: 10, skip: 10, take: 10 } as any);

      expect(resultado).toEqual({ data: [clienteAtivo], total: 1, page: 2, pageSize: 10 });
      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('monta o filtro OR de busca textual por nome/cpfCnpj', async () => {
      prisma.cliente.findMany.mockResolvedValue([]);
      prisma.cliente.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 20, skip: 0, take: 20, busca: 'joao' } as any);

      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { nome: { contains: 'joao', mode: 'insensitive' } },
              { cpfCnpj: { contains: 'joao', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('combina filtro de status e tipoCliente', async () => {
      prisma.cliente.findMany.mockResolvedValue([]);
      prisma.cliente.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
        status: StatusCliente.ATIVO,
        tipoCliente: 'PESSOA_JURIDICA',
      } as any);

      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: StatusCliente.ATIVO, tipoCliente: 'PESSOA_JURIDICA' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('lanca NotFoundException quando o cliente nao existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(service.findOne('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('ativar', () => {
    it('lanca ConflictException se o cliente ja esta ativo', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteAtivo);
      await expect(service.ativar('c1')).rejects.toThrow(ConflictException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('ativa um cliente inativo', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteInativo);
      prisma.cliente.update.mockResolvedValue({ ...clienteInativo, status: StatusCliente.ATIVO });

      const resultado = await service.ativar('c1');

      expect(prisma.cliente.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: StatusCliente.ATIVO } }),
      );
      expect(resultado.status).toBe(StatusCliente.ATIVO);
    });
  });

  describe('inativar', () => {
    it('lanca ConflictException se o cliente ja esta inativo', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteInativo);
      await expect(service.inativar('c1')).rejects.toThrow(ConflictException);
    });

    it('lanca ConflictException quando ha negociacao em aberto (EM_ANALISE)', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteAtivo);
      prisma.negociacao.findFirst.mockResolvedValue({
        id: 'n1',
        status: StatusNegociacao.EM_ANALISE,
      });

      await expect(service.inativar('c1')).rejects.toThrow(ConflictException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('inativa o cliente quando nao ha negociacoes em aberto', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteAtivo);
      prisma.negociacao.findFirst.mockResolvedValue(null);
      prisma.cliente.update.mockResolvedValue({
        ...clienteAtivo,
        status: StatusCliente.INATIVO,
      });

      const resultado = await service.inativar('c1');

      expect(prisma.negociacao.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clienteId: 'c1',
            status: { in: [StatusNegociacao.EM_ANALISE, StatusNegociacao.APROVADA] },
          },
        }),
      );
      expect(resultado.status).toBe(StatusCliente.INATIVO);
    });
  });
});
