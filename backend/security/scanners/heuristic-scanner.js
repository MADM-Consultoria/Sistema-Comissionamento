// backend/security/scanners/heuristic-scanner.js

const SUSPICIOUS_PATTERNS = [
  /(\b(SELECT|INSERT|DELETE|UPDATE|DROP|UNION|ALTER|CREATE|EXEC)\b)/i,
  /(\b(OR|AND)\b\s*[\d\w]+\s*=\s*[\d\w]+)/i,
  /(--|\/\*|\*\/)/,   // comentários SQL
  /(;\s*DROP\s+TABLE)/i,
  /(javascript\s*:)/i,       // XSS via javascript:
];

/**
 * Verifica se uma string contém padrões suspeitos.
 * Retorna um array com as descrições dos padrões encontrados.
 */
export function scanHeuristic(input) {
  if (typeof input !== 'string') return [];
  const findings = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      findings.push(`Padrão suspeito: ${pattern.source}`);
    }
  }
  return findings;
}

/**
 * Scanner que percorre um objeto e retorna um relatório.
 */
export function heuristicScan(obj) {
  const report = [];
  function scan(value, path = '') {
    if (typeof value === 'string') {
      const findings = scanHeuristic(value);
      findings.forEach(f => report.push({ path, message: f }));
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        scan(val, path ? `${path}.${key}` : key);
      }
    }
  }
  scan(obj);
  return report;
}