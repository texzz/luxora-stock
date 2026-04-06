/* ════════════════════════════════════════
   LUXORA STOCK — Firebase Version
   Real-time sync across all devices
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
let fragrances = [];
let invoices = [];
let nextInvoice = 1;
let selectedSize = "20";
let selectedFrag = null;
let selectedSaleSize = null;

// Firebase references
let db, collection, getDocs, doc, setDoc, deleteDoc, addDoc, onSnapshot, query, orderBy;

/* ── WAIT FOR FIREBASE ── */
function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.firebaseInitialized) {
      db = window.firebaseDB;
      collection = window.firebaseCollection;
      getDocs = window.firebaseGetDocs;
      doc = window.firebaseDoc;
      setDoc = window.firebaseSetDoc;
      deleteDoc = window.firebaseDeleteDoc;
      addDoc = window.firebaseAddDoc;
      onSnapshot = window.firebaseOnSnapshot;
      query = window.firebaseQuery;
      orderBy = window.firebaseOrderBy;
      resolve();
    } else {
      setTimeout(() => waitForFirebase().then(resolve), 100);
    }
  });
}

/* ── FIREBASE DATA OPERATIONS ── */
async function loadDataFromFirebase() {
  try {
    // Load fragrances
    const fragsSnapshot = await getDocs(collection(db, "fragrances"));
    if (!fragsSnapshot.empty) {
      fragrances = [];
      fragsSnapshot.forEach(docSnap => {
        fragrances.push({ id: docSnap.id, ...docSnap.data() });
      });
    } else {
      fragrances = defaultFragrances();
      await saveFragrancesToFirebase();
    }

    // Load invoices
    const invSnapshot = await getDocs(collection(db, "invoices"));
    if (!invSnapshot.empty) {
      invoices = [];
      invSnapshot.forEach(docSnap => {
        invoices.push({ id: docSnap.id, ...docSnap.data() });
      });
      invoices.sort((a, b) => a.invoiceNo - b.invoiceNo);
      nextInvoice = Math.max(...invoices.map(i => i.invoiceNo), 0) + 1;
    } else {
      invoices = defaultInvoices();
      await saveInvoicesToFirebase();
      nextInvoice = invoices.length + 1;
    }

    // Load or create meta
    const metaRef = doc(db, "meta", "app");
    const metaSnap = await getDocs(collection(db, "meta"));
    if (metaSnap.empty) {
      await setDoc(metaRef, { nextInvoice: nextInvoice });
    } else {
      const metaDoc = await getDocs(collection(db, "meta"));
      metaDoc.forEach(docSnap => {
        if (docSnap.id === "app") {
          nextInvoice = docSnap.data().nextInvoice;
        }
      });
    }

    renderAll();
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("Error loading data from cloud", "error");
  }
}

async function saveFragrancesToFirebase() {
  const existing = await getDocs(collection(db, "fragrances"));
  for (const docSnap of existing.docs) {
    await deleteDoc(doc(db, "fragrances", docSnap.id));
  }
  for (const frag of fragrances) {
    const { id, ...data } = frag;
    await addDoc(collection(db, "fragrances"), data);
  }
}

async function saveInvoicesToFirebase() {
  const existing = await getDocs(collection(db, "invoices"));
  for (const docSnap of existing.docs) {
    await deleteDoc(doc(db, "invoices", docSnap.id));
  }
  for (const inv of invoices) {
    const { id, ...data } = inv;
    await addDoc(collection(db, "invoices"), data);
  }
}

async function updateFragranceInFirebase(fragIndex) {
  const frag = fragrances[fragIndex];
  const snapshot = await getDocs(collection(db, "fragrances"));
  let targetDoc = null;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.name === frag.name) {
      targetDoc = docSnap;
      break;
    }
  }
  if (targetDoc) {
    await setDoc(doc(db, "fragrances", targetDoc.id), frag);
  } else {
    await addDoc(collection(db, "fragrances"), frag);
  }
}

async function addInvoiceToFirebase(invoice) {
  await addDoc(collection(db, "invoices"), invoice);
  const metaRef = doc(db, "meta", "app");
  await setDoc(metaRef, { nextInvoice: nextInvoice });
}

async function updateInvoiceInFirebase(invoiceNo, updatedData) {
  const snapshot = await getDocs(collection(db, "invoices"));
  for (const docSnap of snapshot.docs) {
    if (docSnap.data().invoiceNo === invoiceNo) {
      await setDoc(doc(db, "invoices", docSnap.id), updatedData);
      break;
    }
  }
}

async function deleteInvoiceFromFirebase(invoiceNo) {
  const snapshot = await getDocs(collection(db, "invoices"));
  for (const docSnap of snapshot.docs) {
    if (docSnap.data().invoiceNo === invoiceNo) {
      await deleteDoc(doc(db, "invoices", docSnap.id));
      break;
    }
  }
}

/* ── SETUP REAL-TIME LISTENERS ── */
let fragUnsubscribe = null;
let invUnsubscribe = null;

function setupRealtimeListeners() {
  if (fragUnsubscribe) fragUnsubscribe();
  if (invUnsubscribe) invUnsubscribe();

  fragUnsubscribe = onSnapshot(collection(db, "fragrances"), (snapshot) => {
    if (!snapshot.empty) {
      fragrances = [];
      snapshot.forEach(docSnap => {
        fragrances.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderAll();
    }
  });

  invUnsubscribe = onSnapshot(collection(db, "invoices"), (snapshot) => {
    if (!snapshot.empty) {
      invoices = [];
      snapshot.forEach(docSnap => {
        invoices.push({ id: docSnap.id, ...docSnap.data() });
      });
      invoices.sort((a, b) => a.invoiceNo - b.invoiceNo);
      nextInvoice = Math.max(...invoices.map(i => i.invoiceNo), 0) + 1;
      renderAll();
    }
  });
}

function renderAll() {
  renderStats();
  renderFragGrid();
  renderStockTable();
  populateMonthFilter();
  renderCustomerTable();
  populateSaleFragSelect();
}

/* ── IMAGE MAP ── */
const FRAG_IMAGES = {
  "ARABIAN WOODY":   "arabian-woody-1.png",
  "ARMANI MY WAY":   "iconic-way-1.png",
  "BRUT":            "brut-1.png",
  "ICEBERG":         "ice-berg-1.png",
  "COOL WATER M":    "cool-water-1.png",
  "COOL WATER W":    "cool-water-1.png",
  "ICE":             "ice-1.png",
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
  "YARA":            "yara-1.png",
  "LACOSTE":         "lacoste-1.png",
  "CREED AVENTUS":   "creed-aventus-1.png",
  "PURPLE MUSK":     "purple-musk-1.png",
  "GULAB":           "gulab-1.png",
  "MOGRA":           "mogra-1.png",
  "KESAR CHANDAN":   "kesar-chandan-1.png",
  "TOMFORD TOBACCO VANILLA": "tobacco-vanilla-1.png",
  "COOL WATER WOMEN": "cool-water-1.png",
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
  return FRAG_IMAGES[name] ? FRAG_IMAGES[name] : null;
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
    { name:"ICE",             ml20:6,ml30:0,ml50:3,ml100:0 },
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
    { name:"YARA",            ml20:2,ml30:2,ml50:1,ml100:1 },
    { name:"LACOSTE",         ml20:0,ml30:0,ml50:0,ml100:1 },
    { name:"CREED AVENTUS",   ml20:2,ml30:2,ml50:0,ml100:0 },
    { name:"PURPLE MUSK",     ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"GULAB",           ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"MOGRA",           ml20:0,ml30:0,ml50:0,ml100:0 },
    { name:"KESAR CHANDAN",   ml20:0,ml30:0,ml50:0,ml100:0 },
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
    { by:"OM", invoiceNo:8, customer:"OM", phone:"", date:"2026-01-10", product:"LATAFA YARA", ml:100, qty:1, price:0, total:0, payment:"", note:"PERSONAL"},
    { by:"NAYAN", invoiceNo:9, customer:"NAYAN", phone:"", date:"2026-01-10", product:"LATAFA YARA", ml:100, qty:1, price:0, total:0, payment:"", note:"PERSONAL"},
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
    { by:"DHRUV", invoiceNo:79, customer:"MONICA", phone:"", date:"2026-03-16", product:"LV IMAGINATION", ml:20, qty:1, price:250, total:250, payment:"", note:""},
    { by:"TIRTH", invoiceNo:80, customer:"HARSH", phone:"", date:"2026-03-16", product:"MOST WANTED", ml:20, qty:1, price:300, total:300, payment:"", note:""},
    { by:"TIRTH", invoiceNo:81, customer:"HARSH", phone:"", date:"2026-03-16", product:"DUNHILL RED", ml:30, qty:1, price:350, total:350, payment:"", note:""},
    { by:"TIRTH", invoiceNo:82, customer:"HARSH", phone:"", date:"2026-03-16", product:"COOL WATER WOMEN", ml:30, qty:1, price:350, total:350, payment:"", note:""},
    { by:"TIRTH", invoiceNo:83, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"COOL WATER", ml:30, qty:1, price:350, total:350, payment:"", note:""},
    { by:"TIRTH", invoiceNo:84, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"ARABIAN WOODY", ml:30, qty:1, price:400, total:400, payment:"", note:""},
    { by:"TIRTH", invoiceNo:85, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"COOL WATER WOMEN", ml:20, qty:1, price:250, total:250, payment:"", note:""},
    { by:"TIRTH", invoiceNo:86, customer:"GAUTAM AHM", phone:"", date:"2026-03-16", product:"MOST WANTED", ml:20, qty:1, price:300, total:300, payment:"", note:""},
    { by:"TIRTH", invoiceNo:87, customer:"KRISH", phone:"", date:"2026-03-22", product:"CHOCOLATE MUSK", ml:50, qty:1, price:500, total:500, payment:"", note:""},
    { by:"TIRTH", invoiceNo:88, customer:"ARVIND", phone:"", date:"2026-03-22", product:"LACOSTE", ml:30, qty:1, price:350, total:350, payment:"", note:""},
    { by:"TIRTH", invoiceNo:89, customer:"SANDEEP", phone:"", date:"2026-03-24", product:"LACOSTE", ml:50, qty:1, price:650, total:650, payment:"", note:""},
    { by:"TIRTH", invoiceNo:90, customer:"SANDEEP", phone:"", date:"2026-03-24", product:"RASSASI HAWAS", ml:30, qty:1, price:350, total:350, payment:"", note:""},
    { by:"DHRUV", invoiceNo:91, customer:"DHRUV", phone:"", date:"2026-03-17", product:"GUCCI FLORA", ml:30, qty:1, price:300, total:300, payment:"", note:""},
    { by:"DHRUV", invoiceNo:92, customer:"MONICA", phone:"", date:"2026-04-01", product:"ELEXIR", ml:50, qty:1, price:500, total:500, payment:"", note:""},
  ];
}

/* ── AUTH FUNCTIONS ── */
function attemptLogin() {
  const email = (document.getElementById("loginEmail").value || "").trim().toLowerCase();
  const password = (document.getElementById("loginPassword").value || "").trim();
  const errEl = document.getElementById("loginError");

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
}

function logout() {
  sessionStorage.removeItem("luxora_user");
  currentUser = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("loginScreen").style.display = "";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginError").textContent = "";
  if (fragUnsubscribe) fragUnsubscribe();
  if (invUnsubscribe) invUnsubscribe();
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
  document.getElementById("loginPassword").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
  document.getElementById("loginEmail").addEventListener("keydown", e => {
    if (e.key === "Enter") attemptLogin();
  });
});

/* ════ NAVIGATION ════ */
function switchView(view, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + view).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");
  document.querySelectorAll(".topbar-nav-link").forEach(a => a.classList.remove("active"));
  const viewToIdx = {"add-stock":0,"add-sale":1,"stock-list":2,"customer-list":3};
  const idx = viewToIdx[view];
  const topLinks = document.querySelectorAll(".topbar-nav-link");
  if (topLinks[idx]) topLinks[idx].classList.add("active");
  closeSidebar();
  if (view === "stock-list") renderStockTable();
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

/* ════ SIZE CHIPS & FRAGRANCE GRID ════ */
function selectSize(el) {
  document.querySelectorAll(".size-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  selectedSize = el.dataset.size;
  selectedFrag = null;
  document.getElementById("entryPanel").style.display = "none";
  renderFragGrid();
}

function renderFragGrid() {
  const grid = document.getElementById("fragGrid");
  if (!grid) return;
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

  const imgEl = document.getElementById("entryImg");
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

async function confirmAddStock() {
  if (selectedFrag === null) { showToast("Select a fragrance first", "error"); return; }
  const qty = parseInt(document.getElementById("qtyInput").value);
  if (!qty || qty < 1) { showToast("Enter a valid quantity", "error"); return; }

  const frag = fragrances[selectedFrag];
  frag["ml" + selectedSize] = (frag["ml" + selectedSize] || 0) + qty;

  await updateFragranceInFirebase(selectedFrag);
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
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Fragrance —</option>';
  fragrances.forEach(f => {
    const o = document.createElement("option");
    o.value = f.name;
    o.textContent = f.name;
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
  const box = document.getElementById("saleStockPreview");
  if (!name || !selectedSaleSize) { if(box) box.style.display = "none"; return; }
  const frag = fragrances.find(f => f.name === name);
  if (!frag) { if(box) box.style.display = "none"; return; }
  document.getElementById("saleStockVal").textContent = getStock(frag, selectedSaleSize) + " bottles";
  if(box) box.style.display = "flex";
  updateSaleSummary();
}

function changeSaleQty(d) {
  const inp = document.getElementById("saleQty");
  inp.value = Math.max(1, parseInt(inp.value || 1) + d);
  updateSaleSummary();
}

function updateSaleSummary() {
  const qty = parseInt(document.getElementById("saleQty").value) || 0;
  const price = parseFloat(document.getElementById("salePrice").value) || 0;
  const bar = document.getElementById("saleTotalBar");
  if (qty > 0 && price > 0 && bar) {
    bar.style.display = "flex";
    document.getElementById("summaryTotal").textContent = "₹" + (qty * price).toLocaleString("en-IN");
  } else if(bar) {
    bar.style.display = "none";
  }
}

async function confirmSale() {
  const by = (document.getElementById("saleBy").value || "").trim().toUpperCase();
  const customer = (document.getElementById("saleCustomer").value || "").trim().toUpperCase();
  const phone = (document.getElementById("salePhone").value || "").trim().replace(/\s+/g,"");
  const date = document.getElementById("saleDate").value;
  const product = document.getElementById("saleFragrance").value;
  const payment = document.getElementById("salePayment").value;
  const note = (document.getElementById("saleNote").value || "").trim().toUpperCase();
  const qty = parseInt(document.getElementById("saleQty").value) || 1;
  const price = parseFloat(document.getElementById("salePrice").value) || 0;
  const ml = selectedSaleSize ? parseInt(selectedSaleSize) : null;

  if (!customer) { showToast("Enter customer name", "error"); return; }
  if (!product) { showToast("Select a fragrance", "error"); return; }
  if (!ml) { showToast("Select a bottle size", "error"); return; }

  const fragIndex = fragrances.findIndex(f => f.name === product);
  if (fragIndex !== -1) {
    const frag = fragrances[fragIndex];
    const key = "ml" + ml;
    const cur = frag[key] || 0;
    if (cur < qty) showToast(`⚠ Only ${cur} in stock — recorded anyway`, "error");
    frag[key] = Math.max(0, cur - qty);
    await updateFragranceInFirebase(fragIndex);
  }

  const total = qty * price;
  const inv = {
    by,
    invoiceNo: nextInvoice++,
    customer,
    phone,
    date,
    product,
    ml,
    qty,
    price,
    total,
    payment,
    note
  };

  await addInvoiceToFirebase(inv);

  // WhatsApp Message
  if (phone) {
    const dateStr = date
      ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "Today";

    const msg = `Hello ${customer},

Your order has been placed successfully! Here are your order details:

*Product:* ${product}
*Size:* ${ml}ml
*Quantity:* ${qty}
*Price per bottle:* ₹${price.toLocaleString("en-IN")}
*Total Amount:* ₹${total.toLocaleString("en-IN")}
*Date:* ${dateStr}
*Payment:* ${payment}
*Invoice #:* ${inv.invoiceNo}
${note ? `*Note:* ${note}` : ""}
To confirm your order, please reply with *YES*.

Thank you for choosing *Luxora*`;

    let waPhone = phone.replace(/[^0-9]/g, "");
    if (waPhone.length === 10) waPhone = "91" + waPhone;
    else if (waPhone.startsWith("0")) waPhone = "91" + waPhone.slice(1);

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    setTimeout(() => window.open(waUrl, "_blank"), 400);
    showToast(`Invoice #${inv.invoiceNo} recorded — Opening WhatsApp…`, "success");
  } else {
    showToast(`Invoice #${inv.invoiceNo} recorded — ₹${total.toLocaleString("en-IN")}`, "success");
  }

  // Reset form
  document.getElementById("saleCustomer").value = "";
  document.getElementById("salePhone").value = "";
  document.getElementById("salePrice").value = "";
  document.getElementById("saleQty").value = "1";
  document.getElementById("saleNote").value = "";
  document.getElementById("saleFragrance").value = "";
  document.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
  selectedSaleSize = null;
  const preview = document.getElementById("saleStockPreview");
  if(preview) preview.style.display = "none";
  const totalBar = document.getElementById("saleTotalBar");
  if(totalBar) totalBar.style.display = "none";
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
  if (!tbody) return;
  tbody.innerHTML = "";

  fragrances.filter(f => f.name.toLowerCase().includes(q)).forEach(frag => {
    const total = frag.ml20 + frag.ml30 + frag.ml50 + frag.ml100;
    let sc = "good", st = "In Stock";
    if (total === 0) { sc = "out"; st = "Out of Stock"; }
    else if (total <= 3) { sc = "low"; st = "Low Stock"; }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-name">${frag.name}</td>
      <td>${frag.ml20}</td>
      <td>${frag.ml30}</td>
      <td>${frag.ml50}</td>
      <td>${frag.ml100}</td>
      <td class="col-num">${total}</td>
      <td><span class="status-badge ${sc}">${st}</span></td>
    `;
    tbody.appendChild(tr);
  });

  const t = fragrances.reduce((a,f) => ({ml20:a.ml20+f.ml20,ml30:a.ml30+f.ml30,ml50:a.ml50+f.ml50,ml100:a.ml100+f.ml100}),{ml20:0,ml30:0,ml50:0,ml100:0});
  const tr = document.createElement("tr");
  tr.className = "tfoot-row";
  tr.innerHTML = `<td class="col-name">TOTAL</td><td>${t.ml20}</td><td>${t.ml30}</td><td>${t.ml50}</td><td>${t.ml100}</td><td class="col-num">${t.ml20+t.ml30+t.ml50+t.ml100}</td><td></td>`;
  tbody.appendChild(tr);
}

/* ════ CUSTOMER TABLE ════ */
function populateMonthFilter() {
  const sel = document.getElementById("custMonthFilter");
  if (!sel) return;
  const months = [...new Set(
    invoices
      .filter(iv => iv.date)
      .map(iv => iv.date.slice(0,7))
  )].sort().reverse();

  sel.innerHTML = '<option value="">All Months</option>';
  months.forEach(ym => {
    const [y, m] = ym.split("-");
    const label = new Date(y, m-1, 1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
    const opt = document.createElement("option");
    opt.value = ym;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  const nowYM = new Date().toISOString().slice(0,7);
  if (months.includes(nowYM)) sel.value = nowYM;
}

function renderCustomerTable() {
  const q = (document.getElementById("custSearch")?.value || "").toLowerCase();
  const month = document.getElementById("custMonthFilter")?.value || "";
  const tbody = document.getElementById("custTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered = invoices.filter(iv => {
    const matchQ = (iv.customer||"").toLowerCase().includes(q) ||
                   (iv.product||"").toLowerCase().includes(q) ||
                   (iv.by||"").toLowerCase().includes(q);
    const matchM = !month || (iv.date && iv.date.startsWith(month));
    return matchQ && matchM;
  });

  const totalRevenue = filtered.reduce((s,iv) => s + (iv.total||0), 0);
  const chip = document.getElementById("revChip");
  if (chip) chip.textContent = "Total: ₹" + totalRevenue.toLocaleString("en-IN");

  filtered.forEach((iv, idx) => {
    const dateStr = iv.date
      ? new Date(iv.date).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"2-digit"})
      : "—";

    const isPersonal = (iv.note||"").includes("PERSONAL") || (iv.payment||"").includes("PERSONAL");
    const isPending = !iv.payment || iv.payment.toUpperCase() === "PENDING";
    const payClass = isPending ? "pending" : isPersonal ? "personal" : "paid";

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
      <td style="white-space:nowrap">
        <button class="edit-sale-btn" onclick="openEditModal(${iv.invoiceNo})" title="Edit this sale">
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

async function deleteSale(invoiceNo) {
  if (!confirm(`Delete Invoice #${invoiceNo}? This will restore the stock.`)) return;

  const iv = invoices.find(iv => iv.invoiceNo === invoiceNo);
  if (!iv) { showToast("Sale not found", "error"); return; }

  // Restore stock
  const fragIndex = fragrances.findIndex(f => f.name === iv.product);
  if (fragIndex !== -1 && iv.ml && iv.qty) {
    const frag = fragrances[fragIndex];
    const key = "ml" + iv.ml;
    if (frag[key] !== undefined) {
      frag[key] += iv.qty;
      await updateFragranceInFirebase(fragIndex);
    }
  }

  await deleteInvoiceFromFirebase(invoiceNo);
  showToast(`Invoice #${invoiceNo} deleted & stock restored`, "success");
}

/* ════ EDIT SALE MODAL ════ */
let editSelectedSize = null;

function openEditModal(invoiceNo) {
  const iv = invoices.find(i => i.invoiceNo === invoiceNo);
  if (!iv) return;

  const existing = document.getElementById("editModal");
  if (existing) existing.remove();

  const fragOptions = fragrances.map(f => `<option value="${f.name}" ${f.name === iv.product ? 'selected' : ''}>${f.name}</option>`).join('');
  const sizeOptions = [20, 30, 50, 100].map(sz => 
    `<button class="size-pill edit-size-pill" data-sz="${sz}" onclick="selectEditSizePill(this, ${invoiceNo})" style="${iv.ml === sz ? 'background:rgba(184,146,42,0.2);border-color:rgba(184,146,42,0.5)' : ''}">${sz} ml</button>`
  ).join('');

  const modal = document.createElement("div");
  modal.id = "editModal";
  modal.className = "edit-modal-overlay";
  modal.innerHTML = `
    <div class="edit-modal-card">
      <div class="edit-modal-header">
        <span>Edit Invoice #${iv.invoiceNo}</span>
        <button class="edit-modal-close" onclick="closeEditModal()">✕</button>
      </div>
      <div class="edit-modal-body">
        <div class="edit-row">
          <label>Customer</label>
          <input id="em_customer" class="field-input" value="${iv.customer || ''}" />
        </div>
        <div class="edit-row">
          <label>Sold By</label>
          <input id="em_by" class="field-input" value="${iv.by || ''}" />
        </div>
        <div class="edit-row">
          <label>Date</label>
          <input id="em_date" type="date" class="field-input" value="${iv.date || ''}" />
        </div>
        <div class="edit-row">
          <label>Fragrance</label>
          <select id="em_product" class="field-input" onchange="updateEditStockPreview(${invoiceNo})">
            ${fragOptions}
          </select>
        </div>
        <div class="edit-row">
          <label>Size (ml)</label>
          <div class="pill-row" id="editSizePills">
            ${sizeOptions}
          </div>
        </div>
        <div class="edit-row">
          <label>Quantity</label>
          <input id="em_qty" type="number" class="field-input" value="${iv.qty || 1}" min="1" onchange="updateEditTotal(${invoiceNo})" />
        </div>
        <div class="edit-row">
          <label>Price per bottle (₹)</label>
          <input id="em_price" type="number" class="field-input" value="${iv.price || 0}" onchange="updateEditTotal(${invoiceNo})" />
        </div>
        <div class="edit-row">
          <div class="stock-preview-box" id="editStockPreview" style="display:flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            Current Stock: <strong id="editStockVal">—</strong>
          </div>
        </div>
        <div class="edit-row">
          <label>Payment</label>
          <select id="em_payment" class="field-input">
            <option ${iv.payment === 'PAID/SBI' ? 'selected' : ''}>PAID/SBI</option>
            <option ${iv.payment === 'PAID/CASH' ? 'selected' : ''}>PAID/CASH</option>
            <option ${iv.payment === 'PENDING' ? 'selected' : ''}>PENDING</option>
            <option ${iv.payment === 'PERSONAL' ? 'selected' : ''}>PERSONAL</option>
            <option ${!iv.payment ? 'selected' : ''} value=""></option>
          </select>
        </div>
        <div class="edit-row">
          <label>Note</label>
          <input id="em_note" class="field-input" value="${iv.note || ''}" />
        </div>
        <div class="edit-row">
          <div class="sale-total-bar" id="editTotalBar" style="display:flex; margin:0">
            <span>New Total</span>
            <strong id="editTotalAmount">₹${(iv.price * iv.qty).toLocaleString("en-IN")}</strong>
          </div>
        </div>
      </div>
      <div class="edit-modal-footer">
        <button class="edit-cancel-btn" onclick="closeEditModal()">Cancel</button>
        <button class="edit-save-btn" onclick="saveEditModal(${iv.invoiceNo})">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) closeEditModal(); });
  updateEditStockPreview(invoiceNo);
}

function selectEditSizePill(el, invoiceNo) {
  document.querySelectorAll(".edit-size-pill").forEach(p => {
    p.style.background = "";
    p.style.borderColor = "";
  });
  el.style.background = "rgba(184,146,42,0.2)";
  el.style.borderColor = "rgba(184,146,42,0.5)";
  editSelectedSize = parseInt(el.dataset.sz);
  updateEditStockPreview(invoiceNo);
}

function updateEditStockPreview(invoiceNo) {
  const productSelect = document.getElementById("em_product");
  const product = productSelect ? productSelect.value : "";
  const frag = fragrances.find(f => f.name === product);
  const stockSpan = document.getElementById("editStockVal");
  if (frag && editSelectedSize && stockSpan) {
    stockSpan.textContent = getStock(frag, editSelectedSize) + " bottles";
  } else if (stockSpan) {
    stockSpan.textContent = "—";
  }
  updateEditTotal(invoiceNo);
}

function updateEditTotal(invoiceNo) {
  const qty = parseInt(document.getElementById("em_qty")?.value) || 0;
  const price = parseFloat(document.getElementById("em_price")?.value) || 0;
  const totalSpan = document.getElementById("editTotalAmount");
  if (totalSpan) {
    totalSpan.textContent = "₹" + (qty * price).toLocaleString("en-IN");
  }
}

function closeEditModal() {
  const modal = document.getElementById("editModal");
  if (modal) modal.remove();
  editSelectedSize = null;
}

async function saveEditModal(invoiceNo) {
  const idx = invoices.findIndex(i => i.invoiceNo === invoiceNo);
  if (idx === -1) return;

  const oldIv = invoices[idx];
  const newCustomer = document.getElementById("em_customer").value.trim().toUpperCase();
  const newBy = document.getElementById("em_by").value.trim().toUpperCase();
  const newDate = document.getElementById("em_date").value;
  const newProduct = document.getElementById("em_product").value;
  const newQty = parseInt(document.getElementById("em_qty").value) || 1;
  const newPrice = parseFloat(document.getElementById("em_price").value) || 0;
  const newPayment = document.getElementById("em_payment").value;
  const newNote = document.getElementById("em_note").value.trim().toUpperCase();
  const newMl = editSelectedSize || oldIv.ml;

  // Handle stock adjustments
  if (oldIv.product !== newProduct || oldIv.ml !== newMl || oldIv.qty !== newQty) {
    // Restore old stock
    const oldFragIndex = fragrances.findIndex(f => f.name === oldIv.product);
    if (oldFragIndex !== -1) {
      const oldKey = "ml" + oldIv.ml;
      fragrances[oldFragIndex][oldKey] = (fragrances[oldFragIndex][oldKey] || 0) + oldIv.qty;
      await updateFragranceInFirebase(oldFragIndex);
    }

    // Deduct new stock
    const newFragIndex = fragrances.findIndex(f => f.name === newProduct);
    if (newFragIndex !== -1) {
      const newKey = "ml" + newMl;
      const current = fragrances[newFragIndex][newKey] || 0;
      if (current < newQty) {
        showToast(`⚠ Warning: Only ${current} in stock for ${newProduct} (${newMl}ml)`, "error");
      }
      fragrances[newFragIndex][newKey] = Math.max(0, current - newQty);
      await updateFragranceInFirebase(newFragIndex);
    }
  } else if (oldIv.qty !== newQty) {
    // Same product, just quantity changed
    const fragIndex = fragrances.findIndex(f => f.name === newProduct);
    if (fragIndex !== -1) {
      const key = "ml" + newMl;
      const diff = oldIv.qty - newQty;
      fragrances[fragIndex][key] = (fragrances[fragIndex][key] || 0) + diff;
      await updateFragranceInFirebase(fragIndex);
    }
  }

  const newTotal = newQty * newPrice;
  const updatedInvoice = {
    ...oldIv,
    customer: newCustomer,
    by: newBy,
    date: newDate,
    product: newProduct,
    ml: newMl,
    qty: newQty,
    price: newPrice,
    total: newTotal,
    payment: newPayment,
    note: newNote
  };

  await updateInvoiceInFirebase(invoiceNo, updatedInvoice);
  closeEditModal();
  showToast(`Invoice #${invoiceNo} updated`, "success");
}

/* ════ EXPORT EXCEL ════ */
function exportAllExcel() {
  const wb = XLSX.utils.book_new();

  const sData = [
    ["STOCK LIST", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "NAME", "QUANTITY IN STOCK", "", "", "", "TOTAL QTY"],
    ["", "", "20 ML", "30 ML", "50 ML", "100 ML", ""],
    ["", "", "", "", "", "", ""],
  ];
  fragrances.forEach(f => {
    const tot = f.ml20 + f.ml30 + f.ml50 + f.ml100;
    sData.push(["", f.name, f.ml20, f.ml30, f.ml50, f.ml100, tot]);
  });
  const t = fragrances.reduce((a, f) => ({ ml20: a.ml20 + f.ml20, ml30: a.ml30 + f.ml30, ml50: a.ml50 + f.ml50, ml100: a.ml100 + f.ml100 }), { ml20: 0, ml30: 0, ml50: 0, ml100: 0 });
  sData.push(["", "TOTAL", t.ml20, t.ml30, t.ml50, t.ml100, t.ml20 + t.ml30 + t.ml50 + t.ml100]);
  const sws = XLSX.utils.aoa_to_sheet(sData);
  sws["!cols"] = [{ wch: 4 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, sws, "STOCK REPORT");

  const cData = [
    ["INVOICES", "", "", "", "", "", "", "", "", "", "", ""],
    ["LUXORA", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", 4000, "", "", ""],
    ["BY ORDER", "Invoice #", "CUSTOMER", "Invoice Date", "PRODUCT", "Tax Rate", "ML", "QTY", "PRICE", "Invoice Total", "PAYMENT", "NOTE"],
  ];
  invoices.forEach(iv => cData.push([
    iv.by || "", iv.invoiceNo, iv.customer || "", iv.date || "",
    iv.product || "", 0, iv.ml || "", iv.qty || 1,
    iv.price || 0, iv.total || 0, iv.payment || "", iv.note || ""
  ]));
  const totalAll = invoices.reduce((s, iv) => s + (iv.total || 0), 0);
  cData.push(["", "Totals", "", "", "", "", "", "", "", totalAll, "", ""]);
  const cws = XLSX.utils.aoa_to_sheet(cData);
  cws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 26 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, cws, "SALES");

  XLSX.writeFile(wb, "LUXORA_REPORT.xlsx");
  showToast("Excel exported — Stock & Customers included!", "success");
}

/* ════ MANUAL REFRESH & CLEAR CACHE ════ */
async function manualRefresh() {
  await loadDataFromFirebase();
  showToast("Data refreshed from cloud", "success");
}

async function clearCache() {
  if (!confirm("This will reset ALL data (stock & sales) back to defaults. Are you sure?")) return;
  
  fragrances = defaultFragrances();
  invoices = defaultInvoices();
  nextInvoice = invoices.length + 1;
  
  await saveFragrancesToFirebase();
  await saveInvoicesToFirebase();
  const metaRef = doc(db, "meta", "app");
  await setDoc(metaRef, { nextInvoice: nextInvoice });
  
  showToast("Cache cleared — data reset to defaults", "success");
}

/* ════ TOAST ════ */
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}
