import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StatusNegociacao, StatusRecebivel } from '@prisma/client';
import { NegociacoesService } from './negociacoes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NegociacoesService', () => {
  let service: NegociacoesService;
  let prisma: any;

  const negociacaoEmAnalise = {
    id: 'n1',
    clienteId: 'c1',
    status: StatusNegociacao.EM_ANALISE,
    valorTarifas: new Prisma.Decimal(0),
    valorPago: new Prisma.Decimal(0),
    valorLiquido: new Prisma.Decimal(0),
    saldoNegociacao: new Prisma.Decimal(0),
    itensRecebivel: [],
    itensEmprestimo: [],
  };

  const recebivelDoCliente = {
    id: 'r1',
    clienteId: 'c1',
    valorAberto: new Prisma.Decimal(1000),
  };

  beforeEach(async () => {
    prisma = {
      cliente: { findUnique: jest.fn() },
      negociacao: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      recebivel: { findUnique: jest.fn(), update: jest.fn() },
      emprestimo: { findUnique: jest.fn() },
      itemNegociacaoRecebivel: { findFirst: jest.fn(), create: jest.fn() },
      itemNegociacaoEmprestimo: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((callback: (tx: any) => any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NegociacoesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(NegociacoesService);
  });

  describe('adicionarRecebivel', () => {
    it('lanca NotFoundException se a negociacao nao existe', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(null);
      await expect(
        service.adicionarRecebivel('n1', { recebivelId: 'r1', quantidadeDias: 30, taxaDesagio: 0.03 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanca ConflictException se a negociacao nao esta EM_ANALISE', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        status: StatusNegociacao.FINALIZADA,
      });

      await expect(
        service.adicionarRecebivel('n1', { recebivelId: 'r1', quantidadeDias: 30, taxaDesagio: 0.03 }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanca ConflictException se o recebivel nao pertence ao cliente da negociacao', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue({ ...recebivelDoCliente, clienteId: 'outro' });

      await expect(
        service.adicionarRecebivel('n1', { recebivelId: 'r1', quantidadeDias: 30, taxaDesagio: 0.03 }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoRecebivel.create).not.toHaveBeenCalled();
    });

    it('lanca ConflictException se o recebivel ja esta preso a outra negociacao ativa', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue(recebivelDoCliente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue({ id: 'item-existente' });

      await expect(
        service.adicionarRecebivel('n1', { recebivelId: 'r1', quantidadeDias: 30, taxaDesagio: 0.03 }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoRecebivel.create).not.toHaveBeenCalled();
    });

    it('cria o item com desagio/liquido calculados e marca o recebivel como NEGOCIADO', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue(recebivelDoCliente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue(null);
      prisma.itemNegociacaoRecebivel.create.mockResolvedValue({});
      prisma.recebivel.update.mockResolvedValue({});
      prisma.negociacao.findUniqueOrThrow.mockResolvedValue({
        ...negociacaoEmAnalise,
        itensRecebivel: [{ valorConsiderado: 1000, valorDesagio: 30 }],
      });
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      await service.adicionarRecebivel('n1', {
        recebivelId: 'r1',
        quantidadeDias: 30,
        taxaDesagio: 0.03,
      });

      const itemCriado = prisma.itemNegociacaoRecebivel.create.mock.calls[0][0].data;
      expect(itemCriado.valorDesagio.toNumber()).toBeCloseTo(30, 2);
      expect(itemCriado.valorLiquido.toNumber()).toBeCloseTo(970, 2);

      expect(prisma.recebivel.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: StatusRecebivel.NEGOCIADO },
      });
    });
  });

  describe('finalizar', () => {
    it('lanca ConflictException se o saldo nao esta zerado', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        saldoNegociacao: new Prisma.Decimal(50),
      });

      await expect(service.finalizar('n1')).rejects.toThrow(ConflictException);
      expect(prisma.negociacao.update).not.toHaveBeenCalled();
    });

    it('finaliza a negociacao quando o saldo esta zerado', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        saldoNegociacao: new Prisma.Decimal(0),
      });
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      const resultado = await service.finalizar('n1');
      expect(resultado.status).toBe(StatusNegociacao.FINALIZADA);
    });
  });

  describe('registrarPagamento', () => {
    it('lanca BadRequestException quando o valor pago excede o saldo', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        valorLiquido: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
      });

      await expect(service.registrarPagamento('n1', 150)).rejects.toThrow(BadRequestException);
    });

    it('abate o valor pago e recalcula o saldo', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        valorLiquido: new Prisma.Decimal(100),
        valorPago: new Prisma.Decimal(0),
      });
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      const resultado = await service.registrarPagamento('n1', 100);
      expect(resultado.saldoNegociacao.toNumber()).toBe(0);
    });
  });
});
