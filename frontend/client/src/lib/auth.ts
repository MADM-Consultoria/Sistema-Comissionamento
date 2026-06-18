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
async function ensureCsrfToken(): Promise<string> {
  let token = localStorage.getItem('csrfToken');
  if (token) return token;

  // Se não houver token, busca da API
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

function getCsrfToken(): string {
  return localStorage.getItem('csrfToken') || '';
}

// ============================================================
// FUNÇÃO AUXILIAR – trata a resposta da API
// ============================================================
async function handleApiResponse(response: Response, defaultMessage: string) {
  // Se a resposta for vazia (status 204 ou content-length 0), retorna objeto vazio
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0' || response.status === 204) {
    // Se for 403 (CSRF) e a resposta estiver vazia, lança erro específico
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
export async function login(email: string, password: string) {
  // Garante que o token CSRF exista antes de enviar
  await ensureCsrfToken();

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
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
// LOGOUT
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
}