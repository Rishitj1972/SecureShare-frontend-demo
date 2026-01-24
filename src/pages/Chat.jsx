import React, { useEffect, useState } from 'react'
import UsersList from '../components/UsersList'
import ConversationPanel from '../components/ConversationPanel'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

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
  const { socket } = useSocket()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(()=>{
    const load = async () =>{
      setLoading(true)
      try{
        const res = await api.get('/users')

        // 🔒 SAFETY CHECK (MANDATORY)
    if (!Array.isArray(res.data)) {
      console.error('Expected users array, got:', res.data)
      throw new Error('Invalid users response')
    }

        // exclude current user
        const list = res.data.filter(u => u._id !== user?.id)
        setUsers(list)
      }catch(err){
        console.error(err)
        setNote({ text: err?.response?.data?.message || 'Failed to load users', type: 'error' })
      }finally{
        setLoading(false)
      }
    }
    load()
  },[user])

  // Listen for real-time file events
  useEffect(() => {
    if (!socket) return

    const handleFileReceived = (data) => {
      console.log('File received event:', data)
      // Trigger refresh in ConversationPanel
      setRefreshTrigger(prev => prev + 1)
      showNotification(`New file received: ${data.originalFileName}`, 'success')
    }

    const handleFileDeleted = (data) => {
      console.log('File deleted event:', data)
      setRefreshTrigger(prev => prev + 1)
      showNotification('A file was deleted', 'success')
    }

    socket.on('fileReceived', handleFileReceived)
    socket.on('fileDeleted', handleFileDeleted)

    return () => {
      socket.off('fileReceived', handleFileReceived)
      socket.off('fileDeleted', handleFileDeleted)
    }
  }, [socket])

  const showNotification = (text, type='success') => {
    setNote({ text, type })
    setTimeout(()=> setNote(null), 3500)
  }

  return (
    <div className="h-[calc(100vh-160px)] flex bg-gray-50">
      <div className="w-64">
        <UsersList users={users} selectedId={selected?._id} onSelect={u=>setSelected(u)} loading={loading} />
      </div>
      <div className="flex-1">
        <ConversationPanel userId={selected?._id} userObj={selected} showNotification={showNotification} refreshTrigger={refreshTrigger} />
      </div>
      <Notification note={note} />
    </div>
  )
}
