import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StatusRecebivel, TipoDesagio, TipoRecebivel } from '@prisma/client';
import { RecebiveisService } from './recebiveis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { NegociacoesService } from '../negociacoes/negociacoes.service';

describe('RecebiveisService', () => {
  let service: RecebiveisService;
  let prisma: {
    recebivel: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    cliente: { findUnique: jest.Mock };
    itemNegociacaoRecebivel: { findFirst: jest.Mock };
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
      recebivel: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      cliente: { findUnique: jest.fn() },
      itemNegociacaoRecebivel: { findFirst: jest.fn() },
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

  describe('create', () => {
    // dataEmissao -> dataVencimento = 30 dias exatos (DUPLICATA usa dataVencimento).
    const dtoBase = {
      tipo: TipoRecebivel.DUPLICATA,
      clienteId: 'c1',
      valorNominal: 1000,
      dataEmissao: new Date('2026-01-01'),
      dataVencimento: new Date('2026-01-31'),
      taxaDesagio: 0.03,
    };

    it('lanca NotFoundException se o cliente nao existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...dtoBase, tipoDesagio: TipoDesagio.SIMPLES } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('calcula quantidadeDias (DUPLICATA = dataVencimento - dataEmissao) e valorDesagio/valorLiquido (SIMPLES), usa valorNominal como valorAberto inicial', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.recebivel.create.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.create({ ...dtoBase, tipoDesagio: TipoDesagio.SIMPLES } as any);

      expect(resultado.quantidadeDias).toBe(30);
      expect(resultado.valorAberto).toBe(1000);
      // 1000 * 0.03 * 30 / 30 = 30 ; liquido = 970
      expect((resultado.valorDesagio as Prisma.Decimal).toNumber()).toBeCloseTo(30, 2);
      expect((resultado.valorLiquido as Prisma.Decimal).toNumber()).toBeCloseTo(970, 2);
    });

    it('CHEQUE calcula quantidadeDias a partir de dataBomPara, ignorando dataVencimento', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.recebivel.create.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.create({
        ...dtoBase,
        tipo: TipoRecebivel.CHEQUE,
        dataVencimento: new Date('2026-12-01'), // nao deve ser usada no calculo
        dataBomPara: new Date('2026-01-31'), // dataEmissao + 30 dias
        tipoDesagio: TipoDesagio.SIMPLES,
      } as any);

      expect(resultado.quantidadeDias).toBe(30);
    });

    it('calcula valorDesagio/valorLiquido (COMPOSTO)', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.recebivel.create.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.create({ ...dtoBase, tipoDesagio: TipoDesagio.COMPOSTO } as any);

      // 1000 / 1.03^1
      expect((resultado.valorLiquido as Prisma.Decimal).toNumber()).toBeCloseTo(970.873786, 6);
    });
  });

  describe('update', () => {
    // dataEmissao -> dataVencimento = 30 dias exatos (DUPLICATA usa dataVencimento).
    const recebivelExistente = {
      id: 'r1',
      tipo: TipoRecebivel.DUPLICATA,
      valorNominal: new Prisma.Decimal(1000),
      taxaDesagio: new Prisma.Decimal(0.03),
      dataEmissao: new Date('2026-01-01'),
      dataBomPara: null,
      dataVencimento: new Date('2026-01-31'),
      quantidadeDias: 30,
      tipoDesagio: TipoDesagio.SIMPLES,
    };

    it('nao consulta vinculo com negociacao se nenhum campo de desagio mudou', async () => {
      prisma.recebivel.findUnique.mockResolvedValue(recebivelExistente);
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      await service.update('r1', { banco: 'Novo Banco' } as any);

      expect(prisma.itemNegociacaoRecebivel.findFirst).not.toHaveBeenCalled();
      expect(prisma.recebivel.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { banco: 'Novo Banco' },
      });
    });

    it('recalcula valorDesagio/valorLiquido quando taxaDesagio muda (quantidadeDias mantem-se, datas nao mudaram)', async () => {
      prisma.recebivel.findUnique.mockResolvedValue(recebivelExistente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue(null);
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.update('r1', { taxaDesagio: 0.05 } as any);

      expect(resultado.quantidadeDias).toBe(30);
      // 1000 * 0.05 * 30 / 30 = 50 ; liquido = 950
      expect((resultado.valorDesagio as Prisma.Decimal).toNumber()).toBeCloseTo(50, 2);
      expect((resultado.valorLiquido as Prisma.Decimal).toNumber()).toBeCloseTo(950, 2);
    });

    it('recalcula quantidadeDias e o desagio quando dataVencimento muda', async () => {
      prisma.recebivel.findUnique.mockResolvedValue(recebivelExistente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue(null);
      prisma.recebivel.update.mockImplementation(({ data }) => Promise.resolve(data));

      const resultado = await service.update('r1', {
        dataVencimento: new Date('2026-02-15'), // dataEmissao + 45 dias
      } as any);

      expect(resultado.quantidadeDias).toBe(45);
      // 1000 * 0.03 * 45 / 30 = 45
      expect((resultado.valorDesagio as Prisma.Decimal).toNumber()).toBeCloseTo(45, 2);
    });

    it('bloqueia alteracao de desagio se o recebivel esta vinculado a negociacao EM_ANALISE/APROVADA', async () => {
      prisma.recebivel.findUnique.mockResolvedValue(recebivelExistente);
      prisma.itemNegociacaoRecebivel.findFirst.mockResolvedValue({ id: 'item-existente' });

      await expect(service.update('r1', { taxaDesagio: 0.05 } as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.recebivel.update).not.toHaveBeenCalled();
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
