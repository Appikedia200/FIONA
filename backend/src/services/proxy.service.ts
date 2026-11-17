import prisma from '../config/database';

/**
 * Get next proxy using round-robin rotation
 * Returns null if no active proxies exist
 */
export async function getNextProxy(): Promise<string | null> {
  const proxies = await prisma.proxyPool.findMany({ 
    where: { status: 'ACTIVE' } 
  });
  
  if (!proxies.length) return null;

  // Sort by lastUsedAt (oldest first)
  const sorted = proxies.sort((a, b) => {
    const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return aTime - bTime;
  });

  const selected = sorted[0];
  
  // Update lastUsedAt
  await prisma.proxyPool.update({
    where: { id: selected.id },
    data: { 
      lastUsedAt: new Date(),
      usageCount: { increment: 1 }
    }
  });

  // Build proxy URL
  const auth = selected.username && selected.password 
    ? `${selected.username}:${selected.password}@` 
    : '';
  const proxyUrl = `${selected.protocol}://${auth}${selected.host}:${selected.port}`;

  return proxyUrl;
}
