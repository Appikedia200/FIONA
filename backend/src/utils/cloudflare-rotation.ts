import prisma from '../config/database';
import { CloudflareAccount } from '@prisma/client';

/**
 * Pick the best Cloudflare account for new domain provisioning
 * Strategy: Select active account with fewest domains, using lastUsedAt as tiebreaker
 */
export async function pickCloudflareAccount(): Promise<CloudflareAccount | null> {
  const account = await prisma.cloudflareAccount.findFirst({
    where: { status: 'active' },
    orderBy: [
      { zonesCount: 'asc' },      // Fewest domains first
      { lastUsedAt: 'asc' },      // Least recently used as tiebreaker
    ],
  });

  return account;
}

/**
 * Update account usage stats after assigning a domain
 */
export async function updateAccountUsage(accountId: string): Promise<void> {
  await prisma.cloudflareAccount.update({
    where: { id: accountId },
    data: {
      lastUsedAt: new Date(),
      zonesCount: { increment: 1 },
    },
  });
}

/**
 * Decrypt Cloudflare API token
 */
export function decryptToken(encryptedToken: string): string {
  const crypto = require('crypto');
  const ENCRYPTION_KEY = process.env.FIONA_SECRET || 'default-secret-key-change-me';
  
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
