import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Import our server application and routes
import authRoutes from '../server/routes/auth.js';
import postsRoutes from '../server/routes/posts.js';
import chatsRoutes from '../server/routes/chats.js';
import usersRoutes from '../server/routes/users.js';
import translateRoutes from '../server/routes/translate.js';
import reportsRoutes from '../server/routes/reports.js';
import adminRoutes from '../server/routes/admin.js';
import uploadRoutes from '../server/routes/upload.js';
import { db } from '../server/db.js';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: TestResult[] = [];
let server: http.Server;
let BASE_URL = '';

async function test(category: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ category, name, passed: true, details: 'OK', durationMs });
    console.log(`  [PASS] [${category}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ category, name, passed: false, details: err.message || String(err), durationMs });
    console.error(`  [FAIL] [${category}] ${name}: ${err.message || String(err)}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as any || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function startTestServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postsRoutes);
  app.use('/api/chats', chatsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/translate', translateRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/upload', uploadRoutes);

  return new Promise((resolve) => {
    // Port 3099 for isolated test execution
    server = app.listen(3099, '127.0.0.1', () => {
      BASE_URL = 'http://127.0.0.1:3099/api';
      console.log(`[Test Runner] Test server started at ${BASE_URL}`);
      resolve();
    });
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   YARNNA NIGERIA-FIRST TESTNET AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  await startTestServer();

  let testUserToken = '';
  let testUserId = '';
  let adminToken = '';
  let otherUserToken = '';
  let otherUserId = '';
  let createdPostId = '';
  let directConvId = '';

  // 1. FUNCTIONAL TESTS
  console.log('\n--- 1. FUNCTIONAL TESTING ---');

  await test('Functional: Auth', 'Register new user with testnet credentials', async () => {
    const username = `test_user_${Date.now()}`;
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        display_name: 'Testnet Tester',
        email: `${username}@testnet.yarnna.ng`,
        password: 'UniqueTestPass2026!',
      }),
    });
    assert(res.status === 201, `Expected status 201, got ${res.status}`);
    assert(!!res.data.token, 'Expected token in response');
    assert(res.data.user.username === username, 'Expected matching username');
    assert(res.data.user.password_hash === undefined, 'Password hash must never be returned');
    testUserToken = res.data.token;
    testUserId = res.data.user.id;
  });

  await test('Functional: Auth', 'Register user with leading @ and pure letters (e.g. @oyetunduntaiwo)', async () => {
    const rawUsername = `@oyetundun_${Date.now()}`;
    const expectedClean = rawUsername.replace('@', '');
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: rawUsername,
        display_name: 'Oyetundun Taiwo',
        email: `oyetundun_${Date.now()}@example.com`,
        password: 'UniqueTestPass2026!',
      }),
    });
    assert(res.status === 201, `Expected 201 for username with @ prefix, got ${res.status}`);
    assert(res.data.user.username === expectedClean, 'Leading @ must be stripped automatically');
  });

  await test('Functional: Auth', 'Login using username with @ prefix (e.g. @admin)', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: '@admin',
        password: 'YarnnaSuperAdmin2026!',
      }),
    });
    assert(res.status === 200, `Expected 200 login for @admin, got ${res.status}`);
    assert(res.data.user.username === 'admin', 'Matched admin user');
  });

  await test('Functional: Auth', 'Acknowledge mandatory testnet safety notice', async () => {
    const res = await request('/auth/acknowledge-testnet', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Expected success acknowledge');
    assert(!!res.data.user.acknowledged_testnet_notice_at, 'Expected acknowledge timestamp');
  });

  await test('Functional: Auth', 'Login as seeded admin account', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'admin',
        password: 'YarnnaSuperAdmin2026!',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.user.role === 'super_admin', 'Expected super_admin role');
    adminToken = res.data.token;
  });

  await test('Functional: Auth', 'Login as secondary user (Chioma)', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'chioma_dev',
        password: 'TestnetPass2026!',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    otherUserToken = res.data.token;
    otherUserId = res.data.user.id;
  });

  await test('Functional: Posts', 'Create public text post', async () => {
    const res = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        content: 'Testing Yarnna testnet feed from test suite! Nigeria to the world.',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.post.content.includes('Testing Yarnna'), 'Post content match');
    createdPostId = res.data.post.id;
  });

  await test('Functional: Posts', 'Like and unlike post', async () => {
    // Like
    const likeRes = await request(`/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });
    assert(likeRes.status === 200, `Expected 200, got ${likeRes.status}`);
    assert(likeRes.data.liked === true, 'Expected liked true');
    assert(likeRes.data.likes_count === 1, 'Expected likes_count 1');

    // Unlike
    const unlikeRes = await request(`/posts/${createdPostId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });
    assert(unlikeRes.data.liked === false, 'Expected liked false');
    assert(unlikeRes.data.likes_count === 0, 'Expected likes_count 0');
  });

  await test('Functional: Posts', 'Create threaded reply to post', async () => {
    const res = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
      body: JSON.stringify({
        content: 'Replying to the test yarn! Clean and fast.',
        reply_to_post_id: createdPostId,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.post.reply_to_post_id === createdPostId, 'Reply parent link');

    // Verify parent post threaded view
    const parentRes = await request(`/posts/${createdPostId}`);
    assert(parentRes.data.replies.length >= 1, 'Expected at least 1 reply in thread');
  });

  await test('Functional: Posts', 'Edit post authored by self', async () => {
    const res = await request(`/posts/${createdPostId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        content: 'Updated post content after editing.',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.post.content === 'Updated post content after editing.', 'Content updated');
  });

  await test('Functional: Posts', 'Bookmark and unbookmark post', async () => {
    const bmRes = await request(`/posts/${createdPostId}/bookmark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert(bmRes.status === 200, `Expected 200, got ${bmRes.status}`);
    assert(bmRes.data.bookmarked === true, 'Expected bookmarked true');
  });

  await test('Functional: Social', 'Follow and unfollow user', async () => {
    const followRes = await request(`/users/${otherUserId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert(followRes.status === 200, `Expected 200, got ${followRes.status}`);
    assert(followRes.data.is_following === true, 'Expected is_following true');
  });

  await test('Functional: Social', 'Search users and posts', async () => {
    const res = await request('/users/search?q=laptop');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.posts), 'Expected posts array');
    assert(res.data.posts.length > 0, 'Expected to find seeded laptop post');
  });

  await test('Functional: Profile', 'Edit username to valid handle with underscores and numbers', async () => {
    const newHandle = `edited_handle_${Date.now().toString().slice(-4)}`;
    const res = await request('/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        username: `@${newHandle}`,
        bio: 'Updated Nigerian tech enthusiast bio',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.user.username === newHandle, `Expected username to be ${newHandle}, got ${res.data.user.username}`);
    assert(!!res.data.token, 'Expected refreshed token in response');
    testUserToken = res.data.token;

    // Verify fetching public profile by new handle
    const profRes = await request(`/users/profile/${newHandle}`);
    assert(profRes.status === 200, `Expected 200 fetching profile by new username, got ${profRes.status}`);
    assert(profRes.data.user.id === testUserId, 'Profile user ID match');
  });

  await test('Functional: Profile', 'Reject username edit to duplicate taken username', async () => {
    const res = await request('/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        username: 'tunde_tech',
      }),
    });
    assert(res.status === 409, `Expected 409 conflict for taken username, got ${res.status}`);
    assert(res.data.error.includes('already taken'), 'Expected already taken error message');
  });

  await test('Functional: Profile', 'Reject username edit with invalid characters', async () => {
    const res = await request('/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        username: 'bad*username!',
      }),
    });
    assert(res.status === 400, `Expected 400 for invalid username characters, got ${res.status}`);
  });

  await test('Functional: Profile', 'Reject non-admin from renaming to @yarnna* or @customerservice', async () => {
    const res = await request('/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        username: 'yarnna_vip',
      }),
    });
    assert(res.status === 400, `Expected 400 for reserved yarnna handle, got ${res.status}`);
    assert(res.data.error.includes('reserved'), 'Expected reserved handle error message');
  });

  await test('Functional: Auth', 'Reject registration with @yarnna* or @customerservice', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'yarnna_support',
        display_name: 'Fake Yarnna Support',
        email: `fake_${Date.now()}@test.com`,
        password: 'ValidPassword2026!',
      }),
    });
    assert(res.status === 400, `Expected 400 for reserved handle, got ${res.status}`);
    assert(res.data.error.includes('reserved'), 'Expected reserved handle error message');
  });

  // 2. CHAT & MESSAGING TESTS
  console.log('\n--- 2. CHAT & MESSAGING TESTING ---');

  await test('Functional: Chat', 'Create 1-to-1 conversation', async () => {
    const res = await request('/chats', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        type: 'direct',
        participant_ids: [otherUserId],
      }),
    });
    assert(res.status === 201 || res.status === 200, `Expected 201/200, got ${res.status}`);
    assert(!!res.data.conversation_id, 'Expected conversation_id');
    directConvId = res.data.conversation_id;
  });

  await test('Functional: Chat', 'Send private text message', async () => {
    const res = await request(`/chats/${directConvId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        message_type: 'text',
        content: 'Hello Chioma, testing WhatsApp-style direct chat on Yarnna!',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.message.content.includes('Hello Chioma'), 'Message text match');
  });

  await test('Functional: Chat', 'Send voice note message (with duration validation)', async () => {
    const res = await request(`/chats/${directConvId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        message_type: 'voice_note',
        media_url: 'https://cdn.freesound.org/previews/560/560446_11861866-lq.mp3',
        voice_duration_seconds: 18,
        content: 'Voice note (18s)',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.message.message_type === 'voice_note', 'Message type voice_note');
    assert(res.data.message.voice_duration_seconds === 18, 'Duration recorded');
  });

  await test('Functional: Chat', 'Voice note exceeding 120s limit is rejected', async () => {
    const res = await request(`/chats/${directConvId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        message_type: 'voice_note',
        media_url: 'https://example.com/oversized.mp3',
        voice_duration_seconds: 145, // Exceeds 120s limit
        content: 'Oversized voice note',
      }),
    });
    assert(res.status === 400, `Expected 400 for >120s, got ${res.status}`);
  });

  await test('Functional: Chat', 'Mark conversation read and verify unread count', async () => {
    const res = await request(`/chats/${directConvId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // 3. TRANSLATION TESTS
  console.log('\n--- 3. OPTIONAL AI TRANSLATION TESTING ---');

  await test('Functional: Translate', 'Translate Nigerian Pidgin to English', async () => {
    const res = await request('/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Abeg, who sabi where I fit get better laptop for Lagos?',
        source_lang: 'pcm',
        target_lang: 'en',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.translated_text.toLowerCase().includes('laptop'), 'Translation preserved laptop');
    assert(res.data.translated_text.toLowerCase().includes('please'), 'Abeg translated to Please');
  });

  await test('Functional: Translate', 'Translate Yoruba greeting to English', async () => {
    const res = await request('/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'E kaasan gbogbo eniyan',
        source_lang: 'yo',
        target_lang: 'en',
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.translated_text.toLowerCase().includes('good afternoon'), 'E kaasan translated to Good afternoon');
  });

  await test('Functional: Translate', 'Translation cache hit verification', async () => {
    const res = await request('/translate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'E kaasan gbogbo eniyan',
        source_lang: 'yo',
        target_lang: 'en',
      }),
    });
    assert(res.data.cached === true, 'Expected cached true on repeat request');
  });

  // 4. SECURITY & PERMISSION TESTS (OWASP DEFENSES)
  console.log('\n--- 4. SECURITY & PRIVACY TESTING ---');

  await test('Security: Auth Bypass', 'Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request('/posts', {
      method: 'POST',
      body: JSON.stringify({ content: 'Unauthenticated post attempt' }),
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('Security: Private Data Isolation', 'Non-participant cannot read private conversation messages', async () => {
    // Amina was not added to directConvId between test_user and chioma
    const aminaLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'amina_k', password: 'TestnetPass2026!' }),
    });
    const aminaToken = aminaLogin.data.token;

    const res = await request(`/chats/${directConvId}/messages`, {
      headers: { Authorization: `Bearer ${aminaToken}` },
    });
    assert(res.status === 403, `Expected 403 Forbidden for non-participant, got ${res.status}`);
  });

  await test('Security: Broken Object Level Auth (IDOR)', 'User cannot edit another user post', async () => {
    const res = await request(`/posts/${createdPostId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${otherUserToken}` }, // Chioma trying to edit testUser's post
      body: JSON.stringify({ content: 'Malicious IDOR edit attempt' }),
    });
    assert(res.status === 403, `Expected 403 Forbidden on IDOR edit, got ${res.status}`);
  });

  await test('Security: Video Blocking', 'Explicit rejection of video file upload with HTTP 415', async () => {
    // Attempt to post video url
    const res = await request('/posts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        content: 'Check out this video',
        photo_url: 'https://example.com/video.mp4',
      }),
    });
    assert(res.status === 415, `Expected 415 for video URL, got ${res.status}`);
    assert(res.data.error.includes('Video uploads and links are not supported'), 'Correct video error message');
  });

  await test('Security: Privilege Escalation', 'Normal user cannot access admin metrics endpoint', async () => {
    const res = await request('/admin/metrics', {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert(res.status === 403, `Expected 403 Forbidden for normal user on admin endpoint, got ${res.status}`);
  });

  await test('Security: Admin Privacy Boundary', 'Admin dashboard does NOT leak private message text', async () => {
    const res = await request('/admin/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200 for admin, got ${res.status}`);
    assert(res.data.activity.aggregate_messages_sent !== undefined, 'Aggregate message count present');
    assert(res.data.messages === undefined, 'Raw message text must never be returned in admin metrics');
  });

  await test('Security: Moderation Accountability', 'Moderation status change requires mandatory documented reason', async () => {
    const res = await request(`/admin/users/${testUserId}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'restricted_posting',
        reason: '', // Empty reason should fail
      }),
    });
    assert(res.status === 400, `Expected 400 for empty reason, got ${res.status}`);
  });

  await test('Security: Audit Trail', 'Administrative action writes immutable audit log entry', async () => {
    // Perform valid action with reason
    await request(`/admin/users/${testUserId}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'restricted_posting',
        reason: 'Automated test suite policy verification.',
      }),
    });

    const auditRes = await request('/admin/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.status === 200, `Expected 200, got ${auditRes.status}`);
    assert(auditRes.data.audit_logs.length > 0, 'Audit logs populated');
    const latest = auditRes.data.audit_logs[0];
    assert(latest.action === 'USER_RESTRICTED_POSTING', 'Action logged correctly');
    assert(latest.reason.includes('Automated test suite'), 'Reason captured');
  });

  await test('Security: Brand Reservation', 'Admin can toggle handle reservation on and off', async () => {
    // 1. Lift restriction
    const liftRes = await request('/admin/settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restrict_yarnna_handles: false,
        reason: 'Testing admin toggle to lift handle restriction',
      }),
    });
    assert(liftRes.status === 200, `Expected 200, got ${liftRes.status}`);
    assert(liftRes.data.settings.restrict_yarnna_handles === false, 'Restriction lifted');

    // 2. Re-enforce restriction
    const enforceRes = await request('/admin/settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restrict_yarnna_handles: true,
        reason: 'Testing admin toggle to re-enforce handle restriction',
      }),
    });
    assert(enforceRes.status === 200, `Expected 200, got ${enforceRes.status}`);
    assert(enforceRes.data.settings.restrict_yarnna_handles === true, 'Restriction re-enforced');
  });

  await test('Functional: Accounts', 'Verify official system accounts exist', async () => {
    const officialHandles = ['yarnna', 'yarnnaupdate', 'yarnnasafety', 'customerservice'];
    for (const h of officialHandles) {
      const res = await request(`/users/profile/${h}`);
      assert(res.status === 200, `Expected profile for @${h} to exist, got ${res.status}`);
      assert(res.data.user.username === h, `Username match for @${h}`);
    }
  });

  // 5. COMMUNITY REPORTING & SAFETY
  console.log('\n--- 5. COMMUNITY REPORTING & SAFETY TESTING ---');

  await test('Functional: Safety', 'User can submit report on offending post', async () => {
    const res = await request('/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherUserToken}` },
      body: JSON.stringify({
        target_type: 'post',
        target_id: createdPostId,
        category: 'spam',
        reason: 'Automated test report submission.',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(!!res.data.report_id, 'Report ID generated');
  });

  await test('Functional: Safety', 'User can submit appeal for restriction', async () => {
    const res = await request('/reports/appeal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        action_id: 'general',
        appeal_reason: 'I am testing the platform in good faith.',
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(!!res.data.appeal_id, 'Appeal ID generated');
  });

  // Teardown
  server.close();

  // Print Summary
  console.log('\n======================================================');
  console.log('                 TEST SUMMARY REPORT                  ');
  console.log('======================================================');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Pass Rate:       ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error('Some tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('All tests passed successfully with zero failures!\n');
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  if (server) server.close();
  process.exit(1);
});
