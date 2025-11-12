import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MongodbModule } from './database/mongodb/mongodb.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { TestsModule } from './modules/tests/tests.module';
import { SpeechModule } from './modules/speech/speech.module';
import { DigitalHumanModule } from './modules/digital-human/digital-human.module';
import { TestRunsModule } from './modules/test-runs/test-runs.module';
import { ImportedCallsModule } from './modules/imported-calls/imported-calls.module';
import { TestSchedulesModule } from './modules/test-schedules/test-schedules.module';
import { AgentsModule } from './modules/agents/agents.module';
import {
  appConfig,
  databaseConfig,
  twilioConfig,
  vonageConfig,
  telephonyConfig,
  cloudflareConfig,
  elevenlabsConfig,
  huggingfaceConfig,
} from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        twilioConfig,
        vonageConfig,
        telephonyConfig,
        cloudflareConfig,
        elevenlabsConfig,
        huggingfaceConfig,
      ],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    MongodbModule,
    AuthModule,
    UsersModule,
    RbacModule,
    TelephonyModule,
    TestsModule,
    SpeechModule,
    DigitalHumanModule,
    TestRunsModule,
    ImportedCallsModule,
    TestSchedulesModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
