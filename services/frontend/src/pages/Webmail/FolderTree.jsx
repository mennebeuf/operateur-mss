// services/frontend/src/pages/Webmail/FolderTree.jsx
import React, { useState } from 'react';

// Icônes par type de dossier
const FOLDER_ICONS = {
  INBOX: '📥',
  Sent: '📤',
  Drafts: '📝',
  Trash: '🗑️',
  Spam: '⚠️',
  Archive: '📦',
  default: '📁'
};

// Noms français des dossiers standards
const FOLDER_LABELS = {
  INBOX: 'Boîte de réception',
  Sent: 'Envoyés',
  Drafts: 'Brouillons',
  Trash: 'Corbeille',
  Spam: 'Indésirables',
  Archive: 'Archives'
};

const FolderItem = ({ folder, selectedFolder, onSelectFolder, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolder === folder.path;
  
  // Déterminer l'icône
  const getIcon = () => {
    if (folder.specialUse) {
      const specialType = folder.specialUse.replace('\\', '');
      return FOLDER_ICONS[specialType] || FOLDER_ICONS.default;
    }
    return FOLDER_ICONS[folder.name] || FOLDER_ICONS.default;
  };
  
  // Déterminer le label
  const getLabel = () => {
    return FOLDER_LABELS[folder.name] || folder.name;
  };
  
  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition rounded-md mx-2 ${
          isSelected 
            ? 'bg-blue-100 text-blue-700 font-medium' 
            : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onSelectFolder(folder.path)}
      >
        {/* Chevron pour les dossiers avec enfants */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4"></span>
        )}
        
        {/* Icône */}
        <span>{getIcon()}</span>
        
        {/* Nom */}
        <span className="flex-1 truncate">{getLabel()}</span>
        
        {/* Badge pour les non-lus */}
        {folder.unread > 0 && (
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
            {folder.unread > 99 ? '99+' : folder.unread}
          </span>
        )}
      </div>
      
      {/* Sous-dossiers */}
      {hasChildren && expanded && (
        <div>
          {folder.children.map((child, index) => (
            <FolderItem
              key={child.path || index}
              folder={child}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({ folders, selectedFolder, onSelectFolder }) => {
  // Trier les dossiers : dossiers standards en premier
  const sortedFolders = [...folders].sort((a, b) => {
    const order = ['INBOX', 'Drafts', 'Sent', 'Archive', 'Spam', 'Trash'];
    const aIndex = order.indexOf(a.name);
    const bIndex = order.indexOf(b.name);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  
  return (
    <div className="py-4">
      {/* Titre */}
      <div className="px-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Dossiers
        </h2>
      </div>
      
      {/* Liste des dossiers */}
      <div className="space-y-1">
        {sortedFolders.map((folder, index) => (
          <FolderItem
            key={folder.path || index}
            folder={folder}
            selectedFolder={selectedFolder}
            onSelectFolder={onSelectFolder}
          />
        ))}
      </div>
      
      {/* Actions */}
      <div className="mt-6 px-4 border-t pt-4">
        <button
          className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-2"
          onClick={() => {
            const name = prompt('Nom du nouveau dossier:');
            if (name) {
              // TODO: Implémenter la création de dossier
              console.log('Créer dossier:', name);
            }
          }}
        >
          <span>➕</span>
          <span>Nouveau dossier</span>
        </button>
      </div>
      
      {/* Espace disque (optionnel) */}
      <div className="mt-6 px-4 pt-4 border-t">
        <div className="text-xs text-gray-500 mb-2">Espace utilisé</div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: '35%' }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1">350 Mo / 1 Go</div>
      </div>
    </div>
  );
};

export default FolderTree;