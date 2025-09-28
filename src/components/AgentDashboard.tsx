import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import StatCard from './StatCard';
import { Calendar, MessageSquare, TrendingUp, Clock } from 'lucide-react';

/** safely get an id from string | {_id} | undefined */
const toId = (v: any): string | undefined =>
  (v && typeof v === 'object' && v._id) || (typeof v === 'string' ? v : undefined);

/** coerce various amount shapes to a number */
const toAmount = (v: any): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** safe date display */
const fmtDate = (d: any): string => {
  try {
    if (!d) return '';
    const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
    return isNaN(+dt) ? '' : dt.toLocaleDateString();
  } catch {
    return '';
  }
};

const currency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const AgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { bookings: rawBookings, inquiries: rawInquiries } = useData();

  const agentId = toId(user?._id) || toId((user as any)?.id) || toId((user as any)?.agentId);

  const bookings = Array.isArray(rawBookings) ? rawBookings : [];
  const inquiries = Array.isArray(rawInquiries) ? rawInquiries : [];

  // Filter data for current agent
  const agentBookings = bookings.filter((b: any) => {
    const bAgent = toId(b.agent) || toId(b.agentId);
    return agentId && bAgent === agentId;
  });

  const agentInquiries = inquiries.filter((i: any) => {
    const iAgent = toId(i.capturedBy) || toId(i.agent) || toId(i.agentId);
    return agentId && iAgent === agentId;
  });

  // Totals
  const agentRevenue = agentBookings.reduce((sum: number, b: any) => {
    const amount = toAmount(b.totalAmount ?? b.amount);
    return sum + amount;
  }, 0);

  // Pending approvals:
  // - Bookings: approvalStatus === 'pending'
  // - Inquiries: status === 'new' or 'pending' (since inquiries may not have approvalStatus)
  const pendingApprovals = [
    ...agentBookings.filter((b: any) => (b.approvalStatus || b.status) === 'pending'),
    ...agentInquiries.filter((i: any) => ['new', 'pending'].includes(String(i.status || '').toLowerCase())),
  ];

  const stats = [
    { title: 'My Bookings', value: String(agentBookings.length), icon: Calendar, color: 'bg-blue-500', trend: '+5%' },
    { title: 'My Inquiries', value: String(agentInquiries.length), icon: MessageSquare, color: 'bg-emerald-500', trend: '+3%' },
    { title: 'Pending Approvals', value: String(pendingApprovals.length), icon: Clock, color: 'bg-orange-500', trend: 'No change' },
    { title: 'My Revenue', value: currency(agentRevenue), icon: TrendingUp, color: 'bg-purple-500', trend: '+15%' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agent Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Bookings</h3>
          <div className="space-y-4">
            {agentBookings.slice(0, 5).map((booking: any) => {
              const id = booking._id || booking.id;
              const customer = booking.customerName || booking.customer;
              const pkg = booking.package || booking.packageName;
              const when = fmtDate(booking.departureDate || booking.date || booking.createdAt);
              const amount = currency(toAmount(booking.totalAmount ?? booking.amount));
              const status = String(booking.status || 'pending').toLowerCase();

              return (
                <div key={id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-2 h-2 rounded-full mt-2 bg-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{customer || '—'}</p>
                    <p className="text-sm text-gray-500">{pkg || '—'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{when}</p>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{amount}</div>
                </div>
              );
            })}
            {agentBookings.length === 0 && <p className="text-gray-500 text-center py-8">No bookings yet</p>}
          </div>
        </div>

        {/* Recent Inquiries */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Inquiries</h3>
          <div className="space-y-4">
            {agentInquiries.slice(0, 5).map((inquiry: any) => {
              const id = inquiry._id || inquiry.id;
              const name = inquiry.name || inquiry.customerName || inquiry.email || '—';
              const subject = inquiry.subject || '—';
              const created = fmtDate(inquiry.createdAt);
              const priority = String(inquiry.priority || 'normal').toLowerCase();
              const dotClass =
                (inquiry.status || '').toLowerCase() === 'pending'
                  ? 'bg-yellow-500'
                  : (inquiry.status || '').toLowerCase() === 'responded'
                  ? 'bg-blue-500'
                  : 'bg-green-500';

              return (
                <div key={id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-2 ${dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    <p className="text-sm text-gray-500 truncate">{subject}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{created}</p>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : priority === 'medium'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {agentInquiries.length === 0 && <p className="text-gray-500 text-center py-8">No inquiries yet</p>}
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 text-orange-500 mr-2" />
            Pending Admin Approval ({pendingApprovals.length})
          </h3>
          <div className="space-y-4">
            {pendingApprovals.map((item: any) => {
              const id = item._id || item.id;
              const isBooking = !!(item.customerName || item.package || item.totalAmount);
              return (
                <div key={id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {isBooking
                          ? `Booking: ${item.customerName || '—'}`
                          : `Inquiry: ${item.subject || '—'}`}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {isBooking ? item.package || '—' : item.message || '—'}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">Waiting for admin approval</p>
                    </div>
                    <div className="ml-4">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{agentBookings.length}</div>
            <div className="text-sm text-gray-500">Total Bookings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{currency(agentRevenue)}</div>
            <div className="text-sm text-gray-500">Total Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {agentInquiries.filter((i: any) => String(i.status || '').toLowerCase() === 'responded').length}
            </div>
            <div className="text-sm text-gray-500">Resolved Inquiries</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
