// calculator.js - Sistema de Cálculo de Metas, Comissões e Bônus

export class Calculator {
    constructor() {
        // Configurações padrão (ajustáveis)
        this.config = {
            // Pesos para bater meta (ganhos e assinados)
            pesoGanhos: 3,
            pesoAssinados: 3,
            
            // Valor base do bônus em reais
            bonusBase: 10.00,
            
            // Percentual padrão de comissão (%)
            comissaoPercentualPadrao: 5,
            
            // Bônus adicional por meta extra
            bonusExtraPorMeta: 50.00
        };
    }

    /**
     * Verifica se o colaborador bateu a meta
     * @param {number} ganhos - Quantidade de ganhos do colaborador
     * @param {number} assinados - Quantidade de assinados do colaborador
     * @param {number} metaQuantidade - Meta de quantidade (padrão: 10)
     * @param {number} metaPercentual - Meta percentual (padrão: 70)
     * @returns {boolean} - True se bateu a meta, False caso contrário
     */
    checkGoal(ganhos, assinados, metaQuantidade = 10, metaPercentual = 70) {
        // Calcula pontuação ponderada
        const pontuacaoGanhos = ganhos * this.config.pesoGanhos;
        const pontuacaoAssinados = assinados * this.config.pesoAssinados;
        const pontuacaoTotal = pontuacaoGanhos + pontuacaoAssinados;
        
        // Pontuação necessária para bater meta
        const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
        
        // Verifica se atingiu a quantidade mínima
        const atingiuQuantidade = pontuacaoTotal >= pontuacaoNecessaria;
        
        // Verifica percentual de aproveitamento (se tiver assinados)
        let atingiuPercentual = true;
        if (assinados > 0) {
            const percentualAprovacao = (assinados / (ganhos + assinados)) * 100;
            atingiuPercentual = percentualAprovacao >= metaPercentual;
        }
        
        // Bateu a meta se atingiu quantidade E percentual
        return atingiuQuantidade && atingiuPercentual;
    }

    /**
     * Calcula o progresso em relação à meta
     * @param {number} ganhos - Quantidade de ganhos
     * @param {number} metaQuantidade - Meta de quantidade
     * @returns {number} - Percentual de progresso (0-100)
     */
    calculateProgress(ganhos, metaQuantidade = 10) {
        if (metaQuantidade <= 0) return 0;
        
        // Usa pontuação ponderada para calcular progresso
        const pontuacaoAtual = ganhos * this.config.pesoGanhos;
        const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
        
        let progresso = (pontuacaoAtual / pontuacaoNecessaria) * 100;
        progresso = Math.min(100, Math.max(0, progresso));
        
        return progresso;
    }

    /**
     * Calcula quantos ganhos faltam para bater a meta
     * @param {number} ganhos - Quantidade atual de ganhos
     * @param {number} metaQuantidade - Meta de quantidade
     * @returns {number} - Quantidade faltante (0 se já bateu)
     */
    calculateRemainingToGoal(ganhos, metaQuantidade = 10) {
        const pontuacaoAtual = ganhos * this.config.pesoGanhos;
        const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
        
        const pontuacaoFaltante = Math.max(0, pontuacaoNecessaria - pontuacaoAtual);
        const ganhosFaltantes = Math.ceil(pontuacaoFaltante / this.config.pesoGanhos);
        
        return ganhosFaltantes;
    }

    /**
     * Calcula o bônus do colaborador
     * @param {number} metasBatidas - Quantidade de metas batidas (0 ou 1 para meta base)
     * @param {number} ganhos - Quantidade de ganhos
     * @param {number} metaQuantidade - Meta de quantidade
     * @param {boolean} metaExtra - Se bateu meta extra (opcional)
     * @returns {number} - Valor do bônus
     */
    calculateBonus(metasBatidas, ganhos, metaQuantidade = 10, metaExtra = false) {
        let bonus = 0;
        
        // Bônus base por bater meta
        if (metasBatidas > 0) {
            bonus += this.config.bonusBase;
            
            // Bônus adicional por desempenho superior
            const pontuacao = ganhos * this.config.pesoGanhos;
            const pontuacaoNecessaria = metaQuantidade * this.config.pesoGanhos;
            
            if (pontuacao > pontuacaoNecessaria) {
                const excedente = pontuacao - pontuacaoNecessaria;
                const bonusExcedente = (excedente / this.config.pesoGanhos) * (this.config.bonusBase * 0.5);
                bonus += bonusExcedente;
            }
        }
        
        // Bônus por meta extra
        if (metaExtra) {
            bonus += this.config.bonusExtraPorMeta;
        }
        
        return Math.round(bonus * 100) / 100;
    }

    /**
     * Calcula a comissão do colaborador
     * @param {number} assinados - Quantidade de assinados
     * @param {number} percentualComissao - Percentual de comissão (%)
     * @param {number} valorPorAssinado - Valor base por assinado (padrão: 100)
     * @returns {number} - Valor da comissão
     */
    calculateCommission(assinados, percentualComissao = null, valorPorAssinado = 100) {
        const percentual = percentualComissao || this.config.comissaoPercentualPadrao;
        const comissaoPorAssinado = (valorPorAssinado * percentual) / 100;
        const comissaoTotal = assinados * comissaoPorAssinado;
        
        return Math.round(comissaoTotal * 100) / 100;
    }

    /**
     * Calcula pontuação total do colaborador
     * @param {number} ganhos - Quantidade de ganhos
     * @param {number} assinados - Quantidade de assinados
     * @returns {number} - Pontuação total ponderada
     */
    calculateTotalScore(ganhos, assinados) {
        return (ganhos * this.config.pesoGanhos) + (assinados * this.config.pesoAssinados);
    }

    /**
     * Calcula percentual de aproveitamento
     * @param {number} ganhos - Quantidade de ganhos
     * @param {number} assinados - Quantidade de assinados
     * @returns {number} - Percentual de aproveitamento (0-100)
     */
    calculateSuccessRate(ganhos, assinados) {
        const total = ganhos + assinados;
        if (total === 0) return 0;
        return (assinados / total) * 100;
    }

    /**
     * Calcula bônus por equipe
     * @param {Array} teamMembers - Array de membros da equipe
     * @param {number} metaEquipe - Meta da equipe
     * @returns {Object} - Objeto com total de bônus e detalhes por membro
     */
    calculateTeamBonus(teamMembers, metaEquipe = null) {
        let totalBonus = 0;
        const memberDetails = [];
        
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
                bonus
            });
        }
        
        // Bônus extra para equipe se atingir meta coletiva
        if (metaEquipe) {
            const membrosComMeta = memberDetails.filter(m => m.bateuMeta).length;
            if (membrosComMeta >= metaEquipe) {
                const bonusEquipe = this.config.bonusBase * 2;
                totalBonus += bonusEquipe;
                memberDetails.teamBonus = bonusEquipe;
            }
        }
        
        return {
            totalBonus: Math.round(totalBonus * 100) / 100,
            members: memberDetails
        };
    }

    /**
     * Atualiza configurações do calculador
     * @param {Object} newConfig - Novas configurações
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
    }

    /**
     * Retorna configurações atuais
     * @returns {Object} - Configurações atuais
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Calcula ranking dos colaboradores
     * @param {Array} members - Array de membros com seus dados
     * @returns {Array} - Array ordenado por pontuação
     */
    calculateRanking(members) {
        const rankedMembers = members.map(member => ({
            ...member,
            score: this.calculateTotalScore(member.ganhos || 0, member.assinados || 0),
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
                ) ? 1 : 0,
                member.ganhos || 0,
                member.meta_individual || 10
            )
        }));
        
        // Ordenar por pontuação (maior para menor)
        rankedMembers.sort((a, b) => b.score - a.score);
        
        // Adicionar posição no ranking
        rankedMembers.forEach((member, index) => {
            member.ranking = index + 1;
        });
        
        return rankedMembers;
    }

    /**
     * Calcula projeção de bônus baseado em desempenho atual
     * @param {number} ganhosAtuais - Ganhos atuais
     * @param {number} assinadosAtuais - Assinados atuais
     * @param {number} diasRestantes - Dias restantes no período
     * @param {number} metaQuantidade - Meta de quantidade
     * @returns {Object} - Projeção de resultados
     */
    calculateProjection(ganhosAtuais, assinadosAtuais, diasRestantes, metaQuantidade = 10) {
        const diasPassados = 30 - diasRestantes; // Assumindo mês de 30 dias
        
        if (diasPassados === 0) {
            return {
                ganhosProjetados: ganhosAtuais,
                assinadosProjetados: assinadosAtuais,
                projecaoMeta: false,
                ganhosNecessariosPorDia: 0
            };
        }
        
        // Média diária
        const mediaGanhosDiaria = ganhosAtuais / diasPassados;
        const mediaAssinadosDiaria = assinadosAtuais / diasPassados;
        
        // Projeção final
        const ganhosProjetados = ganhosAtuais + (mediaGanhosDiaria * diasRestantes);
        const assinadosProjetados = assinadosAtuais + (mediaAssinadosDiaria * diasRestantes);
        
        // Verifica se projetado bate meta
        const projecaoMeta = this.checkGoal(
            Math.round(ganhosProjetados),
            Math.round(assinadosProjetados),
            metaQuantidade
        );
        
        // Ganhos necessários por dia para bater meta
        const ganhosNecessarios = this.calculateRemainingToGoal(ganhosAtuais, metaQuantidade);
        const ganhosNecessariosPorDia = diasRestantes > 0 ? 
            Math.ceil(ganhosNecessarios / diasRestantes) : ganhosNecessarios;
        
        return {
            ganhosProjetados: Math.round(ganhosProjetados),
            assinadosProjetados: Math.round(assinadosProjetados),
            projecaoMeta,
            ganhosNecessariosPorDia
        };
    }
}

// Exportar instância única para uso em toda aplicação
export const calculator = new Calculator();