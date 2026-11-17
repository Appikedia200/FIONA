import { Router } from 'express';
import authController from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

/**
 * Public routes
 */
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

/**
 * Protected routes (require authentication)
 */
router.get('/profile', authMiddleware, authController.getProfile.bind(authController));
router.post('/api-key', authMiddleware, authController.generateApiKey.bind(authController));
router.post('/change-password', authMiddleware, authController.changePassword.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));

export default router;
