// backend/security/scanners/total-security.js

import { heuristicScan } from './heuristic-scanner.js';
import { signatureScan } from './signature-scanner.js';

/**
 * Varredura completa de um objeto (req.body, etc.).
 * Retorna um array com todos os achados de segurança.
 */
export function fullScan(obj) {
  const heuristicFindings = heuristicScan(obj);
  const signatureFindings = signatureScan(obj);
  return [...heuristicFindings, ...signatureFindings];
}