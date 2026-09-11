/**
 * School ERP System — Cloudflare Worker + D1
 * Full REST API for school management & ERP modules.
 */

export interface Env {
  DB: D1Database;
  APP_NAME: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

const error = (message: string, status = 400) => json({ error: message }, status);

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const segments = path.split("/").filter(Boolean);
  const resource = segments[0];
  const id = segments[1] ? Number(segments[1]) : null;
  const sub = segments[2] || null;
  const method = request.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  let body: any = {};
  if (method === "POST" || method === "PUT") {
    try { body = await request.json(); } catch { /* empty body ok */ }
  }

  // ─── Dashboard / Stats ──────────────────────────────────────
  if (resource === "dashboard" && method === "GET") {
    const counts = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) as c FROM students"),
      env.DB.prepare("SELECT COUNT(*) as c FROM teachers"),
      env.DB.prepare("SELECT COUNT(*) as c FROM courses"),
      env.DB.prepare("SELECT COUNT(*) as c FROM classes"),
      env.DB.prepare("SELECT COUNT(*) as c FROM invoices WHERE status != 'paid'"),
      env.DB.prepare("SELECT COALESCE(SUM(balance),0) as total FROM invoices WHERE status != 'paid'"),
      env.DB.prepare("SELECT COUNT(*) as c FROM inventory_items WHERE quantity <= reorder_level"),
    ]);
    return json({
      students: counts[0].results[0].c,
      teachers: counts[1].results[0].c,
      courses: counts[2].results[0].c,
      classes: counts[3].results[0].c,
      unpaidInvoices: counts[4].results[0].c,
      outstandingFees: counts[5].results[0].total,
      lowStockItems: counts[6].results[0].c,
    });
  }

  // ─── Students ──────────────────────────────────────────────
  if (resource === "students") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare("SELECT * FROM students ORDER BY created_at DESC").all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const r = await env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(id);
      const row = await r.first();
      if (!row) return error("Student not found", 404);
      return json(row);
    }
    if (method === "POST") {
      const { first_name, last_name, email, phone, date_of_birth, gender, address, guardian_name, guardian_phone, class_id } = body;
      if (!first_name || !last_name || !email) return error("first_name, last_name, email required");
      try {
        const r = await env.DB.prepare(
          "INSERT INTO students (first_name,last_name,email,phone,date_of_birth,gender,address,guardian_name,guardian_phone,class_id) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(first_name, last_name, email, phone || null, date_of_birth || null, gender || null, address || null, guardian_name || null, guardian_phone || null, class_id || null);
        await r.run();
        return json({ id: r.lastInsertRowid, ...body }, 201);
      } catch (e: any) {
        return error(e.message || "Failed to create student");
      }
    }
    if (method === "PUT" && id) {
      const { first_name, last_name, email, phone, date_of_birth, gender, address, guardian_name, guardian_phone, class_id, status } = body;
      try {
        await env.DB.prepare(
          "UPDATE students SET first_name=?,last_name=?,email=?,phone=?,date_of_birth=?,gender=?,address=?,guardian_name=?,guardian_phone=?,class_id=?,status=? WHERE id=?"
        ).bind(first_name, last_name, email, phone, date_of_birth, gender, address, guardian_name, guardian_phone, class_id, status || "active", id).run();
        return json({ id, ...body });
      } catch (e: any) { return error(e.message); }
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM students WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Teachers ──────────────────────────────────────────────
  if (resource === "teachers") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id ORDER BY t.created_at DESC"
      ).all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const row = await env.DB.prepare("SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?").bind(id).first();
      if (!row) return error("Teacher not found", 404);
      return json(row);
    }
    if (method === "POST") {
      const { first_name, last_name, email, phone, hire_date, department_id, salary } = body;
      if (!first_name || !last_name || !email) return error("first_name, last_name, email required");
      try {
        const r = await env.DB.prepare(
          "INSERT INTO teachers (first_name,last_name,email,phone,hire_date,department_id,salary) VALUES (?,?,?,?,?,?,?)"
        ).bind(first_name, last_name, email, phone || null, hire_date || null, department_id || null, salary || 0);
        await r.run();
        return json({ id: r.lastInsertRowid, ...body }, 201);
      } catch (e: any) { return error(e.message); }
    }
    if (method === "PUT" && id) {
      const { first_name, last_name, email, phone, hire_date, department_id, salary, status } = body;
      await env.DB.prepare(
        "UPDATE teachers SET first_name=?,last_name=?,email=?,phone=?,hire_date=?,department_id=?,salary=?,status=? WHERE id=?"
      ).bind(first_name, last_name, email, phone, hire_date, department_id, salary, status || "active", id).run();
      return json({ id, ...body });
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM teachers WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Courses ───────────────────────────────────────────────
  if (resource === "courses") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT c.*, t.first_name || ' ' || t.last_name as teacher_name, d.name as department_name FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id LEFT JOIN departments d ON c.department_id = d.id ORDER BY c.created_at DESC"
      ).all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const row = await env.DB.prepare("SELECT * FROM courses WHERE id = ?").bind(id).first();
      if (!row) return error("Course not found", 404);
      return json(row);
    }
    if (method === "POST") {
      const { name, code, description, credits, teacher_id, department_id } = body;
      if (!name || !code) return error("name, code required");
      try {
        const r = await env.DB.prepare(
          "INSERT INTO courses (name,code,description,credits,teacher_id,department_id) VALUES (?,?,?,?,?,?)"
        ).bind(name, code, description || null, credits || 1, teacher_id || null, department_id || null);
        await r.run();
        return json({ id: r.lastInsertRowid, ...body }, 201);
      } catch (e: any) { return error(e.message); }
    }
    if (method === "PUT" && id) {
      const { name, code, description, credits, teacher_id, department_id } = body;
      await env.DB.prepare("UPDATE courses SET name=?,code=?,description=?,credits=?,teacher_id=?,department_id=? WHERE id=?")
        .bind(name, code, description, credits, teacher_id, department_id, id).run();
      return json({ id, ...body });
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM courses WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Classes ──────────────────────────────────────────────
  if (resource === "classes") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT c.*, t.first_name || ' ' || t.last_name as homeroom_teacher, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count FROM classes c LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id ORDER BY c.name"
      ).all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const cls = await env.DB.prepare("SELECT * FROM classes WHERE id = ?").bind(id).first();
      if (!cls) return error("Class not found", 404);
      const students = await env.DB.prepare("SELECT * FROM students WHERE class_id = ?").bind(id).all();
      return json({ ...cls, students: students.results });
    }
    if (method === "POST") {
      const { name, grade_level, homeroom_teacher_id, room, capacity } = body;
      if (!name) return error("name required");
      const r = await env.DB.prepare("INSERT INTO classes (name,grade_level,homeroom_teacher_id,room,capacity) VALUES (?,?,?,?,?)")
        .bind(name, grade_level || null, homeroom_teacher_id || null, room || null, capacity || 30);
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
    if (method === "PUT" && id) {
      const { name, grade_level, homeroom_teacher_id, room, capacity } = body;
      await env.DB.prepare("UPDATE classes SET name=?,grade_level=?,homeroom_teacher_id=?,room=?,capacity=? WHERE id=?")
        .bind(name, grade_level, homeroom_teacher_id, room, capacity, id).run();
      return json({ id, ...body });
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM classes WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Departments ──────────────────────────────────────────
  if (resource === "departments") {
    if (method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM departments ORDER BY name").all();
      return json(r.results);
    }
    if (method === "POST") {
      const { name, budget } = body;
      if (!name) return error("name required");
      const r = await env.DB.prepare("INSERT INTO departments (name,budget) VALUES (?,?)").bind(name, budget || 0);
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
  }

  // ─── Attendance ──────────────────────────────────────────
  if (resource === "attendance") {
    if (method === "GET" && !id) {
      const { student_id, course_id, date } = Object.fromEntries(url.searchParams);
      let q = "SELECT a.*, s.first_name || ' ' || s.last_name as student_name, c.name as course_name FROM attendance a JOIN students s ON a.student_id = s.id JOIN courses c ON a.course_id = c.id WHERE 1=1";
      const params: any[] = [];
      if (student_id) { q += " AND a.student_id = ?"; params.push(student_id); }
      if (course_id) { q += " AND a.course_id = ?"; params.push(course_id); }
      if (date) { q += " AND a.date = ?"; params.push(date); }
      q += " ORDER BY a.date DESC";
      const r = await env.DB.prepare(q).bind(...params).all();
      return json(r.results);
    }
    if (method === "POST") {
      const { student_id, course_id, date, status, notes } = body;
      if (!student_id || !course_id || !date || !status) return error("student_id, course_id, date, status required");
      const r = await env.DB.prepare("INSERT INTO attendance (student_id,course_id,date,status,notes) VALUES (?,?,?,?,?)")
        .bind(student_id, course_id, date, status, notes || null);
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
    if (method === "PUT" && id) {
      const { status, notes } = body;
      await env.DB.prepare("UPDATE attendance SET status=?, notes=? WHERE id=?").bind(status, notes, id).run();
      return json({ id, ...body });
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM attendance WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Grades ───────────────────────────────────────────────
  if (resource === "grades") {
    if (method === "GET" && !id) {
      const { student_id, course_id } = Object.fromEntries(url.searchParams);
      let q = "SELECT g.*, s.first_name || ' ' || s.last_name as student_name, c.name as course_name FROM grades g JOIN students s ON g.student_id = s.id JOIN courses c ON g.course_id = c.id WHERE 1=1";
      const params: any[] = [];
      if (student_id) { q += " AND g.student_id = ?"; params.push(student_id); }
      if (course_id) { q += " AND g.course_id = ?"; params.push(course_id); }
      q += " ORDER BY g.recorded_at DESC";
      const r = await env.DB.prepare(q).bind(...params).all();
      return json(r.results);
    }
    if (method === "POST") {
      const { student_id, course_id, assessment_name, score, max_score, weight, term } = body;
      if (!student_id || !course_id || !assessment_name || score === undefined) return error("student_id, course_id, assessment_name, score required");
      const r = await env.DB.prepare("INSERT INTO grades (student_id,course_id,assessment_name,score,max_score,weight,term) VALUES (?,?,?,?,?,?,?)")
        .bind(student_id, course_id, assessment_name, score, max_score || 100, weight || 1, term || "Term 1");
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
    if (method === "PUT" && id) {
      const { assessment_name, score, max_score, weight, term } = body;
      await env.DB.prepare("UPDATE grades SET assessment_name=?,score=?,max_score=?,weight=?,term=? WHERE id=?")
        .bind(assessment_name, score, max_score, weight, term, id).run();
      return json({ id, ...body });
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM grades WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Invoices ─────────────────────────────────────────────
  if (resource === "invoices") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT i.*, s.first_name || ' ' || s.last_name as student_name FROM invoices i JOIN students s ON i.student_id = s.id ORDER BY i.issued_at DESC"
      ).all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const inv = await env.DB.prepare("SELECT i.*, s.first_name || ' ' || s.last_name as student_name FROM invoices i JOIN students s ON i.student_id = s.id WHERE i.id = ?").bind(id).first();
      if (!inv) return error("Invoice not found", 404);
      const items = await env.DB.prepare("SELECT * FROM invoice_items WHERE invoice_id = ?").bind(id).all();
      const payments = await env.DB.prepare("SELECT * FROM payments WHERE invoice_id = ?").bind(id).all();
      return json({ ...inv, items: items.results, payments: payments.results });
    }
    if (method === "POST") {
      const { student_id, items, due_date } = body;
      if (!student_id || !items || !items.length) return error("student_id and items[] required");
      const total = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
      const invNum = `INV-${Date.now()}`;
      const inv = await env.DB.prepare("INSERT INTO invoices (student_id,invoice_number,total_amount,balance,due_date,status) VALUES (?,?,?,?,?,?)")
        .bind(student_id, invNum, total, total, due_date || null, "unpaid");
      await inv.run();
      const invId = inv.lastInsertRowid;
      for (const item of items) {
        await env.DB.prepare("INSERT INTO invoice_items (invoice_id,description,amount,fee_type) VALUES (?,?,?,?)")
          .bind(invId, item.description, item.amount, item.fee_type || null).run();
      }
      return json({ id: invId, invoice_number: invNum, total_amount: total, balance: total, student_id, items }, 201);
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM invoices WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Payments ─────────────────────────────────────────────
  if (resource === "payments") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT p.*, s.first_name || ' ' || s.last_name as student_name, i.invoice_number FROM payments p JOIN students s ON p.student_id = s.id JOIN invoices i ON p.invoice_id = i.id ORDER BY p.paid_at DESC"
      ).all();
      return json(r.results);
    }
    if (method === "POST") {
      const { invoice_id, student_id, amount, method: payMethod, reference } = body;
      if (!invoice_id || !student_id || !amount) return error("invoice_id, student_id, amount required");
      const inv = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(invoice_id).first() as any;
      if (!inv) return error("Invoice not found", 404);
      const newPaid = Number(inv.paid_amount) + Number(amount);
      const newBalance = Number(inv.total_amount) - newPaid;
      const newStatus = newBalance <= 0 ? "paid" : "partial";
      await env.DB.prepare("UPDATE invoices SET paid_amount=?, balance=?, status=? WHERE id=?")
        .bind(newPaid, newBalance, newStatus, invoice_id).run();
      const r = await env.DB.prepare("INSERT INTO payments (invoice_id,student_id,amount,method,reference) VALUES (?,?,?,?,?)")
        .bind(invoice_id, student_id, amount, payMethod || "cash", reference || null);
      await r.run();
      return json({ id: r.lastInsertRowid, invoice_id, student_id, amount, method: payMethod, reference, invoice_status: newStatus }, 201);
    }
  }

  // ─── Fee Structures ──────────────────────────────────────
  if (resource === "fees") {
    if (method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM fee_structures ORDER BY created_at DESC").all();
      return json(r.results);
    }
    if (method === "POST") {
      const { name, amount, fee_type, term, applies_to } = body;
      if (!name || !amount) return error("name, amount required");
      const r = await env.DB.prepare("INSERT INTO fee_structures (name,amount,fee_type,term,applies_to) VALUES (?,?,?,?,?)")
        .bind(name, amount, fee_type || "tuition", term || null, applies_to || "all");
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM fee_structures WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Payroll ─────────────────────────────────────────────
  if (resource === "payroll") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare(
        "SELECT p.*, t.first_name || ' ' || t.last_name as teacher_name FROM payroll_records p JOIN teachers t ON p.teacher_id = t.id ORDER BY p.created_at DESC"
      ).all();
      return json(r.results);
    }
    if (method === "POST") {
      const { teacher_id, pay_period, base_salary, bonuses, deductions } = body;
      if (!teacher_id || !pay_period || base_salary === undefined) return error("teacher_id, pay_period, base_salary required");
      const net = Number(base_salary) + Number(bonuses || 0) - Number(deductions || 0);
      const r = await env.DB.prepare("INSERT INTO payroll_records (teacher_id,pay_period,base_salary,bonuses,deductions,net_pay,status) VALUES (?,?,?,?,?,?,?)")
        .bind(teacher_id, pay_period, base_salary, bonuses || 0, deductions || 0, net, "pending");
      await r.run();
      return json({ id: r.lastInsertRowid, net_pay: net, ...body }, 201);
    }
    if (method === "PUT" && id && sub === "pay") {
      await env.DB.prepare("UPDATE payroll_records SET status='paid', paid_at=datetime('now') WHERE id=?").bind(id).run();
      return json({ id, status: "paid" });
    }
  }

  // ─── Inventory ────────────────────────────────────────────
  if (resource === "inventory") {
    if (method === "GET" && !id) {
      const r = await env.DB.prepare("SELECT * FROM inventory_items ORDER BY name").all();
      return json(r.results);
    }
    if (method === "GET" && id) {
      const row = await env.DB.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first();
      if (!row) return error("Item not found", 404);
      const txns = await env.DB.prepare("SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC").bind(id).all();
      return json({ ...row, transactions: txns.results });
    }
    if (method === "POST") {
      const { name, category, sku, quantity, unit_price, reorder_level, location } = body;
      if (!name) return error("name required");
      const r = await env.DB.prepare("INSERT INTO inventory_items (name,category,sku,quantity,unit_price,reorder_level,location) VALUES (?,?,?,?,?,?,?)")
        .bind(name, category || null, sku || null, quantity || 0, unit_price || 0, reorder_level || 10, location || null);
      await r.run();
      return json({ id: r.lastInsertRowid, ...body }, 201);
    }
    if (method === "PUT" && id) {
      const { name, category, sku, quantity, unit_price, reorder_level, location } = body;
      await env.DB.prepare("UPDATE inventory_items SET name=?,category=?,sku=?,quantity=?,unit_price=?,reorder_level=?,location=? WHERE id=?")
        .bind(name, category, sku, quantity, unit_price, reorder_level, location, id).run();
      return json({ id, ...body });
    }
    if (method === "POST" && id && sub === "transaction") {
      const { transaction_type, quantity, reason } = body;
      if (!transaction_type || !quantity) return error("transaction_type, quantity required");
      const item = await env.DB.prepare("SELECT quantity FROM inventory_items WHERE id = ?").bind(id).first() as any;
      if (!item) return error("Item not found", 404);
      let newQty = Number(item.quantity);
      if (transaction_type === "stock_in") newQty += Number(quantity);
      else if (transaction_type === "stock_out") newQty -= Number(quantity);
      else newQty = Number(quantity);
      await env.DB.prepare("UPDATE inventory_items SET quantity=? WHERE id=?").bind(newQty, id).run();
      const r = await env.DB.prepare("INSERT INTO inventory_transactions (item_id,transaction_type,quantity,reason) VALUES (?,?,?,?)")
        .bind(id, transaction_type, quantity, reason || null);
      await r.run();
      return json({ id: r.lastInsertRowid, item_id: id, new_quantity: newQty, ...body }, 201);
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM inventory_items WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  // ─── Enrollments ─────────────────────────────────────────
  if (resource === "enrollments") {
    if (method === "GET") {
      const { student_id, course_id } = Object.fromEntries(url.searchParams);
      let q = "SELECT e.*, s.first_name || ' ' || s.last_name as student_name, c.name as course_name FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE 1=1";
      const params: any[] = [];
      if (student_id) { q += " AND e.student_id = ?"; params.push(student_id); }
      if (course_id) { q += " AND e.course_id = ?"; params.push(course_id); }
      const r = await env.DB.prepare(q).bind(...params).all();
      return json(r.results);
    }
    if (method === "POST") {
      const { student_id, course_id } = body;
      if (!student_id || !course_id) return error("student_id, course_id required");
      try {
        const r = await env.DB.prepare("INSERT INTO enrollments (student_id,course_id) VALUES (?,?)").bind(student_id, course_id);
        await r.run();
        return json({ id: r.lastInsertRowid, student_id, course_id }, 201);
      } catch (e: any) { return error("Already enrolled or invalid IDs"); }
    }
    if (method === "DELETE" && id) {
      await env.DB.prepare("DELETE FROM enrollments WHERE id = ?").bind(id).run();
      return json({ deleted: id });
    }
  }

  return error("Endpoint not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    // Static assets handled by the `assets` binding
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  },
};
