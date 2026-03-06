import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { BudgetItem, BudgetCategory } from '../types';

interface BudgetChartsProps {
  budgets: BudgetItem[];
}

// Consistent Color Map matching Tailwind classes used in Dashboard
const CATEGORY_COLORS: Record<string, string> = {
  [BudgetCategory.CORE]: '#3B82F6',      // Blue-500
  [BudgetCategory.CAPACITY]: '#A855F7',  // Purple-500
  [BudgetCategory.CAPITAL]: '#F97316',   // Orange-500
};
const DEFAULT_COLOR = '#94A3B8'; // Slate-400

// Custom Tick for Bar Chart to show Category Color Dot
const CustomYAxisTick = (props: any) => {
  const { x, y, payload, budgets } = props;
  // Access the budget item by index since data matches budgets array order
  const item = budgets[payload.index]; 
  const color = item ? CATEGORY_COLORS[item.category] || DEFAULT_COLOR : DEFAULT_COLOR;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Colored indicator dot */}
      <circle cx="-10" cy="-4" r="4" fill={color} />
      {/* Label text */}
      <text x="0" y="0" dy="0" textAnchor="end" fill="#475569" fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

export const BudgetOverviewChart: React.FC<BudgetChartsProps> = ({ budgets }) => {
  const data = budgets.map(b => ({
    name: b.name.length > 15 ? b.name.substring(0, 15) + '...' : b.name,
    Spent: b.spent,
    Remaining: b.remaining,
    full: b
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={120} 
            tick={<CustomYAxisTick budgets={budgets} />} 
          />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="Spent" stackId="a" fill="#F43F5E" radius={[0, 0, 0, 0]} barSize={20} />
          <Bar dataKey="Remaining" stackId="a" fill="#14B8A6" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CategoryPieChart: React.FC<BudgetChartsProps> = ({ budgets }) => {
  // Aggregate by category
  const categoryData = budgets.reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.category);
    if (existing) {
      existing.value += curr.allocated;
    } else {
      acc.push({ name: curr.category, value: curr.allocated });
    }
    return acc;
  }, [] as { name: string, value: number }[]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categoryData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {categoryData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CATEGORY_COLORS[entry.name] || DEFAULT_COLOR} 
              />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};