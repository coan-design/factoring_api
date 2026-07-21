import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { flattenValidationErrors } from './common/utils/validation.util';

/**
 * Origens liberadas no CORS. Configuraveis via CORS_ORIGIN (lista separada por virgula).
 * Sem a env var, cai num default permissivo de dev (Vite, CRA, Angular) -- ajuste/troque por
 * uma lista explicita antes de ir para producao.
 */
function resolverCorsOrigins(): string[] {
  const configurado = process.env.CORS_ORIGIN;
  if (configurado) {
    return configurado.split(',').map((origem) => origem.trim());
  }
  return ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:4200'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: resolverCorsOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Erro de validação',
          errors: flattenValidationErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Factoring API')
    .setDescription(
      'API do sistema de factoring: clientes, recebiveis (cheques/duplicatas), emprestimos e negociacoes.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
