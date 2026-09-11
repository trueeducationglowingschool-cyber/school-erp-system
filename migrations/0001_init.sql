-- School ERP System - D1 Schema
-- Run: npx wrangler d1 migrations apply school-erp-db

-- ============================================================
-- Core Entities
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  head_teacher_id INTEGER,
  budget REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (head_teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  hire_date TEXT,
  department_id INTEGER,
  salary REAL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','on_leave')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  date_of_birth TEXT,
  gender TEXT CHECK(gender IN ('male','female','other')),
  address TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  enrollment_date TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','graduated','suspended','withdrawn')),
  class_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade_level TEXT,
  homeroom_teacher_id INTEGER,
  room TEXT,
  capacity INTEGER DEFAULT 30,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (homeroom_teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  credits INTEGER DEFAULT 1,
  teacher_id INTEGER,
  department_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS class_courses (
  class_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  PRIMARY KEY (class_id, course_id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','dropped','completed')),
  UNIQUE(student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============================================================
-- Academic: Attendance & Grades
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  assessment_name TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL DEFAULT 100,
  weight REAL DEFAULT 1,
  term TEXT DEFAULT 'Term 1',
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ============================================================
-- ERP: Fees, Invoices, Payments
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  fee_type TEXT NOT NULL CHECK(fee_type IN ('tuition','library','lab','transport','activity','other')),
  term TEXT,
  applies_to TEXT DEFAULT 'all',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  balance REAL NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue')),
  due_date TEXT,
  issued_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  fee_type TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'cash' CHECK(method IN ('cash','card','bank_transfer','online')),
  reference TEXT,
  paid_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ============================================================
-- ERP: Payroll
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  pay_period TEXT NOT NULL,
  base_salary REAL NOT NULL,
  bonuses REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  net_pay REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- ============================================================
-- ERP: Inventory
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT UNIQUE,
  quantity INTEGER DEFAULT 0,
  unit_price REAL DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  location TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('stock_in','stock_out','adjustment')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory_items(id)
);

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO departments (name, budget) VALUES
  ('Science', 50000),
  ('Mathematics', 40000),
  ('Humanities', 35000),
  ('Arts', 20000),
  ('Administration', 60000);

INSERT INTO classes (name, grade_level, room, capacity) VALUES
  ('Grade 9 - A', '9', '101', 30),
  ('Grade 10 - A', '10', '201', 30),
  ('Grade 11 - A', '11', '301', 28),
  ('Grade 12 - A', '12', '401', 25);
