import { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/dataStore";

interface Filters {
  equipe: string;
  colaborador: string;
}

export function useFilters() {
  const { collaborators } = useAppStore();
  const [filters, setFilters] = useState<Filters>({ equipe: "todas", colaborador: "todos" });

  // Colaboradores filtrados - CORRIGIDO: usar equipeNome
  const filteredCollaborators = useMemo(() => {
    let filtered = [...collaborators];

    if (filters.equipe !== "todas") {
      filtered = filtered.filter(c => c.equipeNome === filters.equipe);
    }

    if (filters.colaborador !== "todos") {
      filtered = filtered.filter(c => c.name === filters.colaborador);
    }

    return filtered;
  }, [collaborators, filters]);

  // Verifica se um colaborador específico está nos filtros
  const isCollaboratorInFilters = useCallback((collaboratorName: string) => {
    if (filters.colaborador !== "todos" && filters.colaborador !== collaboratorName) {
      return false;
    }
    return true;
  }, [filters.colaborador]);

  // Verifica se uma equipe específica está nos filtros
  const isEquipeInFilters = useCallback((equipeName: string) => {
    if (filters.equipe !== "todas" && filters.equipe !== equipeName) {
      return false;
    }
    return true;
  }, [filters.equipe]);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({ equipe: "todas", colaborador: "todos" });
  };

  const hasActiveFilters = filters.equipe !== "todas" || filters.colaborador !== "todos";

  return {
    filters,
    filteredCollaborators,
    isCollaboratorInFilters,
    isEquipeInFilters,
    handleFilterChange,
    clearFilters,
    hasActiveFilters,
  };
}