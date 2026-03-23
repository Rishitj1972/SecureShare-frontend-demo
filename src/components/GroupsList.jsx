import React, { useEffect, useMemo, useState } from 'react';

export default function GroupsList({
  groups,
  pendingInvites,
  friends,
  selectedGroupId,
  loading,
  onSelectGroup,
  onCreateGroup,
  onRespondToInvite,
  onInviteMembers
}) {
  const [name, setName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInviteFriendIds, setSelectedInviteFriendIds] = useState([]);
  const [isInviting, setIsInviting] = useState(false);

  const sortedGroups = useMemo(
    () => [...(groups || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [groups]
  );

  const toggleFriend = (friendId) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const toggleInviteFriend = (friendId) => {
    setSelectedInviteFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  useEffect(() => {
    setSelectedInviteFriendIds([]);
  }, [selectedGroupId]);

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

  const submitInvite = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || selectedInviteFriendIds.length === 0) return;

    setIsInviting(true);
    try {
      await onInviteMembers?.({
        groupId: selectedGroupId,
        memberIds: selectedInviteFriendIds
      });
      setSelectedInviteFriendIds([]);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white min-h-0 border-r">
      <div className="font-semibold px-3 pt-3 pb-2 text-gray-800 border-b text-sm md:text-base">Groups</div>

      <form onSubmit={submitCreate} className="p-3 border-b space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group name"
          className="w-full px-2 py-2 text-sm border rounded"
          maxLength={80}
        />
        <div className="max-h-24 overflow-auto border rounded p-2">
          {(friends || []).length === 0 && <div className="text-xs text-gray-500">No friends to invite yet</div>}
          {(friends || []).map((friend) => (
            <label key={friend._id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedFriendIds.includes(friend._id)}
                onChange={() => toggleFriend(friend._id)}
              />
              <span className="truncate">{friend.username || friend.name}</span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isCreating || !name.trim()}
          className="w-full px-2 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create Group'}
        </button>
      </form>

      <form onSubmit={submitInvite} className="p-3 border-b space-y-2">
        <div className="text-xs font-semibold text-gray-600">
          {selectedGroupId ? 'Add Members To Selected Group' : 'Select a group to add members'}
        </div>
        <div className="max-h-24 overflow-auto border rounded p-2">
          {(friends || []).length === 0 && <div className="text-xs text-gray-500">No friends available</div>}
          {(friends || []).map((friend) => (
            <label key={friend._id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedInviteFriendIds.includes(friend._id)}
                onChange={() => toggleInviteFriend(friend._id)}
                disabled={!selectedGroupId}
              />
              <span className="truncate">{friend.username || friend.name}</span>
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={isInviting || !selectedGroupId || selectedInviteFriendIds.length === 0}
          className="w-full px-2 py-2 text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
        >
          {isInviting ? 'Adding...' : 'Add Selected To Group'}
        </button>
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
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {sortedGroups.map((group) => (
            <button
              key={group._id}
              onClick={() => onSelectGroup?.(group)}
              className={`w-full text-left p-2 rounded text-sm border ${
                selectedGroupId === group._id ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50 border-transparent'
              }`}
            >
              <div className="font-medium truncate">{group.name}</div>
              <div className="text-[11px] text-gray-500">
                {group.acceptedCount || 0} accepted • {group.pendingCount || 0} pending
              </div>
            </button>
          ))}
          {sortedGroups.length === 0 && <div className="text-xs text-gray-500 px-2">No groups yet</div>}
        </div>
      )}
    </div>
  );
}
