import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  mfaEnabled: boolean;

  static from(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id          = user.id;
    dto.email       = user.email;
    dto.firstName   = user.firstName;
    dto.lastName    = user.lastName;
    dto.role        = user.role;
    dto.isActive    = user.isActive;
    dto.avatarUrl   = user.avatarUrl;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt   = user.createdAt;
    dto.mfaEnabled  = user.mfaEnabled;
    return dto;
  }
}
