# AIDA ORGA Browser Extension

This extension adds a tile showing the earliest possible finishing time for the current day
based on data from the AIDA ORGA software.

Shows following data:

- Target: Login + Daily-Target-Time
- Earliest: Target - Time Credit with respect to flex time rules
- Difference and new Time Credit when finishing early today

## TODO

- [] format code
- [] fix option page css (probably use some framework like svelte)
- [] implement configuration for `location.hash`-check
- [] implement configuration for flex time per day
- [] break calculations based on time and law

## Commands

Built with [Extension.js](https://extension.js.org/).

### dev

Run the extension in development mode. Target a browser with `--browser`:

```bash
npm run dev
npm run dev -- --browser=firefox
npm run dev -- --browser=edge
```

### build

Build for production. Convenience scripts target each browser:

```bash
npm run build           # Chromium (default)
npm run build:firefox
npm run build:edge
```

### preview

Preview the production build in the browser:

```bash
npm run preview
```
