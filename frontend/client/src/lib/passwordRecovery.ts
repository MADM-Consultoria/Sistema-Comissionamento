// src/lib/passwordRecovery.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3007/api';

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro ao solicitar recuperação');
  return data; // { success: true, message: 'Código enviado' }
}

export async function verifyResetCode(email: string, code: string) {
  const response = await fetch(`${API_BASE}/auth/verify-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   
    body: JSON.stringify({ email, code }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Código inválido');
  return data; // { success: true, resetToken }
}

export async function resetPassword(resetToken: string, newPassword: string) {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',   
        body: JSON.stringify({ resetToken, newPassword }),
    });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro ao redefinir senha');
  return data; // { success: true, message: 'Senha redefinida' }
}