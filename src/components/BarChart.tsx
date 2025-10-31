import React from 'react';

interface BarChartData {
  name: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
  // Safety check for empty or invalid data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  // Find the maximum value for scaling
  const maxValue = Math.max(...data.map(item => item.value || 0));

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="w-full">
      <div className="space-y-4">
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const itemPercentage = total > 0 ? ((item.value / total) * 100) : 0;

          return (
            <div key={`${item.name}-${index}`} className="w-full">
              {/* Agent name and value */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {item.value.toFixed(0)} booking{item.value !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-500 min-w-[50px] text-right">
                    ({itemPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              
              {/* Bar */}
              <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-3"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                    minWidth: percentage > 0 ? '2%' : '0%',
                  }}
                >
                  {percentage > 15 && (
                    <span className="text-xs font-semibold text-white">
                      {item.value.toFixed(0)}
                    </span>
                  )}
                </div>
                {percentage <= 15 && percentage > 0 && (
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-semibold text-gray-700">
                    {item.value.toFixed(0)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Bookings:</span>
          <span className="font-semibold text-gray-900">{total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};

export default BarChart;

