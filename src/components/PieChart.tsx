import React from 'react';

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
}

const PieChart: React.FC<PieChartProps> = ({ data }) => {
  // Safety check for empty or invalid data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  let cumulativePercent = 0;

  const createArcPath = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", centerX, centerY,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-6 lg:space-x-8">
      {/* SVG Pie Chart */}
      <div className="relative">
        <svg 
          width="160" 
          height="160" 
          viewBox="0 0 200 200" 
          className="transform -rotate-90 sm:w-48 sm:h-48 md:w-52 md:h-52 lg:w-56 lg:h-56"
        >
          {data.map((item, index) => {
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            const startAngle = (cumulativePercent / 100) * 360;
            const endAngle = ((cumulativePercent + percent) / 100) * 360;
            
            // Ensure we have valid numbers for the path
            const validStartAngle = isNaN(startAngle) ? 0 : startAngle;
            const validEndAngle = isNaN(endAngle) ? 0 : endAngle;
            
            const pathData = createArcPath(100, 100, 80, validStartAngle, validEndAngle);
            cumulativePercent += percent;
            
            return (
              <path
                key={`${item.name}-${index}`}
                d={pathData}
                fill={item.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                strokeWidth="2"
                stroke="white"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-2 sm:space-y-3 w-full md:w-auto">
        {data.map((item, index) => (
          <div key={`legend-${item.name}-${index}`} className="flex items-center space-x-2 sm:space-x-3">
            <div 
              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between space-x-2 sm:space-x-4">
                <span className="text-xs sm:text-sm font-medium text-gray-900">{item.name}</span>
                <span className="text-xs sm:text-sm text-gray-500">({(item.value || 0).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieChart;