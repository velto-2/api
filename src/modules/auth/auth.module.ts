import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    PassportModule,
    RbacModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-super-secret-key-change-in-production-make-it-very-long',
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}