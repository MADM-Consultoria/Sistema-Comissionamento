// src/lib/auth.ts
import { useAppStore } from "@/lib/dataStore";

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

export async function login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro no login');
    return data; // { success, requiresTwoFactor, tempToken }
}

export async function verify2FA(tempToken: string, code: string) {
    const response = await fetch(`${API_BASE}/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken, code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Código inválido');

    // Precarrega a lista de colaboradores imediatamente após autenticação bem-sucedida
    try {
        const { loadCollaborators } = useAppStore.getState();
        await loadCollaborators();
    } catch (error) {
        console.warn('Não foi possível carregar a lista de colaboradores:', error);
        // não impede o fluxo de login – o carregamento será feito sob demanda depois
    }

    return data; // { success, accessToken, user }
}

export async function resendCode() {
    const response = await fetch(`${API_BASE}/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao reenviar código');
    return data;
}

export async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
    });
    localStorage.removeItem('accessToken');
    sessionStorage.clear();
}