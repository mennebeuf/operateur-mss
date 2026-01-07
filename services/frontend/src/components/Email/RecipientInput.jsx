// services/frontend/src/components/Email/RecipientInput.jsx
import React, { useState, useRef, useEffect } from 'react';

const RecipientInput = ({
  recipients = [],
  onChange,
  placeholder = 'Ajouter un destinataire...',
  onSearch,
  suggestions = [],
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Fermer les suggestions si clic extérieur
  useEffect(() => {
    const handleClickOutside = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Valider une adresse email
  const isValidEmail = email => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  };

  // Ajouter un destinataire
  const addRecipient = value => {
    const email = value.trim().toLowerCase();

    if (!email) {
      return;
    }
    if (!isValidEmail(email)) {
      alert('Adresse email invalide');
      return;
    }
    if (recipients.includes(email)) {
      alert('Ce destinataire est déjà ajouté');
      return;
    }

    onChange([...recipients, email]);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Supprimer un destinataire
  const removeRecipient = emailToRemove => {
    onChange(recipients.filter(email => email !== emailToRemove));
  };

  // Gérer la saisie
  const handleInputChange = e => {
    const value = e.target.value;
    setInputValue(value);

    // Rechercher des suggestions
    if (value.length >= 2 && onSearch) {
      onSearch(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }

    setSelectedSuggestionIndex(-1);
  };

  // Gérer les touches clavier
  const handleKeyDown = e => {
    // Entrée ou virgule = ajouter
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();

      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        addRecipient(suggestions[selectedSuggestionIndex].email);
      } else if (inputValue) {
        addRecipient(inputValue);
      }
      return;
    }

    // Tab = ajouter si valeur présente
    if (e.key === 'Tab' && inputValue) {
      e.preventDefault();
      addRecipient(inputValue);
      return;
    }

    // Backspace = supprimer le dernier si input vide
    if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1]);
      return;
    }

    // Navigation dans les suggestions
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  // Sélectionner une suggestion
  const selectSuggestion = suggestion => {
    addRecipient(suggestion.email);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Container principal */}
      <div
        className={`
          flex flex-wrap items-center gap-1 
          border rounded-lg px-2 py-1.5
          bg-white
          focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tags des destinataires */}
        {recipients.map(email => (
          <span
            key={email}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-sm"
          >
            <span className="max-w-[200px] truncate">{email}</span>
            {!disabled && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeRecipient(email);
                }}
                className="text-blue-600 hover:text-blue-800 font-bold"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
          placeholder={recipients.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[150px] outline-none bg-transparent py-1 text-sm disabled:cursor-not-allowed"
        />
      </div>

      {/* Liste des suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.email}
              onClick={() => selectSuggestion(suggestion)}
              className={`
                px-3 py-2 cursor-pointer
                ${index === selectedSuggestionIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
              `}
            >
              <div className="font-medium text-sm">{suggestion.name || suggestion.email}</div>
              {suggestion.name && <div className="text-xs text-gray-500">{suggestion.email}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipientInput;
