// backend/middleware/auth.js

export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  next();
}