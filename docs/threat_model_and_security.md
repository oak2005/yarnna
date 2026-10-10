# Yarnna Threat Model and Security Safeguards Specification

## 1. Overview and Threat Modeling Methodology

This document outlines the threat model, vulnerability mitigation controls, and operational security boundaries for Yarnna during its Nigeria-first testnet phase. The architecture follows defense-in-depth principles adhering to the OWASP Top 10 Web Application Security Risks and OWASP API Security Top 10.

---

## 2. Threat Vector Matrix and Defense Architecture

| Threat Vector | Potential Impact | Severity | Primary Mitigation Controls in Yarnna |
| :--- | :--- | :--- | :--- |
| **Cross-User Data Leakage (Private Messages)** | Unauthorized access to direct or group communications | Critical | Row Level Security (RLS) policies at the database layer; server-side participant authorization checks before every query; strict API boundary separation between public feeds and chat. |
| **Administrative Abuse & Eavesdropping** | Rogue moderator or administrator reading private direct messages | Critical | Database schema isolates private chats. Admin dashboard APIs explicitly prohibit message content inspection. Audit logging tracks every administrative lookup and moderation decision. |
| **Malicious File Uploads & Polyglots** | Remote code execution, XSS, or malware distribution via photos/voice notes | High | Client-side Canvas re-encoding strips metadata and EXIF tags. Server-side magic-byte header inspection verifies authentic JPEG/PNG/WebP/WebM signatures. Randomized UUID storage keys. No execution permissions on upload directories. |
| **Video Feature Creep & Bandwidth Denial** | Uncontrolled quota exhaustion from video files | High | Hard reject on client and server. File upload filters reject video MIME types (`video/*`) with HTTP 415. No video UI buttons are exposed in the interface. |
| **Account Takeover & Credential Stuffing** | Hijacking of user identities and impersonation | High | Argon2id/Bcrypt password hashing (12 rounds). Strict rate limiting on authentication endpoints (5 attempts per 15 minutes per IP). Session invalidation on password reset. |
| **Insecure Direct Object References (IDOR)** | Modifying another user's post, bookmark, or message | High | Authorization tokens (JWT) validate user identity against resource ownership on every mutation endpoint. No client-supplied user IDs are trusted without session verification. |
| **Spam and Automated Feed Manipulation** | Network flooding, bot spam, and degraded feed quality | Medium | Global rate limiter (100 requests per minute); post creation rate limiter (1 post per 15 seconds); automatic duplicate post detection; community reporting queue. |
| **Quota Depletion / Free-Tier Denial of Service** | Exhausting free database, compute, or storage quotas | High | Hard file size ceilings (2.5 MB photo, 2.0 MB voice note, 120s duration). Exponential backoff on polling. Response payload pagination (20 items max per cursor). |
| **Insecure AI Translation Leakage** | Private communications inadvertently fed to external models | High | Zero automatic translation. Translation only executes on explicit user click. Private chats are not logged to third-party model training datasets. |

---

## 3. Data Classification and Access Matrix

| Data Classification | Examples | Storage Location | Access Authorization | Admin Visibility |
| :--- | :--- | :--- | :--- | :--- |
| **Public Social Data** | Posts, public replies, likes, reposts, usernames, bios | `posts`, `users`, `follows` | Any authenticated user and public feed consumers | Fully viewable for content moderation |
| **Private Communication Data** | 1-to-1 chats, group chats, voice notes, chat photos | `messages`, `conversations`, `conversation_participants` | Only authorized conversation participants | **Strictly prohibited**. Admins can only view aggregate counts and report metadata. |
| **Moderation Evidence Data** | Reported post snippet, report category, reason, reporter ID | `reports`, `moderation_actions` | Assigned safety officers and administrators | Restricted to active report review workflows |
| **Security Audit Logs** | Admin actions, IP addresses, timestamps, ban reasons | `admin_audit_logs` | Super administrators only | Read-only access; immutable log stream |
| **Authentication Secrets** | Password hashes, session tokens, JWT signing secrets | Environment variables, `users` | Auth controller only; secrets never logged or serialized | Invisible; zero access |

---

## 4. Input Validation and Sanitization Standards

1. **HTML and Script Injection (XSS)**:
   - All text feeds are rendered using modern framework escaping (React JSX virtual DOM).
   - Raw HTML rendering (`dangerouslySetInnerHTML`) is prohibited.
   - Text posts and chat messages are sanitized using strict character encoding.
2. **SQL Injection**:
   - Zero concatenated SQL strings.
   - All queries use parameterized statements or validated ORM bindings.
3. **Audio Voice Note Safeguards**:
   - Web Audio API recording is capped at 120 seconds in the browser recorder.
   - Server validates payload duration and maximum file size of 2 MB.
   - Formats restricted to WebM audio, Ogg Opus, or MP4 AAC.
4. **Photo Upload Safeguards**:
   - Images are normalized and re-compressed in browser memory.
   - GPS coordinates and camera serial numbers are erased before upload.
   - Maximum file size: 2.5 MB. Dimensions capped at 1600x1600 pixels.

---

## 5. Security Incident Response Protocol

1. **Detection**: Realtime monitoring of failed login spikes, 4xx/5xx status thresholds, and unexpected storage spikes.
2. **Containment**: Ability to place specific accounts into restricted status (`posting_restricted_until`, `messaging_restricted_until`) or temporary platform read-only mode via admin feature flags.
3. **Remediation**: Hotpatch deployment via git pipeline; session revocation via secret rotation.
4. **Post-Mortem & Disclosure**: Documentation of root cause, affected scope, and user advisory in accordance with Nigerian Data Protection Commission (NDPC) requirements.
