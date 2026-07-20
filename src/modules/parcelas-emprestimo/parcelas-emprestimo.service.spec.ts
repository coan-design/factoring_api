import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StatusParcela } from '@prisma/client';
import { ParcelasEmprestimoService } from './parcelas-emprestimo.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ParcelasEmprestimoService', () => {
  let service: ParcelasEmprestimoService;
  let prisma: { parcelaEmprestimo: { findUnique: jest.Mock; update: jest.Mock } };

  const diasNoFuturo = (dias: number) => {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data;
  };

  beforeEach(async () => {
    prisma = { parcelaEmprestimo: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ParcelasEmprestimoService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ParcelasEmprestimoService);
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
  });
});
