/* ════════════════════════════════════════════════════════════
   LUXORA STOCK — script.js  (final)
   Firebase · fragrance icon ⚱️💨 · custom dropdowns & date picker
   · Add / Remove Fragrance
════════════════════════════════════════════════════════════ */

/* ───────── AUTH ───────── */
const ALLOWED_USERS = {
  "tirthmewada06@gmail.com":       "DOT@#2026",
  "dhruvprajapati34340@gmail.com": "DOT@#2026",
  "chitrodaom12@gmail.com":        "DOT@#2026",
};

const NAME_MAP = {
  "tirthmewada06@gmail.com":       "TIRTH",
  "dhruvprajapati34340@gmail.com": "DHRUV",
  "chitrodaom12@gmail.com":        "OM",
};

let currentUser      = null;
let fragrances       = [];
let invoices         = [];
let nextInvoice      = 1;
let selectedSize     = "20";
let selectedFrag     = null;
let selectedSaleSize = null;
let saleCart         = [];

/* Firebase refs */
let db, collection, getDocs, doc, setDoc, deleteDoc, addDoc,
    onSnapshot, query, orderBy, getDoc, updateDoc;

/* Filter state */
let currentMonthFilter = "";
let currentSearchQuery = "";

/* Active view state */
let activeView = "view-add-stock";

/* ───────── WAIT FOR FIREBASE ───────── */
window.addEventListener("firebase-ready", () => {
  db         = window.firebaseDB;
  collection = window.firebaseCollection;
  getDocs    = window.firebaseGetDocs;
  doc        = window.firebaseDoc;
  setDoc     = window.firebaseSetDoc;
  deleteDoc  = window.firebaseDeleteDoc;
  addDoc     = window.firebaseAddDoc;
  onSnapshot = window.firebaseOnSnapshot;
  query      = window.firebaseQuery;
  orderBy    = window.firebaseOrderBy;
  getDoc     = window.firebaseGetDoc;
  updateDoc  = window.firebaseUpdateDoc;
});

function waitForFirebase() {
  return new Promise(resolve => {
    if (window.firebaseInitialized) return resolve();
    const iv = setInterval(() => {
      if (window.firebaseInitialized) { clearInterval(iv); resolve(); }
    }, 50);
  });
}

/* ════════════════════════════════════════════════════════════
   FIREBASE DATA OPERATIONS
════════════════════════════════════════════════════════════ */
async function loadDataFromFirebase() {
  try {
    const fragsSnap = await getDocs(collection(db, "fragrances"));
    if (!fragsSnap.empty) {
      fragrances = [];
      fragsSnap.forEach(d => fragrances.push({ id: d.id, ...d.data() }));
      fragrances.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else {
      fragrances = defaultFragrances();
      await seedFragrancesToFirebase();
    }

    const invSnap = await getDocs(collection(db, "invoices"));
    if (!invSnap.empty) {
      invoices = [];
      invSnap.forEach(d => invoices.push({ id: d.id, ...d.data() }));
      invoices.sort((a, b) => a.invoiceNo - b.invoiceNo);
      nextInvoice = Math.max(...invoices.map(i => i.invoiceNo), 0) + 1;
    } else {
      invoices = defaultInvoices();
      await seedInvoicesToFirebase();
      nextInvoice = invoices.length + 1;
    }

    const metaSnap = await getDocs(collection(db, "meta"));
    let hasMeta = false;
    metaSnap.forEach(d => {
      if (d.id === "app") { nextInvoice = d.data().nextInvoice || nextInvoice; hasMeta = true; }
    });
    if (!hasMeta) await setDoc(doc(db, "meta", "app"), { nextInvoice });

    renderAll();
  } catch (err) {
    console.error("loadDataFromFirebase:", err);
    showToast("Error loading data from cloud", "error");
  }
}

async function seedFragrancesToFirebase() {
  for (const frag of fragrances) {
    const { id, ...rest } = frag;
    const ref = await addDoc(collection(db, "fragrances"), rest);
    const idx = fragrances.findIndex(f => f.name === frag.name && !f.id);
    if (idx !== -1) fragrances[idx].id = ref.id;
  }
}

async function seedInvoicesToFirebase() {
  for (const inv of invoices) {
    const { id, ...rest } = inv;
    await addDoc(collection(db, "invoices"), rest);
  }
}

/* Update a single fragrance doc by id — fast, no scans */
async function updateFragranceInFirebase(frag) {
  if (!frag || !frag.id) {
    const { id, ...rest } = frag || {};
    const ref = await addDoc(collection(db, "fragrances"), rest);
    frag.id = ref.id;
    return;
  }
  const { id, ...rest } = frag;
  await setDoc(doc(db, "fragrances", id), rest, { merge: true });
}

async function addInvoiceToFirebase(invoice) {
  const { id, ...rest } = invoice;
  await addDoc(collection(db, "invoices"), rest);
  await setDoc(doc(db, "meta", "app"), { nextInvoice });
}

async function updateInvoiceInFirebase(invoiceNo, updatedData) {
  const snap = await getDocs(collection(db, "invoices"));
  for (const d of snap.docs) {
    if (d.data().invoiceNo === invoiceNo) {
      const { id, ...rest } = updatedData;
      await setDoc(doc(db, "invoices", d.id), rest);
      break;
    }
  }
}

async function deleteInvoiceFromFirebase(invoiceNo) {
  const snap = await getDocs(collection(db, "invoices"));
  for (const d of snap.docs) {
    if (d.data().invoiceNo === invoiceNo) {
      await deleteDoc(doc(db, "invoices", d.id));
      break;
    }
  }
}

/* ───────── REAL-TIME LISTENERS ───────── */
let fragUnsub = null;
let invUnsub  = null;

function setupRealtimeListeners() {
  if (fragUnsub) fragUnsub();
  if (invUnsub)  invUnsub();

  fragUnsub = onSnapshot(collection(db, "fragrances"), snap => {
    if (snap.empty) return;
    fragrances = [];
    snap.forEach(d => fragrances.push({ id: d.id, ...d.data() }));
    fragrances.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderActiveView();
    renderStats();
    populateSaleFragSelect();
    populateMonthFilter();
  });

  invUnsub = onSnapshot(collection(db, "invoices"), snap => {
    if (snap.empty) return;
    invoices = [];
    snap.forEach(d => invoices.push({ id: d.id, ...d.data() }));
    invoices.sort((a, b) => a.invoiceNo - b.invoiceNo);
    nextInvoice = Math.max(...invoices.map(i => i.invoiceNo), 0) + 1;
    renderActiveView();
    renderStats();
    populateMonthFilter();
    restoreFilterState();
  });
}

function restoreFilterState() {
  const monthSel = document.getElementById("custMonthFilter");
  const searchIn = document.getElementById("custSearch");
  if (monthSel && currentMonthFilter) monthSel.value = currentMonthFilter;
  if (searchIn  && currentSearchQuery !== undefined) searchIn.value = currentSearchQuery;
  if (activeView === "view-customer-list") renderCustomerTable();
}

function renderActiveView() {
  if (activeView === "view-add-stock")          renderFragGrid();
  else if (activeView === "view-add-sale")      renderCart();
  else if (activeView === "view-stock-list")    renderStockTable();
  else if (activeView === "view-customer-list") renderCustomerTable();
}

function renderAll() {
  renderStats();
  renderFragGrid();
  renderStockTable();
  populateMonthFilter();
  renderCustomerTable();
  populateSaleFragSelect();
}

/* ───────── DEFAULT DATA ───────── */
function defaultFragrances() {
  return [
    { name:"ARABIAN WOODY",   ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"ARMANI MY WAY",   ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"BRUT",            ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"ICEBERG",         ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"COOL WATER M",    ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"COOL WATER W",    ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"ICE",             ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"DUNHILL RED",     ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"DUNHILL BLUE",    ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"R HAWAS",         ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"CHOCOLATE MUSK",  ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"JPG MALE",        ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"TOBACCO VANILLA", ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"GUCCI FLORA",     ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"LV IMAGINATION",  ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"PATEL NECK",      ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"ELEXIR",          ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"MIX FRUIT",       ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"MOST WANTED",     ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"YARA",            ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"LACOSTE",         ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"CREED AVENTUS",   ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"PURPLE MUSK",     ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"GULAB",           ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"MOGRA",           ml20:0, ml30:0, ml50:0, ml100:0 },
    { name:"KESAR CHANDAN",   ml20:0, ml30:0, ml50:0, ml100:0 }
  ];
}

function defaultInvoices() {
  return [
    { by:"", invoiceNo:1, customer:"-", phone:"", date:"2026-01-31", product:"SAMPLE TESTERS", ml:8, qty:80, price:0, total:0, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:2, customer:"SMIT", phone:"", date:"2026-01-31", product:"MOST WANTED", ml:100, qty:1, price:900, total:900, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:3, customer:"SMIT", phone:"", date:"2026-01-31", product:"ARMANI MY WAY", ml:100, qty:1, price:900, total:900, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:4, customer:"ASHISH TIRTH", phone:"", date:"2026-01-31", product:"HAWAS ICE / FOREST AQUA", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:5, customer:"ANKIT", phone:"", date:"2026-01-31", product:"HAWAS ICE / FOREST AQUA", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:6, customer:"BHARAT", phone:"", date:"2026-01-31", product:"MOST WANTED", ml:50, qty:1, price:700, total:700, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:7, customer:"SONU", phone:"", date:"2026-01-31", product:"ARMANI MY WAY", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"OM", invoiceNo:8, customer:"OM", phone:"", date:"2026-01-10", product:"LATAFA YARA", ml:100, qty:1, price:0, total:0, payment:"PERSONAL", note:"PERSONAL"},
    { by:"NAYAN", invoiceNo:9, customer:"NAYAN", phone:"", date:"2026-01-10", product:"LATAFA YARA", ml:100, qty:1, price:0, total:0, payment:"PERSONAL", note:"PERSONAL"},
    { by:"MUTUAL", invoiceNo:10, customer:"GAUTAM", phone:"", date:"2026-01-10", product:"ARMANI MY WAY / ICONIC WAY", ml:100, qty:1, price:600, total:600, payment:"", note:""},
    { by:"NAYAN", invoiceNo:11, customer:"SWATI", phone:"", date:"2026-01-31", product:"MIX FRUIT", ml:20, qty:1, price:0, total:0, payment:"PAID/SBI", note:"PERSONAL"},
    { by:"MUTUAL", invoiceNo:12, customer:"SUJAL", phone:"", date:"2026-02-12", product:"MOST WANTED", ml:20, qty:1, price:180, total:180, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:13, customer:"BHAVESH", phone:"", date:"2026-02-16", product:"HAWAS ICE / FOREST AQUA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:14, customer:"BHAVESH", phone:"", date:"2026-02-16", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:15, customer:"MONICA", phone:"", date:"2026-02-16", product:"COOL WATER", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:16, customer:"YASH", phone:"", date:"2026-02-16", product:"LATAFA YARA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"NAYAN", invoiceNo:17, customer:"AKASH", phone:"", date:"2026-02-16", product:"RASSASI HAWAS", ml:20, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"NAYAN", invoiceNo:18, customer:"SWATI", phone:"", date:"2026-02-16", product:"RASSASI HAWAS", ml:100, qty:1, price:450, total:450, payment:"PAID/SBI", note:""},
    { by:"NAYAN", invoiceNo:19, customer:"SWATI", phone:"", date:"2026-02-16", product:"ELEXIR", ml:100, qty:1, price:450, total:450, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:20, customer:"SUJAL", phone:"", date:"2026-02-17", product:"LATAFA YARA", ml:20, qty:1, price:180, total:180, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:21, customer:"RINKU", phone:"", date:"2026-02-19", product:"PURPLE MUSK", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:22, customer:"RINKU", phone:"", date:"2026-02-19", product:"RASSASI HAWAS", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:23, customer:"SANJAY", phone:"", date:"2026-02-19", product:"MOST WANTED", ml:30, qty:1, price:400, total:400, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:24, customer:"SANJAY", phone:"", date:"2026-02-19", product:"MIX FRUIT", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:25, customer:"JAY", phone:"", date:"2026-02-19", product:"MIX FRUIT", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"NAYAN", invoiceNo:26, customer:"NAYAN", phone:"", date:"2026-02-19", product:"MIX FRUIT", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:27, customer:"TIRTH", phone:"", date:"2026-02-20", product:"LATAFA YARA", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:"PERSONAL"},
    { by:"TIRTH", invoiceNo:28, customer:"TIRTH", phone:"", date:"2026-02-20", product:"ARMANI MY WAY", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:"PERSONAL"},
    { by:"TIRTH", invoiceNo:29, customer:"JYOTI", phone:"", date:"2026-02-20", product:"ELEXIR", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:30, customer:"HARSHAD", phone:"", date:"2026-02-21", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:31, customer:"HARSHAD", phone:"", date:"2026-02-21", product:"HAWAS ICE / FOREST AQUA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:32, customer:"HARSHAD", phone:"", date:"2026-02-21", product:"LACOSTE", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:33, customer:"ASHISH", phone:"", date:"2026-02-21", product:"CREED AVENTUS", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:34, customer:"ASHISH", phone:"", date:"2026-02-26", product:"CREED AVENTUS", ml:100, qty:1, price:900, total:900, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:35, customer:"KHUSHBOO", phone:"", date:"2026-02-26", product:"MIX FRUIT", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:36, customer:"KHUSHBOO", phone:"", date:"2026-02-26", product:"MOGRA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:37, customer:"VIJAY", phone:"", date:"2026-02-26", product:"GULAB", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:38, customer:"VIJAY", phone:"", date:"2026-02-26", product:"MOGRA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:39, customer:"AASTHA", phone:"", date:"2026-02-26", product:"GULAB", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:40, customer:"AASTHA", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:41, customer:"MONICA JAMES", phone:"", date:"2026-02-26", product:"COOL WATER", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:42, customer:"MONICA JAMES", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:43, customer:"FORAM MONICA", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:44, customer:"PALLAVI MONICA", phone:"", date:"2026-02-26", product:"LV IMAGINATION", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:45, customer:"MINALMONICA", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:46, customer:"BHARAT MONICA", phone:"", date:"2026-02-26", product:"COOL WATER", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:47, customer:"GAURAV MONICA", phone:"", date:"2026-02-26", product:"CHOCOLATE MUSK", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:48, customer:"MONICA JINAL", phone:"", date:"2026-02-26", product:"LV IMAGINATION", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:49, customer:"MONICA JINAL", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"OM", invoiceNo:50, customer:"JAINIL", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:1, price:150, total:150, payment:"", note:""},
    { by:"TIRTH", invoiceNo:51, customer:"TIRTH", phone:"", date:"2026-02-26", product:"LACOSTE", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:52, customer:"TIRTH", phone:"", date:"2026-02-26", product:"LATAFA YARA", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:53, customer:"TIRTH", phone:"", date:"2026-02-26", product:"LATAFA YARA", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:54, customer:"SANJAY DHRUV", phone:"", date:"2026-02-27", product:"MOST WANTED", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:55, customer:"GAUTAM", phone:"", date:"2026-02-26", product:"RASSASI HAWAS", ml:20, qty:2, price:600, total:1200, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:56, customer:"GAUTAM", phone:"", date:"2026-02-26", product:"MOST WANTED", ml:20, qty:2, price:600, total:1200, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:57, customer:"SUJAL", phone:"", date:"2026-02-26", product:"HAWAS ICE / FOREST AQUA", ml:20, qty:2, price:400, total:800, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:58, customer:"SUJAL", phone:"", date:"2026-02-26", product:"ELEXIR", ml:20, qty:1, price:190, total:190, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:59, customer:"MONICA JAMES", phone:"", date:"2026-03-05", product:"LACOSTE", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:60, customer:"MONICA JAMES", phone:"", date:"2026-03-05", product:"LATAFA YARA", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:61, customer:"MONICA JESAL", phone:"", date:"2026-03-10", product:"COOL WATER", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"BNI", invoiceNo:62, customer:"MUKUND", phone:"", date:"2026-03-07", product:"RASSASI HAWAS", ml:30, qty:1, price:400, total:400, payment:"PAID/SBI", note:""},
    { by:"BNI", invoiceNo:63, customer:"MUKUND", phone:"", date:"2026-03-07", product:"LATAFA YARA", ml:20, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:64, customer:"TIRTH", phone:"", date:"2026-03-13", product:"LATAFA YARA", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:65, customer:"TIRTH", phone:"", date:"2026-03-13", product:"LATAFA YARA", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:66, customer:"TIRTH", phone:"", date:"2026-03-13", product:"CHOCOLATE MUSK", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:67, customer:"TIRTH", phone:"", date:"2026-03-13", product:"LACOSTE", ml:30, qty:1, price:150, total:150, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:68, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"CREED AVENTUS", ml:50, qty:1, price:700, total:700, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:69, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"DUNHILL RED", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:70, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"KESAR CHANDAN", ml:20, qty:1, price:400, total:400, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:71, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"ARABIAN WOODY", ml:20, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:72, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"LACOSTE", ml:20, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"CHEF THE PARTE", invoiceNo:73, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"ARMANI MY WAY / ICONIC WAY", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:74, customer:"KRISHNA PATHAK", phone:"", date:"2026-03-13", product:"HAWAS ICE / FOREST AQUA", ml:100, qty:1, price:750, total:750, payment:"PAID/SBI", note:""},
    { by:"MUTUAL", invoiceNo:75, customer:"KRISHNA PATHAK", phone:"", date:"2026-03-13", product:"COOL WATER", ml:20, qty:1, price:200, total:200, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:76, customer:"NILESH PATEL", phone:"", date:"2026-03-13", product:"TOMFORD TOBACCO VANILLA", ml:20, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:77, customer:"HARSHAD", phone:"", date:"2026-03-13", product:"CHOCOLATE MUSK", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:78, customer:"MONICA", phone:"", date:"2026-03-13", product:"MOST WANTED", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:79, customer:"MONICA", phone:"", date:"2026-03-16", product:"LV IMAGINATION", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:80, customer:"HARSH", phone:"", date:"2026-03-16", product:"MOST WANTED", ml:20, qty:1, price:300, total:300, payment:"PAID/CASH", note:""},
    { by:"TIRTH", invoiceNo:81, customer:"HARSH", phone:"", date:"2026-03-16", product:"DUNHILL RED", ml:30, qty:1, price:350, total:350, payment:"PAID/CASH", note:""},
    { by:"TIRTH", invoiceNo:82, customer:"HARSH", phone:"", date:"2026-03-16", product:"COOL WATER WOMEN", ml:30, qty:1, price:350, total:350, payment:"PAID/CASH", note:""},
    { by:"TIRTH", invoiceNo:83, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"COOL WATER", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:84, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"ARABIAN WOODY", ml:30, qty:1, price:400, total:400, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:85, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"COOL WATER WOMEN", ml:20, qty:1, price:250, total:250, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:86, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"MOST WANTED", ml:20, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:87, customer:"KRISH", phone:"", date:"2026-03-22", product:"CHOCOLATE MUSK", ml:50, qty:1, price:500, total:500, payment:"", note:""},
    { by:"TIRTH", invoiceNo:88, customer:"ARVIND", phone:"", date:"2026-03-22", product:"LACOSTE", ml:30, qty:1, price:350, total:350, payment:"PAID/CASH", note:""},
    { by:"TIRTH", invoiceNo:89, customer:"SANDEEP", phone:"", date:"2026-03-24", product:"LACOSTE", ml:50, qty:1, price:650, total:650, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:90, customer:"SANDEEP", phone:"", date:"2026-03-24", product:"RASSASI HAWAS", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:91, customer:"DHRUV", phone:"", date:"2026-03-17", product:"GUCCI FLORA", ml:30, qty:1, price:300, total:300, payment:"PAID/SBI", note:""},
    { by:"DHRUV", invoiceNo:92, customer:"MONICA", phone:"", date:"2026-04-01", product:"ELEXIR", ml:50, qty:1, price:500, total:500, payment:"", note:""},
    { by:"TIRTH", invoiceNo:93, customer:"SMIT", phone:"", date:"2026-04-06", product:"CREED AVENTUS", ml:30, qty:1, price:350, total:350, payment:"PAID/SBI", note:""},
    { by:"TIRTH", invoiceNo:94, customer:"HIMAY", phone:"", date:"2026-04-07", product:"MOST WANTED", ml:50, qty:1, price:500, total:500, payment:"PAID/SBI", note:"MIX & MATCH"},
    { by:"TIRTH", invoiceNo:95, customer:"HIMAY", phone:"", date:"2026-04-07", product:"ICE BERG", ml:50, qty:1, price:500, total:500, payment:"PAID/SBI", note:"MIX & MATCH"},
  ];
}

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
function attemptLogin() {
  const email    = (document.getElementById("loginEmail").value || "").trim().toLowerCase();
  const password = (document.getElementById("loginPassword").value || "").trim();
  const errEl    = document.getElementById("loginError");

  if (!email)                           { errEl.textContent = "Please enter your email address."; return; }
  if (!password)                        { errEl.textContent = "Please enter your password."; return; }
  if (!ALLOWED_USERS[email])            { errEl.textContent = "This email is not authorized to access the portal."; return; }
  if (ALLOWED_USERS[email] !== password){ errEl.textContent = "Incorrect password. Please try again."; return; }

  currentUser = email;
  sessionStorage.setItem("luxora_user", email);
  errEl.textContent = "";
  showApp();
}

async function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "";

  const name = NAME_MAP[currentUser] || currentUser;
  document.getElementById("sidebarUser").textContent = "Signed in as " + name;
  document.getElementById("saleBy").value = name;

  await waitForFirebase();
  await loadDataFromFirebase();
  setupRealtimeListeners();
  setDefaultDate();
  resetSaleForm();
  enhanceAllSelects(document);
}

function logout() {
  sessionStorage.removeItem("luxora_user");
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginError").textContent = "";
  if (fragUnsub) { fragUnsub(); fragUnsub = null; }
  if (invUnsub)  { invUnsub();  invUnsub  = null; }
}

function togglePw() {
  const i = document.getElementById("loginPassword");
  i.type = i.type === "password" ? "text" : "password";
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = sessionStorage.getItem("luxora_user");
  if (saved && ALLOWED_USERS[saved]) {
    currentUser = saved;
    showApp();
  }
  document.getElementById("loginPassword").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
  document.getElementById("loginEmail").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
});

/* ════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════ */
function switchView(view, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById("view-" + view);
  if (target) target.classList.add("active");
  activeView = "view-" + view;

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");

  document.querySelectorAll(".topbar-nav-link").forEach(a => a.classList.remove("active"));
  const tl = document.querySelector(`.topbar-nav-link[data-view="${view}"]`);
  if (tl) tl.classList.add("active");

  closeSidebar();

  if (view === "stock-list")    renderStockTable();
  if (view === "customer-list") renderCustomerTable();
  if (view === "add-sale")      { resetSaleForm(); populateSaleFragSelect(); }
  if (view === "add-stock")     renderFragGrid();

  enhanceAllSelects(document);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("active");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("active");
}

/* ════════════════════════════════════════════════════════════
   ADD STOCK — grid (⚱️💨 fragrance icon)
════════════════════════════════════════════════════════════ */
function selectSize(el) {
  document.querySelectorAll("#view-add-stock .size-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  selectedSize = el.dataset.size;
  selectedFrag = null;
  document.getElementById("entryPanel").style.display = "none";
  renderFragGrid();
}

function getStock(frag, size) { return frag["ml" + size] || 0; }

function renderFragGrid() {
  const grid = document.getElementById("fragGrid");
  if (!grid) return;
  grid.innerHTML = "";

  /* "+ New Fragrance" card first */
  const newCard = document.createElement("div");
  newCard.className = "frag-card frag-card-new";
  newCard.onclick = openNewFragranceModal;
  newCard.innerHTML = `
    <div class="frag-card-new-icon">＋</div>
    <div class="frag-card-name">New Fragrance</div>
  `;
  grid.appendChild(newCard);

  fragrances.forEach((frag, idx) => {
    const qty = getStock(frag, selectedSize);
    const card = document.createElement("div");
    card.className = "frag-card" + (selectedFrag === idx ? " selected" : "");
    card.onclick = () => selectFrag(idx);

    card.innerHTML = `
      <button class="frag-card-remove" title="Remove fragrance"
              onclick="event.stopPropagation();openRemoveFragranceModal(${idx})">✕</button>
      <div class="frag-emoji" aria-hidden="true">⚱️💨</div>
      <div class="frag-card-name">${escapeHtml(frag.name)}</div>
      <div class="frag-stock-pill ${qty === 0 ? "zero" : "good"}">${qty} in stock</div>
    `;
    grid.appendChild(card);
  });
}

function selectFrag(idx) {
  selectedFrag = idx;
  const frag = fragrances[idx];
  document.querySelectorAll("#fragGrid .frag-card").forEach((c, i) => {
    c.classList.toggle("selected", i - 1 === idx);
  });

  const panel = document.getElementById("entryPanel");
  panel.style.display = "block";

  document.getElementById("entryName").textContent    = frag.name;
  document.getElementById("entrySize").textContent    = selectedSize + " ml";
  document.getElementById("entryCurrent").textContent = "In stock: " + getStock(frag, selectedSize);
  document.getElementById("qtyInput").value = 1;
  document.getElementById("stockNote").value = "";

  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function changeQty(d) {
  const inp = document.getElementById("qtyInput");
  inp.value = Math.max(1, Math.min(99, parseInt(inp.value || 1) + d));
}

async function confirmAddStock() {
  if (selectedFrag === null) { showToast("Select a fragrance first", "error"); return; }
  const qty = parseInt(document.getElementById("qtyInput").value);
  if (!qty || qty < 1) { showToast("Enter a valid quantity", "error"); return; }

  const frag = fragrances[selectedFrag];
  frag["ml" + selectedSize] = (frag["ml" + selectedSize] || 0) + qty;

  try {
    await updateFragranceInFirebase(frag);
    showToast(`Added ${qty} × ${frag.name} (${selectedSize}ml)`, "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to save stock", "error");
  }
}

/* ════════════════════════════════════════════════════════════
   NEW FRAGRANCE / REMOVE FRAGRANCE
════════════════════════════════════════════════════════════ */
let pendingRemoveIdx = null;

function openNewFragranceModal() {
  document.getElementById("newFragName").value = "";
  document.getElementById("newFrag20").value   = "0";
  document.getElementById("newFrag30").value   = "0";
  document.getElementById("newFrag50").value   = "0";
  document.getElementById("newFrag100").value  = "0";
  document.getElementById("newFragranceModal").style.display = "flex";
  setTimeout(() => document.getElementById("newFragName").focus(), 60);
}

function closeNewFragranceModal() {
  document.getElementById("newFragranceModal").style.display = "none";
}

async function saveNewFragrance() {
  const name = (document.getElementById("newFragName").value || "").trim().toUpperCase();
  if (!name) { showToast("Enter a fragrance name", "error"); return; }

  const exists = fragrances.some(f => (f.name || "").toUpperCase() === name);
  if (exists) { showToast(`"${name}" already exists`, "error"); return; }

  const frag = {
    name,
    ml20:  Math.max(0, parseInt(document.getElementById("newFrag20").value)  || 0),
    ml30:  Math.max(0, parseInt(document.getElementById("newFrag30").value)  || 0),
    ml50:  Math.max(0, parseInt(document.getElementById("newFrag50").value)  || 0),
    ml100: Math.max(0, parseInt(document.getElementById("newFrag100").value) || 0),
    createdAt: Date.now(),
    createdBy: NAME_MAP[currentUser] || currentUser || ""
  };

  try {
    const ref = await addDoc(collection(db, "fragrances"), frag);
    frag.id = ref.id;
    fragrances.push(frag);
    closeNewFragranceModal();
    showToast(`Created "${name}" ✅`, "success");
    renderFragGrid();
    renderStockTable();
    populateSaleFragSelect();
    renderStats();
  } catch (err) {
    console.error(err);
    showToast("Create failed: " + err.message, "error");
  }
}

function openRemoveFragranceModal(idx) {
  const frag = fragrances[idx];
  if (!frag) return;
  pendingRemoveIdx = idx;
  document.getElementById("removeFragName").textContent = frag.name;
  document.getElementById("removeFragranceModal").style.display = "flex";
}

function closeRemoveFragranceModal() {
  document.getElementById("removeFragranceModal").style.display = "none";
  pendingRemoveIdx = null;
}

async function confirmRemoveFragrance() {
  if (pendingRemoveIdx === null) return;
  const frag = fragrances[pendingRemoveIdx];
  if (!frag) { closeRemoveFragranceModal(); return; }

  try {
    if (frag.id) await deleteDoc(doc(db, "fragrances", frag.id));
    fragrances.splice(pendingRemoveIdx, 1);
    selectedFrag = null;
    document.getElementById("entryPanel").style.display = "none";
    closeRemoveFragranceModal();
    showToast(`Removed "${frag.name}"`, "success");
    renderFragGrid();
    renderStockTable();
    populateSaleFragSelect();
    renderStats();
  } catch (err) {
    console.error(err);
    showToast("Delete failed: " + err.message, "error");
  }
}

/* ════════════════════════════════════════════════════════════
   NEW SALE — cart
════════════════════════════════════════════════════════════ */
function setDefaultDate() {
  const el = document.getElementById("saleDate");
  if (el) el.value = new Date().toISOString().split("T")[0];
}

function toggleWaNotice() {
  const phone  = (document.getElementById("salePhone").value || "").trim();
  const notice = document.getElementById("waNotice");
  if (notice) notice.style.display = phone.length >= 10 ? "flex" : "none";
}

function populateSaleFragSelect() {
  const sel = document.getElementById("saleFragrance");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Select Fragrance —</option>';
  fragrances.forEach(f => {
    const o = document.createElement("option");
    o.value = f.name;
    o.textContent = f.name;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;
  refreshCSelectLabel(sel);
}

function selectSalePill(el) {
  document.querySelectorAll("#view-add-sale .size-pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  selectedSaleSize = el.dataset.sz;
  updateSalePreview();
}

function updateSalePreview() {
  const name = document.getElementById("saleFragrance").value;
  const box  = document.getElementById("saleStockPreview");
  if (!name || !selectedSaleSize) { if (box) box.style.display = "none"; return; }
  const frag = fragrances.find(f => f.name === name);
  if (!frag) { if (box) box.style.display = "none"; return; }
  document.getElementById("saleStockVal").textContent = getStock(frag, selectedSaleSize) + " bottles";
  if (box) box.style.display = "flex";
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
  if (qty > 0 && price > 0 && bar) {
    bar.style.display = "flex";
    document.getElementById("summaryTotal").textContent = "₹" + (qty * price).toLocaleString("en-IN");
  } else if (bar) {
    bar.style.display = "none";
  }
}

function resetSaleForm() {
  saleCart = [];
  renderCart();
  document.getElementById("saleCustomer").value  = "";
  document.getElementById("salePhone").value     = "";
  document.getElementById("salePrice").value     = "";
  document.getElementById("saleQty").value       = "1";
  document.getElementById("saleNote").value      = "";
  document.getElementById("saleFragrance").value = "";
  document.querySelectorAll("#view-add-sale .size-pill").forEach(p => p.classList.remove("active"));
  selectedSaleSize = null;
  const preview = document.getElementById("saleStockPreview");
  if (preview) preview.style.display = "none";
  const totalBar = document.getElementById("saleTotalBar");
  if (totalBar) totalBar.style.display = "none";
  const cartSection = document.getElementById("cartSection");
  if (cartSection) cartSection.style.display = "none";
  setDefaultDate();
  refreshCSelectLabel(document.getElementById("saleFragrance"));
}

function addToCart() {
  const product = document.getElementById("saleFragrance").value;
  const ml      = selectedSaleSize ? parseInt(selectedSaleSize) : null;
  const qty     = parseInt(document.getElementById("saleQty").value) || 1;
  const price   = parseFloat(document.getElementById("salePrice").value) || 0;

  if (!product) { showToast("Select a fragrance", "error"); return; }
  if (!ml)      { showToast("Select a bottle size", "error"); return; }
  if (qty < 1)  { showToast("Enter valid quantity", "error"); return; }
  if (price <= 0) { showToast("Enter valid price per bottle", "error"); return; }

  const frag = fragrances.find(f => f.name === product);
  if (frag) {
    const currentStock = getStock(frag, ml);
    if (currentStock < qty) {
      showToast(`⚠ Only ${currentStock} in stock for ${product} (${ml}ml)`, "error");
    }
  }

  saleCart.push({
    id: Date.now() + Math.random(),
    product, ml, qty, price,
    total: qty * price
  });

  document.getElementById("saleFragrance").value = "";
  document.querySelectorAll("#view-add-sale .size-pill").forEach(p => p.classList.remove("active"));
  selectedSaleSize = null;
  document.getElementById("saleQty").value   = "1";
  document.getElementById("salePrice").value = "";
  const preview = document.getElementById("saleStockPreview");
  if (preview) preview.style.display = "none";
  const totalBar = document.getElementById("saleTotalBar");
  if (totalBar) totalBar.style.display = "none";
  refreshCSelectLabel(document.getElementById("saleFragrance"));

  renderCart();
  showToast(`Added ${product} (${ml}ml) ×${qty} to cart`, "success");
}

function renderCart() {
  const cartSection  = document.getElementById("cartSection");
  const cartItemsDiv = document.getElementById("cartItems");

  if (saleCart.length === 0) {
    if (cartSection) cartSection.style.display = "none";
    return;
  }
  if (cartSection) cartSection.style.display = "block";
  document.getElementById("cartCount").textContent = saleCart.length;

  let html = "";
  let grand = 0;
  saleCart.forEach((item, idx) => {
    grand += item.total;
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.product)}</div>
          <div class="cart-item-meta">${item.ml}ml × ${item.qty} @ ₹${item.price.toLocaleString("en-IN")}</div>
        </div>
        <div class="cart-item-total">₹${item.total.toLocaleString("en-IN")}</div>
        <button class="cart-remove-btn" onclick="removeFromCart(${idx})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>`;
  });
  html += `
    <div class="cart-item" style="background:rgba(184,146,42,0.08);border-top:1px solid rgba(184,146,42,0.2);">
      <div class="cart-item-info"><strong>GRAND TOTAL</strong></div>
      <div class="cart-item-total" style="font-size:1.2rem;">₹${grand.toLocaleString("en-IN")}</div>
      <div style="width:28px"></div>
    </div>`;
  cartItemsDiv.innerHTML = html;
}

function removeFromCart(idx) {
  saleCart.splice(idx, 1);
  renderCart();
}

async function confirmSale() {
  if (saleCart.length === 0) { showToast("Cart is empty! Add at least one fragrance", "error"); return; }

  const by       = (document.getElementById("saleBy").value || "").trim().toUpperCase();
  const customer = (document.getElementById("saleCustomer").value || "").trim().toUpperCase();
  const phone    = (document.getElementById("salePhone").value || "").trim().replace(/\s+/g, "");
  const date     = document.getElementById("saleDate").value;
  const payment  = document.getElementById("salePayment").value;
  const note     = (document.getElementById("saleNote").value || "").trim().toUpperCase();

  if (!customer) { showToast("Enter customer name", "error"); return; }

  const allInvoices = [];
  let grandTotal = 0;
  const waMessages = [];

  for (const item of saleCart) {
    const total = item.qty * item.price;
    grandTotal += total;

    const frag = fragrances.find(f => f.name === item.product);
    if (frag) {
      const key = "ml" + item.ml;
      const cur = frag[key] || 0;
      if (cur < item.qty) {
        showToast(`⚠ Only ${cur} in stock for ${item.product} (${item.ml}ml) — recorded anyway`, "error");
      }
      frag[key] = Math.max(0, cur - item.qty);
      await updateFragranceInFirebase(frag);
    }

    const inv = {
      by,
      invoiceNo: nextInvoice++,
      customer, phone, date,
      product: item.product,
      ml: item.ml,
      qty: item.qty,
      price: item.price,
      total,
      payment, note
    };
    await addInvoiceToFirebase(inv);
    allInvoices.push(inv);

    if (phone) {
      waMessages.push(`- ${item.product} (${item.ml}ml): ${item.qty} × ₹${item.price.toLocaleString("en-IN")} = ₹${total.toLocaleString("en-IN")}`);
    }
  }

  if (phone && waMessages.length > 0) {
    const dateStr = date
      ? new Date(date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
      : "Today";

    const msg = `Hello ${customer},

Your order has been placed successfully! Here are your order details:

${waMessages.join("\n")}

*Grand Total:* ₹${grandTotal.toLocaleString("en-IN")}
*Date:* ${dateStr}
*Payment:* ${payment}
*Invoice #s:* ${allInvoices.map(i => i.invoiceNo).join(", ")}
${note ? `*Note:* ${note}` : ""}

Thank you for choosing *Luxora*`;

    let waPhone = phone.replace(/[^0-9]/g, "");
    if (waPhone.length === 10) waPhone = "91" + waPhone;
    else if (waPhone.startsWith("0")) waPhone = "91" + waPhone.slice(1);

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    setTimeout(() => window.open(waUrl, "_blank"), 400);
    showToast(`${saleCart.length} item(s) recorded — Opening WhatsApp…`, "success");
  } else {
    showToast(`${saleCart.length} item(s) recorded — ₹${grandTotal.toLocaleString("en-IN")}`, "success");
  }

  resetSaleForm();
}

/* ════════════════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════════════════ */
function renderStats() {
  const total = fragrances.reduce((s, f) => s + (f.ml20||0) + (f.ml30||0) + (f.ml50||0) + (f.ml100||0), 0);
  const tEl = document.getElementById("statTotal");
  const fEl = document.getElementById("statFrags");
  const sEl = document.getElementById("statSales");
  if (tEl) tEl.textContent = total;
  if (fEl) fEl.textContent = fragrances.length;
  if (sEl) sEl.textContent = invoices.length;
}

/* ════════════════════════════════════════════════════════════
   STOCK TABLE
════════════════════════════════════════════════════════════ */
function renderStockTable() {
  const q     = (document.getElementById("stockSearch")?.value || "").toLowerCase();
  const tbody = document.getElementById("stockTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  fragrances.filter(f => (f.name||"").toLowerCase().includes(q)).forEach((frag) => {
    const total = (frag.ml20||0) + (frag.ml30||0) + (frag.ml50||0) + (frag.ml100||0);
    let sc = "good", st = "In Stock";
    if (total === 0) { sc = "out"; st = "Out of Stock"; }
    else if (total <= 3) { sc = "low"; st = "Low Stock"; }

    const realIdx = fragrances.indexOf(frag);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-name">${escapeHtml(frag.name)}</td>
      <td>${frag.ml20||0}</td>
      <td>${frag.ml30||0}</td>
      <td>${frag.ml50||0}</td>
      <td>${frag.ml100||0}</td>
      <td class="col-num">${total}</td>
      <td><span class="status-badge ${sc}">${st}</span></td>
      <td style="white-space:nowrap">
        <button class="delete-sale-btn" onclick="openRemoveFragranceModal(${realIdx})" title="Remove fragrance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const t = fragrances.reduce((a, f) => ({
    ml20:  a.ml20  + (f.ml20||0),
    ml30:  a.ml30  + (f.ml30||0),
    ml50:  a.ml50  + (f.ml50||0),
    ml100: a.ml100 + (f.ml100||0)
  }), { ml20:0, ml30:0, ml50:0, ml100:0 });

  const tr = document.createElement("tr");
  tr.className = "tfoot-row";
  tr.innerHTML = `<td class="col-name">TOTAL</td><td>${t.ml20}</td><td>${t.ml30}</td><td>${t.ml50}</td><td>${t.ml100}</td><td class="col-num">${t.ml20+t.ml30+t.ml50+t.ml100}</td><td></td><td></td>`;
  tbody.appendChild(tr);
}

/* ════════════════════════════════════════════════════════════
   CUSTOMER TABLE
════════════════════════════════════════════════════════════ */
function populateMonthFilter() {
  const sel = document.getElementById("custMonthFilter");
  if (!sel) return;

  const prev = sel.value;
  const months = [...new Set(
    invoices.filter(iv => iv.date).map(iv => iv.date.slice(0,7))
  )].sort().reverse();

  sel.innerHTML = '<option value="">All Months</option>';
  months.forEach(ym => {
    const [y, m] = ym.split("-");
    const label = new Date(y, m-1, 1).toLocaleDateString("en-IN", { month:"long", year:"numeric" });
    const opt = document.createElement("option");
    opt.value = ym;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  if (prev) sel.value = prev;
  else if (!currentMonthFilter) {
    const nowYM = new Date().toISOString().slice(0,7);
    if (months.includes(nowYM)) sel.value = nowYM;
  }
  refreshCSelectLabel(sel);
}

function renderCustomerTable() {
  const q     = (document.getElementById("custSearch")?.value || "").toLowerCase();
  const month = document.getElementById("custMonthFilter")?.value || "";

  currentSearchQuery = q;
  currentMonthFilter = month;

  const tbody = document.getElementById("custTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...invoices].sort((a, b) => a.invoiceNo - b.invoiceNo);
  const filtered = sorted.filter(iv => {
    const matchQ = (iv.customer||"").toLowerCase().includes(q) ||
                   (iv.product||"").toLowerCase().includes(q) ||
                   (iv.by||"").toLowerCase().includes(q);
    const matchM = !month || (iv.date && iv.date.startsWith(month));
    return matchQ && matchM;
  });

  const totalRevenue   = filtered.reduce((s, iv) => s + (iv.total||0), 0);
  const pendingRevenue = filtered.reduce((s, iv) => {
    const isPending = !iv.payment || iv.payment.toUpperCase() === "PENDING";
    return s + (isPending ? (iv.total||0) : 0);
  }, 0);

  const chip = document.getElementById("revChip");
  if (chip) chip.innerHTML = `<span class="total-amount">Total: ₹${totalRevenue.toLocaleString("en-IN")}</span> | <span class="pending-amount">Pending: ₹${pendingRevenue.toLocaleString("en-IN")}</span>`;

  filtered.forEach(iv => {
    const dateStr = iv.date
      ? new Date(iv.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" })
      : "—";

    const isPersonal = (iv.note||"").includes("PERSONAL") || (iv.payment||"").includes("PERSONAL");
    const isPaid     = iv.payment && (iv.payment.toUpperCase() === "PAID/SBI" || iv.payment.toUpperCase() === "PAID/CASH");

    let payClass = "pending";
    if (isPersonal) payClass = "personal";
    else if (isPaid) payClass = "paid";

    const payText = iv.payment || "PENDING";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-num">${iv.invoiceNo}</td>
      <td>${escapeHtml(iv.by || "—")}</td>
      <td class="col-name">${escapeHtml(iv.customer || "—")}</td>
      <td style="white-space:nowrap">${dateStr}</td>
      <td>${escapeHtml(iv.product || "—")}</td>
      <td>${iv.ml || "—"}ml</td>
      <td>${iv.qty || "—"}</td>
      <td>₹${(iv.price||0).toLocaleString("en-IN")}</td>
      <td class="col-total">₹${(iv.total||0).toLocaleString("en-IN")}</td>
      <td><span class="pay-tag ${payClass}">${payText}</span></td>
      <td style="color:var(--text3);font-size:0.78rem">${escapeHtml(iv.note || "")}</td>
      <td style="white-space:nowrap">
        <button class="edit-sale-btn" onclick="openEditModalForCustomer(${iv.invoiceNo})" title="Edit this sale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="delete-sale-btn" onclick="deleteSale(${iv.invoiceNo})" title="Delete this sale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ════════════════════════════════════════════════════════════
   EDIT ORDER MODAL (multi-item, preserves invoice numbers)
════════════════════════════════════════════════════════════ */
let editSelectedSizeOrder = null;
let editingInvoiceGroup   = [];
let editCart              = [];

function openEditModalForCustomer(invoiceNo) {
  const target = invoices.find(i => i.invoiceNo === invoiceNo);
  if (!target) return;

  currentMonthFilter = document.getElementById("custMonthFilter")?.value || "";
  currentSearchQuery = document.getElementById("custSearch")?.value || "";

  const group = invoices.filter(i =>
    i.customer === target.customer &&
    i.date     === target.date &&
    i.phone    === target.phone
  );

  editingInvoiceGroup = group.map(iv => iv.invoiceNo);
  editCart = group.map(iv => ({
    id: iv.invoiceNo,
    product: iv.product,
    ml: iv.ml,
    qty: iv.qty,
    price: iv.price,
    total: iv.total,
    invoiceNo: iv.invoiceNo
  }));

  const existing = document.getElementById("editOrderModal");
  if (existing) existing.remove();

  const fragOptions = fragrances.map(f => `<option value="${escapeAttr(f.name)}">${escapeHtml(f.name)}</option>`).join("");

  const modal = document.createElement("div");
  modal.id = "editOrderModal";
  modal.className = "edit-modal-overlay";
  modal.innerHTML = `
    <div class="edit-modal-card" style="max-width:600px">
      <div class="edit-modal-header">
        <span>Edit Order — ${escapeHtml(target.customer)} (${new Date(target.date).toLocaleDateString()})</span>
        <button class="edit-modal-close" onclick="closeEditOrderModal()">✕</button>
      </div>
      <div class="edit-modal-body">
        <div class="edit-row">
          <label>Customer Name</label>
          <input id="editCustomer" class="field-input" value="${escapeAttr(target.customer||"")}" />
        </div>
        <div class="edit-row">
          <label>Phone Number</label>
          <input id="editPhone" class="field-input" value="${escapeAttr(target.phone||"")}" />
        </div>
        <div class="edit-row">
          <label>Date</label>
          <div class="date-input-wrap">
            <input class="field-input" type="text" readonly id="editDate"
                   value="${escapeAttr(target.date||"")}"
                   placeholder="Select date…"
                   onclick="openDatePicker(this)" />
            <svg class="date-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
        </div>
        <div class="edit-row">
          <label>Sold By</label>
          <input id="editBy" class="field-input" value="${escapeAttr(target.by||"")}" />
        </div>
        <div class="edit-row">
          <label>Payment Method</label>
          <select id="editPayment" class="field-input">
            <option ${target.payment === 'PAID/SBI'  ? 'selected' : ''}>PAID/SBI</option>
            <option ${target.payment === 'PAID/CASH' ? 'selected' : ''}>PAID/CASH</option>
            <option ${target.payment === 'PENDING'   ? 'selected' : ''}>PENDING</option>
            <option ${target.payment === 'PERSONAL'  ? 'selected' : ''}>PERSONAL</option>
          </select>
        </div>
        <div class="edit-row">
          <label>Note</label>
          <input id="editNote" class="field-input" value="${escapeAttr(target.note||"")}" />
        </div>

        <div class="edit-row" style="margin-top:12px;border-top:1px solid rgba(210,195,175,0.3);padding-top:12px">
          <label>ADD FRAGRANCE TO ORDER</label>
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px">
            <select id="editFragrance" class="field-input" onchange="updateEditStockPreviewForOrder()">
              <option value="">— Select —</option>
              ${fragOptions}
            </select>
            <div class="pill-row">
              <button class="size-pill edit-size-pill-order" data-sz="20"  onclick="selectEditSizePillForOrder(this)">20ml</button>
              <button class="size-pill edit-size-pill-order" data-sz="30"  onclick="selectEditSizePillForOrder(this)">30ml</button>
              <button class="size-pill edit-size-pill-order" data-sz="50"  onclick="selectEditSizePillForOrder(this)">50ml</button>
              <button class="size-pill edit-size-pill-order" data-sz="100" onclick="selectEditSizePillForOrder(this)">100ml</button>
            </div>
            <div class="qty-control">
              <button class="qty-btn" onclick="changeEditQty(-1)">−</button>
              <input type="number" id="editQty" value="1" min="1" />
              <button class="qty-btn" onclick="changeEditQty(1)">+</button>
            </div>
            <input type="number" id="editPrice" class="field-input" placeholder="Price per bottle" />
          </div>
          <button class="add-to-cart-btn" onclick="addToEditCart()" style="margin-top:10px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 5v14M5 12h14"/></svg>
            Add to Order
          </button>
        </div>

        <div class="edit-row" style="margin-top:12px">
          <label>CURRENT ITEMS IN ORDER</label>
          <div id="editCartItems" style="max-height:300px;overflow-y:auto"></div>
        </div>

        <div class="sale-total-bar" id="editOrderTotalBar" style="display:flex;margin-top:12px">
          <span>Order Total</span>
          <strong id="editOrderTotal">₹0</strong>
        </div>
      </div>
      <div class="edit-modal-footer">
        <button class="edit-cancel-btn" onclick="closeEditOrderModal()">Cancel</button>
        <button class="edit-save-btn" onclick="saveEditedOrder()">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  enhanceAllSelects(modal);

  renderEditCart();
  updateEditOrderTotal();
}

function selectEditSizePillForOrder(el) {
  document.querySelectorAll(".edit-size-pill-order").forEach(p => {
    p.style.background = "";
    p.style.borderColor = "";
  });
  el.style.background  = "rgba(184,146,42,0.2)";
  el.style.borderColor = "rgba(184,146,42,0.5)";
  editSelectedSizeOrder = parseInt(el.dataset.sz);
  updateEditStockPreviewForOrder();
}

function updateEditStockPreviewForOrder() {
  const product = document.getElementById("editFragrance").value;
  if (product && editSelectedSizeOrder) {
    const frag = fragrances.find(f => f.name === product);
    if (frag) {
      const stock = getStock(frag, editSelectedSizeOrder);
      showToast(`Stock available: ${stock} bottles`, "info");
    }
  }
}

function changeEditQty(d) {
  const inp = document.getElementById("editQty");
  inp.value = Math.max(1, parseInt(inp.value || 1) + d);
}

function addToEditCart() {
  const product = document.getElementById("editFragrance").value;
  const ml      = editSelectedSizeOrder;
  const qty     = parseInt(document.getElementById("editQty").value) || 1;
  const price   = parseFloat(document.getElementById("editPrice").value) || 0;

  if (!product) { showToast("Select a fragrance", "error"); return; }
  if (!ml)      { showToast("Select a bottle size", "error"); return; }
  if (qty < 1)  { showToast("Enter valid quantity", "error"); return; }
  if (price <= 0) { showToast("Enter valid price", "error"); return; }

  editCart.push({
    id: Date.now() + Math.random(),
    product, ml, qty, price,
    total: qty * price,
    isNew: true,
    invoiceNo: null
  });

  document.getElementById("editFragrance").value = "";
  document.getElementById("editQty").value    = "1";
  document.getElementById("editPrice").value  = "";
  editSelectedSizeOrder = null;
  document.querySelectorAll(".edit-size-pill-order").forEach(p => {
    p.style.background = "";
    p.style.borderColor = "";
  });
  refreshCSelectLabel(document.getElementById("editFragrance"));

  renderEditCart();
  updateEditOrderTotal();
  showToast(`Added ${product} (${ml}ml) ×${qty}`, "success");
}

function removeFromEditCart(idx) {
  editCart.splice(idx, 1);
  renderEditCart();
  updateEditOrderTotal();
}

function renderEditCart() {
  const container = document.getElementById("editCartItems");
  if (!container) return;
  if (editCart.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">No items in this order</div>';
    return;
  }
  let html = "";
  editCart.forEach((item, idx) => {
    const isExisting = !item.isNew;
    html += `
      <div class="cart-item" style="margin-bottom:8px;${isExisting ? 'background:rgba(184,146,42,0.05);' : ''}">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.product)} ${isExisting ? '<span style="font-size:0.7rem;color:var(--gold)">(existing)</span>' : ''}</div>
          <div class="cart-item-meta">${item.ml}ml × ${item.qty} @ ₹${item.price.toLocaleString("en-IN")}</div>
        </div>
        <div class="cart-item-total">₹${item.total.toLocaleString("en-IN")}</div>
        <button class="cart-remove-btn" onclick="removeFromEditCart(${idx})" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>`;
  });
  container.innerHTML = html;
  updateEditOrderTotal();
}

function updateEditOrderTotal() {
  const total = editCart.reduce((s, i) => s + i.total, 0);
  const el = document.getElementById("editOrderTotal");
  if (el) el.textContent = "₹" + total.toLocaleString("en-IN");
}

async function saveEditedOrder() {
  const newCustomer = (document.getElementById("editCustomer").value || "").trim().toUpperCase();
  const newPhone    = (document.getElementById("editPhone").value || "").trim().replace(/\s+/g,"");
  const newDate     = document.getElementById("editDate").value;
  const newBy       = (document.getElementById("editBy").value || "").trim().toUpperCase();
  const newPayment  = document.getElementById("editPayment").value;
  const newNote     = (document.getElementById("editNote").value || "").trim().toUpperCase();

  if (!newCustomer) { showToast("Customer name required", "error"); return; }
  if (editCart.length === 0) { showToast("Order must have at least one item", "error"); return; }

  for (const invNo of editingInvoiceGroup) {
    const old = invoices.find(i => i.invoiceNo === invNo);
    if (old) {
      const frag = fragrances.find(f => f.name === old.product);
      if (frag && old.ml && old.qty) {
        const key = "ml" + old.ml;
        frag[key] = (frag[key] || 0) + old.qty;
        await updateFragranceInFirebase(frag);
      }
      await deleteInvoiceFromFirebase(invNo);
    }
  }
  invoices = invoices.filter(i => !editingInvoiceGroup.includes(i.invoiceNo));

  let grand = 0;
  for (const item of editCart) {
    const total = item.qty * item.price;
    grand += total;

    const frag = fragrances.find(f => f.name === item.product);
    if (frag) {
      const key = "ml" + item.ml;
      const cur = frag[key] || 0;
      if (cur < item.qty) showToast(`⚠ Only ${cur} in stock for ${item.product} (${item.ml}ml)`, "error");
      frag[key] = Math.max(0, cur - item.qty);
      await updateFragranceInFirebase(frag);
    }

    const invoiceNumber = (item.invoiceNo && !item.isNew) ? item.invoiceNo : nextInvoice++;

    const newInv = {
      by: newBy,
      invoiceNo: invoiceNumber,
      customer: newCustomer,
      phone: newPhone,
      date: newDate,
      product: item.product,
      ml: item.ml,
      qty: item.qty,
      price: item.price,
      total,
      payment: newPayment,
      note: newNote
    };
    await addInvoiceToFirebase(newInv);
  }

  showToast(`Order updated — ${editCart.length} item(s) — ₹${grand.toLocaleString("en-IN")}`, "success");
  closeEditOrderModal();
  setTimeout(restoreFilterState, 400);
}

function closeEditOrderModal() {
  const m = document.getElementById("editOrderModal");
  if (m) m.remove();
  editingInvoiceGroup   = [];
  editCart              = [];
  editSelectedSizeOrder = null;
}

async function deleteSale(invoiceNo) {
  if (!confirm(`Delete Invoice #${invoiceNo}? This will restore the stock.`)) return;

  const iv = invoices.find(i => i.invoiceNo === invoiceNo);
  if (!iv) { showToast("Sale not found", "error"); return; }

  const frag = fragrances.find(f => f.name === iv.product);
  if (frag && iv.ml && iv.qty) {
    const key = "ml" + iv.ml;
    if (frag[key] !== undefined) {
      frag[key] += iv.qty;
      await updateFragranceInFirebase(frag);
    }
  }
  await deleteInvoiceFromFirebase(invoiceNo);
  showToast(`Invoice #${invoiceNo} deleted & stock restored`, "success");
}

/* ════════════════════════════════════════════════════════════
   EXPORT EXCEL
════════════════════════════════════════════════════════════ */
function exportAllExcel() {
  if (typeof XLSX === "undefined") { showToast("Excel lib not loaded", "error"); return; }
  const wb = XLSX.utils.book_new();

  const sData = [
    ["STOCK LIST","","","","","",""],
    ["","","","","","",""],
    ["","NAME","QUANTITY IN STOCK","","","","TOTAL QTY"],
    ["","","20 ML","30 ML","50 ML","100 ML",""],
    ["","","","","","",""],
  ];
  fragrances.forEach(f => {
    const tot = (f.ml20||0)+(f.ml30||0)+(f.ml50||0)+(f.ml100||0);
    sData.push(["", f.name, f.ml20||0, f.ml30||0, f.ml50||0, f.ml100||0, tot]);
  });
  const t = fragrances.reduce((a, f) => ({
    ml20:  a.ml20  + (f.ml20||0),
    ml30:  a.ml30  + (f.ml30||0),
    ml50:  a.ml50  + (f.ml50||0),
    ml100: a.ml100 + (f.ml100||0)
  }), { ml20:0, ml30:0, ml50:0, ml100:0 });
  sData.push(["", "TOTAL", t.ml20, t.ml30, t.ml50, t.ml100, t.ml20+t.ml30+t.ml50+t.ml100]);
  const sws = XLSX.utils.aoa_to_sheet(sData);
  sws["!cols"] = [{ wch:4 }, { wch:22 }, { wch:8 }, { wch:8 }, { wch:8 }, { wch:8 }, { wch:10 }];
  XLSX.utils.book_append_sheet(wb, sws, "STOCK REPORT");

  const cData = [
    ["INVOICES","","","","","","","","","","",""],
    ["LUXORA","","","","","","","","","","",""],
    ["","","","","","","","",4000,"","",""],
    ["BY ORDER","Invoice #","CUSTOMER","Invoice Date","PRODUCT","Tax Rate","ML","QTY","PRICE","Invoice Total","PAYMENT","NOTE"],
  ];
  const sorted = [...invoices].sort((a, b) => a.invoiceNo - b.invoiceNo);
  sorted.forEach(iv => cData.push([
    iv.by||"", iv.invoiceNo, iv.customer||"", iv.date||"",
    iv.product||"", 0, iv.ml||"", iv.qty||1,
    iv.price||0, iv.total||0, iv.payment||"", iv.note||""
  ]));
  const totalAll = sorted.reduce((s, iv) => s + (iv.total||0), 0);
  cData.push(["","Totals","","","","","","","",totalAll,"",""]);
  const cws = XLSX.utils.aoa_to_sheet(cData);
  cws["!cols"] = [{ wch:14 }, { wch:10 }, { wch:18 }, { wch:14 }, { wch:26 }, { wch:8 }, { wch:6 }, { wch:6 }, { wch:8 }, { wch:14 }, { wch:12 }, { wch:12 }];
  XLSX.utils.book_append_sheet(wb, cws, "SALES");

  XLSX.writeFile(wb, "LUXORA_REPORT.xlsx");
  showToast("Excel exported — Stock & Customers included!", "success");
}

/* ════════════════════════════════════════════════════════════
   MANUAL REFRESH / CLEAR
════════════════════════════════════════════════════════════ */
async function manualRefresh() {
  await loadDataFromFirebase();
  showToast("Data refreshed from cloud", "success");
}

async function clearCache() {
  if (!confirm("This will reset ALL data (stock & sales) back to defaults. Custom fragrances you added will be deleted. Continue?")) return;

  const fragSnap = await getDocs(collection(db, "fragrances"));
  for (const d of fragSnap.docs) await deleteDoc(doc(db, "fragrances", d.id));

  const invSnap = await getDocs(collection(db, "invoices"));
  for (const d of invSnap.docs) await deleteDoc(doc(db, "invoices", d.id));

  fragrances  = defaultFragrances();
  invoices    = defaultInvoices();
  nextInvoice = invoices.length + 1;

  await seedFragrancesToFirebase();
  await seedInvoicesToFirebase();
  await setDoc(doc(db, "meta", "app"), { nextInvoice });

  showToast("Cache cleared — data reset to defaults", "success");
}

/* ════════════════════════════════════════════════════════════
   CUSTOM DATE PICKER
════════════════════════════════════════════════════════════ */
let datePickerTarget = null;
let datePickerView   = new Date();

function openDatePicker(inputEl) {
  if (!inputEl) return;
  datePickerTarget = inputEl;
  const cur = inputEl.value ? new Date(inputEl.value) : new Date();
  datePickerView = isNaN(cur.getTime()) ? new Date() : cur;
  document.getElementById("datePickerTitle").textContent = "Select Date";
  renderDatePicker();
  document.getElementById("datePickerModal").style.display = "flex";
}
function closeDatePicker() {
  document.getElementById("datePickerModal").style.display = "none";
  datePickerTarget = null;
}
function datePickerPrevMonth() { datePickerView.setMonth(datePickerView.getMonth() - 1); renderDatePicker(); }
function datePickerNextMonth() { datePickerView.setMonth(datePickerView.getMonth() + 1); renderDatePicker(); }
function datePickerToday() {
  if (datePickerTarget) datePickerTarget.value = new Date().toISOString().split("T")[0];
  closeDatePicker();
}
function datePickerClear() {
  if (datePickerTarget) datePickerTarget.value = "";
  closeDatePicker();
}
function renderDatePicker() {
  const monthEl = document.getElementById("datePickerMonth");
  const gridEl  = document.getElementById("datePickerGrid");
  if (!monthEl || !gridEl) return;

  const y = datePickerView.getFullYear();
  const m = datePickerView.getMonth();

  monthEl.textContent = new Date(y, m, 1).toLocaleDateString("en-IN", { month:"long", year:"numeric" });

  const firstDay = new Date(y, m, 1).getDay();
  const days     = new Date(y, m + 1, 0).getDate();

  const today = new Date();
  const tY = today.getFullYear(), tM = today.getMonth(), tD = today.getDate();

  let selY = null, selM = null, selD = null;
  if (datePickerTarget && datePickerTarget.value) {
    const sel = new Date(datePickerTarget.value);
    if (!isNaN(sel.getTime())) { selY = sel.getFullYear(); selM = sel.getMonth(); selD = sel.getDate(); }
  }

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="date-picker-day empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const isToday    = (tY === y && tM === m && tD === d);
    const isSelected = (selY === y && selM === m && selD === d);
    const cls = ["date-picker-day"];
    if (isToday)    cls.push("today");
    if (isSelected) cls.push("selected");
    html += `<button type="button" class="${cls.join(" ")}" onclick="datePickerPick(${y}, ${m}, ${d})">${d}</button>`;
  }
  gridEl.innerHTML = html;
}
function datePickerPick(y, m, d) {
  const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (datePickerTarget) datePickerTarget.value = iso;
  closeDatePicker();
}

/* ════════════════════════════════════════════════════════════
   CUSTOM DROPDOWNS
════════════════════════════════════════════════════════════ */
let openCSelect = null;

function enhanceAllSelects(root) {
  (root || document).querySelectorAll("select").forEach(enhanceSelect);
}

function enhanceSelect(sel) {
  if (!sel || sel.dataset.csReady) return;
  sel.dataset.csReady = "1";

  const isFilter = sel.classList.contains("month-filter-select");

  const wrap = document.createElement("div");
  wrap.className = "cselect" + (isFilter ? " cselect-filter" : "");
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add("cselect-native");
  sel.tabIndex = -1;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = (isFilter ? "month-filter-select" : "field-input") + " cselect-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML =
    `<span class="cselect-label"></span>` +
    `<svg class="cselect-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  wrap.appendChild(btn);

  const refresh = () => {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector(".cselect-label").textContent = o ? o.textContent : "";
  };
  refresh();
  sel._cselectRefresh = refresh;

  btn.addEventListener("click", () => {
    if (openCSelect && openCSelect.btn === btn) closeCSelect();
    else openCSelectMenu(wrap, sel, btn, refresh);
  });

  btn.addEventListener("keydown", e => {
    const isOpen = openCSelect && openCSelect.btn === btn;
    if (!isOpen) {
      if (["ArrowDown","ArrowUp","Enter"," "].includes(e.key)) {
        e.preventDefault();
        openCSelectMenu(wrap, sel, btn, refresh);
      }
      return;
    }
    if (e.key === "ArrowDown")      { e.preventDefault(); moveCSelectActive(1); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); moveCSelectActive(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickCSelect(openCSelect.active); }
    else if (e.key === "Escape")    { e.preventDefault(); e.stopPropagation(); closeCSelect(); }
    else if (e.key === "Tab")       { closeCSelect(); }
  });
}

function refreshCSelectLabel(sel) {
  if (sel && sel._cselectRefresh) sel._cselectRefresh();
}

function openCSelectMenu(wrap, sel, btn, refresh) {
  closeCSelect();
  const menu = document.createElement("div");
  menu.className = "cselect-menu";
  menu.setAttribute("role", "listbox");

  Array.from(sel.options).forEach((opt, i) => {
    const item = document.createElement("div");
    item.className = "cselect-opt" + (i === sel.selectedIndex ? " selected" : "");
    item.setAttribute("role", "option");
    item.dataset.index = i;
    item.textContent = opt.textContent;
    item.addEventListener("click", () => pickCSelect(i));
    menu.appendChild(item);
  });

  const r     = btn.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 10;
  const above = r.top - 10;
  const up    = below < 170 && above > below;
  const maxH  = Math.max(120, Math.min(260, up ? above : below));

  menu.style.minWidth  = r.width + "px";
  menu.style.maxHeight = maxH + "px";
  menu.style.left      = r.left + "px";
  if (up) menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
  else    menu.style.top    = (r.bottom + 6) + "px";
  document.body.appendChild(menu);

  const overflow = r.left + menu.offsetWidth - (window.innerWidth - 8);
  if (overflow > 0) menu.style.left = Math.max(8, r.left - overflow) + "px";

  wrap.classList.add("open");
  btn.setAttribute("aria-expanded", "true");

  openCSelect = { wrap, btn, menu, sel, refresh, active: Math.max(0, sel.selectedIndex) };
  highlightCSelect();

  const s = menu.querySelector(".cselect-opt.selected");
  if (s) menu.scrollTop = Math.max(0, s.offsetTop - menu.clientHeight / 2 + s.offsetHeight / 2);

  document.addEventListener("pointerdown", cselectOutside, true);
  window.addEventListener("scroll", cselectScroll, true);
  window.addEventListener("resize", closeCSelect);
}

function highlightCSelect() {
  if (!openCSelect) return;
  openCSelect.menu.querySelectorAll(".cselect-opt").forEach((el, i) => {
    el.classList.toggle("active", i === openCSelect.active);
  });
  const el = openCSelect.menu.children[openCSelect.active];
  if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
}
function moveCSelectActive(d) {
  if (!openCSelect) return;
  const n = openCSelect.sel.options.length;
  openCSelect.active = (openCSelect.active + d + n) % n;
  highlightCSelect();
}
function pickCSelect(i) {
  if (!openCSelect) return;
  const { sel, refresh, btn } = openCSelect;
  const changed = sel.selectedIndex !== i;
  sel.selectedIndex = i;
  refresh();
  closeCSelect();
  btn.focus({ preventScroll: true });
  if (changed) sel.dispatchEvent(new Event("change", { bubbles: true }));
}
function closeCSelect() {
  if (!openCSelect) return;
  const { wrap, btn, menu } = openCSelect;
  wrap.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
  menu.remove();
  openCSelect = null;
  document.removeEventListener("pointerdown", cselectOutside, true);
  window.removeEventListener("scroll", cselectScroll, true);
  window.removeEventListener("resize", closeCSelect);
}
function cselectOutside(e) {
  if (!openCSelect) return;
  if (openCSelect.menu.contains(e.target) || openCSelect.btn.contains(e.target)) return;
  closeCSelect();
}
function cselectScroll(e) {
  if (openCSelect && openCSelect.menu.contains(e.target)) return;
  closeCSelect();
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

/* ════════════════════════════════════════════════════════════
   GLOBAL EXPORTS
════════════════════════════════════════════════════════════ */
window.attemptLogin               = attemptLogin;
window.togglePw                   = togglePw;
window.logout                     = logout;
window.switchView                 = switchView;
window.toggleSidebar              = toggleSidebar;
window.closeSidebar               = closeSidebar;

window.selectSize                 = selectSize;
window.selectFrag                 = selectFrag;
window.changeQty                  = changeQty;
window.confirmAddStock            = confirmAddStock;

window.openNewFragranceModal      = openNewFragranceModal;
window.closeNewFragranceModal     = closeNewFragranceModal;
window.saveNewFragrance           = saveNewFragrance;
window.openRemoveFragranceModal   = openRemoveFragranceModal;
window.closeRemoveFragranceModal  = closeRemoveFragranceModal;
window.confirmRemoveFragrance     = confirmRemoveFragrance;

window.toggleWaNotice             = toggleWaNotice;
window.selectSalePill             = selectSalePill;
window.updateSalePreview          = updateSalePreview;
window.changeSaleQty              = changeSaleQty;
window.updateSaleSummary          = updateSaleSummary;
window.addToCart                  = addToCart;
window.removeFromCart             = removeFromCart;
window.confirmSale                = confirmSale;

window.renderStockTable           = renderStockTable;
window.renderCustomerTable        = renderCustomerTable;

window.openEditModalForCustomer   = openEditModalForCustomer;
window.selectEditSizePillForOrder = selectEditSizePillForOrder;
window.updateEditStockPreviewForOrder = updateEditStockPreviewForOrder;
window.changeEditQty              = changeEditQty;
window.addToEditCart              = addToEditCart;
window.removeFromEditCart         = removeFromEditCart;
window.saveEditedOrder            = saveEditedOrder;
window.closeEditOrderModal        = closeEditOrderModal;
window.deleteSale                 = deleteSale;

window.openDatePicker             = openDatePicker;
window.closeDatePicker            = closeDatePicker;
window.datePickerPrevMonth        = datePickerPrevMonth;
window.datePickerNextMonth        = datePickerNextMonth;
window.datePickerToday            = datePickerToday;
window.datePickerClear            = datePickerClear;
window.datePickerPick             = datePickerPick;

window.manualRefresh              = manualRefresh;
window.clearCache                 = clearCache;
window.exportAllExcel             = exportAllExcel;