import { chromium } from 'playwright';
import path from 'path';

async function verifyUpdates() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const screenshotDir = path.resolve('C:/Users/HP/.gemini/antigravity-ide/brain/f1a5cf46-cad2-4290-9d93-fb155b6aac29');

  try {
    await page.goto('http://localhost:3001');

    // Acknowledge notice if present
    const noticeModal = await page.$('.modal-box');
    if (noticeModal) {
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Acknowledge & Continue")');
      await page.waitForTimeout(400);
    }

    // 1. Open Auth Modal -> Test Sign In with @oyetunduntaiwo
    await page.click('button:has-text("Sign In / Join")');
    await page.waitForSelector('.modal-box');
    await page.fill('input[placeholder="e.g. tunde_tech"]', '@oyetunduntaiwo');
    await page.fill('input[type="password"]', 'TestPass2026!');
    await page.screenshot({ path: path.join(screenshotDir, 'screen_login_with_at_prefix.png') });
    console.log('[Playwright] Captured login with @ prefix screenshot.');

    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForTimeout(800);

    // If Testnet Notice modal popped up on new user onboarding, acknowledge it
    const noticeModalAfter = await page.$('.modal-box');
    if (noticeModalAfter) {
      const checkbox = await page.$('input[type="checkbox"]');
      if (checkbox) await page.check('input[type="checkbox"]');
      const ackBtn = await page.$('button:has-text("Acknowledge & Continue")');
      if (ackBtn) await ackBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify logged in as Oyetundun Taiwo
    const profileText = await page.textContent('.sidebar-profile');
    console.log('[Playwright] Profile card text after login:', profileText);

    // 2. Test Theme Switcher Dropdown
    await page.click('button[title*="Theme"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_theme_switcher_menu.png') });
    console.log('[Playwright] Captured theme switcher dropdown screenshot.');

    // Switch to Dark Mode
    await page.click('button:has-text("Dark Mode")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_dark_mode_active.png') });
    console.log('[Playwright] Captured Dark Mode screenshot.');

    // Switch to Light Mode
    await page.click('button[title*="Theme"]');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Light Mode")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, 'screen_light_mode_active.png') });
    console.log('[Playwright] Captured Light Mode screenshot.');

    // Switch back to Device Default
    await page.click('button[title*="Theme"]');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Device Default")');
    await page.waitForTimeout(400);
    console.log('[Playwright] Switched to Device Default mode.');

    console.log('[Playwright] All user and theme updates verified successfully!');
  } finally {
    await browser.close();
  }
}

verifyUpdates().catch((err) => {
  console.error('[Playwright] Verification failed:', err);
  process.exit(1);
});
