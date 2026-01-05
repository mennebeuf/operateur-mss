// services/frontend/src/components/Admin/shared/DataTable.jsx
import React from 'react';

/**
 * Tableau de données réutilisable
 */
export const DataTable = ({ 
  columns, 
  data, 
  loading, 
  emptyIcon = '📋',
  emptyMessage = 'Aucune donnée',
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectChange
}) => {
  const handleSelectAll = () => {
    if (selectedIds.length === data.length) {
      onSelectChange?.([]);
    } else {
      onSelectChange?.(data.map(row => row.id));
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      onSelectChange?.(selectedIds.filter(i => i !== id));
    } else {
      onSelectChange?.([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {selectable && (
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === data.length && data.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
            )}
            {columns.map((col, index) => (
              <th
                key={index}
                className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {selectable && (
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => handleSelectRow(row.id)}
                    className="rounded border-gray-300"
                  />
                </td>
              )}
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className={`px-6 py-4 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <span className="text-4xl">{emptyIcon}</span>
          <p className="mt-2">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};

export default DataTable;