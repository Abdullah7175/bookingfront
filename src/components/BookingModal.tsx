import React, { useState, useEffect } from 'react';
import { X, User, CreditCard, Plane, Building, MapPin, Car, DollarSign, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { http } from '../lib/http';

export type StepId = 'contact' | 'credit' | 'flights' | 'hotels' | 'visa' | 'transport' | 'costing';

export interface BookingFormData {
  // Contact
  name: string;
  passengers: string;
  adults: string;
  children: string;
  email: string;
  contactNumber: string;
  agent: string;

  // Credit
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;

  // Flights
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  flightClass: 'economy' | 'business' | 'first';
  pnr?: string; // 6 alphanumeric

  // Hotels
  hotelName: string;
  roomType: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD

  // Visa
  visaType: 'umrah' | 'hajj' | 'tourist';
  passportNumber: string;
  nationality: string;

  // Transport
  transportType: 'bus' | 'car' | 'van' | 'taxi';
  pickupLocation: string;

  // Costing
  packagePrice: string;
  additionalServices: string;
  totalAmount: string;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'cash' | 'installments';

  // Backend required additions
  package?: string; // REQUIRED by backend
  date?: string; // REQUIRED by backend (booking date)
}

export const steps: { id: StepId; title: string; icon: React.ComponentType<any> }[] = [
  { id: 'contact', title: 'Contact Info', icon: User },
  { id: 'credit', title: 'Credit Card', icon: CreditCard },
  { id: 'flights', title: 'Flights', icon: Plane },
  { id: 'hotels', title: 'Hotels', icon: Building },
  { id: 'visa', title: 'Visa(s)', icon: MapPin },
  { id: 'transport', title: 'Transportation', icon: Car },
  { id: 'costing', title: 'Costing', icon: DollarSign },
];

function isoOrNull(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
}

function sanitizePNR(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** 🔧 Exported: validate current step (pure) */
export function validateStepData(formData: BookingFormData, id: StepId): Record<string, string> {
  const e: Record<string, string> = {};
  if (id === 'contact') {
    if (!formData.name?.trim()) e.name = 'Name is required';
    if (!formData.email?.trim()) e.email = 'Email is required';
    if (!formData.contactNumber?.trim()) e.contactNumber = 'Contact number is required';
    if (!formData.passengers?.trim()) e.passengers = 'Number of passengers is required';
  }
  if (id === 'credit') {
    if (!formData.cardholderName?.trim()) e.cardholderName = 'Cardholder name is required';
  }
  if (id === 'flights') {
    if (!formData.departureCity?.trim()) e.departureCity = 'Departure city is required';
    if (!formData.arrivalCity?.trim()) e.arrivalCity = 'Arrival city is required';
    if (!formData.departureDate) e.departureDate = 'Departure date is required';
    if (!formData.returnDate) e.returnDate = 'Return date is required';
    // Booking Date (backend "date")
    if (!formData.date) e.date = 'Booking date is required';
    // PNR strict check (required and exactly 6 alphanumeric)
    if (!formData.pnr?.trim()) {
      e.pnr = 'PNR is required';
    } else if (!/^[A-Z0-9]{6}$/.test(formData.pnr.trim())) {
      e.pnr = 'PNR must be exactly 6 letters/numbers (e.g. ABC12D)';
    }
  }
  if (id === 'costing') {
    if (!formData.totalAmount?.trim()) e.totalAmount = 'Total amount is required';
    if (!formData.package?.trim()) e.package = 'Package is required';
  }
  return e;
}

/** 🔧 Exported: build API payload (pure) — maps to backend-required keys and matches new list UI expectations */
export function buildBookingPayload(formData: BookingFormData, user: any) {
  const agentId = user?.agentId ?? user?.id ?? user?._id ?? (formData.agent || undefined);

  // Required by backend schema - ensure they're not empty
  const customerName = formData.name?.trim() || '';
  const customerEmail = formData.email?.trim() || '';
  const pkg = formData.package?.trim() || '';
  const bookingDateIso =
    isoOrNull(formData.date) ||
    isoOrNull(formData.departureDate) ||
    new Date().toISOString();

  // Validate required fields
  if (!customerName) {
    throw new Error('Customer name is required');
  }
  if (!customerEmail) {
    throw new Error('Customer email is required');
  }
  if (!pkg) {
    throw new Error('Package is required');
  }

  // Normalize numeric strings
  const toNumberMaybe = (v: any) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace?.(/[$,]/g, '') ?? v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const totalAmountNum = toNumberMaybe(formData.totalAmount);
  const packagePriceNum = toNumberMaybe(formData.packagePrice);

  // Build nested payload to align with Bookings.mapBooking()
  const payload = {
    // ---- CUSTOMER INFORMATION
    customerName,
    customerEmail,
    contactNumber: formData.contactNumber || '',
    passengers: formData.passengers || '',
    adults: formData.adults || '',
    children: formData.children || '',

    // ---- IDENTIFIERS / GROUPING
    agentId,
    customerGroup: customerEmail, // Use email for grouping same customer bookings

    // ---- PACKAGE / PRICING
    package: pkg,
    pricing: {
      packageName: pkg,
      packagePrice: packagePriceNum,
      additionalServices: formData.additionalServices || '',
      totalAmount: totalAmountNum,
      paymentMethod: formData.paymentMethod || 'credit_card',
    },
    // keep legacy top-level for backward compatibility
    packagePrice: packagePriceNum,
    additionalServices: formData.additionalServices || '',
    totalAmount: totalAmountNum,
    paymentMethod: formData.paymentMethod || 'credit_card',
    amount: totalAmountNum,

    // ---- TRAVEL DATES
    date: bookingDateIso,
    departureDate: isoOrNull(formData.departureDate) || '', // legacy
    returnDate: isoOrNull(formData.returnDate) || '', // legacy

    // ---- FLIGHT INFORMATION (nested + legacy)
    flight: {
      departureCity: formData.departureCity || '',
      arrivalCity: formData.arrivalCity || '',
      departureDate: isoOrNull(formData.departureDate) || '',
      returnDate: isoOrNull(formData.returnDate) || '',
      flightClass: formData.flightClass || 'economy',
      pnr: formData.pnr || '',
    },
    departureCity: formData.departureCity || '', // legacy
    arrivalCity: formData.arrivalCity || '', // legacy
    flightClass: formData.flightClass || 'economy', // legacy

    // ---- HOTEL INFORMATION
    hotel: {
      hotelName: formData.hotelName || '',
      roomType: formData.roomType || '',
      checkIn: isoOrNull(formData.checkIn) || '',
      checkOut: isoOrNull(formData.checkOut) || '',
    },
    hotelName: formData.hotelName || '', // legacy
    roomType: formData.roomType || '', // legacy
    checkIn: isoOrNull(formData.checkIn) || '', // legacy
    checkOut: isoOrNull(formData.checkOut) || '', // legacy

    // ---- VISA INFORMATION
    visa: {
      visaType: formData.visaType || 'umrah',
      passportNumber: formData.passportNumber || '',
      nationality: formData.nationality || '',
    },
    visaType: formData.visaType || 'umrah', // legacy
    passportNumber: formData.passportNumber || '', // legacy
    nationality: formData.nationality || '', // legacy

    // ---- TRANSPORT INFORMATION
    transport: {
      transportType: formData.transportType || 'bus',
      pickupLocation: formData.pickupLocation || '',
    },
    transportType: formData.transportType || 'bus', // legacy
    pickupLocation: formData.pickupLocation || '', // legacy

    // ---- PAYMENT (tokenized/masked)
    payment: {
      method: formData.paymentMethod || 'credit_card',
      cardLast4: (formData.cardNumber || '').replace(/\D/g, '').slice(-4),
      cardholderName: formData.cardholderName || '',
      expiryDate: formData.expiryDate || '',
    },
    cardNumber: (formData.cardNumber || ''), // legacy — server should ignore full PAN
    expiryDate: formData.expiryDate || '', // legacy
    cvv: formData.cvv || '', // legacy — server should ignore
    cardholderName: formData.cardholderName || '', // legacy

    // ---- STATUS
    status: 'pending',
    approvalStatus: 'pending',
  };

  return payload as any;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (created: any) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState<BookingFormData[]>([]);
  const [currentBookingIndex, setCurrentBookingIndex] = useState(0);

  const empty: BookingFormData = {
    name: '', passengers: '', adults: '', children: '', email: '', contactNumber: '', agent: '',
    cardNumber: '', expiryDate: '', cvv: '', cardholderName: '',
    departureCity: '', arrivalCity: '', departureDate: '', returnDate: '', flightClass: 'economy', pnr: '',
    hotelName: '', roomType: '', checkIn: '', checkOut: '',
    visaType: 'umrah', passportNumber: '', nationality: '',
    transportType: 'bus', pickupLocation: '',
    packagePrice: '', additionalServices: '', totalAmount: '', paymentMethod: 'credit_card',
    package: '', date: '',
  };

  // Initialize with first booking
  useEffect(() => {
    if (isOpen && bookings.length === 0) {
      setBookings([empty]);
      setFormData(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bookings.length]);

  const [formData, setFormData] = useState<BookingFormData>(empty);

  const step = steps[currentStep];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    let { value } = e.target as HTMLInputElement;

    if (name === 'pnr') {
      value = sanitizePNR(value);
    }

    const updatedFormData = { ...formData, [name]: value };
    setFormData(updatedFormData);

    // Update the current booking in the bookings array
    setBookings(prev => prev.map((booking, index) =>
      index === currentBookingIndex ? updatedFormData : booking
    ));

    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const validateStep = (id: StepId) => {
    const e = validateStepData(formData, id);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step.id) && currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };
  const handlePrevious = () => setCurrentStep((s) => Math.max(0, s - 1));

  const swapCities = () => {
    setFormData((prev) => ({
      ...prev,
      departureCity: prev.arrivalCity,
      arrivalCity: prev.departureCity,
    }));
  };

  const addAnotherBooking = () => {
    const newBooking: BookingFormData = {
      // Copy contact & payment basics so user doesn't retype
      name: formData.name,
      passengers: formData.passengers,
      adults: formData.adults,
      children: formData.children,
      email: formData.email,
      contactNumber: formData.contactNumber,
      agent: formData.agent,
      cardNumber: formData.cardNumber,
      expiryDate: formData.expiryDate,
      cvv: formData.cvv,
      cardholderName: formData.cardholderName,

      // Reset trip-specific
      departureCity: '', arrivalCity: '', departureDate: '', returnDate: '', flightClass: 'economy', pnr: '',
      hotelName: '', roomType: '', checkIn: '', checkOut: '',
      visaType: 'umrah', passportNumber: '', nationality: '',
      transportType: 'bus', pickupLocation: '',
      packagePrice: '', additionalServices: '', totalAmount: '', paymentMethod: 'credit_card',
      package: '', date: '',
    };

    setBookings(prev => [...prev, newBooking]);
    setCurrentBookingIndex(bookings.length);
    setFormData(newBooking);
    setCurrentStep(0);
    setErrors({});
    setServerError('');
  };

  const switchToBooking = (index: number) => {
    if (index >= 0 && index < bookings.length) {
      setCurrentBookingIndex(index);
      setFormData(bookings[index]);
    }
  };

  const resetForm = () => {
    setBookings([empty]);
    setFormData(empty);
    setCurrentBookingIndex(0);
    setCurrentStep(0);
    setErrors({});
    setServerError('');
  };

  const fillTestData = () => {
    const today = new Date();
    const nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7);
    const testData: Partial<BookingFormData> = {
      name: 'John Doe',
      email: 'john@example.com',
      contactNumber: '+1-555-1234',
      passengers: '3',
      adults: '2',
      children: '1',
      agent: '',
      cardNumber: '4111 1111 1111 1111',
      expiryDate: '12/28',
      cvv: '123',
      cardholderName: 'JOHN DOE',
      departureCity: 'Karachi',
      arrivalCity: 'Jeddah',
      departureDate: today.toISOString().slice(0, 10),
      returnDate: nextWeek.toISOString().slice(0, 10),
      flightClass: 'economy',
      pnr: 'ABC12D',
      hotelName: 'Hilton',
      roomType: 'double',
      checkIn: today.toISOString().slice(0, 10),
      checkOut: nextWeek.toISOString().slice(0, 10),
      visaType: 'umrah',
      passportNumber: 'AB1234567',
      nationality: 'PK',
      transportType: 'bus',
      pickupLocation: 'Jeddah Airport',
      packagePrice: '1200',
      additionalServices: 'Zamzam water, Ziyarah',
      totalAmount: '1500',
      paymentMethod: 'credit_card',
      package: '7N Umrah Standard',
      date: today.toISOString().slice(0, 10),
    };

    setFormData((prev) => ({ ...prev, ...testData }));

    setBookings(prev => prev.map((booking, index) =>
      index === currentBookingIndex ? { ...booking, ...testData } : booking
    ));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate *all* bookings (flights + costing requirements)
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      const flightErrors = validateStepData(b, 'flights');
      const costingErrors = validateStepData(b, 'costing');
      const errorsCombined = { ...flightErrors, ...costingErrors };

      if (Object.keys(errorsCombined).length > 0) {
        setCurrentBookingIndex(i);
        setFormData(b);
        setErrors(errorsCombined);
        setServerError(`Please complete all required fields for Booking ${i + 1}`);
        return;
      }
    }

    setSubmitting(true);
    setServerError('');
    try {
      const createdBookings: any[] = [];
      for (const booking of bookings) {
        const bookingPayload = buildBookingPayload(booking, user);
        const res = await http.post('/api/bookings', bookingPayload);
        createdBookings.push(res.data);
      }

      createdBookings.forEach(booking => onSubmit?.(booking));

      resetForm();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        err?.message ||
        'Failed to create booking';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Plane className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Create New Booking</h2>
                {bookings.length > 1 && (
                  <p className="text-blue-100 text-sm">
                    Booking {currentBookingIndex + 1} of {bookings.length}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bookings.length > 1 && (
                <div className="flex items-center space-x-2 mr-2">
                  {bookings.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => switchToBooking(index)}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        index === currentBookingIndex
                          ? 'bg-white text-blue-600'
                          : 'bg-blue-500 text-white hover:bg-blue-400'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={fillTestData}
                className="hidden sm:inline px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                Fill Test Data
              </button>
              <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-lg transition-colors" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Step Navigation */}
          <div className="mt-4 sm:mt-6">
            <div className="flex flex-wrap gap-2">
              {steps.map((s, index) => {
                const Icon = s.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-green-500 text-white'
                        : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-500 text-blue-100 hover:bg-blue-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {serverError && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* CONTACT */}
            {step.id === 'contact' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter Name</label>
                    <input
                      data-testid="name"
                      type="text" name="name" value={formData.name} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.name ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Enter Name"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                  {/* passengers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Passengers</label>
                    <input
                      data-testid="passengers"
                      type="number" name="passengers" value={formData.passengers} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.passengers ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Enter Number of Passengers"
                    />
                    {errors.passengers && <p className="text-red-500 text-xs mt-1">{errors.passengers}</p>}
                  </div>
                  {/* adults */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
                    <input data-testid="adults" type="number" name="adults" value={formData.adults} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Adults" />
                  </div>
                  {/* children */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
                    <input data-testid="children" type="number" name="children" value={formData.children} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Children" />
                  </div>
                  {/* email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      data-testid="email"
                      type="email" name="email" value={formData.email} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.email ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Enter Email"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                  {/* contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                    <input
                      data-testid="contactNumber"
                      type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.contactNumber ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Enter Contact Number"
                    />
                    {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
                  </div>
                </div>

                {/* Agent (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Agent:</label>
                  <select
                    name="agent" value={formData.agent} onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Use logged-in agent</option>
                    <option value="ali">Ali Rahman</option>
                    <option value="sara">Sara Khan</option>
                    <option value="ahmed">Ahmed Malik</option>
                  </select>
                </div>
              </div>
            )}

            {/* CREDIT */}
            {step.id === 'credit' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Credit Card Information</h3>
                <p className="text-xs text-gray-500">
                  We only store <strong>payment method</strong> and <strong>last 4</strong>. Full card data is not sent to server.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                    <input
                      type="text" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="1234 5678 9012 3456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                    <input type="text" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="MM/YY" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                    <input type="password" name="cvv" value={formData.cvv} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="123" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                    <input
                      data-testid="cardholderName"
                      type="text" name="cardholderName" value={formData.cardholderName} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.cardholderName ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="John Doe"
                    />
                    {errors.cardholderName && <p className="text-red-500 text-xs mt-1">{errors.cardholderName}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* FLIGHTS */}
            {step.id === 'flights' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Flight Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departure City</label>
                    <input
                      data-testid="departureCity"
                      type="text" name="departureCity" value={formData.departureCity} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.departureCity ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Departure City"
                    />
                    {errors.departureCity && <p className="text-red-500 text-xs mt-1">{errors.departureCity}</p>}
                  </div>

                  {/* Swap Cities Button */}
                  <div className="flex items-end justify-center pb-2">
                    <button
                      type="button"
                      onClick={swapCities}
                      className="p-2 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors"
                      title="Swap departure and arrival cities"
                    >
                      <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Arrival City</label>
                    <input
                      data-testid="arrivalCity"
                      type="text" name="arrivalCity" value={formData.arrivalCity} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.arrivalCity ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Arrival City"
                    />
                    {errors.arrivalCity && <p className="text-red-500 text-xs mt-1">{errors.arrivalCity}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date</label>
                    <input
                      data-testid="departureDate"
                      type="date" name="departureDate" value={formData.departureDate} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.departureDate ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    {errors.departureDate && <p className="text-red-500 text-xs mt-1">{errors.departureDate}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Return Date</label>
                    <input
                      data-testid="returnDate"
                      type="date" name="returnDate" value={formData.returnDate} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.returnDate ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    {errors.returnDate && <p className="text-red-500 text-xs mt-1">{errors.returnDate}</p>}
                  </div>

                  {/* Booking Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Booking Date</label>
                    <input
                      data-testid="bookingDate"
                      type="date" name="date" value={formData.date || ''} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.date ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
                  </div>

                  {/* PNR */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PNR <span className="text-gray-400">(6 alphanumeric)</span></label>
                    <input
                      data-testid="pnr"
                      type="text" name="pnr" value={formData.pnr || ''} onChange={handleInputChange}
                      placeholder="e.g. ABC12D"
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.pnr ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`}
                    />
                    {errors.pnr && <p className="text-red-500 text-xs mt-1">{errors.pnr}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Flight Class</label>
                    <select
                      name="flightClass" value={formData.flightClass} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="economy">Economy</option>
                      <option value="business">Business</option>
                      <option value="first">First Class</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* HOTELS */}
            {step.id === 'hotels' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotel Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hotel Name</label>
                    <input type="text" name="hotelName" value={formData.hotelName} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Hotel Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                    <select
                      name="roomType" value={formData.roomType} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Room Type</option>
                      <option value="single">Single Room</option>
                      <option value="double">Double Room</option>
                      <option value="triple">Triple Room</option>
                      <option value="quad">Quad Room</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-in Date</label>
                    <input type="date" name="checkIn" value={formData.checkIn} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-out Date</label>
                    <input type="date" name="checkOut" value={formData.checkOut} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            )}

            {/* VISA */}
            {step.id === 'visa' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Visa Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visa Type</label>
                    <select
                      name="visaType" value={formData.visaType} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="umrah">Umrah Visa</option>
                      <option value="hajj">Hajj Visa</option>
                      <option value="tourist">Tourist Visa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Passport Number</label>
                    <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Passport Number" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                    <input type="text" name="nationality" value={formData.nationality} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Nationality" />
                  </div>
                </div>
              </div>
            )}

            {/* TRANSPORT */}
            {step.id === 'transport' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transportation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transport Type</label>
                    <select
                      name="transportType" value={formData.transportType} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="bus">Bus</option>
                      <option value="car">Private Car</option>
                      <option value="van">Van</option>
                      <option value="taxi">Taxi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location</label>
                    <input
                      type="text" name="pickupLocation" value={formData.pickupLocation} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Pickup Location"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* COSTING */}
            {step.id === 'costing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Costing</h3>
                  <button
                    type="button"
                    onClick={addAnotherBooking}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    + Add Another Booking
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Package field */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package</label>
                    <input
                      data-testid="package"
                      type="text" name="package" value={formData.package || ''} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.package ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="e.g. 7N Umrah Standard"
                    />
                    {errors.package && <p className="text-red-500 text-xs mt-1">{errors.package}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package Price</label>
                    <input
                      type="number" name="packagePrice" value={formData.packagePrice} onChange={handleInputChange}
                      className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="Package Price"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount</label>
                    <input
                      data-testid="totalAmount"
                      type="number" name="totalAmount" value={formData.totalAmount} onChange={handleInputChange}
                      className={`w-full px-3 py-2 border-b focus:outline-none transition-colors ${
                        errors.totalAmount ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`} placeholder="Total Amount"
                    />
                    {errors.totalAmount && <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Services</label>
                    <textarea
                      name="additionalServices" value={formData.additionalServices} onChange={handleInputChange} rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Additional Services"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="credit_card">Credit Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="installments">Installments</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0 || submitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {submitting ? 'Creating…' : 'Create Booking'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
