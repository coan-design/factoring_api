# Factoring API

Backend do sistema de factoring (cessão de recebíveis e empréstimos), construído com **NestJS**,
**Prisma** (PostgreSQL), **JWT/RBAC** e **Swagger**.

## Stack

- Node.js (LTS) + TypeScript
- NestJS 10
- Prisma ORM + PostgreSQL
- class-validator / class-transformer para DTOs
- JWT (Passport) com controle de acesso por perfil (`PerfilUsuario`)
- Swagger em `/api-docs`
- Jest (unitários + e2e)

## Decisões de modelagem

### Herança `Recebivel` → `Cheque` / `Duplicata`

Modelada como **tabela única com discriminador** (`Recebivel.tipo: CHEQUE | DUPLICATA`), com os
campos específicos de cada subtipo (`banco`, `numeroCheque`, `dataBomPara` / `numeroNotaFiscal`,
`aceite`) como colunas nullable na mesma tabela.

Motivo: a maior parte das regras de negócio e das queries trata "recebível" de forma polimórfica
(recebíveis de um cliente, recebíveis vencidos, itens de negociação). O Prisma não tem herança
nativa; normalizar em duas tabelas (`Cheque`/`Duplicata` com FK 1:1 para `Recebivel`) exigiria
join constante só para diferenciar o tipo. O custo de algumas colunas nulas por linha é aceitável
dado que existem apenas 2 subtipos com poucos campos específicos.

### Reuso de recebível/empréstimo em negociações

A regra "não pode estar em outra negociação ativa" **não** é uma constraint de banco — um mesmo
recebível pode aparecer em itens de negociações **canceladas**. A validação é feita no
`NegociacoesService`, verificando se existe um item vinculado a uma negociação cujo status não é
`CANCELADA` (ou seja, `EM_ANALISE`, `APROVADA` ou `FINALIZADA` "prendem" o título).

### `ItemNegociacaoEmprestimo`: o empréstimo entra inteiro

`ItemNegociacaoEmprestimo` é uma **tabela de junção pura** (`id`, `negociacaoId`, `emprestimoId`,
`createdAt`), sem valores próprios. Ao contrário de `ItemNegociacaoRecebivel` (que "congela" um
`valorConsiderado`/`taxaDesagio` no momento da inclusão), o empréstimo entra **inteiro** na
negociação: todas as suas `ParcelaEmprestimo` — pagas ou não, inclusive pagamentos anteriores à
negociação — continuam vinculadas ao `Emprestimo` original, e os totais da negociação leem esses
valores diretamente. Isso evita duplicar/recalcular juros que já estão embutidos no empréstimo.
`adicionarEmprestimo()` exige que as parcelas já tenham sido geradas (`gerarParcelas()`), senão o
`valorTotalReceber` ficaria incompleto.

### Cálculos financeiros

- `ItemNegociacaoRecebivel.calcularDesagio()`: `valorConsiderado * taxaDesagio * quantidadeDias / 30`
- `ItemNegociacaoRecebivel.calcularValorLiquido()`: `valorConsiderado - valorDesagio`
  (`valorConsiderado` = `Recebivel.valorNominal` no momento da inclusão)
- `Emprestimo.calcularValorTotal()`: soma de `valor` de todas as `ParcelaEmprestimo` geradas
  (principal + juros)
- `Emprestimo.calcularSaldoDevedor()`: soma de `(valor - valorPago)` das parcelas **ainda não
  quitadas** — quanto falta receber desse empréstimo hoje
- `Negociacao.calcularValorBruto()`: soma(`Emprestimo.valorEmprestado` dos empréstimos vinculados)
  + soma(`ItemNegociacaoRecebivel.valorLiquido` dos itens) — quanto a factoring desembolsou
- `Negociacao.calcularValorTotalReceber()`: soma(`Emprestimo.calcularValorTotal()`) +
  soma(`Recebivel.valorNominal` dos recebíveis vinculados) — quanto se espera receber no total,
  já com o lucro da operação embutido
- `Negociacao.calcularValorPago()`: soma(`Recebivel.valorNominal - Recebivel.valorAberto`) +
  soma(`ParcelaEmprestimo.valorPago` de todas as parcelas dos empréstimos vinculados) — o que já
  entrou de fato, **incluindo pagamentos anteriores à negociação**
- `Negociacao.calcularValorAReceber()`: `valorTotalReceber - valorPago - valorTarifas`
- `Emprestimo.gerarParcelas()`: parcelas fixas mensais; `SIMPLES` distribui juros lineares sobre o
  principal, `COMPOSTO` usa a fórmula de tabela Price (juros compostos sobre o saldo devedor)

Todas essas regras estão implementadas como funções puras e testáveis em `*.rules.ts` dentro de
cada módulo, e usadas pelos respectivos services — não ficam soltas em controllers.

### Recalculo sob demanda dos totais da negociação

`valorBruto`, `valorTotalReceber`, `valorPago` e `valorAReceber` são **persistidos** em
`Negociacao` para leitura rápida, mas tratados como cache de um cálculo — nunca escritos "à mão".
`NegociacoesService` os recalcula (via `calcularTotaisNegociacao()`, em `negociacao.rules.ts`) a
cada mutação relevante:

- inclusão de item (`adicionarRecebivel`/`adicionarEmprestimo`) ou alteração de `valorTarifas`;
- pagamento de um recebível vinculado — `RecebiveisService.registrarPagamento()` chama
  `NegociacoesService.recalcularPorRecebivel()` depois de atualizar o recebível;
- pagamento de uma parcela de empréstimo vinculado — `ParcelasEmprestimoService.registrarPagamento()`
  chama `NegociacoesService.recalcularPorEmprestimo()`.

Por isso `RecebiveisModule` e `ParcelasEmprestimoModule` importam `NegociacoesModule` (só nessa
direção — `NegociacoesModule` não depende de volta). O recálculo só atinge negociações **abertas**
(`EM_ANALISE`/`APROVADA`); negociações `FINALIZADA`/`CANCELADA` são histórico e não são reescritas.
Não existe mais um endpoint de "registrar pagamento" direto em `Negociacao` — pagamentos sempre
entram pelo recebível ou pela parcela de origem, e a negociação reflete isso automaticamente.

## Estrutura

```
src/
  main.ts
  app.module.ts
  prisma/                  # PrismaService/PrismaModule (cliente Prisma injetavel)
  common/
    guards/                # JwtAuthGuard, RolesGuard
    decorators/            # @Public, @Roles, @CurrentUser
    filters/                # HttpExceptionFilter (respostas de erro padronizadas)
    constants/              # status de negociacao "abertos" / "bloqueia reuso"
  modules/
    auth/
    usuarios/
    enderecos/
    clientes/
    recebiveis/            # cheques e duplicatas (tabela unica com discriminador)
    emprestimos/
    parcelas-emprestimo/
    negociacoes/
prisma/
  schema.prisma
  seed.ts
test/
  auth-clientes.e2e-spec.ts
docker-compose.yml
```

> Observação: não há uma pasta `common/pipes/` — o `ValidationPipe` global e o `ParseUUIDPipe`
> nativos do Nest cobrem as necessidades do projeto, então nenhum pipe customizado foi criado.

## Como rodar

### 1. Subir o PostgreSQL

```bash
docker compose up -d
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Ajuste `JWT_SECRET` se necessário. O `DATABASE_URL` padrão já casa com o `docker-compose.yml`.

### 3. Instalar dependências

```bash
npm install
```

### 4. Rodar as migrations

```bash
npm run prisma:migrate
```

### 5. (Opcional) Popular o banco com dados de exemplo

```bash
npm run prisma:seed
```

Cria um usuário `ADMIN` (`admin@factoring.com` / senha `123456`), um cliente, dois recebíveis
(um cheque e uma duplicata) e um empréstimo.

### 6. Rodar a aplicação

```bash
npm run start:dev
```

- API: `http://localhost:3000`
- Documentação Swagger: `http://localhost:3000/api-docs`

### Autenticação

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@factoring.com","senha":"123456"}'
```

Use o `accessToken` retornado no header `Authorization: Bearer <token>` para as demais rotas.

## Testes

```bash
npm run test        # unitarios (regras de negocio dos services)
npm run test:cov    # unitarios com cobertura
npm run test:e2e    # e2e (requer PostgreSQL rodando via docker compose + migrations aplicadas)
```

## Perfis de usuário (RBAC)

- `ADMIN`: acesso completo, incluindo gestão de usuários e exclusões.
- `OPERADOR`: cadastro/edição de clientes, recebíveis, empréstimos e negociações, e operações do
  fluxo de negócio (ativar/inativar cliente, registrar pagamento de recebível/parcela, gerar
  parcelas, adicionar itens/aprovar/cancelar/finalizar negociação).
- `ANALISTA`: apenas leitura (nenhum `@Roles()` restringe os endpoints `GET`, então qualquer perfil
  autenticado pode consultar).
