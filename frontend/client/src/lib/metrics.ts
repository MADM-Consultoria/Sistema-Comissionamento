// src/lib/metrics.ts
import { Period } from '@/contexts/period';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3007/api';

// ============================================================
// FUNÇÕES EXISTENTES (métricas de desempenho)
// ============================================================

export async function fetchEmitidos(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ colaborador: string; equipe: string; total: number }[]> {
  const url = new URL(`${API_BASE}/metrics/emitidos`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar emitidos');
  return data.data;
}

export async function fetchAssinados(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ colaborador: string; equipe: string; total: number }[]> {
  const url = new URL(`${API_BASE}/metrics/assinados`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar assinados');
  return data.data;
}

export async function fetchProtocolados(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ colaborador: string; equipe: string; total: number }[]> {
  const url = new URL(`${API_BASE}/metrics/protocolados`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar protocolados');
  return data.data;
}

export async function fetchGanhos(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ colaborador: string; equipe: string; total: number }[]> {
  const url = new URL(`${API_BASE}/metrics/ganhos`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar ganhos');
  return data.data;
}

export async function fetchPerdidos(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ colaborador: string; equipe: string; total: number }[]> {
  const url = new URL(`${API_BASE}/metrics/perdidos`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar perdidos');
  return data.data;
}

export async function fetchLeadsRecebidos(
  params: { periodo?: Period; start?: string; end?: string; colaborador?: string; equipe?: string; produto?: string }
): Promise<{ data: string; total: number; colaborador: string }[]> {
  const url = new URL(`${API_BASE}/metrics/leads-recebidos`);
  if (params.periodo) url.searchParams.append('periodo', params.periodo);
  if (params.start) url.searchParams.append('start', params.start);
  if (params.end) url.searchParams.append('end', params.end);
  if (params.colaborador) url.searchParams.append('colaborador', params.colaborador);
  if (params.equipe) url.searchParams.append('equipe', params.equipe);
  if (params.produto && params.produto !== 'Todos') url.searchParams.append('produto', params.produto);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar leads');
  return data.data;
}

export async function fetchWeeklyPerformance(
  params: { start: string; end: string }
): Promise<{ semana: string; vendas: number; meta: number }[]> {
  const url = new URL(`${API_BASE}/metrics/weekly-performance`);
  url.searchParams.append('start', params.start);
  url.searchParams.append('end', params.end);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar desempenho semanal');
  return data.data;
}

// ============================================================
// NOVAS FUNÇÕES PARA COMISSIONAMENTO POR PERÍODO
// ============================================================

export interface CollaboratorWeights {
  pesoDiarioAssinados: number;
  pesoDiarioGanhos: number;
  pesoSemanalAssinados: number;
  pesoSemanalGanhos: number;
  pesoMensalAssinados: number;
  pesoMensalGanhos: number;
  bonusPorCiclo: number;
}

/**
 * Busca os pesos e bônus de um colaborador específico.
 * @param collaboratorId - ID do colaborador
 * @returns Objeto com os pesos e bônus
 */
export async function fetchCollaboratorWeights(collaboratorId: number): Promise<CollaboratorWeights> {
  const url = new URL(`${API_BASE}/commission/weights/${collaboratorId}`);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar pesos do colaborador');
  return data.data;
}

/**
 * Atualiza os pesos e bônus de um colaborador.
 * @param collaboratorId - ID do colaborador
 * @param weights - Novos valores de pesos e bônus
 */
export async function updateCollaboratorWeights(
  collaboratorId: number,
  weights: Partial<CollaboratorWeights>
): Promise<void> {
  const token = localStorage.getItem('csrfToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['x-csrf-token'] = token;

  const url = new URL(`${API_BASE}/commission/weights/${collaboratorId}`);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: JSON.stringify(weights),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar pesos do colaborador');
}

/**
 * Busca a configuração global de bônus (valores padrão usados quando não há específico por colaborador).
 */
export async function fetchBonusConfig(): Promise<{ bonusBase: number; pesoDiarioAssinados: number; pesoDiarioGanhos: number; pesoSemanalAssinados: number; pesoSemanalGanhos: number; pesoMensalAssinados: number; pesoMensalGanhos: number }> {
  const url = new URL(`${API_BASE}/commission/config`);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar configuração de bônus');
  return data.data;
}

/**
 * Atualiza a configuração global de bônus (apenas para administradores).
 */
export async function updateBonusConfig(config: Partial<{
  bonusBase: number;
  pesoDiarioAssinados: number;
  pesoDiarioGanhos: number;
  pesoSemanalAssinados: number;
  pesoSemanalGanhos: number;
  pesoMensalAssinados: number;
  pesoMensalGanhos: number;
}>): Promise<void> {
  const token = localStorage.getItem('csrfToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['x-csrf-token'] = token;

  const url = new URL(`${API_BASE}/commission/config`);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: JSON.stringify(config),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao atualizar configuração de bônus');
}

/**
 * Dispara o recálculo automático dos pesos de supervisores e coordenadores
 * com base nos pesos dos assessores (soma da equipe ou global).
 * @returns Mensagem de sucesso
 */
export async function recalculateHierarchyWeights(): Promise<{ message: string }> {
  const token = localStorage.getItem('csrfToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['x-csrf-token'] = token;

  const url = new URL(`${API_BASE}/commission/recalculate-hierarchy`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Erro ao recalcular hierarquia:', data);
    throw new Error(data.error || 'Erro ao recalcular pesos hierárquicos');
  }
  return data;
}

/**
 * Busca os colaboradores com seus pesos já calculados (incluindo os dinâmicos para supervisores/coordenadores).
 * Útil para obter a lista já processada pelo backend.
 */
export async function fetchCollaboratorsWithWeights(params?: { equipe?: string; grupo?: string }): Promise<any[]> {
  const url = new URL(`${API_BASE}/collaborators/with-weights`);
  if (params?.equipe) url.searchParams.append('equipe', params.equipe);
  if (params?.grupo) url.searchParams.append('grupo', params.grupo);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao carregar colaboradores com pesos');
  return data.data;
}