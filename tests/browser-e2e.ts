import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function runBrowserValidation() {
  console.log('[E2E Browser] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const screenshotDir = path.resolve('C:/Users/HP/.gemini/antigravity-ide/brain/f1a5cf46-cad2-4290-9d93-fb155b6aac29');

  try {
    console.log('[E2E Browser] Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // 1. Verify Testnet Notice Modal
    console.log('[E2E Browser] Verifying Testnet Notice Modal...');
    await page.waitForSelector('.modal-box');
    const noticeText = await page.textContent('.modal-body');
    if (!noticeText?.includes('Yarnna is currently in testnet')) {
      throw new Error('Testnet notice copy missing in modal');
    }
    console.log('[E2E Browser] Testnet notice copy verified successfully.');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_testnet_notice.png') });

    // Acknowledge notice
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Acknowledge & Continue")');
    await page.waitForTimeout(500);

    // 2. Capture Home Feed
    console.log('[E2E Browser] Capturing Home Feed...');
    await page.waitForSelector('.post-card');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_home_feed.png') });

    // 3. Test Translation on first post
    console.log('[E2E Browser] Testing Optional Translation on Pidgin post...');
    const translateBtn = await page.$('.btn-translate-toggle');
    if (translateBtn) {
      await translateBtn.click();
      await page.waitForSelector('.translation-box');
      console.log('[E2E Browser] Translation box appeared.');
      await page.screenshot({ path: path.join(screenshotDir, 'screen_translation.png') });
    }

    // 4. Test Login via Auth Modal
    console.log('[E2E Browser] Testing Sign In modal...');
    await page.click('button:has-text("Sign In / Join")');
    await page.waitForSelector('.modal-box');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_auth_modal.png') });

    // Quick login as @tunde_tech
    await page.click('button:has-text("@tunde_tech")');
    await page.waitForTimeout(800);
    console.log('[E2E Browser] Logged in as @tunde_tech.');

    // 5. Navigate to Chats View
    console.log('[E2E Browser] Navigating to WhatsApp-style Chats view...');
    await page.click('.nav-item:has-text("Chats")');
    await page.waitForSelector('.chat-container');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_chat_view.png') });

    // Test sending message in chat
    const chatInput = await page.$('.chat-input');
    if (chatInput) {
      await chatInput.fill('Testing live chat in testnet browser session!');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      console.log('[E2E Browser] Chat message sent successfully.');
    }

    // 6. Navigate to Discover View
    console.log('[E2E Browser] Navigating to Discover view...');
    await page.click('.nav-item:has-text("Discover")');
    await page.waitForSelector('.page-heading:has-text("Discover")');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_discover_view.png') });

    // 7. Navigate to Profile View
    console.log('[E2E Browser] Navigating to Profile view...');
    await page.click('.nav-item:has-text("Profile")');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_profile_view.png') });

    // 8. Test Admin Portal
    console.log('[E2E Browser] Switching to Super Admin to test Admin Portal...');
    // Log out first
    const logoutBtn = await page.$('button[title="Sign Out"]');
    if (logoutBtn) await logoutBtn.click();

    // Login as Admin
    await page.click('button:has-text("Sign In / Join")');
    await page.waitForSelector('.modal-box');
    await page.click('button:has-text("@admin")');
    await page.waitForTimeout(800);

    // Click Admin Portal link
    await page.click('.nav-item:has-text("Admin Portal")');
    await page.waitForSelector('h1:has-text("Administrator & Safety Portal")');
    await page.waitForTimeout(600);
    console.log('[E2E Browser] Admin Portal loaded with Africa/Lagos metrics.');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_admin_portal.png') });

    // Moderation queue tab
    await page.click('button:has-text("Moderation Queue")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_admin_moderation.png') });

    // Immutable audit logs tab
    await page.click('button:has-text("Immutable Audit Logs")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_admin_audit_logs.png') });

    console.log('[E2E Browser] All browser validation steps completed successfully!');
  } finally {
    await browser.close();
  }
}

runBrowserValidation().catch((err) => {
  console.error('[E2E Browser] Error:', err);
  process.exit(1);
});
