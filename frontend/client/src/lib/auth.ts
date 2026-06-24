// src/lib/auth.ts
import { useAppStore } from "@/lib/dataStore";

// ============================================================
// BASE URL: deve terminar com /api
// ============================================================
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3007/api';

export interface UserData {
  id: number;
  name: string;
  email: string;
  equipe: string;
  grupo: string;
  status: string;
  periodo: string;
}

// ============================================================
// FUNÇÃO AUXILIAR – obtém o token CSRF (busca se não existir)
// ============================================================
export async function ensureCsrfToken(): Promise<string> {
  let token = localStorage.getItem('csrfToken');
  if (token) return token;

  try {
    const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
    const data = await res.json();
    if (data.csrfToken && data.csrfToken !== 'disabled') {
      localStorage.setItem('csrfToken', data.csrfToken);
      return data.csrfToken;
    }
  } catch (e) {
    console.warn('⚠️ Não foi possível obter CSRF token:', e);
  }
  return '';
}

export function getCsrfToken(): string {
  return localStorage.getItem('csrfToken') || '';
}

// ============================================================
// FUNÇÃO AUXILIAR – trata a resposta da API
// ============================================================
async function handleApiResponse(response: Response, defaultMessage: string) {
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0' || response.status === 204) {
    if (response.status === 403) {
      throw new Error('Token CSRF inválido ou ausente. Recarregue a página e tente novamente.');
    }
    return {};
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    const text = await response.text();
    console.error('❌ Resposta não é JSON:', text.substring(0, 200));
    throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || defaultMessage || `Erro ${response.status}`);
  }

  if (data.success === false) {
    throw new Error(data.error || defaultMessage);
  }

  return data;
}

// ============================================================
// LOGIN – envia credenciais e recebe tempToken para 2FA
// ============================================================
export async function login(email: string, password: string, rememberMe: boolean = false) {
  await ensureCsrfToken();

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({ email, password, rememberMe }),
  });

  return handleApiResponse(response, 'Erro no login');
}

// ============================================================
// VERIFICAÇÃO 2FA – valida o código e obtém token de acesso
// ============================================================
export async function verify2FA(tempToken: string, code: string) {
  await ensureCsrfToken();

  const response = await fetch(`${API_BASE}/auth/verify-2fa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({ tempToken, code }),
  });

  const data = await handleApiResponse(response, 'Código inválido');

  // Precarrega colaboradores após autenticação
  try {
    const { loadCollaborators } = useAppStore.getState();
    await loadCollaborators();
  } catch (error) {
    console.warn('⚠️ Não foi possível carregar colaboradores:', error);
  }

  return data;
}

// ============================================================
// REENVIO DE CÓDIGO 2FA
// ============================================================
export async function resendCode() {
  await ensureCsrfToken();

  const response = await fetch(`${API_BASE}/auth/resend-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({}),
  });

  return handleApiResponse(response, 'Erro ao reenviar código');
}

// ============================================================
// LOGOUT – destrói a sessão e limpa dados locais
// ============================================================
export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'x-csrf-token': getCsrfToken(),
      },
      credentials: 'include',
    });
  } catch (e) {
    // ignora
  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('csrfToken');
  sessionStorage.clear();
  
  // Para o heartbeat se estiver rodando
  if (window.heartbeatInterval) {
    clearInterval(window.heartbeatInterval);
    window.heartbeatInterval = null;
  }
}

// ============================================================
// HEARTBEAT – mantém a sessão ativa com ping periódico
// ============================================================
let heartbeatInterval: number | null = null;

export function startHeartbeat(intervalMs: number = 5 * 60 * 1000) {
  // Se já estiver rodando, não inicia outro
  if (heartbeatInterval) return;

  console.log('💓 Heartbeat iniciado (ping a cada', intervalMs / 1000, 'segundos)');

  // Função que envia ping
  const sendPing = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/ping`, {
        credentials: 'include',
        headers: {
          'x-csrf-token': getCsrfToken(),
        },
      });
      if (!response.ok) {
        console.warn('⚠️ Ping falhou, status:', response.status);
        // Se receber 401, pode tentar renovar o token CSRF
        if (response.status === 401 || response.status === 403) {
          await ensureCsrfToken();
        }
      }
    } catch (err) {
      console.warn('⚠️ Erro no ping:', err);
    }
  };

  // Envia ping imediatamente para iniciar
  sendPing();

  // Agenda o intervalo
  heartbeatInterval = window.setInterval(sendPing, intervalMs);
  
  // Armazena no window para acesso externo (útil para limpeza)
  window.heartbeatInterval = heartbeatInterval;
}

export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    window.heartbeatInterval = null;
    console.log('💓 Heartbeat parado');
  }
}

// ============================================================
// RENOVAÇÃO PERIÓDICA DO CSRF TOKEN
// ============================================================
let csrfRefreshInterval: number | null = null;

export function startCsrfRefresh(intervalMs: number = 10 * 60 * 1000) {
  if (csrfRefreshInterval) return;

  console.log('🔄 CSRF refresh iniciado (a cada', intervalMs / 1000, 'segundos)');

  const refreshCsrf = async () => {
    try {
      const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
      const data = await res.json();
      if (data.csrfToken && data.csrfToken !== 'disabled') {
        localStorage.setItem('csrfToken', data.csrfToken);
      }
    } catch (err) {
      console.warn('⚠️ Erro ao renovar CSRF token:', err);
    }
  };

  refreshCsrf();
  csrfRefreshInterval = window.setInterval(refreshCsrf, intervalMs);
  window.csrfRefreshInterval = csrfRefreshInterval;
}

export function stopCsrfRefresh() {
  if (csrfRefreshInterval) {
    clearInterval(csrfRefreshInterval);
    csrfRefreshInterval = null;
    window.csrfRefreshInterval = null;
  }
}

// ============================================================
// DECLARAÇÃO DE TIPOS PARA WINDOW (para evitar erros TS)
// ============================================================
declare global {
  interface Window {
    heartbeatInterval: number | null;
    csrfRefreshInterval: number | null;
  }
}

// ============================================================
// FUNÇÃO PARA INICIAR TODOS OS SERVIÇOS DE MANUTENÇÃO (chamar após login)
// ============================================================
export function startMaintenanceServices() {
  // Heartbeat a cada 5 minutos (para manter sessão ativa)
  startHeartbeat(5 * 60 * 1000);
  // Renova CSRF a cada 10 minutos
  startCsrfRefresh(10 * 60 * 1000);
}

export function stopMaintenanceServices() {
  stopHeartbeat();
  stopCsrfRefresh();
}