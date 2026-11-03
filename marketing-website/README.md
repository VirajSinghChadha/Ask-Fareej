# Ask Fareej — Marketing Website

**Version 1.0 · Public-facing marketing website / interactive product showcase**

Repository snapshot uploaded on 3 November 2026. See [VERSION.md](VERSION.md).

A responsive, presentation-led marketing website for Ask Fareej. This is not the resident app or management software.

## Run locally

Requires Node.js 20.19+ or 22.12+. Run these commands from the `marketing-website` directory.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Production build: `npm run build`. Serve the production build with `npm run preview`.

## Included

- Original UAE-inspired architecture image, exact emerald/gold/ivory palette, sticky navigation and page progress.
- Scroll-driven resident phone showcase with four chapters, plus manual chapter buttons. Mobile uses a step-by-step showcase.
- Six solution stories; original interactive fictional community master plan with six selectable locations.
- Five curated assistant questions with sample sources; proposed enterprise integration story.
- Management dashboard visual, eight keyboard-navigable gallery previews and explanatory Privacy/Terms dialogs.
- Validated enquiry draft form, local text-file download, no fake submission success.
- Reduced-motion support, keyboard controls, native modal focus handling and responsive layouts.

All product interfaces are original UI concepts. Community names, maintenance records, charts and budgets are sample data. No actual developer integrations, utility connections, pricing, partnerships or certifications are claimed.

## Before collecting real enquiries

Connect an approved backend or email service, add a verified contact channel and replace the preview Privacy/Terms notes with reviewed company policies. Do not label downloaded drafts as submitted enquiries.

## Implementation

React, TypeScript, Vite, Lucide React. Styling and motion use CSS, Intersection Observer and requestAnimationFrame without overlapping animation libraries. Design tokens are in `src/styles.css`; content and reusable UI components are in `src/App.tsx`.

## Artwork

`public/architecture.jpg` is original AI-generated fictional architecture made with the built-in imagegen tool, not a photograph of a real property. The prompt is preserved in `ARTWORK.md`. Product screens and the 2D master plan are rendered from code.

This project is stored in the shared Ask Fareej repository under `marketing-website/`, separately from the staff/admin management website. No production deployment is configured by this upload.

The official user-supplied logo is included unmodified as `public/ask-fareej-logo.png`. Header and footer display the complete original emblem and lettering together; CSS removes only the surrounding empty margin. Product concepts use the supplied emblem.
