import { ApiProperty } from '@nestjs/swagger';

export class ReceitaMensalDto {
  @ApiProperty({ example: '2026-02', description: 'Ano-mes (YYYY-MM) de Negociacao.dataNegociacao' })
  mes: string;

  @ApiProperty({
    example: 12400.0,
    description: 'Soma de ItemNegociacaoRecebivel.valorDesagio das negociacoes do mes',
  })
  desagio: number;

  @ApiProperty({ example: 1800.0, description: 'Soma de Negociacao.valorTarifas das negociacoes do mes' })
  tarifas: number;
}
