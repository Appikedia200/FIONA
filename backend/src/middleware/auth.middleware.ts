import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt.util';
import { logger } from '../utils/logger.util';
import prisma from '../config/database';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any; // Full user object from database
    }
  }
}

/**
 * Auth middleware - Verify JWT token and fetch user from database
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded: any = verifyToken(token);

    // Extract user ID with fallback for different token formats
    const userId = decoded.userId ?? decoded.id ?? decoded.sub;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Invalid token payload',
      });
      return;
    }

    // Fetch actual user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: 'Account is not active',
      });
      return;
    }

    // Attach full user object to request
    req.user = user;

    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error.message);
    
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token',
    });
  }
};

/**
 * Alias for compatibility
 */
export const requireAuth = authMiddleware;

/**
 * Optional auth middleware - Attach user if token is valid, but don't fail
 */
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded.status === 'ACTIVE') {
        req.user = decoded;
      }
    }

    next();
  } catch {
    // Silently continue without user
    next();
  }
};
