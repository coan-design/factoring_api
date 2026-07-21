import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PerfilUsuario } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Cobre o fluxo de ponta a ponta mais critico do produto: montar uma negociacao mista
 * (recebivel + emprestimo), confirmar que os totais calculados batem -- incluindo um
 * pagamento de parcela ANTES do emprestimo entrar na negociacao -- aprovar, quitar e
 * finalizar, alem dos casos de erro de posse/reuso.
 */
describe('Wizard de Negociacao (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const sufixo = Date.now();
  const adminEmail = `admin.wizard.${sufixo}@factoring.com`;
  const adminSenha = 'senhaSegura123';

  let accessToken: string;
  let clienteAId: string;
  let clienteBId: string;
  let recebivelAId: string;
  let recebivelBId: string;
  let emprestimoAId: string;
  let emprestimoBId: string;
  let parcelaIds: string[] = [];
  let negociacaoId: string;
  let negociacaoConcorrenteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    const senhaHash = await bcrypt.hash(adminSenha, 10);
    await prisma.usuario.create({
      data: {
        nome: 'Admin Wizard E2E',
        email: adminEmail,
        senhaHash,
        perfil: PerfilUsuario.ADMIN,
        ativo: true,
      },
    });

    const login = await http
      .post('/auth/login')
      .send({ email: adminEmail, senha: adminSenha })
      .expect(200);
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    // Limpeza direta via Prisma (bypassa regras de negocio como "nao deletar FINALIZADA").
    await prisma.negociacao.deleteMany({ where: { clienteId: { in: [clienteAId, clienteBId] } } });
    await prisma.recebivel.deleteMany({ where: { clienteId: { in: [clienteAId, clienteBId] } } });
    await prisma.emprestimo.deleteMany({ where: { clienteId: { in: [clienteAId, clienteBId] } } });
    await prisma.cliente.deleteMany({ where: { id: { in: [clienteAId, clienteBId] } } });
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('monta o cenario: dois clientes, recebivel + emprestimo (com parcelas) para cada', async () => {
    const clienteA = await http
      .post('/clientes')
      .set(auth())
      .send({
        nome: 'Cliente A Wizard',
        cpfCnpj: `wizard-a-${sufixo}`,
        tipoCliente: 'PESSOA_JURIDICA',
        email: `clienteA.${sufixo}@factoring.com`,
        telefone: '(11) 90000-0001',
      })
      .expect(201);
    clienteAId = clienteA.body.id;

    const clienteB = await http
      .post('/clientes')
      .set(auth())
      .send({
        nome: 'Cliente B Wizard',
        cpfCnpj: `wizard-b-${sufixo}`,
        tipoCliente: 'PESSOA_JURIDICA',
        email: `clienteB.${sufixo}@factoring.com`,
        telefone: '(11) 90000-0002',
      })
      .expect(201);
    clienteBId = clienteB.body.id;

    const recebivelA = await http
      .post('/recebiveis')
      .set(auth())
      .send({
        tipo: 'DUPLICATA',
        clienteId: clienteAId,
        valorNominal: 1000,
        dataEmissao: '2026-06-01',
        dataVencimento: '2026-08-01',
        numeroNotaFiscal: 'NF-WIZARD-A',
        aceite: true,
      })
      .expect(201);
    recebivelAId = recebivelA.body.id;

    const recebivelB = await http
      .post('/recebiveis')
      .set(auth())
      .send({
        tipo: 'DUPLICATA',
        clienteId: clienteBId,
        valorNominal: 500,
        dataEmissao: '2026-06-01',
        dataVencimento: '2026-08-01',
        numeroNotaFiscal: 'NF-WIZARD-B',
        aceite: true,
      })
      .expect(201);
    recebivelBId = recebivelB.body.id;

    // taxaJuros 0 mantem os numeros exatos: 3 parcelas de 400 (SIMPLES, sem juros).
    const emprestimoA = await http
      .post('/emprestimos')
      .set(auth())
      .send({
        clienteId: clienteAId,
        valorEmprestado: 1200,
        tipoJuros: 'SIMPLES',
        taxaJuros: 0,
        quantidadeParcelas: 3,
        dataContratacao: '2026-07-01',
      })
      .expect(201);
    emprestimoAId = emprestimoA.body.id;
    parcelaIds = emprestimoA.body.parcelas.map((p: { id: string }) => p.id);
    expect(parcelaIds).toHaveLength(3);

    const emprestimoB = await http
      .post('/emprestimos')
      .set(auth())
      .send({
        clienteId: clienteBId,
        valorEmprestado: 300,
        tipoJuros: 'SIMPLES',
        taxaJuros: 0,
        quantidadeParcelas: 1,
        dataContratacao: '2026-07-01',
      })
      .expect(201);
    emprestimoBId = emprestimoB.body.id;
  });

  it('paga parcialmente uma parcela ANTES do emprestimo entrar na negociacao', async () => {
    const response = await http
      .patch(`/parcelas-emprestimo/${parcelaIds[0]}/pagamento`)
      .set(auth())
      .send({ valor: 150 })
      .expect(200);

    expect(Number(response.body.valorPago)).toBe(150);
    expect(response.body.status).toBe('PENDENTE');
  });

  it('cria a negociacao EM_ANALISE (sem tarifas, para simplificar os totais)', async () => {
    const response = await http
      .post('/negociacoes')
      .set(auth())
      .send({
        numero: `NEG-WIZARD-${sufixo}`,
        titulo: 'Negociacao mista de teste',
        clienteId: clienteAId,
        tipoNegociacao: 'MISTA',
        formaPagamento: 'PIX',
        valorTarifas: 0,
      })
      .expect(201);

    negociacaoId = response.body.id;
    expect(response.body.status).toBe('EM_ANALISE');
    expect(Number(response.body.valorBruto)).toBe(0);
  });

  it('rejeita vincular recebivel/emprestimo de outro cliente (409)', async () => {
    await http
      .post(`/negociacoes/${negociacaoId}/itens-recebivel`)
      .set(auth())
      .send({ recebivelId: recebivelBId, quantidadeDias: 30, taxaDesagio: 0.03 })
      .expect(409);

    await http
      .post(`/negociacoes/${negociacaoId}/itens-emprestimo`)
      .set(auth())
      .send({ emprestimoId: emprestimoBId })
      .expect(409);
  });

  it('adiciona o recebivel e confere valorBruto/valorTotalReceber/valorPago/valorAReceber', async () => {
    const response = await http
      .post(`/negociacoes/${negociacaoId}/itens-recebivel`)
      .set(auth())
      .send({ recebivelId: recebivelAId, quantidadeDias: 30, taxaDesagio: 0.03 })
      .expect(201);

    // desagio = 1000 * 0.03 * 30/30 = 30 ; liquido = 970
    expect(Number(response.body.valorBruto)).toBe(970);
    expect(Number(response.body.valorTotalReceber)).toBe(1000);
    expect(Number(response.body.valorPago)).toBe(0);
    expect(Number(response.body.valorAReceber)).toBe(1000);
  });

  it('adiciona o emprestimo inteiro e confere que valorPago reflete o pagamento anterior a negociacao', async () => {
    const response = await http
      .post(`/negociacoes/${negociacaoId}/itens-emprestimo`)
      .set(auth())
      .send({ emprestimoId: emprestimoAId })
      .expect(201);

    // bruto = 970 (recebivel liquido) + 1200 (valorEmprestado)
    expect(Number(response.body.valorBruto)).toBe(2170);
    // totalReceber = 1000 (recebivel nominal) + 1200 (soma das 3 parcelas)
    expect(Number(response.body.valorTotalReceber)).toBe(2200);
    // pago = 0 (recebivel ainda nao pago) + 150 (pagamento anterior na parcela 1)
    expect(Number(response.body.valorPago)).toBe(150);
    // aReceber = 2200 - 150 - 0
    expect(Number(response.body.valorAReceber)).toBe(2050);
  });

  it('rejeita vincular o mesmo recebivel a outra negociacao ativa (409)', async () => {
    const outraNegociacao = await http
      .post('/negociacoes')
      .set(auth())
      .send({
        numero: `NEG-WIZARD-CONCORRENTE-${sufixo}`,
        titulo: 'Negociacao concorrente',
        clienteId: clienteAId,
        tipoNegociacao: 'RECEBIVEIS',
        formaPagamento: 'PIX',
      })
      .expect(201);
    negociacaoConcorrenteId = outraNegociacao.body.id;

    await http
      .post(`/negociacoes/${negociacaoConcorrenteId}/itens-recebivel`)
      .set(auth())
      .send({ recebivelId: recebivelAId, quantidadeDias: 10, taxaDesagio: 0.01 })
      .expect(409);

    // limpeza: cancela a negociacao concorrente para nao interferir no restante do teste
    await http.patch(`/negociacoes/${negociacaoConcorrenteId}/cancelar`).set(auth()).expect(200);
  });

  it('aprova a negociacao', async () => {
    const response = await http
      .patch(`/negociacoes/${negociacaoId}/aprovar`)
      .set(auth())
      .expect(200);
    expect(response.body.status).toBe('APROVADA');
  });

  it('rejeita finalizar enquanto valorAReceber != 0 (409)', async () => {
    await http.patch(`/negociacoes/${negociacaoId}/finalizar`).set(auth()).expect(409);
  });

  it('quita o recebivel e as parcelas restantes, e finaliza a negociacao com valorAReceber == 0', async () => {
    await http
      .patch(`/recebiveis/${recebivelAId}/pagamento`)
      .set(auth())
      .send({ valor: 1000 })
      .expect(200);

    await http
      .patch(`/parcelas-emprestimo/${parcelaIds[0]}/pagamento`)
      .set(auth())
      .send({ valor: 250 }) // resta 400 - 150 ja pago
      .expect(200);
    await http
      .patch(`/parcelas-emprestimo/${parcelaIds[1]}/pagamento`)
      .set(auth())
      .send({ valor: 400 })
      .expect(200);
    await http
      .patch(`/parcelas-emprestimo/${parcelaIds[2]}/pagamento`)
      .set(auth())
      .send({ valor: 400 })
      .expect(200);

    const negociacaoAtualizada = await http
      .get(`/negociacoes/${negociacaoId}`)
      .set(auth())
      .expect(200);
    expect(Number(negociacaoAtualizada.body.valorPago)).toBe(2200);
    expect(Number(negociacaoAtualizada.body.valorAReceber)).toBe(0);

    const finalizada = await http
      .patch(`/negociacoes/${negociacaoId}/finalizar`)
      .set(auth())
      .expect(200);
    expect(finalizada.body.status).toBe('FINALIZADA');
  });
});
