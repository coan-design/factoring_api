import { ValidationError } from '@nestjs/common';
import { flattenValidationErrors } from './validation.util';

describe('flattenValidationErrors', () => {
  it('produz um item por constraint violada, no formato {field, message}', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: { isEmail: 'email deve ser um e-mail válido' },
      },
      {
        property: 'cpfCnpj',
        constraints: { isNotEmpty: 'cpfCnpj should not be empty' },
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'email', message: 'email deve ser um e-mail válido' },
      { field: 'cpfCnpj', message: 'cpfCnpj should not be empty' },
    ]);
  });

  it('gera um item por constraint quando um campo viola mais de uma regra', () => {
    const errors: ValidationError[] = [
      {
        property: 'senha',
        constraints: {
          minLength: 'senha must be longer than or equal to 6 characters',
          isString: 'senha must be a string',
        },
      },
    ];

    const resultado = flattenValidationErrors(errors);
    expect(resultado).toHaveLength(2);
    expect(resultado.every((erro) => erro.field === 'senha')).toBe(true);
  });

  it('percorre DTOs aninhados via children, prefixando o campo com o caminho completo', () => {
    const errors: ValidationError[] = [
      {
        property: 'endereco',
        children: [
          {
            property: 'cep',
            constraints: { isString: 'cep must be a string' },
          },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'endereco.cep', message: 'cep must be a string' },
    ]);
  });

  it('retorna array vazio quando nao ha erros', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });
});
