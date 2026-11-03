# Ask Fareej

*Smarter Communities. Better Living.*

| Folder | What it is | Who uses it | Status |
|---|---|---|---|
| [`marketing-website/`](marketing-website/) | **Marketing website** – public-facing site and interactive product showcase | Property developers, community-management companies, enterprise partners and interested visitors | Version 1.0 · Concept previews |
| [`management-website/`](management-website/) | **Management website** – the staff / admin interface | Property developers, community managers, maintenance coordinators | Working prototype |

## Management website

The interface that management staff use to run UAE residential communities:

- Dashboard with today's priorities
- Maintenance scheduling with a step-by-step guided form
- Resident reports, including recurring-issue detection
- Community map
- Construction updates
- Announcements with an approval workflow
- Permissions
- Community finances
- Reports and insights
- Settings
- An Ask Fareej guided assistant

It works in **English, العربية (right-to-left) and हिन्दी**, and is built to be accessible (WCAG 2.2 AA principles).

### Run it

Requires Node.js 20 or newer. There are no packages to install.

```bash
cd management-website
node server.js
```

Then open http://localhost:4173 and choose one of the demonstration accounts shown on the login page.

The demonstration accounts are sample logins for a local demo only. They are not production credentials. See [`management-website/README.md`](management-website/README.md) for details, the security model and the roles.

> Note: `server.js` also contains early, unfinished groundwork for a future resident app (resident accounts and a resident-only API). That app is not built yet; the management website does not depend on it.

## Marketing website — version 1.0

The public-facing Ask Fareej marketing website: product storytelling, six solution areas, an interactive fictional community map, curated assistant examples, a product gallery and partnership enquiries. It includes the official supplied logo and responsive layouts with larger typography.

The phone screens and dashboard shown here are **illustrative UI concept previews**. This folder is not the resident app or the staff/admin management interface. The enquiry form validates entries and downloads a local draft; no email delivery, live AI or utility integration is connected.

### Run the marketing website

Requires Node.js 20.19+ or 22.12+.

```bash
cd marketing-website
npm ci
npm run dev
```

Build with `npm run build`. See the [marketing website README](marketing-website/README.md), [version label](marketing-website/VERSION.md) and [test report](marketing-website/QA.md).
