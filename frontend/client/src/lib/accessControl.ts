// src/lib/accessControl.ts
export const LEVELS = {
  ASSESSOR: 1,
  SUPERVISAO: 2,
  COORDENADOR: 3,
  ADMINISTRATIVO: 4,
};

const GROUP_MAPPING: Record<string, number> = {
  'Elite': LEVELS.ASSESSOR,
  'Análise de segurado': LEVELS.ASSESSOR,
  'Concomitante': LEVELS.ASSESSOR,
  'Quinquenio': LEVELS.ASSESSOR,
  'Supervisor': LEVELS.SUPERVISAO,
  'Coordenador': LEVELS.COORDENADOR,
  'Salesops': LEVELS.ADMINISTRATIVO,
  'CEO': LEVELS.ADMINISTRATIVO,
  'Diretoria': LEVELS.ADMINISTRATIVO,
};

const PERMISSIONS: Record<number, any> = {
  [LEVELS.ASSESSOR]: {
    canAccessReports: false,
    canAccessConfiguration: false,
    canEditConfiguration: false,
    canEditBonus: false,
    canGenerateNextMonth: false,
    filterLocked: true,
    lockedTeam: true,
    lockedCollaborator: true,
  },
  [LEVELS.SUPERVISAO]: {
    canAccessReports: true,
    canAccessConfiguration: true,
    canEditConfiguration: false,
    canEditBonus: false,
    canGenerateNextMonth: false,
    filterLocked: true,
    lockedTeam: true,
    lockedCollaborator: false,
  },
  [LEVELS.COORDENADOR]: {
    canAccessReports: true,
    canAccessConfiguration: true,
    canEditConfiguration: true,
    canEditBonus: false,
    canGenerateNextMonth: false,
    filterLocked: false,
    lockedTeam: false,
    lockedCollaborator: false,
  },
  [LEVELS.ADMINISTRATIVO]: {
    canAccessReports: true,
    canAccessConfiguration: true,
    canEditConfiguration: true,
    canEditBonus: true,
    canGenerateNextMonth: true,
    filterLocked: false,
    lockedTeam: false,
    lockedCollaborator: false,
  },
};

export function getAccessLevel(group: string | undefined): number {
  if (!group) return LEVELS.ASSESSOR;
  const normalized = group.trim();
  for (const [key, level] of Object.entries(GROUP_MAPPING)) {
    if (normalized === key || normalized.toLowerCase() === key.toLowerCase()) {
      return level;
    }
  }
  return LEVELS.ASSESSOR;
}

export function hasPermission(user: any, permission: string): boolean {
  if (!user?.grupo) return false;
  const level = getAccessLevel(user.grupo);
  return PERMISSIONS[level]?.[permission] || false;
}

export function getUserPermissions(user: any) {
  const level = getAccessLevel(user?.grupo);
  return {
    level,
    levelName: getLevelName(level),
    grupo: user?.grupo,
    ...PERMISSIONS[level],
  };
}

function getLevelName(level: number): string {
  const names: Record<number, string> = {
    [LEVELS.ASSESSOR]: 'ASSESSOR',
    [LEVELS.SUPERVISAO]: 'SUPERVISAO',
    [LEVELS.COORDENADOR]: 'COORDENADOR',
    [LEVELS.ADMINISTRATIVO]: 'ADMINISTRATIVO',
  };
  return names[level] || 'ASSESSOR';
}

export function filterTeamData(teamMembers: any[], currentUser: any): any[] {
  if (!currentUser || !teamMembers) return [];
  const userLevel = getAccessLevel(currentUser.grupo);
  if (userLevel >= LEVELS.COORDENADOR) return teamMembers;
  if (userLevel === LEVELS.SUPERVISAO) {
    return teamMembers.filter(m => m.equipe === currentUser.equipe);
  }
  if (userLevel === LEVELS.ASSESSOR) {
    return teamMembers.filter(m => m.id === currentUser.id);
  }
  return [];
}

export function getFilterRestrictions(currentUser: any) {
  if (!currentUser) {
    return { lockTeam: false, teamName: null, lockCollaborator: false, collaboratorName: null };
  }
  const level = getAccessLevel(currentUser.grupo);
  if (level === LEVELS.ASSESSOR) {
    return {
      lockTeam: true,
      teamName: currentUser.equipe || null,
      lockCollaborator: true,
      collaboratorName: currentUser.name || null,
    };
  }
  if (level === LEVELS.SUPERVISAO) {
    return {
      lockTeam: true,
      teamName: currentUser.equipe || null,
      lockCollaborator: false,
      collaboratorName: null,
    };
  }
  return { lockTeam: false, teamName: null, lockCollaborator: false, collaboratorName: null };
}

export function getUIConfig(currentUser: any) {
  const permissions = getUserPermissions(currentUser);
  const filterRestrictions = getFilterRestrictions(currentUser);
  return {
    ...permissions,
    filter: filterRestrictions,
    accessLevel: permissions.levelName,
    group: currentUser?.grupo,
    menuItems: getMenuItems(permissions),
  };
}

function getMenuItems(permissions: any) {
  const items = [];
  items.push({ id: 'dashboard', label: 'Dashboard', link: '/' });
  if (permissions.canViewTeam) {
    items.push({ id: 'team', label: 'Equipe', link: '/equipe' });
  }
  if (permissions.canAccessReports) {
    items.push({ id: 'reports', label: 'Relatórios', link: '/relatorios' });
  }
  if (permissions.canAccessConfiguration) {
    items.push({ id: 'configuration', label: 'Configurações', link: '/configuracoes' });
  }
  return items;
}