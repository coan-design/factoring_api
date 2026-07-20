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
    };
    negociacao: {
      findFirst: jest.Mock;
    };
  };

  const clienteAtivo = { id: 'c1', nome: 'Cliente 1', status: StatusCliente.ATIVO };
  const clienteInativo = { id: 'c1', nome: 'Cliente 1', status: StatusCliente.INATIVO };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      negociacao: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClientesService);
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
