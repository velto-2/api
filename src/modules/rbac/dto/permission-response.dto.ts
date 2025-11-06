import { ApiProperty } from '@nestjs/swagger';
import { PermissionResource, PermissionAction } from '@prisma/client';

export class PermissionResponseDto {
  @ApiProperty({ description: 'Permission ID' })
  id: string;

  @ApiProperty({ description: 'Permission resource', enum: PermissionResource })
  resource: PermissionResource;

  @ApiProperty({ description: 'Permission action', enum: PermissionAction })
  action: PermissionAction;

  @ApiProperty({ description: 'Permission name' })
  name: string;

  @ApiProperty({ description: 'Permission description', required: false })
  description?: string;

  @ApiProperty({ description: 'Is system permission' })
  isSystem: boolean;

  @ApiProperty({ description: 'Is permission active' })
  isActive: boolean;

  @ApiProperty({ description: 'Permission creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Permission last update date' })
  updatedAt: Date;
}