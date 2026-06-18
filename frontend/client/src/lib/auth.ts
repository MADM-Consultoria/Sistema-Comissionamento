// src/lib/auth.ts
import { useAppStore } from "@/lib/dataStore";

// ============================================================
// BASE URL: deve terminar com /api (ex: https://backend.onrender.com/api)
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
// FUNÇÃO AUXILIAR – obtém o token CSRF do localStorage
// ============================================================
function getCsrfToken(): string {
  return localStorage.getItem('csrfToken') || '';
}

// ============================================================
// FUNÇÃO AUXILIAR – trata a resposta da API (evita erro de JSON vazio)
// ============================================================
async function handleApiResponse(response: Response, defaultMessage: string) {
  // Se a resposta for vazia (status 204 ou content-length 0), retorna objeto vazio
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0' || response.status === 204) {
    return {};
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    // Se não for JSON, tenta ler como texto para debug
    const text = await response.text();
    console.error('❌ Resposta não é JSON:', text.substring(0, 200));
    throw new Error(`Resposta inválida: ${text.substring(0, 100)}`);
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

  // Precarrega a lista de colaboradores após autenticação
  try {
    const { loadCollaborators } = useAppStore.getState();
    await loadCollaborators();
  } catch (error) {
    console.warn('⚠️ Não foi possível carregar colaboradores:', error);
  }

  return data; // { success, accessToken, user }
}

// ============================================================
// REENVIO DE CÓDIGO 2FA
// ============================================================
export async function resendCode() {
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

  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('csrfToken');
  sessionStorage.clear();
}