import React from 'react';
import StatCard from './StatCard';
import PieChart from './PieChart';
import { Calendar, Users, MessageSquare, TrendingUp } from 'lucide-react';

const Dashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Bookings',
      value: '4',
      icon: Calendar,
      color: 'bg-blue-500',
      trend: '+12%',
    },
    {
      title: 'Active Inquiries',
      value: '23',
      icon: MessageSquare,
      color: 'bg-emerald-500',
      trend: '+8%',
    },
    {
      title: 'Sale Agents',
      value: '3',
      icon: Users,
      color: 'bg-purple-500',
      trend: 'No change',
    },
    {
      title: 'Revenue',
      value: '$12,450',
      icon: TrendingUp,
      color: 'bg-orange-500',
      trend: '+23%',
    },
  ];

  const bookingsData = [
    { name: 'Ali', value: 50, color: '#3B82F6' },
    { name: 'Ahmed', value: 25, color: '#EF4444' },
    { name: 'Sara', value: 25, color: '#10B981' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Home</span>
            <span>/</span>
            <span className="text-blue-600">Dashboard</span>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>This Year</option>
            <option>This Month</option>
            <option>This Week</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bookings this year by sale agents
          </h3>
          <div className="text-sm text-gray-500 mb-6">2024</div>
          <PieChart data={bookingsData} />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {[
              {
                action: 'New booking created',
                user: 'Ali Rahman',
                time: '2 hours ago',
                type: 'booking',
              },
              {
                action: 'Inquiry submitted',
                user: 'Sarah Ahmed',
                time: '4 hours ago',
                type: 'inquiry',
              },
              {
                action: 'Payment received',
                user: 'Mohammed Khan',
                time: '6 hours ago',
                type: 'payment',
              },
              {
                action: 'Booking confirmed',
                user: 'Fatima Ali',
                time: '1 day ago',
                type: 'booking',
              },
            ].map((activity, index) => (
              <div key={index} className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.type === 'booking' ? 'bg-blue-500' :
                  activity.type === 'inquiry' ? 'bg-green-500' : 'bg-orange-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{activity.action}</p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{activity.user}</p>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;