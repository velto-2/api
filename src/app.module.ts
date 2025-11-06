import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MongodbModule } from './database/mongodb/mongodb.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { TestsModule } from './modules/tests/tests.module';
import { SpeechModule } from './modules/speech/speech.module';
import { DigitalHumanModule } from './modules/digital-human/digital-human.module';
import { TestRunsModule } from './modules/test-runs/test-runs.module';
import {
  appConfig,
  databaseConfig,
  twilioConfig,
  cloudflareConfig,
  elevenlabsConfig,
} from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        twilioConfig,
        cloudflareConfig,
        elevenlabsConfig,
      ],
      envFilePath: ['.env'],
    }),
    MongodbModule,
    TelephonyModule,
    TestsModule,
    SpeechModule,
    DigitalHumanModule,
    TestRunsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
