// src/components/SaleAgents.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import AgentModal from './AgentModal';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  Award,
  TrendingUp,
} from 'lucide-react';
import { http } from '../lib/http';

type UiRecentBooking = { id: string; customer: string; amount: number };
type UiAgent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  totalBookings: number;
  totalRevenue: number;
  monthlyTarget: number;
  joinDate?: string;
  status: 'active' | 'inactive' | string;
  recentBookings: UiRecentBooking[];
};

const toId = (v: any): string =>
  (v && typeof v === 'object' && (v._id || v.id)) || (typeof v === 'string' ? v : '') || '';

/** Map raw agent → UI agent (performance injected later) */
function baseMapAgent(a: any): UiAgent {
  const id = toId(a) || crypto.randomUUID();
  const name =
    a?.name ||
    [a?.firstName, a?.lastName].filter(Boolean).join(' ') ||
    'Unnamed Agent';

  return {
    id,
    name,
    email: a?.email ?? '',
    phone: a?.phone ?? '',
    avatar: a?.avatar ?? null,
    totalBookings: Number(a?.totalBookings ?? 0) || 0,
    totalRevenue: Number(a?.totalRevenue ?? 0) || 0,
    monthlyTarget: Number(a?.monthlyTarget ?? 5000) || 5000,
    joinDate: a?.joinDate || a?.createdAt || '',
    status: a?.isActive === false ? 'inactive' : 'active',
    recentBookings: Array.isArray(a?.recentBookings)
      ? a.recentBookings.map((b: any) => ({
          id: toId(b),
          customer: b?.customer || b?.customerName || '—',
          amount: Number(b?.amount ?? b?.totalAmount ?? 0) || 0,
        }))
      : [],
  };
}

const SaleAgents: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<UiAgent | null>(null);

  const {
    agents: contextAgents,
    fetchAgents,
  } = useData();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Performance map: agentId -> { bookings, revenue }
  const [perf, setPerf] = useState<Record<string, { bookings: number; revenue: number }>>({});

  // Load agents from API (via context) + load performance
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        await fetchAgents();
        // then fetch performance (admin-only route)
        try {
          const { data } = await http.get('/api/agent/performance');
          // expecting { ok: true, data: [{ _id: agentId, bookings, revenue }, ...] }
          const p: Record<string, { bookings: number; revenue: number }> = {};
          const rows = data?.data ?? data ?? [];
          for (const r of rows) {
            const id = toId(r?._id);
            if (!id) continue;
            p[id] = {
              bookings: Number(r?.bookings ?? 0) || 0,
              revenue: Number(r?.revenue ?? 0) || 0,
            };
          }
          setPerf(p);
        } catch (e: any) {
          // If 400/403, silently ignore (non-admin or no company header)
          // console.warn('performance fetch skipped:', e?.response?.status);
        }
      } catch (e: any) {
        setErr(e?.response?.data?.message || e?.message || 'Failed to fetch agents');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge performance into mapped agents
  const agents = useMemo<UiAgent[]>(() => {
    const list = (contextAgents || []).map(baseMapAgent);
    return list.map(a => {
      const p = perf[a.id];
      return p
        ? { ...a, totalBookings: p.bookings, totalRevenue: p.revenue }
        : a;
    });
  }, [contextAgents, perf]);

  // ---- Create agent ----
  const handleCreateAgent = async (agentData: any) => {
    const payload = {
      name: [agentData.firstName, agentData.lastName].filter(Boolean).join(' '),
      firstName: agentData.firstName,
      lastName: agentData.lastName,
      email: agentData.email,
      password: agentData.password, // required for creation
      phone: agentData.phone,
      monthlyTarget: Number(agentData.monthlyTarget) || 5000,
      commissionRate: Number(agentData.commissionRate) || 5.0,
      department: agentData.department || 'sales',
      isActive: true,
    };

    try {
      await http.post('/api/agent/register', payload);
      await fetchAgents();
      // update performance too
      try {
        const { data } = await http.get('/api/agent/performance');
        const p: Record<string, { bookings: number; revenue: number }> = {};
        for (const r of data?.data ?? []) {
          const id = toId(r?._id);
          if (!id) continue;
          p[id] = { bookings: Number(r?.bookings ?? 0) || 0, revenue: Number(r?.revenue ?? 0) || 0 };
        }
        setPerf(p);
      } catch {}
      setIsAgentModalOpen(false);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const yes = confirm('Agent already exists. Update their profile & password instead?');
        if (yes) {
          try {
            await http.post('/api/agent/register?upsert=true', payload);
            await fetchAgents();
            setIsAgentModalOpen(false);
            return;
          } catch (ee: any) {
            alert(ee?.response?.data?.message || ee?.message || 'Failed to upsert agent');
            return;
          }
        }
      }
      alert(e?.response?.data?.message || e?.message || 'Failed to create agent');
    }
  };

  // ---- Delete agent ----
  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return;
    try {
      await http.delete(`/api/agent/${id}`);
      await fetchAgents();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to delete agent');
    }
  };

  // ---- Edit agent ----
  const handleEditAgent = async (agentData: any) => {
    if (!editingAgent) return;

    const payload: any = {
      name: [agentData.firstName, agentData.lastName].filter(Boolean).join(' '),
      email: agentData.email,
      phone: agentData.phone,
      monthlyTarget: Number(agentData.monthlyTarget) || 5000,
      commissionRate: Number(agentData.commissionRate) || 5.0,
      department: agentData.department || 'sales',
    };
    if (agentData.password?.trim()) payload.password = agentData.password;

    try {
      await http.put(`/api/agent/${editingAgent.id}`, payload);
      await fetchAgents();
      setIsAgentModalOpen(false);
      setEditingAgent(null);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to update agent');
    }
  };

  const openEditModal = (agent: UiAgent) => {
    setEditingAgent(agent);
    setIsAgentModalOpen(true);
  };

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [agents, searchTerm]
  );

  const overview = useMemo(() => {
    const totalRevenue = agents.reduce((s, a) => s + a.totalRevenue, 0);
    const totalBookings = agents.reduce((s, a) => s + a.totalBookings, 0);
    const avgTargetPct =
      agents.length === 0
        ? 0
        : agents.reduce(
            (s, a) =>
              s + Math.min((a.totalRevenue / Math.max(a.monthlyTarget, 1)) * 100, 100),
            0
          ) / agents.length;
    return {
      totalAgents: agents.length,
      totalBookings,
      totalRevenue,
      avgTargetPct,
    };
  }, [agents]);

  const getProgressPercentage = (revenue: number, target: number) =>
    Math.min((revenue / Math.max(target, 1)) * 100, 100);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sale Agents</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Home</span>
            <span>/</span>
            <span className="text-blue-600">Sale Agents</span>
          </div>
        </div>
        <button
          onClick={() => setIsAgentModalOpen(true)}
          className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Agent</span>
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          Loading agents…
        </div>
      )}
      {err && !loading && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">
          {err}
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                {overview.totalAgents}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Total Agents</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <Award className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                {overview.totalBookings}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Total Bookings</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                ${overview.totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Total Revenue</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <div className="ml-2 sm:ml-4">
              <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                {overview.avgTargetPct.toFixed(1)}%
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Avg. Target</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {filteredAgents.map((agent) => {
          const pct = getProgressPercentage(agent.totalRevenue, agent.monthlyTarget);
          const bar = getProgressColor(pct);

          return (
            <div
              key={agent.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {agent.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500">{agent.id}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    title="Edit agent"
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    onClick={() => {
                      setEditingAgent(agent);
                      setIsAgentModalOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    title="Delete agent"
                    onClick={() => deleteAgent(agent.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{agent.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{agent.phone}</span>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {agent.totalBookings}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">Bookings</p>
                </div>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    ${agent.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">Revenue</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="text-gray-600">Monthly Target</span>
                  <span className="font-medium">{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>${agent.totalRevenue.toLocaleString()}</span>
                  <span>${agent.monthlyTarget.toLocaleString()}</span>
                </div>
              </div>

              {/* Recent Bookings */}
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2">
                  Recent Bookings
                </h4>
                <div className="space-y-2">
                  {agent.recentBookings.slice(0, 2).map((b, idx) => (
                    <div
                      key={b.id || idx}
                      className="flex items-center justify-between text-xs sm:text-sm"
                    >
                      <span className="text-gray-600 truncate flex-1 mr-2">
                        {b.customer}
                      </span>
                      <span className="font-medium text-gray-900 whitespace-nowrap">
                        ${b.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {agent.recentBookings.length === 0 && (
                    <p className="text-xs sm:text-sm text-gray-400 italic">
                      No recent bookings
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Modal */}
      <AgentModal
        isOpen={isAgentModalOpen}
        onClose={() => {
          setIsAgentModalOpen(false);
          setEditingAgent(null);
        }}
        onSubmit={editingAgent ? handleEditAgent : handleCreateAgent}
        initialData={editingAgent}
        isEditing={!!editingAgent}
      />
    </div>
  );
};

export default SaleAgents;
