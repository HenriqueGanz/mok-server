/* -------------------------------------------------------------------------
FILE: README.md (run instructions)
------------------------------------------------------------------------- */
# MMORPG Server Skeleton (Colyseus + Express + Prisma)


## Quickstart (development)


1. Copy `.env.example` to `.env` and fill values (DATABASE_URL, JWT_SECRET). Use a local Postgres (or external) and Redis if needed.


2. Install dependencies:


```bash
npm install
```


3. Generate Prisma client and run migrations:


```bash
npm run prisma:generate
npm run prisma:migrate
```


4. Start server in dev:


```bash
npm run dev
```


Server will run on `http://localhost:2567` and Colyseus rooms are available via the same port.


## Notes
- This is a **minimal** skeleton to get you started. Security, validation, production settings, and scaling need improvements for competition-ready code.
- To enable Redis driver for Colyseus you can add the driver and configure it in server creation.