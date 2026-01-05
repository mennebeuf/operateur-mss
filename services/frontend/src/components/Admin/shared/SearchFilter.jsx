// services/frontend/src/components/Admin/shared/SearchFilter.jsx
import React from 'react';

/**
 * Barre de recherche et filtres réutilisable
 */
export const SearchFilter = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  filters = [],
  children
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex flex-wrap gap-4">
        {/* Champ de recherche */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              🔍
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filtres */}
        {filters.map((filter, index) => (
          <select
            key={index}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        {/* Contenu additionnel */}
        {children}
      </div>
    </div>
  );
};

export default SearchFilter;