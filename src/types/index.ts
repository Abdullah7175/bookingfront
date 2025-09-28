export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  agentId?: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface Booking {
  id: string;
  customer: string;
  email: string;
  phone: string;
  package: string;
  departureDate: string;
  returnDate: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  amount: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  pendingChanges?: Partial<Booking>;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'pending' | 'responded' | 'closed';
  priority: 'high' | 'medium' | 'low';
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  response?: string;
  pendingChanges?: Partial<Inquiry>;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalBookings: number;
  totalRevenue: number;
  monthlyTarget: number;
  joinDate: string;
  status: 'active' | 'inactive';
  recentBookings: Array<{
    id: string;
    customer: string;
    amount: number;
  }>;
}

export interface Analytics {
  totalBookings: number;
  monthlyBookings: number;
  totalRevenue: number;
  activeInquiries: number;
  resolvedInquiries: number;
  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    bookings: number;
    revenue: number;
    inquiries: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    bookings: number;
    revenue: number;
  }>;
}