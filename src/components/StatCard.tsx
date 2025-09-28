import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
  trend: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend }) => {
  const isPositiveTrend = trend.startsWith('+');
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between space-x-3">
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">{title}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{value}</p>
          <div className="flex items-center space-x-1">
            <span className={`text-xs sm:text-sm font-medium ${
              isPositiveTrend ? 'text-green-600' : trend === 'No change' ? 'text-gray-500' : 'text-red-600'
            }`}>
              {trend}
            </span>
            <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">vs last period</span>
          </div>
        </div>
        <div className={`p-2 sm:p-3 rounded-xl ${color} flex-shrink-0`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;