import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusRecebivel, TipoRecebivel } from '@prisma/client';
import { RecebiveisService } from './recebiveis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NegociacoesService } from '../negociacoes/negociacoes.service';

describe('RecebiveisService', () => {
  let service: RecebiveisService;
  let prisma: {
    recebivel: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    cliente: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let negociacoesService: { recalcularPorRecebivel: jest.Mock };
  let storageService: { upload: jest.Mock };

  const diasNoFuturo = (dias: number) => {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data;
  };

  beforeEach(async () => {
    prisma = {
      recebivel: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      cliente: { findUnique: jest.fn() },
      $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
    };
    negociacoesService = { recalcularPorRecebivel: jest.fn() };
    storageService = { upload: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecebiveisService,
        { provide: PrismaService, useValue: prisma },
        { provide: NegociacoesService, useValue: negociacoesService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get(RecebiveisService);
  });

  describe('findAll', () => {
    it('monta o filtro de intervalo de dataVencimento e o envelope paginado', async () => {
      prisma.recebivel.findMany.mockResolvedValue([]);
      prisma.recebivel.count.mockResolvedValue(0);

      const resultado = await service.findAll({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
        tipo: TipoRecebivel.CHEQUE,
        dataVencimentoInicio: '2026-01-01',
        dataVencimentoFim: '2026-01-31',
      } as any);

      expect(prisma.recebivel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tipo: TipoRecebivel.CHEQUE,
            dataVencimento: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          },
        }),
      );
      expect(resultado).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('registrarPagamento', () => {
    it('lanca NotFoundException se o recebivel nao existe', async () => {
      prisma.recebivel.findUnique.mockResolvedValue(null);
      await expect(service.registrarPagamento('x', 10)).rejects.toThrow(NotFoundException);
    });

    it('lanca BadRequestException se o recebivel ja esta quitado', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        status: StatusRecebivel.QUITADO,
        valorAberto: 0,
        dataVencimento: diasNoFuturo(10),
      });

      await expect(service.registrarPagamento('r1', 10)).rejects.toThrow(BadRequestException);
    });

    it('lanca BadRequestException se o valor pago exceder o valor em aberto', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        tipo: TipoRecebivel.DUPLICATA,
        status: StatusRecebivel.PENDENTE,
        valorAberto: 100,
        dataVencimento: diasNoFuturo(10),
      });

      await expect(service.registrarPagamento('r1', 150)).rejects.toThrow(BadRequestException);
      expect(prisma.recebivel.update).not.toHaveBeenCalled();
    });

    it('atualiza o status para QUITADO quando o pagamento zera o valorAberto', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        tipo: TipoRecebivel.DUPLICATA,
        status: StatusRecebivel.PENDENTE,
        valorAberto: 100,
        dataVencimento: diasNoFuturo(10),
      });
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('r1', 100);

      expect(prisma.recebivel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ status: StatusRecebivel.QUITADO }),
        }),
      );
      expect(resultado.status).toBe(StatusRecebivel.QUITADO);
    });

    it('aciona o recalculo dos totais da negociacao vinculada apos o pagamento', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        tipo: TipoRecebivel.DUPLICATA,
        status: StatusRecebivel.NEGOCIADO,
        valorAberto: 100,
        dataVencimento: diasNoFuturo(10),
      });
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      await service.registrarPagamento('r1', 40);

      expect(negociacoesService.recalcularPorRecebivel).toHaveBeenCalledWith('r1');
    });

    it('mantem o status quando o pagamento e parcial e o titulo nao esta vencido', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        tipo: TipoRecebivel.DUPLICATA,
        status: StatusRecebivel.PENDENTE,
        valorAberto: 100,
        dataVencimento: diasNoFuturo(10),
      });
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('r1', 40);

      expect(resultado.status).toBe(StatusRecebivel.PENDENTE);
    });

    it('atualiza o status para VENCIDO quando o pagamento e parcial e a data ja passou', async () => {
      prisma.recebivel.findUnique.mockResolvedValue({
        id: 'r1',
        tipo: TipoRecebivel.DUPLICATA,
        status: StatusRecebivel.PENDENTE,
        valorAberto: 100,
        dataVencimento: diasNoFuturo(-5),
      });
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('r1', 40);

      expect(resultado.status).toBe(StatusRecebivel.VENCIDO);
    });
  });
});
