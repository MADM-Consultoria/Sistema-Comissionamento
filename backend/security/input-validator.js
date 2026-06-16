// backend/security/input-validator.js
import sanitizeHtml from 'sanitize-html';

const defaultOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

/**
 * Sanitiza uma string. Remove HTML malicioso, mas mantém texto, quebras de linha, acentos etc.
 */
export function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return input;
  const opts = { ...defaultOptions, ...options };
  return sanitizeHtml(input, opts);
}

/**
 * Sanitiza recursivamente um objeto. Todos os valores string são limpos.
 */
export function sanitizeObject(obj, options = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      cleaned[key] = sanitizeString(value, options);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeObject(value, options);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Middleware Express que sanitiza req.body, req.query e req.params.
 */
export function inputSanitizer(req, res, next) {
  // Sanitiza req.body (pode ser reatribuído sem problemas)
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitiza req.query – modifica os valores internamente, sem reatribuir o objeto
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        // query strings podem ter múltiplos valores (ex.: ?ids=1&ids=2)
        req.query[key] = value.map(v => (typeof v === 'string' ? sanitizeString(v) : v));
      }
    }
  }

  // Sanitiza req.params – mesmo princípio do query
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      const value = req.params[key];
      if (typeof value === 'string') {
        req.params[key] = sanitizeString(value);
      }
    }
  }

  next();
}