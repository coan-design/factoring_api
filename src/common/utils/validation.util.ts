import { ValidationError } from '@nestjs/common';

export interface ErroDeCampo {
  field: string;
  message: string;
}

/**
 * Achata a arvore de ValidationError do class-validator (incluindo DTOs aninhados via
 * `children`) num array plano de { field, message }, um item por constraint violada --
 * usado pelo exceptionFactory do ValidationPipe global para o formato de erro estruturado.
 */
export function flattenValidationErrors(errors: ValidationError[], prefixo = ''): ErroDeCampo[] {
  return errors.flatMap((erro) => {
    const campo = prefixo ? `${prefixo}.${erro.property}` : erro.property;

    const doProprioCampo = erro.constraints
      ? Object.values(erro.constraints).map((message) => ({ field: campo, message }))
      : [];

    const dosFilhos = erro.children?.length
      ? flattenValidationErrors(erro.children, campo)
      : [];

    return [...doProprioCampo, ...dosFilhos];
  });
}
