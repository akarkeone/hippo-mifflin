// Role and status constants (SQLite doesn't generate Prisma enums)
export const Role = {
  EP: 'EP',
  PRODUCER: 'PRODUCER',
  ASSOC_PRODUCER: 'ASSOC_PRODUCER',
  INTERN: 'INTERN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ProjectStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
