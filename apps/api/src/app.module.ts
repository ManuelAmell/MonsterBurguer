import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import type { Env } from './config/env';
import { HealthController } from './health/health.controller';
import { OrigenGuard, RolesGuard, SesionGuard } from './modules/identidad/auth.guards';
import { IdentidadModule } from './modules/identidad/identidad.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { DbModule } from './shared-kernel/db/db.module';
import { EventsModule } from './shared-kernel/events/events.module';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
            transport:
              env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
          },
        }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
        DbModule,
        EventsModule,
        IdentidadModule,
        CatalogoModule,
        InventarioModule,
      ],
      controllers: [HealthController],
      // Orden de evaluación: origen (CSRF) → límite de peticiones → sesión → rol.
      providers: [
        { provide: APP_GUARD, useClass: OrigenGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: SesionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
