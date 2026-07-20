import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { PerfilUsuario } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth + Clientes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const sufixo = Date.now();
  const adminEmail = `admin.e2e.${sufixo}@factoring.com`;
  const adminSenha = 'senhaSegura123';
  const cpfCnpjCliente = `e2e-${sufixo}`;

  let accessToken: string;
  let clienteId: string;

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

    const senhaHash = await bcrypt.hash(adminSenha, 10);
    await prisma.usuario.create({
      data: {
        nome: 'Admin E2E',
        email: adminEmail,
        senhaHash,
        perfil: PerfilUsuario.ADMIN,
        ativo: true,
      },
    });
  });

  afterAll(async () => {
    if (clienteId) {
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    await prisma.usuario.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('GET /clientes sem token retorna 401', () => {
    return request(app.getHttpServer()).get('/clientes').expect(401);
  });

  it('POST /auth/login com credenciais invalidas retorna 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha: 'senhaErrada' })
      .expect(401);
  });

  it('POST /auth/login com credenciais validas retorna accessToken', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, senha: adminSenha })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    accessToken = response.body.accessToken;
  });

  it('POST /clientes cria um cliente ATIVO', async () => {
    const response = await request(app.getHttpServer())
      .post('/clientes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        nome: 'Cliente E2E',
        cpfCnpj: cpfCnpjCliente,
        tipoCliente: 'PESSOA_JURIDICA',
        email: 'cliente.e2e@factoring.com',
        telefone: '(11) 90000-0000',
      })
      .expect(201);

    expect(response.body.status).toBe('ATIVO');
    clienteId = response.body.id;
  });

  it('PATCH /clientes/:id/inativar inativa o cliente sem negociacoes em aberto', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/clientes/${clienteId}/inativar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.status).toBe('INATIVO');
  });

  it('PATCH /clientes/:id/inativar novamente retorna 409 (ja inativo)', () => {
    return request(app.getHttpServer())
      .patch(`/clientes/${clienteId}/inativar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });
});
