// src/lib/calculator.ts

// ========== Tipos auxiliares ==========
export interface CalculatorConfig {
  pesoGanhos: number;
  pesoAssinados: number;
  bonusBase: number;
  comissaoPercentualPadrao: number;
  bonusExtraPorMeta: number;
}

export interface TeamMember {
  id?: string | number;
  nome?: string;
  ganhos?: number;
  assinados?: number;
  meta_individual?: number;
  meta_percentual?: number;
  comissao_percentual?: number;
}

export interface MemberDetail {
  id?: string | number;
  nome?: string;
  bateuMeta: boolean;
  bonus: number;
}

export interface TeamBonusResult {
  totalBonus: number;
  members: MemberDetail[];
  teamBonus?: number;
}

export interface RankedMember extends TeamMember {
  score: number;
  bateuMeta: boolean;
  comissao: number;
  bonus: number;
  ranking?: number;
}

/** Configuração para um período específico (diário, semanal, mensal) */
export interface PeriodCommissionConfig {
  pesoAssinados: number;
  pesoGanhos: number;
  bonusPorCiclo: number;
}

/** Resultado do cálculo para um período */
export interface PeriodCommissionResult {
  metasBatidas: number;
  comissao: number;
  pesoAssinados: number;
  pesoGanhos: number;
  bonus: number;
}

// ========== Classe Calculator ==========
export class Calculator {
  config: CalculatorConfig;

constructor() {
  this.config = {
    pesoGanhos: 60,           
    pesoAssinados: 60,        
    bonusBase: 10.0,
    comissaoPercentualPadrao: 5,
    bonusExtraPorMeta: 50.0,
  };
}

  /**
   * Verifica se o colaborador bateu a meta
   */
  checkGoal(
    ganhos: number,
    assinados: number,
    metaQuantidade: number = 10,
    metaPercentual: number = 70
  ): boolean {
    const pontuacaoGanhos = ganhos * this.config.pesoGanhos;
    const pontuacaoAssinados = assinados * this.config.pesoAssinados;
    const pontuacaoTotal = pontuacaoGanhos + pontuacaoAssinados;
    const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
    const atingiuQuantidade = pontuacaoTotal >= pontuacaoNecessaria;

    let atingiuPercentual = true;
    if (assinados > 0) {
      const percentualAprovacao = (assinados / (ganhos + assinados)) * 100;
      atingiuPercentual = percentualAprovacao >= metaPercentual;
    }

    return atingiuQuantidade && atingiuPercentual;
  }

  /**
   * Calcula o progresso em relação à meta (0-100)
   */
  calculateProgress(ganhos: number, metaQuantidade: number = 10): number {
    if (metaQuantidade <= 0) return 0;
    const pontuacaoAtual = ganhos * this.config.pesoGanhos;
    const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
    let progresso = (pontuacaoAtual / pontuacaoNecessaria) * 100;
    return Math.min(100, Math.max(0, progresso));
  }

  /**
   * Calcula quantos ganhos faltam para bater a meta
   */
  calculateRemainingToGoal(ganhos: number, metaQuantidade: number = 10): number {
    const pontuacaoAtual = ganhos * this.config.pesoGanhos;
    const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
    const pontuacaoFaltante = Math.max(0, pontuacaoNecessaria - pontuacaoAtual);
    return Math.ceil(pontuacaoFaltante / this.config.pesoGanhos);
  }

  /**
   * Calcula o bônus do colaborador
   */
  calculateBonus(
    metasBatidas: number,
    ganhos: number,
    metaQuantidade: number = 10,
    metaExtra: boolean = false
  ): number {
    let bonus = 0;

    if (metasBatidas > 0) {
      bonus += this.config.bonusBase;
      const pontuacao = ganhos * this.config.pesoGanhos;
      const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;

      if (pontuacao > pontuacaoNecessaria) {
        const excedente = pontuacao - pontuacaoNecessaria;
        const bonusExcedente =
          (excedente / this.config.pesoGanhos) * (this.config.bonusBase * 0.5);
        bonus += bonusExcedente;
      }
    }

    if (metaExtra) {
      bonus += this.config.bonusExtraPorMeta;
    }

    return Math.round(bonus * 100) / 100;
  }

  /**
   * Calcula a comissão do colaborador baseada nos assinados
   */
  calculateCommission(
    assinados: number,
    percentualComissao: number | null = null,
    valorPorAssinado: number = 100
  ): number {
    const percentual =
      percentualComissao ?? this.config.comissaoPercentualPadrao;
    const comissaoPorAssinado = (valorPorAssinado * percentual) / 100;
    const comissaoTotal = assinados * comissaoPorAssinado;
    return Math.round(comissaoTotal * 100) / 100;
  }

  /**
   * Calcula pontuação total do colaborador
   */
  calculateTotalScore(ganhos: number, assinados: number): number {
    return (
      ganhos * this.config.pesoGanhos + assinados * this.config.pesoAssinados
    );
  }

  /**
   * Calcula percentual de aproveitamento
   */
  calculateSuccessRate(ganhos: number, assinados: number): number {
    const total = ganhos + assinados;
    if (total === 0) return 0;
    return (assinados / total) * 100;
  }

  /**
   * Calcula bônus por equipe
   */
  calculateTeamBonus(
    teamMembers: TeamMember[],
    metaEquipe: number | null = null
  ): TeamBonusResult {
    let totalBonus = 0;
    const memberDetails: MemberDetail[] = [];

    for (const member of teamMembers) {
      const bateuMeta = this.checkGoal(
        member.ganhos || 0,
        member.assinados || 0,
        member.meta_individual || 10,
        member.meta_percentual || 70
      );

      const bonus = this.calculateBonus(
        bateuMeta ? 1 : 0,
        member.ganhos || 0,
        member.meta_individual || 10
      );

      totalBonus += bonus;
      memberDetails.push({
        id: member.id,
        nome: member.nome,
        bateuMeta,
        bonus,
      });
    }

    let teamBonus = 0;
    if (metaEquipe) {
      const membrosComMeta = memberDetails.filter((m) => m.bateuMeta).length;
      if (membrosComMeta >= metaEquipe) {
        teamBonus = this.config.bonusBase * 2;
        totalBonus += teamBonus;
      }
    }

    return {
      totalBonus: Math.round(totalBonus * 100) / 100,
      members: memberDetails,
      ...(teamBonus > 0 ? { teamBonus } : {}),
    };
  }

  /**
   * Atualiza configurações do calculador
   */
  updateConfig(newConfig: Partial<CalculatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Retorna configurações atuais
   */
  getConfig(): CalculatorConfig {
    return { ...this.config };
  }

  /**
   * Calcula ranking dos colaboradores
   */
  calculateRanking(members: TeamMember[]): RankedMember[] {
    const rankedMembers: RankedMember[] = members.map((member) => ({
      ...member,
      score: this.calculateTotalScore(
        member.ganhos || 0,
        member.assinados || 0
      ),
      bateuMeta: this.checkGoal(
        member.ganhos || 0,
        member.assinados || 0,
        member.meta_individual || 10,
        member.meta_percentual || 70
      ),
      comissao: this.calculateCommission(
        member.assinados || 0,
        member.comissao_percentual || 5
      ),
      bonus: this.calculateBonus(
        this.checkGoal(
          member.ganhos || 0,
          member.assinados || 0,
          member.meta_individual || 10,
          member.meta_percentual || 70
        )
          ? 1
          : 0,
        member.ganhos || 0,
        member.meta_individual || 10
      ),
    }));

    rankedMembers.sort((a, b) => b.score - a.score);
    rankedMembers.forEach((member, index) => {
      member.ranking = index + 1;
    });

    return rankedMembers;
  }

  /**
   * Calcula projeção de bônus baseado em desempenho atual
   */
  calculateProjection(
    ganhosAtuais: number,
    assinadosAtuais: number,
    diasRestantes: number,
    metaQuantidade: number = 10
  ) {
    const diasPassados = 30 - diasRestantes;

    if (diasPassados === 0) {
      return {
        ganhosProjetados: ganhosAtuais,
        assinadosProjetados: assinadosAtuais,
        projecaoMeta: false,
        ganhosNecessariosPorDia: 0,
      };
    }

    const mediaGanhosDiaria = ganhosAtuais / diasPassados;
    const mediaAssinadosDiaria = assinadosAtuais / diasPassados;

    const ganhosProjetados = ganhosAtuais + mediaGanhosDiaria * diasRestantes;
    const assinadosProjetados =
      assinadosAtuais + mediaAssinadosDiaria * diasRestantes;

    const projecaoMeta = this.checkGoal(
      Math.round(ganhosProjetados),
      Math.round(assinadosProjetados),
      metaQuantidade
    );

    const ganhosNecessarios = this.calculateRemainingToGoal(
      ganhosAtuais,
      metaQuantidade
    );
    const ganhosNecessariosPorDia =
      diasRestantes > 0
        ? Math.ceil(ganhosNecessarios / diasRestantes)
        : ganhosNecessarios;

    return {
      ganhosProjetados: Math.round(ganhosProjetados),
      assinadosProjetados: Math.round(assinadosProjetados),
      projecaoMeta,
      ganhosNecessariosPorDia,
    };
  }

  // ========== NOVOS MÉTODOS PARA COMISSIONAMENTO POR PERÍODO ==========

  /**
   * Calcula comissão baseada em metas batidas usando pesos de meta e bônus por ciclo.
   * @param assinados - Total de assinados no período
   * @param ganhos - Total de ganhos no período
   * @param weightAssinados - Quantos assinados equivalem a 1 meta batida
   * @param weightGanhos - Quantos ganhos equivalem a 1 meta batida (se <=0, ignora ganhos)
   * @param bonusValue - Valor do bônus por meta batida
   * @returns Comissão total estimada
   */
  calculateCycleCommission(
    assinados: number,
    ganhos: number,
    weightAssinados: number,
    weightGanhos: number,
    bonusValue: number
  ): number {
    if (weightAssinados <= 0) return 0;

    if (weightGanhos <= 0) {
      const metasBatidas = Math.floor(assinados / weightAssinados);
      return metasBatidas * bonusValue;
    }

    const metasBatidas = Math.floor(
      Math.min(assinados / weightAssinados, ganhos / weightGanhos)
    );
    return metasBatidas * bonusValue;
  }

  /**
   * Calcula o número de metas batidas para um período.
   * @param assinados - Total de assinados
   * @param ganhos - Total de ganhos
   * @param weightAssinados - Peso assinados
   * @param weightGanhos - Peso ganhos (se <=0, considera apenas assinados)
   * @returns Número inteiro de metas batidas
   */
  calculateMetasBatidas(
    assinados: number,
    ganhos: number,
    weightAssinados: number,
    weightGanhos: number
  ): number {
    if (weightAssinados <= 0) return 0;
    if (weightGanhos <= 0) {
      return Math.floor(assinados / weightAssinados);
    }
    return Math.floor(Math.min(assinados / weightAssinados, ganhos / weightGanhos));
  }

  /**
   * Calcula comissão para um único período com base na configuração fornecida.
   * @param assinados - Total de assinados
   * @param ganhos - Total de ganhos
   * @param config - Configuração do período (pesos e bônus)
   * @returns Resultado detalhado do período
   */
  calculatePeriodCommission(
    assinados: number,
    ganhos: number,
    config: PeriodCommissionConfig
  ): PeriodCommissionResult {
    const { pesoAssinados, pesoGanhos, bonusPorCiclo } = config;
    const metasBatidas = this.calculateMetasBatidas(
      assinados,
      ganhos,
      pesoAssinados,
      pesoGanhos
    );
    const comissao = metasBatidas * bonusPorCiclo;
    return {
      metasBatidas,
      comissao,
      pesoAssinados,
      pesoGanhos,
      bonus: bonusPorCiclo,
    };
  }

  /**
   * Calcula a comissão total para múltiplos períodos (ex: diário + semanal + mensal).
   * Cada período pode ter sua própria configuração de pesos e bônus.
   * @param assinados - Total de assinados (normalmente os mesmos para todos os períodos)
   * @param ganhos - Total de ganhos
   * @param periodsConfig - Array de configurações para cada período (ex: diário, semanal, mensal)
   * @returns Soma das comissões de todos os períodos e detalhes individuais
   */
  calculateTotalCommissionForPeriods(
    assinados: number,
    ganhos: number,
    periodsConfig: PeriodCommissionConfig[]
  ): { totalComissao: number; detalhes: PeriodCommissionResult[] } {
    let totalComissao = 0;
    const detalhes: PeriodCommissionResult[] = [];
    for (const config of periodsConfig) {
      const result = this.calculatePeriodCommission(assinados, ganhos, config);
      totalComissao += result.comissao;
      detalhes.push(result);
    }
    return { totalComissao, detalhes };
  }
}

// Instância única para uso em toda aplicação
export const calculator = new Calculator();