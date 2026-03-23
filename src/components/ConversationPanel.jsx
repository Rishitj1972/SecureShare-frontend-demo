import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import FileCard from './FileCard'
import { useChunkedUpload } from '../hooks/useChunkedUpload'
import { useFileEncryption } from '../hooks/useFileEncryption'
import { useFileDecryption } from '../hooks/useFileDecryption'
import { useAuth } from '../context/AuthContext'

// v5.0.0 - Fresh build cache buster

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

function sortConversationFiles(files = []) {
  return [...files].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export default function ConversationPanel({ userId, userObj, groupObj, friends = [], onRefreshGroups, showNotification }){
  const [files, setFiles] = useState([])
  const [fileInput, setFileInput] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [currentUploadId, setCurrentUploadId] = useState(null)
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStage, setDownloadStage] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadingFileId, setDownloadingFileId] = useState(null)
  const [isUnfriending, setIsUnfriending] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false)
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([])
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [editingAdminId, setEditingAdminId] = useState('')
  const [groupPhotoFile, setGroupPhotoFile] = useState(null)
  const [removeGroupPhoto, setRemoveGroupPhoto] = useState(false)
  const [isSavingGroup, setIsSavingGroup] = useState(false)
  const mounted = useRef(true)
  const listRef = useRef(null)
  const { uploadFile, cancelUpload } = useChunkedUpload()
  const { encryptFileForUpload, getReceiverPublicKey } = useFileEncryption()
  const { downloadAndDecrypt } = useFileDecryption()
  const { user } = useAuth()
  const isGroupMode = !!groupObj
  const currentUserId = user?.id || user?._id
  const ownerId = groupObj?.owner?._id || groupObj?.owner
  const isGroupOwner = isGroupMode && !!ownerId && String(ownerId) === String(currentUserId)

  const memberStatusByUserId = groupMembers.reduce((acc, member) => {
    const memberUserId = member?.user?._id || member?.user
    if (!memberUserId) return acc
    acc[String(memberUserId)] = member.status
    return acc
  }, {})

  const inviteCandidates = (Array.isArray(friends) ? friends : []).filter((friend) => {
    const status = memberStatusByUserId[String(friend._id)]
    return status !== 'accepted' && status !== 'pending'
  })

  const acceptedGroupMembers = groupMembers
    .filter((member) => member.status === 'accepted' && member.user?._id)
    .map((member) => ({
      id: member.user._id,
      name: member.user.username || member.user.email,
      email: member.user.email
    }))

  useEffect(()=>{
    mounted.current = true
    const load = async () => {
      if(isGroupMode && !groupObj?._id) {
        setFiles([])
        return
      }

      if(!isGroupMode && !userId) {
        setFiles([])
        return
      }

      setLoading(true)
      try{
        const res = isGroupMode
          ? await api.get(`/groups/${groupObj._id}/files`)
          : await api.get(`/files/with/${userId}`)
        if(!mounted.current) return
        setFiles(sortConversationFiles(res.data))
      }catch(err){
        showNotification && showNotification(err?.response?.data?.message || 'Failed to load files', 'error')
      }finally{
        setLoading(false)
      }
    }
    load()
    return ()=>{ mounted.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId, isGroupMode, groupObj?._id])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [files.length, userId])

  useEffect(() => {
    setShowAddMembers(false)
    setShowEditGroup(false)
    setSelectedNewMemberIds([])
    setGroupPhotoFile(null)
    setRemoveGroupPhoto(false)

    if (!isGroupMode || !groupObj?._id) {
      setGroupMembers([])
      setEditingGroupName('')
      setEditingAdminId('')
      return
    }

    setEditingGroupName(groupObj?.name || '')
    setEditingAdminId(String(groupObj?.owner?._id || groupObj?.owner || ''))

    const loadGroupMembers = async () => {
      setLoadingGroupMembers(true)
      try {
        const membersRes = await api.get(`/groups/${groupObj._id}/members`)
        setGroupMembers(Array.isArray(membersRes?.data?.members) ? membersRes.data.members : [])
      } catch (_) {
        setGroupMembers([])
      } finally {
        setLoadingGroupMembers(false)
      }
    }

    loadGroupMembers()
  }, [isGroupMode, groupObj?._id])

  const toggleNewMember = (friendId) => {
    setSelectedNewMemberIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    )
  }

  const handleAddMembersToGroup = async () => {
    if (!groupObj?._id || selectedNewMemberIds.length === 0) return

    setIsAddingMembers(true)
    try {
      const res = await api.post(`/groups/${groupObj._id}/invite`, { memberIds: selectedNewMemberIds })
      const invitedCount = res?.data?.invitedCount ?? selectedNewMemberIds.length

      if (invitedCount > 0) {
        showNotification && showNotification(`Added ${invitedCount} member${invitedCount > 1 ? 's' : ''} to group`, 'success')
      } else {
        showNotification && showNotification('No new members were added', 'error')
      }

      const membersRes = await api.get(`/groups/${groupObj._id}/members`)
      setGroupMembers(Array.isArray(membersRes?.data?.members) ? membersRes.data.members : [])
      await onRefreshGroups?.()
      setSelectedNewMemberIds([])
      setShowAddMembers(false)
    } catch (err) {
      showNotification && showNotification(err?.response?.data?.message || 'Failed to add members', 'error')
    } finally {
      setIsAddingMembers(false)
    }
  }

  const handleSaveGroup = async () => {
    if (!groupObj?._id) return

    const trimmedName = editingGroupName.trim()
    if (!trimmedName) {
      showNotification && showNotification('Group name cannot be empty', 'error')
      return
    }

    setIsSavingGroup(true)
    try {
      // Update group photo first if needed (separate request)
      if (groupPhotoFile) {
        const photoForm = new FormData()
        photoForm.append('groupPhoto', groupPhotoFile)
        await api.put(`/groups/${groupObj._id}/photo`, photoForm)
      } else if (removeGroupPhoto) {
        const removeForm = new FormData()
        removeForm.append('removePhoto', 'true')
        await api.put(`/groups/${groupObj._id}/photo`, removeForm)
      }

      // Then update group details (name/admin)
      await api.put(`/groups/${groupObj._id}`, {
        name: trimmedName,
        adminId: editingAdminId || undefined
      })

      await onRefreshGroups?.()

      const membersRes = await api.get(`/groups/${groupObj._id}/members`)
      setGroupMembers(Array.isArray(membersRes?.data?.members) ? membersRes.data.members : [])

      setGroupPhotoFile(null)
      setRemoveGroupPhoto(false)
      setShowEditGroup(false)
      showNotification && showNotification('Group updated successfully', 'success')
    } catch (err) {
      showNotification && showNotification(err?.response?.data?.message || 'Failed to update group', 'error')
    } finally {
      setIsSavingGroup(false)
    }
  }

  const submit = async (e) => {
    e && e.preventDefault && e.preventDefault()
    if(!fileInput) return setMsg('Please select a file')
    if(!userId && !isGroupMode) return setMsg('Please select a user')
    if(isGroupMode && !groupObj?._id) return setMsg('Please select a group')
    if(isUploading) return setMsg('Upload already in progress')
    
    setIsUploading(true)
    setUploadProgress(0)
    setUploadSpeed(0)
    setElapsedTime(0)
    setCurrentUploadId(null)
    setMsg('')
    const startTime = Date.now()
    let lastUpdateTime = startTime
    
    try{
      if (isGroupMode) {
        setMsg('Loading group members...')
        const membersRes = await api.get(`/groups/${groupObj._id}/members`)
        const groupShareId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const acceptedMembers = (membersRes?.data?.members || [])
          .filter((member) => member.status === 'accepted')
          .map((member) => member.user)
          .filter((memberUser) => memberUser?._id && memberUser._id !== user?.id)

        if (acceptedMembers.length === 0) {
          throw new Error('No accepted members available in this group')
        }

        let sentCount = 0
        for (let i = 0; i < acceptedMembers.length; i += 1) {
          const receiver = acceptedMembers[i]

          setMsg(`Encrypting for ${receiver.username || receiver.email} (${i + 1}/${acceptedMembers.length})...`)
          setIsEncrypting(true)
          const receiverPublicKey = await getReceiverPublicKey(receiver._id)
          if (!receiverPublicKey) {
            setIsEncrypting(false)
            continue
          }

          const { encryptedFile, encryptedAesKey, iv, fileHash } = await encryptFileForUpload(fileInput, receiverPublicKey)
          setIsEncrypting(false)

          setMsg(`Uploading to ${receiver.username || receiver.email} (${i + 1}/${acceptedMembers.length})...`)

          await uploadFile(
            encryptedFile,
            receiver._id,
            (progress) => {
              const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)))
              const combined = Math.round(((i + normalizedProgress / 100) / acceptedMembers.length) * 100)
              setUploadProgress((prev) => Math.max(prev, combined))

              const now = Date.now()
              const elapsed = (now - startTime) / 1000
              setElapsedTime(Math.round(elapsed))
              if (elapsed > 0.5 && (now - lastUpdateTime) >= 500) {
                const aggregateBytes = ((i + normalizedProgress / 100) / acceptedMembers.length) * (fileInput.size * acceptedMembers.length)
                setUploadSpeed(aggregateBytes / elapsed)
                lastUpdateTime = now
              }
            },
            (uploadId) => setCurrentUploadId(uploadId),
            { encryptedAesKey, iv, fileHash },
            groupObj._id,
            groupShareId
          )

          sentCount += 1
        }

        if (sentCount === 0) {
          throw new Error('Could not send file to any group members')
        }

        setMsg(`File shared with ${sentCount} group member${sentCount > 1 ? 's' : ''}`)
        showNotification && showNotification(`Shared with ${sentCount} members`, 'success')
        setFileInput(null)
        const groupFilesRes = await api.get(`/groups/${groupObj._id}/files`)
        setFiles(sortConversationFiles(groupFilesRes.data))
        setTimeout(() => {
          setUploadProgress(0)
          setUploadSpeed(0)
          setElapsedTime(0)
          setMsg('')
        }, 2000)
        return
      }

      // Step 1: Get receiver's public key
      setMsg('🔐 Fetching encryption key...')
      setIsEncrypting(true)
      const receiverPublicKey = await getReceiverPublicKey(userId)
      
      if (!receiverPublicKey) {
        throw new Error('Receiver has not set up encryption keys. Please ask them to register again.')
      }

      // Step 2: Encrypt file
      setMsg('🔐 Encrypting file...')
      const { encryptedFile, encryptedAesKey, iv, fileHash } = await encryptFileForUpload(fileInput, receiverPublicKey)
      setIsEncrypting(false)
      
      setMsg('📤 Uploading encrypted file...')
      
      // Step 3: Upload encrypted file
      const result = await uploadFile(
        encryptedFile,
        userId,
        (progress) => {
          const safeProgress = Math.max(0, Math.min(100, Math.round(progress)))
          setUploadProgress(prev => Math.max(prev, safeProgress))
          
          const now = Date.now()
          const elapsed = (now - startTime) / 1000
          setElapsedTime(Math.round(elapsed))

          // Update speed every 500ms to avoid too frequent updates
          if (elapsed > 0.5 && (now - lastUpdateTime) >= 500) {
            const bytesUploaded = (safeProgress / 100) * encryptedFile.size
            const speed = bytesUploaded / elapsed
            setUploadSpeed(speed)
            lastUpdateTime = now
          }
        },
        (uploadId) => {
          setCurrentUploadId(uploadId)
        },
        { encryptedAesKey, iv, fileHash } // Encryption metadata
      )
      
      setMsg('File sent successfully!')
      showNotification && showNotification('File sent', 'success')
      setFileInput(null)
      
      // Refresh file list
      const r = await api.get(`/files/with/${userId}`)
      setFiles(sortConversationFiles(r.data))
      
      // Reset progress bar after a short delay
      setTimeout(() => {
        setUploadProgress(0)
        setUploadSpeed(0)
        setElapsedTime(0)
        setMsg('')
      }, 2000)
    }catch(err){
      const errorMsg = err?.response?.data?.message || err?.message || 'Upload failed'
      setMsg(errorMsg)
      showNotification && showNotification(errorMsg, 'error')
    }finally{
      setIsEncrypting(false)
      setIsUploading(false)
      setCurrentUploadId(null)
    }
  }

  const handleCancel = async () => {
    if (!currentUploadId) return
    
    // Immediately update UI state
    setIsUploading(false)
    setUploadProgress(0)
    setUploadSpeed(0)
    setElapsedTime(0)
    const uploadIdToCancel = currentUploadId
    setCurrentUploadId(null)
    setFileInput(null)
    
    try {
      // Cancel upload and cleanup chunks on server
      await cancelUpload(uploadIdToCancel)
      setMsg('Upload cancelled - chunks cleared')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      // Even if server cancel fails, UI is already reset
      setMsg('Upload cancelled (local)')
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const onDownload = async (fileId, fileMeta) => {
    if (isDownloading) {
      showNotification && showNotification('Another download is already in progress', 'info')
      return
    }

    try{
      setIsDownloading(true)
      setDownloadingFileId(fileId)
      setDownloadProgress(0)
      setDownloadStage('starting')
      showNotification && showNotification('Starting download...', 'info')

      // Download and decrypt file with progress tracking
      const decryptedBlob = await downloadAndDecrypt(
        fileId, 
        user?.id || user?._id, 
        fileMeta,
        (progress, stage) => {
          // Map progress to cumulative scale:
          // Download: 0-60%
          // Decrypt: 60-90%
          // Verify: 90-100%
          let cumulativeProgress = 0
          
          if (stage === 'downloading') {
            cumulativeProgress = Math.round(progress * 0.6) // 0-60%
          } else if (stage === 'decrypting') {
            cumulativeProgress = 60 + Math.round(progress * 0.3) // 60-90%
          } else if (stage === 'verifying') {
            cumulativeProgress = 90 + Math.round(progress * 0.1) // 90-100%
          } else if (stage === 'complete') {
            cumulativeProgress = 100
          }
          
          setDownloadProgress(cumulativeProgress)
          setDownloadStage(stage)
          
          // Update notification based on stage
          if (stage === 'downloading' && cumulativeProgress % 15 === 0 && cumulativeProgress > 0) {
            showNotification && showNotification(`Downloading... ${cumulativeProgress}%`, 'info')
          } else if (stage === 'decrypting' && cumulativeProgress === 60) {
            showNotification && showNotification('Decrypting file...', 'info')
          } else if (stage === 'verifying' && cumulativeProgress === 90) {
            showNotification && showNotification('Verifying integrity...', 'info')
          }
        }
      )

      // Trigger download
      const url = window.URL.createObjectURL(decryptedBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileMeta?.originalFileName || 'file'
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up blob URL
      window.URL.revokeObjectURL(url)

      showNotification && showNotification(
        fileMeta.isEncrypted ? '🔓 File decrypted and downloaded' : 'Download complete', 
        'success'
      )
    }catch(err){
      const errorMsg = err?.message || 'Download failed'
      showNotification && showNotification(errorMsg, 'error')
      console.error('Download error:', err)
    } finally {
      setIsDownloading(false)
      setDownloadingFileId(null)
      setDownloadProgress(0)
      setDownloadStage('')
    }
  }

  const handleUnfriend = async () => {
    if (!window.confirm(`Are you sure you want to remove ${userObj?.name || userObj?.username}?`)) return
    
    setIsUnfriending(true)
    try {
      await api.delete(`/friends/${userId}`)
      showNotification && showNotification('Friend removed successfully', 'success')
      // Reset the selected user in parent component
      // This will be handled by refreshing the friends list
      setTimeout(() => {
        window.location.reload() // Reload to refresh friends list
      }, 1500)
    } catch (err) {
      showNotification && showNotification(err?.response?.data?.message || 'Failed to remove friend', 'error')
    } finally {
      setIsUnfriending(false)
    }
  }

  return (
    <div className="h-full p-3 md:p-4 flex flex-col">
      <div className="border-b pb-3 mb-3">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 md:gap-0">
          <div className="flex items-center gap-3 min-w-0">
            {isGroupMode ? (
              groupObj?.groupPhoto ? (
                <img
                  src={getPhotoUrl(groupObj.groupPhoto, groupObj.updatedAt)}
                  alt={groupObj?.name || 'Group'}
                  className="w-10 h-10 rounded-full object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700">
                  {getInitials(groupObj?.name || 'Group')}
                </div>
              )
            ) : userObj ? (
              userObj.profilePhoto ? (
                <img
                  src={getPhotoUrl(userObj.profilePhoto)}
                  alt={userObj.username || userObj.name}
                  className="w-10 h-10 rounded-full object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                  {getInitials(userObj.name || userObj.username)}
                </div>
              )
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100" />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-base md:text-base truncate">{isGroupMode ? (groupObj?.name || 'Select a group') : (userObj ? `${userObj.name || userObj.username}` : 'Select a user')}</div>
              <div className="flex items-center gap-2 text-[11px] md:text-xs text-gray-500 flex-wrap">
                <span>{isGroupMode ? 'Share to accepted group members' : 'Share files securely'}</span>
                {isGroupMode && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Admin: {groupObj?.owner?.username || groupObj?.owner?.email || 'Unknown'}
                  </span>
                )}
                {!isGroupMode && userObj && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${userObj.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${userObj.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {userObj.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] md:text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono whitespace-nowrap">v5.0.0 🔐 E2EE</div>
            {isGroupMode && groupObj && isGroupOwner && (
              <>
                <button
                  onClick={() => setShowAddMembers((prev) => !prev)}
                  className="px-3 py-1 text-[11px] md:text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded font-medium transition-colors"
                >
                  {showAddMembers ? 'Close Add Users' : 'Add Users'}
                </button>
                <button
                  onClick={() => setShowEditGroup((prev) => !prev)}
                  className="px-3 py-1 text-[11px] md:text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded font-medium transition-colors"
                >
                  {showEditGroup ? 'Close Edit Group' : 'Edit Group'}
                </button>
              </>
            )}
            {!isGroupMode && userObj && (
              <button
                onClick={handleUnfriend}
                disabled={isUnfriending}
                className="px-3 py-1 text-[11px] md:text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded font-medium transition-colors disabled:opacity-50"
              >
                {isUnfriending ? '⏳ Removing...' : '✕ Unfriend'}
              </button>
            )}
          </div>
        </div>

        {isGroupMode && groupObj && isGroupOwner && showAddMembers && (
          <div className="mt-3 border rounded-lg p-3 bg-emerald-50">
            <div className="text-xs md:text-sm font-semibold text-emerald-800 mb-2">Add users to this group</div>
            {loadingGroupMembers ? (
              <div className="text-xs text-gray-500">Loading current members...</div>
            ) : (
              <>
                <div className="max-h-36 overflow-auto border rounded p-2 bg-white">
                  {inviteCandidates.length === 0 && (
                    <div className="text-xs text-gray-500">No eligible friends to add right now.</div>
                  )}
                  {inviteCandidates.map((friend) => {
                    const status = memberStatusByUserId[String(friend._id)]
                    const isReinvite = status === 'rejected'

                    return (
                      <label key={friend._id} className="flex items-center justify-between gap-2 text-xs py-1 cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedNewMemberIds.includes(friend._id)}
                            onChange={() => toggleNewMember(friend._id)}
                            disabled={isAddingMembers}
                          />
                          <span className="truncate">{friend.username || friend.name}</span>
                        </div>
                        {isReinvite && <span className="text-[10px] text-orange-600">Re-invite</span>}
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddMembersToGroup}
                    disabled={isAddingMembers || selectedNewMemberIds.length === 0}
                    className="px-3 py-1.5 text-xs md:text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
                  >
                    {isAddingMembers ? 'Adding...' : 'Add Selected Users'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNewMemberIds([])
                      setShowAddMembers(false)
                    }}
                    disabled={isAddingMembers}
                    className="px-3 py-1.5 text-xs md:text-sm bg-gray-200 text-gray-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {isGroupMode && groupObj && isGroupOwner && showEditGroup && (
          <div className="mt-3 border rounded-lg p-3 bg-indigo-50 space-y-3">
            <div className="text-xs md:text-sm font-semibold text-indigo-800">Edit group details</div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Group name</label>
              <input
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                className="w-full px-2 py-2 text-sm border rounded"
                maxLength={80}
                placeholder="Group name"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Group admin</label>
              <select
                value={editingAdminId}
                onChange={(e) => setEditingAdminId(e.target.value)}
                className="w-full px-2 py-2 text-sm border rounded bg-white"
              >
                {acceptedGroupMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.email ? ` (${member.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Group photo</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setGroupPhotoFile(file)
                    if (file) setRemoveGroupPhoto(false)
                  }}
                  className="text-xs"
                />
                <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={removeGroupPhoto}
                    onChange={(e) => {
                      setRemoveGroupPhoto(e.target.checked)
                      if (e.target.checked) setGroupPhotoFile(null)
                    }}
                  />
                  Remove current photo
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={isSavingGroup}
                className="px-3 py-1.5 text-xs md:text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {isSavingGroup ? 'Saving...' : 'Save Group'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditGroup(false)
                  setGroupPhotoFile(null)
                  setRemoveGroupPhoto(false)
                }}
                disabled={isSavingGroup}
                className="px-3 py-1.5 text-xs md:text-sm bg-gray-200 text-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-auto space-y-2 md:space-y-4 mb-3 px-1 md:px-2">
        {loading && <div className="text-sm text-gray-500">Loading files...</div>}
        
        {!loading && files.length > 0 && (
          <div className="space-y-2">
            {files.map(f => (
              <FileCard 
                key={f._id} 
                file={f} 
                isSent={f.sender?._id === user?.id}
                currentUserId={user?.id}
                isDownloading={isDownloading}
                downloadingFileId={downloadingFileId}
                downloadProgress={downloadProgress}
                downloadStage={downloadStage}
                onDownload={() => onDownload(f._id, f)} 
                onDelete={async (id) => {
                  if (!window.confirm('Delete this file? This cannot be undone.')) return
                  try{
                    await api.delete(`/files/${id}`)
                    setFiles(prev => prev.filter(x => x._id !== id))
                    showNotification && showNotification('File deleted', 'success')
                  }catch(err){
                    showNotification && showNotification(err?.response?.data?.message || 'Delete failed', 'error')
                  }
                }} 
              />
            ))}
          </div>
        )}
        
        {files.length === 0 && !loading && <div className="text-sm text-gray-500">No files shared yet.</div>}
      </div>

      <div className="mt-2 border-t pt-2 sticky bottom-0 bg-white z-10 shadow-md">
        <form className="flex flex-col md:flex-row md:items-center gap-2 py-2" onSubmit={submit}>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded cursor-pointer hover:bg-gray-50 md:flex-shrink-0 text-sm md:text-base">
            <input type="file" className="hidden" onChange={e=>setFileInput(e.target.files[0])} disabled={isUploading || isEncrypting} />
            <span className="text-sm md:text-base">📎 Attach</span>
          </label>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center gap-2">
              <div className="text-[11px] md:text-sm flex-1 truncate">{fileInput ? fileInput.name : 'No file selected'}</div>
              {uploadProgress > 0 && <div className="text-[11px] md:text-sm font-medium text-blue-600 flex-shrink-0">{uploadProgress}%</div>}
            </div>
            {uploadProgress > 0 && (
              <div className="w-full bg-gray-200 h-2.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  style={{width: `${uploadProgress}%`}} 
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    uploadProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                />
              </div>
            )}
            {uploadProgress > 0 && (
              <div className="flex justify-between text-[11px] md:text-xs text-gray-600 mt-1">
                <span>⚡ {uploadSpeed > 0 ? `${(uploadSpeed / (1024 * 1024)).toFixed(1)} MB/s` : 'Starting...'}</span>
                <span>⏱ {elapsedTime}s</span>
              </div>
            )}
            {uploadProgress === 100 && isUploading && (
              <div className="text-[11px] md:text-xs text-gray-500 mt-1">Finalizing upload...</div>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              className={`px-3 md:px-4 py-2 rounded font-medium transition-colors flex-1 md:flex-initial text-sm md:text-base ${
                isUploading || isEncrypting
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              type="submit" 
              disabled={isUploading || isEncrypting}
            >
              {isEncrypting ? '🔐 Encrypting...' : isUploading ? `📤 ${uploadProgress}%` : '🔒 Send'}
            </button>
            {isUploading && currentUploadId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 md:px-4 py-2 rounded font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {msg && (
          <div className={`mt-2 text-sm px-2 py-1 rounded ${
            msg.includes('failed') || msg.includes('error') 
              ? 'text-red-600 bg-red-50' 
              : 'text-green-600 bg-green-50'
          }`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}  