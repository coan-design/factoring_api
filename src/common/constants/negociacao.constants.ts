import { StatusNegociacao } from '@prisma/client';

/**
 * Status considerados "negociacao em aberto": ainda consomem/reservam recebiveis e
 * emprestimos do cliente, e impedem a inativacao do cliente.
 * FINALIZADA e CANCELADA sao estados terminais, portanto nao contam como abertos.
 */
export const STATUS_NEGOCIACAO_ABERTOS: StatusNegociacao[] = [
  StatusNegociacao.EM_ANALISE,
  StatusNegociacao.APROVADA,
];

/**
 * Status que "prendem" um recebivel/emprestimo, impedindo seu uso em outra negociacao:
 * qualquer negociacao nao cancelada, inclusive ja FINALIZADA (o titulo foi efetivamente
 * cedido/quitado naquela negociacao). Somente CANCELADA libera o titulo para reuso.
 */
export const STATUS_NEGOCIACAO_BLOQUEIA_REUSO: StatusNegociacao[] = [
  StatusNegociacao.EM_ANALISE,
  StatusNegociacao.APROVADA,
  StatusNegociacao.FINALIZADA,
];
