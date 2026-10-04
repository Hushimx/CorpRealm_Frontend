# CORP Realm

A shared office in the browser, by CorpLift. Walk the floor, sit at a desk, work the task boards, talk to whoever is nearby, and play chess or XO at the tables.

## Run it

The app needs the backend running first. See `backend/ARCHITECTURE.md` for how the pieces fit.

```sh
# backend: Postgres and LiveKit, then the API and the live office
cd backend
cp .env.example .env
docker compose up -d
npm install
npm run db:push
npm run dev

# frontend, from the project root
npm install
npm run dev
```

The app opens on http://localhost:5173 and talks to the API on port 3000.

## Brand

The interface follows the CorpLift visual identity guide (2026).

- **Colours** live as tokens at the top of `src/index.css`: black, white and Lift blue `#2765ED`, with the blue and grey ramps from the guide. `danger` is the one colour outside the palette; it is only for error messages and destructive actions.
- **Typeface** is Thmanyah Sans for everything. The font files cannot be redistributed, so they are not in the repo. Follow `public/fonts/README.md` to add them; until then the system font shows.
- **Logo** files are in `public/branding/`. The logo is always one flat colour: black on white and light surfaces, white on black and blue.
- **Cards** have a 28px corner (`rounded-card`). Buttons and badges are capsules.

## Stack

React, Vite, Tailwind, Three.js (react-three-fiber) in the browser. NestJS, Colyseus, Prisma on Postgres, and LiveKit in `backend/`.
