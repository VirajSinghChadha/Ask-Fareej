# Ask Fareej Management

> **What this is:** the **management website** – the staff / admin interface of Ask Fareej (not the resident app or the marketing website).

*Smarter Communities. Better Living.*

A multilingual (English, العربية, हिन्दी), accessibility-first management website for UAE residential communities.
It runs entirely on your computer. There are no packages to install and no GitHub or cloud account is needed.

## Run it

Requires Node.js 20 or newer.

```bash
cd ask-fareej-management
node server.js
```

Then open http://localhost:4173.

On first start, the server creates sample data in `data/db.json`. To reset everything to the sample data, stop the server, run `npm run reset-data`, then start it again.

## Demonstration accounts (local demo only)

These are listed on the login page while `DEMO_MODE` is on (the default). They are **not** production credentials.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@askfareej.demo | Fareej-Admin-2026 |
| Community manager | manager@askfareej.demo | Fareej-Manager-2026 |
| Maintenance coordinator | coordinator@askfareej.demo | Fareej-Coord-2026 |
| View only | viewer@askfareej.demo | Fareej-Viewer-2026 |

Hide them with `DEMO_MODE=false node server.js`.

## Security model

- Passwords are hashed with scrypt. Sessions are random tokens in `HttpOnly`, `SameSite=Strict` cookies (30 days with "Remember me", otherwise 12 hours).
- Every API call checks the session, the user's role permissions **and** which communities they may see. Hiding buttons in the browser is only a convenience.
- Sign-in is locked for 15 minutes after 5 failed attempts.
- Content Security Policy and other security headers are sent with every response. State-changing requests require a custom header, which blocks cross-site form posts.
- Resident-visible changes need the right role: coordinators can draft, but only managers can publish. Only administrators approve finances or manage access.
- For a real deployment: serve over HTTPS, set `SECURE_COOKIES=true`, move sessions and data to a proper database, and add email-based password reset.

## Roles

| | Admin | Manager | Coordinator | Viewer |
|---|---|---|---|---|
| View assigned communities | ✓ | ✓ | ✓ | ✓ |
| Maintenance: draft / update status | ✓ | ✓ | ✓ | |
| Publish maintenance & map updates to residents | ✓ | ✓ | | |
| Announcements: write drafts | ✓ | ✓ | ✓ | |
| Announcements: approve & publish | ✓ | ✓ | | |
| Finances: edit / show to residents | ✓ | ✓ | | |
| Finances: approve | ✓ | | | |
| Permissions (users & roles) | ✓ | | | |

## Ask Fareej assistant

The floating **Ask Fareej** button opens a guided assistant. It answers from the signed-in user's own records and the built-in help, in the selected language. It does **not** send data to an outside AI service. It can find records, explain features and prepare announcement drafts, but it never publishes, approves, deletes or changes permissions. Drafts open in a form that a person must review and save.

## Translations

Interface text lives in `public/js/i18n.js`. Run `npm run check-i18n` to confirm all three languages have the same keys. The Arabic and Hindi strings should be reviewed by a professional translator before production use, especially safety and legal wording.

## Files

```
server.js          HTTP server, auth, permissions, API
seed.js            Sample data and demo accounts
public/index.html  Page shell
public/css/        Design system (emerald, gold, ivory; light & dark; RTL via logical properties)
public/js/app.js        Login, layout, routing, help panel
public/js/views.js      All management screens
public/js/assistant.js  Ask Fareej assistant
public/js/core.js       Shared helpers (translation, API, dialogs, forms)
public/js/i18n.js       English, Arabic and Hindi dictionaries
```
