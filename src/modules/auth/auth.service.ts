import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { RbacSeedService } from '../rbac/rbac-seed.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RoleScope } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private rbacService: RbacService,
    private rbacSeedService: RbacSeedService,
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

    // Seed organization roles and assign Client Admin role to the first user
    if (organization.type === 'CLIENT') {
      // Seed organization roles first
      await this.rbacSeedService.seedOrganizationRoles(organization.id);

      // Find the Client Admin role for this organization
      const clientAdminRole = await this.prisma.role.findFirst({
        where: {
          name: 'Client Admin',
          scope: RoleScope.ORGANIZATION,
          organizationId: organization.id,
        },
      });

      // Assign Client Admin role to the new user
      if (clientAdminRole) {
        try {
          await this.prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: clientAdminRole.id,
            },
          });
        } catch (error: any) {
          // Ignore if already assigned
          if (error.code !== 'P2002') {
            throw error;
          }
        }
      }
    }

    // Load user with organization for token generation
    const userWithOrg = {
      ...user,
      organization,
    };

    // Generate tokens (will now include roles/permissions)
    const tokens = await this.generateTokens(userWithOrg);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: organization.id,
        organizationType: organization.type,
        roles: tokens.user.roles || [],
        permissions: tokens.user.permissions || [],
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
        secret:
          process.env.JWT_REFRESH_SECRET ||
          'dev-refresh-secret-key-also-make-it-very-long',
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

      const isRefreshTokenValid = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
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

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = await this.rbacService.getUserPermissions(userId);
    const userRoles = await this.rbacService.getUserRoles(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        type: user.organization.type,
        logo: user.organization.logo,
      },
      roles: userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        slug: ur.role.slug,
        description: ur.role.description,
        permissions: ur.role.permissions.map((rp) => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          name: rp.permission.name,
        })),
      })),
      permissions: permissions, // Already in format "RESOURCE.ACTION"
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async generateTokens(user: any) {
    // Load user roles and permissions dynamically
    const permissions = await this.rbacService.getUserPermissions(user.id);
    const userRoles = await this.rbacService.getUserRoles(user.id);
    const roles = userRoles.map((ur) => ur.role.slug);

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
      secret:
        process.env.JWT_REFRESH_SECRET ||
        'dev-refresh-secret-key-also-make-it-very-long',
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
