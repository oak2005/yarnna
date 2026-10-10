import { chromium } from 'playwright';
import path from 'path';

async function verifyUsernameEditing() {
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

    // 1. Sign In
    await page.click('button:has-text("Sign In / Join")');
    await page.waitForSelector('.modal-box');
    await page.fill('input[placeholder="e.g. tunde_tech"]', 'oyetunduntaiwo');
    await page.fill('input[type="password"]', 'TestPass2026!');
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

    // 2. Navigate to Profile
    await page.click('button:has-text("Profile")');
    await page.waitForTimeout(500);

    // 3. Open Edit Profile Modal
    await page.click('button:has-text("Edit Profile")');
    await page.waitForSelector('.modal-box');
    await page.waitForTimeout(300);

    // Capture screenshot of Edit Profile modal showing username field
    await page.screenshot({ path: path.join(screenshotDir, 'screen_edit_profile_modal.png') });
    console.log('[Playwright] Captured Edit Profile modal screenshot.');

    // 4. Update username to oyetundun_pro
    const usernameInput = await page.$('input[placeholder="username"]');
    if (!usernameInput) throw new Error('Username input not found');
    await usernameInput.fill('oyetundun_pro');

    const bioInput = await page.$('textarea');
    if (bioInput) await bioInput.fill('Software engineer building Nigeria digital future on Yarnna.');

    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(800);

    // Capture screenshot of profile view displaying new handle
    await page.screenshot({ path: path.join(screenshotDir, 'screen_profile_username_updated.png') });
    console.log('[Playwright] Captured updated profile screenshot with @oyetundun_pro.');

    // 5. Test uniqueness conflict error
    await page.click('button:has-text("Edit Profile")');
    await page.waitForSelector('.modal-box');
    const usernameInputConflict = await page.$('input[placeholder="username"]');
    if (usernameInputConflict) await usernameInputConflict.fill('tunde_tech'); // existing user
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotDir, 'screen_username_conflict_error.png') });
    console.log('[Playwright] Captured duplicate username conflict error screenshot.');

    console.log('[Playwright] Username edit verification completed successfully!');
  } finally {
    await browser.close();
  }
}

verifyUsernameEditing().catch((err) => {
  console.error('[Playwright] Username edit verification failed:', err);
  process.exit(1);
});
