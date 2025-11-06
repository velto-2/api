import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  InviteUserDto,
  ChangePasswordDto,
  UserListQueryDto,
  UserResponseDto,
  UserListResponseDto,
  UserStatsResponseDto,
  InviteUserResponseDto,
} from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('USER.CREATE')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() currentUser: any,
  ): Promise<UserResponseDto> {
    createUserDto.createdBy = currentUser.userId;
    return this.usersService.createUser(createUserDto, organizationId);
  }

  @Post('invite')
  @RequirePermissions('USER.CREATE')
  @ApiOperation({ summary: 'Invite a user to join the organization' })
  @ApiResponse({ status: 201, description: 'User invited successfully', type: InviteUserResponseDto })
  async inviteUser(
    @Body() inviteUserDto: InviteUserDto,
    @CurrentOrganization() organizationId: string,
    @CurrentUser() currentUser: any,
  ): Promise<InviteUserResponseDto> {
    return this.usersService.inviteUser(inviteUserDto, organizationId, currentUser.userId);
  }

  @Get()
  @RequirePermissions('USER.READ')
  @ApiOperation({ summary: 'Get users list with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully', type: UserListResponseDto })
  async getUsers(
    @Query() query: UserListQueryDto,
    @CurrentOrganization() organizationId: string,
  ): Promise<UserListResponseDto> {
    return this.usersService.getUsers(query, organizationId);
  }

  @Get('stats')
  @RequirePermissions('USER.READ')
  @ApiOperation({ summary: 'Get user statistics for dashboard' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully', type: UserStatsResponseDto })
  async getUserStats(
    @CurrentOrganization() organizationId: string,
  ): Promise<UserStatsResponseDto> {
    return this.usersService.getUserStats(organizationId);
  }

  @Get(':id')
  @RequirePermissions('USER.READ')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully', type: UserResponseDto })
  async getUserById(
    @Param('id') userId: string,
    @CurrentOrganization() organizationId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.getUserById(userId, organizationId);
  }

  @Put(':id')
  @RequirePermissions('USER.UPDATE')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: UserResponseDto })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentOrganization() organizationId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(userId, updateUserDto, organizationId);
  }

  @Put(':id/password')
  @RequirePermissions('USER.UPDATE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  async changePassword(
    @Param('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentOrganization() organizationId: string,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(userId, changePasswordDto, organizationId);
  }

  @Put(':id/activate')
  @RequirePermissions('USER.UPDATE')
  @ApiOperation({ summary: 'Activate user account' })
  @ApiResponse({ status: 200, description: 'User activated successfully', type: UserResponseDto })
  async activateUser(
    @Param('id') userId: string,
    @CurrentOrganization() organizationId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.activateUser(userId, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('USER.DELETE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate user account (soft delete)' })
  @ApiResponse({ status: 204, description: 'User deactivated successfully' })
  async deactivateUser(
    @Param('id') userId: string,
    @CurrentOrganization() organizationId: string,
  ): Promise<{ message: string }> {
    return this.usersService.deactivateUser(userId, organizationId);
  }
}