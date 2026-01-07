// services/frontend/src/pages/Webmail/SearchBar.jsx
import React, { useState, useEffect, useRef } from 'react';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    from: '',
    to: '',
    subject: '',
    hasAttachment: false,
    dateFrom: '',
    dateTo: ''
  });

  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus sur l'input quand expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Debounce de la recherche
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (query.length >= 2 || query.length === 0) {
        onSearch(query);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch]);

  const handleSubmit = e => {
    e.preventDefault();

    if (showAdvanced) {
      // Construire la requête avancée
      let advancedQuery = query;
      if (advancedFilters.from) {
        advancedQuery += ` from:${advancedFilters.from}`;
      }
      if (advancedFilters.to) {
        advancedQuery += ` to:${advancedFilters.to}`;
      }
      if (advancedFilters.subject) {
        advancedQuery += ` subject:${advancedFilters.subject}`;
      }
      if (advancedFilters.hasAttachment) {
        advancedQuery += ' has:attachment';
      }

      onSearch(advancedQuery.trim());
    } else {
      onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    setAdvancedFilters({
      from: '',
      to: '',
      subject: '',
      hasAttachment: false,
      dateFrom: '',
      dateTo: ''
    });
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = e => {
    if (e.key === 'Escape') {
      handleClear();
      setIsExpanded(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex items-center border rounded-lg transition-all ${
            isExpanded ? 'w-80 bg-white shadow-sm' : 'w-64'
          }`}
        >
          {/* Icône de recherche */}
          <button type="submit" className="px-3 py-2 text-gray-400 hover:text-gray-600">
            🔍
          </button>

          {/* Label accessible mais caché visuellement */}
          <label htmlFor="search-messages" className="sr-only">
            Rechercher dans les messages
          </label>

          {/* Input */}
          <input
            ref={inputRef}
            id="search-messages"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => {
              if (!query && !showAdvanced) {
                setIsExpanded(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher dans les messages..."
            className="flex-1 py-2 pr-2 outline-none bg-transparent text-sm"
          />

          {/* Bouton effacer */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 text-gray-400 hover:text-gray-600"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          )}

          {/* Bouton filtres avancés */}
          {isExpanded && (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-2 py-1 mr-2 text-xs rounded transition ${
                showAdvanced ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="Filtres avancés"
              aria-expanded={showAdvanced}
            >
              ⚙️
            </button>
          )}
        </div>

        {/* Filtres avancés */}
        {showAdvanced && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg p-4 z-50">
            <div className="grid grid-cols-2 gap-4">
              {/* De */}
              <div>
                <label htmlFor="filter-from" className="block text-xs font-medium text-gray-700 mb-1">
                  De
                </label>
                <input
                  id="filter-from"
                  type="text"
                  value={advancedFilters.from}
                  onChange={e =>
                    setAdvancedFilters(prev => ({
                      ...prev,
                      from: e.target.value
                    }))
                  }
                  placeholder="expediteur@email.com"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* À */}
              <div>
                <label htmlFor="filter-to" className="block text-xs font-medium text-gray-700 mb-1">
                  À
                </label>
                <input
                  id="filter-to"
                  type="text"
                  value={advancedFilters.to}
                  onChange={e =>
                    setAdvancedFilters(prev => ({
                      ...prev,
                      to: e.target.value
                    }))
                  }
                  placeholder="destinataire@email.com"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Objet */}
              <div className="col-span-2">
                <label htmlFor="filter-subject" className="block text-xs font-medium text-gray-700 mb-1">
                  Objet
                </label>
                <input
                  id="filter-subject"
                  type="text"
                  value={advancedFilters.subject}
                  onChange={e =>
                    setAdvancedFilters(prev => ({
                      ...prev,
                      subject: e.target.value
                    }))
                  }
                  placeholder="Texte dans l'objet..."
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Date de début */}
              <div>
                <label htmlFor="filter-date-from" className="block text-xs font-medium text-gray-700 mb-1">
                  Depuis le
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={advancedFilters.dateFrom}
                  onChange={e =>
                    setAdvancedFilters(prev => ({
                      ...prev,
                      dateFrom: e.target.value
                    }))
                  }
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Date de fin */}
              <div>
                <label htmlFor="filter-date-to" className="block text-xs font-medium text-gray-700 mb-1">
                  Jusqu'au
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={advancedFilters.dateTo}
                  onChange={e =>
                    setAdvancedFilters(prev => ({
                      ...prev,
                      dateTo: e.target.value
                    }))
                  }
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Pièces jointes */}
              <div className="col-span-2">
                <label htmlFor="filter-attachment" className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    id="filter-attachment"
                    type="checkbox"
                    checked={advancedFilters.hasAttachment}
                    onChange={e =>
                      setAdvancedFilters(prev => ({
                        ...prev,
                        hasAttachment: e.target.checked
                      }))
                    }
                    className="rounded"
                  />
                  <span>Avec pièces jointes uniquement</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setAdvancedFilters({
                    from: '',
                    to: '',
                    subject: '',
                    hasAttachment: false,
                    dateFrom: '',
                    dateTo: ''
                  });
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Rechercher
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Overlay pour fermer les filtres avancés */}
      {showAdvanced && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAdvanced(false)} />
      )}
    </div>
  );
};

export default SearchBar;