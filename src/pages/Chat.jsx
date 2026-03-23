import React, { useEffect, useState } from 'react'
import UsersList from '../components/UsersList'
import GroupsList from '../components/GroupsList'
import ConversationPanel from '../components/ConversationPanel'
import SearchUsers from '../components/SearchUsers'
import FriendRequests from '../components/FriendRequests'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function Notification({ note }){
  if(!note) return null
  return (
    <div className={`fixed right-4 top-4 px-4 py-2 rounded shadow ${note.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
      {note.text}
    </div>
  )
}

export default function Chat(){
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [presenceMap, setPresenceMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [latestCreatedGroupId, setLatestCreatedGroupId] = useState(null)
  const [mode, setMode] = useState('friends')
  const [note, setNote] = useState(null)

  const loadFriends = async () => {
    const res = await api.get('/friends')

    if (!Array.isArray(res.data)) {
      console.error('Expected users array, got:', res.data)
      throw new Error('Invalid users response')
    }

    setUsers(res.data)
  }

  const selectedWithPresence = selectedFriend
    ? {
        ...selectedFriend,
        isActive: !!presenceMap[selectedFriend._id]?.isActive,
        lastSeen: presenceMap[selectedFriend._id]?.lastSeen || null
      }
    : null

  const loadGroups = async () => {
    const [groupsRes, invitesRes] = await Promise.all([
      api.get('/groups'),
      api.get('/groups/invitations/pending')
    ])

    setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : [])
    setPendingInvites(Array.isArray(invitesRes.data) ? invitesRes.data : [])
  }

  useEffect(()=>{
    if (!user?.id) return

    const load = async () =>{
      setLoading(true)
      try{
        await Promise.all([loadFriends(), loadGroups()])
      }catch(err){
        console.error(err)
        setNote({ text: err?.response?.data?.message || 'Failed to load friends', type: 'error' })
      }finally{
        setLoading(false)
      }
    }
    load()
  },[user?.id])

  useEffect(() => {
    if (!selectedGroup?._id) return
    const refreshed = groups.find((group) => group._id === selectedGroup._id)
    if (refreshed) {
      setSelectedGroup(refreshed)
    }
  }, [groups, selectedGroup?._id])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false

    const loadPresence = async () => {
      try {
        const res = await api.get('/friends/presence')
        if (cancelled || !Array.isArray(res.data)) return

        const nextMap = {}
        res.data.forEach((item) => {
          const id = item?.userId?._id || item?.userId
          if (!id) return
          nextMap[id] = {
            isActive: !!item.isActive,
            lastSeen: item.lastSeen || null
          }
        })
        setPresenceMap(nextMap)
      } catch (_) {
        // Non-critical polling error
      }
    }

    loadPresence()
    const intervalId = setInterval(loadPresence, 10000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [user?.id])

  const showNotification = (text, type='success') => {
    setNote({ text, type })
    setTimeout(()=> setNote(null), 3500)
  }

  const refreshFriends = async () => {
    try {
      await loadFriends()
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Failed to refresh friends', 'error')
    }
  }

  const createGroup = async ({ name, memberIds }) => {
    try {
      const res = await api.post('/groups', { name, memberIds })
      const createdGroupId = res?.data?.groupId || null
      setLatestCreatedGroupId(createdGroupId)
      await loadGroups()
      showNotification('Group created successfully', 'success')
      setMode('groups')
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Failed to create group', 'error')
      throw err
    }
  }

  const respondToInvite = async (groupId, action) => {
    try {
      await api.put(`/groups/${groupId}/invitations/respond`, { action })
      await loadGroups()
      showNotification(action === 'accept' ? 'Invitation accepted' : 'Invitation rejected', 'success')
    } catch (err) {
      showNotification(err?.response?.data?.message || 'Failed to respond to invitation', 'error')
    }
  }

  return (
    <div className="h-[calc(100vh-160px)] flex bg-gray-50">
      <div className="w-64">
        <div className="flex border-b bg-white">
          <button
            className={`flex-1 py-2 text-sm ${mode === 'friends' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600'}`}
            onClick={() => setMode('friends')}
          >
            Friends
          </button>
          <button
            className={`flex-1 py-2 text-sm ${mode === 'groups' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600'}`}
            onClick={() => setMode('groups')}
          >
            Groups
          </button>
        </div>

        {mode === 'friends' ? (
          <div className="h-full flex flex-col min-h-0 bg-white">
            <div className="px-2 pt-2">
              <SearchUsers showNotification={showNotification} onFriendAdded={refreshFriends} />
              <FriendRequests showNotification={showNotification} onRefresh={refreshFriends} />
            </div>
            <div className="flex-1 min-h-0">
              <UsersList
                users={users}
                presenceMap={presenceMap}
                selectedId={selectedFriend?._id}
                onSelect={(u) => {
                  setSelectedFriend(u)
                  setSelectedGroup(null)
                }}
                loading={loading}
              />
            </div>
          </div>
        ) : (
          <GroupsList
            groups={groups}
            pendingInvites={pendingInvites}
            friends={users}
            latestCreatedGroupId={latestCreatedGroupId}
            selectedGroupId={selectedGroup?._id}
            loading={loading}
            onCreateGroup={createGroup}
            onRespondToInvite={respondToInvite}
            onSelectGroup={(group) => {
              setSelectedGroup(group)
              setSelectedFriend(null)
            }}
          />
        )}
      </div>
      <div className="flex-1">
        <ConversationPanel
          userId={selectedFriend?._id}
          userObj={selectedWithPresence}
          groupObj={selectedGroup}
          friends={users}
          onRefreshGroups={loadGroups}
          showNotification={showNotification}
        />
      </div>
      <Notification note={note} />
    </div>
  )
}
