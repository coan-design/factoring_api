import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/authenticated-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  /** Fluxo de login: localiza o usuario e delega a validacao de senha (Usuario.autenticar). */
  async login(dto: LoginDto) {
    const usuario = await this.usuariosService.findByEmailComSenha(dto.email);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const senhaValida = await this.usuariosService.autenticar(dto.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const payload: JwtPayload = { sub: usuario.id, email: usuario.email, perfil: usuario.perfil };

    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    };
  }
}
