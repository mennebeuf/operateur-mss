// services/frontend/src/components/Common/Loader.jsx
import React from 'react';

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

const colors = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  success: 'text-green-600',
  danger: 'text-red-600'
};

// Spinner classique
const Spinner = ({ size = 'md', color = 'primary', className = '' }) => {
  const sizeClasses = sizes[size] || sizes.md;
  const colorClasses = colors[color] || colors.primary;

  return (
    <svg
      className={`animate-spin ${sizeClasses} ${colorClasses} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Loader avec texte
const Loader = ({
  size = 'md',
  color = 'primary',
  text,
  fullScreen = false,
  overlay = false,
  className = ''
}) => {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={size} color={color} />
      {text && <p className={`text-sm font-medium ${colors[color] || colors.primary}`}>{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">{content}</div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

// Loader en ligne (pour boutons, etc.)
export const InlineLoader = ({ size = 'sm', color = 'white', className = '' }) => (
  <Spinner size={size} color={color} className={className} />
);

// Skeleton loader pour le contenu
export const Skeleton = ({ width = 'full', height = '4', rounded = 'md', className = '' }) => {
  const widthClasses = width === 'full' ? 'w-full' : `w-${width}`;
  const heightClasses = `h-${height}`;
  const roundedClasses = `rounded-${rounded}`;

  return (
    <div
      className={`animate-pulse bg-gray-200 ${widthClasses} ${heightClasses} ${roundedClasses} ${className}`}
    />
  );
};

// Skeleton pour une carte
export const CardSkeleton = ({ className = '' }) => (
  <div className={`p-4 border border-gray-200 rounded-lg ${className}`}>
    <Skeleton height="6" width="3/4" className="mb-4" />
    <Skeleton height="4" className="mb-2" />
    <Skeleton height="4" className="mb-2" />
    <Skeleton height="4" width="1/2" />
  </div>
);

// Skeleton pour une ligne de tableau
export const TableRowSkeleton = ({ columns = 4, className = '' }) => (
  <tr className={className}>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton height="4" />
      </td>
    ))}
  </tr>
);

// Loader de page avec logo
export const PageLoader = ({ text = 'Chargement...', showLogo = true }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
    {showLogo && (
      <div className="mb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
          <span className="text-2xl font-bold text-white">MS</span>
        </div>
      </div>
    )}
    <Spinner size="lg" color="primary" />
    <p className="mt-4 text-gray-600 font-medium">{text}</p>
  </div>
);

// Dots loader (alternative)
export const DotsLoader = ({ color = 'primary', className = '' }) => {
  const colorClasses = colors[color] || colors.primary;

  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${colorClasses} animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
};

export { Spinner };
export default Loader;
