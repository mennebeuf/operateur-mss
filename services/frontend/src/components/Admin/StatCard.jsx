/**
 * MSSanté - Composant StatCard
 * Carte de statistique réutilisable pour les dashboards
 */

import React from 'react';
import { Link } from 'react-router-dom';

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'bg-blue-100'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'bg-green-100'
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'bg-purple-100'
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    icon: 'bg-orange-100'
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'bg-red-100'
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: 'bg-gray-100'
  }
};

const StatCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  color = 'blue', 
  link, 
  subtitle,
  max,
  loading = false
}) => {
  const colors = colorClasses[color] || colorClasses.blue;

  const formatValue = (val) => {
    if (typeof val === 'number') {
      return val.toLocaleString('fr-FR');
    }
    return val;
  };

  const renderTrend = () => {
    if (trend === undefined || trend === null) return null;
    
    const isPositive = trend >= 0;
    const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
    const arrow = isPositive ? '↗' : '↘';
    
    return (
      <p className={`text-sm mt-2 ${trendColor} flex items-center gap-1`}>
        <span>{arrow}</span>
        <span>{Math.abs(trend)}% ce mois</span>
      </p>
    );
  };

  const renderProgress = () => {
    if (max === undefined) return null;
    
    const percentage = Math.min((parseFloat(value) / max) * 100, 100);
    
    return (
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          sur {formatValue(max)}
        </p>
      </div>
    );
  };

  const cardContent = (
    <div className={`bg-white rounded-lg shadow p-6 transition ${link ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          {loading ? (
            <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              {formatValue(value)}
            </p>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {renderTrend()}
          {renderProgress()}
        </div>
        <div className={`${colors.icon} ${colors.text} p-4 rounded-lg text-3xl flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link}>{cardContent}</Link>;
  }

  return cardContent;
};

export default StatCard;