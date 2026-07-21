import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StatusParcela, StatusRecebivel } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    recebivel: { aggregate: jest.Mock; groupBy: jest.Mock };
    negociacao: { aggregate: jest.Mock };
    emprestimo: { count: jest.Mock };
    parcelaEmprestimo: { aggregate: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      recebivel: { aggregate: jest.fn(), groupBy: jest.fn() },
      negociacao: { aggregate: jest.fn() },
      emprestimo: { count: jest.fn() },
      parcelaEmprestimo: { aggregate: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getIndicadores', () => {
    it('monta os 4 indicadores, reaproveitando a mesma agregacao de negociacao para saldoTotalAReceber e negociacoesEmAberto', async () => {
      prisma.recebivel.aggregate.mockResolvedValue({
        _sum: { valorAberto: new Prisma.Decimal(43180) },
        _count: { _all: 18 },
      });
      prisma.negociacao.aggregate.mockResolvedValue({
        _sum: { valorAReceber: new Prisma.Decimal(315200) },
        _count: { _all: 7 },
      });
      prisma.emprestimo.count.mockResolvedValue(12);
      prisma.parcelaEmprestimo.aggregate.mockResolvedValue({
        _sum: { valor: new Prisma.Decimal(900000), valorPago: new Prisma.Decimal(260000) },
      });

      const resultado = await service.getIndicadores();

      expect(resultado).toEqual({
        recebiveisVencidos: { valor: 43180, quantidade: 18 },
        saldoTotalAReceber: { valor: 315200 },
        emprestimosAtivos: { quantidade: 12, valor: 640000 },
        negociacoesEmAberto: { quantidade: 7, valor: 315200 },
      });

      // filtro de recebivel vencido usa a regra viva (data < hoje AND status != QUITADO), nao status = VENCIDO
      const whereRecebivel = prisma.recebivel.aggregate.mock.calls[0][0].where;
      expect(whereRecebivel.status).toEqual({ not: StatusRecebivel.QUITADO });
      expect(whereRecebivel.dataVencimento.lt).toBeInstanceOf(Date);

      const whereParcela = prisma.parcelaEmprestimo.aggregate.mock.calls[0][0].where;
      expect(whereParcela.status).toEqual({ not: StatusParcela.PAGA });
    });

    it('lida com agregacoes vazias (nenhum registro) sem gerar NaN', async () => {
      prisma.recebivel.aggregate.mockResolvedValue({ _sum: { valorAberto: null }, _count: { _all: 0 } });
      prisma.negociacao.aggregate.mockResolvedValue({ _sum: { valorAReceber: null }, _count: { _all: 0 } });
      prisma.emprestimo.count.mockResolvedValue(0);
      prisma.parcelaEmprestimo.aggregate.mockResolvedValue({ _sum: { valor: null, valorPago: null } });

      const resultado = await service.getIndicadores();

      expect(resultado).toEqual({
        recebiveisVencidos: { valor: 0, quantidade: 0 },
        saldoTotalAReceber: { valor: 0 },
        emprestimosAtivos: { quantidade: 0, valor: 0 },
        negociacoesEmAberto: { quantidade: 0, valor: 0 },
      });
    });
  });

  describe('getRecebiveisPorStatus', () => {
    it('reproduz o exemplo do contrato a partir do groupBy do Prisma', async () => {
      prisma.recebivel.groupBy.mockResolvedValue([
        { status: StatusRecebivel.PENDENTE, _count: { _all: 145 } },
        { status: StatusRecebivel.VENCIDO, _count: { _all: 30 } },
        { status: StatusRecebivel.QUITADO, _count: { _all: 60 } },
        { status: StatusRecebivel.INADIMPLENTE, _count: { _all: 15 } },
      ]);

      const resultado = await service.getRecebiveisPorStatus();

      expect(resultado).toEqual([
        { status: StatusRecebivel.PENDENTE, quantidade: 145, percentual: 58 },
        { status: StatusRecebivel.VENCIDO, quantidade: 30, percentual: 12 },
        { status: StatusRecebivel.QUITADO, quantidade: 60, percentual: 24 },
        { status: StatusRecebivel.INADIMPLENTE, quantidade: 15, percentual: 6 },
      ]);
    });

    it('retorna array vazio quando nenhum recebivel existe (nenhum status usado ainda)', async () => {
      prisma.recebivel.groupBy.mockResolvedValue([]);
      expect(await service.getRecebiveisPorStatus()).toEqual([]);
    });

    it('um unico status presente fecha em 100%', async () => {
      prisma.recebivel.groupBy.mockResolvedValue([
        { status: StatusRecebivel.PENDENTE, _count: { _all: 5 } },
      ]);
      expect(await service.getRecebiveisPorStatus()).toEqual([
        { status: StatusRecebivel.PENDENTE, quantidade: 5, percentual: 100 },
      ]);
    });
  });

  describe('getReceitaMensal', () => {
    it('combina desagio e tarifas por mes e zera meses sem negociacao', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { mes: '2026-06', total: '21300.00' },
          { mes: '2026-07', total: '17600.00' },
        ])
        .mockResolvedValueOnce([{ mes: '2026-07', total: '2200.00' }]);

      const resultado = await service.getReceitaMensal(3, new Date(2026, 6, 21));

      expect(resultado).toEqual([
        { mes: '2026-05', desagio: 0, tarifas: 0 },
        { mes: '2026-06', desagio: 21300, tarifas: 0 },
        { mes: '2026-07', desagio: 17600, tarifas: 2200 },
      ]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('retorna a serie inteira zerada quando nao ha nenhuma negociacao no periodo', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const resultado = await service.getReceitaMensal(2, new Date(2026, 6, 21));

      expect(resultado.every((linha) => linha.desagio === 0 && linha.tarifas === 0)).toBe(true);
      expect(resultado).toHaveLength(2);
    });
  });
});
