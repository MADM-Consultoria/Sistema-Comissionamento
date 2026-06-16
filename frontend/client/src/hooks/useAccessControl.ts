// src/hooks/useAccessControl.ts
import { useAppStore } from '@/lib/dataStore';
import {
  LEVELS,
  getAccessLevel as getLevel,
  hasPermission as checkPermission,
  getUserPermissions as getPermissions,
  getUIConfig as getUIConfigFromLib,
  filterTeamData as filterTeam,
  getFilterRestrictions,
} from '@/lib/accessControl';

export function useAccessControl() {
  const currentUser = useAppStore((state) => state.currentUser);

  // 🐛 Log para depuração – ajuda a identificar se o grupo está vindo corretamente
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 [useAccessControl] currentUser:', currentUser?.grupo);
  }

  const getAccessLevel = () => {
    if (!currentUser) return LEVELS.ASSESSOR;
    // fallback adicional: se grupo estiver ausente, assume Assessor
    const level = getLevel(currentUser.grupo);
    console.log(`🔐 getAccessLevel: grupo="${currentUser.grupo}", nível=${level}`);
    return level;
  };

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;
    const result = checkPermission(currentUser, permission);
    console.log(`🔐 hasPermission(${permission}): ${result}`);
    return result;
  };

  const getUserPermissions = () => {
    if (!currentUser) return null;
    return getPermissions(currentUser);
  };

  const getUIConfig = () => {
    if (!currentUser) return null;
    return getUIConfigFromLib(currentUser);
  };

  const getFilterRestrictionsSafe = () => {
    if (!currentUser) {
      return { lockTeam: false, teamName: null, lockCollaborator: false, collaboratorName: null };
    }
    const restrictions = getFilterRestrictions(currentUser);
    console.log('🔐 getFilterRestrictions:', restrictions);
    return restrictions;
  };

  const filterTeamDataSafe = (teamMembers: any[]) => {
    if (!currentUser) return [];
    return filterTeam(teamMembers, currentUser);
  };

  return {
    currentUser,
    hasPermission,
    getUserPermissions,
    getUIConfig,
    getFilterRestrictions: getFilterRestrictionsSafe,
    filterTeamData: filterTeamDataSafe,
    getAccessLevel,
    LEVELS,
  };
}