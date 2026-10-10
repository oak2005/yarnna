import { chromium } from 'playwright';
import path from 'path';

async function verifyAuthAndAdmin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const screenshotDir = path.resolve('C:/Users/HP/.gemini/antigravity-ide/brain/f1a5cf46-cad2-4290-9d93-fb155b6aac29');

  try {
    await page.goto('http://localhost:3001');

    // Acknowledge notice if present
    const noticeModal = await page.$('.modal-box');
    if (noticeModal) {
      const checkbox = await page.$('input[type="checkbox"]');
      if (checkbox) await page.check('input[type="checkbox"]');
      const ackBtn = await page.$('button:has-text("Acknowledge & Continue")');
      if (ackBtn) await ackBtn.click();
      await page.waitForTimeout(400);
    }

    // 1. Open Auth Modal: verify quick switcher buttons are removed
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('.modal-box');
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(screenshotDir, 'screen_clean_auth_modal.png') });
    console.log('[Playwright] Captured clean AuthModal screenshot (quick switcher removed).');

    // 2. Sign in as Admin
    await page.fill('input[placeholder="e.g. tunde_tech"]', 'admin');
    await page.fill('input[type="password"]', 'YarnnaSuperAdmin2026!');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForTimeout(800);

    // If notice appears after login
    const noticeAfter = await page.$('.modal-box');
    if (noticeAfter) {
      const checkbox = await page.$('input[type="checkbox"]');
      if (checkbox) await page.check('input[type="checkbox"]');
      const ackBtn = await page.$('button:has-text("Acknowledge & Continue")');
      if (ackBtn) await ackBtn.click();
      await page.waitForTimeout(400);
    }

    // Capture header showing Admin button and Sign Out button
    await page.screenshot({ path: path.join(screenshotDir, 'screen_header_admin_and_signout.png') });
    console.log('[Playwright] Captured header with Admin and Sign Out buttons.');

    // 3. Click the Admin button in the top header
    await page.click('button:has-text("Admin")');
    await page.waitForTimeout(600);

    // 4. Click the "Brand Handles (@yarnna*)" tab in the Admin Portal
    await page.click('button:has-text("Brand Handles")');
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(screenshotDir, 'screen_admin_brand_handles_tab.png') });
    console.log('[Playwright] Captured Brand Handles tab in Admin Portal.');

    // 5. Test Sign Out from the top header
    await page.click('button:has-text("Sign Out")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotDir, 'screen_after_signout.png') });
    console.log('[Playwright] Captured logged-out state with Sign In button restored.');

    console.log('[Playwright] All verification steps completed successfully!');
  } finally {
    await browser.close();
  }
}

verifyAuthAndAdmin().catch((err) => {
  console.error('[Playwright] Verification failed:', err);
  process.exit(1);
});
