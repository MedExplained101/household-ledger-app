import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Plus, Minus, X, ChevronDown, AlertTriangle, Search, RefreshCw, WifiOff, Camera, Mic } from "lucide-react";

// Your n8n production webhook — the mobile app never touches Google Sheets
// directly, it POSTs actions here and the workflow reads/writes ShoppingList + Settings.
// Set VITE_WEBHOOK_URL in your hosting provider's env vars to rotate this without a
// code change (see .env.example). Falls back to the current production URL if unset.
const WEBHOOK_URL =
  import.meta.env.VITE_WEBHOOK_URL ||
  "https://medexplained101.app.n8n.cloud/webhook/household-ledger-list";

// Receipt scan/upload endpoint — same trust model as WEBHOOK_URL above (no auth,
// URL obscurity only). Feeds the same Price Ingestion Agent pipeline that Telegram
// photo/PDF uploads use, just skipping the Telegram file-download step since the
// browser already has the file. Confirmation is shown in-app only; it does not
// also post to the household Telegram chat.
const INGEST_WEBHOOK_URL =
  import.meta.env.VITE_INGEST_WEBHOOK_URL ||
  "https://medexplained101.app.n8n.cloud/webhook/household-ledger-ingest-receipt";

// ---------------------------------------------------------------------------
// CATALOG — built from parsed Costco + Walmart receipts (Alpharetta / Milton, GA)
// Each entry: canonical name, category, per-store average price, and a flag
// for whether store sizes are known to differ (so a naive price diff would mislead).
// ---------------------------------------------------------------------------
// Store price entries can be either a plain number (size not printed on the
// receipt, so no per-unit price is possible) or { price, size, unitPrice, unitLabel }
// when the pack size was actually printed and a real $/lb or $/ct could be computed.
const CATALOG = [
  { name: "Watermelon", category: "Produce", stores: { Costco: 6.99 }, note: "each — size not printed" },
  { name: "Bananas", category: "Produce", stores: { Costco: 1.49 }, note: "size not printed" },
  { name: "Oranges", category: "Produce", stores: { Costco: 5.62 }, note: "size not printed" },
  { name: "Pineapple", category: "Produce", stores: { Costco: 2.99 }, note: "each — size not printed" },
  { name: "Strawberries", category: "Produce", stores: { Costco: 6.39 }, note: "size not printed" },
  { name: "Blueberries", category: "Produce", stores: { Costco: 4.89 }, note: "size not printed" },
  { name: "Raspberries", category: "Produce", stores: { Costco: 3.94 }, note: "size not printed" },
  { name: "Green Grapes", category: "Produce", stores: { Costco: 5.39 }, note: "size not printed" },
  { name: "Apples, 3lb Org Gala", category: "Produce", stores: { Costco: { price: 4.69, size: "3lb", unitPrice: 1.56, unitLabel: "$/lb" } }, note: "Costco only" },
  { name: "Potatoes, 10lb Bakers", category: "Produce", stores: { Costco: { price: 4.84, size: "10lb", unitPrice: 0.48, unitLabel: "$/lb" } }, note: "Costco only" },
  { name: "Potatoes, 3.5lb", category: "Produce", stores: { Costco: { price: 4.99, size: "3.5lb", unitPrice: 1.43, unitLabel: "$/lb" } }, note: "Costco only, smaller bag" },
  { name: "Mushrooms", category: "Produce", stores: { Costco: 3.99, Walmart: { price: 2.18, size: "8oz", unitPrice: 4.36, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed; Walmart is 8oz ($4.36/lb)" },
  { name: "Romaine", category: "Produce", stores: { Costco: 5.89 }, note: "size not printed" },
  { name: "Sweet Corn", category: "Produce", stores: { Costco: 4.99 }, note: "size not printed" },
  { name: "Grape Tomato", category: "Produce", stores: { Costco: 6.29 }, note: "size not printed" },
  { name: "Bell Peppers, 3ct", category: "Produce", stores: { Walmart: { price: 2.97, size: "3ct", unitPrice: 0.99, unitLabel: "$/pepper" } }, note: "Walmart only" },
  { name: "Collard Greens, bunch", category: "Produce", stores: { Walmart: 2.47 }, note: "Walmart only" },
  { name: "Carrots, 2lb", category: "Produce", stores: { Walmart: { price: 2.26, size: "2lb", unitPrice: 1.13, unitLabel: "$/lb" } }, note: "Walmart only" },
  { name: "Avocados, 5-6ct bag", category: "Produce", stores: { Walmart: 3.48 }, note: "Walmart only" },
  { name: "Cabbage, each", category: "Produce", stores: { Walmart: 2.79 }, note: "Walmart only" },
  { name: "Cucumbers", category: "Produce", stores: { Costco: 6.49, Walmart: { price: 2.08, size: "16oz", unitPrice: 2.08, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed (org, likely multi-pack); Walmart is 16oz mini" },
  { name: "Green Onions", category: "Produce", stores: { Costco: 5.99, Walmart: 1.07 }, sizeUnknown: true, note: "neither receipt prints a size/count" },

  { name: "Whole Milk", category: "Dairy", stores: { Costco: 3.68, Walmart: { price: 3.12, size: "1gal" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "Eggs", category: "Dairy", stores: { Costco: { price: 8.39, size: "5dz (60ct)", unitPrice: 0.14, unitLabel: "$/egg" }, Walmart: { price: 4.32, size: "36ct", unitPrice: 0.12, unitLabel: "$/egg" } }, note: "confirmed match — Walmart is cheaper per egg" },
  { name: "Butter", category: "Dairy", stores: { Costco: 10.49, Walmart: { price: 3.06, size: "16oz", unitPrice: 3.06, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "Greek Yogurt Tub, 32oz", category: "Dairy", stores: { Walmart: { price: 3.28, size: "32oz", unitPrice: 1.64, unitLabel: "$/lb" } }, note: "Walmart only" },
  { name: "Yogurt Variety Pack, 8ct", category: "Dairy", stores: { Walmart: { price: 4.96, size: "8ct", unitPrice: 0.62, unitLabel: "$/cup" } }, note: "Walmart only" },
  { name: "Shredded Cheese", category: "Dairy", stores: { Costco: 12.49 }, note: "Mexican blend, size not printed" },
  { name: "Heavy Cream", category: "Dairy", stores: { Costco: 4.39, Walmart: { price: 2.96, size: "16oz" } }, sizeUnknown: true, note: "Costco size not printed (likely ~qt)" },

  { name: "Ground Beef", category: "Meat", stores: { Costco: 36.84, Walmart: { price: 8.97, size: "1lb", unitPrice: 8.97, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco weight not printed — can't compute $/lb yet" },
  { name: "Chicken Drumsticks", category: "Meat", stores: { Costco: 6.43 }, note: "size not printed" },
  { name: "Chicken Leg Quarters, 10lb", category: "Meat", stores: { Walmart: { price: 8.72, size: "10lb", unitPrice: 0.87, unitLabel: "$/lb" } }, note: "Walmart only" },
  { name: "Fryer Thighs", category: "Meat", stores: { Costco: 11.59 }, note: "size not printed" },
  { name: "Whole Fryer Chicken", category: "Meat", stores: { Costco: 12.98 }, note: "each — size not printed" },
  { name: "Bacon, 16oz", category: "Meat", stores: { Walmart: { price: 6.97, size: "16oz", unitPrice: 6.97, unitLabel: "$/lb" } }, note: "Walmart only, thick cut" },
  { name: "Bratwurst", category: "Meat", stores: { Costco: 12.89 }, note: "size not printed" },
  { name: "Pork Ribs (St. Louis)", category: "Meat", stores: { Costco: 34.06 }, note: "size not printed" },
  { name: "Pork Rib Pieces", category: "Meat", stores: { Walmart: { price: 10.98, size: "2.2–3.15lb" } }, note: "Walmart only, weight-adjusted" },
  { name: "Rotisserie Chicken", category: "Prepared", stores: { Costco: 4.99 }, note: "each" },
  { name: "Shrimp", category: "Seafood", stores: { Costco: 15.44 }, note: "avg of 2 sizes, weight not printed" },

  { name: "Basmati Rice", category: "Pantry", stores: { Costco: 21.99, Walmart: { price: 9.52, size: "5lb", unitPrice: 1.90, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "Bread Flour, 5lb", category: "Pantry", stores: { Walmart: { price: 3.93, size: "5lb", unitPrice: 0.79, unitLabel: "$/lb" } }, note: "recurring, 3/3 Walmart orders" },
  { name: "Peanut Butter", category: "Pantry", stores: { Costco: 9.89 }, note: "size not printed" },
  { name: "Olive Oil", category: "Pantry", stores: { Costco: 10.79 }, note: "size not printed" },
  { name: "Oatmeal", category: "Pantry", stores: { Costco: 7.99, Walmart: { price: 2.98, size: "18oz", unitPrice: 2.65, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "Kidney Beans, 1lb", category: "Pantry", stores: { Walmart: { price: 1.22, size: "1lb", unitPrice: 1.22, unitLabel: "$/lb" } }, note: "recurring, 2/3 Walmart orders" },
  { name: "Black Beans, 1lb", category: "Pantry", stores: { Walmart: { price: 1.50, size: "1lb", unitPrice: 1.50, unitLabel: "$/lb" } }, note: "Walmart only" },
  { name: "Tomato Paste", category: "Pantry", stores: { Walmart: 1.36 }, note: "avg of a 6oz and 12oz can" },
  { name: "Sardines, 3.75oz can", category: "Pantry", stores: { Walmart: { price: 1.12, size: "3.75oz/can", unitPrice: 1.12, unitLabel: "$/can" } }, note: "recurring, 2/3 Walmart orders — consistent $1.12/can" },
  { name: "Cheerios", category: "Pantry", stores: { Costco: 4.89 }, note: "after coupon, size not printed" },
  { name: "Organic Chia", category: "Pantry", stores: { Costco: 8.99 }, note: "size not printed" },
  { name: "Organic Pasta", category: "Pantry", stores: { Costco: 10.79 }, note: "size not printed" },
  { name: "Pecans", category: "Pantry", stores: { Costco: 14.99, Walmart: { price: 3.82, size: "4oz", unitPrice: 15.28, unitLabel: "$/lb" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "Mayonnaise", category: "Pantry", stores: { Walmart: { price: 3.97, size: "16oz", unitPrice: 3.97, unitLabel: "$/lb" } }, note: "Walmart only" },
  { name: "Bouillon", category: "Pantry", stores: { Walmart: { price: 2.54, size: "7.9oz" } }, note: "Walmart only" },

  { name: "Frozen Broccoli, 10.8oz", category: "Frozen", stores: { Walmart: { price: 1.87, size: "10.8oz", unitPrice: 2.77, unitLabel: "$/lb" } }, note: "recurring, 2/3 Walmart orders" },
  { name: "Frozen Corn, 12oz", category: "Frozen", stores: { Walmart: { price: 0.98, size: "12oz", unitPrice: 1.31, unitLabel: "$/lb" } }, note: "recurring, 2/3 Walmart orders" },
  { name: "Ice Pops", category: "Frozen", stores: { Costco: 8.74 }, note: "avg of 2 items, size not printed" },

  { name: "Simply/Fresh OJ", category: "Beverages", stores: { Costco: 10.99, Walmart: { price: 4.46, size: "52fl oz" } }, sizeUnknown: true, note: "Costco size not printed" },
  { name: "SunnyD, 1gal", category: "Beverages", stores: { Walmart: 3.68 }, note: "recurring, 3/3 Walmart orders" },

  { name: "Potato Chips", category: "Snacks", stores: { Costco: { price: 7.79, size: "61.6oz", unitPrice: 2.02, unitLabel: "$/lb" }, Walmart: { price: 1.50, size: "8oz", unitPrice: 3.00, unitLabel: "$/lb" } }, note: "confirmed match — Costco is cheaper per lb" },

  { name: "Bath Tissue", category: "Household", stores: { Costco: 20.99 }, note: "pack" },
  { name: "Kitchen Cleaner", category: "Household", stores: { Walmart: 3.97 }, note: "22oz" },
  { name: "Copy Paper", category: "Household", stores: { Walmart: 5.77 }, note: "500 sheets" },
  { name: "Toothbrushes, 4pk", category: "Household", stores: { Walmart: 2.96 }, note: "" },
];

const CATEGORIES = [...new Set(CATALOG.map((i) => i.category))];

function priceOf(entry) {
  return typeof entry === "number" ? entry : entry.price;
}
function unitPriceOf(entry) {
  return typeof entry === "number" ? null : entry.unitPrice ?? null;
}
function unitLabelOf(entry) {
  return typeof entry === "number" ? null : entry.unitLabel ?? null;
}

function bestStore(stores) {
  const entries = Object.entries(stores);
  const allHaveUnit = entries.every(([, v]) => unitPriceOf(v) !== null);
  entries.sort((a, b) =>
    allHaveUnit ? unitPriceOf(a[1]) - unitPriceOf(b[1]) : priceOf(a[1]) - priceOf(b[1])
  );
  return [entries[0][0], priceOf(entries[0][1])];
}

export default function HouseholdLedger() {
  const [cadence, setCadence] = useState("Week");
  const [budget, setBudget] = useState(200);
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState(CATEGORIES[0]);
  const [list, setList] = useState([]);
  const [storeRows, setStoreRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [finalized, setFinalized] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmClearTimeout = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const scanMessageTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(null);
  const voiceMessageTimeout = useRef(null);
  const recognitionRef = useRef(null);
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = !!SpeechRecognitionAPI;

  // Maps a ShoppingList row from the sheet back into the shape the UI expects,
  // reattaching the matching CATALOG entry so stores/notes/sizeUnknown still work.
  function rowToListItem(row) {
    const catalogEntry = CATALOG.find((c) => c.name === row.item);
    return {
      name: row.item,
      category: row.category,
      note: catalogEntry?.note,
      sizeUnknown: catalogEntry?.sizeUnknown,
      stores: catalogEntry?.stores || { [row.store]: Number(row.price) },
      store: row.store,
      price: Number(row.price),
      qty: Number(row.qty),
    };
  }

  const callWebhook = useCallback(async (body) => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    return res.json();
  }, []);

  const applyServerState = (data) => {
    setList((data.list || []).filter((r) => r.item).map(rowToListItem));
    if (data.budget) setBudget(Number(data.budget));
    if (data.cadence) setCadence(data.cadence);
    setStoreRows(data.stores || []);
  };

  const refresh = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({ action: "get" });
      applyServerState(data);
    } catch {
      setError("Couldn't reach the server — showing last known list.");
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [callWebhook]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      clearTimeout(confirmClearTimeout.current);
      clearTimeout(scanMessageTimeout.current);
      clearTimeout(voiceMessageTimeout.current);
      recognitionRef.current?.abort();
    };
  }, []);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function scanReceipt(file) {
    setScanning(true);
    setScanMessage(null);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch(INGEST_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: file.type }),
      });
      const data = await res.json();
      if (data.ok) {
        const skippedNote = data.skippedCount
          ? ` (${data.skippedCount} line${data.skippedCount === 1 ? "" : "s"} skipped — unreadable price)`
          : "";
        const deliveryNote = data.deliveryFee ? ` (includes $${data.deliveryFee.toFixed(2)} delivery)` : "";
        setScanMessage({
          type: "success",
          text: `Logged ${data.itemsLogged} item${data.itemsLogged === 1 ? "" : "s"} from ${data.store}, total $${data.total.toFixed(2)}${deliveryNote}${skippedNote}.`,
        });
      } else {
        setScanMessage({ type: "error", text: data.reason || "Couldn't read that receipt." });
      }
    } catch {
      setScanMessage({ type: "error", text: "Couldn't reach the server — try again." });
    } finally {
      setScanning(false);
      scanMessageTimeout.current = setTimeout(() => setScanMessage(null), 7000);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) scanReceipt(file);
  }

  // Voice commands: transcript capture happens entirely client-side (Web Speech
  // API), then the raw transcript is sent to the same list/budget webhook the
  // rest of the app already uses -- the List/Budget Webhook Agent's Route
  // Voice Intent branch does the LLM parsing + catalog validation server-side.
  async function sendVoiceCommand(transcript) {
    setSyncing(true);
    setVoiceMessage(null);
    try {
      const data = await callWebhook({ action: "voice", transcript });
      applyServerState(data);
      setVoiceMessage({ type: "success", text: data.voiceReply || "Done." });
    } catch {
      setVoiceMessage({ type: "error", text: "Couldn't reach the server — try again." });
    } finally {
      setSyncing(false);
      voiceMessageTimeout.current = setTimeout(() => setVoiceMessage(null), 7000);
    }
  }

  function toggleListening() {
    if (!voiceSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendVoiceCommand(transcript);
    };
    recognition.onerror = () => {
      setVoiceMessage({ type: "error", text: "Didn't catch that — try again." });
      voiceMessageTimeout.current = setTimeout(() => setVoiceMessage(null), 7000);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  async function addItem(item) {
    const existing = list.find((p) => p.name === item.name);
    const [store, storePrice] = bestStore(item.stores);
    const qty = existing ? existing.qty + 1 : 1;
    const useStore = existing ? existing.store : store;
    const usePrice = existing ? existing.price : storePrice;

    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({
        action: "upsert",
        item: item.name,
        category: item.category,
        store: useStore,
        price: usePrice,
        qty,
        cadence,
      });
      applyServerState(data);
    } catch {
      setError("Couldn't save that to the server — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function setQty(name, qty) {
    const item = list.find((p) => p.name === name);
    if (!item) return;
    setSyncing(true);
    setError(null);
    try {
      const data =
        qty <= 0
          ? await callWebhook({ action: "remove", item: name })
          : await callWebhook({
              action: "upsert",
              item: name,
              category: item.category,
              store: item.store,
              price: item.price,
              qty,
              cadence,
            });
      applyServerState(data);
    } catch {
      setError("Couldn't update that quantity — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function setStoreFor(name, store) {
    const item = list.find((p) => p.name === name);
    if (!item) return;
    const newPrice = priceOf(item.stores[store]);
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({
        action: "upsert",
        item: name,
        category: item.category,
        store,
        price: newPrice,
        qty: item.qty,
        cadence,
      });
      applyServerState(data);
    } catch {
      setError("Couldn't switch stores — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function removeItem(name) {
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({ action: "remove", item: name });
      applyServerState(data);
    } catch {
      setError("Couldn't remove that item — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function clearAll() {
    if (list.length === 0) return;
    if (!confirmingClear) {
      setConfirmingClear(true);
      confirmClearTimeout.current = setTimeout(() => setConfirmingClear(false), 3000);
      return;
    }
    clearTimeout(confirmClearTimeout.current);
    setConfirmingClear(false);
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({ action: "clear" });
      applyServerState(data);
    } catch {
      setError("Couldn't clear the list — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function finalizeList() {
    if (list.length === 0) return;
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({ action: "finalize" });
      applyServerState(data);
      setFinalized(true);
      setTimeout(() => setFinalized(false), 4000);
    } catch {
      setError("Couldn't send the finalized list — try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function loadLastList() {
    setSyncing(true);
    setError(null);
    try {
      const data = await callWebhook({ action: "recall" });
      applyServerState(data);
    } catch {
      setError("Couldn't load last saved list — try again.");
    } finally {
      setSyncing(false);
    }
  }

  const filteredCatalog = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return CATALOG.filter((i) => i.name.toLowerCase().includes(q));
  }, [query]);

  const total = list.reduce((s, p) => s + p.price * p.qty, 0);
  // Delivery fees: charged once per distinct store on the list that has a nonzero
  // delivery_fee on the Stores sheet -- flat fee only, no free-delivery-above-$X
  // threshold modeling yet (see household-ledger-sheets-schema.md Stores tab note).
  const storesUsed = [...new Set(list.map((p) => p.store).filter(Boolean))];
  const deliveryFees = storesUsed
    .map((storeName) => {
      const match = storeRows.find((s) => s.store === storeName);
      return { store: storeName, fee: match ? Number(match.delivery_fee) || 0 : 0 };
    })
    .filter((d) => d.fee > 0);
  const deliveryTotal = deliveryFees.reduce((s, d) => s + d.fee, 0);
  const grandTotal = total + deliveryTotal;
  const adjustedBudget = budget;
  const remaining = adjustedBudget - grandTotal;
  const over = remaining < 0;

  const recurring = CATALOG.filter((i) => /recurring/.test(i.note || ""));

  const syncStatusContent = syncing ? (
    <>
      <RefreshCw size={12} className="animate-spin" /> Syncing
    </>
  ) : error ? (
    <>
      <WifiOff size={12} className="text-[#E8756A]" /> Offline
    </>
  ) : (
    "Synced"
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0F1E3D] text-[#F2F0E6] font-serif">
      <style>{`
        .font-serif { font-family: Georgia, 'Times New Roman', serif; }
        .font-mono-tab { font-family: 'Courier New', Courier, monospace; }
        .dashed-top { background-image: repeating-linear-gradient(90deg, #33456B 0, #33456B 6px, transparent 6px, transparent 12px); height: 2px; }
      `}</style>

      <header className="border-b-2 border-[#F2F0E6] px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-0 max-w-5xl mx-auto">
        <div className="order-2 md:order-1 flex items-center justify-between md:block">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="text-xs uppercase tracking-widest font-bold text-[#0F1E3D] disabled:opacity-50 flex items-center gap-1.5 border border-[#E08A3E] rounded-sm bg-[#E08A3E] hover:bg-[#EFA05C] px-3 py-1.5"
          >
            {scanning ? (
              <>
                <RefreshCw size={12} className="animate-spin" /> Scanning
              </>
            ) : (
              <>
                <Camera size={12} /> Scan/Upload Receipt
              </>
            )}
          </button>
          <div className="md:hidden text-xs uppercase tracking-widest text-[#93A3C4] font-mono-tab flex items-center gap-1.5">
            {syncStatusContent}
          </div>
        </div>
        <div className="order-1 md:order-2 text-center">
          <h1 className="text-3xl tracking-tight" style={{ letterSpacing: "-0.01em" }}>
            Household Ledger
          </h1>
          <p className="text-sm text-[#B8C2D9] mt-1">
            Alpharetta / Milton, GA · prices from your last Costco &amp; Walmart runs
          </p>
        </div>
        <div className="hidden md:flex order-3 text-right text-xs uppercase tracking-widest text-[#93A3C4] font-mono-tab items-center gap-1.5 justify-end">
          {syncStatusContent}
        </div>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="border border-[#E8756A] bg-[#3D1F1C] text-[#E8756A] text-xs px-3 py-2 rounded-sm">
            {error}
          </div>
        </div>
      )}

      {scanMessage && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div
            className={`border text-xs px-3 py-2 rounded-sm ${
              scanMessage.type === "success"
                ? "border-[#6B9E71] bg-[#1B2E1F] text-[#6B9E71]"
                : "border-[#E8756A] bg-[#3D1F1C] text-[#E8756A]"
            }`}
          >
            {scanMessage.text}
          </div>
        </div>
      )}

      {voiceMessage && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div
            className={`border text-xs px-3 py-2 rounded-sm ${
              voiceMessage.type === "success"
                ? "border-[#6B9E71] bg-[#1B2E1F] text-[#6B9E71]"
                : "border-[#E8756A] bg-[#3D1F1C] text-[#E8756A]"
            }`}
          >
            {voiceMessage.text}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#93A3C4] mb-2">
              Cadence
            </label>
            <div className="flex gap-1 border border-[#3D5178] rounded-sm overflow-hidden">
              {["Day", "Week", "Month"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCadence(c)}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    cadence === c
                      ? "bg-[#3B6142] text-[#F2F0E6]"
                      : "bg-transparent text-[#B8C2D9] hover:bg-[#1B2E52]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-[#93A3C4] mb-2">
              Budget ({cadence.toLowerCase()})
            </label>
            <div className="flex items-center border border-[#3D5178] rounded-sm px-3 py-1.5 bg-[#16264A]">
              <span className="text-[#B8C2D9] mr-1 font-mono-tab">$</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className="w-full outline-none font-mono-tab bg-transparent"
              />
            </div>
            <p className="text-[10px] text-[#93A3C4] mt-1">
              Loaded from Settings — editing here doesn&apos;t write back yet (Settings sheet isn&apos;t wired for updates).
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-[#93A3C4] mb-2 flex items-center gap-1">
              <Search size={12} /> Find an item
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. milk, rice, chips..."
              className="w-full border border-[#3D5178] rounded-sm px-3 py-1.5 bg-[#16264A] outline-none focus:border-[#6B9E71]"
            />
            {filteredCatalog && (
              <div className="mt-2 border border-[#3D5178] rounded-sm bg-[#16264A] max-h-56 overflow-auto">
                {filteredCatalog.length === 0 && (
                  <div className="px-3 py-2 text-sm text-[#93A3C4]">No match in the catalog yet.</div>
                )}
                {filteredCatalog.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      addItem(item);
                      setQuery("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#1B2E52] flex justify-between items-center border-b border-[#3D5178] last:border-0"
                  >
                    <span>{item.name}</span>
                    <span className="font-mono-tab text-[#B8C2D9]">
                      ${bestStore(item.stores)[1].toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-[#93A3C4] mb-2">
              Browse catalog
            </div>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <button
                    onClick={() => setOpenCat(openCat === cat ? null : cat)}
                    className="w-full flex items-center justify-between py-1.5 text-sm text-left"
                  >
                    <span>{cat}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${openCat === cat ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openCat === cat && (
                    <div className="pl-2 pb-2 space-y-0.5">
                      {CATALOG.filter((i) => i.category === cat).map((item) => (
                        <button
                          key={item.name}
                          onClick={() => addItem(item)}
                          className="w-full flex justify-between items-center text-left text-sm py-1 px-2 rounded-sm hover:bg-[#1B2E52] group"
                        >
                          <span className="flex items-center gap-1.5">
                            {item.name}
                            {item.sizeUnknown && (
                              <AlertTriangle size={11} className="text-[#C98A2C]" />
                            )}
                          </span>
                          <Plus
                            size={13}
                            className="opacity-0 group-hover:opacity-100 text-[#6B9E71]"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {recurring.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-[#93A3C4] mb-2">
                Shows up every trip
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recurring.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => addItem(item)}
                    className="text-xs px-2 py-1 rounded-full border border-[#6B9E71] text-[#6B9E71] hover:bg-[#3B6142] hover:text-[#F2F0E6] transition-colors"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section>
          {loading ? (
            <div className="border border-dashed border-[#3D5178] rounded-sm py-16 text-center text-[#93A3C4] flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin" /> Loading your list…
            </div>
          ) : list.length === 0 ? (
            <div className="border border-dashed border-[#3D5178] rounded-sm py-16 text-center text-[#93A3C4] flex flex-col items-center gap-3">
              <span>Add items from the catalog to start this {cadence.toLowerCase()}&apos;s list.</span>
              <button
                onClick={loadLastList}
                disabled={syncing}
                className="text-xs uppercase tracking-widest text-[#93A3C4] hover:text-[#F2F0E6] disabled:opacity-50"
              >
                Load last list
              </button>
            </div>
          ) : (
            <div className="border border-[#F2F0E6] bg-[#16264A]">
              <div className="md:hidden divide-y divide-[#3D5178]">
                {list.map((item) => {
                  const storeNames = Object.keys(item.stores);
                  const lowest = bestStore(item.stores)[0];
                  return (
                    <div key={item.name} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {item.name}
                            {item.sizeUnknown && (
                              <span title={item.note}>
                                <AlertTriangle size={12} className="text-[#C98A2C]" />
                              </span>
                            )}
                          </div>
                          {item.note && !item.sizeUnknown && (
                            <div className="text-xs text-[#93A3C4]">{item.note}</div>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.name)}
                          className="shrink-0 text-[#93A3C4] hover:text-[#E8756A]"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {storeNames.length > 1 ? (
                          <select
                            value={item.store}
                            onChange={(e) => setStoreFor(item.name, e.target.value)}
                            className="border border-[#3D5178] rounded-sm text-xs px-1 py-0.5 bg-[#16264A]"
                          >
                            {storeNames.map((s) => (
                              <option key={s} value={s}>
                                {s} {s === lowest ? "(lowest)" : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#B8C2D9]">{item.store}</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setQty(item.name, item.qty - 1)}
                            className="p-0.5 border border-[#3D5178] rounded-sm hover:bg-[#1B2E52]"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-5 text-center font-mono-tab">{item.qty}</span>
                          <button
                            onClick={() => setQty(item.name, item.qty + 1)}
                            className="p-0.5 border border-[#3D5178] rounded-sm hover:bg-[#1B2E52]"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <div className="text-right font-mono-tab">
                          <div>${(item.price * item.qty).toFixed(2)}</div>
                          <div className="text-[10px] text-[#93A3C4]">
                            ${item.price.toFixed(2)} ea
                            {unitPriceOf(item.stores[item.store]) !== null && (
                              <>
                                {" "}
                                · {unitLabelOf(item.stores[item.store])}{" "}
                                {unitPriceOf(item.stores[item.store]).toFixed(2)}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-[#F2F0E6] text-left text-xs uppercase tracking-widest text-[#93A3C4]">
                    <th className="py-2 px-3 font-normal">Item</th>
                    <th className="py-2 px-3 font-normal">Store</th>
                    <th className="py-2 px-3 font-normal text-center">Qty</th>
                    <th className="py-2 px-3 font-normal text-right">Price</th>
                    <th className="py-2 px-3 font-normal text-right">Line</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => {
                    const storeNames = Object.keys(item.stores);
                    const lowest = bestStore(item.stores)[0];
                    return (
                      <tr key={item.name} className="border-b border-[#3D5178] last:border-0">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            {item.name}
                            {item.sizeUnknown && (
                              <span title={item.note}>
                                <AlertTriangle size={12} className="text-[#C98A2C]" />
                              </span>
                            )}
                          </div>
                          {item.note && !item.sizeUnknown && (
                            <div className="text-xs text-[#93A3C4]">{item.note}</div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {storeNames.length > 1 ? (
                            <select
                              value={item.store}
                              onChange={(e) => setStoreFor(item.name, e.target.value)}
                              className="border border-[#3D5178] rounded-sm text-xs px-1 py-0.5 bg-[#16264A]"
                            >
                              {storeNames.map((s) => (
                                <option key={s} value={s}>
                                  {s} {s === lowest ? "(lowest)" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-[#B8C2D9]">{item.store}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setQty(item.name, item.qty - 1)}
                              className="p-0.5 border border-[#3D5178] rounded-sm hover:bg-[#1B2E52]"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-5 text-center font-mono-tab">{item.qty}</span>
                            <button
                              onClick={() => setQty(item.name, item.qty + 1)}
                              className="p-0.5 border border-[#3D5178] rounded-sm hover:bg-[#1B2E52]"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tab">
                          ${item.price.toFixed(2)}
                          {unitPriceOf(item.stores[item.store]) !== null && (
                            <div className="text-[10px] text-[#93A3C4]">
                              {unitLabelOf(item.stores[item.store])}{" "}
                              {unitPriceOf(item.stores[item.store]).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tab">
                          ${(item.price * item.qty).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => removeItem(item.name)}
                            className="text-[#93A3C4] hover:text-[#E8756A]"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              <div className="dashed-top" />

              <div className="px-3 py-3 font-mono-tab text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                {deliveryTotal > 0 && (
                  <div className="flex justify-between text-[#93A3C4]">
                    <span>Delivery ({deliveryFees.map((d) => d.store).join(", ")})</span>
                    <span>${deliveryTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Budget ({cadence.toLowerCase()})</span>
                  <span>${adjustedBudget.toFixed(2)}</span>
                </div>
                <div
                  className={`flex justify-between text-base pt-1 border-t border-dashed border-[#3D5178] ${
                    over ? "text-[#E8756A]" : "text-[#6B9E71]"
                  }`}
                >
                  <span>{over ? "Over budget" : "Remaining"}</span>
                  <span>${Math.abs(remaining).toFixed(2)}</span>
                </div>
              </div>

              <div className="dashed-top" />

              <div className="px-3 py-3 flex items-center justify-between gap-3">
                <button
                  onClick={clearAll}
                  disabled={syncing}
                  className={`text-xs uppercase tracking-widest disabled:opacity-50 ${
                    confirmingClear
                      ? "text-[#E8756A] font-semibold"
                      : "text-[#93A3C4] hover:text-[#E8756A]"
                  }`}
                >
                  {confirmingClear ? "Confirm clear?" : "Clear all"}
                </button>
                <button
                  onClick={loadLastList}
                  disabled={syncing}
                  className="text-xs uppercase tracking-widest text-[#93A3C4] hover:text-[#F2F0E6] disabled:opacity-50"
                >
                  Load last list
                </button>
                <button
                  onClick={finalizeList}
                  disabled={syncing}
                  className="px-4 py-1.5 text-xs uppercase tracking-widest bg-[#3B6142] text-[#F2F0E6] rounded-sm hover:bg-[#2E4D34] disabled:opacity-50"
                >
                  {finalized ? "Sent ✓" : "Save list"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-[#93A3C4] flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#C98A2C]" />
            <span>
              Items marked with a caution icon have a price from both stores, but at least one
              store&apos;s pack size wasn&apos;t printed on the receipt — so the two totals aren&apos;t a real
              per-unit comparison yet. Only <strong>Eggs</strong> and <strong>Potato Chips</strong> have
              confirmed sizes on both sides right now; everything else needs a size (or a photo
              showing the weight/count) to turn into a true $/lb or $/ct comparison.
            </span>
          </div>
        </section>
      </main>

      {voiceSupported && (
        <button
          onClick={toggleListening}
          title={listening ? "Listening… tap to stop" : "Speak a command"}
          className={`fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full border flex items-center justify-center shadow-lg transition-colors ${
            listening
              ? "bg-[#E8756A] border-[#E8756A] text-[#0F1E3D] animate-pulse"
              : "bg-[#E08A3E] border-[#E08A3E] text-[#0F1E3D] hover:bg-[#EFA05C]"
          }`}
        >
          <Mic size={22} />
        </button>
      )}
    </div>
  );
}
