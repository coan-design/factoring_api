import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StatusParcela } from '@prisma/client';
import { ParcelasEmprestimoService } from './parcelas-emprestimo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NegociacoesService } from '../negociacoes/negociacoes.service';

describe('ParcelasEmprestimoService', () => {
  let service: ParcelasEmprestimoService;
  let prisma: {
    parcelaEmprestimo: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let negociacoesService: { recalcularPorEmprestimo: jest.Mock };

  const diasNoFuturo = (dias: number) => {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data;
  };

  beforeEach(async () => {
    prisma = {
      parcelaEmprestimo: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
    };
    negociacoesService = { recalcularPorEmprestimo: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParcelasEmprestimoService,
        { provide: PrismaService, useValue: prisma },
        { provide: NegociacoesService, useValue: negociacoesService },
      ],
    }).compile();

    service = module.get(ParcelasEmprestimoService);
  });

  describe('findAllByEmprestimo', () => {
    it('filtra por emprestimoId e devolve o envelope paginado', async () => {
      prisma.parcelaEmprestimo.findMany.mockResolvedValue([]);
      prisma.parcelaEmprestimo.count.mockResolvedValue(0);

      const resultado = await service.findAllByEmprestimo({
        emprestimoId: 'e1',
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
      } as any);

      expect(prisma.parcelaEmprestimo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { emprestimoId: 'e1' } }),
      );
      expect(resultado).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('registrarPagamento', () => {
    it('marca a parcela como PAGA quando o pagamento quita o valor total', async () => {
      prisma.parcelaEmprestimo.findUnique.mockResolvedValue({
        id: 'p1',
        valor: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
        dataVencimento: diasNoFuturo(10),
        status: StatusParcela.PENDENTE,
      });
      prisma.parcelaEmprestimo.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('p1', 100);

      expect(resultado.status).toBe(StatusParcela.PAGA);
    });

    it('mantem PENDENTE em pagamento parcial dentro do prazo', async () => {
      prisma.parcelaEmprestimo.findUnique.mockResolvedValue({
        id: 'p1',
        valor: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
        dataVencimento: diasNoFuturo(10),
        status: StatusParcela.PENDENTE,
      });
      prisma.parcelaEmprestimo.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('p1', 40);

      expect(resultado.status).toBe(StatusParcela.PENDENTE);
    });

    it('marca como ATRASADA em pagamento parcial apos o vencimento', async () => {
      prisma.parcelaEmprestimo.findUnique.mockResolvedValue({
        id: 'p1',
        valor: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
        dataVencimento: diasNoFuturo(-5),
        status: StatusParcela.PENDENTE,
      });
      prisma.parcelaEmprestimo.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('p1', 40);

      expect(resultado.status).toBe(StatusParcela.ATRASADA);
    });

    it('acumula pagamentos parciais ate quitar a parcela', async () => {
      prisma.parcelaEmprestimo.findUnique.mockResolvedValue({
        id: 'p1',
        valor: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(60),
        dataVencimento: diasNoFuturo(10),
        status: StatusParcela.PENDENTE,
      });
      prisma.parcelaEmprestimo.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('p1', 40);

      expect(resultado.valorPago.toNumber()).toBe(100);
      expect(resultado.status).toBe(StatusParcela.PAGA);
    });

    it('aciona o recalculo dos totais da negociacao vinculada ao emprestimo desta parcela', async () => {
      prisma.parcelaEmprestimo.findUnique.mockResolvedValue({
        id: 'p1',
        emprestimoId: 'e1',
        valor: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
        dataVencimento: diasNoFuturo(10),
        status: StatusParcela.PENDENTE,
      });
      prisma.parcelaEmprestimo.update.mockImplementation(({ data }) => Promise.resolve(data));

      await service.registrarPagamento('p1', 40);

      expect(negociacoesService.recalcularPorEmprestimo).toHaveBeenCalledWith('e1');
    });
  });
});
