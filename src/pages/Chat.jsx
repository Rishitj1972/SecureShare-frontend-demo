import React, { useEffect, useState } from 'react'
import UsersList from '../components/UsersList'
import ConversationPanel from '../components/ConversationPanel'
import SearchUsers from '../components/SearchUsers'
import FriendRequests from '../components/FriendRequests'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

function Notification({ note }){
  if(!note) return null
  return (
    <div className={`fixed right-4 top-20 px-4 py-2 rounded shadow z-50 ${note.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
      {note.text}
    </div>
  )
}

export default function Chat(){
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(()=>{
    if (!user?.id) return // Don't fetch if user is not logged in
    
    const load = async () =>{
      setLoading(true)
      try{
        const res = await api.get('/friends')

        if (!Array.isArray(res.data)) {
          throw new Error('Server returned invalid users data')
        }

        setUsers(res.data)
        setNote(null) // Clear any previous errors
      }catch(err){
        if (err.response?.status === 401) {
          setNote({ text: 'Session expired. Please login again.', type: 'error' })
        } else if (err.response?.status === 500) {
          setNote({ text: 'Server error. Please try again later.', type: 'error' })
        } else {
          setNote({ text: err?.response?.data?.message || 'Failed to load friends', type: 'error' })
        }
      }finally{
        setLoading(false)
      }
    }
    load()
  },[user?.id, refreshKey])

  const showNotification = (text, type='success') => {
    setNote({ text, type })
    setTimeout(()=> setNote(null), 3500)
  }

  const handleFriendAdded = () => {
    // Refresh friends list when a friend is added
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-gray-50 overflow-hidden">
      {/* Toggle button for mobile only */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden p-3 bg-white border-b border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold"
      >
        ☰ {showSidebar ? 'Hide Contacts' : 'Show Contacts'}
      </button>

      {/* Sidebar - Mobile: Toggle visibility, Desktop: Always visible */}
      <div className={`${
        showSidebar ? 'block' : 'hidden'
      } md:block md:w-80 flex flex-col overflow-hidden bg-white border-r border-gray-200`}>
        <div className="flex-1 overflow-auto">
          <div className="p-3 border-b bg-white sticky top-0 z-10">
            <SearchUsers showNotification={showNotification} onFriendAdded={handleFriendAdded} />
            <FriendRequests showNotification={showNotification} onRefresh={handleFriendAdded} />
          </div>
          <UsersList users={users} selectedId={selected?._id} onSelect={u => {
            setSelected(u)
            // Only hide sidebar on mobile when a user is selected
            if (window.innerWidth < 768) {
              setShowSidebar(false)
            }
          }} loading={loading} />
        </div>
      </div>

      {/* Conversation Panel - Desktop: Always visible with selected user, Mobile: Show when sidebar is hidden */}
      {(selected || window.innerWidth >= 768) && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ConversationPanel userId={selected?._id} userObj={selected} showNotification={showNotification} />
        </div>
      )}

      {/* Empty state for desktop when no user is selected */}
      {!selected && window.innerWidth >= 768 && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="text-center max-w-md px-6">
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <span className="text-5xl">👋</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to SecureShare</h2>
            <p className="text-gray-600 text-lg mb-4">Share files securely with your contacts</p>
            <div className="space-y-3 mt-8 pt-8 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">🔍</span>
                <div>
                  <p className="font-semibold text-gray-900">Search & Connect</p>
                  <p className="text-sm text-gray-600">Find contacts using the search bar</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">🤝</span>
                <div>
                  <p className="font-semibold text-gray-900">Send Friend Request</p>
                  <p className="text-sm text-gray-600">Add users to your contact list</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">🔒</span>
                <div>
                  <p className="font-semibold text-gray-900">Share Securely</p>
                  <p className="text-sm text-gray-600">All files are encrypted end-to-end</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Notification note={note} />
    </div>
  )
}

