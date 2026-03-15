'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { DeptAllocation } from '@/lib/queries/employee-stats'

type Props = {
  allocations: DeptAllocation[]
  size?: number
}

export function EmployeeDeptPie({ allocations, size = 100 }: Props) {
  if (allocations.length === 0) return null

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={allocations}
            dataKey="days"
            nameKey="deptName"
            cx="50%"
            cy="50%"
            outerRadius={size / 2 - 4}
            innerRadius={size / 4}
            strokeWidth={1}
            stroke="#fff"
          >
            {allocations.map((entry) => (
              <Cell key={entry.deptId} fill={entry.colorHex} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const a = allocations.find((x) => x.deptName === name)
              return [`${value} ימים (${a?.percentage ?? 0}%)`, name]
            }}
            contentStyle={{ direction: 'rtl', fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
