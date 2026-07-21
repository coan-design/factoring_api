import { ApiProperty } from '@nestjs/swagger';

export class RecebiveisVencidosDto {
  @ApiProperty({ example: 43180.0, description: 'Soma de valorAberto dos recebiveis vencidos' })
  valor: number;

  @ApiProperty({ example: 18, description: 'Quantidade de recebiveis vencidos' })
  quantidade: number;
}

export class SaldoTotalAReceberDto {
  @ApiProperty({
    example: 2918450.0,
    description: 'Soma de Negociacao.valorAReceber para negociacoes EM_ANALISE ou APROVADA',
  })
  valor: number;
}

export class EmprestimosAtivosDto {
  @ApiProperty({ example: 12, description: 'Quantidade de emprestimos com saldo devedor > 0' })
  quantidade: number;

  @ApiProperty({ example: 640000.0 })
  valor: number;
}

export class NegociacoesEmAbertoDto {
  @ApiProperty({ example: 7, description: 'Quantidade de negociacoes EM_ANALISE ou APROVADA' })
  quantidade: number;

  @ApiProperty({ example: 315200.0 })
  valor: number;
}

export class IndicadoresDashboardDto {
  @ApiProperty({ type: RecebiveisVencidosDto })
  recebiveisVencidos: RecebiveisVencidosDto;

  @ApiProperty({ type: SaldoTotalAReceberDto })
  saldoTotalAReceber: SaldoTotalAReceberDto;

  @ApiProperty({ type: EmprestimosAtivosDto })
  emprestimosAtivos: EmprestimosAtivosDto;

  @ApiProperty({ type: NegociacoesEmAbertoDto })
  negociacoesEmAberto: NegociacoesEmAbertoDto;
}
