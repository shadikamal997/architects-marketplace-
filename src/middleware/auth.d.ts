import { Request, Response, NextFunction } from 'express';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void;
export function requireRole(role: string): (req: Request, res: Response, next: NextFunction) => void;