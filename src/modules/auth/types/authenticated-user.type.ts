import { PerfilUsuario } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  perfil: PerfilUsuario;
}

export interface JwtPayload {
  sub: string;
  email: string;
  perfil: PerfilUsuario;
}
