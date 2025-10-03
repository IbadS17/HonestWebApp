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
  try {
    // Show loading view initially
    const loadingView = $("#loadingView");
    const appShell = $("#appShell");

    // Load data first
    await loadEmployees();
    await loadWork();

    // Hide loading and show app
    if (loadingView) loadingView.style.display = "none";
    if (appShell) appShell.classList.remove("hidden");

    render();
  } catch (error) {
    console.error("App initialization error:", error);
    showToast(
      "Failed to load app data. Please check Firebase configuration.",
      "error"
    );

    // Hide loading and show app even if error occurs
    const loadingView = $("#loadingView");
    const appShell = $("#appShell");
    if (loadingView) loadingView.style.display = "none";
    if (appShell) appShell.classList.remove("hidden");

    // Show login view if there's an error
    render();
  }
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
let woPage = 1;
let woPageSize = 10;
const woPrev = document.getElementById("woPrev");
const woNext = document.getElementById("woNext");
const woPageInfo = document.getElementById("woPageInfo");
const woPageSizeSelect = document.getElementById("woPageSize");

function renderWorkOverview() {
  const q = woFilter.value.trim().toLowerCase();
  const enriched = work
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
  // Reset page if current page beyond length
  const totalRows = enriched.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / woPageSize));
  if (woPage > totalPages) woPage = totalPages;
  if (woPage < 1) woPage = 1;
  const start = (woPage - 1) * woPageSize;
  const pageRows = enriched.slice(start, start + woPageSize);

  // Render rows
  let pageTotal = 0;
  woTableBody.innerHTML = pageRows
    .map((r) => {
      pageTotal += r.amount;
      return `<tr class="border-b">
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
  // Overall total (not just page)
  const overallTotal = enriched.reduce((sum, r) => sum + r.amount, 0);
  woTotal.textContent = fmt(overallTotal);
  // Page info
  if (woPageInfo)
    woPageInfo.textContent = `Page ${woPage} / ${totalPages} (${totalRows} rows)`;
  if (woPrev) woPrev.disabled = woPage <= 1;
  if (woNext) woNext.disabled = woPage >= totalPages;
}

woFilter.addEventListener("input", () => {
  woPage = 1;
  renderWorkOverview();
});
clearWO.addEventListener("click", () => {
  woFilter.value = "";
  woPage = 1;
  renderWorkOverview();
});
if (woPrev)
  woPrev.addEventListener("click", () => {
    if (woPage > 1) {
      woPage--;
      renderWorkOverview();
    }
  });
if (woNext)
  woNext.addEventListener("click", () => {
    woPage++;
    renderWorkOverview();
  });
if (woPageSizeSelect)
  woPageSizeSelect.addEventListener("change", (e) => {
    woPageSize = Number(e.target.value) || 10;
    woPage = 1;
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

let searchWorkPage = 1;
let searchWorkPageSize = 10;
const gsPrev = document.getElementById("gsPrev");
const gsNext = document.getElementById("gsNext");
const gsPageInfo = document.getElementById("gsPageInfo");
const gsPageSize = document.getElementById("gsPageSize");

function runGlobalSearch() {
  const q = globalSearch.value.trim().toLowerCase();
  const selectedEmpIdLocal = selectedEmpId || "";
  // employees
  const emps = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
  );
  searchEmpList.innerHTML = emps
    .map(
      (
        e
      ) => `<li class="flex items-center justify-between border rounded-2xl px-3 py-2 cursor-pointer emp-select${
        selectedEmpIdLocal === e.id ? " bg-accent text-white" : ""
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
  $$(".emp-select").forEach((el) => {
    el.addEventListener("click", () => {
      selectedEmpId = el.getAttribute("data-empid");
      searchWorkPage = 1;
      runGlobalSearch();
    });
  });
  // work filtered
  let wres = work.filter((wi) => wi.billNo.toLowerCase().includes(q));
  if (selectedEmpIdLocal) {
    wres = wres.filter((wi) => wi.employeeId === selectedEmpIdLocal);
  }
  wres = wres.sort((a, b) => b.createdAt - a.createdAt);
  const totalRows = wres.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / searchWorkPageSize));
  if (searchWorkPage > totalPages) searchWorkPage = totalPages;
  if (searchWorkPage < 1) searchWorkPage = 1;
  const start = (searchWorkPage - 1) * searchWorkPageSize;
  const pageRows = wres.slice(start, start + searchWorkPageSize);
  searchWorkList.innerHTML = pageRows
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
  if (gsPageInfo)
    gsPageInfo.textContent = `Page ${searchWorkPage} / ${totalPages} (${totalRows} bills)`;
  if (gsPrev) gsPrev.disabled = searchWorkPage <= 1;
  if (gsNext) gsNext.disabled = searchWorkPage >= totalPages;
}

if (gsPrev)
  gsPrev.addEventListener("click", () => {
    if (searchWorkPage > 1) {
      searchWorkPage--;
      runGlobalSearch();
    }
  });
if (gsNext)
  gsNext.addEventListener("click", () => {
    searchWorkPage++;
    runGlobalSearch();
  });
if (gsPageSize)
  gsPageSize.addEventListener("change", (e) => {
    searchWorkPageSize = Number(e.target.value) || 10;
    searchWorkPage = 1;
    runGlobalSearch();
  });
// Reset page on global search input
if (globalSearch)
  globalSearch.addEventListener("input", () => {
    searchWorkPage = 1;
    runGlobalSearch();
  });
if (clearEmpFilter)
  clearEmpFilter.addEventListener("click", () => {
    selectedEmpId = "";
    searchWorkPage = 1;
    runGlobalSearch();
  });

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
  // No uniqueness check needed for bill number
  billWarn.classList.add("hidden");
});

$("#workForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const em = currentEmployee();
  if (!em) return;
  const b = billNo.value.trim();
  if (!b) return showToast("Bill number required", "error");
  const type = clothType.value;
  const q = Number(qty.value);
  const rate = Number(em.rates[type] || 0);
  const amt = q * rate;
  await loadWork();
  // Only update if billNo, type, employee, and rate are all the same
  let existing = work.find(
    (wi) =>
      wi.employeeId === em.id &&
      wi.billNo.toLowerCase() === b.toLowerCase() &&
      wi.type === type &&
      wi.rate === rate
  );
  if (existing) {
    // Update quantity and amount
    const newQty = Number(existing.qty) + q;
    const newAmt = newQty * rate;
    await db.collection("work").doc(existing.id).update({
      qty: newQty,
      amount: newAmt,
      createdAt: Date.now(),
    });
    showToast("Updated existing entry!", "success");
  } else {
    // Add new entry
    await db.collection("work").add({
      employeeId: em.id,
      billNo: b,
      type,
      qty: q,
      rate,
      amount: amt,
      createdAt: Date.now(),
    });
    showToast("Work submitted!", "success");
  }
  billNo.value = "";
  qty.value = 1;
  updateLive();
  renderHistory();
  renderWorkOverview();
});

$("#refreshHistory").addEventListener("click", renderHistory);

let histPage = 1;
let histPageSize = 10;
const histPrev = document.getElementById("histPrev");
const histNext = document.getElementById("histNext");
const histPageInfo = document.getElementById("histPageInfo");
const histPageSizeSelect = document.getElementById("histPageSize");

async function renderHistory() {
  const tbody = document.getElementById("histTableBody");
  const totalCell = document.getElementById("histTotal");
  const em = currentEmployee();
  if (!em) return;
  await loadWork();
  const rowsAll = work
    .filter((wi) => wi.employeeId == em.id)
    .sort(
      (a, b) =>
        normalizeCreatedAt(b.createdAt) - normalizeCreatedAt(a.createdAt)
    );
  const totalOverall = rowsAll.reduce((sum, r) => sum + r.amount, 0);
  // Pagination calculations
  const totalRows = rowsAll.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / histPageSize));
  if (histPage > totalPages) histPage = totalPages;
  if (histPage < 1) histPage = 1;
  const start = (histPage - 1) * histPageSize;
  const pageRows = rowsAll.slice(start, start + histPageSize);
  // Render page rows
  let pageTotal = 0;
  tbody.innerHTML = pageRows
    .map((r) => {
      pageTotal += r.amount;
      const isAdj = r.isAdjustment;
      const amtClass = isAdj
        ? r.amount < 0
          ? "text-red-600 font-semibold"
          : "text-green-600 font-semibold"
        : "";
      const actionBtns = isAdj
        ? `<div class='flex gap-1 ml-2'>
            <button data-edit-adj="${r.id}" class="px-2 py-0.5 text-xs rounded-2xl bg-gray-200">Edit</button>
            <button data-del-adj="${r.id}" class="px-2 py-0.5 text-xs rounded-2xl bg-red-500 text-white">Del</button>
          </div>`
        : "";
      return `<tr class="border-b ${isAdj ? "bg-yellow-50" : ""}">
        <td class="p-2">${formatDate(normalizeCreatedAt(r.createdAt))}</td>
        <td class="p-2">${r.billNo}</td>
        <td class="p-2">${r.type}${isAdj ? " (Adj)" : ""}</td>
        <td class="p-2 text-right">${fmt(r.qty)}</td>
        <td class="p-2 text-right ${amtClass}">${fmt(
        r.amount
      )}${actionBtns}</td>
      </tr>`;
    })
    .join("");
  // Bind adjustment action buttons
  tbody.querySelectorAll("[data-edit-adj]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-adj");
      editAdjustment(id);
    });
  });
  tbody.querySelectorAll("[data-del-adj]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-adj");
      deleteAdjustment(id);
    });
  });
  totalCell.textContent = fmt(totalOverall);
  if (histPageInfo)
    histPageInfo.textContent = `Page ${histPage} / ${totalPages} (${totalRows} entries)`;
  if (histPrev) histPrev.disabled = histPage <= 1;
  if (histNext) histNext.disabled = histPage >= totalPages;
}
if (histPrev)
  histPrev.addEventListener("click", () => {
    if (histPage > 1) {
      histPage--;
      renderHistory();
    }
  });
if (histNext)
  histNext.addEventListener("click", () => {
    histPage++;
    renderHistory();
  });
if (histPageSizeSelect)
  histPageSizeSelect.addEventListener("change", (e) => {
    histPageSize = Number(e.target.value) || 10;
    histPage = 1;
    renderHistory();
  });

// -------- Adjustment Modal Logic --------
const adjustmentModal = document.getElementById("adjustmentModal");
const openAdjustment = document.getElementById("openAdjustment");
const closeAdjustment = document.getElementById("closeAdjustment");
const cancelAdjustment = document.getElementById("cancelAdjustment");
const adjustmentForm = document.getElementById("adjustmentForm");
const adjReason = document.getElementById("adjReason");
const adjAmount = document.getElementById("adjAmount");
const adjustmentModalTitle = document.getElementById("adjustmentModalTitle");

// Editing state for adjustments
let editingAdjustmentId = null;
function resetAdjustmentEditingState() {
  editingAdjustmentId = null;
  if (adjustmentModalTitle) adjustmentModalTitle.textContent = "Add Adjustment";
}

function showAdjustment(open = true) {
  if (!adjustmentModal) return;
  if (open) {
    adjustmentModal.classList.remove("hidden");
    adjustmentModal.classList.add("flex");
    setTimeout(() => adjReason && adjReason.focus(), 10);
  } else {
    adjustmentModal.classList.add("hidden");
    adjustmentModal.classList.remove("flex");
    adjustmentForm?.reset();
    resetAdjustmentEditingState();
  }
}
openAdjustment?.addEventListener("click", () => showAdjustment(true));
closeAdjustment?.addEventListener("click", () => showAdjustment(false));
cancelAdjustment?.addEventListener("click", () => showAdjustment(false));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !adjustmentModal.classList.contains("hidden"))
    showAdjustment(false);
});

adjustmentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const em = currentEmployee();
  if (!em) return showToast("Not logged in", "error");
  let raw = (adjAmount.value || "").trim();
  if (!raw) {
    showToast("Amount required", "error");
    return;
  }
  // Determine sign
  let sign = 1;
  if (raw.startsWith("-")) {
    sign = -1;
    raw = raw.substring(1).trim();
  }
  // Remove + if present
  if (raw.startsWith("+")) raw = raw.substring(1).trim();
  const numeric = Number(raw);
  if (isNaN(numeric) || numeric <= 0) {
    showToast("Enter a valid positive number", "error");
    return;
  }
  const finalAmount = numeric * sign;
  const reason = (adjReason.value || "").trim() || "Adjustment";
  // Confirm negative adjustments
  if (finalAmount < 0) {
    const proceed = confirm(
      `This will deduct ${Math.abs(finalAmount)} from your total. Continue?`
    );
    if (!proceed) return;
  }
  if (editingAdjustmentId) {
    try {
      await db.collection("work").doc(editingAdjustmentId).update({
        type: reason,
        rate: finalAmount,
        amount: finalAmount,
      });
      showToast("Adjustment updated", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update adjustment", "error");
      return;
    }
  } else {
    // Store as a work entry with a special type and billNo pattern
    await db.collection("work").add({
      employeeId: em.id,
      billNo: "ADJ-" + Date.now(),
      type: reason,
      qty: 1,
      rate: finalAmount, // store raw adjustment in rate field for reference
      amount: finalAmount,
      createdAt: Date.now(),
      isAdjustment: true,
    });
    showToast("Adjustment saved", "success");
  }
  showAdjustment(false);
  renderHistory();
  renderWorkOverview();
  runGlobalSearch();
});

async function editAdjustment(id) {
  try {
    const doc = await db.collection("work").doc(id).get();
    if (!doc.exists) return showToast("Adjustment not found", "error");
    const data = doc.data();
    if (!data.isAdjustment) return showToast("Not an adjustment", "error");
    editingAdjustmentId = id;
    if (adjustmentModalTitle)
      adjustmentModalTitle.textContent = "Edit Adjustment";
    if (adjReason) adjReason.value = data.type || "Adjustment";
    if (adjAmount) adjAmount.value = data.amount; // negative preserved automatically
    showAdjustment(true);
  } catch (err) {
    console.error(err);
    showToast("Failed to load adjustment", "error");
  }
}

async function deleteAdjustment(id) {
  if (!confirm("Delete this adjustment?")) return;
  try {
    await db.collection("work").doc(id).delete();
    showToast("Adjustment deleted", "success");
    renderHistory();
    renderWorkOverview();
    runGlobalSearch();
  } catch (err) {
    console.error(err);
    showToast("Delete failed", "error");
  }
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

// Keyboard shortcuts for pagination
window.addEventListener("keydown", (e) => {
  const overviewTabActive =
    document.getElementById("tab-overview") &&
    !document.getElementById("tab-overview").classList.contains("hidden");
  const searchTabActive =
    document.getElementById("tab-search") &&
    !document.getElementById("tab-search").classList.contains("hidden");
  const employeeViewActive =
    document.getElementById("employeeView") &&
    !document.getElementById("employeeView").classList.contains("hidden");
  if (!overviewTabActive && !searchTabActive && !employeeViewActive) return;
  if (e.target && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName))
    return;
  if (e.key === "ArrowLeft") {
    if (overviewTabActive && woPage > 1) {
      woPage--;
      renderWorkOverview();
    }
    if (searchTabActive && searchWorkPage > 1) {
      searchWorkPage--;
      runGlobalSearch();
    }
    if (employeeViewActive && histPage > 1) {
      histPage--;
      renderHistory();
    }
  } else if (e.key === "ArrowRight") {
    if (overviewTabActive) {
      const q = woFilter.value.trim().toLowerCase();
      const totalPages = Math.max(
        1,
        Math.ceil(
          work.filter((wi) => {
            const empName = (
              employees.find((e) => e.id === wi.employeeId)?.name || ""
            ).toLowerCase();
            return (
              !q ||
              empName.includes(q) ||
              wi.billNo.toLowerCase().includes(q) ||
              wi.type.toLowerCase().includes(q)
            );
          }).length / woPageSize
        )
      );
      if (woPage < totalPages) {
        woPage++;
        renderWorkOverview();
      }
    }
    if (searchTabActive) {
      const q2 = globalSearch.value.trim().toLowerCase();
      let wres = work.filter((wi) => wi.billNo.toLowerCase().includes(q2));
      if (selectedEmpId)
        wres = wres.filter((wi) => wi.employeeId === selectedEmpId);
      const totalPages2 = Math.max(
        1,
        Math.ceil(wres.length / searchWorkPageSize)
      );
      if (searchWorkPage < totalPages2) {
        searchWorkPage++;
        runGlobalSearch();
      }
    }
    if (employeeViewActive) {
      const em = currentEmployee();
      if (em) {
        const rowsAll = work.filter((wi) => wi.employeeId == em.id);
        const totalPagesH = Math.max(
          1,
          Math.ceil(rowsAll.length / histPageSize)
        );
        if (histPage < totalPagesH) {
          histPage++;
          renderHistory();
        }
      }
    }
  }
});
