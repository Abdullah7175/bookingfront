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

  // Find the maximum value for scaling (round up to nearest 5 or 10 for cleaner scale)
  const maxValue = Math.max(...data.map(item => item.value || 0));
  const roundedMax = maxValue <= 5 ? 5 : maxValue <= 10 ? 10 : Math.ceil(maxValue / 5) * 5;

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  // Chart dimensions
  const chartHeight = 300;
  const barWidth = Math.max(40, Math.min(80, 400 / data.length));
  const spacing = 20;
  const chartWidth = data.length * (barWidth + spacing) + spacing;

  return (
    <div className="w-full">
      {/* Vertical Bar Chart */}
      <div className="relative mb-8" style={{ height: chartHeight + 60 }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between" style={{ width: '40px' }}>
          {[roundedMax, Math.round(roundedMax * 0.75), Math.round(roundedMax * 0.5), Math.round(roundedMax * 0.25), 0].map((value, idx) => (
            <span key={idx} className="text-xs text-gray-500 text-right pr-2">
              {value}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-12 relative" style={{ height: chartHeight }}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
            <div
              key={idx}
              className="absolute w-full border-t border-gray-200"
              style={{ bottom: `${ratio * 100}%` }}
            />
          ))}

          {/* Bars */}
          <div className="flex items-end justify-start space-x-5 h-full px-2">
            {data.map((item, index) => {
              const barHeight = maxValue > 0 ? (item.value / roundedMax) * chartHeight : 0;
              const itemPercentage = total > 0 ? ((item.value / total) * 100) : 0;

              return (
                <div
                  key={`${item.name}-${index}`}
                  className="flex flex-col items-center relative group"
                  style={{ width: `${barWidth}px` }}
                >
                  {/* Bar */}
                  <div
                    className="w-full rounded-t transition-all duration-500 ease-out relative hover:opacity-90 cursor-pointer"
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: item.color,
                      minHeight: barHeight > 0 ? '4px' : '0px',
                    }}
                    title={`${item.name}: ${item.value} booking${item.value !== 1 ? 's' : ''} (${itemPercentage.toFixed(1)}%)`}
                  >
                    {/* Value on top of bar */}
                    {barHeight > 25 && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <span className="text-xs font-semibold text-gray-700 bg-white px-1 rounded">
                          {item.value}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Agent name label */}
                  <div className="mt-2 w-full text-center">
                    <div
                      className="text-xs font-medium text-gray-700 truncate"
                      title={item.name}
                      style={{
                        transform: item.name.length > 10 ? 'rotate(-45deg)' : 'none',
                        transformOrigin: 'center',
                        height: item.name.length > 10 ? '60px' : 'auto',
                        lineHeight: item.name.length > 10 ? '1.2' : '1.5',
                      }}
                    >
                      {item.name.length > 15 ? `${item.name.substring(0, 12)}...` : item.name}
                    </div>
                    {/* Value below bar if bar is too small */}
                    {barHeight <= 25 && barHeight > 0 && (
                      <div className="text-xs font-semibold text-gray-700 mt-1">
                        {item.value}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis label */}
        <div className="ml-12 mt-2 text-center">
          <span className="text-xs text-gray-500">Agents</span>
        </div>
      </div>

      {/* Legend and Summary */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex flex-wrap gap-4 mb-4">
          {data.map((item, index) => {
            const itemPercentage = total > 0 ? ((item.value / total) * 100) : 0;
            return (
              <div key={`legend-${index}`} className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.name}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {item.value}
                </span>
                <span className="text-xs text-gray-500">
                  ({itemPercentage.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
          <span className="text-gray-600">Total Bookings:</span>
          <span className="font-semibold text-gray-900 text-lg">{total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
};

export default BarChart;

