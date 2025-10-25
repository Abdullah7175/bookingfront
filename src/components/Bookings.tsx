import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import BookingModal from './BookingModal';
import { http } from '../lib/http';
import {
  Search,
  Plus,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Download,
  Ticket,
  Settings, // for Status button icon
} from 'lucide-react';

/* =========================
   Helpers / Types
   ========================= */

type UiBooking = {
  id: string;
  customer: string;
  email: string;
  phone: string;
  package: string;
  departureDate: string; // YYYY-MM-DD or ''
  returnDate: string; // YYYY-MM-DD or ''
  status: 'pending' | 'confirmed' | 'cancelled' | string;
  amount: number;
  agentId?: string;
  agentName?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | string;

  // NEW (optional display fields)
  pnr?: string;
  flightPaymentMethod?: 'credit_card' | 'installments' | string;

  // enrichment used in card details (kept as any to be tolerant)
  flight?: any;
  hotel?: any;
  visa?: any;
  transport?: any;
  payment?: any;
  passengers?: any;
  adults?: any;
  children?: any;
  paymentMethod?: any;
  packagePrice?: any;
  additionalServices?: any;

  // Optionally present on some APIs:
  pricing?: any;
  hotels?: any[];
  visas?: any[];
};

function formatDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.valueOf())) return '';
  return dt.toISOString().slice(0, 10);
}

function toNumberMaybe(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number((v as string).replace?.(/[$,]/g, '') ?? v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function currency(n: number) {
  try {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    });
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

function cleanDate(d?: string) {
  if (!d) return '';
  const t = new Date(d);
  return Number.isNaN(t.valueOf()) ? d : t.toISOString().slice(0, 10);
}

function ensureArray<T>(v: T[] | T | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** Build a normalized object for PDF so every section exists */
function normalizeForPdf(b: any) {
  // Handle both legacy and new data structures
  const hotels = ensureArray(b?.hotels).length ? ensureArray(b.hotels) : (b?.hotel ? [b.hotel] : []);
  const visas = b?.visas?.passengers ? ensureArray(b.visas.passengers) : (b?.visas ? ensureArray(b.visas) : []);
  const legs = b?.transportation?.legs ? ensureArray(b.transportation.legs) : (b?.legs ? ensureArray(b.legs) : []);
  const costingRows = b?.costing?.rows ? ensureArray(b.costing.rows) : (b?.pricing?.table ? ensureArray(b.pricing.table) : (b?.costingRows ? ensureArray(b.costingRows) : []));

  return {
    id: b?._id || b?.id || '',
    customerName: b?.customerName || b?.customer || '',
    email: b?.customerEmail || b?.email || '',
    phone: b?.contactNumber || b?.phone || '',
    agentName: b?.agent?.name || b?.agentName || '',
    pkg: b?.package || b?.pricing?.packageName || '',
    status: b?.status || 'pending',
    approvalStatus: b?.approvalStatus || 'pending',

    dates: {
      bookingDate: cleanDate(b?.date),
      departureDate: cleanDate(b?.flight?.departureDate || b?.departureDate),
      returnDate: cleanDate(b?.flight?.returnDate || b?.returnDate),
    },

    flight: {
      itinerary: b?.flights?.raw || b?.flight?.itinerary || '',
      route: [b?.flight?.departureCity || b?.departureCity, b?.flight?.arrivalCity || b?.arrivalCity].filter(Boolean).join(' → '),
      class: b?.flight?.flightClass || b?.flightClass || '',
      pnr: (b?.flight?.pnr || b?.pnr || '').toUpperCase(),
      payment: b?.flightPayments?.mode || b?.flight?.paymentMethod || '',
    },

    hotels: hotels.map((h: any) => ({
      hotelName: h?.hotelName || h?.name || '',
      roomType: h?.roomType || '',
      checkIn: cleanDate(h?.checkIn),
      checkOut: cleanDate(h?.checkOut),
    })),

    visas: visas.map((v: any) => ({
      name: v?.fullName || v?.name || '',
      nationality: v?.nationality || '',
      visaType: v?.visaType || b?.visaType || '',
    })),

    transport: {
      pickupLocation: b?.transport?.pickupLocation || b?.pickupLocation || '',
      transportType: b?.transport?.transportType || b?.transportType || '',
      legs: legs.map((l: any) => ({
        from: l?.from || '',
        to: l?.to || '',
        vehicleType: l?.vehicleType || '',
        date: cleanDate(l?.date),
        time: l?.time || '',
      })),
    },

    pricing: {
      totals: {
        totalCostPrice: b?.costing?.totals?.totalCost ?? b?.pricing?.totals?.totalCostPrice ?? 0,
        totalSalePrice: b?.costing?.totals?.totalSale ?? b?.pricing?.totals?.totalSalePrice ?? b?.amount ?? b?.totalAmount ?? 0,
        profit: b?.costing?.totals?.profit ?? b?.pricing?.totals?.profit ?? 0,
      },
      table: costingRows.map((r: any) => ({
        label: r?.label ?? r?.item ?? '',
        quantity: Number(r?.quantity ?? 0),
        costPerQty: Number(r?.costPerQty ?? 0),
        salePerQty: Number(r?.salePerQty ?? 0),
        totalCost: r?.totalCost ?? Number(r?.quantity ?? 0) * Number(r?.costPerQty ?? 0),
        totalSale: r?.totalSale ?? Number(r?.quantity ?? 0) * Number(r?.salePerQty ?? 0),
        profit: r?.profit ?? (Number(r?.quantity ?? 0) * Number(r?.salePerQty ?? 0)) - (Number(r?.quantity ?? 0) * Number(r?.costPerQty ?? 0)),
      })),
      packagePrice: Number(b?.packagePrice ?? b?.pricing?.packagePrice ?? 0),
      additionalServices: b?.additionalServices ?? b?.pricing?.additionalServices ?? '',
      paymentMethod: b?.paymentMethod ?? b?.pricing?.paymentMethod ?? '',
    },

    payment: {
      method: b?.flightPayments?.mode || b?.payment?.method || b?.paymentMethod || '',
      cardLast4: b?.payment?.cardLast4 || b?.cardLast4 || '',
      cardholderName: b?.payment?.cardholderName || b?.cardholderName || '',
      expiryDate: b?.payment?.expiryDate || b?.expiryDate || '',
    },

    pax: {
      passengers: b?.passengers ?? '',
      adults: b?.adults ?? '',
      children: b?.children ?? '',
    },
  };
}

/** Normalize API booking -> UI booking */
function mapBooking(b: any): UiBooking {
  const id =
    b?._id ||
    b?.id ||
    (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
  const customer = b?.customerName ?? b?.customer ?? 'Unknown';
  const email = b?.customerEmail ?? b?.email ?? '';
  const phone = b?.contactNumber ?? b?.phone ?? '';
  const pkg = b?.package ?? b?.pricing?.packageName ?? '—';

  const amount =
    toNumberMaybe(b?.amount) || toNumberMaybe(b?.pricing?.totalAmount) || toNumberMaybe(b?.totalAmount) || 0;

  const dep = b?.flight?.departureDate ?? b?.departureDate ?? '';
  const ret = b?.flight?.returnDate ?? b?.returnDate ?? '';

  const status = (b?.status ?? 'pending') as UiBooking['status'];
  const approvalStatus = b?.approvalStatus ?? 'pending';

  const agentId = b?.agentId ?? b?.agent?._id ?? b?.agent?.id;
  const agentName = b?.agentName ?? b?.agent?.name ?? '';

  // NEW: pnr & flightPaymentMethod (accept flat or nested)
  const pnr = b?.pnr ?? b?.flight?.pnr ?? '';
  const flightPaymentMethod = b?.flightPaymentMethod ?? b?.flight?.paymentMethod ?? undefined;

  return {
    id,
    customer,
    email,
    phone,
    package: pkg,
    departureDate: formatDate(dep),
    returnDate: formatDate(ret),
    status,
    amount,
    agentId,
    agentName,
    approvalStatus,
    pnr,
    flightPaymentMethod,
    // Include detailed information for enhanced display
    flight: b?.flight,
    hotel: b?.hotel,
    visa: b?.visa,
    transport: b?.transport,
    payment: b?.payment,
    passengers: b?.passengers,
    adults: b?.adults,
    children: b?.children,
    paymentMethod: b?.paymentMethod,
    packagePrice: b?.packagePrice,
    additionalServices: b?.additionalServices,
    pricing: b?.pricing,
    hotels: b?.hotels,
    visas: b?.visas,
  };
}

/* =========================
   Component
   ========================= */

const Bookings: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<UiBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Full Edit modal (BookingModal in edit mode)
  const [isFullEditOpen, setIsFullEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Status-only modal (existing)
  const [editingBooking, setEditingBooking] = useState<UiBooking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [groupByCustomer, setGroupByCustomer] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchBookings = async () => {
    setLoading(true);
    setErr('');
    try {
      const url = isAdmin ? '/api/bookings' : '/api/bookings/my';
      const { data } = await http.get(url);
      const list = Array.isArray(data) ? data : data?.bookings ?? [];
      setBookings(list.map(mapBooking));
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        e?.message ||
        'Failed to load bookings';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleCreateBooking = async (created: any) => {
    const ui = mapBooking(created);
    setBookings((prev) => [ui, ...prev]);
  };

  const handleDelete = async (id: string) => {
    const yes = window.confirm('Delete this booking?');
    if (!yes) return;
    const prev = bookings;
    setBookings((p) => p.filter((b) => b.id !== id));
    try {
      await http.delete(`/api/bookings/${id}`);
    } catch {
      setBookings(prev);
      alert('Delete failed');
    }
  };

  // Status-only edit (old behavior)
  const handleEditStatus = (booking: UiBooking) => {
    setEditingBooking(booking);
    setIsEditModalOpen(true);
  };

  // NEW: Full edit opens BookingModal with initialData + bookingId
  const handleOpenFullEdit = (booking: UiBooking) => {
    // Hydrate initialData matching BookingModal's BookingFormData
    const initialData = {
      // contact
      name: booking.customer,
      email: booking.email,
      contactNumber: booking.phone,
      passengers: booking.passengers ?? '',
      adults: booking.adults ?? '',
      children: booking.children ?? '',

      // flights
      departureCity: booking.flight?.departureCity ?? (booking as any)['departureCity'] ?? '',
      arrivalCity: booking.flight?.arrivalCity ?? (booking as any)['arrivalCity'] ?? '',
      departureDate: booking.flight?.departureDate ?? (booking as any)['departureDate'] ?? '',
      returnDate: booking.flight?.returnDate ?? (booking as any)['returnDate'] ?? '',
      flightClass: booking.flight?.flightClass ?? 'economy',
      pnr: booking.flight?.pnr ?? booking.pnr ?? '',
      flightsItinerary: booking.flight?.itinerary ?? '',

      // hotels
      hotels: Array.isArray(booking.hotels) ? booking.hotels : booking.hotel ? [booking.hotel] : [],

      // visas
      visas: Array.isArray(booking.visas) ? booking.visas : booking.visa ? [booking.visa] : [],
      visasCount: Array.isArray(booking.visas) ? booking.visas.length : booking.visa ? 1 : 0,

      // transport
      legs: booking.transport?.legs ?? [],
      legsCount: booking.transport?.legs?.length ?? 0,
      transportType: booking.transport?.transportType ?? 'bus',
      pickupLocation: booking.transport?.pickupLocation ?? '',

      // costing / pricing
      package: booking.package,
      packagePrice: booking.packagePrice ?? booking.pricing?.packagePrice ?? '',
      additionalServices: booking.additionalServices ?? booking.pricing?.additionalServices ?? '',
      paymentMethod: booking.paymentMethod ?? booking.payment?.method ?? 'credit_card',
      costingRows: booking.pricing?.table ?? [],
      totalAmount: String(booking.amount ?? booking.pricing?.totalAmount ?? ''),

      // booking date
      date: (booking as any)['date'] ?? '',
    };

    setEditInitial(initialData);
    setEditId(booking.id);
    setIsFullEditOpen(true);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await http.put(`/api/bookings/${id}`, { status: newStatus });
      const updatedBooking = response.data;
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: newStatus as any,
                approvalStatus: updatedBooking.approvalStatus || b.approvalStatus,
              }
            : b
        )
      );
      setIsEditModalOpen(false);
      setEditingBooking(null);
    } catch (error: any) {
      console.error('Update failed:', error);
      alert('Failed to update booking status');
    }
  };

  // UPDATED: Download PDF with expanded data and v2 template; fallback to old /pdf
  const handleDownloadPDF = async (bookingId: string) => {
    try {
      // Try to fetch a full/expanded booking (server should support this)
      let full: any | null = null;
      try {
        const { data } = await http.get(`/api/bookings/${bookingId}?expand=all`);
        full = data;
      } catch {
        // ignore; fallback to direct PDF call
      }

      // Prefer POSTing the full object to a v2 PDF route if available
      if (full) {
        try {
          const response = await http.post(`/api/bookings/${bookingId}/pdf?v=2`, full, {
            responseType: 'blob',
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `booking-${bookingId}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          return;
        } catch {
          // fall through to legacy
        }
      }

      // Legacy fallback (your current flow)
      const response = await http.get(`/api/bookings/${bookingId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `booking-${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF download failed:', error);
      alert('Failed to download PDF');
    }
  };

  // NEW: Client-side "Full PDF" that always contains all details (hotels[], visas[], legs[], costingRows[])
  const generateFullClientPDF = async (bookingId: string) => {
    try {
      // fetch the freshest single booking
      const { data } = await http.get(`/api/bookings/${bookingId}`);
      const full = normalizeForPdf(data);

      // lazy import for performance and TS ESM/CJS compat
      const jsPDFMod = await import('jspdf');
      const autoTableMod = await import('jspdf-autotable');
      const jsPDF = (jsPDFMod as any).default || jsPDFMod;
      const autoTable = (autoTableMod as any).default || autoTableMod;

      const doc = new jsPDF({ unit: 'pt' });
      let y = 40;

      // Header
      doc.setFontSize(16);
      doc.text('Booking Summary', 40, y);
      y += 20;
      doc.setFontSize(10);
      doc.text(`Booking ID: ${full.id}`, 40, y);
      y += 14;
      doc.text(`Status: ${full.status} | Approval: ${full.approvalStatus}`, 40, y);
      y += 6;
      doc.text(`Package: ${full.pkg}`, 40, y);
      y += 16;

      // Contact
      doc.setFontSize(12);
      doc.text('Contact', 40, y);
      y += 12;
      doc.setFontSize(10);
      doc.text(`Customer: ${full.customerName}`, 40, y);
      y += 12;
      doc.text(`Email: ${full.email}`, 40, y);
      y += 12;
      doc.text(`Phone: ${full.phone}`, 40, y);
      y += 12;
      doc.text(`Agent: ${full.agentName || '—'}`, 40, y);
      y += 18;

      // Dates
      doc.setFontSize(12);
      doc.text('Dates', 40, y);
      y += 12;
      doc.setFontSize(10);
      doc.text(`Booking: ${full.dates.bookingDate || '—'}`, 40, y);
      y += 12;
      doc.text(`Departure: ${full.dates.departureDate || '—'}`, 40, y);
      y += 12;
      doc.text(`Return: ${full.dates.returnDate || '—'}`, 40, y);
      y += 18;

      // Flight
      doc.setFontSize(12);
      doc.text('Flight', 40, y);
      y += 12;
      doc.setFontSize(10);
      if (full.flight.route) {
        doc.text(`Route: ${full.flight.route}`, 40, y);
        y += 12;
      }
      if (full.flight.class) {
        doc.text(`Class: ${full.flight.class}`, 40, y);
        y += 12;
      }
      if (full.flight.pnr) {
        doc.text(`PNR: ${full.flight.pnr}`, 40, y);
        y += 12;
      }
      if (full.flight.payment) {
        doc.text(`Payment: ${full.flight.payment}`, 40, y);
        y += 12;
      }
      if (full.flight.itinerary) {
        doc.text('Itinerary:', 40, y);
        y += 12;
        String(full.flight.itinerary)
          .split('\n')
          .forEach((line: string) => {
            doc.text(line, 54, y);
            y += 12;
          });
        y += 6;
      }

      // Hotels
      if (full.hotels.length) {
        autoTable(doc, {
          startY: y,
          head: [['Hotel', 'Room', 'Check-in', 'Check-out']],
          body: full.hotels.map((h: any) => [h.hotelName, h.roomType, h.checkIn || '—', h.checkOut || '—']),
          styles: { fontSize: 9 },
        });
      
        y = (doc as any).lastAutoTable.finalY + 16;
      }

      // Visas
      if (full.visas.length) {
        autoTable(doc, {
          startY: y,
          head: [['Name', 'Nationality', 'Type']],
          body: full.visas.map((v: any) => [v.name, v.nationality, v.visaType]),
          styles: { fontSize: 9 },
        });
      
        y = (doc as any).lastAutoTable.finalY + 16;
      }

      // Transport legs
      if (full.transport.legs.length) {
        autoTable(doc, {
          startY: y,
          head: [['From', 'To', 'Vehicle', 'Date', 'Time']],
          body: full.transport.legs.map((l: any) => [l.from, l.to, l.vehicleType, l.date || '—', l.time || '—']),
          styles: { fontSize: 9 },
        });
      
        y = (doc as any).lastAutoTable.finalY + 16;
      } else if (full.transport.transportType || full.transport.pickupLocation) {
        doc.setFontSize(12);
        doc.text('Transport', 40, y);
        y += 12;
        doc.setFontSize(10);
        if (full.transport.transportType) {
          doc.text(`Type: ${full.transport.transportType}`, 40, y);
          y += 12;
        }
        if (full.transport.pickupLocation) {
          doc.text(`Pickup: ${full.transport.pickupLocation}`, 40, y);
          y += 16;
        }
      }

      // Costing table
      if (full.pricing.table?.length) {
        autoTable(doc, {
          startY: y,
          head: [['Service', 'Qty', 'Cost/Qty', 'Sale/Qty', 'Total Cost', 'Total Sale', 'Profit']],
          body: full.pricing.table.map((r: any) => [
            r.label,
            String(r.quantity ?? 0),
            String(r.costPerQty ?? 0),
            String(r.salePerQty ?? 0),
            String(r.totalCost ?? 0),
            String(r.totalSale ?? 0),
            String(r.profit ?? 0),
          ]),
          styles: { fontSize: 9 },
        });
     
        y = (doc as any).lastAutoTable.finalY + 12;
      }
      doc.setFontSize(10);
      doc.text(
        `Totals — Cost: ${full.pricing.totals.totalCostPrice} | Sale: ${full.pricing.totals.totalSalePrice} | Profit: ${full.pricing.totals.profit}`,
        40,
        y
      );
      y += 14;
      if (full.pricing.additionalServices) {
        doc.text(`Additional Services: ${full.pricing.additionalServices}`, 40, y);
        y += 14;
      }

 
      doc.setFontSize(12);
      doc.text('Payment', 40, y);
      y += 12;
      doc.setFontSize(10);
      doc.text(`Method: ${full.payment.method || '—'}`, 40, y);
      y += 12;
      if (full.payment.cardLast4) {
        doc.text(`Card Last4: •••• ${full.payment.cardLast4}`, 40, y);
        y += 12;
      }

      doc.setFontSize(12);
      doc.text('Passengers', 40, y);
      y += 12;
      doc.setFontSize(10);
      doc.text(
        `Total: ${full.pax.passengers || '—'} | Adults: ${full.pax.adults || '—'} | Children: ${full.pax.children || '—'}`,
        40,
        y
      );

      doc.save(`booking-full-${full.id}.pdf`);
    } catch (e) {
      console.error('Full PDF failed', e);
      alert('Failed to generate full PDF');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const displayBookings = useMemo(() => {
    const filteredByRole = isAdmin
      ? bookings
      : bookings.filter((b) => {
          return b.agentId === user?.id || b.agentId === (user as any)?.agentId;
        });
    return filteredByRole;
  }, [bookings, isAdmin, user]);

  const filteredBookings = displayBookings.filter((booking) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      booking.customer.toLowerCase().includes(s) ||
      booking.id.toLowerCase().includes(s) ||
      booking.package.toLowerCase().includes(s) ||
      booking.email.toLowerCase().includes(s) ||
      (booking.pnr || '').toLowerCase().includes(s);
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const groupedBookings = useMemo(() => {
    if (!groupByCustomer) return { 'All Bookings': filteredBookings };
    const groups: { [key: string]: UiBooking[] } = {};
    filteredBookings.forEach((booking) => {
      const customerKey = `${booking.customer} (${booking.email})`;
      if (!groups[customerKey]) groups[customerKey] = [];
      groups[customerKey].push(booking);
    });
    return groups;
  }, [filteredBookings, groupByCustomer]);

  const totalRevenue = filteredBookings.reduce((sum, b) => sum + (toNumberMaybe(b.amount) || 0), 0);
  const totalConfirmed = filteredBookings.filter((b) => b.status === 'confirmed').length;
  const totalPending = filteredBookings.filter((b) => b.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isAdmin ? 'All Bookings' : 'My Bookings'}
          </h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Home</span>
            <span>/</span>
            <span className="text-blue-600">Bookings</span>
          </div>
        </div>
        <button
          onClick={() => setIsBookingModalOpen(true)}
          className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Booking</span>
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-gray-600">Loading bookings…</div>
      )}
      {err && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{err}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{filteredBookings.length}</p>
              <p className="text-xs sm:text-sm text-gray-600">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{totalConfirmed}</p>
              <p className="text-xs sm:text-sm text-gray-600">Confirmed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{totalPending}</p>
              <p className="text-xs sm:text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{currency(totalRevenue)}</p>
              <p className="text-xs sm:text-sm text-gray-600">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search bookings, PNR, email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => setGroupByCustomer(!groupByCustomer)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              groupByCustomer
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {groupByCustomer ? 'Ungroup' : 'Group by Customer'}
          </button>
        </div>
      </div>

      {/* Bookings Display */}
      <div className="space-y-6">
        {Object.entries(groupedBookings).map(([groupName, groupBookings]) => (
          <div key={groupName}>
            {groupByCustomer && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {groupName} ({groupBookings.length} booking{groupBookings.length !== 1 ? 's' : ''})
                </h3>
                <div className="h-px bg-gray-200"></div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {groupBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
                >
                  {/* Booking Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {booking.customer}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{booking.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full max-w-full truncate ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {getStatusIcon(booking.status)}
                        <span className="truncate">
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{booking.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{booking.phone || '—'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{booking.package}</span>
                    </div>

                    {/* Show PNR if present */}
                    {!!booking.pnr && (
                      <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                        <Ticket className="h-4 w-4" />
                        <span>
                          PNR: <span className="font-medium">{booking.pnr}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detailed Information */}
                  {(booking as any).flight?.departureCity ||
                  (booking as any).hotel?.hotelName ||
                  (booking as any).visa?.visaType ? (
                    <div className="space-y-3 mb-4">
                      {/* Flight Info */}
                      {(booking as any).flight?.departureCity && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-blue-900 mb-2">Flight Details</h4>
                          <div className="text-xs text-blue-800">
                            <p>
                              <span className="font-medium">Route:</span>{' '}
                              {(booking as any).flight.departureCity} → {(booking as any).flight.arrivalCity}
                            </p>
                            <p>
                              <span className="font-medium">Class:</span>{' '}
                              {(booking as any).flight.flightClass
                                ?.charAt(0)
                                .toUpperCase() + (booking as any).flight.flightClass?.slice(1)}
                            </p>
                            {(booking as any).flight?.pnr && (
                              <p>
                                <span className="font-medium">PNR:</span> {(booking as any).flight.pnr}
                              </p>
                            )}
                            {(booking as any).flight?.itinerary && (
                              <p className="mt-1">
                                <span className="font-medium">Itinerary:</span>
                                <br />
                                {(booking as any).flight.itinerary
                                  .split('\n')
                                  .map((ln: string, i: number) => (
                                    <span key={i} className="block">
                                      {ln}
                                    </span>
                                  ))}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hotel Info (legacy single) */}
                      {(booking as any).hotel?.hotelName && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-green-900 mb-2">Hotel Details</h4>
                          <div className="text-xs text-green-800">
                            <p>
                              <span className="font-medium">Hotel:</span> {(booking as any).hotel.hotelName}
                            </p>
                            <p>
                              <span className="font-medium">Room:</span> {(booking as any).hotel.roomType}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Multiple Hotels array (if present) */}
                      {Array.isArray((booking as any).hotels) && (booking as any).hotels.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-green-900 mb-2">Hotels</h4>
                          <div className="text-xs text-green-800 space-y-1">
                            {(booking as any).hotels.map((h: any, i: number) => (
                              <div key={i} className="border-b border-green-100 pb-1">
                                <p>
                                  <span className="font-medium">Hotel:</span> {h.hotelName || '—'} (
                                  {h.roomType || '—'})
                                </p>
                                <p>
                                  <span className="font-medium">Dates:</span> {formatDate(h.checkIn) || '—'} →{' '}
                                  {formatDate(h.checkOut) || '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Visas list (if present) */}
                      {Array.isArray((booking as any).visas) && (booking as any).visas.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-purple-900 mb-2">Visa(s)</h4>
                          <div className="text-xs text-purple-800 space-y-1">
                            {(booking as any).visas.map((v: any, i: number) => (
                              <div key={i} className="border-b border-purple-100 pb-1">
                                <p>
                                  <span className="font-medium">Name:</span> {v.name || '—'}
                                </p>
                                <p>
                                  <span className="font-medium">Nationality:</span> {v.nationality || '—'}
                                </p>
                                <p>
                                  <span className="font-medium">Type:</span>{' '}
                                  {(v.visaType || '—').toString().replace(/^\w/, (c: string) => c.toUpperCase())}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transport Info */}
                      {(booking as any).transport && (
                        <div className="bg-orange-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-orange-900 mb-2">Transport Details</h4>
                          <div className="text-xs text-orange-800 space-y-1">
                            {(booking as any).transport?.transportType && (
                              <p>
                                <span className="font-medium">Type:</span>{' '}
                                {(booking as any).transport.transportType
                                  ?.charAt(0)
                                  .toUpperCase() + (booking as any).transport.transportType?.slice(1)}
                              </p>
                            )}
                            {(booking as any).transport?.pickupLocation && (
                              <p>
                                <span className="font-medium">Pickup:</span> {(booking as any).transport.pickupLocation}
                              </p>
                            )}
                            {Array.isArray((booking as any).transport?.legs) &&
                              (booking as any).transport.legs.length > 0 && (
                                <div className="mt-2">
                                  <p className="font-medium">Legs:</p>
                                  <div className="mt-1 space-y-1">
                                    {(booking as any).transport.legs.map((l: any, i: number) => (
                                      <div key={i} className="border-b border-orange-100 pb-1">
                                        <p>
                                          {l.from || '—'} → {l.to || '—'} ({l.vehicleType || '—'})
                                        </p>
                                        <p>
                                          {formatDate(l.date) || '—'} {l.time || ''}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Costing table summary (if present) */}
                      {(booking as any).pricing?.table?.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-gray-900 mb-2">Costing</h4>
                          <div className="text-xs text-gray-800 space-y-1">
                            {(booking as any).pricing.table.map((r: any, i: number) => {
                              const qty = toNumberMaybe(r.quantity);
                              const cpq = toNumberMaybe(r.costPerQty);
                              const spq = toNumberMaybe(r.salePerQty);
                              const tc = qty * cpq;
                              const ts = qty * spq;
                              const pf = ts - tc;
                              return (
                                <div key={i} className="border-b border-gray-200 pb-1">
                                  <p className="font-medium">{r.label || '—'}</p>
                                  <p>
                                    Qty: {qty} | Cost/Qty: {currency(cpq)} | Sale/Qty: {currency(spq)}
                                  </p>
                                  <p>
                                    Total Cost: {currency(tc)} | Total Sale: {currency(ts)} | Profit:{' '}
                                    {currency(pf)}
                                  </p>
                                </div>
                              );
                            })}
                            {(booking as any).pricing?.totals && (
                              <p className="mt-1 font-semibold">
                                Totals — Cost:{' '}
                                {currency(toNumberMaybe((booking as any).pricing.totals.totalCostPrice))} · Sale:{' '}
                                {currency(toNumberMaybe((booking as any).pricing.totals.totalSalePrice))} · Profit:{' '}
                                {currency(toNumberMaybe((booking as any).pricing.totals.profit))}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Travel Dates */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Departure</p>
                        <p className="font-medium text-gray-900">{booking.departureDate || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Return</p>
                        <p className="font-medium text-gray-900">{booking.returnDate || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Amount and Agent */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Amount</p>
                      <p className="text-lg sm:text-xl font-bold text-gray-900">{currency(booking.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs sm:text-sm text-gray-500">Agent</p>
                      <p className="text-xs sm:text-sm font-medium text-gray-900">{booking.agentName || '—'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {/* 1) Server PDF (legacy/fallback) */}
                    <button
                      onClick={() => handleDownloadPDF(booking.id)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>PDF</span>
                    </button>

                    {/* 2) Full PDF (client, includes arrays/tables) */}
                    <button
                      onClick={() => generateFullClientPDF(booking.id)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                      title="Generate PDF with full itinerary, hotels[], visas[], legs, and costing"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Full PDF</span>
                    </button>

                    {/* 3) Full Edit */}
                    <button
                      onClick={() => handleOpenFullEdit(booking)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Edit Full</span>
                    </button>

                    {/* 4) Status */}
                    <button
                      onClick={() => handleEditStatus(booking)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Status</span>
                    </button>

                    {/* 5) Delete */}
                    <button
                      onClick={() => handleDelete(booking.id)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Approval Status */}
                  {booking.approvalStatus === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800 font-medium">Pending Admin Approval</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!loading && !err && filteredBookings.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first booking'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setIsBookingModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Booking
              </button>
            )}
          </div>
        )}
      </div>

      {/* Booking Modal (Create) */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          fetchBookings();
        }}
        onSubmit={handleCreateBooking}
      />

      {/* Booking Modal (Full Edit) */}
      <BookingModal
        isOpen={isFullEditOpen}
        onClose={() => {
          setIsFullEditOpen(false);
          setEditInitial(null);
          setEditId(null);
          fetchBookings();
        }}
        onSubmit={(updated) => {
          const ui = mapBooking(updated);
          setBookings((prev) => prev.map((b) => (b.id === ui.id ? ui : b)));
        }}
        initialData={editInitial || undefined}
        bookingId={editId || undefined}
      />

      {/* Edit Status Modal (status-only) */}
      {isEditModalOpen && editingBooking && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
            <div className="bg-blue-600 text-white p-4 sm:p-6">
              <h2 className="text-xl font-bold">Edit Booking Status</h2>
              <p className="text-blue-100 text-sm mt-1">
                Booking: {editingBooking.customer}{' '}
                {editingBooking.pnr ? `(PNR: ${editingBooking.pnr})` : ''} - {editingBooking.package}
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
                  <div className="text-sm text-gray-600 mb-4">
                    {editingBooking.status.charAt(0).toUpperCase() + editingBooking.status.slice(1)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                  <select
                    id="status-select"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    defaultValue={editingBooking.status}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingBooking(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const select = document.getElementById('status-select') as HTMLSelectElement;
                  const newStatus = select.value;
                  handleUpdateStatus(editingBooking.id, newStatus);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
