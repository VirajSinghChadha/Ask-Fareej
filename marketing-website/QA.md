# Ask Fareej website verification

Verified 31 October 2026 in the Codex in-app browser against the local React/Vite website. Production TypeScript/Vite build passes.

| Area | Result |
| --- | --- |
| Navigation | All internal anchor targets exist; desktop section links and mobile menu navigation work. Header switches to the scrolled style and the progress indicator updates. |
| Product story | All four manual selections show the expected phone screen. Ordinary Page Down scrolling changes the active screen. Mobile step controls show the corresponding story text. |
| Product links | All four “Take a closer look” buttons open the matching gallery preview. |
| Community map | All six markers and all six pagination controls show the correct location and information. Keyboard Enter selects a marker. Explore Feature opens the digital-twin preview. |
| Assistant | All five example questions show the correct curated response and source. Contextual links point to existing sections. |
| Gallery | All eight previews open and close. Next/previous controls wrap at both ends. Arrow keys work. Escape closes the modal; keyboard focus stays within the modal and returns to its trigger on close. |
| Privacy / Terms | Both explanatory preview dialogs open and close. |
| Enquiry form | Required fields and invalid email are blocked. Whitespace-only input is blocked and correction recovers. Valid data prepares a draft. Editing clears the prepared state. |
| Actual download | A real enquiry text file was downloaded and its contents were read back: all six fields matched the synthetic test entries. No enquiry was sent. |
| Responsive layout | No page-level horizontal overflow at 320, 375, 768, 1024 and 1440 CSS-pixel widths. Main contact copy stays 18px and form inputs 17px. |
| Mobile navigation | Open/close, link selection, and Escape work; Escape returns focus to the toggle. |
| Branding and assets | The supplied official logo loads in the header, footer, and phone concepts. Original file is retained; Header and footer retain the complete original emblem and lettering, framed in CSS without redrawing it. Architectural asset is bundled locally. |
| Structure / runtime | Zero broken internal anchor targets or duplicate IDs. A clean final load reported no console errors or warnings. |

## Fixes made during testing

- Removed a race between manual chapter selection and scroll-driven screen updates.
- Assigned unique SVG IDs to every map instance.
- Fixed modal focus restoration under React Strict Mode and labelled dialogs.
- Added whitespace-aware form validation and a clear accessible name for the organisation selector.
- Added Escape handling to the mobile menu.
- Kept product-screen content inside its frame above the device navigation.
- Separated the app and entry module to prevent duplicate-root warnings during development hot reload.
- Reinforced reduced-motion rules so all mobile story descriptions remain visible when reduced motion is requested.

## Verification limits

Responsive widths were checked in one browser engine, not on physical iOS/Android devices or every browser. Reduced-motion handling was reviewed in source; the operating-system preference was not toggled during these tests. The standalone HTML is generated from the passing production bundle; direct file-protocol loading was not browser-tested. Email delivery, live AI, utility accounts, and real management operations are intentionally not connected in this marketing website.
