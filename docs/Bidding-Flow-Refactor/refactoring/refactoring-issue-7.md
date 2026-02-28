# Refactoring — Issue #7: Duplicated Email Templates & Notification Logic

> **Step 6 of the incremental refactoring plan**
> **Risk level:** Low — behavior-preserving extraction; no domain logic change, no API contract change, no DB schema change
> **Files created:** `services/notification.service.js`
> **Files modified:** `services/auction/auction.service.js`, `scripts/auctionEndNotifier.js`

---

## 1. Problem Overview

Prior to this step, every outbound email in the system was constructed inline at the call site. Three separate modules each independently defined their own full HTML email strings, with the identical structural boilerplate repeated in every one:

| Module                  | Inline emails                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `auction.service.js`    | `_sendSellerEmail`, `_sendCurrentBidderEmail`, `_sendPreviousBidderEmail` (3 private functions) |
| `auctionEndNotifier.js` | winner notification, seller-with-winner, seller-no-bidders (3 inline `sendMail` call blocks)    |

All six email blocks shared the exact same outer HTML structure: `font-family` wrapper div, gradient header div with `h1`, `#f8f9fa` body panel, `hr` separator, footer disclaimer. Only the header gradient color, heading text, and body content differed. This structural boilerplate was duplicated verbatim across modules without a shared builder.

Beyond DRY, the deeper problem is architectural: **email infrastructure concerns (template markup, styling, delivery) were embedded directly in domain orchestration modules** (`auction.service.js`) and scheduling scripts (`auctionEndNotifier.js`). These modules knew — and were responsible for — both domain decisions ("who gets notified when a bid is placed") and presentation decisions ("what the email looks like"). These are two distinct reasons to change (SRP).

---

## 2. Violated Principles

### 2.1 — DRY: Repeated HTML Email Boilerplate (Issue #7, primary)

| Attribute     | Details                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle** | DRY (Don't Repeat Yourself)                                                                                                                                      |
| **Location**  | `auction.service.js` (3 functions) + `auctionEndNotifier.js` (3 inline blocks)                                                                                   |
| **Violation** | The same ~10-line HTML wrapper structure appears 6 times. Changing brand color, font, or footer copy requires editing 6 separate string literals across 2 files. |

This is the classic DRY violation at the **infrastructure layer**: the "shape of an email" is a piece of knowledge that should live in one place. When it is scattered, any brand update becomes a multi-file hunt with a regression risk at each edit site.

### 2.2 — SRP: Domain Modules Own Infrastructure Presentation

| Attribute     | Details                                                                                                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle** | SRP (Single Responsibility Principle)                                                                                                                                                                                                                                  |
| **Location**  | `auction.service.js`, `auctionEndNotifier.js`                                                                                                                                                                                                                          |
| **Violation** | Auction domain service is responsible for: (1) placing bids and (2) constructing HTML email templates. The notifier is responsible for: (1) scheduling/iterating over ended auctions and (2) rendering three email layouts. Each module has a second reason to change. |

### 2.3 — DIP: Domain Modules Directly Depend on `mailer.js`

| Attribute     | Details                                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle** | DIP (Dependency Inversion Principle)                                                                                                                                                                  |
| **Location**  | `auction.service.js` imported `sendMail` from `mailer.js`                                                                                                                                             |
| **Violation** | A high-level orchestration module imports a concrete mailer implementation. Switching mail provider (Nodemailer → SendGrid) or logging all emails in test mode requires modifying the domain service. |

---

## 3. Duplication Analysis

### Shared HTML Structure (repeated 6× before refactor)

Every email used this identical structural skeleton:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div
    style="background: linear-gradient(135deg, [COLOR1] 0%, [COLOR2] 100%);
              padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"
  >
    <h1 style="color: white; margin: 0;">[TITLE]</h1>
  </div>
  <div
    style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;"
  >
    [BODY_CONTENT]
    <div style="text-align: center; margin: 30px 0;">
      <a href="[URL]" style="...background: linear-gradient(135deg, ...)..."
        >[CTA]</a
      >
    </div>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="color: #888; font-size: 12px; text-align: center;">
    This is an automated message from Online Auction. Please do not reply to
    this email.
  </p>
</div>
```

### CTA Button Structure (repeated 6×)

The call-to-action `<a>` button style was also repeated at every email site with minor color variation.

### Caller-to-Mailer dependency (2 modules)

Both `auction.service.js` and `auctionEndNotifier.js` previously imported `sendMail` from `../utils/mailer.js` directly. After this refactor, only `notification.service.js` holds that import.

---

## 4. Refactoring Strategy

### 4.1 Create `notification.service.js`

A new dedicated service module owns all notification responsibilities:

- Building email HTML (using shared layout/CTA helpers).
- Calling `sendMail` — the only module allowed to import `mailer.js`.
- Exposing named, high-level functions that describe _what_ notification is sent (not _how_).

**Exported API:**

| Function                                                                | Called by               | Purpose                                                                     |
| ----------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `sendBidNotifications({ result, productId, productUrl })`               | `auction.service.js`    | Notify seller, current bidder, previous bidder after a bid event            |
| `sendAuctionEndedNotifications({ auction, productUrl, auctionStatus })` | `auctionEndNotifier.js` | Notify winner + seller (PENDING) or seller only (EXPIRED) when auction ends |

**Private helpers (internal only):**

```
buildEmailLayout({ headerGradient, title, bodyHtml })  ← single layout source
buildCtaButton({ href, label, color1, color2 })         ← single CTA source
_sendBidSellerEmail(...)
_sendBidCurrentBidderEmail(...)
_sendBidPreviousBidderEmail(...)
_sendAuctionWonEmail(...)
_sendAuctionEndedSellerEmail(...)
_sendExpiredAuctionEmail(...)
```

### 4.2 Update `auction.service.js`

**Before:** owned three private email functions + imported `sendMail` directly.

**After:** resolves user contact information (DB-fetching responsibility stays here — notification.service is deliberately kept free of DB dependencies), enriches the result object, and delegates:

```javascript
// BEFORE — auction.service.js called sendMail directly via private functions
import { sendMail } from '../../utils/mailer.js';
// ...
function _sendSellerEmail({ seller, result, productUrl }) {
  return sendMail({ to: seller.email, html: `<div style="font-family: Arial...` });
}

// AFTER — auction.service.js enriches data, sends to notification layer
import * as notificationService from '../notification.service.js';
// ...
export async function sendBidNotifications({ result, productId, productUrl }) {
  const [seller, currentBidder, previousBidder] = await Promise.all([...]);
  const enrichedResult = {
    ...result,
    sellerEmail, sellerName,
    currentBidderEmail, currentBidderName,
    previousBidderEmail, previousBidderName
  };
  await notificationService.sendBidNotifications({ result: enrichedResult, productId, productUrl });
}
```

**Why user-fetching stays in `auction.service.js`:** The service already has `userModel` as a declared dependency. Pushing user-fetching into `notification.service` would couple the notification layer to database access — making it harder to unit-test (you'd need a DB mock). Keeping it in auction.service preserves the clean separation: service layer = orchestration; notification layer = presentation + delivery.

### 4.3 Update `auctionEndNotifier.js`

**Before:** contained three full `sendMail({ html: `<div...` })` blocks totalling ~100 lines of inline HTML.

**After:** delegates with a single call per state:

```javascript
// BEFORE — inline HTML in scheduler
await sendMail({
  to: auction.winner_email,
  subject: `🎉 Congratulations!...`,
  html: `<div style="font-family: Arial, sans-serif; max-width: 600px;...`,
});
// ... repeated twice more for seller (with winner) and seller (no bidders)

// AFTER — scheduling concern only
await sendAuctionEndedNotifications({ auction, productUrl, auctionStatus });
```

The notifier now owns only what it should: **iterating over ended auctions, creating orders, and triggering the notification side-effect**. Email content is irrelevant to the scheduler.

---

## 5. Before / After Comparison

### File: `auction.service.js`

| Metric                  | Before                                                                        | After                       |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| Lines                   | ~427                                                                          | ~285                        |
| `sendMail` import       | ✓ (direct)                                                                    | ✗ (removed)                 |
| Private email functions | 3 (`_sendSellerEmail`, `_sendCurrentBidderEmail`, `_sendPreviousBidderEmail`) | 0                           |
| Inline HTML strings     | ~140 lines                                                                    | 0                           |
| Notification delegation | ✗                                                                             | ✓ via `notificationService` |

### File: `auctionEndNotifier.js`

| Metric                  | Before                     | After                                 |
| ----------------------- | -------------------------- | ------------------------------------- |
| Lines                   | ~170                       | ~70                                   |
| `sendMail` import       | ✓ (direct)                 | ✗ (removed)                           |
| Inline `sendMail` calls | 3 blocks (~100 lines HTML) | 0                                     |
| Notification delegation | ✗                          | ✓ via `sendAuctionEndedNotifications` |

### New File: `notification.service.js`

| Metric                                          | Value                                                       |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Lines                                           | ~250                                                        |
| Modules that import `sendMail` from `mailer.js` | **1** (down from 2)                                         |
| Shared layout builder                           | `buildEmailLayout()` — used by all 6 email functions        |
| Shared CTA builder                              | `buildCtaButton()` — used by all 6 email functions          |
| Exported functions                              | 2 (`sendBidNotifications`, `sendAuctionEndedNotifications`) |
| DB/model imports                                | 0 (intentional)                                             |

---

## 6. Updated Project Structure

```
auction-web/src/
├── services/
│   ├── notification.service.js   ← NEW: all email template + delivery logic
│   ├── order.service.js
│   └── auction/
│       ├── auction-state.js
│       ├── auction.service.js    ← UPDATED: delegates email to notification.service
│       └── bid-engine.js
├── scripts/
│   └── auctionEndNotifier.js     ← UPDATED: ~100 lines of inline HTML removed
├── routes/
│   └── product.route.js          (unchanged — external API stable)
└── utils/
    └── mailer.js                 ← only notification.service imports this now
```

---

## 7. Architectural Note

### Why no separate `templates/email/` directory?

A common pattern is to place each email in its own file (e.g., `templates/email/auction-won.template.js`). This step does not do that, deliberately. With six email functions all sharing the same `buildEmailLayout` and `buildCtaButton` helpers, extracting them into separate files would:

1. Break the co-location of the layout helper with its consumers.
2. Add import indirection (`notification.service` → `auction-won.template` → layout helper) without reducing duplication.
3. Create coordination overhead when the layout helper changes.

The current scale (6 email functions in one 250-line file) does not justify this directory. If the email catalog grows to ~15+ distinct templates or if templates begin to be shared across contexts (e.g., order tracking, marketing), a `templates/email/` directory would be warranted. At that point, `notification.service.js` would become a thin dispatcher importing from template files.

This illustrates the YAGNI principle applied to refactoring: introduce structure when the problem it solves is real, not preemptively.

### Why user-fetching stays outside `notification.service.js`?

`notification.service.js` is intentionally kept **free of model/DB dependencies**. This is not arbitrary — it makes the notification service independently unit-testable: pass in a plain data object, assert on the `sendMail` spy. No DB mocking required.

The trade-off is that callers must enrich the data before calling the service. `auction.service.js` already has `userModel` as a dependency (for bid eligibility checks), so the enrichment step costs one Promise.all — no architectural overhead.

### DIP improvement

After this refactor, `mailer.js` is imported in exactly **one** place: `notification.service.js`. All other modules communicate with the notification layer through a named function interface (`sendBidNotifications`, `sendAuctionEndedNotifications`). Switching the mail provider (e.g., to SendGrid) now requires changes in exactly one file, with zero impact on any domain or scheduling module.
