# Yarnna Privacy by Design and Nigerian Legal Compliance Assessment

## 1. Statutory and Regulatory Compliance Framework

Yarnna is designed Nigeria-first. Prior to commercial public launch, Yarnna aligns its testnet operations and product architecture with applicable Nigerian laws and regulatory guidelines:

### 1.1 Applicable Statutes
1. **Nigeria Data Protection Act 2023 (NDPA)**: Governs the lawful collection, processing, retention, and transfer of personal data of data subjects residing in Nigeria.
2. **Nigeria Data Protection Commission (NDPC) Directives**: Compliance with registration mandates for data controllers and processors of major importance when thresholds are reached.
3. **Constitution of the Federal Republic of Nigeria 1999 (as amended)**: Section 37 guarantees and protects the privacy of citizens, their homes, correspondence, telephone conversations, and telegraphic communications.
4. **Cybercrimes (Prohibition, Prevention, Etc.) Act 2015 (and 2024 Amendments)**: Safeguards against unlawful access, cyberstalking, identity theft, and child sexual abuse material (CSAM).
5. **Child's Rights Act 2003**: Sets legal age standards and child protection imperatives across Nigerian jurisdictions.
6. **Federal Competition and Consumer Protection Act 2018 (FCCPA)**: Protects consumer welfare, fair terms of service, and accurate disclosures.

---

## 2. Privacy by Design: Personal Data Mapping Matrix

| Category of Data | Purpose of Collection | Lawful Basis (NDPA Sec. 25) | Access Authorization | Retention Schedule | User Rights Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Username & Display Name** | Account identification and profile personalization | Performance of Contract (Terms of Service) | Publicly visible to all users | Retained until account deletion | Modifiable via Profile Settings |
| **Email Address** | Authentication, security alerts, and password recovery | Performance of Contract | Auth controller and security pipeline only. Never displayed publicly. | Retained until account deletion | Modifiable via Account Settings |
| **Password Hash** | Account access verification (Argon2id/Bcrypt) | Performance of Contract | Internal authentication service only. Never logged or exposed. | Retained until account deletion or password change | Modifiable via Password Reset |
| **Public Posts & Media** | Social networking, community sharing, discovery | Consent and Contract Performance | Publicly visible across the platform | Retained until deleted by user or moderated | Deletable via Post Menu |
| **Private Direct & Group Messages** | Private one-to-one and group messaging | Performance of Contract | Strictly authorized conversation participants | Retained until deleted by user or conversation removed | Deletable per message (for me / for all) |
| **Voice Notes** | Ephemeral or persistent audio messaging | Performance of Contract | Strictly authorized conversation participants | Retained until deleted by participants | Deletable per message |
| **IP Addresses & Access Logs** | Security monitoring, abuse prevention, rate limiting | Legitimate Interests (Platform Security) | Systems and security logs; strictly restricted | 90 days rolling window, then permanently purged | Anonymized after rolling period |
| **Moderation Reports** | Community safety, reporting violations, policy enforcement | Legal Obligation and Legitimate Interests | Authorized safety officers and administrators | 180 days for audit trail | Accessible via Transparency Reports |

---

## 3. Mandatory Testnet Notice and Onboarding Consent

Under NDPA Section 26 (Consent) and FCCPA guidelines, testnet participants must receive transparent disclosure regarding the experimental nature of the platform.

### Required User Notice:
> **Yarnna is currently in testnet.**
> 
> Yarnna is still being tested. Please do not use your personal passwords or passwords from other apps. Do not share sensitive personal information, banking details, verification codes or private information you would not want exposed.
> 
> Create a test account using a unique password and only the information required for testing. Never reuse your email password or another account's password.
> 
> For now, yarn with your people, test the features and have fun. Features may change, messages or content may be lost, and the service may experience downtime during testing.
> 
> Yarnna currently has no advertising or creator revenue payouts. We will announce future monetisation and creator rewards when the platform is ready.

### Enforcement:
- Displayed prominently in the modal dialog on initial onboarding.
- Users must explicitly acknowledge before completing profile creation.
- A permanent link to the testnet notice is embedded in the navigation and Help center.

---

## 4. Child Safety and Illegal Content Handling

1. **Age Threshold**: The platform requires users to confirm they meet minimum age requirements (13+ with parental consent, 18+ independent).
2. **Zero Tolerance for CSAM**: Any detected child sexual abuse material or exploitation triggers immediate account termination, content isolation, and escalation to law enforcement agencies (e.g., NAPTIP and Nigeria Police Cybercrime Unit) in line with mandatory reporting requirements.
3. **Bullying and Harassment**: Granular block and report controls empower users to immediately terminate contact with harassing accounts.
4. **No Routine Administrator Eavesdropping**: Administrator accounts cannot monitor or read private conversations without a lawful court order or formal warrant verified by legal counsel.
