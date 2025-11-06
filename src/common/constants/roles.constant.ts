export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM_ADMIN: 'system_admin',
} as const;

export const EMPLOYER_ROLES = {
  ADMIN: 'employer_admin',
  MANAGER: 'employer_manager',
  VIEWER: 'employer_viewer',
} as const;

export const AGENCY_ROLES = {
  ADMIN: 'agency_admin',
  MANAGER: 'agency_manager',
  SUPERVISOR: 'agency_supervisor',
  VIEWER: 'agency_viewer',
} as const;

export const ALL_ROLES = {
  ...SYSTEM_ROLES,
  ...EMPLOYER_ROLES,
  ...AGENCY_ROLES,
} as const;