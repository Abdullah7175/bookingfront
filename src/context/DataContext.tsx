// src/context/DataContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { Booking, Inquiry, Agent, Analytics } from '../types';
import { http } from '../lib/http';

interface DataContextType {
  bookings: Booking[];
  inquiries: Inquiry[];
  agents: Agent[];
  analytics: Analytics;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  updateBooking: (id: string, updates: Partial<Booking>, requiresApproval?: boolean) => void;
  deleteBooking: (id: string, requiresApproval?: boolean) => void;
  addInquiry: (inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInquiry: (id: string, updates: Partial<Inquiry>, requiresApproval?: boolean) => void;
  addAgent: (agent: Omit<Agent, 'id' | 'totalBookings' | 'totalRevenue' | 'recentBookings'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  fetchAgents: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  fetchInquiries: () => Promise<void>;
  approveChange: (type: 'booking' | 'inquiry', id: string) => void;
  rejectChange: (type: 'booking' | 'inquiry', id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/** ---------- helpers ---------- **/
const idOf = (v: any): string | undefined =>
  (v && (v._id || v.id || v)) ? String(v._id || v.id || v) : undefined;

const toMoneyString = (v: any): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'number') return `$${v}`;
  if (typeof v === 'string') return v;
  const n = Number(v);
  return Number.isFinite(n) ? `$${n}` : undefined;
};

// Map /api/agent list item → Agent type (safe)
const mapAgent = (a: any): Agent => ({
  id: idOf(a)!,
  name: a?.name || [a?.firstName, a?.lastName].filter(Boolean).join(' ') || 'Unnamed',
  email: a?.email || '',
  phone: a?.phone || '',
  totalBookings: Number(a?.totalBookings ?? 0) || 0,
  totalRevenue: Number(a?.totalRevenue ?? 0) || 0,
  recentBookings: Array.isArray(a?.recentBookings) ? a.recentBookings : [],
});

// Merge performance metrics into agent list
const applyPerformance = (agents: Agent[], perfArr: any[]): Agent[] => {
  const perfById: Record<string, { bookings: number; revenue: number }> = {};
  for (const p of perfArr || []) {
    const id = idOf(p?._id) || idOf(p) || '';
    if (!id) continue;
    const bookings = Number(p?.bookings ?? p?.totalBookings ?? 0) || 0;
    const revenue = Number(p?.revenue ?? p?.totalRevenue ?? 0) || 0;
    perfById[id] = { bookings, revenue };
  }
  return agents.map((a) => ({
    ...a,
    totalBookings: perfById[a.id]?.bookings ?? a.totalBookings ?? 0,
    totalRevenue: perfById[a.id]?.revenue ?? a.totalRevenue ?? 0,
  }));
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  // ---- Fetch agents (admin only) ----
  const fetchAgents = React.useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user?.role !== 'admin') {
        setAgents([]);
        return;
      }

      // 1) Load the base list
      const listRes = await http.get('/api/agent');
      const rawList = Array.isArray(listRes.data)
        ? listRes.data
        : listRes.data?.data || listRes.data?.agents || [];
      let baseAgents: Agent[] = (rawList as any[]).map(mapAgent);

      // 2) Try to load performance and merge (ignore 400/401/403)
      try {
        const perfRes = await http.get('/api/agent/performance');
        const perfArr = Array.isArray(perfRes.data)
          ? perfRes.data
          : perfRes.data?.data || perfRes.data?.agents || [];
        baseAgents = applyPerformance(baseAgents, perfArr);
      } catch (e: any) {
        const code = e?.response?.status;
        if (![400, 401, 403].includes(code)) {
          console.warn('fetchAgents/performance error:', e?.message || e);
        }
        // continue with baseAgents
      }

      setAgents(baseAgents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setAgents([]);
    }
  }, []);

  // ---- Fetch bookings ----
  const fetchBookings = React.useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const endpoint = user?.role === 'admin' ? '/api/bookings' : '/api/bookings/my';

      const { data } = await http.get(endpoint);
      const raw = Array.isArray(data) ? data : data?.data || data?.bookings || [];

      const mapped: Booking[] = (raw as any[]).map((b) => {
        const id = idOf(b)!;
        const agentId = idOf(b?.agent) || b?.agentId;
        const agentName = b?.agent?.name || b?.agentName;
        const amount = toMoneyString(b?.amount ?? b?.totalAmount);

        return {
          ...b,
          id,
          agentId,
          agentName,
          amount,
        } as Booking;
      });

      setBookings(mapped);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
    }
  }, []);

  // ---- Fetch inquiries ----
  const fetchInquiries = React.useCallback(async () => {
    try {
      const { data } = await http.get('/api/inquiries');
      const raw = Array.isArray(data) ? data : data?.data || data?.inquiries || [];

      const mapped: Inquiry[] = (raw as any[]).map((i) => {
        const id = idOf(i)!;
        const agentId = idOf(i?.assignedAgent) || i?.agentId;
        const agentName = i?.assignedAgent?.name || i?.agentName;

        return {
          ...i,
          id,
          agentId,
          agentName,
        } as Inquiry;
      });

      setInquiries(mapped);
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
      setInquiries([]);
    }
  }, []);

  // Load all data on mount (only if user is authenticated)
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchAgents();
      fetchBookings();
      fetchInquiries();
    }
  }, []); // run once

  // React to auth changes (another tab/window)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('token');
      if (token) {
        fetchAgents();
        fetchBookings();
        fetchInquiries();
      } else {
        setAgents([]);
        setBookings([]);
        setInquiries([]);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const analytics: Analytics = {
    totalBookings: bookings.length,
    monthlyBookings: bookings.filter(
      (b) =>
        b.createdAt &&
        new Date(b.createdAt).getMonth() === new Date().getMonth()
    ).length,
    totalRevenue: bookings.reduce((sum, b) => {
      if (!b.amount) return sum;
      if (typeof b.amount === 'number') return sum + b.amount;
      if (typeof b.amount === 'string') {
        const n = parseFloat(b.amount.replace(/[$,]/g, ''));
        return sum + (Number.isFinite(n) ? n : 0);
      }
      const n = Number(b.amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0),
    activeInquiries: inquiries.filter((i) => i.status === 'pending').length,
    resolvedInquiries: inquiries.filter((i) => i.status !== 'pending').length,
    agentPerformance: agents.map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      bookings: bookings.filter((b) => b.agentId === agent.id).length,
      revenue: bookings
        .filter((b) => b.agentId === agent.id)
        .reduce((sum, b) => {
          if (!b.amount) return sum;
          if (typeof b.amount === 'number') return sum + b.amount;
          if (typeof b.amount === 'string') {
            const n = parseFloat(b.amount.replace(/[$,]/g, ''));
            return sum + (Number.isFinite(n) ? n : 0);
          }
          const n = Number(b.amount);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0),
      inquiries: inquiries.filter((i) => i.agentId === agent.id).length,
    })),
    monthlyTrends: [
      { month: 'Jan', bookings: 8, revenue: 24000 },
      { month: 'Feb', bookings: 12, revenue: 36000 },
      { month: 'Mar', bookings: 15, revenue: 45000 },
    ],
  };

  const addBooking = (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const newBooking: Booking = {
      ...bookingData,
      id: `BK${String(bookings.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBookings((prev) => [...prev, newBooking]);
  };

  const updateBooking = (id: string, updates: Partial<Booking>, requiresApproval = false) => {
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id === id) {
          if (requiresApproval) {
            return {
              ...booking,
              pendingChanges: updates,
              approvalStatus: 'pending',
            };
          }
          return { ...booking, ...updates };
        }
        return booking;
      })
    );
  };

  const deleteBooking = (id: string, requiresApproval = false) => {
    if (requiresApproval) {
      updateBooking(id, { status: 'cancelled' }, true);
    } else {
      setBookings((prev) => prev.filter((booking) => booking.id !== id));
    }
  };

  const addInquiry = (inquiryData: Omit<Inquiry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newInquiry: Inquiry = {
      ...inquiryData,
      id: `INQ${String(inquiries.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInquiries((prev) => [...prev, newInquiry]);
  };

  const updateInquiry = (id: string, updates: Partial<Inquiry>, requiresApproval = false) => {
    setInquiries((prev) =>
      prev.map((inquiry) => {
        if (inquiry.id === id) {
          if (requiresApproval) {
            return {
              ...inquiry,
              pendingChanges: updates,
              approvalStatus: 'pending',
            };
          }
          return { ...inquiry, ...updates, updatedAt: new Date().toISOString() };
        }
        return inquiry;
      })
    );
  };

  const addAgent = (
    agentData: Omit<Agent, 'id' | 'totalBookings' | 'totalRevenue' | 'recentBookings'>
  ) => {
    const newAgent: Agent = {
      ...agentData,
      id: `AG${String(agents.length + 1).padStart(3, '0')}`,
      totalBookings: 0,
      totalRevenue: 0,
      recentBookings: [],
    };
    setAgents((prev) => [...prev, newAgent]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)));
  };

  const deleteAgent = (id: string) => {
    setAgents((prev) => prev.filter((agent) => agent.id !== id));
  };

  const approveChange = async (type: 'booking' | 'inquiry', id: string) => {
    try {
      if (type === 'booking') {
        const { data } = await http.put(`/api/bookings/${id}/approve`);
        if (data.success) {
          setBookings((prev) =>
            prev.map((booking) =>
              booking.id === id
                ? { ...booking, approvalStatus: 'approved', status: 'confirmed' }
                : booking
            )
          );
        }
      } else {
        const { data } = await http.put(`/api/inquiries/${id}/approve`);
        if (data.success) {
          setInquiries((prev) =>
            prev.map((inquiry) =>
              inquiry.id === id
                ? { ...inquiry, approvalStatus: 'approved', status: 'responded' }
                : inquiry
            )
          );
        }
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const rejectChange = async (type: 'booking' | 'inquiry', id: string) => {
    try {
      if (type === 'booking') {
        const { data } = await http.put(`/api/bookings/${id}/reject`);
        if (data.success) {
          setBookings((prev) =>
            prev.map((booking) =>
              booking.id === id
                ? { ...booking, approvalStatus: 'rejected', status: 'cancelled' }
                : booking
            )
          );
        }
      } else {
        const { data } = await http.put(`/api/inquiries/${id}/reject`);
        if (data.success) {
          setInquiries((prev) =>
            prev.map((inquiry) =>
              inquiry.id === id
                ? { ...inquiry, approvalStatus: 'rejected', status: 'closed' }
                : inquiry
            )
          );
        }
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const value = {
    bookings,
    inquiries,
    agents,
    analytics,
    addBooking,
    updateBooking,
    deleteBooking,
    addInquiry,
    updateInquiry,
    addAgent,
    updateAgent,
    deleteAgent,
    fetchAgents,
    fetchBookings,
    fetchInquiries,
    approveChange,
    rejectChange,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
