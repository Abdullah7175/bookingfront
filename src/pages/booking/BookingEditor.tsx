import React, { useMemo, useState } from "react";

/**
 * MtUmrah – Booking Editor (matches client revision)
 * + PNR section above Flights (5 characters)
 * + Flight Payments → selector (Credit Card | Installment) under Costing
 * Vite + React + TypeScript
 */

type VisaType = "Tourist" | "Umrah";

type Hotel = {
  id: string;
  name: string;
  checkIn: string;   // ISO date
  checkOut: string;  // ISO date
};

type VisaPassenger = {
  id: string;
  fullName: string;
  nationality: string;
  visaType: VisaType;
};

type TransportLeg = {
  id: string;
  from: string;
  to: string;
  vehicleType: "Sedan" | "SUV" | "GMC" | "COSTER" | "BUS";
  date: string; // ISO date
  time: string; // HH:MM
};

type CostRow = {
  id: string;
  item: string;
  quantity: number;
  costPerQty: number;
  salePerQty: number;
};

type PaymentMode = "credit-card" | "installment";

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export default function BookingEditor() {
  /* ------------------------------- PNR ------------------------------- */
  const [pnr, setPnr] = useState<string>("");
  const onPnrChange = (v: string) => {
    const cleaned = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
    setPnr(cleaned);
  };
  const isPnrValid = pnr.length === 5;

  /* ------------------------------- Flights ------------------------------- */
  const [rawItinerary, setRawItinerary] = useState<string>("");
  const itineraryLines = useMemo(
    () =>
      rawItinerary
        .replace(/\r/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [rawItinerary]
  );

  /* -------------------------------- Hotels ------------------------------ */
  const [hotels, setHotels] = useState<Hotel[]>([
    { id: uid("hotel"), name: "", checkIn: "", checkOut: "" },
  ]);
  const addHotel = () =>
    setHotels((s) => [...s, { id: uid("hotel"), name: "", checkIn: "", checkOut: "" }]);
  const removeHotel = (id: string) => setHotels((s) => s.filter((h) => h.id !== id));
  const updateHotel = (id: string, patch: Partial<Hotel>) =>
    setHotels((s) => s.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  /* --------------------------------- Visas ------------------------------ */
  const [visaCount, setVisaCount] = useState<number>(0);
  const [visaPassengers, setVisaPassengers] = useState<VisaPassenger[]>([]);
  const syncVisaPassengers = (count: number) => {
    setVisaCount(count);
    setVisaPassengers((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({
          id: uid("visa"),
          fullName: "",
          nationality: "",
          visaType: "Umrah",
        });
      }
      return next.slice(0, count);
    });
  };
  const updateVisaPassenger = (id: string, patch: Partial<VisaPassenger>) =>
    setVisaPassengers((s) => s.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /* --------------------------- Transportation --------------------------- */
  const [legCount, setLegCount] = useState<number>(0);
  const [legs, setLegs] = useState<TransportLeg[]>([]);
  const syncLegs = (count: number) => {
    setLegCount(count);
    setLegs((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({
          id: uid("leg"),
          from: "",
          to: "",
          vehicleType: "Sedan",
          date: "",
          time: "",
        });
      }
      return next.slice(0, count);
    });
  };
  const updateLeg = (id: string, patch: Partial<TransportLeg>) =>
    setLegs((s) => s.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  /* -------------------------------- Costing ----------------------------- */
  const [rows, setRows] = useState<CostRow[]>([
    { id: uid("row"), item: "Flights",        quantity: 0, costPerQty: 0, salePerQty: 0 },
    { id: uid("row"), item: "Makkah Hotel",   quantity: 0, costPerQty: 0, salePerQty: 0 },
    { id: uid("row"), item: "Madinah Hotel",  quantity: 0, costPerQty: 0, salePerQty: 0 },
    { id: uid("row"), item: "Visa(s)",        quantity: 0, costPerQty: 0, salePerQty: 0 },
    { id: uid("row"), item: "Transportation", quantity: 0, costPerQty: 0, salePerQty: 0 },
  ]);
  const addCostRow = () =>
    setRows((s) => [...s, { id: uid("row"), item: "Other Service", quantity: 0, costPerQty: 0, salePerQty: 0 }]);
  const removeCostRow = (id: string) => setRows((s) => s.filter((r) => r.id !== id));
  const updateRow = (id: string, patch: Partial<CostRow>) =>
    setRows((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const totals = useMemo(() => {
    const totalCost = rows.reduce((sum, r) => sum + (r.quantity || 0) * (r.costPerQty || 0), 0);
    const totalSale = rows.reduce((sum, r) => sum + (r.quantity || 0) * (r.salePerQty || 0), 0);
    const profit = totalSale - totalCost;
    return { totalCost, totalSale, profit };
  }, [rows]);

  const money = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";

  /* ------------------------- Flight Payments state ------------------------- */
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("credit-card");

  // Credit Card (one-time)
  const [ccAmount, setCcAmount] = useState<number>(0);
  const [ccPaidOn, setCcPaidOn] = useState<string>(""); // ISO date

  // Installment plan
  const [tixTotal, setTixTotal] = useState<number>(0);
  const [advPaid, setAdvPaid] = useState<number>(0);
  const [numInst, setNumInst] = useState<number>(0);
  const [instStart, setInstStart] = useState<string>(""); // ISO date

  // computed for installment
  const remaining = Math.max(0, (tixTotal || 0) - (advPaid || 0));
  const perInstallment = numInst > 0 ? remaining / numInst : 0;

  // simple monthly schedule (instStart + i months)
  const installmentSchedule = useMemo(() => {
    if (!instStart || numInst <= 0 || remaining <= 0) return [];
    const start = new Date(instStart + "T00:00:00");
    const items = [];
    for (let i = 0; i < numInst; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      items.push({
        no: i + 1,
        date: d.toISOString().slice(0, 10),
        amount: perInstallment,
      });
    }
    return items;
  }, [instStart, numInst, remaining, perInstallment]);

  /* ----------------------- Save state & helpers (ADDED) ----------------------- */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // --- Booking Details (required by backend) ---
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [bookingPackage, setBookingPackage] = useState<string>(""); // maps to 'package'
  const [travelDate, setTravelDate] = useState<string>("");         // ISO date string (yyyy-mm-dd)

  const buildPayload = () => ({
    // REQUIRED by backend
    customerName,
    customerEmail,
    package: bookingPackage,
    date: travelDate,

    // existing structure
    pnr,
    flights: { raw: rawItinerary, itineraryLines },
    hotels,
    visas: { count: visaCount, passengers: visaPassengers },
    transportation: { count: legCount, legs },
    costing: { rows, totals },
    flightPayments: {
      mode: paymentMode,
      creditCard:
        paymentMode === "credit-card" ? { amount: ccAmount, paidOn: ccPaidOn } : null,
      installment:
        paymentMode === "installment"
          ? {
              ticketTotal: tixTotal,
              advancePaid: advPaid,
              numberOfInstallments: numInst,
              startDate: instStart,
              remaining,
              perInstallment,
              schedule: installmentSchedule,
            }
          : null,
    },
  });

  const canSave = () => {
    if (pnr.length !== 6) return false;
    if (!customerName || !customerEmail || !bookingPackage || !travelDate) return false;
    return true;
  };

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:7000";

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const token = localStorage.getItem("token"); // or get from your AuthContext

      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildPayload()),
        // credentials: "include", // ← leave this OFF for pure Bearer-token auth
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed: ${res.status}`);
      }
      await res.json().catch(() => ({}));
      setSaveOk("Booking saved successfully.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to save booking.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Booking</h1>
        <div className="text-sm opacity-70">MtUmrah Admin</div>
      </header>

      {/* Booking Details (required) */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold">Booking Details</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Customer Name *</label>
            <input
              className="border rounded-md p-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g., Ahmed Ali"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Customer Email *</label>
            <input
              type="email"
              className="border rounded-md p-2"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="e.g., ahmed@example.com"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Package *</label>
            <input
              className="border rounded-md p-2"
              value={bookingPackage}
              onChange={(e) => setBookingPackage(e.target.value)}
              placeholder="e.g., Umrah Basic"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Date *</label>
            <input
              type="date"
              className="border rounded-md p-2"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">Fields marked * are required to save.</p>
      </section>

      {/* PNR (exactly 5 characters) */}
      <section className="bg-white rounded-xl shadow p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">PNR</h2>
          <span className={`text-xs ${isPnrValid ? "text-green-600" : "text-slate-500"}`}>
            {pnr.length}/6
          </span>
        </div>
        <input
          className={`border rounded-md p-3 max-w-sm tracking-widest font-mono uppercase ${
            isPnrValid ? "border-green-400" : "border-slate-300"
          }`}
          placeholder="ABCDE"
          value={pnr}
          onChange={(e) => onPnrChange(e.target.value)}
          maxLength={6}
         
          aria-label="PNR (6 characters)"
        />
        <p className="text-xs text-slate-500">Enter exactly 6 letters/numbers. (Auto-uppercased)</p>
      </section>

      {/* Flights */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold">Flights (paste itinerary)</h2>
        <textarea
          placeholder={`1: TK1234 12OCT JFK IST 1200P 1050A 13OCT\n2: TK5467 13OCT IST JED 1400P 2200P\n...`}
          className="w-full h-32 rounded-md border p-3"
          value={rawItinerary}
          onChange={(e) => setRawItinerary(e.target.value)}
        />
        {itineraryLines.length > 0 && (
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium mb-2">Itinerary (as pasted)</p>
            <ul className="space-y-1">
              {itineraryLines.map((l, i) => (
                <li key={i} className="font-mono text-sm">{l}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Hotels */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hotels</h2>
          <button onClick={addHotel} className="px-3 py-1.5 rounded-md border">
            + Add Hotel
          </button>
        </div>
        <div className="space-y-3">
          {hotels.map((h) => (
            <div key={h.id} className="grid md:grid-cols-4 gap-3 border p-3 rounded-lg">
              <input
                className="border rounded-md p-2"
                placeholder="Hotel name"
                value={h.name}
                onChange={(e) => updateHotel(h.id, { name: e.target.value })}
              />
              <input
                type="date"
                className="border rounded-md p-2"
                value={h.checkIn}
                onChange={(e) => updateHotel(h.id, { checkIn: e.target.value })}
              />
              <input
                type="date"
                className="border rounded-md p-2"
                value={h.checkOut}
                onChange={(e) => updateHotel(h.id, { checkOut: e.target.value })}
              />
              <div className="flex items-center">
                <button onClick={() => removeHotel(h.id)} className="ml-auto px-3 py-1.5 rounded-md border">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Visa(s) */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold">Visa(s)</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm">Number of visas</label>
          <input
            type="number"
            min={0}
            className="w-28 border rounded-md p-2"
            value={visaCount}
            onChange={(e) => syncVisaPassengers(Math.max(0, Number(e.target.value || 0)))}
          />
        </div>

        {visaPassengers.length > 0 && (
          <div className="space-y-3">
            {visaPassengers.map((p, idx) => (
              <div key={p.id} className="grid md:grid-cols-4 gap-3 border p-3 rounded-lg">
                <input
                  className="border rounded-md p-2"
                  placeholder={`Passenger ${idx + 1} full name`}
                  value={p.fullName}
                  onChange={(e) => updateVisaPassenger(p.id, { fullName: e.target.value })}
                />
                <input
                  className="border rounded-md p-2"
                  placeholder="Nationality"
                  value={p.nationality}
                  onChange={(e) => updateVisaPassenger(p.id, { nationality: e.target.value })}
                />
                <select
                  className="border rounded-md p-2"
                  value={p.visaType}
                  onChange={(e) => updateVisaPassenger(p.id, { visaType: e.target.value as VisaType })}
                >
                  <option value="Umrah">Umrah</option>
                  <option value="Tourist">Tourist</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transportation */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold">Transportation</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm">Number of legs</label>
          <input
            type="number"
            min={0}
            className="w-28 border rounded-md p-2"
            value={legCount}
            onChange={(e) => syncLegs(Math.max(0, Number(e.target.value || 0)))}
          />
        </div>

        {legs.length > 0 && (
          <div className="space-y-3">
            {legs.map((l, idx) => (
              <div key={l.id} className="grid md:grid-cols-6 gap-3 border p-3 rounded-lg">
                <input
                  className="border rounded-md p-2"
                  placeholder={`Leg ${idx + 1} — From`}
                  value={l.from}
                  onChange={(e) => updateLeg(l.id, { from: e.target.value })}
                />
                <input
                  className="border rounded-md p-2"
                  placeholder="To"
                  value={l.to}
                  onChange={(e) => updateLeg(l.id, { to: e.target.value })}
                />
                <select
                  className="border rounded-md p-2"
                  value={l.vehicleType}
                  onChange={(e) => updateLeg(l.id, { vehicleType: e.target.value as TransportLeg["vehicleType"] })}
                >
                  <option>Sedan</option>
                  <option>SUV</option>
                  <option>GMC</option>
                  <option>COSTER</option>
                  <option>BUS</option>
                </select>
                <input
                  type="date"
                  className="border rounded-md p-2"
                  value={l.date}
                  onChange={(e) => updateLeg(l.id, { date: e.target.value })}
                />
                <input
                  type="time"
                  className="border rounded-md p-2"
                  value={l.time}
                  onChange={(e) => updateLeg(l.id, { time: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Costing */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Costing</h2>
          <button onClick={addCostRow} className="px-3 py-1.5 rounded-md border">
            + Add Service
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Service</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Cost / Qty</th>
                <th className="text-right p-2">Sale / Qty</th>
                <th className="text-right p-2">Total Cost</th>
                <th className="text-right p-2">Total Sale</th>
                <th className="text-right p-2">Profit</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowCost = (r.quantity || 0) * (r.costPerQty || 0);
                const rowSale = (r.quantity || 0) * (r.salePerQty || 0);
                return (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">
                      <input
                        className="border rounded-md p-2 w-full"
                        value={r.item}
                        onChange={(e) => updateRow(r.id, { item: e.target.value })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        className="border rounded-md p-2 w-24 text-right"
                        value={r.quantity}
                        onChange={(e) => updateRow(r.id, { quantity: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        className="border rounded-md p-2 w-28 text-right"
                        value={r.costPerQty}
                        onChange={(e) => updateRow(r.id, { costPerQty: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        className="border rounded-md p-2 w-28 text-right"
                        value={r.salePerQty}
                        onChange={(e) => updateRow(r.id, { salePerQty: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="p-2 text-right font-medium">{money(rowCost)}</td>
                    <td className="p-2 text-right font-medium">{money(rowSale)}</td>
                    <td className="p-2 text-right font-medium">{money(rowSale - rowCost)}</td>
                    <td className="p-2">
                      <button onClick={() => removeCostRow(r.id)} className="px-2 py-1 rounded-md border">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="p-2 text-right" colSpan={4}>
                  Totals
                </td>
                <td className="p-2 text-right">{money(totals.totalCost)}</td>
                <td className="p-2 text-right">{money(totals.totalSale)}</td>
                <td className="p-2 text-right">{money(totals.profit)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Flight Payments */}
      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Flight Payments</h2>

          {/* Selection: Credit Card vs Installment */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Payment Type</label>
            <select
              className="border rounded-md p-2"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            >
              <option value="credit-card">Credit Card</option>
              <option value="installment">Installment</option>
            </select>
          </div>
        </div>

        {/* Credit Card (one-time payment) */}
        {paymentMode === "credit-card" && (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className="text-sm text-slate-600 mb-1">Amount Paid</label>
              <input
                type="number"
                className="border rounded-md p-2"
                value={ccAmount}
                onChange={(e) => setCcAmount(Number(e.target.value || 0))}
                placeholder="e.g., 2500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-slate-600 mb-1">Paid On</label>
              <input
                type="date"
                className="border rounded-md p-2"
                value={ccPaidOn}
                onChange={(e) => setCcPaidOn(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-slate-600">
                <span className="font-medium">Summary:</span>{" "}
                Paid {money(ccAmount)} on {ccPaidOn || "—"}
              </div>
            </div>
          </div>
        )}

        {/* Installment Plan */}
        {paymentMode === "installment" && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Ticket Total</label>
                <input
                  type="number"
                  className="border rounded-md p-2"
                  value={tixTotal}
                  onChange={(e) => setTixTotal(Number(e.target.value || 0))}
                  placeholder="e.g., 3000"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Advance Paid</label>
                <input
                  type="number"
                  className="border rounded-md p-2"
                  value={advPaid}
                  onChange={(e) => setAdvPaid(Number(e.target.value || 0))}
                  placeholder="e.g., 500"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1"># of Installments</label>
                <input
                  type="number"
                  min={0}
                  className="border rounded-md p-2"
                  value={numInst}
                  onChange={(e) => setNumInst(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  className="border rounded-md p-2"
                  value={instStart}
                  onChange={(e) => setInstStart(e.target.value)}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Remaining</label>
                <input
                  className="border rounded-md p-2 bg-gray-50"
                  value={money(remaining)}
                  readOnly
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Per-Installment Amount</label>
                <input
                  className="border rounded-md p-2 bg-gray-50"
                  value={money(perInstallment)}
                  readOnly
                />
              </div>
            </div>

            {installmentSchedule.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Due Date</th>
                      <th className="text-right p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installmentSchedule.map((it) => (
                      <tr key={it.no} className="border-b">
                        <td className="p-2">{it.no}</td>
                        <td className="p-2">{it.date}</td>
                        <td className="p-2 text-right">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Save / Submit (ADDED) */}
      <section className="bg-white rounded-xl shadow p-5 space-y-3">
        {saveError && (
          <div className="text-sm text-red-600 border border-red-200 rounded-md p-2">
            {saveError}
          </div>
        )}
        {saveOk && (
          <div className="text-sm text-green-700 border border-green-200 rounded-md p-2">
            {saveOk}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !canSave()}
          className={`px-4 py-2 rounded-md text-white ${
            saving || !canSave() ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {saving ? "Saving..." : "Save Booking"}
        </button>
        {!canSave() && (
          <p className="text-xs text-slate-500">
            Make sure PNR is exactly 6 characters (and any other required fields) before saving.
          </p>
        )}
      </section>
    </div>
  );
}
