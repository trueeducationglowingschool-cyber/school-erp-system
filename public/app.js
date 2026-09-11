/**
 * School ERP System — Frontend SPA
 * Vanilla JS router + CRUD UI for all modules.
 */

const API = "/api";

// ─── Helpers ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}/${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add("hidden"), 2500);
  el.classList.remove("hidden");
}

function fmtMoney(v) {
  return "$" + (Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function pill(text, cls = "gray") {
  return `<span class="pill ${cls}">${text}</span>`;
}

function statusPill(status) {
  const map = { active: "green", paid: "green", present: "green", completed: "green", graduated: "blue",
    inactive: "gray", pending: "amber", unpaid: "red", overdue: "red", absent: "red", dropped: "red",
    suspended: "red", withdrawn: "red", partial: "amber", late: "amber", excused: "blue", on_leave: "amber" };
  return pill(status, map[status] || "gray");
}

// ─── Modal ────────────────────────────────────────────────
function openModal(title, fields, onSubmit) {
  const modal = document.getElementById("modal");
  const form = document.getElementById("modal-form");
  document.getElementById("modal-title").textContent = title;
  form.innerHTML = `
    <div class="form-grid">${fields.map(f => {
      if (f.type === "select") {
        return `<div class="${f.full ? "full" : ""}">
          <label>${f.label}</label>
          <select name="${f.name}" ${f.required ? "required" : ""}>
            <option value="">— Select —</option>
            ${f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}
          </select>
        </div>`;
      }
      if (f.type === "textarea") {
        return `<div class="full"><label>${f.label}</label><textarea name="${f.name}" ${f.required ? "required" : ""}></textarea></div>`;
      }
      return `<div class="${f.full ? "full" : ""}">
        <label>${f.label}</label>
        <input type="${f.type || "text"}" name="${f.name}" value="${f.value || ""}" ${f.step ? `step="${f.step}"` : ""} ${f.required ? "required" : ""} />
      </div>`;
    }).join("")}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn">Save</button>
    </div>
  `;
  modal.classList.remove("hidden");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    // Convert numeric fields
    fields.forEach(f => { if (f.type === "number" && data[f.name]) data[f.name] = Number(data[f.name]); });
    try {
      await onSubmit(data);
      closeModal();
      toast("Saved successfully");
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

// ─── Table builder ───────────────────────────────────────
function table(headers, rows, actions) {
  let html = `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}${actions ? "<th>Actions</th>" : ""}</tr></thead><tbody>`;
  if (!rows.length) {
    html += `<tr><td colspan="${headers.length + (actions ? 1 : 0)}" class="empty">No records found</td></tr>`;
  } else {
    rows.forEach((row, i) => {
      html += "<tr>" + headers.map(h => `<td>${row[h] ?? "—"}</td>`).join("");
      if (actions) html += `<td><div class="btn-row">${actions(row, i)}</div></td>`;
      html += "</tr>";
    });
  }
  html += "</tbody></table></div>";
  return html;
}

// ─── Views ────────────────────────────────────────────────

async function viewDashboard() {
  const d = await api("dashboard");
  document.getElementById("content").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Students</div><div class="stat-value">${d.students}</div></div>
      <div class="stat-card green"><div class="stat-label">Teachers</div><div class="stat-value">${d.teachers}</div></div>
      <div class="stat-card amber"><div class="stat-label">Courses</div><div class="stat-value">${d.courses}</div></div>
      <div class="stat-card"><div class="stat-label">Classes</div><div class="stat-value">${d.classes}</div></div>
      <div class="stat-card red"><div class="stat-label">Unpaid Invoices</div><div class="stat-value">${d.unpaidInvoices}</div></div>
      <div class="stat-card red"><div class="stat-label">Outstanding Fees</div><div class="stat-value">${fmtMoney(d.outstandingFees)}</div></div>
      <div class="stat-card amber"><div class="stat-label">Low Stock Items</div><div class="stat-value">${d.lowStockItems}</div></div>
    </div>
    <div class="card">
      <h3>Quick Actions</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="location.hash='#/students'">Manage Students</button>
        <button class="btn" onclick="location.hash='#/invoices'">View Invoices</button>
        <button class="btn" onclick="location.hash='#/attendance'">Take Attendance</button>
        <button class="btn" onclick="location.hash='#/payroll'">Process Payroll</button>
        <button class="btn" onclick="location.hash='#/inventory'">Check Inventory</button>
      </div>
    </div>
    <div class="card">
      <h3>System Overview</h3>
      <p class="muted">This School ERP System includes student & teacher management, course enrollment, attendance tracking, grade management, fee invoicing & payment processing, payroll management, and inventory control — all powered by Cloudflare Workers and D1.</p>
    </div>
  `;
}

async function viewStudents() {
  const data = await api("students");
  const classes = await api("classes");
  const rows = data.map(s => ({
    "Name": `${s.first_name} ${s.last_name}`,
    "Email": s.email,
    "Guardian": s.guardian_name || "—",
    "Phone": s.phone || "—",
    "Status": statusPill(s.status),
    "Enrolled": fmtDate(s.enrollment_date),
    "_id": s.id,
  }));
  const html = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search students…" oninput="filterTable(this)" />
      <button class="btn" onclick="addStudent()">+ Add Student</button>
    </div>
    <div class="card">${table(["Name","Email","Guardian","Phone","Status","Enrolled"], rows, (r) => `
      <button class="btn btn-sm" onclick="editStudent(${r._id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="del('students',${r._id})">Delete</button>
    `)}</div>
  `;
  document.getElementById("content").innerHTML = html;
}

function addStudent() {
  api("classes").then(classes => {
    openModal("Add Student", [
      { name: "first_name", label: "First Name", required: true },
      { name: "last_name", label: "Last Name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone" },
      { name: "date_of_birth", label: "Date of Birth", type: "date" },
      { name: "gender", label: "Gender", type: "select", options: [
        { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }
      ]},
      { name: "address", label: "Address", full: true },
      { name: "guardian_name", label: "Guardian Name" },
      { name: "guardian_phone", label: "Guardian Phone" },
      { name: "class_id", label: "Class", type: "select", options: classes.map(c => ({ value: c.id, label: c.name })) },
    ], (data) => api("students", { method: "POST", body: JSON.stringify(data) }).then(() => viewStudents()));
  });
}

function editStudent(id) {
  Promise.all([api(`students/${id}`), api("classes")]).then(([s, classes]) => {
    openModal("Edit Student", [
      { name: "first_name", label: "First Name", required: true, value: s.first_name },
      { name: "last_name", label: "Last Name", required: true, value: s.last_name },
      { name: "email", label: "Email", type: "email", required: true, value: s.email },
      { name: "phone", label: "Phone", value: s.phone || "" },
      { name: "date_of_birth", label: "Date of Birth", type: "date", value: s.date_of_birth || "" },
      { name: "gender", label: "Gender", type: "select", options: [
        { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }
      ]},
      { name: "address", label: "Address", full: true, value: s.address || "" },
      { name: "guardian_name", label: "Guardian Name", value: s.guardian_name || "" },
      { name: "guardian_phone", label: "Guardian Phone", value: s.guardian_phone || "" },
      { name: "class_id", label: "Class", type: "select", options: classes.map(c => ({ value: c.id, label: c.name })) },
      { name: "status", label: "Status", type: "select", options: [
        { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "graduated", label: "Graduated" }, { value: "withdrawn", label: "Withdrawn" }
      ]},
    ], (data) => api(`students/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(() => viewStudents()));
  });
}

async function viewTeachers() {
  const data = await api("teachers");
  const depts = await api("departments");
  const rows = data.map(t => ({
    "Name": `${t.first_name} ${t.last_name}`,
    "Email": t.email,
    "Department": t.department_name || "—",
    "Salary": fmtMoney(t.salary),
    "Status": statusPill(t.status),
    "Hired": fmtDate(t.hire_date),
    "_id": t.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search teachers…" oninput="filterTable(this)" />
      <button class="btn" onclick="addTeacher()">+ Add Teacher</button>
    </div>
    <div class="card">${table(["Name","Email","Department","Salary","Status","Hired"], rows, (r) => `
      <button class="btn btn-sm" onclick="editTeacher(${r._id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="del('teachers',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addTeacher() {
  api("departments").then(depts => {
    openModal("Add Teacher", [
      { name: "first_name", label: "First Name", required: true },
      { name: "last_name", label: "Last Name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone" },
      { name: "hire_date", label: "Hire Date", type: "date" },
      { name: "department_id", label: "Department", type: "select", options: depts.map(d => ({ value: d.id, label: d.name })) },
      { name: "salary", label: "Salary ($)", type: "number", step: "0.01" },
    ], (data) => api("teachers", { method: "POST", body: JSON.stringify(data) }).then(() => viewTeachers()));
  });
}

function editTeacher(id) {
  Promise.all([api(`teachers/${id}`), api("departments")]).then(([t, depts]) => {
    openModal("Edit Teacher", [
      { name: "first_name", label: "First Name", required: true, value: t.first_name },
      { name: "last_name", label: "Last Name", required: true, value: t.last_name },
      { name: "email", label: "Email", type: "email", required: true, value: t.email },
      { name: "phone", label: "Phone", value: t.phone || "" },
      { name: "hire_date", label: "Hire Date", type: "date", value: t.hire_date || "" },
      { name: "department_id", label: "Department", type: "select", options: depts.map(d => ({ value: d.id, label: d.name })) },
      { name: "salary", label: "Salary ($)", type: "number", step: "0.01", value: t.salary },
      { name: "status", label: "Status", type: "select", options: [
        { value: "active", label: "Active" }, { value: "on_leave", label: "On Leave" }, { value: "inactive", label: "Inactive" }
      ]},
    ], (data) => api(`teachers/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(() => viewTeachers()));
  });
}

async function viewCourses() {
  const data = await api("courses");
  const rows = data.map(c => ({
    "Code": c.code, "Name": c.name, "Teacher": c.teacher_name || "—",
    "Dept": c.department_name || "—", "Credits": c.credits, "_id": c.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search courses…" oninput="filterTable(this)" />
      <button class="btn" onclick="addCourse()">+ Add Course</button>
    </div>
    <div class="card">${table(["Code","Name","Teacher","Dept","Credits"], rows, (r) => `
      <button class="btn btn-sm" onclick="editCourse(${r._id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="del('courses',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addCourse() {
  Promise.all([api("teachers"), api("departments")]).then(([teachers, depts]) => {
    openModal("Add Course", [
      { name: "name", label: "Course Name", required: true },
      { name: "code", label: "Course Code", required: true },
      { name: "description", label: "Description", type: "textarea", full: true },
      { name: "credits", label: "Credits", type: "number" },
      { name: "teacher_id", label: "Teacher", type: "select", options: teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` })) },
      { name: "department_id", label: "Department", type: "select", options: depts.map(d => ({ value: d.id, label: d.name })) },
    ], (data) => api("courses", { method: "POST", body: JSON.stringify(data) }).then(() => viewCourses()));
  });
}

function editCourse(id) {
  Promise.all([api(`courses/${id}`), api("teachers"), api("departments")]).then(([c, teachers, depts]) => {
    openModal("Edit Course", [
      { name: "name", label: "Course Name", required: true, value: c.name },
      { name: "code", label: "Course Code", required: true, value: c.code },
      { name: "description", label: "Description", type: "textarea", full: true, value: c.description || "" },
      { name: "credits", label: "Credits", type: "number", value: c.credits },
      { name: "teacher_id", label: "Teacher", type: "select", options: teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` })) },
      { name: "department_id", label: "Department", type: "select", options: depts.map(d => ({ value: d.id, label: d.name })) },
    ], (data) => api(`courses/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(() => viewCourses()));
  });
}

async function viewClasses() {
  const data = await api("classes");
  const rows = data.map(c => ({
    "Name": c.name, "Grade": c.grade_level || "—", "Room": c.room || "—",
    "Capacity": c.capacity, "Students": c.student_count, "Homeroom": c.homeroom_teacher || "—", "_id": c.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search classes…" oninput="filterTable(this)" />
      <button class="btn" onclick="addClass()">+ Add Class</button>
    </div>
    <div class="card">${table(["Name","Grade","Room","Capacity","Students","Homeroom"], rows, (r) => `
      <button class="btn btn-sm" onclick="location.hash='#/classes'">View</button>
      <button class="btn btn-sm btn-danger" onclick="del('classes',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addClass() {
  api("teachers").then(teachers => {
    openModal("Add Class", [
      { name: "name", label: "Class Name", required: true },
      { name: "grade_level", label: "Grade Level" },
      { name: "homeroom_teacher_id", label: "Homeroom Teacher", type: "select", options: teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` })) },
      { name: "room", label: "Room" },
      { name: "capacity", label: "Capacity", type: "number" },
    ], (data) => api("classes", { method: "POST", body: JSON.stringify(data) }).then(() => viewClasses()));
  });
}

async function viewDepartments() {
  const data = await api("departments");
  const rows = data.map(d => ({ "Name": d.name, "Budget": fmtMoney(d.budget), "_id": d.id }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><button class="btn" onclick="addDept()">+ Add Department</button></div>
    <div class="card">${table(["Name","Budget"], rows, (r) => `<button class="btn btn-sm btn-danger" onclick="del('departments',${r._id})">Delete</button>`)}</div>
  `;
}

function addDept() {
  openModal("Add Department", [
    { name: "name", label: "Department Name", required: true },
    { name: "budget", label: "Budget ($)", type: "number", step: "0.01" },
  ], (data) => api("departments", { method: "POST", body: JSON.stringify(data) }).then(() => viewDepartments()));
}

async function viewAttendance() {
  const [data, students, courses] = await Promise.all([api("attendance"), api("students"), api("courses")]);
  const rows = data.map(a => ({
    "Student": a.student_name, "Course": a.course_name, "Date": fmtDate(a.date),
    "Status": statusPill(a.status), "Notes": a.notes || "—", "_id": a.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><button class="btn" onclick="addAttendance()">+ Record Attendance</button></div>
    <div class="card">${table(["Student","Course","Date","Status","Notes"], rows, (r) => `
      <button class="btn btn-sm btn-danger" onclick="del('attendance',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addAttendance() {
  Promise.all([api("students"), api("courses")]).then(([students, courses]) => {
    openModal("Record Attendance", [
      { name: "student_id", label: "Student", type: "select", required: true, options: students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: "course_id", label: "Course", type: "select", required: true, options: courses.map(c => ({ value: c.id, label: c.name })) },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", required: true, options: [
        { value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "late", label: "Late" }, { value: "excused", label: "Excused" }
      ]},
      { name: "notes", label: "Notes", full: true },
    ], (data) => api("attendance", { method: "POST", body: JSON.stringify(data) }).then(() => viewAttendance()));
  });
}

async function viewGrades() {
  const [data, students, courses] = await Promise.all([api("grades"), api("students"), api("courses")]);
  const rows = data.map(g => ({
    "Student": g.student_name, "Course": g.course_name, "Assessment": g.assessment_name,
    "Score": `${g.score}/${g.max_score}`, "Term": g.term, "Date": fmtDate(g.recorded_at), "_id": g.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><button class="btn" onclick="addGrade()">+ Add Grade</button></div>
    <div class="card">${table(["Student","Course","Assessment","Score","Term","Date"], rows, (r) => `
      <button class="btn btn-sm btn-danger" onclick="del('grades',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addGrade() {
  Promise.all([api("students"), api("courses")]).then(([students, courses]) => {
    openModal("Add Grade", [
      { name: "student_id", label: "Student", type: "select", required: true, options: students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: "course_id", label: "Course", type: "select", required: true, options: courses.map(c => ({ value: c.id, label: c.name })) },
      { name: "assessment_name", label: "Assessment Name", required: true },
      { name: "score", label: "Score", type: "number", step: "0.01", required: true },
      { name: "max_score", label: "Max Score", type: "number", step: "0.01" },
      { name: "weight", label: "Weight", type: "number", step: "0.01" },
      { name: "term", label: "Term" },
    ], (data) => api("grades", { method: "POST", body: JSON.stringify(data) }).then(() => viewGrades()));
  });
}

async function viewEnrollments() {
  const [data, students, courses] = await Promise.all([api("enrollments"), api("students"), api("courses")]);
  const rows = data.map(e => ({
    "Student": e.student_name, "Course": e.course_name, "Status": statusPill(e.status), "Enrolled": fmtDate(e.enrolled_at), "_id": e.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><button class="btn" onclick="addEnrollment()">+ Enroll Student</button></div>
    <div class="card">${table(["Student","Course","Status","Enrolled"], rows, (r) => `
      <button class="btn btn-sm btn-danger" onclick="del('enrollments',${r._id})">Unenroll</button>
    `)}</div>
  `;
}

function addEnrollment() {
  Promise.all([api("students"), api("courses")]).then(([students, courses]) => {
    openModal("Enroll Student", [
      { name: "student_id", label: "Student", type: "select", required: true, options: students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: "course_id", label: "Course", type: "select", required: true, options: courses.map(c => ({ value: c.id, label: c.name })) },
    ], (data) => api("enrollments", { method: "POST", body: JSON.stringify(data) }).then(() => viewEnrollments()));
  });
}

async function viewInvoices() {
  const data = await api("invoices");
  const students = await api("students");
  const rows = data.map(i => ({
    "Invoice": i.invoice_number, "Student": i.student_name,
    "Total": `<span class="money">${fmtMoney(i.total_amount)}</span>`,
    "Paid": `<span class="money">${fmtMoney(i.paid_amount)}</span>`,
    "Balance": `<span class="money">${fmtMoney(i.balance)}</span>`,
    "Status": statusPill(i.status), "Due": fmtDate(i.due_date), "_id": i.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search invoices…" oninput="filterTable(this)" />
      <button class="btn" onclick="addInvoice()">+ Create Invoice</button>
    </div>
    <div class="card">${table(["Invoice","Student","Total","Paid","Balance","Status","Due"], rows, (r) => `
      <button class="btn btn-sm" onclick="payInvoice(${r._id})">Pay</button>
      <button class="btn btn-sm btn-danger" onclick="del('invoices',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addInvoice() {
  api("students").then(students => {
    openModal("Create Invoice", [
      { name: "student_id", label: "Student", type: "select", required: true, options: students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: "due_date", label: "Due Date", type: "date" },
      { name: "items_json", label: "Line Items (JSON: [{description,amount}])", type: "textarea", full: true, value: '[{"description":"Tuition Fee","amount":5000}]' },
    ], (data) => {
      data.items = JSON.parse(data.items_json);
      delete data.items_json;
      return api("invoices", { method: "POST", body: JSON.stringify(data) }).then(() => viewInvoices());
    });
  });
}

function payInvoice(id) {
  api("students").then(students => {
    openModal("Record Payment", [
      { name: "invoice_id", label: "Invoice ID", type: "number", required: true, value: id },
      { name: "student_id", label: "Student", type: "select", required: true, options: students.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: "amount", label: "Amount ($)", type: "number", step: "0.01", required: true },
      { name: "method", label: "Method", type: "select", options: [
        { value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "bank_transfer", label: "Bank Transfer" }, { value: "online", label: "Online" }
      ]},
      { name: "reference", label: "Reference" },
    ], (data) => api("payments", { method: "POST", body: JSON.stringify(data) }).then(() => viewInvoices()));
  });
}

async function viewPayments() {
  const data = await api("payments");
  const rows = data.map(p => ({
    "Invoice": p.invoice_number, "Student": p.student_name,
    "Amount": `<span class="money">${fmtMoney(p.amount)}</span>`,
    "Method": pill(p.method, "blue"), "Reference": p.reference || "—", "Date": fmtDate(p.paid_at), "_id": p.id,
  }));
  document.getElementById("content").innerHTML = `<div class="card">${table(["Invoice","Student","Amount","Method","Reference","Date"], rows)}</div>`;
}

async function viewPayroll() {
  const [data, teachers] = await Promise.all([api("payroll"), api("teachers")]);
  const rows = data.map(p => ({
    "Teacher": p.teacher_name, "Period": p.pay_period,
    "Base": fmtMoney(p.base_salary), "Bonuses": fmtMoney(p.bonuses),
    "Deductions": fmtMoney(p.deductions), "Net Pay": `<span class="money">${fmtMoney(p.net_pay)}</span>`,
    "Status": statusPill(p.status), "_id": p.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar"><button class="btn" onclick="addPayroll()">+ Create Payroll Record</button></div>
    <div class="card">${table(["Teacher","Period","Base","Bonuses","Deductions","Net Pay","Status"], rows, (r) => `
      ${r.Status.includes("pending") ? `<button class="btn btn-sm btn-green" onclick="paySalary(${r._id})">Mark Paid</button>` : ""}
    `)}</div>
  `;
}

function addPayroll() {
  api("teachers").then(teachers => {
    openModal("Create Payroll Record", [
      { name: "teacher_id", label: "Teacher", type: "select", required: true, options: teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` })) },
      { name: "pay_period", label: "Pay Period (e.g. 2026-09)", required: true },
      { name: "base_salary", label: "Base Salary ($)", type: "number", step: "0.01", required: true },
      { name: "bonuses", label: "Bonuses ($)", type: "number", step: "0.01" },
      { name: "deductions", label: "Deductions ($)", type: "number", step: "0.01" },
    ], (data) => api("payroll", { method: "POST", body: JSON.stringify(data) }).then(() => viewPayroll()));
  });
}

async function paySalary(id) {
  await api(`payroll/${id}/pay`, { method: "PUT" });
  toast("Salary marked as paid");
  viewPayroll();
}

async function viewInventory() {
  const data = await api("inventory");
  const rows = data.map(i => ({
    "Name": i.name, "Category": i.category || "—", "SKU": i.sku || "—",
    "Qty": i.quantity, "Reorder": i.reorder_level,
    "Stock": i.quantity <= i.reorder_level ? pill("Low", "red") : pill("OK", "green"),
    "Price": fmtMoney(i.unit_price), "_id": i.id,
  }));
  document.getElementById("content").innerHTML = `
    <div class="toolbar">
      <input class="search" type="text" placeholder="Search inventory…" oninput="filterTable(this)" />
      <button class="btn" onclick="addItem()">+ Add Item</button>
    </div>
    <div class="card">${table(["Name","Category","SKU","Qty","Reorder","Stock","Price"], rows, (r) => `
      <button class="btn btn-sm" onclick="stockTransaction(${r._id})">Stock</button>
      <button class="btn btn-sm btn-danger" onclick="del('inventory',${r._id})">Delete</button>
    `)}</div>
  `;
}

function addItem() {
  openModal("Add Inventory Item", [
    { name: "name", label: "Item Name", required: true },
    { name: "category", label: "Category" },
    { name: "sku", label: "SKU" },
    { name: "quantity", label: "Quantity", type: "number" },
    { name: "unit_price", label: "Unit Price ($)", type: "number", step: "0.01" },
    { name: "reorder_level", label: "Reorder Level", type: "number" },
    { name: "location", label: "Location" },
  ], (data) => api("inventory", { method: "POST", body: JSON.stringify(data) }).then(() => viewInventory()));
}

function stockTransaction(id) {
  openModal("Stock Transaction", [
    { name: "transaction_type", label: "Type", type: "select", required: true, options: [
      { value: "stock_in", label: "Stock In (Add)" }, { value: "stock_out", label: "Stock Out (Remove)" }, { value: "adjustment", label: "Adjustment (Set)" }
    ]},
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "reason", label: "Reason", full: true },
  ], (data) => api(`inventory/${id}/transaction`, { method: "POST", body: JSON.stringify(data) }).then(() => viewInventory()));
}

// ─── Shared delete ────────────────────────────────────────
async function del(resource, id) {
  if (!confirm("Are you sure you want to delete this record?")) return;
  try {
    await api(`${resource}/${id}`, { method: "DELETE" });
    toast("Deleted successfully");
    router();
  } catch (err) { toast(err.message, "error"); }
}

// ─── Table filter ─────────────────────────────────────────
function filterTable(input) {
  const filter = input.value.toLowerCase();
  const rows = document.querySelectorAll("tbody tr");
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(filter) ? "" : "none";
  });
}

// ─── Router ───────────────────────────────────────────────
const views = {
  dashboard: viewDashboard, students: viewStudents, teachers: viewTeachers,
  courses: viewCourses, classes: viewClasses, departments: viewDepartments,
  attendance: viewAttendance, grades: viewGrades, enrollments: viewEnrollments,
  invoices: viewInvoices, payments: viewPayments, payroll: viewPayroll, inventory: viewInventory,
};

const titles = {
  dashboard: "Dashboard", students: "Students", teachers: "Teachers",
  courses: "Courses", classes: "Classes", departments: "Departments",
  attendance: "Attendance", grades: "Grades", enrollments: "Enrollments",
  invoices: "Fees & Invoices", payments: "Payments", payroll: "Payroll", inventory: "Inventory",
};

async function router() {
  const hash = location.hash.replace("#/", "") || "dashboard";
  const view = views[hash] || viewDashboard;
  document.getElementById("page-title").textContent = titles[hash] || "Dashboard";
  document.querySelectorAll(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.view === hash));
  document.getElementById("content").innerHTML = '<div class="loading">Loading…</div>';
  try {
    await view();
  } catch (err) {
    document.getElementById("content").innerHTML = `<div class="card"><p style="color:var(--red)">Error: ${err.message}</p><p class="muted" style="margin-top:8px">Make sure the D1 database is created and migrations are applied. Run:<br><code>npx wrangler d1 create school-erp-db</code><br><code>npx wrangler d1 migrations apply school-erp-db</code></p></div>`;
    document.getElementById("connection-badge").textContent = "● Offline";
    document.getElementById("connection-badge").classList.add("offline");
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refresh-btn").onclick = router;
  router();
});