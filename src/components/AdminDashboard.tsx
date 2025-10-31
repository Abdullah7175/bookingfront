import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import StatCard from './StatCard';
import BarChart from './BarChart';
import { http } from '../lib/http';
import { 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  XCircle,
  AlertTriangle,
  Download
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { bookings, inquiries, agents, approveChange, rejectChange, fetchAgents, fetchBookings, fetchInquiries } = useData();
  const [chartPeriod, setChartPeriod] = React.useState<'week' | 'month' | 'year'>('year');

  // Refresh data on mount
  React.useEffect(() => {
    fetchBookings();
    fetchInquiries();
    fetchAgents(); // Ensure agents are loaded
  }, []);

  // Get pending approvals
  const pendingBookings = bookings.filter(b => b.approvalStatus === 'pending');
  const pendingInquiries = inquiries.filter(i => i.approvalStatus === 'pending');
  const totalPendingApprovals = pendingBookings.length + pendingInquiries.length;

  // Calculate real-time metrics
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => {
      // Try to get amount from various sources, prioritizing calculated totals
      let amount = 0;
      
      if (typeof b.amount === 'number') {
        amount = b.amount;
      } else if (typeof b.amount === 'string') {
        amount = parseFloat(b.amount.replace(/[$,]/g, '')) || 0;
      }
      
      return sum + amount;
    }, 0);

  const activeInquiries = inquiries.filter(i => i.status === 'pending').length;
  const resolvedInquiries = inquiries.filter(i => i.status === 'responded' || i.status === 'closed').length;

  // Monthly bookings (current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyBookings = bookings.filter(b => {
    const bookingDate = new Date(b.createdAt);
    return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
  }).length;
  const stats = [
    {
      title: 'Total Bookings',
      value: bookings.length.toString(),
      icon: Calendar,
      color: 'bg-blue-500',
      trend: monthlyBookings > 0 ? `+${monthlyBookings} this month` : 'No bookings this month',
    },
    {
      title: 'Active Inquiries',
      value: activeInquiries.toString(),
      icon: MessageSquare,
      color: 'bg-emerald-500',
      trend: `${resolvedInquiries} resolved`,
    },
    {
      title: 'Pending Approvals',
      value: totalPendingApprovals.toString(),
      icon: Clock,
      color: 'bg-orange-500',
      trend: totalPendingApprovals > 0 ? 'Needs attention' : 'All clear',
    },
    {
      title: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'bg-purple-500',
      trend: `${bookings.filter(b => b.status === 'confirmed').length} confirmed`,
    },
  ];

  // Helper function to normalize agent ID - handles various formats
  const normalizeId = (id: any): string | null => {
    if (!id) return null;
    // Handle ObjectId or string - convert to string and trim
    const idStr = String(id).trim();
    return idStr || null;
  };

  // Helper function to normalize agent ID from booking
  const getAgentIdFromBooking = (booking: any): string | null => {
    // Try multiple possible fields in order of preference
    if (booking.agentId) return normalizeId(booking.agentId);
    if (booking.agent?._id) return normalizeId(booking.agent._id);
    if (booking.agent?.id) return normalizeId(booking.agent.id);
    if (booking.agent) return normalizeId(booking.agent);
    return null;
  };

  // Filter bookings based on selected period
  const getFilteredBookings = () => {
    const now = new Date();
    let startDate: Date;

    switch (chartPeriod) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    return bookings.filter(booking => {
      const bookingDate = new Date(booking.createdAt || (booking as any).date || 0);
      return bookingDate >= startDate && bookingDate <= now;
    });
  };

  // Calculate real-time agent performance
  const filteredBookings = getFilteredBookings();
  
  // Build a map of agent ID -> bookings count for better matching
  // Use a more flexible key that handles different ID formats
  const agentBookingsMap: Record<string, number> = {};
  
  filteredBookings.forEach(booking => {
    const bookingAgentId = getAgentIdFromBooking(booking);
    if (bookingAgentId) {
      const normalizedId = normalizeId(bookingAgentId);
      if (normalizedId) {
        agentBookingsMap[normalizedId] = (agentBookingsMap[normalizedId] || 0) + 1;
        // Also store the original ID as a variation
        if (bookingAgentId !== normalizedId) {
          agentBookingsMap[bookingAgentId] = (agentBookingsMap[bookingAgentId] || 0) + 1;
        }
      }
    } else {
      // Debug: log bookings without agent IDs
      console.warn('[AdminDashboard] Booking without agent ID:', booking.id, booking);
    }
  });

  // Debug: log the mapping
  if (filteredBookings.length > 0) {
    console.log('[AdminDashboard] Filtered bookings count:', filteredBookings.length);
    console.log('[AdminDashboard] Agent bookings map:', agentBookingsMap);
    console.log('[AdminDashboard] Agents:', agents.map(a => ({ id: a.id, name: a.name })));
    console.log('[AdminDashboard] Agent bookings map keys:', Object.keys(agentBookingsMap));
    console.log('[AdminDashboard] Agent IDs from agents array:', agents.map(a => normalizeId(a.id)));
  }

  // Calculate performance data for each agent
  const agentPerformanceData = React.useMemo(() => {
    if (!agents || agents.length === 0) {
      console.log('[AdminDashboard] No agents available for performance calculation');
      return [];
    }

    if (Object.keys(agentBookingsMap).length === 0) {
      console.log('[AdminDashboard] No agent bookings in map');
      return [];
    }

    const result = agents.map((agent, index) => {
      const agentId = normalizeId(agent.id);
      if (!agentId) {
        console.warn('[AdminDashboard] Agent has no ID:', agent);
        return null;
      }

      console.log(`[AdminDashboard] Checking agent: ${agent.name}, ID: ${agentId}, Type: ${typeof agentId}`);

      // Try multiple matching strategies
      let agentBookings = agentBookingsMap[agentId] || 0;
      
      // If no exact match, try all variations
      if (agentBookings === 0) {
        // Check all keys in the map for potential matches
        Object.keys(agentBookingsMap).forEach(bookingAgentId => {
          console.log(`[AdminDashboard] Comparing: agentId="${agentId}" (type: ${typeof agentId}) vs bookingAgentId="${bookingAgentId}" (type: ${typeof bookingAgentId})`);
          
          // Direct match first
          if (bookingAgentId === agentId) {
            agentBookings = agentBookingsMap[bookingAgentId];
            console.log(`[AdminDashboard] ✓ Direct match found for ${agent.name}`);
          }
          // Exact match after normalization
          else {
            const normalizedBookingId = normalizeId(bookingAgentId);
            if (normalizedBookingId === agentId) {
              agentBookings = agentBookingsMap[bookingAgentId];
              console.log(`[AdminDashboard] ✓ Normalized match found for ${agent.name}`);
            }
            // Case-insensitive match
            else if (String(bookingAgentId).toLowerCase() === String(agentId).toLowerCase()) {
              agentBookings = agentBookingsMap[bookingAgentId];
              console.log(`[AdminDashboard] ✓ Case-insensitive match found for ${agent.name}`);
            }
            // Try matching after removing any whitespace or special characters
            else if (String(bookingAgentId).replace(/\s+/g, '') === String(agentId).replace(/\s+/g, '')) {
              agentBookings = agentBookingsMap[bookingAgentId];
              console.log(`[AdminDashboard] ✓ Whitespace-normalized match found for ${agent.name}`);
            }
          }
        });
      } else {
        console.log(`[AdminDashboard] ✓ Found direct match for agent ${agent.name} (${agentId}): ${agentBookings} bookings`);
      }

      // Only return agents with bookings
      if (agentBookings === 0) {
        console.log(`[AdminDashboard] ✗ No bookings found for agent ${agent.name} (${agentId})`);
        return null;
      }
      
      return {
        name: agent.name || `Agent ${index + 1}`,
        value: agentBookings, // Use actual booking count for bar chart
        color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][index % 6]
      };
    }).filter((item): item is { name: string; value: number; color: string } => 
      item !== null && item.value > 0
    );

    console.log('[AdminDashboard] Final agentPerformanceData:', result);
    console.log('[AdminDashboard] Result length:', result.length);
    return result;
  }, [agents, filteredBookings, agentBookingsMap]);


  const handleApproveBooking = async (bookingId: string) => {
    await approveChange('booking', bookingId);
  };

  const handleRejectBooking = async (bookingId: string) => {
    await rejectChange('booking', bookingId);
  };

  const handleApproveInquiry = async (inquiryId: string) => {
    await approveChange('inquiry', inquiryId);
  };

  const handleRejectInquiry = async (inquiryId: string) => {
    await rejectChange('inquiry', inquiryId);
  };

  // Helper functions for PDF generation (same as Bookings.tsx)
  const cleanDate = (d?: string) => {
    if (!d) return '';
    const t = new Date(d);
    return Number.isNaN(t.valueOf()) ? d : t.toISOString().slice(0, 10);
  };

  const ensureArray = <T,>(v: T[] | T | undefined | null): T[] => {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  const normalizeForPdf = (b: any) => {
    const hotels = Array.isArray(b?.hotels) && b.hotels.length > 0 ? ensureArray(b.hotels) : 
                  b?.hotel ? [b.hotel] : [];
    const visas = Array.isArray(b?.visas) ? ensureArray(b.visas) : 
                  b?.visas?.passengers && b.visas.passengers.length > 0 ? ensureArray(b.visas.passengers) : 
                  b?.visa && Object.keys(b.visa).length > 0 ? [{
                    name: b?.customerName || '',
                    nationality: b.visa.nationality || '',
                    visaType: b.visa.visaType || '',
                  }] : [];
    const legs = b?.transport?.legs ? ensureArray(b.transport.legs) : 
                 b?.transportation?.legs ? ensureArray(b.transportation.legs) : [];
    const costingRows = b?.pricing?.table ? ensureArray(b.pricing.table) : 
                        b?.costing?.rows ? ensureArray(b.costing.rows) : 
                        (b?.costingRows ? ensureArray(b.costingRows) : []);

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
        departureDate: cleanDate(b?.departureDate),
        returnDate: cleanDate(b?.returnDate),
      },
      flight: {
        itinerary: b?.flights?.raw || b?.flight?.itinerary || '',
        route: [b?.flight?.departureCity || b?.departureCity, b?.flight?.arrivalCity || b?.arrivalCity].filter(Boolean).join(' → '),
        class: b?.flight?.flightClass || b?.flightClass || '',
        pnr: (b?.flight?.pnr || b?.pnr || '').toUpperCase(),
        payment: b?.flightPayments?.mode || b?.flight?.paymentMethod || '',
      },
      hotels: hotels.map((h: any) => ({
        hotelName: h?.name || h?.hotelName || '',
        roomType: h?.roomType || '',
        checkIn: cleanDate(h?.checkIn),
        checkOut: cleanDate(h?.checkOut),
      })),
      visas: visas.map((v: any) => ({
        name: v?.name || v?.fullName || v?.passengerName || '',
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
          totalCostPrice: b?.pricing?.totals?.totalCostPrice ?? b?.costing?.totals?.totalCost ?? 0,
          totalSalePrice: b?.amount ?? b?.totalAmount ?? b?.pricing?.totals?.totalSalePrice ?? b?.costing?.totals?.totalSale ?? 0,
          profit: b?.pricing?.totals?.profit ?? b?.costing?.totals?.profit ?? 0,
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
        cardNumber: b?.cardNumber || b?.payment?.cardNumber || '',
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
  };

  // Download PDF - uses same format as FULL PDF from Bookings.tsx
  const handleDownloadPDF = async (bookingId: string) => {
    try {
      const { data } = await http.get(`/api/bookings/${bookingId}`);
      if (!data) {
        throw new Error('No booking data received');
      }
      const full = normalizeForPdf(data);

      const jsPDFMod = await import('jspdf');
      const autoTableMod = await import('jspdf-autotable');
      const jsPDF = (jsPDFMod as any).default || jsPDFMod;
      const autoTable = (autoTableMod as any).default || autoTableMod;

      const doc = new jsPDF({ 
        unit: 'pt', 
        format: 'a4',
        compress: true 
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const contentWidth = pageWidth - (2 * margin);
      let y = 0;

      const primaryColor = [30, 58, 138];
      const accentColor = [220, 38, 38];
      const lightGray = [248, 249, 250];
      const darkGray = [75, 85, 99];

      const formatDate = (d: string) => {
        if (!d) return '—';
        try {
          const date = new Date(d);
          return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        } catch {
          return d;
        }
      };

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      };

      const addHeader = (pageNumber: number) => {
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 8, 'F');
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 8, pageWidth, 85, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('MARWAH TRAVELS UMRAH', margin, 50);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Your Journey, Our Commitment', margin, 68);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('BOOKING CONFIRMATION', pageWidth - margin, 50, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${pageNumber}`, pageWidth - margin, 68, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        return 110;
      };

      const addFooter = () => {
        const footerY = pageHeight - 60;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY, pageWidth - margin, footerY);
        doc.setFontSize(9);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('MARWAH TRAVELS UMRAH', margin, footerY + 15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('info@marwahtravels.com', margin, footerY + 28);
        doc.text('+92 (316) 503-2128', margin, footerY + 40);
        doc.text('www.marwahtravels.com', pageWidth / 2, footerY + 28, { align: 'center' });
        doc.text('24/7 Customer Support', pageWidth / 2, footerY + 40, { align: 'center' });
        doc.text('Licensed Travel Agency', pageWidth - margin, footerY + 28, { align: 'right' });
        doc.text('IATA Certified', pageWidth - margin, footerY + 40, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      };

      const drawSectionHeader = (title: string, yPos: number) => {
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.roundedRect(margin, yPos, contentWidth, 28, 3, 3, 'F');
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(margin, yPos, 4, 28, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(title, margin + 12, yPos + 18);
        doc.setTextColor(0, 0, 0);
        return yPos + 40;
      };

      const checkPageBreak = (requiredSpace: number) => {
        if (y + requiredSpace > pageHeight - 80) {
          addFooter();
          doc.addPage();
          currentPage++;
          y = addHeader(currentPage);
          return true;
        }
        return false;
      };

      let currentPage = 1;
      y = addHeader(currentPage);

      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.roundedRect(margin, y, contentWidth, 60, 5, 5, 'FD');
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(2);
      doc.roundedRect(margin, y, contentWidth, 60, 5, 5, 'S');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text('Booking Reference', margin + 15, y + 20);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(full.id, margin + 15, y + 42);
      
      const statusX = pageWidth - margin - 100;
      const statusColor = full.status === 'confirmed' ? [34, 197, 94] : 
                         full.status === 'pending' ? [234, 179, 8] : [239, 68, 68];
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(statusX, y + 15, 85, 30, 4, 4, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(full.status.toUpperCase(), statusX + 42.5, y + 35, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      y += 75;

      const costingTotals = data?.costing?.totals || data?.pricing?.totals || {};
      const totalCost = costingTotals.totalCostPrice || costingTotals.totalCost || 0;
      const totalSale = costingTotals.totalSalePrice || costingTotals.totalSale || 0;
      const profit = costingTotals.profit || (totalSale - totalCost) || 0;
      
      if (totalCost || totalSale || profit) {
        checkPageBreak(80);
        doc.setFillColor(240, 249, 255);
        doc.roundedRect(margin, y, contentWidth, 70, 5, 5, 'F');
        doc.setDrawColor(30, 58, 138);
        doc.setLineWidth(1.5);
        doc.roundedRect(margin, y, contentWidth, 70, 5, 5, 'S');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text('PROFIT SUMMARY', margin + 15, y + 18);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const profitLabelX = margin + 15;
        const profitValueX = margin + 120;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Total Cost:', profitLabelX, y + 38);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrency(totalCost), profitValueX, y + 38);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Total Sale:', profitLabelX + 200, y + 38);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrency(totalSale), profitValueX + 200, y + 38);
        
        doc.setFont('helvetica', 'bold');
        doc.text('Profit:', profitLabelX, y + 55);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(formatCurrency(profit), profitValueX, y + 55);
        
        doc.setTextColor(0, 0, 0);
        y += 85;
      }

      y = drawSectionHeader('TRAVELER INFORMATION', y);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const labelX = margin + 15;
      const valueX = margin + 150;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Full Name:', labelX, y); 
      doc.setFont('helvetica', 'normal');
      doc.text(full.customerName, valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Email Address:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(full.email, valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Contact Number:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(full.phone || '—', valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Assigned Agent:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(full.agentName || 'Not Assigned', valueX, y); y += 25;

      checkPageBreak(150);
      y = drawSectionHeader('TRAVEL DATES & PACKAGE', y);
      doc.setFontSize(10);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Booking Date:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(full.dates.bookingDate), valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Departure Date:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(full.dates.departureDate), valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Return Date:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(full.dates.returnDate), valueX, y); y += 16;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Package:', labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(full.pkg, valueX, y); y += 25;

      checkPageBreak(200);
      y = drawSectionHeader('FLIGHT DETAILS', y);
      doc.setFontSize(10);
      
      if (full.flight.route) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin + 15, y, contentWidth - 30, 35, 3, 3, 'S');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(full.flight.route.replace('✈', 'to').replace('→', 'to'), margin + 25, y + 23);
        doc.setTextColor(0, 0, 0);
        y += 45;
      }
      
      doc.setFontSize(10);
      if (full.flight.class) {
        doc.setFont('helvetica', 'bold');
        doc.text('Travel Class:', labelX, y);
        doc.setFont('helvetica', 'normal');
        doc.text(full.flight.class.toUpperCase(), valueX, y); y += 16;
      }
      if (full.flight.pnr) {
        doc.setFont('helvetica', 'bold');
        doc.text('PNR Code:', labelX, y);
        doc.setFont('helvetica', 'normal');
        doc.text(full.flight.pnr, valueX, y); y += 16;
      }
      
      if (full.flight.itinerary) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Flight Itinerary:', labelX, y); y += 16;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines = String(full.flight.itinerary).split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) => {
          checkPageBreak(15);
          doc.text(line.trim(), labelX + 10, y);
          y += 13;
        });
        y += 5;
      }
      y += 10;

      if (full.hotels.length) {
        checkPageBreak(100);
        y = drawSectionHeader('ACCOMMODATION DETAILS', y);
        
        autoTable(doc, {
          startY: y,
          head: [['Hotel Name', 'Room Type', 'Check-In Date', 'Check-Out Date']],
          body: full.hotels.map((h: any) => [
            h.hotelName || 'Not specified', 
            h.roomType || 'Standard', 
            formatDate(h.checkIn), 
            formatDate(h.checkOut)
          ]),
          styles: { 
            fontSize: 9,
            cellPadding: 8,
            lineColor: [220, 220, 220],
            lineWidth: 0.5
          },
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10 
          },
          alternateRowStyles: { fillColor: lightGray },
          margin: { left: margin, right: margin },
          theme: 'grid'
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      if (full.visas.length) {
        checkPageBreak(100);
        y = drawSectionHeader('VISA INFORMATION', y);
        
        autoTable(doc, {
          startY: y,
          head: [['Passenger Name', 'Nationality', 'Visa Type']],
          body: full.visas.map((v: any) => [
            v.name || '—', 
            v.nationality || '—', 
            v.visaType || '—'
          ]),
          styles: { 
            fontSize: 9,
            cellPadding: 8,
            lineColor: [220, 220, 220],
            lineWidth: 0.5
          },
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10 
          },
          alternateRowStyles: { fillColor: lightGray },
          margin: { left: margin, right: margin },
          theme: 'grid'
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      if (full.transport.legs.length) {
        checkPageBreak(100);
        y = drawSectionHeader('TRANSPORTATION DETAILS', y);
        
        autoTable(doc, {
          startY: y,
          head: [['From', 'To', 'Vehicle', 'Date', 'Time']],
          body: full.transport.legs.map((l: any) => [
            l.from || '—', 
            l.to || '—', 
            l.vehicleType || '—', 
            formatDate(l.date), 
            l.time || '—'
          ]),
          styles: { 
            fontSize: 9,
            cellPadding: 8,
            lineColor: [220, 220, 220],
            lineWidth: 0.5
          },
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10 
          },
          alternateRowStyles: { fillColor: lightGray },
          margin: { left: margin, right: margin },
          theme: 'grid'
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      if (full.pricing.table?.length) {
        checkPageBreak(150);
        y = drawSectionHeader(' PRICING BREAKDOWN', y);
        
        const totalAmount = full.pricing.table.reduce((sum: number, r: any) => sum + (r.totalSale || 0), 0);
        
        autoTable(doc, {
          startY: y,
          head: [['Service/Item', 'Qty', 'Unit Price', 'Total']],
          body: [
            ...full.pricing.table.map((r: any) => [
              r.label || '—',
              String(r.quantity ?? 0),
              formatCurrency(r.salePerQty || 0),
              formatCurrency(r.totalSale || 0)
            ]),
            ['', '', { content: 'TOTAL:', styles: { fontStyle: 'bold', halign: 'right' } }, 
             { content: formatCurrency(totalAmount), styles: { fontStyle: 'bold', fillColor: lightGray } }]
          ],
          styles: { 
            fontSize: 9,
            cellPadding: 8,
            lineColor: [220, 220, 220],
            lineWidth: 0.5
          },
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255], 
            fontStyle: 'bold',
            fontSize: 10 
          },
          alternateRowStyles: { fillColor: [255, 255, 255] },
          margin: { left: margin, right: margin },
          theme: 'grid',
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 70, halign: 'right' },
            3: { cellWidth: 70, halign: 'right' }
          }
        });
        y = (doc as any).lastAutoTable.finalY + 20;
      }

      if (data?.paymentReceived || data?.paymentDue) {
        checkPageBreak(150);
        y = drawSectionHeader('PAYMENT INFORMATION', y);
        
        if (data?.paymentReceived) {
          doc.setFillColor(220, 252, 231);
          doc.roundedRect(margin + 15, y, (contentWidth / 2) - 25, 90, 3, 3, 'F');
          doc.setDrawColor(34, 197, 94);
          doc.setLineWidth(1);
          doc.roundedRect(margin + 15, y, (contentWidth / 2) - 25, 90, 3, 3, 'S');
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(34, 197, 94);
          doc.text('PAYMENT RECEIVED', margin + 25, y + 20);
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`Amount: ${formatCurrency(data.paymentReceived.amount || 0)}`, margin + 25, y + 38);
          doc.text(`Method: ${(data.paymentReceived.method || '—').replace('_', ' ').toUpperCase()}`, margin + 25, y + 52);
          if (data.paymentReceived.date) {
            doc.text(`Date: ${formatDate(data.paymentReceived.date)}`, margin + 25, y + 66);
          }
          if (data.paymentReceived.reference) {
            doc.text(`Ref: ${data.paymentReceived.reference}`, margin + 25, y + 80);
          }
        }
        
        if (data?.paymentDue) {
          const xPos = pageWidth - margin - (contentWidth / 2) + 10;
          doc.setFillColor(254, 226, 226);
          doc.roundedRect(xPos, y, (contentWidth / 2) - 25, 90, 3, 3, 'F');
          doc.setDrawColor(239, 68, 68);
          doc.setLineWidth(1);
          doc.roundedRect(xPos, y, (contentWidth / 2) - 25, 90, 3, 3, 'S');
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(239, 68, 68);
          doc.text('PAYMENT DUE', xPos + 10, y + 20);
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(`Amount: ${formatCurrency(data.paymentDue.amount || 0)}`, xPos + 10, y + 38);
          doc.text(`Method: ${(data.paymentDue.method || '—').replace('_', ' ').toUpperCase()}`, xPos + 10, y + 52);
          if (data.paymentDue.dueDate) {
            doc.text(`Due: ${formatDate(data.paymentDue.dueDate)}`, xPos + 10, y + 66);
          }
          if (data.paymentDue.notes) {
            doc.text(`Notes: ${data.paymentDue.notes}`, xPos + 10, y + 80);
          }
        }
        
        y += 110;
      }

      checkPageBreak(100);
      y = drawSectionHeader('CREDIT CARD INFORMATION', y);
      
      const hasCardInfo = full.payment?.cardNumber || data.cardNumber || full.payment?.cardholderName || full.payment?.cardLast4 || full.payment?.expiryDate || full.payment?.method;
      
      if (hasCardInfo) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        if (full.payment?.cardholderName) {
          doc.text(`Cardholder Name: ${full.payment.cardholderName}`, margin + 20, y);
          y += 18;
        }
        
        if (full.payment?.cardNumber) {
          doc.text(`Card Number: ${full.payment.cardNumber}`, margin + 20, y);
          y += 18;
        } else if (data.cardNumber) {
          doc.text(`Card Number: ${data.cardNumber}`, margin + 20, y);
          y += 18;
        } else if (full.payment?.cardLast4) {
          doc.text(`Card Number: **** **** **** ${full.payment.cardLast4}`, margin + 20, y);
          y += 18;
        }
        
        if (full.payment?.expiryDate) {
          doc.text(`Expiry Date: ${full.payment.expiryDate}`, margin + 20, y);
          y += 18;
        }
        
        if (full.payment?.method) {
          const methodNames: Record<string, string> = {
            'credit_card': 'Credit Card',
            'bank_transfer': 'Bank Transfer',
            'cash': 'Cash',
            'installments': 'Installments'
          };
          doc.text(`Payment Method: ${methodNames[full.payment.method] || full.payment.method}`, margin + 20, y);
          y += 18;
        }
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text('No credit card information provided', margin + 20, y);
      }
      
      y += 25;

      checkPageBreak(80);
      doc.setFillColor(255, 243, 205);
      doc.roundedRect(margin, y, contentWidth, 60, 3, 3, 'F');
      doc.setDrawColor(234, 179, 8);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, contentWidth, 60, 3, 3, 'S');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('IMPORTANT NOTICE:', margin + 15, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const noticeText = 'Please ensure all travel documents are valid for at least 6 months. Arrive at the airport 3 hours before departure. Contact your agent for any changes or cancellations.';
      const splitNotice = doc.splitTextToSize(noticeText, contentWidth - 30);
      doc.text(splitNotice, margin + 15, y + 30);

      addFooter();

      doc.save(`MARWAH-Booking-${full.id}.pdf`);
    } catch (e: any) {
      console.error('Full PDF failed', e);
      const errorMessage = e?.response?.data?.message || e?.message || 'Failed to generate full PDF';
      if (e?.response?.status === 403) {
        alert('You do not have permission to generate this PDF. Only the booking owner or admin can generate PDFs.');
      } else {
        alert(`Failed to generate full PDF: ${errorMessage}`);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Agent Performance Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Bookings by Agents
          </h3>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setChartPeriod('week')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  chartPeriod === 'week'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Current Week
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                  chartPeriod === 'month'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Current Month
              </button>
              <button
                onClick={() => setChartPeriod('year')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                  chartPeriod === 'year'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Current Year
              </button>
            </div>
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                fetchAgents();
                fetchBookings();
              }}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-6">
          {chartPeriod === 'week' && 'Current Week'}
          {chartPeriod === 'month' && 'Current Month'}
          {chartPeriod === 'year' && 'Current Year'}
          {' '}({filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''})
        </div>
        {agentPerformanceData.length > 0 ? (
          <BarChart data={agentPerformanceData} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            {agents.length === 0 ? (
              <div>
                <p>No agents available</p>
                <p className="text-sm mt-2">
                  {!localStorage.getItem('token') ? 'Please log in to view agents' : 'Loading agents...'}
                </p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div>
                <p>No booking data available for {chartPeriod === 'week' ? 'current week' : chartPeriod === 'month' ? 'current month' : 'current year'}</p>
                <p className="text-sm mt-2">Try selecting a different time period</p>
              </div>
            ) : (
              <div>
                <p>No agents have bookings in this period</p>
                <p className="text-sm mt-2">Try selecting a different time period</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Approvals */}
      {totalPendingApprovals > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            Pending Approvals ({totalPendingApprovals})
          </h3>
          <div className="space-y-4">
            {/* Pending Bookings */}
            {pendingBookings.map((booking) => (
              <div key={`booking-${booking.id}`} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-gray-900">Booking Update - {booking.customer}</h4>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Agent: {booking.agentName}</p>
                    <p className="text-sm text-gray-600">Package: {booking.package}</p>
                    <p className="text-sm text-gray-600">Amount: {booking.amount}</p>
                    <p className="text-sm text-gray-600">Customer: {booking.customer}</p>
                    <p className="text-sm text-gray-600">Email: {booking.email}</p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleDownloadPDF(booking.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => handleApproveBooking(booking.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Pending Inquiries */}
            {pendingInquiries.map((inquiry) => (
              <div key={`inquiry-${inquiry.id}`} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-gray-900">Inquiry Update - {inquiry.subject}</h4>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Agent: {inquiry.agentName || 'Unassigned'}</p>
                    <p className="text-sm text-gray-600">Customer: {inquiry.name}</p>
                    <p className="text-sm text-gray-600">Email: {inquiry.email}</p>
                    <p className="text-sm text-gray-600">Priority: {inquiry.priority}</p>
                    <p className="text-sm text-gray-600">Message: {inquiry.message?.substring(0, 100)}...</p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApproveInquiry(inquiry.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectInquiry(inquiry.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;