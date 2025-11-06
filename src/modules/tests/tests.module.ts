import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { TestConfig, TestConfigSchema } from './schemas/test-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestConfig.name, schema: TestConfigSchema },
    ]),
  ],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}


