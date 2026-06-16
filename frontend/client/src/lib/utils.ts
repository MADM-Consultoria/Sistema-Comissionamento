import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Função existente
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// NOVAS FUNÇÕES - adicione a partir daqui
/**
 * Formata um número para o formato de moeda brasileira (R$)
 * @example formatCurrency(18450) // retorna "R$ 18.450"
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formata um número para percentual com uma casa decimal
 * @example formatPercent(34.2) // retorna "34.2%"
 */
export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};