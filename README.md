# Smart Balance Sheet Generator

A full-stack Financial Accounting semester project that uploads transaction records, classifies accounts, generates a balance sheet, validates the accounting equation, and exports reports.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL with Prisma ORM
- Hosted database: Neon PostgreSQL
- Frontend deployment: Vercel
- Backend deployment: Render

## Folder Structure

```text
smart-balance-sheet-generator/
  client/       React/Vite app
  server/       Express API, Prisma schema, parsing and report services
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

3. Add your Neon PostgreSQL connection string to `server/.env`.

   `MAX_UPLOAD_MB` controls the largest accepted upload. The default is `25`.
   `MAX_PARSE_ROWS` controls how many rows are processed from a file. The default is `100000`.

4. Generate Prisma client and create tables:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Run both apps in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:4000`.

## Supported Uploads

- CSV
- Excel `.xlsx`
- PDF parsing is experimental and depends on readable text tables

Recommended columns: `date`, `description`, `account`, `debit`, `credit`, and/or `amount`.

A small demo file is included at `samples/transactions.csv`.

## Deployment

### Backend on Render

1. Create a new Render Web Service from this repository.
2. Use `server` as the root directory.
3. Build command: `npm install && npx prisma generate && npx prisma db push`
4. Start command: `npm start`
5. Add environment variables from `server/.env.example`.
6. After the frontend is deployed, update `FRONTEND_URL` to the Vercel URL.

### Frontend on Vercel

1. Create a new Vercel project from this repository.
2. Use `client` as the root directory.
3. Add `VITE_API_URL` with the deployed Render backend URL.
4. Deploy.

## Production Environment Variables

Render backend:

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/smart_balance_sheet?sslmode=require
FRONTEND_URL=https://your-vercel-app.vercel.app
MAX_UPLOAD_MB=25
MAX_PARSE_ROWS=100000
JSON_BODY_LIMIT=75mb
```

Vercel frontend:

```env
VITE_API_URL=https://your-render-service.onrender.com
```

## Main API Routes

- `POST /api/uploads` uploads and parses CSV, Excel, or PDF files.
- `POST /api/balance-sheet` recalculates a balance sheet from transactions.
- `POST /api/reports/pdf` downloads a PDF report.
- `POST /api/reports/excel` downloads an Excel report.
