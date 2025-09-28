// src/components/Inquiries.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { http } from '../lib/http';
import {
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Phone,
} from 'lucide-react';

type UiInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'pending' | 'responded' | 'closed' | string;
  priority: 'low' | 'medium' | 'high' | string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | string;
  response?: string;
  responses?: Array<{ message: string; createdAt: string; responder: string }>;
  agentId?: string;
  agentName?: string;
  createdAt?: string;
};

function mapInquiry(i: any): UiInquiry {
  const id = i?._id || i?.id || crypto.randomUUID();
  return {
    id,
    name: i?.name ?? i?.customerName ?? 'Unknown',
    email: i?.email ?? '',
    phone: i?.phone ?? i?.contactNumber ?? '',
    subject: i?.subject ?? '(No subject)',
    message: i?.message ?? '',
    status: (i?.status ?? 'pending') as UiInquiry['status'],
    priority: (i?.priority ?? 'low') as UiInquiry['priority'],
    approvalStatus: i?.approvalStatus,
    response: i?.response,
    responses: i?.responses || [], // Add responses array
    agentId: i?.agentId ?? i?.agent?.id,
    agentName: i?.agentName ?? i?.agent?.name ?? '',
    createdAt: i?.createdAt,
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'responded':
      return 'bg-blue-100 text-blue-800';
    case 'closed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4" />;
    case 'responded':
      return <MessageSquare className="h-4 w-4" />;
    case 'closed':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <XCircle className="h-4 w-4" />;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-orange-100 text-orange-800';
    case 'low':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.valueOf())) return '—';
  return d.toLocaleString();
}

const Inquiries: React.FC = () => {
  const { user } = useAuth();
  const { inquiries, fetchInquiries } = useData();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'responded' | 'closed'>('all');

  const [responseText, setResponseText] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null);
  const canEditInquiry = (inq: UiInquiry) => isAdmin || inq.agentId === user?.id || inq.agentId === user?.agentId;

  // Map inquiries from context to UI format
  const list = useMemo(() => {
    return inquiries.map(mapInquiry);
  }, [inquiries]);

  useEffect(() => {
    fetchInquiries();
  }, []); // Run only once on mount

  const startResponse = (id: string) => {
    setRespondingTo(id);
    setResponseText('');
  };
  const cancelResponse = () => {
    setRespondingTo(null);
    setResponseText('');
  };

  const toggleDetails = (id: string) => {
    setExpandedInquiry(expandedInquiry === id ? null : id);
  };

  // Send response to backend
  const respond = async (inquiryId: string, text: string) => {
    try {
      const { data } = await http.post(`/api/inquiries/${inquiryId}/respond`, {
        message: text, // Changed from 'response' to 'message' to match backend
      });

      // Update inquiry status if admin and inquiry is still pending
      if (isAdmin) {
        const inquiry = inquiries.find(i => i.id === inquiryId);
        if (inquiry && inquiry.status === 'pending') {
          await http.put(`/api/inquiries/${inquiryId}`, { status: 'responded' });
        }
      }

      // Refresh inquiries from the server
      await fetchInquiries();
    } catch (error) {
      console.error('Failed to respond to inquiry:', error);
      setErr('Failed to send response. Please try again.');
    }
  };

  const closeInquiry = async (inquiryId: string) => {
    try {
      await http.put(`/api/inquiries/${inquiryId}`, { status: 'closed' });
      // Refresh inquiries from the server
      await fetchInquiries();
    } catch (error) {
      console.error('Failed to close inquiry:', error);
      setErr('Failed to close inquiry. Please try again.');
    }
  };

  const submitResponse = async () => {
    if (!respondingTo || !responseText.trim()) return;
    try {
      await respond(respondingTo, responseText.trim());
      setRespondingTo(null);
      setResponseText('');
    } catch (e) {
      alert('Failed to send response');
    }
  };

  const displayInquiries = useMemo(() => {
    // For agents, only show inquiries they created
    return isAdmin ? list : list.filter((i) => i.agentId === user?.id || i.agentId === user?.agentId);
  }, [isAdmin, list, user]);

  const filteredInquiries = displayInquiries.filter((inquiry) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      inquiry.name.toLowerCase().includes(s) ||
      inquiry.subject.toLowerCase().includes(s) ||
      inquiry.id.toLowerCase().includes(s);
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = filteredInquiries.filter((i) => i.status === 'pending').length;
  const respondedCount = filteredInquiries.filter((i) => i.status === 'responded').length;
  const closedCount = filteredInquiries.filter((i) => i.status === 'closed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isAdmin ? 'All Inquiries' : 'My Inquiries'}
          </h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Home</span>
            <span>/</span>
            <span className="text-blue-600">Inquiries</span>
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="bg-white rounded-xl border border-gray-200 p-4">Loading inquiries…</div>}
      {err && !loading && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">{err}</div>}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{pendingCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{respondedCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">Responded</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{closedCount}</p>
              <p className="text-xs sm:text-sm text-gray-600">Closed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">{filteredInquiries.length}</p>
              <p className="text-xs sm:text-sm text-gray-600">Total</p>
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
              placeholder="Search inquiries..."
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
            <option value="pending">Pending</option>
            <option value="responded">Responded</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Inquiries List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {filteredInquiries.map((inquiry) => (
            <div key={inquiry.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between space-y-4 xl:space-y-0">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                    <span className="text-xs sm:text-sm font-medium text-blue-600">{inquiry.id}</span>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        inquiry.status
                      )}`}
                    >
                      {getStatusIcon(inquiry.status)}
                      <span>{inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}</span>
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(inquiry.priority)}`}>
                      {inquiry.priority.charAt(0).toUpperCase() + inquiry.priority.slice(1)} Priority
                    </span>
                    {inquiry.approvalStatus === 'pending' && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Pending Approval
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 line-clamp-2">{inquiry.subject}</h3>

                  <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 lg:space-x-6 text-xs sm:text-sm text-gray-500 mb-3">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <User className="h-4 w-4" />
                      <span className="truncate">{inquiry.name}</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{inquiry.email}</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{inquiry.phone}</span>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2 sm:line-clamp-3">{inquiry.message}</p>

                  {inquiry.responses && inquiry.responses.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-1">Responses:</h4>
                      {inquiry.responses.map((response, index) => (
                        <div key={index} className="mb-2 last:mb-0">
                          <p className="text-sm text-blue-800">{response.message}</p>
                          <p className="text-xs text-blue-600 mt-1">
                            {new Date(response.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-500">
                    <div>
                      Assigned to: <span className="font-medium text-gray-900">{inquiry.agentName || '—'}</span>
                      {inquiry.approvalStatus === 'pending' && <span className="ml-2 text-orange-600">(Pending Approval)</span>}
                    </div>
                    <div>Created: {formatDate(inquiry.createdAt)}</div>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 xl:ml-6">
                  <button 
                    onClick={() => toggleDetails(inquiry.id)}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {expandedInquiry === inquiry.id ? 'Hide Details' : 'View Details'}
                  </button>

                  {canEditInquiry(inquiry) && inquiry.status !== 'closed' && (
                    <button
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      onClick={() => startResponse(inquiry.id)}
                    >
                      {inquiry.status === 'responded' ? 'Add Response' : 'Respond'}
                    </button>
                  )}

                  {isAdmin && inquiry.status !== 'closed' && (
                    <button
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      onClick={() => closeInquiry(inquiry.id)}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedInquiry === inquiry.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Inquiry Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Customer Information</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong>Name:</strong> {inquiry.name}</p>
                        <p><strong>Email:</strong> {inquiry.email}</p>
                        <p><strong>Phone:</strong> {inquiry.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Inquiry Information</h5>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><strong>Subject:</strong> {inquiry.subject}</p>
                        <p><strong>Priority:</strong> {inquiry.priority}</p>
                        <p><strong>Status:</strong> {inquiry.status}</p>
                        <p><strong>Created:</strong> {formatDate(inquiry.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Message</h5>
                    <div className="bg-white p-3 rounded border text-sm text-gray-700 whitespace-pre-wrap">
                      {inquiry.message}
                    </div>
                  </div>
                  {inquiry.responses && inquiry.responses.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Responses</h5>
                      <div className="space-y-2">
                        {inquiry.responses.map((response, index) => (
                          <div key={index} className="bg-white p-3 rounded border">
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{response.message}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(response.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Response Form */}
              {respondingTo === inquiry.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Write Response:</h4>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Type your response here..."
                  />
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={submitResponse}
                      disabled={!responseText.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Response
                    </button>
                    <button
                      onClick={cancelResponse}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!loading && !err && filteredInquiries.length === 0 && (
            <div className="p-8 text-center text-gray-500">No inquiries found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inquiries;
