import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TipoJuros } from '@prisma/client';
import { EmprestimosService } from './emprestimos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

describe('EmprestimosService', () => {
  let service: EmprestimosService;
  let prisma: {
    emprestimo: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    parcelaEmprestimo: { findFirst: jest.Mock; createMany: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    $transaction: jest.Mock;
  };
  let storageService: { upload: jest.Mock };

  const emprestimo = {
    id: 'e1',
    clienteId: 'c1',
    valorEmprestado: new Prisma.Decimal(1000),
    tipoJuros: TipoJuros.SIMPLES,
    taxaJuros: new Prisma.Decimal(0.01),
    quantidadeParcelas: 10,
    dataContratacao: new Date('2026-01-10'),
  };

  beforeEach(async () => {
    prisma = {
      emprestimo: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      parcelaEmprestimo: {
        findFirst: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
    };
    storageService = { upload: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmprestimosService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get(EmprestimosService);
  });

  describe('findAll', () => {
    it('filtra por comSaldoDevedor=true (pelo menos uma parcela nao paga)', async () => {
      prisma.emprestimo.findMany.mockResolvedValue([]);
      prisma.emprestimo.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
        comSaldoDevedor: true,
      } as any);

      expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parcelas: { some: { status: { not: 'PAGA' } } } },
        }),
      );
    });

    it('filtra por comSaldoDevedor=false (todas as parcelas pagas, e pelo menos uma existe)', async () => {
      prisma.emprestimo.findMany.mockResolvedValue([]);
      prisma.emprestimo.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
        comSaldoDevedor: false,
      } as any);

      expect(prisma.emprestimo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ parcelas: { some: {} } }, { parcelas: { every: { status: 'PAGA' } } }],
          },
        }),
      );
    });
  });

  describe('gerarParcelas', () => {
    it('lanca NotFoundException se o emprestimo nao existe', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(null);
      await expect(service.gerarParcelas('inexistente')).rejects.toThrow(NotFoundException);
    });

    it('lanca ConflictException se as parcelas ja foram geradas (idempotencia)', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.findFirst.mockResolvedValue({ id: 'p1' });

      await expect(service.gerarParcelas('e1')).rejects.toThrow(ConflictException);
      expect(prisma.parcelaEmprestimo.createMany).not.toHaveBeenCalled();
    });

    it('cria exatamente quantidadeParcelas parcelas com valor calculado', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.findFirst.mockResolvedValue(null);
      prisma.parcelaEmprestimo.createMany.mockResolvedValue({ count: 10 });
      prisma.parcelaEmprestimo.findMany.mockResolvedValue([]);

      await service.gerarParcelas('e1');

      const parcelasCriadas = prisma.parcelaEmprestimo.createMany.mock.calls[0][0].data;
      expect(parcelasCriadas).toHaveLength(10);
      expect(parcelasCriadas[0].numero).toBe(1);
      expect(parcelasCriadas[9].numero).toBe(10);
      parcelasCriadas.forEach((parcela: any) => {
        expect(parcela.valor.toNumber()).toBeCloseTo(110, 2);
      });
    });
  });

  describe('calcularValorTotal', () => {
    it('lanca BadRequestException se as parcelas ainda nao foram geradas', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.aggregate.mockResolvedValue({ _sum: { valor: null } });

      await expect(service.calcularValorTotal('e1')).rejects.toThrow(BadRequestException);
    });

    it('retorna a soma dos valores das parcelas geradas', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.aggregate.mockResolvedValue({
        _sum: { valor: new Prisma.Decimal(1100) },
      });

      const total = await service.calcularValorTotal('e1');
      expect(total.toNumber()).toBe(1100);
    });
  });

  describe('calcularSaldoDevedor', () => {
    it('lanca BadRequestException se as parcelas ainda nao foram geradas', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.findMany.mockResolvedValue([]);

      await expect(service.calcularSaldoDevedor('e1')).rejects.toThrow(BadRequestException);
    });

    it('soma o que falta pagar apenas das parcelas nao quitadas', async () => {
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimo);
      prisma.parcelaEmprestimo.findMany.mockResolvedValue([
        { valor: new Prisma.Decimal(110), valorPago: new Prisma.Decimal(110) },
        { valor: new Prisma.Decimal(110), valorPago: new Prisma.Decimal(30) },
      ]);

      const saldo = await service.calcularSaldoDevedor('e1');
      expect(saldo.toNumber()).toBe(80);
    });
  });
});
