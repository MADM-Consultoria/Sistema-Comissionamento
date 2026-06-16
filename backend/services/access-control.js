// access-control.js - Sistema de Controle de Acesso Hierárquico MADM

class AccessControl {
    constructor() {
        // Definição dos níveis hierárquicos (ordem crescente de permissão)
        this.LEVELS = {
            ASSESSOR: 1,
            SUPERVISAO: 2,
            COORDENADOR: 3,
            ADMINISTRATIVO: 4
        };

        // Mapeamento de grupos para níveis
        this.GROUP_MAPPING = {
            // Nível ASSESSOR (apenas dados próprios)
            'Elite': this.LEVELS.ASSESSOR,
            'Análise de segurado': this.LEVELS.ASSESSOR,
            'Concomitante': this.LEVELS.ASSESSOR,
            'Quinquenio': this.LEVELS.ASSESSOR,
            
            // Nível SUPERVISÃO (visualiza equipe)
            'Supervisor': this.LEVELS.SUPERVISAO,
            
            // Nível COORDENADOR (ajusta metas, não bônus)
            'Coordenador': this.LEVELS.COORDENADOR,
            
            // Nível ADMINISTRATIVO (acesso total)
            'Salesops': this.LEVELS.ADMINISTRATIVO,
            'CEO': this.LEVELS.ADMINISTRATIVO,
            'Diretoria': this.LEVELS.ADMINISTRATIVO
        };

        // Permissões detalhadas por nível
        this.PERMISSIONS = {
            [this.LEVELS.ASSESSOR]: {
                // Páginas
                canAccessReports: false,
                canAccessConfiguration: false,
                // Edição
                canEditConfiguration: false,
                canEditBonus: false,
                canGenerateNextMonth: false,
                // Filtros
                filterLocked: true,
                lockedTeam: true,
                lockedCollaborator: true,
                description: 'Visualiza apenas seus próprios dados'
            },
            [this.LEVELS.SUPERVISAO]: {
                canAccessReports: true,
                canAccessConfiguration: true,          // apenas visualização
                canEditConfiguration: false,
                canEditBonus: false,
                canGenerateNextMonth: false,
                filterLocked: true,
                lockedTeam: true,                      // equipe travada
                lockedCollaborator: false,
                description: 'Visualiza dados da equipe; vê configurações sem editar'
            },
            [this.LEVELS.COORDENADOR]: {
                canAccessReports: true,
                canAccessConfiguration: true,
                canEditConfiguration: true,            // ajusta metas (pesos)
                canEditBonus: false,                   // não ajusta comissão
                canGenerateNextMonth: false,
                filterLocked: false,
                lockedTeam: false,
                lockedCollaborator: false,
                description: 'Ajusta metas, não altera bônus, filtro livre'
            },
            [this.LEVELS.ADMINISTRATIVO]: {
                canAccessReports: true,
                canAccessConfiguration: true,
                canEditConfiguration: true,
                canEditBonus: true,
                canGenerateNextMonth: true,
                filterLocked: false,
                lockedTeam: false,
                lockedCollaborator: false,
                description: 'Acesso total'
            }
        };
    }

    /**
     * Retorna o nível de acesso para um dado grupo (insensível a espaços e case).
     * @param {string} group - Nome do grupo
     * @returns {number} Nível
     */
    getAccessLevel(group) {
        if (!group) return this.LEVELS.ASSESSOR;
        const normalized = group.trim();
        for (const [key, level] of Object.entries(this.GROUP_MAPPING)) {
            if (normalized === key || normalized.toLowerCase() === key.toLowerCase()) {
                return level;
            }
        }
        console.warn(`Grupo não mapeado: "${group}", assumindo ASSESSOR`);
        return this.LEVELS.ASSESSOR;
    }

    /**
     * Verifica se o usuário possui uma permissão específica.
     * @param {object} user - Objeto do usuário (deve conter propriedade 'grupo')
     * @param {string} permission - Nome da permissão
     * @returns {boolean}
     */
    hasPermission(user, permission) {
        if (!user?.grupo) return false;
        const level = this.getAccessLevel(user.grupo);
        return this.PERMISSIONS[level]?.[permission] || false;
    }

    /**
     * Retorna o objeto completo de permissões para o usuário.
     * @param {object} user - Objeto do usuário
     * @returns {object} Permissões e informações do nível
     */
    getUserPermissions(user) {
        const level = this.getAccessLevel(user?.grupo);
        return {
            level,
            levelName: this.getLevelName(level),
            grupo: user?.grupo,
            ...this.PERMISSIONS[level]
        };
    }

    /**
     * Converte o código do nível para nome legível.
     * @param {number} level
     * @returns {string}
     */
    getLevelName(level) {
        const names = {
            [this.LEVELS.ASSESSOR]: 'ASSESSOR',
            [this.LEVELS.SUPERVISAO]: 'SUPERVISAO',
            [this.LEVELS.COORDENADOR]: 'COORDENADOR',
            [this.LEVELS.ADMINISTRATIVO]: 'ADMINISTRATIVO'
        };
        return names[level] || 'ASSESSOR';
    }

    /**
     * Filtra uma lista de membros da equipe conforme o nível do usuário.
     * @param {Array} teamMembers - Lista de membros
     * @param {object} currentUser - Usuário logado
     * @returns {Array} Lista filtrada
     */
    filterTeamData(teamMembers, currentUser) {
        if (!currentUser || !teamMembers) return [];
        const userLevel = this.getAccessLevel(currentUser.grupo);
        // Administrativo e Coordenador veem todos
        if (userLevel >= this.LEVELS.COORDENADOR) return teamMembers;
        // Supervisão vê apenas sua equipe
        if (userLevel === this.LEVELS.SUPERVISAO) {
            return teamMembers.filter(m => m.equipe === currentUser.equipe);
        }
        // Assessor vê apenas a si mesmo
        if (userLevel === this.LEVELS.ASSESSOR) {
            return teamMembers.filter(m => m.id === currentUser.id);
        }
        return [];
    }

    /**
     * Retorna as restrições de filtro (equipe/colaborador) de acordo com o usuário.
     * @param {object} user - Usuário logado
     * @returns {object} { lockTeam, teamName, lockCollaborator, collaboratorName }
     */
    getFilterRestrictions(user) {
        const permissions = this.getUserPermissions(user);
        if (!user) return { lockTeam: false, teamName: null, lockCollaborator: false, collaboratorName: null };

        // Assessor: trava equipe e colaborador
        if (permissions.level === this.LEVELS.ASSESSOR) {
            return {
                lockTeam: true,
                teamName: user.equipe,
                lockCollaborator: true,
                collaboratorName: user.name
            };
        }
        // Supervisão: trava apenas a equipe
        if (permissions.level === this.LEVELS.SUPERVISAO) {
            return {
                lockTeam: true,
                teamName: user.equipe,
                lockCollaborator: false,
                collaboratorName: null
            };
        }
        // Coordenador e Administrativo: sem restrições
        return {
            lockTeam: false,
            teamName: null,
            lockCollaborator: false,
            collaboratorName: null
        };
    }

    /**
     * Gera a configuração de UI baseada no nível de acesso.
     * @param {object} currentUser - Usuário logado
     * @returns {object} Configuração de UI
     */
    getUIConfig(currentUser) {
        const permissions = this.getUserPermissions(currentUser);
        const filterRestrictions = this.getFilterRestrictions(currentUser);

        return {
            // Permissões gerais
            ...permissions,
            // Itens de menu dinâmicos
            menuItems: this.getMenuItems(permissions),
            // Restrições de filtro
            filter: filterRestrictions,
            // Nome amigável do nível
            accessLevel: permissions.levelName,
            group: currentUser?.grupo
        };
    }

    /**
     * Gera a lista de itens de menu conforme as permissões.
     * @param {object} permissions - Objeto de permissões
     * @returns {Array} Itens de menu
     */
    getMenuItems(permissions) {
        const items = [];
        // Todos veem o dashboard
        items.push({ id: 'dashboard', label: 'Dashboard', link: '/' });
        // Equipe, relatórios e configurações conforme permissão
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
}

export const accessControl = new AccessControl();