import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fiona-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'TECHNICIAN';
  status: string;
}

/**
 * Sign a JWT token
 */
export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
};

/**
 * Generate API key (for programmatic access)
 */
export const generateApiKey = (): string => {
  const prefix = 'fiona_';
  const randomBytes = require('crypto').randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
};

/**
 * Verify API key format
 */
export const isValidApiKeyFormat = (apiKey: string): boolean => {
  return /^fiona_[a-f0-9]{64}$/.test(apiKey);
};
