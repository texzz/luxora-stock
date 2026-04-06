/* ════════════════════════════════════════
   LUXORA STOCK — script.js
   Login + Full stock & sales management
════════════════════════════════════════ */

/* ── AUTH ── */
const ALLOWED_USERS = {
  "tirthmewada06@gmail.com":    "DOT@#2026",
  "dhruvprajapati34340@gmail.com": "DOT@#2026",
  "chitrodaom12@gmail.com":     "DOT@#2026",
};

const NAME_MAP = {
  "tirthmewada06@gmail.com":    "TIRTH",
  "dhruvprajapati34340@gmail.com": "DHRUV",
  "chitrodaom12@gmail.com":     "OM",
};

let currentUser = null;

function attemptLogin() {
  const email    = (document.getElementById("loginEmail").value || "").trim().toLowerCase();
  const password = (document.getElementById("loginPassword").value || "").trim();
  const errEl    = document.getElementById("loginError");

  if (!email) { errEl.textContent = "Please enter your email address."; return; }
  if (!password) { errEl.textContent = "Please enter your password."; return; }

  if (!ALLOWED_USERS[email]) {
    errEl.textContent = "This email is not authorized to access the portal.";
    return;
  }
  if (ALLOWED_USERS[email] !== password) {
    errEl.textContent = "Incorrect password. Please try again.";
    return;
  }

  currentUser = email;
  sessionStorage.setItem("luxora_user", email);
  errEl.textContent = "";
  showApp();
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "";

  const name = NAME_MAP[currentUser] || currentUser;
  document.getElementById("sidebarUser").textContent = "Signed in as " + name;
  document.getElementById("saleBy").value = name;

  loadFromCache();
  renderStats();
  renderFragGrid();
  renderStockTable();
  renderCustomerTable();
  populateSaleFragSelect();
  setDefaultDate();
}

function logout() {
  sessionStorage.removeItem("luxora_user");
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginError").textContent = "";
}

function togglePw() {
  const input = document.getElementById("loginPassword");
  input.type = input.type === "password" ? "text" : "password";
}

/* ── CHECK SESSION ON LOAD ── */
document.addEventListener("DOMContentLoaded", () => {
  const saved = sessionStorage.getItem("luxora_user");
  if (saved && ALLOWED_USERS[saved]) {
    currentUser = saved;
    showApp();
  }
  /* Enter key on login */
  document.getElementById("loginPassword").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
  document.getElementById("loginEmail").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
});

/* ════ DATA STORE ════ */
let fragrances = [];
let invoices   = [];
let nextInvoice = 1;

let selectedSize     = "20";
let selectedFrag     = null;
let selectedSaleSize = null;

/* ── IMAGE MAP ── */
const FRAG_IMAGES = {
  "ARABIAN WOODY":   "arabian-woody-1.png",
  "ARMANI MY WAY":   "iconic-way-1.png",
  "BRUT":            "brut-1.png",
  "ICEBERG":         "ice-berg-1.png",
  "COOL WATER M":    "cool-water-1.png",
  "COOL WATER W":    "cool-water-1.png",
  "HAWAS ICE":       "ice-1.png",
  "DUNHILL RED":     "dunhill-red-1.png",
  "DUNHILL BLUE":    "dunhill-blue-1.png",
  "R HAWAS":         "r-hawas-1.png",
  "CHOCOLATE MUSK":  "chocolate-musk-1.png",
  "JPG MALE":        "jpg-male-1.png",
  "TOBACCO VANILLA": "tobacco-vanilla-1.png",
  "GUCCI FLORA":     "gucci-flora-1.png",
  "LV IMAGINATION":  "lv-imagination-1.png",
  "PATEL NECK":      "patel-neck-1.png",
  "ELEXIR":          "elixer-1.png",
  "MIX FRUIT":       "mix-fruit-1.png",
  "MOST WANTED":     "most-wanted-1.png",
  "LATAFA YARA":     "yara-1.png",
  "LACOSTE":         "lacoste-1.png",
  "CREED AVENTUS":   "creed-aventus-1.png",
  "RASSASI HAWAS":   "r-hawas-1.png",
};

const FRAG_EMOJIS = {
  default:"🌸", woody:"🪵", ice:"🧊", water:"💧", musk:"🌑",
  rose:"🌹", vanilla:"🍂", chocolate:"🍫", fruit:"🍑",
  flora:"🌺", tobacco:"🌿", creed:"👑", gucci:"✨",
  armani:"🎩", lacoste:"🐊", dunhill:"🟦", brut:"🔷",
  iceberg:"🏔️", hawas:"🌊", elexir:"💎", gulab:"🌹",
  mogra:"🌼", chandan:"🪵", kesar:"🟡", patel:"🌿",
  purple:"💜", yara:"⭐", imagination:"🌌", jpg:"👔",
};

function getEmoji(name) {
  const n = name.toLowerCase();
  for (const [k,v] of Object.entries(FRAG_EMOJIS)) if (n.includes(k)) return v;
  return FRAG_EMOJIS.default;
}
function getFragImg(name) {
  return FRAG_IMAGES[name] ? `assets/fragrances/${FRAG_IMAGES[name]}` : null;
}

/* ── CACHE ── */
function saveToCache() {
  localStorage.setItem("luxora_frags", JSON.stringify(fragrances));
  localStorage.setItem("luxora_invs",  JSON.stringify(invoices));
  localStorage.setItem("luxora_next",  nextInvoice);
}
function loadFromCache() {
  const f  = localStorage.getItem("luxora_frags");
  const iv = localStorage.getItem("luxora_invs");
  const ni = localStorage.getItem("luxora_next");
  if (f)  fragrances = JSON.parse(f);
  if (iv) invoices   = JSON.parse(iv);
  if (ni) nextInvoice = parseInt(ni);
  if (!f || !fragrances.length) fragrances = defaultFragrances();
  if (!iv || !invoices.length) { invoices = defaultInvoices(); nextInvoice = invoices.length + 1; }
}

/* ── DEFAULT DATA ── */
function defaultFragrances() {
  return [
    { name:"ARABIAN WOODY",   ml20:1,ml30:0,ml50:1,ml100:1 },
    { name:"ARMANI MY WAY",   ml20:0,ml30:1,ml50:1,ml100:1 },
    { name:"BRUT",            ml20:4,ml30:0,ml50:2,ml100:0 },
    { name:"ICEBERG",         ml20:2,ml30:2,ml50:1,ml100:0 },
    { name:"COOL WATER M",    ml20:2,ml30:0,ml50:2,ml100:1 },
    { name:"COOL WATER W",    ml20:2,ml30:0,ml50:1,ml100:0 },
    { name:"HAWAS ICE",       ml20:6,ml30:0,ml50:3,ml100:0 },
    { name:"DUNHILL RED",     ml20:1,ml30:0,ml50:0,ml100:1 },
    { name:"DUNHILL BLUE",    ml20:1,ml30:0,ml50:1,ml100:1 },
    { name:"R HAWAS",         ml20:4,ml30:1,ml50:1,ml100:0 },
    { name:"CHOCOLATE MUSK",  ml20:2,ml30:0,ml50:1,ml100:1 },
    { name:"JPG MALE",        ml20:2,ml30:0,ml50:2,ml100:0 },
    { name:"TOBACCO VANILLA", ml20:2,ml30:2,ml50:2,ml100:0 },
    { name:"GUCCI FLORA",     ml20:2,ml30:1,ml50:1,ml100:0 },
    { name:"LV IMAGINATION",  ml20:3,ml30:1,ml50:3,ml100:1 },
    { name:"PATEL NECK",      ml20:1,ml30:1,ml50:1,ml100:1 },
    { name:"ELEXIR",          ml20:0,ml30:0,ml50:0,ml100:1 },
    { name:"MIX FRUIT",       ml20:0,ml30:0,ml50:0,ml100:1 },
    { name:"MOST WANTED",     ml20:4,ml30:0,ml50:2,ml100:1 },
    { name:"LATAFA YARA",     ml20:2,ml30:2,ml50:1,ml100:1 },
    { name:"LACOSTE",         ml20:0,ml30:0,ml50:0,ml100:1 },
    { name:"CREED AVENTUS",   ml20:2,ml30:2,ml50:0,ml100:0 },
    { name:"RASSASI HAWAS",   ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"PURPLE MUSK",     ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"GULAB",           ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"MOGRA",           ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"KESAR CHANDAN",   ml20:0,ml30:0,ml50:0,ml100:0 },
  ];
}
function defaultInvoices() {
  return [
    {by:"",       invoiceNo:1,  customer:"-",            date:"2026-01-31", product:"SAMPLE TESTERS",              ml:8,   qty:80, price:0,    total:0,    payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:2,  customer:"SMIT",          date:"2026-01-31", product:"MOST WANTED",                 ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:3,  customer:"SMIT",          date:"2026-01-31", product:"ARMANI MY WAY",               ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:4,  customer:"ASHISH TIRTH",  date:"2026-01-31", product:"HAWAS ICE",                   ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:5,  customer:"ANKIT",         date:"2026-01-31", product:"HAWAS ICE",                   ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:6,  customer:"BHARAT",        date:"2026-01-31", product:"MOST WANTED",                 ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:7,  customer:"SONU",          date:"2026-01-31", product:"ARMANI MY WAY",               ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:8,  customer:"OM",            date:"2026-01-10", product:"LATAFA YARA",                 ml:100, qty:1,  price:0,    total:0,    payment:"",           note:"PERSONAL"},
    {by:"NAYAN",  invoiceNo:9,  customer:"NAYAN",         date:"2026-01-10", product:"LATAFA YARA",                 ml:100, qty:1,  price:0,    total:0,    payment:"",           note:"PERSONAL"},
    {by:"MUTUAL", invoiceNo:10, customer:"GAUTAM",        date:"2026-01-10", product:"ARMANI MY WAY",               ml:100, qty:1,  price:600,  total:600,  payment:"",           note:""},
    {by:"TIRTH",  invoiceNo:11, customer:"MIHIR",         date:"2026-02-01", product:"MOST WANTED",                 ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:12, customer:"RAVI",          date:"2026-02-01", product:"CREED AVENTUS",               ml:20,  qty:1,  price:500,  total:500,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:13, customer:"DHRUV",         date:"2026-02-02", product:"ICEBERG",                     ml:20,  qty:2,  price:400,  total:800,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:14, customer:"HARDIK",        date:"2026-02-03", product:"DUNHILL BLUE",                ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/CASH", note:""},
    {by:"DHRUV",  invoiceNo:15, customer:"YASH",          date:"2026-02-03", product:"COOL WATER M",                ml:50,  qty:1,  price:600,  total:600,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:16, customer:"KIRAN",         date:"2026-02-05", product:"GUCCI FLORA",                 ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:17, customer:"PRIYA",         date:"2026-02-05", product:"ARMANI MY WAY",               ml:30,  qty:1,  price:600,  total:600,  payment:"PENDING",   note:""},
    {by:"OM",     invoiceNo:18, customer:"MEET",          date:"2026-02-06", product:"R HAWAS",                     ml:20,  qty:2,  price:400,  total:800,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:19, customer:"JAYESH",        date:"2026-02-07", product:"LV IMAGINATION",              ml:50,  qty:1,  price:750,  total:750,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:20, customer:"NIKHIL",        date:"2026-02-07", product:"TOBACCO VANILLA",             ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:21, customer:"AMIT",          date:"2026-02-08", product:"BRUT",                        ml:20,  qty:3,  price:350,  total:1050, payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:22, customer:"POOJA",         date:"2026-02-09", product:"LATAFA YARA",                 ml:30,  qty:1,  price:600,  total:600,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:23, customer:"SAGAR",         date:"2026-02-10", product:"HAWAS ICE",                   ml:20,  qty:2,  price:400,  total:800,  payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:24, customer:"NEEL",          date:"2026-02-11", product:"CHOCOLATE MUSK",              ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:25, customer:"RAHUL",         date:"2026-02-12", product:"JPG MALE",                    ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:26, customer:"PARTH",         date:"2026-02-13", product:"DUNHILL RED",                 ml:20,  qty:1,  price:400,  total:400,  payment:"PENDING",   note:""},
    {by:"DHRUV",  invoiceNo:27, customer:"VIVEK",         date:"2026-02-14", product:"MOST WANTED",                 ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:28, customer:"ROHIT",         date:"2026-02-15", product:"LACOSTE",                     ml:100, qty:1,  price:950,  total:950,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:29, customer:"DEEP",          date:"2026-02-16", product:"ARABIAN WOODY",               ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/CASH", note:""},
    {by:"OM",     invoiceNo:30, customer:"JEET",          date:"2026-02-17", product:"ELEXIR",                      ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:31, customer:"KRISHNA",       date:"2026-02-18", product:"CREED AVENTUS",               ml:30,  qty:1,  price:600,  total:600,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:32, customer:"MAULIK",        date:"2026-02-19", product:"COOL WATER W",                ml:20,  qty:2,  price:380,  total:760,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:33, customer:"BHAVIN",        date:"2026-02-20", product:"R HAWAS",                     ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:34, customer:"SOHAM",         date:"2026-02-21", product:"LV IMAGINATION",              ml:30,  qty:1,  price:650,  total:650,  payment:"PENDING",   note:""},
    {by:"OM",     invoiceNo:35, customer:"ARPIT",         date:"2026-02-22", product:"TOBACCO VANILLA",             ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:36, customer:"VAIBHAV",       date:"2026-02-23", product:"GUCCI FLORA",                 ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:37, customer:"CHETAN",        date:"2026-02-24", product:"ICEBERG",                     ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/CASH", note:""},
    {by:"DHRUV",  invoiceNo:38, customer:"KARAN",         date:"2026-02-25", product:"MIX FRUIT",                   ml:100, qty:1,  price:850,  total:850,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:39, customer:"UMESH",         date:"2026-02-26", product:"HAWAS ICE",                   ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:40, customer:"NILESH",        date:"2026-02-27", product:"JPG MALE",                    ml:20,  qty:2,  price:400,  total:800,  payment:"PAID/CASH", note:""},
    {by:"OM",     invoiceNo:41, customer:"PUJAN",         date:"2026-02-28", product:"PATEL NECK",                  ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:42, customer:"VISHAL",        date:"2026-03-01", product:"MOST WANTED",                 ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:43, customer:"JAYMIN",        date:"2026-03-02", product:"ARMANI MY WAY",               ml:20,  qty:2,  price:450,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:44, customer:"DIVYESH",       date:"2026-03-03", product:"DUNHILL BLUE",                ml:20,  qty:2,  price:380,  total:760,  payment:"PENDING",   note:""},
    {by:"TIRTH",  invoiceNo:45, customer:"CHINTAN",       date:"2026-03-04", product:"LACOSTE",                     ml:50,  qty:1,  price:750,  total:750,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:46, customer:"NIMIT",         date:"2026-03-05", product:"RASSASI HAWAS",               ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:47, customer:"HARSH",         date:"2026-03-06", product:"CHOCOLATE MUSK",              ml:20,  qty:2,  price:380,  total:760,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:48, customer:"DHARMESH",      date:"2026-03-07", product:"CREED AVENTUS",               ml:20,  qty:2,  price:480,  total:960,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:49, customer:"MAYUR",         date:"2026-03-08", product:"ARABIAN WOODY",               ml:20,  qty:1,  price:400,  total:400,  payment:"PAID/CASH", note:""},
    {by:"DHRUV",  invoiceNo:50, customer:"PARESH",        date:"2026-03-09", product:"R HAWAS",                     ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:51, customer:"KAMLESH",       date:"2026-03-10", product:"BRUT",                        ml:50,  qty:2,  price:500,  total:1000, payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:52, customer:"RAJAN",         date:"2026-03-11", product:"COOL WATER M",                ml:20,  qty:1,  price:400,  total:400,  payment:"PENDING",   note:""},
    {by:"OM",     invoiceNo:53, customer:"SMIT",          date:"2026-03-12", product:"LV IMAGINATION",              ml:100, qty:1,  price:950,  total:950,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:54, customer:"TANMAY",        date:"2026-03-13", product:"ELEXIR",                      ml:50,  qty:1,  price:750,  total:750,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:55, customer:"PRIYANK",       date:"2026-03-14", product:"TOBACCO VANILLA",             ml:20,  qty:2,  price:400,  total:800,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:56, customer:"SACHIT",        date:"2026-03-15", product:"ICEBERG",                     ml:30,  qty:1,  price:500,  total:500,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:57, customer:"KARTIK",        date:"2026-03-16", product:"GUCCI FLORA",                 ml:20,  qty:1,  price:420,  total:420,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:58, customer:"DHAVAL",        date:"2026-03-17", product:"DUNHILL RED",                 ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:59, customer:"ISHAAN",        date:"2026-03-18", product:"MOST WANTED",                 ml:20,  qty:2,  price:450,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:60, customer:"SHYAM",         date:"2026-03-19", product:"JPG MALE",                    ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:61, customer:"UTSAV",         date:"2026-03-20", product:"PATEL NECK",                  ml:20,  qty:2,  price:380,  total:760,  payment:"PENDING",   note:""},
    {by:"DHRUV",  invoiceNo:62, customer:"JIGNESH",       date:"2026-03-21", product:"LATAFA YARA",                 ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:63, customer:"DEVANG",        date:"2026-03-22", product:"CHOCOLATE MUSK",              ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:64, customer:"FENIL",         date:"2026-03-23", product:"HAWAS ICE",                   ml:30,  qty:1,  price:550,  total:550,  payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:65, customer:"VIRAL",         date:"2026-03-24", product:"ARABIAN WOODY",               ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:66, customer:"HEET",          date:"2026-03-25", product:"CREED AVENTUS",               ml:50,  qty:1,  price:750,  total:750,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:67, customer:"PRANAV",        date:"2026-03-26", product:"ARMANI MY WAY",               ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:68, customer:"MANAV",         date:"2026-03-27", product:"LACOSTE",                     ml:20,  qty:1,  price:420,  total:420,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:69, customer:"ROHAN",         date:"2026-03-28", product:"R HAWAS",                     ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:70, customer:"MILAN",         date:"2026-03-29", product:"TOBACCO VANILLA",             ml:100, qty:1,  price:900,  total:900,  payment:"PAID/CASH", note:""},
    {by:"OM",     invoiceNo:71, customer:"HEMANT",        date:"2026-03-30", product:"MIX FRUIT",                   ml:50,  qty:1,  price:700,  total:700,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:72, customer:"ASHOK",         date:"2026-03-31", product:"DUNHILL BLUE",                ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:73, customer:"BHAVESH",       date:"2026-04-01", product:"MOST WANTED",                 ml:30,  qty:1,  price:600,  total:600,  payment:"PAID/SBI",  note:""},
    {by:"DHRUV",  invoiceNo:74, customer:"CHIRAG",        date:"2026-04-01", product:"JPG MALE",                    ml:100, qty:1,  price:900,  total:900,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:75, customer:"PIYUSH",        date:"2026-04-02", product:"COOL WATER W",                ml:50,  qty:1,  price:650,  total:650,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:76, customer:"DARSHAN",       date:"2026-04-02", product:"ELEXIR",                      ml:20,  qty:1,  price:450,  total:450,  payment:"PENDING",   note:""},
    {by:"OM",     invoiceNo:77, customer:"NIRMAL",        date:"2026-04-03", product:"PATEL NECK",                  ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:78, customer:"ANKUR",         date:"2026-04-03", product:"LATAFA YARA",                 ml:20,  qty:2,  price:420,  total:840,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:79, customer:"GAURAV",        date:"2026-04-04", product:"RASSASI HAWAS",               ml:20,  qty:1,  price:400,  total:400,  payment:"PAID/CASH", note:""},
    {by:"DHRUV",  invoiceNo:80, customer:"SUJAL",         date:"2026-04-04", product:"ICEBERG",                     ml:100, qty:1,  price:900,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:81, customer:"JATIN",         date:"2026-04-05", product:"BRUT",                        ml:30,  qty:2,  price:450,  total:900,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:82, customer:"PRATIK",        date:"2026-04-05", product:"HAWAS ICE",                   ml:50,  qty:2,  price:650,  total:1300, payment:"PAID/SBI",  note:""},
    {by:"OM",     invoiceNo:83, customer:"NISHANT",       date:"2026-04-06", product:"CHOCOLATE MUSK",              ml:100, qty:1,  price:900,  total:900,  payment:"PAID/CASH", note:""},
    {by:"TIRTH",  invoiceNo:84, customer:"VEDANT",        date:"2026-04-06", product:"CREED AVENTUS",               ml:30,  qty:1,  price:600,  total:600,  payment:"PAID/SBI",  note:""},
    {by:"TIRTH",  invoiceNo:85, customer:"KUSH",          date:"2026-04-06", product:"ARABIAN WOODY",               ml:30,  qty:1,  price:580,  total:580,  payment:"PAID/SBI",  note:""},
  ];
}

/* ════ NAVIGATION ════ */
function switchView(view, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");
  // sync topbar nav
  document.querySelectorAll(".topbar-nav-link").forEach(a => a.classList.remove("active"));
  const viewToIdx = {"add-stock":0,"add-sale":1,"stock-list":2,"customer-list":3};
  const idx = viewToIdx[view];
  const topLinks = document.querySelectorAll(".topbar-nav-link");
  if (topLinks[idx]) topLinks[idx].classList.add("active");
  closeSidebar();
  if (view === "stock-list")    renderStockTable();
  if (view === "customer-list") renderCustomerTable();
}

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  sb.classList.toggle("open");
  ov.classList.toggle("active");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("active");
}

/* ════ SIZE CHIPS ════ */
function selectSize(el) {
  document.querySelectorAll(".size-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  selectedSize = el.dataset.size;
  selectedFrag = null;
  document.getElementById("entryPanel").style.display = "none";
  renderFragGrid();
}

/* ════ FRAGRANCE GRID ════ */
function renderFragGrid() {
  const grid = document.getElementById("fragGrid");
  grid.innerHTML = "";

  fragrances.forEach((frag, idx) => {
    const qty = getStock(frag, selectedSize);
    const imgPath = getFragImg(frag.name);
    const card = document.createElement("div");
    card.className = "frag-card" + (selectedFrag === idx ? " selected" : "");
    card.onclick = () => selectFrag(idx);

    const imgHtml = imgPath
      ? `<img class="frag-card-img" src="${imgPath}" alt="${frag.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
         <div class="frag-card-emoji" style="display:none">${getEmoji(frag.name)}</div>`
      : `<div class="frag-card-emoji">${getEmoji(frag.name)}</div>`;

    card.innerHTML = `
      ${imgHtml}
      <div class="frag-card-name">${frag.name}</div>
      <div class="frag-stock-pill ${qty === 0 ? 'zero' : 'good'}">${qty} in stock</div>
    `;
    grid.appendChild(card);
  });
}

function getStock(frag, size) { return frag["ml" + size] || 0; }

function selectFrag(idx) {
  selectedFrag = idx;
  const frag = fragrances[idx];
  document.querySelectorAll(".frag-card").forEach((c, i) => c.classList.toggle("selected", i === idx));

  const panel = document.getElementById("entryPanel");
  panel.style.display = "block";

  document.getElementById("entryName").textContent = frag.name;
  document.getElementById("entrySize").textContent = selectedSize + " ml";
  document.getElementById("entryCurrent").textContent = "In stock: " + getStock(frag, selectedSize);
  document.getElementById("qtyInput").value = 1;
  document.getElementById("stockNote").value = "";

  const imgEl   = document.getElementById("entryImg");
  const emojiEl = document.getElementById("entryEmoji");
  const src = getFragImg(frag.name);

  if (src) {
    imgEl.src = src;
    imgEl.style.display = "block";
    emojiEl.textContent = "";
    imgEl.onerror = () => { imgEl.style.display = "none"; emojiEl.textContent = getEmoji(frag.name); };
  } else {
    imgEl.style.display = "none";
    emojiEl.textContent = getEmoji(frag.name);
  }

  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ── Add Stock ── */
function changeQty(d) {
  const inp = document.getElementById("qtyInput");
  inp.value = Math.max(1, Math.min(99, parseInt(inp.value || 1) + d));
}

function confirmAddStock() {
  if (selectedFrag === null) { showToast("Select a fragrance first", "error"); return; }
  const qty = parseInt(document.getElementById("qtyInput").value);
  if (!qty || qty < 1) { showToast("Enter a valid quantity", "error"); return; }

  const frag = fragrances[selectedFrag];
  frag["ml" + selectedSize] = (frag["ml" + selectedSize] || 0) + qty;

  saveToCache();
  renderFragGrid();
  renderStats();
  selectFrag(selectedFrag);
  showToast(`Added ${qty} × ${frag.name} (${selectedSize}ml)`, "success");
}

/* ════ SALE SYSTEM ════ */
function setDefaultDate() {
  document.getElementById("saleDate").value = new Date().toISOString().split("T")[0];
}

function toggleWaNotice() {
  const phone = (document.getElementById("salePhone").value || "").trim();
  const notice = document.getElementById("waNotice");
  if (notice) notice.style.display = phone.length >= 10 ? "flex" : "none";
}

function populateSaleFragSelect() {
  const sel = document.getElementById("saleFragrance");
  sel.innerHTML = '<option value="">— Select Fragrance —</option>';
  fragrances.forEach(f => {
    const o = document.createElement("option");
    o.value = f.name; o.textContent = f.name;
    sel.appendChild(o);
  });
}

function selectSalePill(el) {
  document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  selectedSaleSize = el.dataset.sz;
  updateSalePreview();
}

function updateSalePreview() {
  const name = document.getElementById("saleFragrance").value;
  const box  = document.getElementById("saleStockPreview");
  if (!name || !selectedSaleSize) { box.style.display = "none"; return; }
  const frag = fragrances.find(f => f.name === name);
  if (!frag) { box.style.display = "none"; return; }
  document.getElementById("saleStockVal").textContent = getStock(frag, selectedSaleSize) + " bottles";
  box.style.display = "flex";
  updateSaleSummary();
}

function changeSaleQty(d) {
  const inp = document.getElementById("saleQty");
  inp.value = Math.max(1, parseInt(inp.value || 1) + d);
  updateSaleSummary();
}

function updateSaleSummary() {
  const qty   = parseInt(document.getElementById("saleQty").value) || 0;
  const price = parseFloat(document.getElementById("salePrice").value) || 0;
  const bar   = document.getElementById("saleTotalBar");
  if (qty > 0 && price > 0) {
    bar.style.display = "flex";
    document.getElementById("summaryTotal").textContent = "₹" + (qty * price).toLocaleString("en-IN");
  } else {
    bar.style.display = "none";
  }
}

function confirmSale() {
  const by       = (document.getElementById("saleBy").value || "").trim().toUpperCase();
  const customer = (document.getElementById("saleCustomer").value || "").trim().toUpperCase();
  const phone    = (document.getElementById("salePhone").value || "").trim().replace(/\s+/g,"");
  const date     = document.getElementById("saleDate").value;
  const product  = document.getElementById("saleFragrance").value;
  const payment  = document.getElementById("salePayment").value;
  const note     = (document.getElementById("saleNote").value || "").trim().toUpperCase();
  const qty      = parseInt(document.getElementById("saleQty").value) || 1;
  const price    = parseFloat(document.getElementById("salePrice").value) || 0;
  const ml       = selectedSaleSize ? parseInt(selectedSaleSize) : null;

  if (!customer) { showToast("Enter customer name", "error"); return; }
  if (!product)  { showToast("Select a fragrance", "error"); return; }
  if (!ml)       { showToast("Select a bottle size", "error"); return; }

  const frag = fragrances.find(f => f.name === product);
  if (frag) {
    const key = "ml" + ml;
    const cur = frag[key] || 0;
    if (cur < qty) showToast(`⚠ Only ${cur} in stock — recorded anyway`, "error");
    frag[key] = Math.max(0, cur - qty);
  }

  const total = qty * price;
  const inv = { by, invoiceNo: nextInvoice++, customer, phone, date, product, ml, qty, price, total, payment, note };
  invoices.push(inv);
  saveToCache();

  renderStats(); renderStockTable(); renderCustomerTable(); renderFragGrid();

  // ── WhatsApp Message ──
  if (phone) {
    const dateStr = date
      ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "Today";

    const msg =
`Hello ${customer},

Your order has been placed successfully! Here are your order details:

Product: ${product}
Size: ${ml}ml
Quantity: ${qty}
Price per bottle: ₹${price.toLocaleString("en-IN")}
Total Amount: ₹${total.toLocaleString("en-IN")}
Date: ${dateStr}
Payment: ${payment}
Invoice #: ${inv.invoiceNo}
${note ? `Note: ${note}` : ""}
To confirm your order, please reply with *YES*.

Thank you for choosing *Luxora*`;

    // Normalize phone: add India code if not present
    let waPhone = phone.replace(/[^0-9]/g, "");
    if (waPhone.length === 10) waPhone = "91" + waPhone;
    else if (waPhone.startsWith("0")) waPhone = "91" + waPhone.slice(1);

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    setTimeout(() => window.open(waUrl, "_blank"), 400);
    showToast(`Invoice #${inv.invoiceNo} recorded — Opening WhatsApp…`, "success");
  } else {
    showToast(`Invoice #${inv.invoiceNo} recorded — ₹${total.toLocaleString("en-IN")}`, "success");
  }

  // Reset
  document.getElementById("saleCustomer").value  = "";
  document.getElementById("salePhone").value     = "";
  document.getElementById("salePrice").value     = "";
  document.getElementById("saleQty").value       = 1;
  document.getElementById("saleNote").value      = "";
  document.getElementById("saleFragrance").value = "";
  document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
  selectedSaleSize = null;
  document.getElementById("saleStockPreview").style.display = "none";
  document.getElementById("saleTotalBar").style.display     = "none";
  setDefaultDate();
}

/* ════ STATS ════ */
function renderStats() {
  const total = fragrances.reduce((s,f) => s + f.ml20 + f.ml30 + f.ml50 + f.ml100, 0);
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statFrags").textContent = fragrances.length;
  document.getElementById("statSales").textContent = invoices.length;
}

/* ════ STOCK TABLE ════ */
function renderStockTable() {
  const q = (document.getElementById("stockSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("stockTbody");
  tbody.innerHTML = "";

  fragrances.filter(f => f.name.toLowerCase().includes(q)).forEach(frag => {
    const total = frag.ml20 + frag.ml30 + frag.ml50 + frag.ml100;
    let sc = "good", st = "In Stock";
    if (total === 0)    { sc = "out"; st = "Out of Stock"; }
    else if (total <=3) { sc = "low"; st = "Low Stock"; }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-name">${frag.name}</td>
      <td>${frag.ml20}</td><td>${frag.ml30}</td><td>${frag.ml50}</td><td>${frag.ml100}</td>
      <td class="col-num">${total}</td>
      <td><span class="status-badge ${sc}">${st}</span></td>
    `;
    tbody.appendChild(tr);
  });

  /* Totals row */
  const t = fragrances.reduce((a,f) => ({ml20:a.ml20+f.ml20,ml30:a.ml30+f.ml30,ml50:a.ml50+f.ml50,ml100:a.ml100+f.ml100}),{ml20:0,ml30:0,ml50:0,ml100:0});
  const tr = document.createElement("tr");
  tr.className = "tfoot-row";
  tr.innerHTML = `<td class="col-name">TOTAL</td><td>${t.ml20}</td><td>${t.ml30}</td><td>${t.ml50}</td><td>${t.ml100}</td><td class="col-num">${t.ml20+t.ml30+t.ml50+t.ml100}</td><td></td>`;
  tbody.appendChild(tr);
}

/* ════ CUSTOMER TABLE ════ */
function renderCustomerTable() {
  const q = (document.getElementById("custSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("custTbody");
  tbody.innerHTML = "";

  const filtered = invoices.filter(iv =>
    (iv.customer||"").toLowerCase().includes(q) ||
    (iv.product||"").toLowerCase().includes(q) ||
    (iv.by||"").toLowerCase().includes(q)
  );

  const totalRevenue = filtered.reduce((s,iv) => s + (iv.total||0), 0);
  const chip = document.getElementById("revChip");
  if (chip) chip.textContent = "Total: ₹" + totalRevenue.toLocaleString("en-IN");

  filtered.forEach(iv => {
    const dateStr = iv.date
      ? new Date(iv.date).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"2-digit"})
      : "—";

    const isPersonal = (iv.note||"").includes("PERSONAL") || (iv.payment||"").includes("PERSONAL");
    const payClass = !iv.payment ? "pending" : isPersonal ? "personal" : "paid";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-num">${iv.invoiceNo}</td>
      <td>${iv.by || "—"}</td>
      <td class="col-name">${iv.customer || "—"}</td>
      <td style="white-space:nowrap">${dateStr}</td>
      <td>${iv.product || "—"}</td>
      <td>${iv.ml || "—"}ml</td>
      <td>${iv.qty || "—"}</td>
      <td>₹${(iv.price||0).toLocaleString("en-IN")}</td>
      <td class="col-total">₹${(iv.total||0).toLocaleString("en-IN")}</td>
      <td><span class="pay-tag ${payClass}">${iv.payment || "PENDING"}</span></td>
      <td style="color:var(--text3);font-size:0.78rem">${iv.note || ""}</td>
      <td>
        <button class="delete-sale-btn" onclick="deleteSale(${iv.invoiceNo})" title="Delete this sale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ════ EXPORT ════ */
function exportAllExcel() {
  const wb = XLSX.utils.book_new();

  /* ── Sheet 1: STOCK ── */
  const sData = [
    ["STOCK LIST","","","","","",""],
    ["","","","","","",""],
    ["","NAME","QUANTITY IN STOCK","","","","TOTAL QTY"],
    ["","","20 ML","30 ML","50 ML","100 ML",""],
    ["","","","","","",""],
  ];
  fragrances.forEach(f => {
    const tot = f.ml20+f.ml30+f.ml50+f.ml100;
    sData.push(["",f.name,f.ml20,f.ml30,f.ml50,f.ml100,tot]);
  });
  const t = fragrances.reduce((a,f)=>({ml20:a.ml20+f.ml20,ml30:a.ml30+f.ml30,ml50:a.ml50+f.ml50,ml100:a.ml100+f.ml100}),{ml20:0,ml30:0,ml50:0,ml100:0});
  sData.push(["","TOTAL",t.ml20,t.ml30,t.ml50,t.ml100,t.ml20+t.ml30+t.ml50+t.ml100]);
  const sws = XLSX.utils.aoa_to_sheet(sData);
  sws["!cols"] = [{wch:4},{wch:22},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10}];
  XLSX.utils.book_append_sheet(wb, sws, "STOCK REPORT");

  /* ── Sheet 2: CUSTOMERS / SALES ── */
  const cData = [
    ["INVOICES","","","","","","","","","","",""],
    ["LUXORA","","","","","","","","","","",""],
    ["","","","","","","","",4000,"","",""],
    ["BY ORDER","Invoice #","CUSTOMER","Invoice Date","PRODUCT","Tax Rate","ML","QTY","PRICE","Invoice Total","PAYMENT","NOTE"],
  ];
  invoices.forEach(iv => cData.push([
    iv.by||"", iv.invoiceNo, iv.customer||"", iv.date||"",
    iv.product||"", 0, iv.ml||"", iv.qty||1,
    iv.price||0, iv.total||0, iv.payment||"", iv.note||""
  ]));
  const totalAll = invoices.reduce((s,iv)=>s+(iv.total||0),0);
  cData.push(["","Totals","","","","","","","",totalAll,"",""]);
  const cws = XLSX.utils.aoa_to_sheet(cData);
  cws["!cols"] = [{wch:14},{wch:10},{wch:18},{wch:14},{wch:26},{wch:8},{wch:6},{wch:6},{wch:8},{wch:14},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, cws, "SALES");

  /* ── Save single file ── */
  XLSX.writeFile(wb, "LUXORA_REPORT.xlsx");
  showToast("Excel exported — Stock & Customers included!", "success");
}

/* ════ DELETE SALE ════ */
function deleteSale(invoiceNo) {
  if (!confirm(`Delete Invoice #${invoiceNo}? This will restore the stock.`)) return;

  const idx = invoices.findIndex(iv => iv.invoiceNo === invoiceNo);
  if (idx === -1) { showToast("Sale not found", "error"); return; }

  const iv = invoices[idx];

  // Restore stock
  const frag = fragrances.find(f => f.name === iv.product);
  if (frag && iv.ml && iv.qty) {
    const key = "ml" + iv.ml;
    if (frag[key] !== undefined) frag[key] += iv.qty;
  }

  invoices.splice(idx, 1);
  saveToCache();
  renderStats();
  renderStockTable();
  renderCustomerTable();
  renderFragGrid();
  showToast(`Invoice #${invoiceNo} deleted & stock restored`, "success");
}

/* ════ TOAST ════ */
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}