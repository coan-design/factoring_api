import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
    valorTotalReceber: new Prisma.Decimal(0),
    valorAReceber: new Prisma.Decimal(0),
    itensRecebivel: [],
    itensEmprestimo: [],
  };

  const recebivelDoCliente = {
    id: 'r1',
    clienteId: 'c1',
    valorNominal: new Prisma.Decimal(1000),
    valorAberto: new Prisma.Decimal(1000),
  };

  const emprestimoDoClienteComParcelas = {
    id: 'e1',
    clienteId: 'c1',
    valorEmprestado: new Prisma.Decimal(1000),
    parcelas: [{ valor: new Prisma.Decimal(110), valorPago: new Prisma.Decimal(0) }],
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
      itemNegociacaoRecebivel: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      itemNegociacaoEmprestimo: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((callback: (tx: any) => any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NegociacoesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(NegociacoesService);
  });

  describe('adicionarRecebivel', () => {
    const dto = { recebivelId: 'r1', quantidadeDias: 30, taxaDesagio: 0.03 };

    it('lanca NotFoundException se a negociacao nao existe', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(null);
      await expect(service.adicionarRecebivel('n1', dto)).rejects.toThrow(NotFoundException);
    });

    it('lanca ConflictException se a negociacao nao esta EM_ANALISE', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        status: StatusNegociacao.FINALIZADA,
      });

      await expect(service.adicionarRecebivel('n1', dto)).rejects.toThrow(ConflictException);
    });

    it('lanca ConflictException se o recebivel nao pertence ao cliente da negociacao', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue({ ...recebivelDoCliente, clienteId: 'outro' });

      await expect(service.adicionarRecebivel('n1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoRecebivel.create).not.toHaveBeenCalled();
    });

    it('lanca ConflictException se o recebivel ja esta preso a outra negociacao ativa', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue(recebivelDoCliente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue({ id: 'item-existente' });

      await expect(service.adicionarRecebivel('n1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoRecebivel.create).not.toHaveBeenCalled();
    });

    it('usa valorNominal (nao valorAberto) como valorConsiderado do item', async () => {
      const recebivelComPagamentoParcial = {
        ...recebivelDoCliente,
        valorNominal: new Prisma.Decimal(1000),
        valorAberto: new Prisma.Decimal(600), // ja recebeu 400 antes da negociacao
      };

      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.recebivel.findUnique.mockResolvedValue(recebivelComPagamentoParcial);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue(null);
      prisma.itemNegociacaoRecebivel.create.mockResolvedValue({});
      prisma.recebivel.update.mockResolvedValue({});
      prisma.negociacao.findUniqueOrThrow.mockResolvedValue(negociacaoEmAnalise);
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      await service.adicionarRecebivel('n1', dto);

      const itemCriado = prisma.itemNegociacaoRecebivel.create.mock.calls[0][0].data;
      expect(itemCriado.valorConsiderado.toNumber()).toBe(1000);
      // desagio = 1000 * 0.03 * 30 / 30 = 30 ; liquido = 970
      expect(itemCriado.valorDesagio.toNumber()).toBeCloseTo(30, 2);
      expect(itemCriado.valorLiquido.toNumber()).toBeCloseTo(970, 2);

      expect(prisma.recebivel.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: StatusRecebivel.NEGOCIADO },
      });
    });
  });

  describe('adicionarEmprestimo', () => {
    const dto = { emprestimoId: 'e1' };

    it('lanca NotFoundException se a negociacao nao existe', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(null);
      await expect(service.adicionarEmprestimo('n1', dto)).rejects.toThrow(NotFoundException);
    });

    it('lanca ConflictException se o emprestimo nao pertence ao cliente da negociacao', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.emprestimo.findUnique.mockResolvedValue({
        ...emprestimoDoClienteComParcelas,
        clienteId: 'outro',
      });

      await expect(service.adicionarEmprestimo('n1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoEmprestimo.create).not.toHaveBeenCalled();
    });

    it('lanca ConflictException se as parcelas do emprestimo ainda nao foram geradas', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.emprestimo.findUnique.mockResolvedValue({
        ...emprestimoDoClienteComParcelas,
        parcelas: [],
      });

      await expect(service.adicionarEmprestimo('n1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoEmprestimo.create).not.toHaveBeenCalled();
    });

    it('lanca ConflictException se o emprestimo ja esta preso a outra negociacao ativa', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimoDoClienteComParcelas);
      prisma.itemNegociacaoEmprestimo.findFirst.mockResolvedValue({ id: 'item-existente' });

      await expect(service.adicionarEmprestimo('n1', dto)).rejects.toThrow(ConflictException);
      expect(prisma.itemNegociacaoEmprestimo.create).not.toHaveBeenCalled();
    });

    it('cria o item de juncao sem valores proprios e recalcula os totais', async () => {
      prisma.negociacao.findUnique.mockResolvedValue(negociacaoEmAnalise);
      prisma.emprestimo.findUnique.mockResolvedValue(emprestimoDoClienteComParcelas);
      prisma.itemNegociacaoEmprestimo.findFirst.mockResolvedValue(null);
      prisma.itemNegociacaoEmprestimo.create.mockResolvedValue({});
      prisma.negociacao.findUniqueOrThrow.mockResolvedValue({
        ...negociacaoEmAnalise,
        itensEmprestimo: [{ emprestimo: emprestimoDoClienteComParcelas }],
      });
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      await service.adicionarEmprestimo('n1', dto);

      expect(prisma.itemNegociacaoEmprestimo.create).toHaveBeenCalledWith({
        data: { negociacaoId: 'n1', emprestimoId: 'e1' },
      });
    });
  });

  describe('finalizar', () => {
    it('lanca ConflictException se valorAReceber nao esta zerado', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        valorAReceber: new Prisma.Decimal(50),
      });

      await expect(service.finalizar('n1')).rejects.toThrow(ConflictException);
      expect(prisma.negociacao.update).not.toHaveBeenCalled();
    });

    it('finaliza a negociacao quando valorAReceber esta zerado', async () => {
      prisma.negociacao.findUnique.mockResolvedValue({
        ...negociacaoEmAnalise,
        valorAReceber: new Prisma.Decimal(0),
      });
      prisma.negociacao.update.mockImplementation(({ data }: any) => Promise.resolve(data));

      const resultado = await service.finalizar('n1');
      expect(resultado.status).toBe(StatusNegociacao.FINALIZADA);
    });
  });

  describe('recalcularPorRecebivel', () => {
    it('recalcula apenas negociacoes abertas (EM_ANALISE/APROVADA) vinculadas ao recebivel', async () => {
      prisma.itemNegociacaoRecebivel.findMany.mockResolvedValue([{ negociacaoId: 'n1' }]);
      prisma.negociacao.findUniqueOrThrow.mockResolvedValue(negociacaoEmAnalise);
      prisma.negociacao.update.mockResolvedValue(negociacaoEmAnalise);

      await service.recalcularPorRecebivel('r1');

      expect(prisma.itemNegociacaoRecebivel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recebivelId: 'r1',
            negociacao: {
              status: { in: [StatusNegociacao.EM_ANALISE, StatusNegociacao.APROVADA] },
            },
          },
        }),
      );
      expect(prisma.negociacao.update).toHaveBeenCalledTimes(1);
    });

    it('nao recalcula nada se o recebivel nao esta em nenhuma negociacao aberta', async () => {
      prisma.itemNegociacaoRecebivel.findMany.mockResolvedValue([]);

      await service.recalcularPorRecebivel('r1');

      expect(prisma.negociacao.update).not.toHaveBeenCalled();
    });
  });
});
