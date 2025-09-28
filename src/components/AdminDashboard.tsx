import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import StatCard from './StatCard';
import PieChart from './PieChart';
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

  // Refresh data on mount
  React.useEffect(() => {
    fetchBookings();
    fetchInquiries();
  }, []);

  // Get pending approvals
  const pendingBookings = bookings.filter(b => b.approvalStatus === 'pending');
  const pendingInquiries = inquiries.filter(i => i.approvalStatus === 'pending');
  const totalPendingApprovals = pendingBookings.length + pendingInquiries.length;

  // Calculate real-time metrics
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => {
      if (!b.amount || typeof b.amount !== 'string') return sum;
      const amount = parseFloat(b.amount.replace(/[$,]/g, '')) || 0;
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

  // Calculate real-time agent performance
  const agentPerformanceData = agents && agents.length > 0 ? agents.map((agent, index) => {
    const agentBookings = bookings.filter(b => b.agentId === agent.id).length;
    const totalBookings = bookings.length || 1; // Prevent division by zero
    const percentage = totalBookings > 0 ? (agentBookings / totalBookings) * 100 : 0;
    
    return {
      name: agent.name || `Agent ${index + 1}`,
      value: isNaN(percentage) ? 0 : percentage,
      color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F59E0B'][index % 6]
    };
  }) : [];


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

  // Download PDF
  const handleDownloadPDF = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Bookings by Agents
          </h3>
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              fetchAgents();
            }}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
        <div className="text-sm text-gray-500 mb-6">Current Year</div>
        {agentPerformanceData.length > 0 ? (
          <PieChart data={agentPerformanceData} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            {agents.length === 0 ? (
              <div>
                <p>No agents available</p>
                <p className="text-sm mt-2">
                  {!localStorage.getItem('token') ? 'Please log in to view agents' : 'Loading agents...'}
                </p>
              </div>
            ) : 'No booking data available'}
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