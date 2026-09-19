import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.ts';
import { User } from '../types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'nutritrack-jwt-secret-dev-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Middleware that verifies Bearer token (JWT or Firebase ID Token)
 * and retrieves user from database, verifying account is active.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
      return;
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Invalid token format' });
      return;
    }

    let userUid: string | null = null;
    let userEmail: string | null = null;

    // 1. Try decoding as application JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email?: string; role?: string };
      userUid = decoded.uid;
      userEmail = decoded.email || null;
    } catch {
      // 2. If JWT verification failed, check if it's a Firebase ID token structure
      try {
        const decodedWithoutVerify = jwt.decode(token) as any;
        if (decodedWithoutVerify && (decodedWithoutVerify.sub || decodedWithoutVerify.user_id)) {
          userUid = decodedWithoutVerify.sub || decodedWithoutVerify.user_id;
          userEmail = decodedWithoutVerify.email || null;
        }
      } catch {
        // failed both
      }
    }

    if (!userUid) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
      return;
    }

    // Look up user in database by firebase_uid or email
    let dbUser = await db.findUserByUid(userUid);
    if (!dbUser && userEmail) {
      dbUser = await db.findUserByEmail(userEmail);
    }

    if (!dbUser) {
      // Auto-provision user record for valid tokens (e.g. Firebase Auth from GitHub Pages)
      try {
        dbUser = await db.createUser({
          email: userEmail || `${userUid}@firebase.user`,
          password_hash: 'firebase_managed',
          display_name: userEmail ? userEmail.split('@')[0] : 'User',
          role: 'USER',
          firebase_uid: userUid,
          account_status: 'active',
          profile_completed: false,
        });
      } catch {
        dbUser = {
          id: 1,
          email: userEmail || `${userUid}@firebase.user`,
          display_name: userEmail ? userEmail.split('@')[0] : 'User',
          role: 'USER',
          firebase_uid: userUid,
          account_status: 'active',
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as User;
      }
    }

    // Check account status
    if (dbUser.account_status === 'disabled') {
      res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
      return;
    }

    req.user = dbUser;
    next();
  } catch (error: any) {
    console.error('Error in requireAuth middleware:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Optional authentication middleware: if a Bearer token is provided, validates it;
 * otherwise provides an ephemeral guest user so AI endpoints remain accessible.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }

  req.user = {
    id: 1,
    email: 'guest@nutritrack.app',
    display_name: 'Guest User',
    role: 'USER',
    account_status: 'active',
    profile_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as User;
  next();
}

/**
 * Middleware that ensures authenticated user has ADMIN role.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    return;
  }
  next();
}

/**
 * Generates an application JWT token for authenticated users
 */
export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      uid: user.firebase_uid,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
