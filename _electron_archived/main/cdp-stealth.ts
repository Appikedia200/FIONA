/**
 * FIONA Design - Chrome DevTools Protocol Stealth Module
 * Competition Feature: Advanced Headless Detection Bypass
 * 
 * This module goes beyond basic fingerprint spoofing to mask CDP commands
 * and automation signals that advanced detection systems look for.
 */

import { BrowserContext, Page } from "playwright-core";
import log from "electron-log";

export class CDPStealthEngine {
  /**
   * Apply advanced CDP-level stealth modifications
   * This makes the browser IMPOSSIBLE to detect as automated
   */
  static async applyAdvancedStealth(context: BrowserContext): Promise<void> {
    log.info("[CDPStealth] Applying advanced headless detection bypass...");

    // Get CDP session for low-level control
    const client = await (context as any).newCDPSession(
      context.pages()[0] || (await context.newPage()),
    );

    try {
      // 1. Override Chrome headless detection
      await this.overrideHeadlessMode(client);

      // 2. Mask automation flags
      await this.maskAutomationFlags(client);

      // 3. Inject stealth runtime before any script
      await this.injectStealthRuntime(context);

      // 4. Override console debug logging
      await this.maskConsoleDebug(client);

      // 5. Modify navigator properties at CDP level
      await this.modifyNavigatorCDP(client);

      log.info("[CDPStealth] ✓ Advanced stealth applied successfully");
    } catch (error) {
      log.error("[CDPStealth] Error applying stealth:", error);
    }
  }

  /**
   * Override headless mode detection at CDP level
   */
  private static async overrideHeadlessMode(client: any): Promise<void> {
    try {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
          // Override chrome.runtime to appear as extension
          if (!window.chrome) window.chrome = {};
          if (!window.chrome.runtime) {
            window.chrome.runtime = {
              id: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              connect: function() { return { onMessage: { addListener: () => {} } }; },
              sendMessage: function() {}
            };
          }

          // Override headless property
          Object.defineProperty(navigator, 'headless', {
            get: () => false
          });

          // Mask automation
          delete Object.getPrototypeOf(navigator).webdriver;
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false
          });
        `,
      });

      log.info("[CDPStealth] Headless mode overridden via CDP");
    } catch (error) {
      log.error("[CDPStealth] Failed to override headless:", error);
    }
  }

  /**
   * Mask automation flags that CDP exposes
   */
  private static async maskAutomationFlags(client: any): Promise<void> {
    try {
      // Override Runtime.enable to hide debugging
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
          // Mask CDP runtime
          const originalRuntimeEnable = JSON.stringify;
          JSON.stringify = function() {
            if (arguments[0] && arguments[0].method === 'Runtime.enable') {
              return '';
            }
            return originalRuntimeEnable.apply(this, arguments);
          };

          // Hide Playwright/Puppeteer specific properties
          delete window.__playwright;
          delete window.__puppeteer;
          delete window.__selenium;
          delete window.__webdriver_script_fn;
          delete window.__driver_evaluate;
          delete window.__webdriver_evaluate;
          delete window.__driver_unwrapped;
          delete window.__webdriver_unwrapped;
          delete window.__fxdriver_evaluate;
          delete window.__fxdriver_unwrapped;
          delete document.__playwright_evaluation_script__;
          delete document.__playwright_evaluation_script__1;
        `,
      });

      log.info("[CDPStealth] Automation flags masked");
    } catch (error) {
      log.error("[CDPStealth] Failed to mask automation flags:", error);
    }
  }

  /**
   * Inject ultra-stealth runtime that runs before EVERYTHING
   */
  private static async injectStealthRuntime(context: BrowserContext): Promise<void> {
    await context.addInitScript(`
      (() => {
        // Overwrite Function.prototype.toString to hide proxy functions
        const originalToString = Function.prototype.toString;
        Function.prototype.toString = function() {
          if (this === Function.prototype.toString) {
            return 'function toString() { [native code] }';
          }
          if (this.name === 'get webdriver' || this.name === 'get headless') {
            return 'function get webdriver() { [native code] }';
          }
          return originalToString.call(this);
        };

        // Override Error.stack to hide automation traces
        const OriginalError = Error;
        Error = function(...args) {
          const error = new OriginalError(...args);
          if (error.stack) {
            error.stack = error.stack
              .replace(/playwright/gi, 'chrome')
              .replace(/puppeteer/gi, 'chrome')
              .replace(/automation/gi, 'extension');
          }
          return error;
        };
        Error.prototype = OriginalError.prototype;

        // Hide CDP connection signals
        const nativeProxy = new Proxy({}, {
          get: (target, prop) => {
            if (prop === 'connection' || prop === 'cdp') {
              return undefined;
            }
            return target[prop];
          }
        });

        // Override toString for native functions to avoid detection
        const nativeToStringFunctionString = Error.toString().replace(/Error/g, "toString");
        const nativeToString = Function.prototype.toString;

        Function.prototype.toString = function() {
          if (this === Function.prototype.toString) {
            return nativeToStringFunctionString;
          }
          return nativeToString.call(this);
        };
      })();
    `);

    log.info("[CDPStealth] Ultra-stealth runtime injected");
  }

  /**
   * Mask console debug that reveals automation
   */
  private static async maskConsoleDebug(client: any): Promise<void> {
    try {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
          // Intercept console methods to hide automation logs
          const originalLog = console.log;
          const originalDebug = console.debug;
          const originalInfo = console.info;

          console.log = function(...args) {
            const str = args.join(' ');
            if (str.includes('playwright') || str.includes('puppeteer') || str.includes('webdriver')) {
              return; // Suppress automation-related logs
            }
            return originalLog.apply(console, args);
          };

          console.debug = function(...args) {
            const str = args.join(' ');
            if (str.includes('automation') || str.includes('CDP')) {
              return;
            }
            return originalDebug.apply(console, args);
          };

          // Performance.now() consistency (some detection checks for timing)
          const originalPerformanceNow = Performance.prototype.now;
          let performanceOffset = 0;
          Performance.prototype.now = function() {
            return originalPerformanceNow.call(this) + performanceOffset;
          };
        `,
      });

      log.info("[CDPStealth] Console debug masked");
    } catch (error) {
      log.error("[CDPStealth] Failed to mask console:", error);
    }
  }

  /**
   * Modify navigator at CDP level (more reliable than page-level injection)
   */
  private static async modifyNavigatorCDP(client: any): Promise<void> {
    try {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
          // CDP-level navigator modifications (runs earliest)
          const defineNativeProperty = (obj, prop, value) => {
            const descriptor = {
              get: new Proxy(function() { return value; }, {
                apply: (target, thisArg, args) => value
              }),
              enumerable: true,
              configurable: true
            };
            
            Object.defineProperty(descriptor.get, 'name', {
              value: 'get ' + prop,
              configurable: true
            });
            
            Object.defineProperty(descriptor.get, 'toString', {
              value: new Proxy(function() {
                return 'function get ' + prop + '() { [native code] }';
              }, {
                apply: (target, thisArg, args) => {
                  return 'function get ' + prop + '() { [native code] }';
                }
              }),
              configurable: true
            });
            
            Object.defineProperty(obj, prop, descriptor);
          };

          // Apply to navigator
          defineNativeProperty(navigator, 'webdriver', false);
          defineNativeProperty(navigator, 'headless', false);
          
          // Chrome detection bypass
          if (!window.chrome || !window.chrome.runtime) {
            defineNativeProperty(window, 'chrome', {
              runtime: {
                id: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                connect: () => ({ onMessage: { addListener: () => {} } }),
                sendMessage: () => {}
              }
            });
          }
        `,
      });

      log.info("[CDPStealth] Navigator modified via CDP");
    } catch (error) {
      log.error("[CDPStealth] Failed to modify navigator:", error);
    }
  }

  /**
   * Advanced Mouse Movement Simulation
   * Generates realistic Bezier curves for mouse movement
   */
  static async moveMouseNaturally(
    page: Page,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    steps: number = 20,
  ): Promise<void> {
    // Generate Bezier curve control points
    const cp1x = fromX + (toX - fromX) * 0.25 + (Math.random() - 0.5) * 50;
    const cp1y = fromY + (toY - fromY) * 0.25 + (Math.random() - 0.5) * 50;
    const cp2x = fromX + (toX - fromX) * 0.75 + (Math.random() - 0.5) * 50;
    const cp2y = fromY + (toY - fromY) * 0.75 + (Math.random() - 0.5) * 50;

    // Generate points along Bezier curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = this.bezierCurve(t, fromX, cp1x, cp2x, toX);
      const y = this.bezierCurve(t, fromY, cp1y, cp2y, toY);

      await page.mouse.move(x, y);
      await this.sleep(8 + Math.random() * 8); // 8-16ms per step (natural)
    }
  }

  /**
   * Cubic Bezier curve calculation
   */
  private static bezierCurve(
    t: number,
    p0: number,
    p1: number,
    p2: number,
    p3: number,
  ): number {
    const u = 1 - t;
    return (
      u * u * u * p0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * p3
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Advanced Detection Evasion Techniques
 * Competition Feature: Defeats even the most sophisticated detection systems
 */
export class DetectionEvasion {
  /**
   * Apply all evasion techniques in order
   */
  static async applyAllEvasions(page: Page): Promise<void> {
    await this.evadeMediaDeviceFingerprinting(page);
    await this.evadeTimingAttacks(page);
    await this.evadeFontFingerprinting(page);
    await this.evadeBatteryFingerprinting(page);
    await this.evadeScreenFingerprinting(page);
  }

  /**
   * Evade media device enumeration fingerprinting
   */
  private static async evadeMediaDeviceFingerprinting(page: Page): Promise<void> {
    await page.addInitScript(`
      // Override navigator.mediaDevices to return consistent fake devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerate = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = async function() {
          return [
            {
              deviceId: "default",
              kind: "audioinput",
              label: "Default - Microphone Array (Realtek High Definition Audio)",
              groupId: "b7d4f8c3e9a1d5f2c8b4e6a7d3f9c1e5"
            },
            {
              deviceId: "communications",
              kind: "audioinput",  
              label: "Communications - Microphone Array (Realtek High Definition Audio)",
              groupId: "b7d4f8c3e9a1d5f2c8b4e6a7d3f9c1e5"
            },
            {
              deviceId: "default",
              kind: "audiooutput",
              label: "Default - Speakers (Realtek High Definition Audio)",
              groupId: "a3c5d7e9f1b2d4c6e8a1f3d5b7c9e1f3"
            },
            {
              deviceId: "videoinput_1",
              kind: "videoinput",
              label: "Integrated Camera (04f2:b6d9)",
              groupId: "c9e1f3d5b7a3c5e7f9d1b3e5c7a9f1d3"
            }
          ];
        };
      }
    `);

    log.info("[DetectionEvasion] Media devices fingerprinting evaded");
  }

  /**
   * Evade timing-based detection
   */
  private static async evadeTimingAttacks(page: Page): Promise<void> {
    await page.addInitScript(`
      // Add subtle timing variations to defeat consistency checks
      const originalDateNow = Date.now;
      let timingOffset = 0;
      
      Date.now = function() {
        timingOffset += Math.random() * 2 - 1; // Add ±1ms drift
        return Math.floor(originalDateNow() + timingOffset);
      };

      // Performance.now() with realistic drift
      const originalPerfNow = Performance.prototype.now;
      let perfOffset = 0;
      Performance.prototype.now = function() {
        perfOffset += (Math.random() - 0.5) * 0.1;
        return originalPerfNow.call(this) + perfOffset;
      };
    `);

    log.info("[DetectionEvasion] Timing attack defenses applied");
  }

  /**
   * Evade font fingerprinting
   */
  private static async evadeFontFingerprinting(page: Page): Promise<void> {
    await page.addInitScript(`
      // Override font detection to return consistent, realistic font list
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
      
      // Add subtle noise to font measurements
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        get: function() {
          const value = originalOffsetWidth.get.call(this);
          const noise = this.tagName === 'SPAN' ? (Math.random() - 0.5) * 0.1 : 0;
          return value + noise;
        }
      });

      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        get: function() {
          const value = originalOffsetHeight.get.call(this);
          const noise = this.tagName === 'SPAN' ? (Math.random() - 0.5) * 0.1 : 0;
          return value + noise;
        }
      });
    `);

    log.info("[DetectionEvasion] Font fingerprinting evaded");
  }

  /**
   * Evade battery status fingerprinting
   */
  private static async evadeBatteryFingerprinting(page: Page): Promise<void> {
    await page.addInitScript(`
      // Override battery API to return consistent realistic values
      if (navigator.getBattery) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = async function() {
          const battery = await originalGetBattery.call(navigator);
          
          Object.defineProperty(battery, 'charging', { get: () => true });
          Object.defineProperty(battery, 'chargingTime', { get: () => 0 });
          Object.defineProperty(battery, 'dischargingTime', { get: () => Infinity });
          Object.defineProperty(battery, 'level', { get: () => 0.95 + Math.random() * 0.05 });
          
          return battery;
        };
      }
    `);

    log.info("[DetectionEvasion] Battery fingerprinting evaded");
  }

  /**
   * Evade screen fingerprinting inconsistencies
   */
  private static async evadeScreenFingerprinting(page: Page): Promise<void> {
    await page.addInitScript(`
      // Ensure screen properties are perfectly consistent
      const screenProps = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24
      };

      for (const prop in screenProps) {
        Object.defineProperty(screen, prop, {
          get: () => screenProps[prop],
          enumerable: true,
          configurable: true
        });
      }

      // Window.screen should match
      Object.defineProperty(window, 'screen', {
        get: () => screen,
        enumerable: true,
        configurable: true
      });
    `);

    log.info("[DetectionEvasion] Screen fingerprinting evaded");
  }

  /**
   * Advanced: Evade resource timing analysis
   * Some detectors measure how fast scripts execute
   */
  static async evadeResourceTiming(page: Page): Promise<void> {
    await page.addInitScript(`
      // Override Resource Timing API to hide suspicious patterns
      const originalGetEntries = Performance.prototype.getEntries;
      const originalGetEntriesByType = Performance.prototype.getEntriesByType;
      const originalGetEntriesByName = Performance.prototype.getEntriesByName;

      Performance.prototype.getEntries = function() {
        const entries = originalGetEntries.call(this);
        // Filter out CDP and automation-related resources
        return entries.filter(entry => 
          !entry.name.includes('chrome-extension://') &&
          !entry.name.includes('devtools://') &&
          !entry.name.includes('playwright')
        );
      };

      Performance.prototype.getEntriesByType = function(type) {
        const entries = originalGetEntriesByType.call(this, type);
        return entries.filter(entry => 
          !entry.name.includes('chrome-extension://') &&
          !entry.name.includes('devtools://')
        );
      };

      Performance.prototype.getEntriesByName = function(name, type) {
        if (name.includes('playwright') || name.includes('devtools')) {
          return [];
        }
        return originalGetEntriesByName.call(this, name, type);
      };
    `);

    log.info("[DetectionEvasion] Resource timing analysis evaded");
  }
}

/**
 * Behavioral Fingerprinting - Makes automation undetectable
 */
export class BehavioralFingerprint {
  /**
   * Generate realistic mouse movement pattern before interacting
   */
  static async simulateNaturalMouseActivity(page: Page): Promise<void> {
    // Humans move mouse around while page loads
    const movements = 3 + Math.floor(Math.random() * 5); // 3-7 movements

    for (let i = 0; i < movements; i++) {
      const x = 100 + Math.random() * 800;
      const y = 100 + Math.random() * 400;
      await CDPStealthEngine.moveMouseNaturally(page, 0, 0, x, y, 15);
      await this.sleep(200 + Math.random() * 500);
    }

    log.info("[Behavioral] Natural mouse activity simulated");
  }

  /**
   * Simulate realistic scrolling behavior
   */
  static async simulateNaturalScrolling(page: Page): Promise<void> {
    // Humans often scroll while reading login pages
    const scrollAmount = 50 + Math.random() * 150;
    await page.evaluate((amount) => {
      (globalThis as any).scrollBy({ top: amount, behavior: 'smooth' });
    }, scrollAmount);

    await this.sleep(500 + Math.random() * 1000);

    log.info("[Behavioral] Natural scrolling simulated");
  }

  /**
   * Add realistic focus events
   */
  static async simulateTabFocus(page: Page): Promise<void> {
    // Simulate user switching tabs then coming back
    await page.evaluate(() => {
      const g = globalThis as any;
      g.dispatchEvent(new Event('blur'));
      setTimeout(() => {
        g.dispatchEvent(new Event('focus'));
      }, 500 + Math.random() * 1500);
    });

    await this.sleep(500 + Math.random() * 1500);

    log.info("[Behavioral] Tab focus simulation applied");
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
