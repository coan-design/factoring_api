import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PerfilUsuario } from '@prisma/client';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsuariosService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsuariosService);
  });

  describe('findAll', () => {
    it('pagina os usuarios e devolve o envelope {data, total, page, pageSize}', async () => {
      prisma.usuario.findMany.mockResolvedValue([]);
      prisma.usuario.count.mockResolvedValue(0);

      const resultado = await service.findAll({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20,
      } as any);

      expect(prisma.usuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(resultado).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('create', () => {
    it('rejeita criacao quando ja existe usuario com o mesmo email', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });

      await expect(
        service.create({
          nome: 'Ana',
          email: 'a@a.com',
          senha: '123456',
          perfil: PerfilUsuario.ADMIN,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('armazena a senha como hash, nunca em texto plano', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: '1', ...data }),
      );

      await service.create({
        nome: 'Ana',
        email: 'a@a.com',
        senha: '123456',
        perfil: PerfilUsuario.ADMIN,
      });

      const dataPersistida = prisma.usuario.create.mock.calls[0][0].data;
      expect(dataPersistida.senhaHash).toBeDefined();
      expect(dataPersistida.senhaHash).not.toBe('123456');
    });
  });

  describe('autenticar', () => {
    it('retorna true quando a senha corresponde ao hash', async () => {
      const senhaHash = await bcrypt.hash('minhaSenha', 10);
      await expect(service.autenticar('minhaSenha', senhaHash)).resolves.toBe(true);
    });

    it('retorna false quando a senha nao corresponde ao hash', async () => {
      const senhaHash = await bcrypt.hash('minhaSenha', 10);
      await expect(service.autenticar('senhaErrada', senhaHash)).resolves.toBe(false);
    });
  });
});
