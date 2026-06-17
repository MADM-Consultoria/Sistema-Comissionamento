import 'express-session';
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    csrfSecret?: string;
    tempUser?: any;
    user?: any;
    resetEmail?: string;
    resetName?: string;
    resetInternalId?: number;
    resetToken?: string;
    resetUserId?: number;
  }
}

declare module 'express' {
  interface Request {
    csrfToken(): string;
    session: session.Session & Partial<session.SessionData>;
  }
}