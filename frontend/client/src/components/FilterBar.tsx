// src/components/FilterBar.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Filter, Users, Briefcase, Search, X, Package, Loader2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/lib/dataStore";
import { useAccessControl } from "@/hooks/useAccessControl";
import { cn } from "@/lib/utils";
import { fetchCollaborators, fetchEquipes } from "@/lib/api";

interface FilterBarProps {
  onFilterChange: (filters: { equipe: string; colaborador: string; colaboradorId?: number; produto: string }) => void;
  showColaboradorFilter?: boolean;
  className?: string;
  initialEquipe?: string;
  initialColaborador?: string;
  initialProduto?: string;
}

const normalize = (str: string): string => (str || '').trim().toLowerCase();

const EXCLUDED_TEAMS = [
  'Equipe SAC', 'Sales Ops', 'Equipe', 'Equipe Lucilene', 'Equipe SDR','Equipe Camila',
  'Equipe Erica', 'Equipe Lucas', 'Equipe Irene', 'Equipe Maria Eduarda', 'SalesOps',
  'Equipe Murilo Balsalobre', 'Comercial', 'Backoffice', 'CEO', 'Prontuário','BackOffice',
  'Equipe Leonardo Cardoso', 'Equipe Julia', 'Equipe Leticia', 'Dr. Felipe Marx','Administrativo',
  'Equipe Thales','Financeiro'
];

const isExcludedTeam = (teamName: string): boolean => {
  if (!teamName) return false;
  const n = normalize(teamName);
  return EXCLUDED_TEAMS.some((t) => normalize(t) === n);
};

const TEAM_TO_PRODUCT: Record<string, string> = {
  "Equipe Concomitante": "Concomitante",
  "Equipe Quinquenio": "Quinquenio",
  "Equipe Quinquênio": "Quinquenio",
};

const PRODUCT_TO_TEAM: Record<string, string> = {
  Concomitante: "Equipe Concomitante",
  Quinquenio: "Equipe Quinquenio",
};

const PRODUCT_OPTIONS = ["Todos", "Auxilio Acidente", "Quinquenio", "Concomitante"];

export default function FilterBar({
  onFilterChange,
  showColaboradorFilter = true,
  className,
  initialEquipe = "todas",
  initialColaborador = "todos",
  initialProduto = "Todos",
}: FilterBarProps) {
  const { collaborators, equipeConfigs, setCollaborators, setEquipeConfigs } = useAppStore();
  const { currentUser, getAccessLevel, LEVELS } = useAccessControl();

  const [selectedEquipe, setSelectedEquipe] = useState(initialEquipe);
  const [selectedColaborador, setSelectedColaborador] = useState(initialColaborador);
  const [selectedProduto, setSelectedProduto] = useState(initialProduto);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingEquipes, setLoadingEquipes] = useState(false);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [colabError, setColabError] = useState<string | null>(null);

  const userLevel = getAccessLevel();
  const isAssessor = userLevel === LEVELS.ASSESSOR;
  const isSupervisor = userLevel === LEVELS.SUPERVISAO;
  const isAdminOrCoord = userLevel >= LEVELS.COORDENADOR;

  // ========== CARREGA EQUIPES ==========
  useEffect(() => {
    let mounted = true;
    const loadEquipes = async () => {
      if (equipeConfigs.length > 0) return;
      setLoadingEquipes(true);
      try {
        const equipes = await fetchEquipes();
        if (mounted) {
          setEquipeConfigs(
            equipes.map((eq: any) => ({
              id: eq.id?.toString() || `equipe_${Math.random()}`,
              nome: eq.nome,
              pesoAssinados: 3,
              pesoGanhos: 3,
              pesoequipeAssinados: 0,
              pesoequipeGanhos: 0,
              bonus: 150,
            }))
          );
        }
      } catch (error: any) {
        console.error("Erro ao carregar equipes:", error);
        if (error.message?.includes('401')) {
          window.location.href = '/login';
        }
      } finally {
        if (mounted) setLoadingEquipes(false);
      }
    };
    loadEquipes();
    return () => { mounted = false; };
  }, [equipeConfigs.length, setEquipeConfigs]);

  // ========== CARREGA COLABORADORES ==========
  useEffect(() => {
    let mounted = true;
    const loadColabs = async () => {
      if (collaborators.length > 0) return;
      setLoadingCollaborators(true);
      setColabError(null);
      try {
        const collabs = await fetchCollaborators();
        if (mounted) setCollaborators(collabs);
      } catch (error: any) {
        console.error("Erro ao carregar colaboradores:", error);
        if (error.message?.includes('401')) {
          window.location.href = '/login';
          return;
        }
        if (mounted) setColabError(error.message || "Falha ao carregar colaboradores");
      } finally {
        if (mounted) setLoadingCollaborators(false);
      }
    };
    loadColabs();
    return () => { mounted = false; };
  }, [collaborators.length, setCollaborators]);

  // ========== RESTRIÇÕES DE ACESSO ==========
  useEffect(() => {
    if (!currentUser) return;
    if (isAssessor) {
      if (currentUser.equipe) setSelectedEquipe(currentUser.equipe);
      if (currentUser.name) setSelectedColaborador(currentUser.name);
    } else if (isSupervisor) {
      if (currentUser.equipe) setSelectedEquipe(currentUser.equipe);
      setSelectedColaborador("todos");
    } else if (isAdminOrCoord) {
      setSelectedEquipe(initialEquipe);
      setSelectedColaborador(initialColaborador);
    }
  }, [currentUser, isAssessor, isSupervisor, isAdminOrCoord, initialEquipe, initialColaborador]);

  // ========== Sincronia equipe <-> produto ==========
  useEffect(() => {
    if (selectedEquipe && TEAM_TO_PRODUCT[selectedEquipe]) {
      const mapped = TEAM_TO_PRODUCT[selectedEquipe];
      if (selectedProduto !== mapped) setSelectedProduto(mapped);
    } else if (selectedProduto && PRODUCT_TO_TEAM[selectedProduto]) {
      const mapped = PRODUCT_TO_TEAM[selectedProduto];
      if (selectedEquipe !== mapped) setSelectedEquipe(mapped);
    }
  }, [selectedEquipe, selectedProduto]);

  // ========== LISTA DE EQUIPES (filtrada) ==========
  const equipesDisponiveis = useMemo(() => {
    let nomes = equipeConfigs.map((eq) => eq.nome).filter((nome) => !isExcludedTeam(nome));
    if ((isAssessor || isSupervisor) && currentUser?.equipe) {
      const normUserEquipe = normalize(currentUser.equipe);
      nomes = nomes.filter((nome) => normalize(nome) === normUserEquipe);
    }
    return ["todas", ...nomes];
  }, [equipeConfigs, isAssessor, isSupervisor, currentUser]);

  // ========== COLABORADORES FILTRADOS ==========
  const filteredColaboradores = useMemo(() => {
    if (!collaborators.length) return [];
    let filtered = [...collaborators];
    filtered = filtered.filter((c) => !isExcludedTeam(c.equipeNome));
    filtered = filtered.filter((c) => normalize(c.grupo) !== 'administrativo');

    let effectiveEquipe = selectedEquipe;
    if ((isAssessor || isSupervisor) && currentUser?.equipe) {
      effectiveEquipe = currentUser.equipe;
    }

    if (effectiveEquipe && effectiveEquipe !== "todas") {
      filtered = filtered.filter((c) => normalize(c.equipeNome) === normalize(effectiveEquipe));
    }

    if (isAssessor && currentUser) {
      filtered = filtered.filter((c) => c.id === currentUser.id);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) => c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [collaborators, selectedEquipe, isAssessor, isSupervisor, currentUser, searchTerm]);

  // ========== 🔥 NOVO: AJUSTA EQUIPE AUTOMATICAMENTE QUANDO COLABORADOR É SELECIONADO ==========
  useEffect(() => {
    // Se não houver colaboradores ou se for "todos", não faz nada
    if (selectedColaborador === "todos" || !collaborators.length) return;
    // Se for assessor ou supervisor, a equipe é fixa, não alteramos
    if (isAssessor || isSupervisor) return;

    // Encontra o colaborador selecionado
    const colab = collaborators.find(c => c.name === selectedColaborador);
    if (colab && colab.equipeNome) {
      const equipeDoColab = colab.equipeNome;
      // Só atualiza se a equipe atual for diferente e se a equipe existir na lista
      if (selectedEquipe !== equipeDoColab && equipesDisponiveis.includes(equipeDoColab)) {
        setSelectedEquipe(equipeDoColab);
      }
    }
  }, [selectedColaborador, collaborators, isAssessor, isSupervisor, selectedEquipe, equipesDisponiveis]);

  // ========== NOTIFICAR PARENT ==========
  const onFilterChangeRef = useRef(onFilterChange);
  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  }, [onFilterChange]);

  useEffect(() => {
    let finalEquipe = selectedEquipe;
    let finalColaborador = selectedColaborador;
    if (isAssessor && currentUser) {
      finalEquipe = currentUser.equipe || "todas";
      finalColaborador = currentUser.name || "todos";
    } else if (isSupervisor && currentUser) {
      finalEquipe = currentUser.equipe || "todas";
      finalColaborador = selectedColaborador;
    }

    const colaboradorId =
      finalColaborador !== "todos"
        ? collaborators.find((c) => c.name === finalColaborador)?.id
        : undefined;

    onFilterChangeRef.current({
      equipe: finalEquipe,
      colaborador: finalColaborador,
      colaboradorId,
      produto: selectedProduto,
    });
  }, [selectedEquipe, selectedColaborador, selectedProduto, isAssessor, isSupervisor, currentUser, collaborators]);

  // ========== LIMPAR FILTROS ==========
  const clearFilters = () => {
    if (isAssessor && currentUser) {
      setSelectedProduto("Todos");
    } else if (isSupervisor && currentUser) {
      setSelectedColaborador("todos");
      setSearchTerm("");
      setSelectedProduto("Todos");
    } else {
      setSelectedEquipe("todas");
      setSelectedColaborador("todos");
      setSearchTerm("");
      setSelectedProduto("Todos");
    }
  };

  const hasActiveFilters = (() => {
    if (isAssessor) return selectedProduto !== "Todos";
    if (isSupervisor)
      return selectedColaborador !== "todos" || searchTerm !== "" || selectedProduto !== "Todos";
    return (
      selectedEquipe !== "todas" ||
      selectedColaborador !== "todos" ||
      searchTerm !== "" ||
      selectedProduto !== "Todos"
    );
  })();

  const isEquipeDisabled = isAssessor || isSupervisor || loadingEquipes;
  const isColaboradorDisabled = isAssessor || loadingCollaborators;
  const isProdutoDisabled = !!selectedEquipe && TEAM_TO_PRODUCT[selectedEquipe] !== undefined;

  if (loadingEquipes && equipesDisponiveis.length === 0) {
    return (
      <div className={cn("bg-white rounded-xl border border-gray-100 shadow-sm p-4", className)}>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Carregando equipes...</span>
        </div>
      </div>
    );
  }

  if (colabError) {
    return (
      <div className={cn("bg-white rounded-xl border border-red-200 shadow-sm p-4", className)}>
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>Erro ao carregar colaboradores: {colabError}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto px-2 py-1 bg-red-100 rounded text-red-700 hover:bg-red-200"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 shadow-sm p-4", className)}>
      <div className="flex flex-col gap-4">
        {/* Busca por colaborador */}
        {collaborators.length > 5 && !isAssessor && showColaboradorFilter && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar colaborador por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isAssessor}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09175b]/20"
              aria-label="Buscar colaborador"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Equipe */}
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> Equipe
            </label>
            <select
              value={selectedEquipe}
              onChange={(e) => setSelectedEquipe(e.target.value)}
              disabled={isEquipeDisabled}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09175b]/20",
                isEquipeDisabled && "bg-gray-100 cursor-not-allowed"
              )}
              aria-label="Filtrar por equipe"
            >
              {equipesDisponiveis.map((equipe) => (
                <option key={equipe} value={equipe}>
                  {equipe === "todas" ? "Todas as equipes" : equipe}
                </option>
              ))}
            </select>
          </div>

          {/* Colaborador */}
          {showColaboradorFilter && (
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Colaborador
              </label>
              <select
                key={filteredColaboradores.length}
                value={selectedColaborador}
                onChange={(e) => setSelectedColaborador(e.target.value)}
                disabled={isColaboradorDisabled}
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09175b]/20",
                  isColaboradorDisabled && "bg-gray-100 cursor-not-allowed"
                )}
                aria-label="Filtrar por colaborador"
              >
                <option value="todos">Todos os colaboradores</option>
                {loadingCollaborators && <option disabled>Carregando colaboradores...</option>}
                {!loadingCollaborators && filteredColaboradores.length === 0 && (
                  <option disabled>Nenhum colaborador disponível</option>
                )}
                {!loadingCollaborators &&
                  filteredColaboradores.map((colab) => (
                    <option key={colab.id} value={colab.name}>
                      {colab.name}
                      {!isAssessor && !isSupervisor && selectedEquipe === "todas"
                        ? ` (${colab.equipeNome || "Sem equipe"})`
                        : ""}
                    </option>
                  ))}
              </select>
              {loadingCollaborators && (
                <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando lista...
                </div>
              )}
            </div>
          )}

          {/* Produto */}
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Package className="w-3 h-3" /> Produto
            </label>
            <select
              value={selectedProduto}
              onChange={(e) => setSelectedProduto(e.target.value)}
              disabled={isProdutoDisabled}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09175b]/20",
                isProdutoDisabled && "bg-gray-100 cursor-not-allowed"
              )}
              aria-label="Filtrar por produto"
            >
              {PRODUCT_OPTIONS.map((prod) => (
                <option key={prod} value={prod}>{prod}</option>
              ))}
            </select>
          </div>

          {/* Limpar filtros */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                aria-label="Limpar todos os filtros"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            </div>
          )}
        </div>

        {/* Filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Filter className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">
              Filtros ativos:
              {!isSupervisor && selectedEquipe !== "todas" && selectedEquipe && (
                <span className="font-medium text-[#09175b] ml-1">Equipe: {selectedEquipe}</span>
              )}
              {selectedColaborador !== "todos" && selectedColaborador && (
                <span className="font-medium text-[#09175b] ml-2">Colaborador: {selectedColaborador}</span>
              )}
              {searchTerm && (
                <span className="font-medium text-[#09175b] ml-2">Busca: {searchTerm}</span>
              )}
              {selectedProduto !== "Todos" && selectedProduto && (
                <span className="font-medium text-[#09175b] ml-2">Produto: {selectedProduto}</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}