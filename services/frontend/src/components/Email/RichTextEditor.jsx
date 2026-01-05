// services/frontend/src/components/Email/RichTextEditor.jsx
import React, { useRef, useCallback, useEffect } from 'react';

const RichTextEditor = ({ value = '', onChange, placeholder = 'Rédigez votre message...', disabled = false }) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  // Synchroniser le contenu externe avec l'éditeur
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Gérer les changements de contenu
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange?.(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Exécuter une commande de formatage
  const execCommand = useCallback((command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  // Vérifier si une commande est active
  const isCommandActive = (command) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };

  // Insérer un lien
  const insertLink = () => {
    const url = prompt('URL du lien:', 'https://');
    if (url) {
      execCommand('createLink', url);
    }
  };

  // Insérer une image
  const insertImage = () => {
    const url = prompt('URL de l\'image:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  // Gérer le collage (nettoyer le HTML)
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // Bouton de la barre d'outils
  const ToolButton = ({ command, icon, title, onClick, isActive }) => (
    <button
      type="button"
      onClick={onClick || (() => execCommand(command))}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded hover:bg-gray-200 transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isActive ? 'bg-gray-200 text-blue-600' : 'text-gray-700'}
      `}
    >
      {icon}
    </button>
  );

  // Séparateur
  const Separator = () => <div className="w-px h-6 bg-gray-300 mx-1" />;

  return (
    <div className={`border rounded-lg overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 border-b">
        {/* Formatage de texte */}
        <ToolButton command="bold" icon="𝐁" title="Gras (Ctrl+B)" isActive={isCommandActive('bold')} />
        <ToolButton command="italic" icon="𝐼" title="Italique (Ctrl+I)" isActive={isCommandActive('italic')} />
        <ToolButton command="underline" icon="U̲" title="Souligné (Ctrl+U)" isActive={isCommandActive('underline')} />
        <ToolButton command="strikeThrough" icon="S̶" title="Barré" isActive={isCommandActive('strikeThrough')} />
        
        <Separator />
        
        {/* Titres */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              execCommand('formatBlock', e.target.value);
            }
          }}
          disabled={disabled}
          className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-50"
          defaultValue=""
        >
          <option value="">Style</option>
          <option value="p">Normal</option>
          <option value="h1">Titre 1</option>
          <option value="h2">Titre 2</option>
          <option value="h3">Titre 3</option>
        </select>
        
        <Separator />
        
        {/* Listes */}
        <ToolButton command="insertUnorderedList" icon="•" title="Liste à puces" isActive={isCommandActive('insertUnorderedList')} />
        <ToolButton command="insertOrderedList" icon="1." title="Liste numérotée" isActive={isCommandActive('insertOrderedList')} />
        
        <Separator />
        
        {/* Alignement */}
        <ToolButton command="justifyLeft" icon="⬅" title="Aligner à gauche" isActive={isCommandActive('justifyLeft')} />
        <ToolButton command="justifyCenter" icon="↔" title="Centrer" isActive={isCommandActive('justifyCenter')} />
        <ToolButton command="justifyRight" icon="➡" title="Aligner à droite" isActive={isCommandActive('justifyRight')} />
        
        <Separator />
        
        {/* Indentation */}
        <ToolButton command="indent" icon="→|" title="Augmenter le retrait" />
        <ToolButton command="outdent" icon="|←" title="Réduire le retrait" />
        
        <Separator />
        
        {/* Liens et images */}
        <ToolButton icon="🔗" title="Insérer un lien" onClick={insertLink} />
        <ToolButton icon="🖼" title="Insérer une image" onClick={insertImage} />
        
        <Separator />
        
        {/* Couleurs */}
        <div className="relative">
          <input
            type="color"
            onChange={(e) => execCommand('foreColor', e.target.value)}
            disabled={disabled}
            className="w-8 h-8 cursor-pointer disabled:opacity-50"
            title="Couleur du texte"
          />
        </div>
        <div className="relative">
          <input
            type="color"
            onChange={(e) => execCommand('hiliteColor', e.target.value)}
            disabled={disabled}
            className="w-8 h-8 cursor-pointer disabled:opacity-50"
            title="Couleur de surbrillance"
            defaultValue="#ffff00"
          />
        </div>
        
        <Separator />
        
        {/* Annuler/Refaire */}
        <ToolButton command="undo" icon="↩" title="Annuler (Ctrl+Z)" />
        <ToolButton command="redo" icon="↪" title="Refaire (Ctrl+Y)" />
        
        {/* Supprimer le formatage */}
        <ToolButton command="removeFormat" icon="🚫" title="Supprimer le formatage" />
      </div>

      {/* Zone d'édition */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`
          min-h-[300px] p-4 outline-none
          prose prose-sm max-w-none
          focus:bg-white
          empty:before:content-[attr(data-placeholder)] 
          empty:before:text-gray-400
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};

export default RichTextEditor;