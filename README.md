# Yarnna: Nigeria-First Social Network

> A Nigerian-first social media platform designed around public text posts, photo sharing, and private messaging. Simple, familiar, accessible, low-bandwidth, and privacy-conscious.

---

## 1. Product Vision & Principles

Yarnna bridges the public square and private community:
- **Public Feed (X-inspired)**: Short text posts, photo attachments, threading, reposts, bookmarks, likes, and trending Nigerian topics.
- **Private Messaging (WhatsApp-inspired)**: Fast 1-on-1 and group chats, read receipts, audio waveform voice notes (up to 120s limit), photos, and message editing/deletion.
- **Nigeria First**: Low data consumption, localized Pidgin/Yoruba/Igbo/Hausa AI translation, and compliance with the Nigeria Data Protection Act (NDPA) 2023.
- **Privacy First**: Direct messages are strictly isolated. Administrators and moderators cannot access or read private chats.
- **Zero-Budget Testnet**: Built to operate strictly within verified free-tier operational limits ($0 / ₦0). Video uploads and calls are intentionally disabled in this phase.

---

## 2. Key Features

- **Public Social Feeds**: Reverse chronological and recommended feeds with hashtags and search.
- **Flexible Usernames**: Supports letters only (e.g. `@oyetunduntaiwo`), or letters with numbers and underscores (e.g. `@tunde_tech_2026`). Automatic leading `@` stripping and live uniqueness checks.
- **Username Editing**: Users can change their unique username handle at any time via Profile Settings.
- **3-Way Theme Switcher**: Toggle smoothly between Light Mode, Dark Mode, and System / Device Default with automatic OS color-scheme listener.
- **Audio Voice Notes**: In-chat recording and playback with visual waveforms, strictly capped at 120 seconds.
- **Multilingual Nigerian Translation**: Optional local translation engine for Nigerian Pidgin, Yoruba, Igbo, and Hausa to English.
- **Admin & Moderation Portal**: Real-time Nigerian platform metrics (Africa/Lagos time), content moderation queue, penalty appeals, and immutable tamper-evident audit logs.
- **Safety & NDPA Compliance**: User reporting, user blocking, consent tracking, and testnet safety advisory notice.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vanilla CSS (Design Tokens, responsive desktop and mobile nav bars, high-contrast accessible palettes).
- **Backend**: Express 5, Node.js, JWT authentication with bcrypt password hashing.
- **Database**: Multi-tier architecture (Local persistent JSON engine for rapid testnet iteration, SQL schema with Row-Level Security for PostgreSQL).
- **Deployment**: Dual deployment ready for Vercel Serverless Functions and standalone Node.js hosts.
- **Testing**: End-to-end automated testing suite with 34 comprehensive tests and Playwright headless browser verification.

---

## 4. Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/oak2005/yarnna.git
cd yarnna

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Running Locally
```bash
# Start the fullstack development server
npm start

# Or build the frontend
npm run build
```
Visit `http://localhost:3001` in your browser.

### Running Tests
```bash
# Run the automated test suite (34 tests covering auth, feed, chat, privacy, and admin)
npm test
```

---

## 5. Deployment

### Deploying to Vercel
This repository includes a native `vercel.json` and `api/index.ts` serverless adapter:
1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Set the Framework Preset to **Vite**.
4. Configure the environment variables in your Vercel project settings:
   - `JWT_SECRET` (generate a secure random 32-character string)
   - `NODE_ENV=production`
   - `ADMIN_BOOTSTRAP_KEY`
5. Click **Deploy**. Vercel will build the frontend into `dist/` and route API calls to the serverless function.

---

## 6. Project Architecture & Documentation

Full architectural and regulatory documentation is available in the [`docs/`](./docs/) directory:
- [`docs/architecture_and_zero_budget_spec.md`](./docs/architecture_and_zero_budget_spec.md): Technical architecture and verified zero-budget free tiers.
- [`docs/database_schema_and_rls.sql`](./docs/database_schema_and_rls.sql): Complete SQL schema, indexes, and Row Level Security policies.
- [`docs/threat_model_and_security.md`](./docs/threat_model_and_security.md): Threat model, OWASP Top 10 mitigations, and admin privacy boundaries.
- [`docs/legal_and_privacy_compliance.md`](./docs/legal_and_privacy_compliance.md): NDPA 2023 compliance, privacy policy, and terms of service.
- [`docs/community_guidelines_and_moderation.md`](./docs/community_guidelines_and_moderation.md): Safety rules, CSAM policy, and moderation workflows.
- [`docs/deployment_backup_and_incident_response.md`](./docs/deployment_backup_and_incident_response.md): Disaster recovery, 72-hour breach response, and runbooks.
- [`docs/creator_revenue_sharing_spec.md`](./docs/creator_revenue_sharing_spec.md): Future monetization framework and Paystack/Flutterwave escrow design.
- [`docs/master_test_report_and_verification.md`](./docs/master_test_report_and_verification.md): Verification report confirming all 15 release gates.

---

## 7. License

ISC License. Built for Nigeria First.
