import React from 'react';

interface BarChartData {
  name: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
  isCurrency?: boolean;
  metricLabel?: string;
}

const BarChart: React.FC<BarChartProps> = ({ data, isCurrency = false, metricLabel = 'Value' }) => {
  // Format value based on type
  const formatValue = (value: number): string => {
    if (isCurrency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString();
  };

  // Format Y-axis labels
  const formatYAxisLabel = (value: number): string => {
    if (isCurrency && value >= 1000) {
      // For large currency values, show in K format (e.g., $5K, $10K)
      return `$${(value / 1000).toFixed(0)}K`;
    }
    if (isCurrency) {
      return `$${value}`;
    }
    return value.toString();
  };
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
  let roundedMax: number;
  if (isCurrency) {
    // For currency, round to nearest 1000 or 5000 for cleaner scale
    if (maxValue < 1000) {
      roundedMax = Math.ceil(maxValue / 100) * 100;
    } else if (maxValue < 10000) {
      roundedMax = Math.ceil(maxValue / 1000) * 1000;
    } else {
      roundedMax = Math.ceil(maxValue / 5000) * 5000;
    }
  } else {
    // For counts, round to nearest 5 or 10
    roundedMax = maxValue <= 5 ? 5 : maxValue <= 10 ? 10 : Math.ceil(maxValue / 5) * 5;
  }

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  // Chart dimensions with proper spacing
  const chartHeight = 280;
  const topPadding = 35; // Space above chart for value labels
  const barWidth = Math.max(50, Math.min(100, Math.floor((600 - (data.length - 1) * 24) / data.length)));
  const bottomPadding = 80; // Extra space for rotated labels

  // Professional color palette
  const professionalColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
  ];

  const yAxisWidth = isCurrency ? 65 : 50;
  const chartLeftMargin = isCurrency ? 16 : 14;

  return (
    <div className="w-full overflow-x-auto">
      {/* Vertical Bar Chart */}
      <div className="relative" style={{ minHeight: chartHeight + bottomPadding + topPadding, paddingLeft: `${yAxisWidth}px`, paddingRight: '20px', paddingTop: `${topPadding}px` }}>
        {/* Y-axis labels with proper spacing */}
        <div className="absolute left-0 flex flex-col justify-between" style={{ width: `${yAxisWidth}px`, height: chartHeight, top: `${topPadding}px` }}>
          {[roundedMax, Math.round(roundedMax * 0.75), Math.round(roundedMax * 0.5), Math.round(roundedMax * 0.25), 0].map((value, idx) => (
            <span key={idx} className="text-xs text-gray-600 font-medium text-right pr-3">
              {formatYAxisLabel(value)}
            </span>
          ))}
        </div>

        {/* Y-axis line */}
        <div className="absolute border-l-2 border-gray-300" style={{ height: chartHeight, left: `${yAxisWidth - 2}px`, top: `${topPadding}px` }} />

        {/* Chart area */}
        <div className="relative" style={{ height: chartHeight, minWidth: data.length * (barWidth + 24), marginLeft: `${chartLeftMargin}px`, marginTop: `${topPadding}px` }}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
            <div
              key={idx}
              className="absolute w-full border-t border-gray-200"
              style={{ bottom: `${ratio * 100}%`, left: 0, right: 0 }}
            />
          ))}

          {/* Bars container */}
          <div className="flex items-end justify-start h-full" style={{ gap: '24px' }}>
            {data.map((item, index) => {
              const barHeight = maxValue > 0 ? (item.value / roundedMax) * chartHeight : 0;
              const itemPercentage = total > 0 ? ((item.value / total) * 100) : 0;
              const barColor = professionalColors[index % professionalColors.length];

              return (
                <div
                  key={`${item.name}-${index}`}
                  className="flex flex-col items-center relative group"
                  style={{ width: `${barWidth}px`, minWidth: `${barWidth}px` }}
                >
                  {/* Value on top of bar */}
                  {barHeight > 30 && (
                    <div className="absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap z-20" style={{ top: '-28px' }}>
                      <span className="text-xs font-bold text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
                        {formatValue(item.value)}
                      </span>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 ease-out relative hover:opacity-80 cursor-pointer shadow-sm"
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: barColor,
                      minHeight: barHeight > 0 ? '4px' : '0px',
                    }}
                    title={`${item.name}: ${item.value} booking${item.value !== 1 ? 's' : ''} (${itemPercentage.toFixed(1)}%)`}
                  >
                    {/* Gradient overlay for depth */}
                    <div 
                      className="absolute inset-0 rounded-t-lg opacity-20"
                      style={{
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.1) 100%)'
                      }}
                    />
                  </div>

                  {/* Value below bar if bar is too small */}
                  {barHeight <= 30 && barHeight > 0 && (
                    <div className="absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap z-20" style={{ top: '-28px' }}>
                      <span className="text-xs font-bold text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
                        {formatValue(item.value)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels with proper spacing to avoid overlap */}
        <div className="mt-4 flex" style={{ gap: '24px', marginTop: '16px', marginLeft: `${chartLeftMargin}px` }}>
          {data.map((item, index) => (
            <div
              key={`label-${index}`}
              className="flex flex-col items-center"
              style={{ width: `${barWidth}px`, minWidth: `${barWidth}px` }}
            >
              <div
                className="text-xs font-medium text-gray-700 text-center leading-tight"
                style={{
                  transform: 'rotate(-45deg)',
                  transformOrigin: 'center',
                  width: '80px',
                  height: '80px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: '8px',
                }}
                title={item.name}
              >
                <span className="whitespace-nowrap">
                  {item.name.length > 12 ? `${item.name.substring(0, 10)}...` : item.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* X-axis label */}
        <div className="mt-16 text-center" style={{ marginLeft: `${chartLeftMargin}px` }}>
          <span className="text-xs font-medium text-gray-600">Agents</span>
        </div>
      </div>

      {/* Legend and Summary */}
      <div className="border-t border-gray-200 pt-6 mt-8">
        <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
          {data.map((item, index) => {
            const itemPercentage = total > 0 ? ((item.value / total) * 100) : 0;
            const barColor = professionalColors[index % professionalColors.length];
            return (
              <div key={`legend-${index}`} className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-sm shadow-sm"
                  style={{ backgroundColor: barColor }}
                />
                <span className="text-sm font-medium text-gray-700">{item.name}</span>
                <span className="text-sm font-bold text-gray-900">
                  {formatValue(item.value)}
                </span>
                <span className="text-xs text-gray-500">
                  ({itemPercentage.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-100">
          <span className="text-gray-600 font-medium">Total {metricLabel}:</span>
          <span className="font-bold text-gray-900 text-lg">{formatValue(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default BarChart;

