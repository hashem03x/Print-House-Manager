# The Best — Print House Manager

**The Best** is a bilingual (Arabic / English) web app for recording and managing printing jobs such as business cards, flyers, banners, carbonless forms and documents.

Branding (name, monogram, theme colour) is centralised in `frontend/src/config/brand.js`. The logo is `<BrandMark />` in `frontend/src/components/brand/BrandLogo.jsx`: a "TB" monogram on an ink plate framed by printer's crop marks. Its static copies are `frontend/public/favicon.svg` and `frontend/public/brand-mark.svg` (the loading screen). To rebrand, edit these files and the `<meta>`/`<title>` tags in `frontend/index.html`.

| Part | Stack |
|---|---|
| `frontend/` | React 19, Vite, React Router, Lucide icons, plain CSS (logical properties for RTL/LTR) |
| `backend/` | Node.js, Express 5, MongoDB, Mongoose, ES modules |

**Features**

- **Tasks:** create, view details, edit and delete tasks. Deleting asks for confirmation.
- **Quantity and pricing:** each task has a quantity and a unit price. **Total = quantity × unit price**, shown live in the form, in the table, in task details and on the dashboard.
- **Status:** mark a task Pending or Completed. Changing it updates the row in place, without reloading the list.
- **Custom paper sizes:** enter width × height in mm, cm, m or in. Values are stored exactly as entered.
- **Finding tasks:**
  - search by description
  - filter by status, paper type, paper size and paper weight
  - sort by creation date, task date or price
  - server-side pagination
- **Shareable state:** search, filters, sort and page are kept in the URL, so they survive a refresh and can be shared.
- **Dashboard:** total tasks, tasks created today (in the business time zone), pending/completed counts, total value and latest tasks. It is computed by MongoDB and refreshes after every change.
- **Language:** Arabic is the default and right-to-left; English is left-to-right. The choice is saved in `localStorage`.
- **Feedback:** loading skeletons, empty and no-results states, error states with retry, and toast notifications. Every action button is guarded against double submission.
- **Accessibility:**
  - dialogs trap focus, close on Escape and return focus when closed
  - controls are labelled
  - focus is always visible
  - errors are announced to screen readers

---

## Prerequisites

- **Node.js 20 or newer** (tested on Node 24) and npm 10 or newer
- **MongoDB**: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or a local MongoDB Community Server

## Quick start

```bash
# 1. Install everything (root + backend + frontend)
npm run install:all

# 2. Configure the backend
cp backend/.env.example backend/.env      # PowerShell: Copy-Item backend/.env.example backend/.env
#    then edit backend/.env and set MONGODB_URI (see "MongoDB Atlas setup")

# 3. Run API (http://localhost:5000) and web app (http://localhost:5173) together
npm run dev
```

You can also run each part separately:

```bash
npm run dev:backend      # = cd backend  && npm run dev   (restarts on change)
npm run dev:frontend     # = cd frontend && npm run dev
```

In development the frontend calls `/api` on its own origin, and Vite forwards those calls to the backend. No CORS or `frontend/.env` setup is needed locally.

> **Use `npm run dev` for the backend during development.** It restarts automatically when backend code changes. `npm start` does not: after pulling or editing backend code, a server started with `npm start` keeps running the old code until you restart it. New endpoints will then answer `404` with `"code": "ROUTE_NOT_FOUND"`, and the UI shows "The server doesn't support this action. Restart the API…".

### All scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run install:all` | Install root, backend and frontend dependencies |
| root | `npm run dev` | Start the API and the web app together |
| root | `npm run build` | Production build of the frontend (`frontend/dist`) |
| root | `npm start` | Start the API in production mode |
| root | `npm test` | Run the backend test suite |
| root | `npm run check` | Backend tests + frontend build |
| backend | `npm run dev` / `npm start` / `npm test` | Watch mode / start / tests |
| frontend | `npm run dev` / `npm run build` / `npm run preview` | Dev server / build / preview the build |

---

## Configuration

### `backend/.env`

| Variable | Example | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/printing-house?retryWrites=true&w=majority` | **Required.** Include a database name (`/printing-house`) |
| `PORT` | `5000` | API port. Most hosts set this automatically |
| `CLIENT_URL` | `http://localhost:5173` | Origins allowed by CORS. Separate several with commas |
| `APP_TIMEZONE` | `Africa/Cairo` | IANA time zone that defines "today" for dashboard statistics (default `UTC`) |
| `NODE_ENV` | `production` | `production` hides internal error details in API responses |
| `DB_CONNECT_TIMEOUT_MS` | `7000` | Optional. Maximum time for one connection attempt. Keep it below your host's function time limit |

`.env` files are git-ignored. Never put real credentials in `.env.example`. When the API logs a connection string, it replaces the credentials with `***`.

### `frontend/.env` (optional)

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://print-house-api.onrender.com/api` | Backend URL for **production builds**. Leave empty in development. `/api` is added if you leave it off |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:5000` | Development only: where Vite forwards `/api` |

Other presentation settings (currency, default language) are in `frontend/src/config/appConfig.js`.

---

## MongoDB Atlas setup

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access → Add New Database User.** Choose password authentication and give the user *Read and write to any database*. You can also restrict it to the `printing-house` database.
3. **Network Access → Add IP Address.** Add your current IP for local development. For a hosted backend, add the host's outbound IPs; if the host has no fixed IPs, `0.0.0.0/0` together with a strong password works.
4. **Connect → Drivers.** Copy the `mongodb+srv://…` string, put your password in it, and **add the database name** before the `?`:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/printing-house?retryWrites=true&w=majority
   ```
   Without a database name, Atlas uses a database called `test`.
5. Put the string in `backend/.env` as `MONGODB_URI`, then run `npm run dev:backend`. You should see `[db] Connected to MongoDB … (database: "printing-house")`.

To use a local MongoDB instead, set `MONGODB_URI=mongodb://127.0.0.1:27017/printing-house`.

No migrations are needed. Collections and indexes are created automatically. Tasks saved before the newer fields existed keep working:

- a task with no `status` is treated as `pending`
- a custom size with no unit is treated as `mm`

---

## Deployment

### How the backend connects to MongoDB

The API works both as a long-running server and as a serverless function:

- **Persistent server** (`npm start` / `npm run dev`: local, Render, Railway, VPS): `src/server.js` connects first, retrying up to 5 times with backoff, and only then starts listening. If every attempt fails, it exits so the process manager can restart it.
- **Serverless** (Vercel): the platform imports `src/app.js` directly and never runs `server.js`. The connection is opened on the first request by the `requireDb` middleware, then cached and reused:
  - Concurrent requests share one in-flight attempt; there is never one connection per request.
  - After a failure, requests fail fast for 5 seconds before the next attempt.
  - If an established connection drops, the driver reconnects by itself while requests briefly wait.

`GET /api/health` opens the connection if needed and reports the real state. If the database is down, `data.databaseReason` gives a sanitized cause and the server log gives the full, credential-free detail:

| `databaseReason` | What to check |
|---|---|
| `missing_configuration` | `MONGODB_URI` is not set in the host's environment variables. Add it, then **redeploy** |
| `invalid_uri` | The URI format is wrong. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`) |
| `authentication_failed` | Wrong username or password, or the user lacks access to the database |
| `dns_resolution_failed` | The cluster hostname in the URI is wrong |
| `network_access_denied` / `timeout` | Atlas **Network Access** does not allow the server's IP |
| `connection_refused` | Nothing is listening at that host/port (local MongoDB not running) |

### Backend on Vercel (current deployment)

- **Root directory:** `backend`. Framework preset: Express or Other; no build step is needed. Vercel serves the Express app exported by `src/app.js`.
- **Environment variables** (Project → Settings → Environment Variables, for *Production*). `backend/.env` is git-ignored and is **not** deployed.
  - `MONGODB_URI`: full Atlas URI including `/printing-house`
  - `CLIENT_URL`: the frontend origin, e.g. `https://print-house-manager-frontend.vercel.app`
  - `APP_TIMEZONE`, e.g. `Africa/Cairo`
  - `NODE_ENV=production`
- **After changing any variable, redeploy.** Running deployments keep the old values.
- **Atlas Network Access:** Vercel functions have no fixed outbound IPs, so either allow `0.0.0.0/0` with a strong, database-scoped user password, or use Vercel's MongoDB Atlas integration or static-IP add-on.
- Check `https://<backend>.vercel.app/api/health`. It should show `"database": "connected"` and `"runtime": "serverless"`.

### Backend (Render, Railway, Fly.io or any Node host)

- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:**
  - `MONGODB_URI`
  - `CLIENT_URL`: your deployed frontend URL, e.g. `https://print-house.netlify.app`, no trailing slash
  - `APP_TIMEZONE`
  - `NODE_ENV=production`
- **Health check path:** `/api/health`. It returns 200 when the database is connected and 503 (with `databaseReason`) otherwise.

### Frontend (Netlify, Vercel, Cloudflare Pages or any static host)

- **Base directory:** `frontend`
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Environment variable:** `VITE_API_URL=https://<your-backend-host>/api`. It is read at build time, so rebuild after changing it.
- **Client-side routing fallback:**
  - Netlify uses `frontend/public/_redirects`
  - Vercel uses `frontend/vercel.json`
  - on other hosts, rewrite all paths to `/index.html`

### Production checklist

- `CLIENT_URL` on the backend exactly matches the frontend origin (scheme + host, no path).
- `VITE_API_URL` on the frontend points to the backend (`/api` is appended if missing). It is read at build time, so rebuild after changing it.
- Atlas Network Access allows the backend host. `/api/health` shows `network_access_denied` or `timeout` if not.
- Environment variables are set on the hosting platform (not only in local `.env` files), and the app was redeployed after changing them.
- `NODE_ENV=production` is set on the backend.

---

## API reference

Base URL: `/api` (e.g. `http://localhost:5000/api`). All responses use one shape:

```jsonc
{ "success": true,  "data": { /* ... */ }, "message": "..." }                                  // success
{ "success": false, "message": "...", "code": "TASK_NOT_FOUND", "errors": { "field": "reason" } } // error
```

Every error has a machine-readable `code`, so clients can tell apart cases that share a status:

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid body or query parameters |
| `INVALID_ID` | 400 | Not a valid ObjectId |
| `INVALID_JSON` | 400 | Malformed JSON |
| `TASK_NOT_FOUND` | 404 | The task does not exist |
| `ROUTE_NOT_FOUND` | 404 | No such endpoint, e.g. a server running outdated code |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 100 KB |
| `INTERNAL_ERROR` | 500 | Unexpected error |
| `DB_UNAVAILABLE` | 503 | Database not connected |

| Method | Endpoint | Purpose | Success |
|---|---|---|---|
| GET | `/api/health` | API and database status | 200 (503 if the DB is down) |
| GET | `/api/tasks` | List tasks (search, filters, sort, pagination) | 200 |
| GET | `/api/tasks/stats` | Dashboard statistics | 200 |
| GET | `/api/tasks/:id` | Get one task | 200 |
| POST | `/api/tasks` | Create a task | 201 |
| PUT | `/api/tasks/:id` | Update a task (send only the fields to change) | 200 |
| PATCH | `/api/tasks/:id/status` | Set status: `{ "status": "completed" }` | 200 |
| DELETE | `/api/tasks/:id` | Delete a task | 200 |

Error codes:

- `400`: validation, malformed JSON, invalid ObjectId or invalid query parameter
- `404`: not found
- `413`: body over 100 KB
- `500`: unexpected error
- `503`: database unavailable

### Task fields

| Field | Type | Rules |
|---|---|---|
| `description` | string | Required, trimmed, at most 500 characters. Stored as typed and never translated |
| `taskDate` | `"YYYY-MM-DD"` | Required. The job's calendar date, stored as UTC midnight so it never shifts between time zones. It is separate from `createdAt` |
| `paperType` | string | Required: `bristol`, `glossy_heavy`, `glossy_light`, `glossy_two_side`, `matte_sticker`, `glossy_sticker`, `carbon_original_copy` (carbonless original + 1 copy) or `carbon_original_two_copies` (original + 2 copies) |
| `paperSize` | string | Required: `A6`, `A4`, `A5`, `size_9`, `size_18`, `size_16` or `custom` |
| `paperWeight` | number | **Required for new tasks**: `70`, `80`, `100` or `120` (gsm). Independent of paper type. Must be a JSON number. Older tasks without a weight stay valid |
| `customPaperSize` | `{ width, height, unit }` | **Required when `paperSize` is `custom`**, otherwise must be absent (or `null` to clear). `width`/`height` are positive numbers; `unit` is `mm`, `cm`, `m` or `in`. Values are stored as entered (up to 3 decimals) and never converted. Each dimension can be at most 10 m in any unit |
| `price` | number | Required **unit price**, 0 to 1,000,000,000. Rounded to 2 decimals. Must be a JSON number. Never replaced by the total |
| `quantity` | integer | **Required for new tasks**: whole number from 1 to 1,000,000. Older tasks without a quantity read as `1`, so their stored price stays their total |
| `total` | number | **Read-only, computed by the server**: quantity × price, rounded to 2 decimals. Ignored if sent |
| `status` | string | `pending` (default) or `completed`. Set only by users, never inferred from dates |
| `createdAt` / `updatedAt` | ISO date | Set by the server. Client values are ignored and `createdAt` never changes |

Unknown fields (including `_id`, `createdAt`, `updatedAt`) are ignored. Paper and status values are stable, language-independent keys; the frontend translates them for display.

**Retired paper options.** The earlier paper types (`glossy`, `matte`, `offset`, `art_paper`, `bond_paper`, `other`) and sizes (`A2`, `A3`) have no unambiguous equivalent in the current lists, so existing tasks were **not** remapped.

- These values stay stored unchanged and display with their old labels.
- They remain filterable through the API.
- Editing such a task may keep its existing value, which the edit form shows as "(no longer offered)".
- New tasks cannot choose them, and an edit cannot switch to another retired value. Either returns `400` "no longer available".

**Paper size rules on update (`PUT`):**

- Switching to a predefined size clears any stored dimensions.
- Switching to `custom` requires `customPaperSize`.
- Editing other fields of a custom-size task keeps its dimensions.

### `GET /api/tasks` query parameters

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | positive integer |
| `limit` | `10` | positive integer, max 100 |
| `search` | | case-insensitive match on `description` (any language) |
| `status` | | `pending` (includes legacy tasks without a status) or `completed` |
| `paperType` | | one of the paper type values |
| `paperSize` | | one of the paper size values |
| `paperWeight` | | `70`, `80`, `100` or `120` |
| `sortBy` | `createdAt` | allowlist: `taskDate`, `createdAt`, `updatedAt`, `price` (unit price), `total` (quantity × price), `quantity`, `description` |
| `order` | `desc` | `asc` or `desc` |

Example: `GET /api/tasks?status=pending&search=cards&paperType=bristol&paperWeight=120&sortBy=taskDate&order=asc&page=1&limit=10`

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "6708f1a2c3b4d5e6f7a8b901",
        "id": "6708f1a2c3b4d5e6f7a8b901",
        "description": "Wedding cards, 200 copies",
        "taskDate": "2026-10-20T00:00:00.000Z",
        "paperType": "bristol",
        "paperSize": "custom",
        "customPaperSize": { "width": 32, "height": 45, "unit": "cm" },
        "paperWeight": 120,
        "quantity": 200,
        "price": 2.25,
        "total": 450,
        "status": "pending",
        "createdAt": "2026-10-11T09:24:00.000Z",
        "updatedAt": "2026-10-11T09:24:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
  },
  "message": "Tasks retrieved successfully"
}
```

### `POST /api/tasks`

```json
{
  "description": "Restaurant menu flyers, 1,000 copies",
  "taskDate": "2026-10-20",
  "paperType": "glossy_heavy",
  "paperSize": "A4",
  "paperWeight": 100,
  "quantity": 1000,
  "price": 1.85
}
```

With a custom size:

```json
{
  "description": "Exhibition banner",
  "taskDate": "2026-10-22",
  "paperType": "glossy_sticker",
  "paperSize": "custom",
  "customPaperSize": { "width": 3, "height": 1, "unit": "m" },
  "paperWeight": 80,
  "quantity": 1,
  "price": 1200
}
```

This returns `201` with the created task, which includes `status: "pending"`. A validation error returns `400`:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "customPaperSize.unit": "Unit must be one of: mm, cm, m, in",
    "price": "Price cannot be negative"
  }
}
```

### `PATCH /api/tasks/:id/status`

```json
{ "status": "completed" }
```

This returns `200` with the full updated task.

### `GET /api/tasks/stats`

```json
{
  "success": true,
  "data": {
    "totalTasks": 42,
    "tasksToday": 3,
    "pendingTasks": 30,
    "completedTasks": 12,
    "totalValue": 18645.5,      // sum of task totals (quantity × unit price)
    "latestTasks": [ /* 5 newest tasks by createdAt */ ],
    "timeZone": "Africa/Cairo",
    "todayStart": "2026-10-10T21:00:00.000Z"
  },
  "message": "Task statistics retrieved successfully"
}
```

"Today" means from midnight in `APP_TIMEZONE`. The calculation handles daylight-saving changes correctly.

---

## Project structure

```text
├── package.json             root scripts (install:all, dev, build, test)
├── backend/
│   ├── src/
│   │   ├── config/          env.js (dotenv + validation), db.js (connect, credential redaction)
│   │   ├── constants/       paperOptions.js (paper types/sizes, units, statuses)
│   │   ├── models/          Task.js
│   │   ├── controllers/     taskController.js (list, stats, CRUD, status)
│   │   ├── routes/          taskRoutes.js, healthRoutes.js
│   │   ├── middleware/      validateTask, validateObjectId, requireDb, notFound, errorHandler
│   │   ├── utils/           ApiError, apiResponse, dates (calendar dates, business time zone)
│   │   ├── app.js           Express app (CORS, JSON, routes, errors)
│   │   └── server.js        DB connection, listen, graceful shutdown
│   └── tests/               node:test suites (in-memory MongoDB by default)
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/      AppLayout, Header, Sidebar, LanguageSwitcher
        │   ├── dashboard/   StatCard, LatestTasksCard
        │   ├── tasks/       TaskTable, TaskFilters, TaskFormModal, TaskDetailsModal,
        │   │                DeleteTaskDialog, useTaskDialogs, useTaskStatusToggle
        │   └── common/      Button, IconButton, Modal, FormField, Select, SearchInput,
        │                    Pagination, EmptyState, ErrorState, Spinner, PaperBadges, Toast/
        ├── pages/           DashboardPage, TasksPage
        ├── services/        apiClient.js (fetch, timeouts, errors), taskApi.js
        ├── hooks/           useApiResource, useDebouncedValue
        ├── i18n/            I18nProvider, useI18n, languages.js, locales/ar.js, locales/en.js
        ├── utils/           format, taskValidation, taskQuery, apiErrors
        ├── constants/       paperOptions.js (mirrors the backend values)
        ├── config/          appConfig.js
        └── styles/          tokens, base, layout, components, feedback, pages
```

## Localization

- Translations live in `frontend/src/i18n/locales/ar.js` and `en.js`, which use the same semantic keys.
  - Call `const { t } = useI18n(); t('tasks.title')`.
  - Interpolation: `t('pagination.page', { page: 2 })`. Numeric parameters are formatted for the locale.
  - Plurals use Intl plural categories (Arabic has zero/one/two/few/many/other), e.g. `t('tasks.resultsCount', { count })`.
- `<html lang>` and `<html dir>` are kept in sync, and an inline script in `index.html` applies the saved direction before React loads.
- The CSS uses only logical properties, and directional icons are mirrored in RTL.
- Fonts: IBM Plex Sans Arabic and IBM Plex Sans.
- Dates and currency use `Intl` with Latin digits. Number inputs also accept Arabic-Indic digits (`٣٢٠`) and the Arabic decimal separator (`٫`).
- To add a paper type, size, weight, status or unit:
  1. Add its value to `backend/src/constants/paperOptions.js` and `frontend/src/constants/paperOptions.js`.
  2. Add its label to both dictionaries.

## Testing

```bash
npm test                                   # backend: 153 tests (CRUD, validation, filters, stats, status, quantity & totals, paper types/sizes/weights, legacy values, custom sizes/units, connection lifecycle, DB outage)
TEST_MONGODB_URI="mongodb+srv://…/printing-house-test?…" npm test --prefix backend   # run against a real cluster
```

- By default, tests start a throwaway in-memory MongoDB. The first run downloads a MongoDB binary, which is cached afterwards.
- Set `TEST_MONGODB_URI` to run against Atlas. Use a **separate test database**, because the tests empty it.

## Known limitations

- There is no authentication or authorization. Anyone who can reach the API can change data, so add authentication before exposing it publicly.
- Search uses a case-insensitive regular expression. For very large collections, consider a MongoDB text index or Atlas Search.
- Updates do not detect conflicts: if two people edit the same task at the same time, the last save wins.

# Print-House-Manager
