export interface JwtPayload {
  sub: string; // User ID
  email: string;
  organizationId: string;
  organizationType: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface RequestUser {
  userId: string;
  email: string;
  organizationId: string;
  organizationType: string;
  roles: string[];
  permissions: string[];
}