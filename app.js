// Toast notification system
function showToast(msg, type = "info") {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg text-sm font-medium opacity-0 pointer-events-none transition-all duration-300 " +
    (type === "error"
      ? "bg-red-600 text-white"
      : type === "success"
      ? "bg-green-600 text-white"
      : "bg-gray-900 text-white");
  setTimeout(() => {
    toast.style.opacity = 1;
    toast.style.pointerEvents = "auto";
  }, 10);
  setTimeout(() => {
    toast.style.opacity = 0;
    toast.style.pointerEvents = "none";
  }, 2500);
}

// Format timestamp (ms) to local date string
function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}
// DOM Shortcuts
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Format number for display (e.g., currency, quantity)
function fmt(val) {
  if (typeof val === "number") {
    return val % 1 === 0 ? val : val.toFixed(2);
  }
  return val;
}

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAD8CQULA9Er6sdTLbB-powzoU9DVpsUKo",
  authDomain: "honest-app-837f9.firebaseapp.com",
  projectId: "honest-app-837f9",
  storageBucket: "honest-app-837f9.firebasestorage.app",
  messagingSenderId: "576180238986",
  appId: "1:576180238986:web:26ddcd7879c58e966b0b73",
  measurementId: "G-GK9VWBLLXJ",
};

firebase.initializeApp(firebaseConfig);
firebase.analytics();
const db = firebase.firestore();

// -------- State --------
let employees = [];
let work = [];
let auth = JSON.parse(localStorage.getItem("hf:auth")) || null; // persist auth

// -------- App Init --------
async function initApp() {
  await loadEmployees();
  await loadWork();
  render();
}

// -------- DB Functions --------
async function loadEmployees() {
  const snap = await db.collection("employees").get();
  employees = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
async function saveEmployee(emp) {
  if (emp.id) {
    await db.collection("employees").doc(emp.id).set(emp);
  } else {
    const ref = await db.collection("employees").add(emp);
    emp.id = ref.id;
  }
  await loadEmployees();
}
async function deleteEmployee(id) {
  await db.collection("employees").doc(id).delete();
  await db
    .collection("work")
    .where("employeeId", "==", id)
    .get()
    .then((snap) => {
      snap.forEach((doc) => doc.ref.delete());
    });
  await loadEmployees();
  await loadWork();
}
function normalizeCreatedAt(val) {
  if (val && typeof val === "object" && val.seconds) {
    return val.seconds * 1000;
  }
  return Number(val) || 0;
}

async function loadWork() {
  const snap = await db.collection("work").get();
  work = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: normalizeCreatedAt(data.createdAt),
    };
  });
}
async function saveWork(wi) {
  const ref = await db.collection("work").add(wi);
  wi.id = ref.id;
  await loadWork();
}
async function deleteWork(id) {
  await db.collection("work").doc(id).delete();
  await loadWork();
}

// -------- Auth --------
const ADMIN_USER = "ibads66585";
const ADMIN_PASS = "ap874658";

function setAuth(next) {
  auth = next;
  localStorage.setItem("hf:auth", JSON.stringify(auth)); // persist
  render();
}

// Logout
$("#logoutAdmin").addEventListener("click", () => setAuth(null));
$("#logoutEmp").addEventListener("click", () => setAuth(null));

// -------- Login --------
$("#loginBtn").addEventListener("click", async () => {
  const u = $("#loginUsername").value.trim();
  const p = $("#loginPassword").value.trim();
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    setAuth({ role: "admin", username: u });
    return;
  }
  // Only load employees if not admin
  await loadEmployees();
  const emp = employees.find((e) => e.username === u && e.password === p);
  if (emp) {
    setAuth({ role: "employee", username: u, employeeId: emp.id });
  } else {
    const err = $("#loginError");
    err.textContent = "Incorrect Username Password";
    err.classList.remove("hidden");
  }
});

// -------- Employee Management --------
const empForm = $("#empForm");
const empTableBody = $("#empTableBody");
const empListSearch = $("#empListSearch");

$("#genCreds").addEventListener("click", () => {
  const name = $("#empName").value.trim() || "user";
  const uname =
    name.toLowerCase().replace(/\s+/g, "") +
    Math.floor(100 + Math.random() * 900);
  const pass = Math.random().toString(36).slice(2, 8);
  $("#empUsername").value = uname;
  $("#empPassword").value = pass;
});

$("#resetEmpForm").addEventListener("click", () => {
  empForm.reset();
  $("#rateShirt").value = 0;
  $("#ratePant").value = 0;
  $("#rateKurta").value = 0;
  $("#ratePajama").value = 0;
  $("#editingEmpId").value = "";
});

empForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idEditing = $("#editingEmpId").value;
  const name = $("#empName").value.trim();
  const username = $("#empUsername").value.trim();
  const password = $("#empPassword").value.trim();
  const rates = {
    Shirt: Number($("#rateShirt").value || 0),
    Pant: Number($("#ratePant").value || 0),
    Kurta: Number($("#rateKurta").value || 0),
    Pajama: Number($("#ratePajama").value || 0),
  };
  if (!name || !username || !password)
    return alert("Please fill name, username and password");

  await loadEmployees();
  if (idEditing) {
    const emp = employees.find((e) => e.id === idEditing);
    if (emp) {
      emp.name = name;
      emp.username = username;
      emp.password = password;
      emp.rates = rates;
      await saveEmployee(emp);
    }
  } else {
    if (employees.some((e) => e.username === username))
      return alert("Username already exists");
    await saveEmployee({ name, username, password, rates });
  }
  empForm.reset();
  $("#editingEmpId").value = "";
  $("#rateShirt").value = 0;
  $("#ratePant").value = 0;
  $("#rateKurta").value = 0;
  $("#ratePajama").value = 0;
  await loadEmployees();
  renderEmployees();
});

function renderEmployees() {
  const q = empListSearch.value.trim().toLowerCase();
  const list = !q
    ? employees
    : employees.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q)
      );
  empTableBody.innerHTML = list
    .map(
      (e) => `
        <tr class="border-b">
          <td class="p-2">${e.name}</td>
          <td class="p-2">${e.username}</td>
          <td class="p-2">${e.rates.Shirt}/${e.rates.Pant}/${e.rates.Kurta}/${e.rates.Pajama}</td>
          <td class="p-2">
            <div class="flex gap-2">
              <button class="px-3 py-1 rounded-2xl bg-gray-200 text-xs" data-edit="${e.id}">Edit</button>
              <button class="px-3 py-1 rounded-2xl bg-red-500 text-white text-xs" data-del="${e.id}">Remove</button>
            </div>
          </td>
        </tr>`
    )
    .join("");

  // bind
  empTableBody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-edit");
      const em = employees.find((x) => x.id === id);
      if (!em) return;
      $("#empName").value = em.name;
      $("#empUsername").value = em.username;
      $("#empPassword").value = em.password;
      $("#rateShirt").value = em.rates.Shirt;
      $("#ratePant").value = em.rates.Pant;
      $("#rateKurta").value = em.rates.Kurta;
      $("#ratePajama").value = em.rates.Pajama;
      $("#editingEmpId").value = em.id;
      // Switch to emp tab
      $$("#adminView .tab-btn")[0].click();
    })
  );

  empTableBody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-del");
      if (!confirm("Remove employee? Their work entries will also be removed."))
        return;
      await deleteEmployee(id);
      await loadEmployees();
      await loadWork();
      renderEmployees();
      renderWorkOverview();
      populateRateSelect();
    })
  );
}
empListSearch.addEventListener("input", renderEmployees);

// -------- Rate Management --------
function populateRateSelect() {
  const sel = $("#rateEmpSelect");
  sel.innerHTML = employees
    .map((e) => `<option value="${e.id}">${e.name} (${e.username})</option>`)
    .join("");
  fillRateFields();
}
function fillRateFields() {
  const id = $("#rateEmpSelect").value;
  const em = employees.find((e) => e.id === id);
  if (!em) {
    $("#rmShirt").value = "";
    $("#rmPant").value = "";
    $("#rmKurta").value = "";
    $("#rmPajama").value = "";
    return;
  }
  $("#rmShirt").value = em.rates.Shirt;
  $("#rmPant").value = em.rates.Pant;
  $("#rmKurta").value = em.rates.Kurta;
  $("#rmPajama").value = em.rates.Pajama;
}
$("#rateEmpSelect").addEventListener("change", fillRateFields);
$("#applyRates").addEventListener("click", async () => {
  const id = $("#rateEmpSelect").value;
  const em = employees.find((e) => e.id === id);
  if (!em) return;
  em.rates = {
    Shirt: Number($("#rmShirt").value || 0),
    Pant: Number($("#rmPant").value || 0),
    Kurta: Number($("#rmKurta").value || 0),
    Pajama: Number($("#rmPajama").value || 0),
  };
  await saveEmployee(em);
  await loadEmployees();
  renderEmployees();
  alert("Rates updated!");
});

// -------- Work Overview (Admin) --------
const woTableBody = $("#woTableBody");
const woTotal = $("#woTotal");
const woFilter = $("#woFilter");
const clearWO = $("#clearWO");
function renderWorkOverview() {
  const q = woFilter.value.trim().toLowerCase();
  const rows = work
    .map((wi) => ({
      ...wi,
      empName: employees.find((e) => e.id === wi.employeeId)?.name || "—",
      rate: employees.find((e) => e.id === wi.employeeId)?.rates[wi.type] || 0,
      createdAt: normalizeCreatedAt(wi.createdAt),
    }))
    .filter(
      (r) =>
        !q ||
        r.empName.toLowerCase().includes(q) ||
        r.billNo.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  let total = 0;
  woTableBody.innerHTML = rows
    .map((r) => {
      total += r.amount;
      return `
        <tr class="border-b">
          <td class="p-2">${formatDate(r.createdAt)}</td>
          <td class="p-2">${r.empName}</td>
          <td class="p-2">${r.billNo}</td>
          <td class="p-2">${r.type}</td>
          <td class="p-2 text-right">${fmt(r.qty)}</td>
          <td class="p-2 text-right">${fmt(r.rate)}</td>
          <td class="p-2 text-right">${fmt(r.amount)}</td>
        </tr>`;
    })
    .join("");
  woTotal.textContent = fmt(total);
}
woFilter.addEventListener("input", renderWorkOverview);
clearWO.addEventListener("click", () => {
  woFilter.value = "";
  renderWorkOverview();
});

// -------- Global Search (Admin) --------
const globalSearch = $("#globalSearch");
const searchEmpList = $("#searchEmpList");
const searchWorkList = $("#searchWorkList");
let selectedEmpId = "";
const clearEmpFilter = $("#clearEmpFilter");
const dateFilter = $("#dateFilter");
const weekFilter = $("#weekFilter");
const showEarnings = $("#showEarnings");
const earningsTable = $("#earningsTable");

function getWeekOptions() {
  // Get all weeks from work entries
  const weeks = new Set();
  work.forEach((wi) => {
    const d = new Date(wi.createdAt);
    // ISO week string: YYYY-Www
    const week =
      d.getFullYear() + "-W" + String(getWeekNumber(d)).padStart(2, "0");
    weeks.add(week);
  });
  return Array.from(weeks).sort().reverse();
}
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
function populateWeekFilter() {
  if (!weekFilter) return;
  const options = getWeekOptions();
  weekFilter.innerHTML =
    '<option value="">All Weeks</option>' +
    options.map((w) => `<option value="${w}">${w}</option>`).join("");
}
function filterWorkByDateWeek() {
  let filtered = work;
  if (dateFilter && dateFilter.value) {
    const selDate = new Date(dateFilter.value);
    filtered = filtered.filter((wi) => {
      const d = new Date(wi.createdAt);
      return d.toDateString() === selDate.toDateString();
    });
  }
  if (weekFilter && weekFilter.value) {
    filtered = filtered.filter((wi) => {
      const d = new Date(wi.createdAt);
      const week =
        d.getFullYear() + "-W" + String(getWeekNumber(d)).padStart(2, "0");
      return week === weekFilter.value;
    });
  }
  return filtered;
}
function showEmployeeEarnings() {
  const filtered = filterWorkByDateWeek();
  // Group by employee
  const earnings = {};
  filtered.forEach((wi) => {
    if (!earnings[wi.employeeId]) earnings[wi.employeeId] = 0;
    earnings[wi.employeeId] += wi.amount;
  });
  const rows = employees
    .map((e) => {
      const amt = earnings[e.id] || 0;
      return `<tr><td class='p-2'>${
        e.name
      }</td><td class='p-2 text-right'>${fmt(amt)}</td></tr>`;
    })
    .join("");
  earningsTable.innerHTML = `<table class='w-full text-sm'><thead><tr><th class='p-2 text-left'>Employee</th><th class='p-2 text-right'>Earnings</th></tr></thead><tbody>${rows}</tbody></table>`;
}
if (showEarnings) {
  showEarnings.addEventListener("click", (e) => {
    e.preventDefault();
    showEmployeeEarnings();
  });
}
if (weekFilter) {
  weekFilter.addEventListener("focus", populateWeekFilter);
}

function runGlobalSearch() {
  const q = globalSearch.value.trim().toLowerCase();
  // employees by name/username
  const emps = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
  );
  searchEmpList.innerHTML = emps
    .map(
      (
        e
      ) => `<li class="flex items-center justify-between border rounded-2xl px-3 py-2 cursor-pointer emp-select${
        selectedEmpId === e.id ? " bg-accent text-white" : ""
      }" data-empid="${e.id}">
        <span class="emp-name">${e.name} <span class="text-xs text-gray-500">(${
        e.username
      })</span></span>
        <div class="text-xs text-gray-600">S/P/K/Pa: ${e.rates.Shirt}/${
        e.rates.Pant
      }/${e.rates.Kurta}/${e.rates.Pajama}</div>
      </li>`
    )
    .join("");
  // Add click listeners to employee items
  $$(".emp-select").forEach((el) => {
    el.addEventListener("click", () => {
      selectedEmpId = el.getAttribute("data-empid");
      runGlobalSearch();
    });
  });
  // work by bill number
  let wres = work.filter((wi) => wi.billNo.toLowerCase().includes(q));
  if (selectedEmpId) {
    wres = wres.filter((wi) => wi.employeeId === selectedEmpId);
  }
  wres = wres.sort((a, b) => b.createdAt - a.createdAt);
  searchWorkList.innerHTML = wres
    .map(
      (
        r
      ) => `<li class="border rounded-2xl px-3 py-2 flex items-center justify-between">
        <span><b>${r.billNo}</b> • ${r.type} × ${r.qty}</span>
        <span class="text-xs text-gray-600">Amt: ${fmt(
          r.amount
        )} • ${formatDate(r.createdAt)}</span>
      </li>`
    )
    .join("");
}
if (clearEmpFilter) {
  clearEmpFilter.addEventListener("click", () => {
    selectedEmpId = "";
    runGlobalSearch();
  });
}
globalSearch.addEventListener("input", runGlobalSearch);

// -------- Employee Panel --------
const empWelcome = $("#empWelcome");
const billNo = $("#billNo");
const clothType = $("#clothType");
const qty = $("#qty");
const liveRate = $("#liveRate");
const liveAmount = $("#liveAmount");
const billWarn = $("#billWarn");

function currentEmployee() {
  return employees.find((e) => e.id === auth?.employeeId);
}
function currentRate() {
  const em = currentEmployee();
  if (!em) return 0;
  return Number(em.rates[clothType.value] || 0);
}
function updateLive() {
  const rate = currentRate();
  const amount = rate * Number(qty.value || 0);
  liveRate.textContent = fmt(rate);
  liveAmount.textContent = fmt(amount);
}
clothType.addEventListener("change", updateLive);
qty.addEventListener("input", updateLive);
billNo.addEventListener("input", async () => {
  await loadWork();
  const exists = work.some(
    (wi) =>
      wi.employeeId === auth?.employeeId &&
      wi.billNo.toLowerCase() === billNo.value.trim().toLowerCase()
  );
  billWarn.classList.toggle("hidden", !exists);
});

$("#workForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const em = currentEmployee();
  if (!em) return;
  const b = billNo.value.trim();
  if (!b) return alert("Bill number required");
  await loadWork();
  if (
    work.some(
      (wi) =>
        wi.employeeId === em.id && wi.billNo.toLowerCase() === b.toLowerCase()
    )
  )
    return alert("Bill number already exists for you");
  const type = clothType.value;
  const q = Number(qty.value || 0);
  const rate = Number(em.rates[type] || 0);
  const amount = rate * q;
  await saveWork({
    employeeId: em.id,
    billNo: b,
    type,
    qty: q,
    amount,
    createdAt: Date.now(),
  });
  billNo.value = "";
  qty.value = 1;
  updateLive();
  renderHistory();
  renderWorkOverview();
  alert("Work submitted!");
});

$("#refreshHistory").addEventListener("click", renderHistory);

async function renderHistory() {
  const tbody = $("#histTableBody");
  const totalCell = $("#histTotal");
  const em = currentEmployee();
  if (!em) return;
  await loadWork();
  console.log("Current employee id:", em.id);
  work.forEach((wi) =>
    console.log("Work employeeId:", wi.employeeId, "Bill:", wi.billNo)
  );
  // For debugging, show all work for current employee
  const rows = work
    .filter((wi) => wi.employeeId == em.id) // use == for loose match
    .sort(
      (a, b) =>
        normalizeCreatedAt(b.createdAt) - normalizeCreatedAt(a.createdAt)
    );
  let total = 0;
  tbody.innerHTML = rows
    .map((r) => {
      total += r.amount;
      return `
        <tr class="border-b">
          <td class="p-2">${formatDate(normalizeCreatedAt(r.createdAt))}</td>
          <td class="p-2">${r.billNo}</td>
          <td class="p-2">${r.type}</td>
          <td class="p-2 text-right">${fmt(r.qty)}</td>
          <td class="p-2 text-right">${fmt(r.amount)}</td>
        </tr>`;
    })
    .join("");
  totalCell.textContent = fmt(total);
}

// -------- Render Root --------
function render() {
  // show/hide views
  loginView.classList.toggle("hidden", !!auth);
  adminView.classList.toggle("hidden", !(auth && auth.role === "admin"));
  employeeView.classList.toggle("hidden", !(auth && auth.role === "employee"));

  if (!auth) {
    $("#loginError").classList.add("hidden");
    return;
  }

  if (auth.role === "admin") {
    $$("#adminView .tab-btn")[0].click();
    renderEmployees();
    populateRateSelect();
    renderWorkOverview();
    runGlobalSearch();
  }
  if (auth.role === "employee") {
    const em = currentEmployee();
    empWelcome.textContent = em ? `Welcome, ${em.name} (@${em.username})` : "";
    updateLive();
    renderHistory();
  }
}
// Initial render is now handled by Firebase initApp()

// -------- DOM Shortcuts --------
const loginView = $("#loginView");
const adminView = $("#adminView");
const employeeView = $("#employeeView");

// -------- Tabs (Admin) --------
$$("#adminView .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.tab;
    $$("#adminView .tab-panel").forEach((panel) =>
      panel.classList.add("hidden")
    );
    $("#tab-" + key).classList.remove("hidden");
    $$("#adminView .tab-btn").forEach((b) =>
      b.classList.remove("ring-2", "ring-accent")
    );
    btn.classList.add("ring-2", "ring-accent");
  });
});

// Hide all views by default on initial load
loginView.classList.add("hidden");
adminView.classList.add("hidden");
employeeView.classList.add("hidden");

// Ensure app loads and renders correct view on page load
initApp();
