import { useState, useEffect } from 'react';
import { getAllUsers } from '../../services/firebase';
import type { User } from '../../types';

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      setLoading(false);
    }
    loadUsers();
  }, []);

  const emails = users
    .map(u => u.email)
    .filter((email): email is string => !!email);

  const handleCopyEmails = async () => {
    const emailList = emails.join(', ');
    await navigator.clipboard.writeText(emailList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Registered Users</h2>
        <span className="text-sm text-gray-500">{users.length} users</span>
      </div>

      <div className="space-y-4">
        {/* Email list for copying */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">All Emails ({emails.length})</span>
            <button
              onClick={handleCopyEmails}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {copied ? 'Copied!' : 'Copy All'}
            </button>
          </div>
          <p className="text-sm text-gray-600 break-all">
            {emails.join(', ') || 'No emails found'}
          </p>
        </div>

        {/* User list */}
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          {users.map(user => (
            <div key={user.uid} className="p-3 flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                  {user.displayName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.displayName || 'Anonymous'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email || 'No email'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
