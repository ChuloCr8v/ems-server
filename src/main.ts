import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Employee Management System API')
    .setDescription(
      'API for managing onboarding and exit, leave, payroll, performance and reporting',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

   process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION:', err.stack);
});

process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION:', err);
});



  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
