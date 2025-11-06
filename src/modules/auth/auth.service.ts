import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
// import { OrganizationStatus, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if organization email already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { email: registerDto.organizationEmail },
    });

    if (existingOrg) {
      throw new ConflictException('Organization email already exists');
    }

    // Check if user email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Create organization and admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          type: registerDto.organizationType,
          status: 'PENDING_VERIFICATION',
          name: registerDto.organizationName,
          email: registerDto.organizationEmail,
          phone: registerDto.organizationPhone,
          address: {}, // Will be updated later during verification
          registrationNumber: `TEMP-${Date.now()}`, // Temporary, will be updated during verification
        },
      });

      // Create admin user
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          status: 'ACTIVE', // Admin user is immediately active
        },
      });

      return { organization, user };
    });

    const { user, organization } = result;

    // Generate JWT tokens
    const payload = {
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      organizationType: organization.type,
      roles: [], // Will be populated after role assignment
      permissions: [],
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-also-make-it-very-long',
      expiresIn: '7d',
    });

    // Store refresh token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(refreshToken, 12) },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: organization.id,
        organizationType: organization.type,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-also-make-it-very-long',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          organization: true,
        },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async generateTokens(user: any) {
    // For now, use empty arrays for roles and permissions
    const permissions: string[] = [];
    const roles: string[] = [];

    const payload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      organizationType: user.organization.type,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-also-make-it-very-long',
      expiresIn: '7d',
    });

    // Update refresh token in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken: await bcrypt.hash(refreshToken, 12),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        organizationType: user.organization.type,
        roles,
        permissions,
      },
    };
  }
}