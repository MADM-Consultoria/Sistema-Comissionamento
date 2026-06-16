// backend/security/scanners/signature-scanner.js

const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script[^>]*>/gi,
  /<script[^>]*\/?>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,       // onerror, onclick, etc.
  /javascript\s*:/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
];

export function scanSignature(input) {
  if (typeof input !== 'string') return [];
  const findings = [];
  for (const pattern of XSS_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      findings.push(`Assinatura XSS: "${match[0]}" (${pattern.source})`);
    }
  }
  return findings;
}

export function signatureScan(obj) {
  const report = [];
  function scan(value, path = '') {
    if (typeof value === 'string') {
      const findings = scanSignature(value);
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