# School ERP System

A fullstack School Management & ERP System built on **Cloudflare Workers** with a **D1** database.

## Features

| Module | Capabilities |
|--------|-------------|
| **Dashboard** | Live stats: student/teacher counts, outstanding fees, low-stock alerts |
| **Students** | Full CRUD, guardian info, class assignment, status tracking |
| **Teachers** | Full CRUD, department assignment, salary, employment status |
| **Courses** | Course catalog, teacher assignment, credits, departments |
| **Classes** | Class management, homeroom teacher, capacity, student count |
| **Departments** | Department management with budgets |
| **Attendance** | Record & track attendance (present/absent/late/excused) |
| **Grades** | Record assessment scores with weights and terms |
| **Enrollments** | Enroll students in courses, track enrollment status |
| **Fees & Invoices** | Create invoices with line items, track balances |
| **Payments** | Record payments, auto-update invoice status (paid/partial) |
| **Payroll** | Calculate net pay (base + bonuses − deductions), mark as paid |
| **Inventory** | Stock management with stock-in/out/adjustment transactions, reorder alerts |

## Tech Stack

- **Runtime**: Cloudflare Workers (edge compute)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Frontend**: Vanilla JS SPA (no build step needed)
- **API**: RESTful JSON API (`/api/*`)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create the D1 database
```bash
npx wrangler d1 create school-erp-db
```
Copy the returned `database_id` into `wrangler.jsonc` (replace `PLACEHOLDER_RUN_WRANGLER_D1_CREATE`).

### 3. Run migrations
```bash
npx wrangler d1 migrations apply school-erp-db
```

### 4. Run locally
```bash
npm run dev
```
Open `http://localhost:8787` — the app loads the dashboard automatically.

### 5. Deploy to production
```bash
npm run deploy
```

## API Reference

All endpoints are under `/api/`. Supports `GET`, `POST`, `PUT`, `DELETE`.

| Resource | Endpoints |
|----------|----------|
| `/api/dashboard` | `GET` — aggregate stats |
| `/api/students` | `GET` list, `POST` create, `GET/:id`, `PUT/:id`, `DELETE/:id` |
| `/api/teachers` | `GET` list, `POST` create, `GET/:id`, `PUT/:id`, `DELETE/:id` |
| `/api/courses` | `GET` list, `POST` create, `GET/:id`, `PUT/:id`, `DELETE/:id` |
| `/api/classes` | `GET` list, `GET/:id` (with students), `POST`, `PUT/:id`, `DELETE/:id` |
| `/api/departments` | `GET` list, `POST` create |
| `/api/attendance` | `GET` list (filter by `student_id`, `course_id`, `date`), `POST`, `PUT/:id`, `DELETE/:id` |
| `/api/grades` | `GET` list (filter by `student_id`, `course_id`), `POST`, `PUT/:id`, `DELETE/:id` |
| `/api/enrollments` | `GET` list (filter by `student_id`, `course_id`), `POST`, `DELETE/:id` |
| `/api/invoices` | `GET` list, `GET/:id` (with items & payments), `POST` (with items array), `DELETE/:id` |
| `/api/payments` | `GET` list, `POST` (auto-updates invoice balance/status) |
| `/api/fees` | `GET` list, `POST` create, `DELETE/:id` |
| `/api/payroll` | `GET` list, `POST` create, `PUT/:id/pay` (mark as paid) |
| `/api/inventory` | `GET` list, `GET/:id` (with transactions), `POST`, `PUT/:id`, `DELETE/:id`, `POST/:id/transaction` |

## Project Structure

```
school-erp-system/
├── src/
│   └── index.ts          # Worker: REST API + static asset serving
├── public/
│   ├── index.html         # SPA shell
│   ├── app.js            # Frontend SPA (router + CRUD UI)
│   └── styles.css        # Dashboard styling
├── migrations/
│   └── 0001_init.sql     # D1 schema with seed data
├── wrangler.jsonc        # Cloudflare Workers config (D1 binding)
└── package.json
```
