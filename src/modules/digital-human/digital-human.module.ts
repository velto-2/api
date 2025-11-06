import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DigitalHumanService } from './digital-human.service';

@Module({
  imports: [HttpModule],
  providers: [DigitalHumanService],
  exports: [DigitalHumanService],
})
export class DigitalHumanModule {}
