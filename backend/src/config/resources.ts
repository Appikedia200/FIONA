// VPS Resource Management Configuration
// Optimized for multi-tenant environment with smart cleanup

export const RESOURCE_LIMITS = {
  // === CAPTURE SESSION LIMITS ===
  // Active Playwright browsers capturing credentials
  MAX_CONCURRENT_SESSIONS: 8,           // Max simultaneous capture sessions
  SESSION_IDLE_WARNING: 5 * 60 * 1000,  // Warn technician after 5 min of session inactivity
  SESSION_IDLE_CLEANUP: 8 * 60 * 1000,  // Close Playwright browser after 8 min idle
  SESSION_HARD_TIMEOUT: 15 * 60 * 1000, // Force close stuck sessions after 15 min
  
  // === LAUNCHED PROFILE LIMITS ===
  // Chromium browsers launched by technicians/admins to view profiles
  MAX_LAUNCHED_PROFILES: 5,              // Max simultaneous launched Chromium windows
  PROFILE_IDLE_WARNING: 15 * 60 * 1000,  // Warn user after 15 min of inactivity
  PROFILE_IDLE_CLEANUP: 30 * 60 * 1000,  // Close Chromium window after 30 min idle
  PROFILE_HARD_TIMEOUT: 60 * 60 * 1000,  // Force close after 1 hour (safety limit)
  
  // === RESOURCE THRESHOLDS ===
  MEMORY_THRESHOLD: 0.98,                // Reject new sessions at 98% RAM usage (raised for local dev)
  CPU_THRESHOLD: 0.85,                   // Warn at 85% CPU usage
  
  // === SESSION QUEUE ===
  MAX_QUEUE_SIZE: 10,                    // Max sessions waiting in queue
  QUEUE_TIMEOUT: 5 * 60 * 1000,          // Max wait time in queue: 5 minutes
  
  // === CLEANUP & MONITORING ===
  CLEANUP_INTERVAL: 30 * 1000,           // Check for idle browsers every 30 seconds
  QUEUE_PROCESS_INTERVAL: 10 * 1000,     // Process queue every 10 seconds
  HEALTH_CHECK_INTERVAL: 60 * 1000,      // Resource health check every 1 minute
  
  // === ESTIMATED MEMORY USAGE ===
  // (For capacity planning - actual usage may vary)
  PLAYWRIGHT_SESSION_RAM: 200,           // ~200MB per Playwright session
  LAUNCHED_PROFILE_RAM: 150,             // ~150MB per launched Chromium window
  BASE_SYSTEM_RAM: 512,                  // ~512MB for Node.js + Express + Prisma
};

// Calculate estimated max memory usage
export const ESTIMATED_MAX_RAM_MB = 
  RESOURCE_LIMITS.BASE_SYSTEM_RAM +
  (RESOURCE_LIMITS.MAX_CONCURRENT_SESSIONS * RESOURCE_LIMITS.PLAYWRIGHT_SESSION_RAM) +
  (RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES * RESOURCE_LIMITS.LAUNCHED_PROFILE_RAM);

// VPS size recommendations
export const VPS_RECOMMENDATIONS = {
  '2GB': { sessions: 5, profiles: 3 },   // Conservative
  '4GB': { sessions: 8, profiles: 5 },   // Balanced (default)
  '8GB': { sessions: 15, profiles: 10 }, // High capacity
  '16GB': { sessions: 30, profiles: 20 }, // Enterprise
};

console.log(`📊 Resource Configuration:`);
console.log(`   Max Sessions: ${RESOURCE_LIMITS.MAX_CONCURRENT_SESSIONS}`);
console.log(`   Max Profiles: ${RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES}`);
console.log(`   Estimated Peak RAM: ~${ESTIMATED_MAX_RAM_MB}MB`);
console.log(`   Profile Idle Cleanup: ${RESOURCE_LIMITS.PROFILE_IDLE_CLEANUP / 60000} minutes`);
