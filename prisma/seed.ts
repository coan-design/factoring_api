import {
  PrismaClient,
  Prisma,
  PerfilUsuario,
  TipoCliente,
  StatusCliente,
  TipoRecebivel,
  StatusRecebivel,
  TipoJuros,
  StatusParcela,
  TipoNegociacao,
  StatusNegociacao,
  FormaPagamento,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { calcularValorParcela } from '../src/modules/emprestimos/emprestimo.rules';
import {
  calcularDesagio,
  calcularValorLiquidoItemRecebivel,
  calcularTotaisNegociacao,
} from '../src/modules/negociacoes/negociacao.rules';

const prisma = new PrismaClient();

function adicionarMeses(data: Date, meses: number): Date {
  const resultado = new Date(data);
  resultado.setMonth(resultado.getMonth() + meses);
  return resultado;
}

async function criarUsuarios() {
  const senhaHash = await bcrypt.hash('123456', 10);

  const [admin, operador, analista] = await Promise.all([
    prisma.usuario.upsert({
      where: { email: 'admin@factoring.com' },
      update: {},
      create: {
        nome: 'Administrador',
        email: 'admin@factoring.com',
        senhaHash,
        perfil: PerfilUsuario.ADMIN,
        ativo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { email: 'operador@factoring.com' },
      update: {},
      create: {
        nome: 'Operador de Negociacoes',
        email: 'operador@factoring.com',
        senhaHash,
        perfil: PerfilUsuario.OPERADOR,
        ativo: true,
      },
    }),
    prisma.usuario.upsert({
      where: { email: 'analista@factoring.com' },
      update: {},
      create: {
        nome: 'Analista de Credito',
        email: 'analista@factoring.com',
        senhaHash,
        perfil: PerfilUsuario.ANALISTA,
        ativo: true,
      },
    }),
  ]);

  return { admin, operador, analista };
}

async function criarClienteBase() {
  const endereco = await prisma.endereco.create({
    data: {
      cep: '01310-100',
      logradouro: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      estado: 'SP',
    },
  });

  return prisma.cliente.upsert({
    where: { cpfCnpj: '12345678000199' },
    update: {},
    create: {
      nome: 'Empresa Exemplo Ltda',
      cpfCnpj: '12345678000199',
      tipoCliente: TipoCliente.PESSOA_JURIDICA,
      email: 'contato@empresaexemplo.com',
      telefone: '(11) 99999-0000',
      status: StatusCliente.ATIVO,
      enderecoId: endereco.id,
    },
  });
}

/** Cria um recebivel avulso (nao vinculado a nenhuma negociacao), ja vencido, para os badges. */
async function criarRecebivelVencidoAvulso(clienteId: string) {
  return prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.DUPLICATA,
      clienteId,
      valorNominal: 3000,
      valorAberto: 3000,
      dataEmissao: new Date('2025-11-01'),
      dataVencimento: new Date('2026-01-15'), // no passado em relacao a "hoje" do seed
      status: StatusRecebivel.VENCIDO,
      numeroNotaFiscal: 'NF-VENCIDA-001',
      aceite: true,
    },
  });
}

/** Cria um recebivel avulso pendente, sem nenhum vinculo, so para popular a listagem. */
async function criarRecebivelPendenteAvulso(clienteId: string) {
  return prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.CHEQUE,
      clienteId,
      valorNominal: 1500,
      valorAberto: 1500,
      dataEmissao: new Date('2026-07-01'),
      dataVencimento: new Date('2026-10-01'),
      status: StatusRecebivel.PENDENTE,
      banco: '341',
      agencia: '1234',
      conta: '56789-0',
      numeroCheque: '000099',
      dataBomPara: new Date('2026-10-01'),
    },
  });
}

/** Cria um emprestimo e gera as parcelas (mesma formula usada por Emprestimo.gerarParcelas()). */
async function criarEmprestimoComParcelas(params: {
  clienteId: string;
  valorEmprestado: number;
  tipoJuros: TipoJuros;
  taxaJuros: number;
  quantidadeParcelas: number;
  dataContratacao: Date;
}) {
  const emprestimo = await prisma.emprestimo.create({
    data: {
      clienteId: params.clienteId,
      valorEmprestado: params.valorEmprestado,
      tipoJuros: params.tipoJuros,
      taxaJuros: params.taxaJuros,
      quantidadeParcelas: params.quantidadeParcelas,
      dataContratacao: params.dataContratacao,
    },
  });

  const valorParcela = calcularValorParcela(
    params.valorEmprestado,
    params.taxaJuros,
    params.quantidadeParcelas,
    params.tipoJuros,
  );

  await prisma.parcelaEmprestimo.createMany({
    data: Array.from({ length: params.quantidadeParcelas }, (_, indice) => ({
      emprestimoId: emprestimo.id,
      numero: indice + 1,
      valor: valorParcela,
      valorPago: 0,
      dataVencimento: adicionarMeses(params.dataContratacao, indice + 1),
      status: StatusParcela.PENDENTE,
    })),
  });

  const parcelas = await prisma.parcelaEmprestimo.findMany({
    where: { emprestimoId: emprestimo.id },
    orderBy: { numero: 'asc' },
  });

  return { emprestimo, parcelas };
}

/** Recalcula e persiste os 4 totais de uma negociacao a partir dos itens ja criados. */
async function recalcularTotais(negociacaoId: string, valorTarifas: Prisma.Decimal.Value) {
  const [itensRecebivel, itensEmprestimo] = await Promise.all([
    prisma.itemNegociacaoRecebivel.findMany({
      where: { negociacaoId },
      include: { recebivel: true },
    }),
    prisma.itemNegociacaoEmprestimo.findMany({
      where: { negociacaoId },
      include: { emprestimo: { include: { parcelas: true } } },
    }),
  ]);

  const totais = calcularTotaisNegociacao(itensRecebivel, itensEmprestimo, valorTarifas);

  return prisma.negociacao.update({ where: { id: negociacaoId }, data: totais });
}

/** Negociacao EM_ANALISE, mista (recebivel + emprestimo), com um pagamento parcial de
 *  parcela feito ANTES do emprestimo entrar na negociacao (mostra valorPago refletindo isso). */
async function criarNegociacaoEmAnalise(clienteId: string, usuarioId: string) {
  const recebivel = await prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.DUPLICATA,
      clienteId,
      valorNominal: 10000,
      valorAberto: 10000,
      dataEmissao: new Date('2026-06-01'),
      dataVencimento: new Date('2026-08-01'),
      status: StatusRecebivel.PENDENTE,
      numeroNotaFiscal: 'NF-000123',
      aceite: true,
    },
  });

  const { emprestimo, parcelas } = await criarEmprestimoComParcelas({
    clienteId,
    valorEmprestado: 6000,
    tipoJuros: TipoJuros.SIMPLES,
    taxaJuros: 0.02,
    quantidadeParcelas: 6,
    dataContratacao: new Date('2026-07-01'),
  });

  // pagamento parcial de uma parcela antes de vincular o emprestimo a negociacao
  await prisma.parcelaEmprestimo.update({
    where: { id: parcelas[0].id },
    data: { valorPago: 300, status: StatusParcela.PENDENTE },
  });

  const negociacao = await prisma.negociacao.create({
    data: {
      numero: 'NEG-0001-EM-ANALISE',
      titulo: 'Cessao de duplicata + emprestimo em analise',
      descricao: 'Negociacao mista de exemplo, ainda em avaliacao pela mesa de credito.',
      clienteId,
      usuarioId,
      tipoNegociacao: TipoNegociacao.MISTA,
      status: StatusNegociacao.EM_ANALISE,
      formaPagamento: FormaPagamento.PIX,
      valorTarifas: 50,
      valorBruto: 0,
      valorTotalReceber: 0,
      valorPago: 0,
      valorAReceber: 0,
    },
  });

  const taxaDesagio = 0.025;
  const quantidadeDias = 30;
  const valorDesagio = calcularDesagio(recebivel.valorNominal, taxaDesagio, quantidadeDias);
  const valorLiquido = calcularValorLiquidoItemRecebivel(recebivel.valorNominal, valorDesagio);

  await prisma.itemNegociacaoRecebivel.create({
    data: {
      negociacaoId: negociacao.id,
      recebivelId: recebivel.id,
      valorConsiderado: recebivel.valorNominal,
      quantidadeDias,
      taxaDesagio,
      valorDesagio,
      valorLiquido,
    },
  });
  await prisma.recebivel.update({
    where: { id: recebivel.id },
    data: { status: StatusRecebivel.NEGOCIADO },
  });

  await prisma.itemNegociacaoEmprestimo.create({
    data: { negociacaoId: negociacao.id, emprestimoId: emprestimo.id },
  });

  await recalcularTotais(negociacao.id, 50);

  return negociacao;
}

/** Negociacao APROVADA, so com recebivel, sem pagamentos ainda. */
async function criarNegociacaoAprovada(clienteId: string, usuarioId: string) {
  const recebivel = await prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.CHEQUE,
      clienteId,
      valorNominal: 4000,
      valorAberto: 4000,
      dataEmissao: new Date('2026-05-01'),
      dataVencimento: new Date('2026-07-01'),
      status: StatusRecebivel.PENDENTE,
      banco: '033',
      agencia: '5678',
      conta: '12345-6',
      numeroCheque: '000078',
      dataBomPara: new Date('2026-07-01'),
    },
  });

  const negociacao = await prisma.negociacao.create({
    data: {
      numero: 'NEG-0002-APROVADA',
      titulo: 'Cessao de cheque aprovada',
      descricao: 'Aprovada pela mesa de credito, aguardando liquidacao.',
      clienteId,
      usuarioId,
      tipoNegociacao: TipoNegociacao.RECEBIVEIS,
      status: StatusNegociacao.APROVADA,
      formaPagamento: FormaPagamento.TED,
      valorTarifas: 20,
      valorBruto: 0,
      valorTotalReceber: 0,
      valorPago: 0,
      valorAReceber: 0,
    },
  });

  const taxaDesagio = 0.03;
  const quantidadeDias = 20;
  const valorDesagio = calcularDesagio(recebivel.valorNominal, taxaDesagio, quantidadeDias);
  const valorLiquido = calcularValorLiquidoItemRecebivel(recebivel.valorNominal, valorDesagio);

  await prisma.itemNegociacaoRecebivel.create({
    data: {
      negociacaoId: negociacao.id,
      recebivelId: recebivel.id,
      valorConsiderado: recebivel.valorNominal,
      quantidadeDias,
      taxaDesagio,
      valorDesagio,
      valorLiquido,
    },
  });
  await prisma.recebivel.update({
    where: { id: recebivel.id },
    data: { status: StatusRecebivel.NEGOCIADO },
  });

  await recalcularTotais(negociacao.id, 20);

  return negociacao;
}

/** Negociacao FINALIZADA: recebivel totalmente quitado, sem tarifas, valorAReceber == 0. */
async function criarNegociacaoFinalizada(clienteId: string, usuarioId: string) {
  const recebivel = await prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.DUPLICATA,
      clienteId,
      valorNominal: 2000,
      valorAberto: 0,
      dataEmissao: new Date('2026-03-01'),
      dataVencimento: new Date('2026-05-01'),
      status: StatusRecebivel.QUITADO,
      numeroNotaFiscal: 'NF-000200',
      aceite: true,
    },
  });

  const negociacao = await prisma.negociacao.create({
    data: {
      numero: 'NEG-0003-FINALIZADA',
      titulo: 'Cessao de duplicata finalizada',
      descricao: 'Negociacao encerrada, recebivel totalmente quitado.',
      clienteId,
      usuarioId,
      tipoNegociacao: TipoNegociacao.RECEBIVEIS,
      status: StatusNegociacao.APROVADA,
      formaPagamento: FormaPagamento.BOLETO,
      valorTarifas: 0,
      valorBruto: 0,
      valorTotalReceber: 0,
      valorPago: 0,
      valorAReceber: 0,
    },
  });

  const taxaDesagio = 0.02;
  const quantidadeDias = 15;
  const valorDesagio = calcularDesagio(2000, taxaDesagio, quantidadeDias);
  const valorLiquido = calcularValorLiquidoItemRecebivel(2000, valorDesagio);

  await prisma.itemNegociacaoRecebivel.create({
    data: {
      negociacaoId: negociacao.id,
      recebivelId: recebivel.id,
      valorConsiderado: 2000,
      quantidadeDias,
      taxaDesagio,
      valorDesagio,
      valorLiquido,
    },
  });

  await recalcularTotais(negociacao.id, 0);

  // valorPago (2000 - valorAberto 0) - valorTarifas (0) = valorTotalReceber (2000) => valorAReceber = 0
  return prisma.negociacao.update({
    where: { id: negociacao.id },
    data: { status: StatusNegociacao.FINALIZADA },
  });
}

async function main() {
  const { admin, operador, analista } = await criarUsuarios();
  const cliente = await criarClienteBase();

  const jaSeeded = await prisma.negociacao.findUnique({
    where: { numero: 'NEG-0001-EM-ANALISE' },
  });
  if (jaSeeded) {
    console.log('Seed ja aplicado anteriormente (negociacoes de exemplo ja existem) -- pulando.');
    return;
  }

  await criarRecebivelVencidoAvulso(cliente.id);
  await criarRecebivelPendenteAvulso(cliente.id);

  const negociacaoEmAnalise = await criarNegociacaoEmAnalise(cliente.id, operador.id);
  const negociacaoAprovada = await criarNegociacaoAprovada(cliente.id, operador.id);
  const negociacaoFinalizada = await criarNegociacaoFinalizada(cliente.id, admin.id);

  console.log('Seed concluido:', {
    usuarios: [admin.email, operador.email, analista.email],
    cliente: cliente.nome,
    negociacoes: [
      negociacaoEmAnalise.numero,
      negociacaoAprovada.numero,
      negociacaoFinalizada.numero,
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
