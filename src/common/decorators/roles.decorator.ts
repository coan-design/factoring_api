import { SetMetadata } from '@nestjs/common';
import { PerfilUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe uma rota aos perfis de usuario informados. */
export const Roles = (...roles: PerfilUsuario[]) => SetMetadata(ROLES_KEY, roles);
