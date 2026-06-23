// src/pages/Ranking.tsx
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAppStore } from "@/lib/dataStore";
import {
  Trophy, Star, Crown, Medal, ArrowUp, ArrowDown, Minus,
  FileText, CheckCircle, Award, Users, User, Package, Briefcase, Loader2, RefreshCw, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RANKING_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663539696960/XjeLEb8phavPWoPR3fCUmm/madm-ranking-bg-ducCAYN4wgdYBLEESvf2bZ.webp";

// ============================================================
// CONFIGURAÇÃO DE PESOS (ajustado: emitidos=2, protocolados=1)
// ============================================================
const WEIGHTS: Record<SortMetric, number> = {
  ganhos: 4,
  assinados: 3,
  protocolados: 1,   // antes era 2
  emitidos: 2,       // antes era 1
};

// ============================================================
// CONSTANTES DE EXCLUSÃO
// ============================================================
const EXCLUDED_TEAMS = [
  'Equipe SAC', 'Sales Ops', 'Equipe', 'Equipe Lucilene', 'Equipe SDR','Equipe Camila',
  'Equipe Erica', 'Equipe Lucas', 'Equipe Irene', 'Equipe Maria Eduarda', 'SalesOps',
  'Equipe Murilo Balsalobre', 'Comercial', 'Backoffice', 'CEO', 'Prontuário','BackOffice',
  'Equipe Leonardo Cardoso', 'Equipe Julia', 'Equipe Leticia', 'Dr. Felipe Marx','Administrativo',
  'Equipe Thales','Financeiro'
];

const EXCLUDED_GROUPS = [
  "Supervisor", "Salesops", "Sales ops", "Coordenador", "CEO",
  "Diretoria", "Desativado", "Juridico", "Ultravita", "Diligencia",
  "Marketing", "Gerência", "Contrato", "Dr. Felipe Marx", "Administrativo",
  "administrativo"
];

type RankingType = "colaborador" | "equipe";
type SortMetric = "emitidos" | "assinados" | "protocolados" | "ganhos";

interface RankingItem {
  position: number;
  name: string;
  emitidos: number;
  assinados: number;
  protocolados: number;
  ganhos: number;
  score: number;
  avatar: string;
  trend: "up" | "down" | "same";
  isCurrentUser?: boolean;
  equipe?: string;
  id?: number;
}

interface TeamRankingItem {
  position: number;
  name: string;
  emitidos: number;
  assinados: number;
  protocolados: number;
  ganhos: number;
  score: number;
  avatar: string;
  trend: "up" | "down" | "same";
  membersCount: number;
}

const normalize = (str: string): string =>
  (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isExcludedTeam = (teamName: string) => EXCLUDED_TEAMS.includes(teamName);
const isExcludedGroup = (group: string) =>
  EXCLUDED_GROUPS.some(g => normalize(g) === normalize(group));

const isDesativado = (c: any) => {
  const grupo = normalize(c.grupo);
  const equipe = normalize(c.equipeNome);
  return grupo === 'desativado' || equipe.includes('desativado');
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
const teamToProductMapping: Record<string, string> = {
  "Equipe Concomitante": "Concomitante",
  "Equipe Quinquenio": "Quinquenio",
  "Equipe Quinquênio": "Quinquenio",
};

function RankBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ffcc00, #f5a623)" }}>
        <Crown className="w-4 h-4 text-white" />
      </div>
    );
  }
  if (position === 2) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)" }}>
        <Medal className="w-4 h-4 text-gray-600" />
      </div>
    );
  }
  if (position === 3) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}>
        <Medal className="w-4 h-4 text-white" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100">
      <span className="text-xs font-bold text-gray-500">#{position}</span>
    </div>
  );
}

/**
 * Calcula a pontuação ponderada com base nos pesos e nas métricas ativas.
 */
function calculateWeightedScore(
  item: { ganhos: number; assinados: number; protocolados: number; emitidos: number },
  activeMetrics: SortMetric[]
): number {
  let score = 0;
  for (const metric of activeMetrics) {
    const weight = WEIGHTS[metric] || 0;
    const value = item[metric] || 0;
    score += value * weight;
  }
  return score;
}

/**
 * Função de comparação: primeiro por score ponderado, depois pelos critérios de desempate
 * (ganhos, assinados, protocolados, emitidos) na ordem em que aparecem.
 */
function compareByScore(
  a: { ganhos: number; assinados: number; protocolados: number; emitidos: number; score: number },
  b: { ganhos: number; assinados: number; protocolados: number; emitidos: number; score: number },
  activeMetrics: SortMetric[]
): number {
  // 1º critério: score ponderado
  if (a.score !== b.score) return b.score - a.score;

  // Desempate: ganhos
  if (a.ganhos !== b.ganhos) return b.ganhos - a.ganhos;
  // depois assinados
  if (a.assinados !== b.assinados) return b.assinados - a.assinados;
  // depois protocolados
  if (a.protocolados !== b.protocolados) return b.protocolados - a.protocolados;
  // depois emitidos
  if (a.emitidos !== b.emitidos) return b.emitidos - a.emitidos;
  return 0;
}

export default function Ranking() {
  const {
    currentStartDate,
    currentEndDate,
    collaborators,
    equipeConfigs,
    currentUser,
    loadCollaboratorsAndMetrics,
    loadWeeklyPerformanceData,
    loadRawMetrics,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rankingType, setRankingType] = useState<RankingType>("colaborador");
  const [activeSortMetrics, setActiveSortMetrics] = useState<SortMetric[]>([
    "ganhos", "assinados", "protocolados", "emitidos"
  ]);
  const [selectedProduct, setSelectedProduct] = useState<string>("Todos");
  const [selectedTeam, setSelectedTeam] = useState<string>("todas");

  const initialLoadDone = useRef(false);
  const lastDatesRef = useRef({ start: currentStartDate, end: currentEndDate });
  const lastFiltersRef = useRef({ product: selectedProduct, team: selectedTeam, type: rankingType });

  // ========== Função de recarga ==========
  const reloadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      await loadCollaboratorsAndMetrics(undefined, undefined, undefined, undefined);
      await loadRawMetrics();
      await loadWeeklyPerformanceData();
    } catch (err) {
      console.error("Erro ao recarregar dados do Ranking:", err);
    } finally {
      if (showRefreshing) setRefreshing(false);
    }
  }, [loadCollaboratorsAndMetrics, loadRawMetrics, loadWeeklyPerformanceData]);

  // ========== Carregamento inicial ==========
  useEffect(() => {
    if (!currentStartDate || !currentEndDate) return;
    const datesChanged =
      currentStartDate !== lastDatesRef.current.start ||
      currentEndDate !== lastDatesRef.current.end;
    const filtersChanged =
      selectedProduct !== lastFiltersRef.current.product ||
      selectedTeam !== lastFiltersRef.current.team ||
      rankingType !== lastFiltersRef.current.type;

    if (initialLoadDone.current && !datesChanged && !filtersChanged) return;

    lastDatesRef.current = { start: currentStartDate, end: currentEndDate };
    lastFiltersRef.current = { product: selectedProduct, team: selectedTeam, type: rankingType };

    const load = async () => {
      setLoading(true);
      try {
        await reloadData(false);
        initialLoadDone.current = true;
      } catch (err) {
        console.error("Erro ao carregar dados do ranking:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentStartDate, currentEndDate, selectedProduct, selectedTeam, rankingType, reloadData]);

  // ========== Polling ==========
  useEffect(() => {
    if (!initialLoadDone.current || !currentStartDate || !currentEndDate) return;

    const refresh = async () => {
      if (refreshing) return;
      if (document.visibilityState === 'visible') {
        await reloadData(true);
      }
    };

    const intervalId = setInterval(refresh, 60000);
    return () => clearInterval(intervalId);
  }, [currentStartDate, currentEndDate, reloadData, refreshing]);

  // ========== Filtros ==========
  const productToGroup: Record<string, string | string[] | undefined> = {
    Todos: undefined,
    "Auxilio Acidente": "Elite",
    Quinquenio: ["Quinquenio", "Quinquênio"],
    Concomitante: "Concomitante",
  };
  const productOptions = ["Todos", "Auxilio Acidente", "Quinquenio", "Concomitante"];

  const equipeOptions = useMemo(() => {
    const equipeNomes = equipeConfigs
      .map((eq) => eq.nome)
      .filter((nome) => !isExcludedTeam(nome));
    return ["todas", ...equipeNomes];
  }, [equipeConfigs]);

  useEffect(() => {
    if (selectedTeam === "todas") return;
    if (teamToProductMapping[selectedTeam]) {
      const mappedProduct = teamToProductMapping[selectedTeam];
      if (selectedProduct !== mappedProduct && selectedProduct !== "Todos")
        setSelectedProduct(mappedProduct);
    } else {
      if (selectedProduct !== "Auxilio Acidente" && selectedProduct !== "Todos")
        setSelectedProduct("Auxilio Acidente");
    }
  }, [selectedTeam]);

  // ========== Colaboradores elegíveis ==========
  const rankingCollaborators = useMemo(() => {
    let filtered = collaborators.filter(c => {
      if (isDesativado(c)) return false;
      if (isExcludedGroup(c.grupo)) return false;
      if (isExcludedTeam(c.equipeNome)) return false;
      return true;
    });
    if (selectedProduct !== "Todos") {
      const group = productToGroup[selectedProduct];
      if (group) {
        if (Array.isArray(group)) {
          filtered = filtered.filter(c => group.includes(c.grupo));
        } else {
          filtered = filtered.filter(c => c.grupo === group);
        }
      }
    }
    if (rankingType === "colaborador" && selectedTeam !== "todas") {
      filtered = filtered.filter(c => c.equipeNome === selectedTeam);
    }
    return filtered;
  }, [collaborators, selectedProduct, rankingType, selectedTeam]);

  // ========== RANKING INDIVIDUAL ==========
  const individualRanking = useMemo(() => {
    let items: RankingItem[] = rankingCollaborators.map((colab) => {
      const base = {
        id: colab.id,
        name: colab.name,
        emitidos: Number(colab.emitidos) || 0,
        assinados: Number(colab.assinados) || 0,
        protocolados: Number(colab.protocolados) || 0,
        ganhos: Number(colab.ganhos) || 0,
        avatar: colab.avatar || colab.name.charAt(0).toUpperCase(),
        trend: "same" as const,
        isCurrentUser: colab.id === currentUser?.id,
        equipe: colab.equipeNome,
      };
      const score = calculateWeightedScore(base, activeSortMetrics);
      return { ...base, score, position: 0 };
    });
    items.sort((a, b) => compareByScore(a, b, activeSortMetrics));
    return items.map((item, idx) => ({ ...item, position: idx + 1 }));
  }, [rankingCollaborators, currentUser, activeSortMetrics]);

  // ========== RANKING DE EQUIPES ==========
  const teamRanking = useMemo(() => {
    const teamsMap = new Map<
      string,
      { emitidos: number; assinados: number; protocolados: number; ganhos: number; members: string[] }
    >();
    rankingCollaborators.forEach((collab) => {
      const equipe = collab.equipeNome;
      if (!equipe || isExcludedTeam(equipe)) return;
      if (!teamsMap.has(equipe)) {
        teamsMap.set(equipe, { emitidos: 0, assinados: 0, protocolados: 0, ganhos: 0, members: [] });
      }
      const team = teamsMap.get(equipe)!;
      team.emitidos += Number(collab.emitidos) || 0;
      team.assinados += Number(collab.assinados) || 0;
      team.protocolados += Number(collab.protocolados) || 0;
      team.ganhos += Number(collab.ganhos) || 0;
      team.members.push(collab.name);
    });
    let teamItems: TeamRankingItem[] = Array.from(teamsMap.entries()).map(([name, data]) => {
      const base = {
        name,
        emitidos: data.emitidos,
        assinados: data.assinados,
        protocolados: data.protocolados,
        ganhos: data.ganhos,
        avatar: name.charAt(0).toUpperCase(),
        trend: "same" as const,
        membersCount: data.members.length,
      };
      const score = calculateWeightedScore(base, activeSortMetrics);
      return { ...base, score, position: 0 };
    });
    teamItems.sort((a, b) => compareByScore(a, b, activeSortMetrics));
    return teamItems.map((item, idx) => ({ ...item, position: idx + 1 }));
  }, [rankingCollaborators, activeSortMetrics]);

  const activeRanking = rankingType === "colaborador" ? individualRanking : teamRanking;
  const top3 = activeRanking.slice(0, 3);

  const myIndividualRank = useMemo(
    () => individualRanking.find((item) => item.isCurrentUser),
    [individualRanking]
  );
  const myTeamRank = useMemo(() => {
    if (rankingType !== "equipe" || !currentUser?.equipe) return null;
    return teamRanking.find((team) => team.name === currentUser.equipe);
  }, [rankingType, teamRanking, currentUser]);

  const positionsToTop = myIndividualRank
    ? myIndividualRank.position - 1
    : myTeamRank
    ? myTeamRank.position - 1
    : 0;

  const currentUserData = useMemo(() => {
    if (!currentUser?.id) return null;
    return collaborators.find(c => c.id === currentUser.id);
  }, [collaborators, currentUser]);

  const myEmitidos = currentUserData?.emitidos || 0;
  const myAssinados = currentUserData?.assinados || 0;
  const myProtocolados = currentUserData?.protocolados || 0;
  const myGanhos = currentUserData?.ganhos || 0;

  const getAvatar = (item: any) =>
    rankingType === "colaborador" ? item.avatar || item.name.charAt(0) : item.avatar;
  const getPodiumStyle = (position: number) => {
    if (position === 1) return { background: "linear-gradient(135deg, #ffcc00, #f59e0b)", color: "white", boxShadow: "0 0 0 4px rgba(241, 207, 14, 0.3)" };
    if (position === 2) return { background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)", color: "#475569" };
    return { background: "linear-gradient(135deg, #d97706, #b45309)", color: "white" };
  };

  const toggleSortMetric = (metric: SortMetric) => {
    setActiveSortMetrics((prev) => {
      if (prev.includes(metric)) {
        const newArr = prev.filter((m) => m !== metric);
        return newArr.length === 0 ? ["ganhos"] : newArr;
      } else {
        return [...prev, metric];
      }
    });
  };

  const metricLabels: Record<SortMetric, string> = {
    emitidos: "Emitidos",
    assinados: "Assinados",
    protocolados: "Protocolados",
    ganhos: "Ganhos",
  };

  if (loading && collaborators.length === 0) {
    return (
      <DashboardLayout title="Ranking" subtitle="Carregando dados...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Carregando ranking...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (activeRanking.length === 0 && !loading) {
    return (
      <DashboardLayout title="Ranking" subtitle="Nenhum dado encontrado">
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <p>Nenhum colaborador encontrado para os filtros atuais.</p>
            <p className="text-sm">Verifique se os dados do período foram carregados.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Ranking de Vendedores"
      subtitle="Veja quem são os melhores vendedores do mês e acompanhe sua posição!"
    >
      {/* Indicador de atualização */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {refreshing && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Atualizando dados...</span>
          </div>
        )}
        <span className="text-[10px] text-gray-400">
          Atualizado {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Banner */}
      <div
        className="relative rounded-2xl overflow-hidden mb-6 animate-fade-in-up"
        style={{ backgroundImage: `url(${RANKING_BG})`, backgroundSize: "cover", backgroundPosition: "center", minHeight: "180px" }}
      >
        <div className="absolute inset-0 rounded-2xl" style={{ background: "rgba(9, 23, 91, 0.65)" }} />
        <div className="relative z-10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-[#ffcc00]" />
              <span className="text-[#ffcc00] text-sm font-bold uppercase tracking-wide">Ranking do Mês</span>
            </div>
            <h2 className="text-white text-2xl font-black mb-1">
              {rankingType === "colaborador"
                ? `Você está em ${myIndividualRank ? `#${myIndividualRank.position}` : "?"} lugar`
                : myTeamRank
                ? `Sua equipe está em #${myTeamRank.position} lugar`
                : "Sua equipe não está no ranking"}
            </h2>
            <p className="text-white/70 text-sm">
              {rankingType === "colaborador"
                ? positionsToTop > 0
                  ? `Suba ${positionsToTop} ${positionsToTop === 1 ? "posição" : "posições"} para liderar o ranking!`
                  : "Parabéns! Você está no topo do ranking!"
                : !myTeamRank
                ? "Sua equipe não está cadastrada ou não possui membros no período."
                : myTeamRank.position > 1
                ? `Subam ${myTeamRank.position - 1} ${myTeamRank.position - 1 === 1 ? "posição" : "posições"} para liderar o ranking de equipes!`
                : "Parabéns! Sua equipe lidera o ranking!"}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 justify-end mb-1">
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#ffcc00]" />
                <span className="text-white/60 text-[10px]">Emitidos</span>
                <span className="text-white font-bold text-sm">{myEmitidos}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[#ffcc00]" />
                <span className="text-white/60 text-[10px]">Assinados</span>
                <span className="text-white font-bold text-sm">{myAssinados}</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="w-3 h-3 text-[#ffcc00]" />
                <span className="text-white/60 text-[10px]">Protocolados</span>
                <span className="text-white font-bold text-sm">{myProtocolados}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#ffcc00]" />
                <span className="text-white/60 text-[10px]">Ganhos</span>
                <span className="text-white font-bold text-sm">{Math.round(myGanhos)}</span>
              </div>
            </div>
            <div className="text-white/50 text-[10px]">Total no período</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setRankingType("colaborador")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", rankingType === "colaborador" ? "bg-white text-[#09175b] shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            <User className="w-3.5 h-3.5" /> Colaborador
          </button>
          <button
            onClick={() => setRankingType("equipe")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", rankingType === "equipe" ? "bg-white text-[#09175b] shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            <Users className="w-3.5 h-3.5" /> Equipe
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 flex-wrap">
          {(["ganhos", "assinados", "protocolados", "emitidos"] as SortMetric[]).map((metric) => (
            <label key={metric} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={activeSortMetrics.includes(metric)}
                onChange={() => toggleSortMetric(metric)}
                className="w-3.5 h-3.5 accent-[#09175b]"
              />
              <span className="text-gray-700">{metricLabels[metric]}</span>
              <span className="text-[10px] text-gray-400 font-normal">(peso {WEIGHTS[metric]})</span>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <Package className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none"
            aria-label="Filtrar ranking por produto"
            title="Filtrar ranking por produto"
          >
            {productOptions.map((prod) => (<option key={prod} value={prod}>{prod}</option>))}
          </select>
        </div>

        {rankingType === "colaborador" && (
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <Briefcase className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none"
              aria-label="Filtrar ranking por equipe"
              title="Filtrar ranking por equipe"
            >
              {equipeOptions.map((equipe) => (<option key={equipe} value={equipe}>{equipe === "todas" ? "Todas as equipes" : equipe}</option>))}
            </select>
          </div>
        )}
      </div>

      {/* Top 3 */}
      {top3.length >= 3 && (
        <div className="madm-card p-6 mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-4 h-4 text-[#34a853] fill-[#34a853]" />
            <h3 className="text-sm font-bold text-[#09175b]">Top 3 — {rankingType === "colaborador" ? "Melhores Vendedores" : "Melhores Equipes"}</h3>
          </div>
          <div className="flex items-end justify-center gap-4">
            {top3[1] && (
              <div className="flex flex-col items-center flex-1 max-w-36">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)", color: "#475569" }}>{getAvatar(top3[1])}</div>
                <div className="text-xs font-bold text-gray-700 text-center mb-1">{top3[1].name}</div>
                <div className="w-full rounded-t-xl flex flex-col items-center justify-end py-4" style={{ background: "linear-gradient(180deg, #e2e8f0, #cbd5e1)", height: "80px" }}><span className="text-2xl font-black text-gray-600">2</span></div>
              </div>
            )}
            {top3[0] && (
              <div className="flex flex-col items-center flex-1 max-w-36">
                <div className="relative mb-2"><div className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold" style={getPodiumStyle(1)}>{getAvatar(top3[0])}</div><div className="absolute -top-2 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#ffcc00" }}><Crown className="w-3.5 h-3.5 text-white" /></div></div>
                <div className="text-xs font-bold text-[#09175b] text-center mb-1">{top3[0].name}</div>
                <div className="w-full rounded-t-xl flex flex-col items-center justify-end py-4" style={{ background: "linear-gradient(180deg, #ffcc00, #f59e0b)", height: "110px" }}><span className="text-3xl font-black text-white">1</span></div>
              </div>
            )}
            {top3[2] && (
              <div className="flex flex-col items-center flex-1 max-w-36">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold mb-2" style={{ background: "linear-gradient(135deg, #d97706, #b45309)", color: "white" }}>{getAvatar(top3[2])}</div>
                <div className="text-xs font-bold text-gray-700 text-center mb-1">{top3[2].name}</div>
                <div className="w-full rounded-t-xl flex flex-col items-center justify-end py-4" style={{ background: "linear-gradient(180deg, #d97706, #b45309)", height: "65px" }}><span className="text-xl font-black text-white">3</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela completa - remoção da coluna de tendência */}
      <div className="madm-card animate-fade-in-up">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-[#09175b]">Classificação Completa — {rankingType === "colaborador" ? "Colaboradores" : "Equipes"}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {activeRanking.length} {rankingType === "colaborador" ? "consultores" : "equipes"} no ranking
            <span className="ml-2 text-[#09175b] font-medium">• Ordenado por Pontuação Ponderada</span>
          </p>
        </div>

        {/* Cabeçalho da tabela sem a coluna de tendência */}
        <div className="px-5 py-2 border-b border-gray-100 hidden md:grid" style={{ gridTemplateColumns: "60px 56px minmax(180px, 1fr) 90px 90px 90px 90px 90px", gap: "0.75rem" }}>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Pos</div>
          <div></div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nome</div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Emitidos</div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Assinados</div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Protocolados</div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Ganhos</div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Score</div>
        </div>

        {/* Linhas da tabela sem o ícone de tendência */}
        <div className="divide-y divide-gray-50">
          {activeRanking.map((person) => {
            const isTop3 = person.position <= 3;
            const isMe = rankingType === "colaborador" && (person as RankingItem).isCurrentUser;
            const isCurrentUserTeam = rankingType === "equipe" && currentUser && person.name === currentUser.equipe;
            const highlight = isMe || isCurrentUserTeam;
            return (
              <div
                key={person.position}
                className={cn("flex flex-col md:grid items-center px-5 py-4 transition-colors", highlight ? "bg-[#eff6ff]" : "hover:bg-gray-50/50")}
                style={{ gridTemplateColumns: "60px 56px minmax(180px, 1fr) 90px 90px 90px 90px 90px", gap: "0.75rem", ...(highlight ? { borderLeft: "3px solid #09175b" } : {}) }}
              >
                <div><RankBadge position={person.position} /></div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={isTop3 ? getPodiumStyle(person.position) : highlight ? { background: "#09175b", color: "#34a853" } : { background: "#f3f4f6", color: "#6b7280" }}>{getAvatar(person)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-semibold truncate", highlight ? "text-[#09175b]" : "text-gray-800")}>{person.name}</span>
                    {highlight && rankingType === "colaborador" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#09175b", color: "#34a853" }}>VOCÊ</span>}
                    {highlight && rankingType === "equipe" && currentUser && person.name === currentUser.equipe && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#09175b", color: "#34a853" }}>SUA EQUIPE</span>}
                    {isTop3 && <Star className="w-3 h-3 text-[#34a853] fill-[#34a853] flex-shrink-0" />}
                    {rankingType === "equipe" && "membersCount" in person && <span className="text-[10px] text-gray-400 ml-1">({(person as TeamRankingItem).membersCount} membros)</span>}
                  </div>
                </div>
                <div className="text-center text-sm font-bold text-[#09175b] whitespace-nowrap">{person.emitidos}</div>
                <div className="text-center text-sm font-bold text-[#34a853] whitespace-nowrap">{person.assinados}</div>
                <div className="text-center text-sm font-bold text-[#045b5b] whitespace-nowrap">{person.protocolados}</div>
                <div className="text-center text-sm font-bold text-[#f59e0b] whitespace-nowrap">{Math.round(person.ganhos)}</div>
                <div className="text-center text-sm font-bold text-[#09175b] whitespace-nowrap">{person.score.toFixed(1)}</div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Pontuação = Σ (valor da métrica × peso). Pesos atuais: {activeSortMetrics.map(m => `${metricLabels[m]} (${WEIGHTS[m]})`).join(' + ')}
            {activeSortMetrics.length === 0 && " (nenhuma métrica selecionada)"}
            <br />
            {selectedProduct !== "Todos" && ` • Produto: ${selectedProduct}`}
            {rankingType === "colaborador" && selectedTeam !== "todas" && ` • Equipe: ${selectedTeam}`}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
