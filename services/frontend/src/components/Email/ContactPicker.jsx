// services/frontend/src/components/Email/ContactPicker.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { emailApi } from '../../services/emailApi';

const ContactPicker = ({ isOpen, onClose, onSelect, selectedEmails = [] }) => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('contacts'); // contacts | recent | annuaire

  // Charger les contacts au montage
  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setSelectedContacts(selectedEmails.map(email => ({ email })));
    }
  }, [isOpen, selectedEmails]);

  // Filtrer les contacts selon la recherche
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact => 
      contact.name?.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.organization?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  // Charger les contacts depuis l'API
  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await emailApi.getContacts?.() || [];
      setContacts(data);
      setFilteredContacts(data);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
      // Contacts de démonstration
      const demoContacts = [
        { id: 1, name: 'Dr. Martin Dupont', email: 'martin.dupont@mssante.fr', organization: 'CHU Paris' },
        { id: 2, name: 'Dr. Sophie Bernard', email: 'sophie.bernard@mssante.fr', organization: 'Clinique St-Joseph' },
        { id: 3, name: 'Pr. Jean Moreau', email: 'jean.moreau@mssante.fr', organization: 'Hôpital Necker' },
      ];
      setContacts(demoContacts);
      setFilteredContacts(demoContacts);
    } finally {
      setLoading(false);
    }
  };

  // Rechercher dans l'annuaire MSSanté
  const searchAnnuaire = useCallback(async (query) => {
    if (query.length < 3) return;
    
    setLoading(true);
    try {
      const results = await emailApi.searchAnnuaire?.(query) || [];
      setFilteredContacts(results);
    } catch (error) {
      console.error('Erreur recherche annuaire:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle sélection d'un contact
  const toggleContact = (contact) => {
    setSelectedContacts(prev => {
      const exists = prev.find(c => c.email === contact.email);
      if (exists) {
        return prev.filter(c => c.email !== contact.email);
      }
      return [...prev, contact];
    });
  };

  // Vérifier si un contact est sélectionné
  const isSelected = (contact) => {
    return selectedContacts.some(c => c.email === contact.email);
  };

  // Valider la sélection
  const handleConfirm = () => {
    onSelect(selectedContacts.map(c => c.email));
    onClose();
  };

  // Gérer le changement d'onglet
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    
    if (tab === 'annuaire') {
      setFilteredContacts([]);
    } else {
      loadContacts();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Sélectionner des contacts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b">
          <button
            onClick={() => handleTabChange('contacts')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'contacts' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📇 Mes contacts
          </button>
          <button
            onClick={() => handleTabChange('recent')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'recent' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🕐 Récents
          </button>
          <button
            onClick={() => handleTabChange('annuaire')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'annuaire' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔍 Annuaire MSSanté
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeTab === 'annuaire' && e.target.value.length >= 3) {
                searchAnnuaire(e.target.value);
              }
            }}
            placeholder={
              activeTab === 'annuaire' 
                ? 'Rechercher dans l\'annuaire (min. 3 caractères)...'
                : 'Filtrer les contacts...'
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Liste des contacts */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <span className="text-4xl mb-2">📭</span>
              <span>
                {activeTab === 'annuaire' && searchQuery.length < 3
                  ? 'Entrez au moins 3 caractères pour rechercher'
                  : 'Aucun contact trouvé'}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id || contact.email}
                  onClick={() => toggleContact(contact)}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${isSelected(contact) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Checkbox */}
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected(contact) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}
                  `}>
                    {isSelected(contact) && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-600 font-medium">
                      {(contact.name || contact.email).charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {contact.name || contact.email}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {contact.email}
                    </div>
                    {contact.organization && (
                      <div className="text-xs text-gray-400 truncate">
                        {contact.organization}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sélection actuelle */}
        {selectedContacts.length > 0 && (
          <div className="p-3 border-t bg-gray-50">
            <div className="text-sm text-gray-600 mb-2">
              {selectedContacts.length} contact(s) sélectionné(s)
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedContacts.map(contact => (
                <span
                  key={contact.email}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {contact.name || contact.email}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleContact(contact);
                    }}
                    className="hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedContacts.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ajouter ({selectedContacts.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactPicker;