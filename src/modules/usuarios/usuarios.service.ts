import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const SALT_ROUNDS = 10;

/** Campos seguros para retorno em API (nunca inclui senhaHash). */
const SAFE_SELECT = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Ja existe um usuario com este email');
    }

    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);

    return this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        perfil: dto.perfil,
        ativo: dto.ativo ?? true,
      },
      select: SAFE_SELECT,
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({ select: SAFE_SELECT, orderBy: { nome: 'asc' } });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!usuario) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    return usuario;
  }

  /** Uso interno do AuthService: precisa do hash para validar a senha. */
  findByEmailComSenha(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = { ...dto };
    if (dto.senha) {
      data.senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
      delete data.senha;
    }

    return this.prisma.usuario.update({ where: { id }, data, select: SAFE_SELECT });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.usuario.delete({ where: { id } });
  }

  /** Implementa Usuario.autenticar(senha): compara a senha informada com o hash armazenado. */
  async autenticar(senha: string, senhaHash: string): Promise<boolean> {
    return bcrypt.compare(senha, senhaHash);
  }
}
