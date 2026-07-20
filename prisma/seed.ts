import {
  PrismaClient,
  PerfilUsuario,
  TipoCliente,
  StatusCliente,
  TipoRecebivel,
  StatusRecebivel,
  TipoJuros,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@factoring.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@factoring.com',
      senhaHash,
      perfil: PerfilUsuario.ADMIN,
      ativo: true,
    },
  });

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

  const cliente = await prisma.cliente.upsert({
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

  await prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.DUPLICATA,
      clienteId: cliente.id,
      valorNominal: 10000,
      valorAberto: 10000,
      dataEmissao: new Date('2026-06-01'),
      dataVencimento: new Date('2026-08-01'),
      status: StatusRecebivel.PENDENTE,
      numeroNotaFiscal: 'NF-000123',
      aceite: true,
    },
  });

  await prisma.recebivel.create({
    data: {
      tipo: TipoRecebivel.CHEQUE,
      clienteId: cliente.id,
      valorNominal: 5000,
      valorAberto: 5000,
      dataEmissao: new Date('2026-06-15'),
      dataVencimento: new Date('2026-09-15'),
      status: StatusRecebivel.PENDENTE,
      banco: '341',
      agencia: '1234',
      conta: '56789-0',
      numeroCheque: '000045',
      dataBomPara: new Date('2026-09-15'),
    },
  });

  await prisma.emprestimo.create({
    data: {
      clienteId: cliente.id,
      valorEmprestado: 20000,
      tipoJuros: TipoJuros.SIMPLES,
      taxaJuros: 0.02,
      quantidadeParcelas: 12,
      dataContratacao: new Date('2026-07-01'),
    },
  });

  console.log('Seed concluido:', { admin: admin.email, cliente: cliente.nome });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
