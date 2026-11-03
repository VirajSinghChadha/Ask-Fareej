# Ask Fareej

*Smarter Communities. Better Living.*

| Folder | What it is | Who uses it | Status |
|---|---|---|---|
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
