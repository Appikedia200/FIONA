import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.util';

type Role = 'ADMIN' | 'TECHNICIAN';

/**
 * RBAC middleware - Check user role
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // User must be authenticated first
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role as Role)) {
        logger.warn(
          `Access denied for user ${req.user.email} (${req.user.role}) to ${req.method} ${req.path}`
        );

        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('RBAC middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Technician or Admin middleware
 */
export const requireTechnician = requireRole('ADMIN', 'TECHNICIAN');

/**
 * Check if user owns resource
 */
export const requireOwnership = (userIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // Admins can access everything
      if (req.user.role === 'ADMIN') {
        next();
        return;
      }

      // Get resource userId from params, query, or body
      const resourceUserId = 
        req.params[userIdField] || 
        req.query[userIdField] || 
        (req.body && req.body[userIdField]);

      // Check ownership
      if (resourceUserId !== req.user.id) {
        logger.warn(
          `Ownership check failed: User ${req.user.email} tried to access resource owned by ${resourceUserId}`
        );

        res.status(403).json({
          success: false,
          error: 'Access denied - not resource owner',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ownership check failed',
      });
    }
  };
};
