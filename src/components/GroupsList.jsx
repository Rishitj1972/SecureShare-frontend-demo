import React, { useMemo, useState } from 'react';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const uploadsBase = baseURL.replace(/\/api\/?$/, '')

function getPhotoUrl(photo, timestamp) {
  if (!photo) return ''
  if (photo.startsWith('http')) return photo
  const url = `${uploadsBase}${photo}`
  // Add cache buster using timestamp if provided
  if (timestamp) {
    return `${url}?t=${timestamp}`
  }
  return url
}

function getInitials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return (first + second).toUpperCase() || '?'
}

export default function GroupsList({
  groups,
  pendingInvites,
  friends,
  selectedGroupId,
  loading,
  onSelectGroup,
  onCreateGroup,
  onRespondToInvite
}) {
  const [name, setName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const sortedGroups = useMemo(
    () => [...(groups || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [groups]
  );

  const selectedCount = selectedFriendIds.length;
  const canCreate = !!name.trim();

  const toggleFriend = (friendId) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await onCreateGroup?.({
        name: name.trim(),
        memberIds: selectedFriendIds
      });
      setName('');
      setSelectedFriendIds([]);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white min-h-0 border-r">
      <div className="font-semibold px-3 pt-3 pb-2 text-gray-800 border-b text-sm md:text-base">Groups</div>

      <form onSubmit={submitCreate} className="p-3 border-b bg-gradient-to-b from-slate-50 to-white">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">Create New Group</div>
            <div className="text-[11px] text-slate-500">{selectedCount} selected</div>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={80}
          />

          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 max-h-28 overflow-y-auto">
            {(friends || []).length === 0 && <div className="text-xs text-slate-500">No friends to invite yet</div>}
            {(friends || []).map((friend) => (
              <label key={friend._id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFriendIds.includes(friend._id)}
                  onChange={() => toggleFriend(friend._id)}
                />
                <span className="truncate text-slate-700">{friend.username || friend.name}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={isCreating || !canCreate}
            className="w-full px-3 py-2.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 font-medium"
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>

      <div className="px-3 py-2 border-b">
        <div className="text-xs font-semibold text-gray-600 mb-2">Pending Invites</div>
        {(pendingInvites || []).length === 0 && <div className="text-xs text-gray-500">No pending invites</div>}
        {(pendingInvites || []).map((invite) => (
          <div key={invite.groupId} className="bg-gray-50 rounded p-2 mb-2">
            <div className="text-xs font-medium truncate">{invite.groupName}</div>
            <div className="text-[11px] text-gray-500 truncate">Owner: {invite.owner?.username || invite.owner?.email}</div>
            <div className="flex gap-2 mt-2">
              <button
                className="px-2 py-1 text-[11px] bg-green-600 text-white rounded"
                onClick={() => onRespondToInvite?.(invite.groupId, 'accept')}
                type="button"
              >
                Accept
              </button>
              <button
                className="px-2 py-1 text-[11px] bg-red-600 text-white rounded"
                onClick={() => onRespondToInvite?.(invite.groupId, 'reject')}
                type="button"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="text-xs text-gray-500 px-3 py-3">Loading groups...</div>}
      {!loading && (
        <div className="flex-1 min-h-0 px-2 py-2 pr-1 overflow-y-scroll">
          <div className="text-[11px] font-semibold text-slate-500 px-1 pb-2 sticky top-0 bg-white z-10">Your Groups</div>
          <div className="space-y-1">
            {sortedGroups.map((group) => (
              <button
                key={group._id}
                onClick={() => onSelectGroup?.(group)}
                className={`w-full text-left p-2 rounded text-sm border ${
                  selectedGroupId === group._id ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  {group.groupPhoto ? (
                    <img
                      src={getPhotoUrl(group.groupPhoto, group.updatedAt)}
                      alt={group.name}
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-semibold text-indigo-700">
                      {getInitials(group.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{group.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">
                      Admin: {group.owner?.username || group.owner?.email || 'Unknown'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {group.acceptedCount || 0} accepted • {group.pendingCount || 0} pending
                </div>
              </button>
            ))}
            {sortedGroups.length === 0 && <div className="text-xs text-gray-500 px-2">No groups yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}
