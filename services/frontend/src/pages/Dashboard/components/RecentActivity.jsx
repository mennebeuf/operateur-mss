// services/frontend/src/pages/Dashboard/components/RecentActivity.jsx

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import React from 'react';
import { Link } from 'react-router-dom';

const activityIcons = {
  mailbox_created: '📬',
  mailbox_deleted: '🗑️',
  user_created: '👤',
  user_updated: '✏️',
  user_deleted: '🚫',
  certificate_renewed: '🔐',
  certificate_expiring: '⚠️',
  login: '🔑',
  settings_changed: '⚙️',
  quota_warning: '📊',
  default: '📌'
};

const activityColors = {
  mailbox_created: 'bg-blue-100 text-blue-800',
  mailbox_deleted: 'bg-red-100 text-red-800',
  user_created: 'bg-green-100 text-green-800',
  user_updated: 'bg-yellow-100 text-yellow-800',
  user_deleted: 'bg-red-100 text-red-800',
  certificate_renewed: 'bg-purple-100 text-purple-800',
  certificate_expiring: 'bg-orange-100 text-orange-800',
  login: 'bg-gray-100 text-gray-800',
  settings_changed: 'bg-indigo-100 text-indigo-800',
  quota_warning: 'bg-yellow-100 text-yellow-800',
  default: 'bg-gray-100 text-gray-800'
};

const RecentActivity = ({ activities, domainId }) => {
  const formatTime = dateStr => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: fr
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Activité récente</h3>
        <Link
          to={`/audit?domain=${domainId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Voir tout →
        </Link>
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {activities.map((activity, index) => (
            <div
              key={activity.id || index}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="text-xl">
                {activityIcons[activity.type] || activityIcons.default}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  {activity.description || activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      activityColors[activity.type] || activityColors.default
                    }`}
                  >
                    {activity.type_label || activity.type}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(activity.created_at)}</span>
                </div>
                {activity.user_name && (
                  <p className="text-xs text-gray-500 mt-1">par {activity.user_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <p>Aucune activité récente</p>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
