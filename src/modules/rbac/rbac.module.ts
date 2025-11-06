import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RbacSeedService } from './rbac-seed.service';

@Module({
  controllers: [RbacController],
  providers: [RbacService, RbacSeedService],
  exports: [RbacService, RbacSeedService],
})
export class RbacModule {}