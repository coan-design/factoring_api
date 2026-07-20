import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PerfilUsuario } from '@prisma/client';
import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: {
    findByEmailComSenha: jest.Mock;
    autenticar: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };

  const usuarioAtivo = {
    id: 'u1',
    nome: 'Ana',
    email: 'ana@factoring.com',
    senhaHash: 'hash',
    perfil: PerfilUsuario.ADMIN,
    ativo: true,
  };

  beforeEach(async () => {
    usuariosService = {
      findByEmailComSenha: jest.fn(),
      autenticar: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('token-jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('rejeita login quando o usuario nao existe', async () => {
    usuariosService.findByEmailComSenha.mockResolvedValue(null);

    await expect(service.login({ email: 'x@x.com', senha: '123456' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita login quando o usuario esta inativo', async () => {
    usuariosService.findByEmailComSenha.mockResolvedValue({ ...usuarioAtivo, ativo: false });

    await expect(
      service.login({ email: usuarioAtivo.email, senha: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita login quando a senha e invalida', async () => {
    usuariosService.findByEmailComSenha.mockResolvedValue(usuarioAtivo);
    usuariosService.autenticar.mockResolvedValue(false);

    await expect(
      service.login({ email: usuarioAtivo.email, senha: 'errada' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('retorna access token e dados do usuario quando as credenciais sao validas', async () => {
    usuariosService.findByEmailComSenha.mockResolvedValue(usuarioAtivo);
    usuariosService.autenticar.mockResolvedValue(true);

    const resultado = await service.login({ email: usuarioAtivo.email, senha: '123456' });

    expect(resultado.accessToken).toBe('token-jwt');
    expect(resultado.usuario).toEqual({
      id: usuarioAtivo.id,
      nome: usuarioAtivo.nome,
      email: usuarioAtivo.email,
      perfil: usuarioAtivo.perfil,
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: usuarioAtivo.id,
      email: usuarioAtivo.email,
      perfil: usuarioAtivo.perfil,
    });
  });
});
