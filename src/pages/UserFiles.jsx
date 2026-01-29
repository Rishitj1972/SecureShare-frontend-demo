import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import FileCard from '../components/FileCard'
import { useAuth } from '../context/AuthContext'

export default function UserFiles() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [files, setFiles] = useState([])
  const [fileInput, setFileInput] = useState(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [downloading, setDownloading] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [otherUser, setOtherUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Validate user ID format
  const isValidId = useCallback((userId) => {
    return /^[0-9a-fA-F]{24}$/.test(userId)
  }, [])

  const load = useCallback(
    async () => {
      try {
        if (!isValidId(id)) {
          setMsg('Invalid user ID')
          setMsgType('error')
          setLoading(false)
          return
        }

        // Prevent user from accessing their own file page
        if (id === user?.id || id.toString() === user?.id?.toString()) {
          setMsg('Cannot share files with yourself')
          setMsgType('error')
          setLoading(false)
          setTimeout(() => navigate('/users'), 2000)
          return
        }

        const [filesRes, usersRes] = await Promise.all([
          api.get(`/files/with/${id}`),
          api.get('/users'),
        ])

        setFiles(filesRes.data || [])
        const other = usersRes.data.find((u) => u._id === id)
        if (!other) {
          setMsg('User not found')
          setMsgType('error')
        }
        setOtherUser(other)
      } catch (err) {
        if (err?.response?.status === 401) {
          logout()
          navigate('/login')
        } else {
          setMsg(err?.response?.data?.message || 'Failed to load files')
          setMsgType('error')
        }
      } finally {
        setLoading(false)
      }
    },
    [id, logout, navigate, isValidId, user?.id]
  )

  // Load files when component mounts or id changes
  useEffect(() => {
    load()
  }, [id, load])

  const showMessage = (text, type = 'success') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 3500)
  }

  const submit = async (e) => {
    e.preventDefault()

    if (!fileInput) {
      showMessage('Please select a file', 'error')
      return
    }

    if (fileInput.size === 0) {
      showMessage('File size cannot be empty', 'error')
      return
    }

    const fd = new FormData()
    fd.append('file', fileInput)
    fd.append('receiver', id)

    setUploading(true)
    try {
      const res = await api.post('/files/send', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      showMessage('File sent successfully', 'success')
      setFileInput(null)
      setFiles((prev) => [res.data, ...prev])
    } catch (err) {
      showMessage(err?.response?.data?.message || 'Upload failed', 'error')
      if (err?.response?.status === 401) {
        logout()
        navigate('/login')
      }
    } finally {
      setUploading(false)
    }
  }

  const onDownload = async (fileId, fileMeta) => {
    setDownloading(fileId)
    try {
      const res = await api.get(`/files/download/${fileId}`, {
        responseType: 'arraybuffer',
      })
      const blob = new Blob([res.data], {
        type: fileMeta?.mimeType || 'application/octet-stream',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileMeta?.originalFileName || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      showMessage('File downloaded successfully', 'success')
    } catch (err) {
      console.error('Download error:', err)
      showMessage(err?.response?.data?.message || 'Download failed', 'error')
      if (err?.response?.status === 401) {
        logout()
        navigate('/login')
      }
    } finally {
      setDownloading(null)
    }
  }

  const onDelete = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}`)
      setFiles((prev) => prev.filter((x) => x._id !== fileId))
      showMessage('File deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showMessage(err?.response?.data?.message || 'Delete failed', 'error')
      if (err?.response?.status === 401) {
        logout()
        navigate('/login')
      }
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">
        {otherUser ? `${otherUser.username} (${otherUser.email})` : 'Loading...'}
      </h2>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => setFileInput(e.target.files?.[0] || null)}
              disabled={uploading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
            />
            <button
              className="px-4 py-2 bg-sky-500 text-white rounded font-medium hover:bg-sky-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={uploading || !fileInput}
            >
              {uploading ? 'Uploading...' : 'Send'}
            </button>
          </div>
          {msg && (
            <div
              className={`text-sm p-2 rounded ${
                msgType === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {msg}
            </div>
          )}
        </form>
      </div>

      <div className="space-y-3">
        {files.length > 0 ? (
          files.map((f) => (
            <FileCard
              key={f._id}
              file={f}
              onDownload={() => onDownload(f._id, f)}
              onDelete={onDelete}
              downloading={downloading === f._id}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">No files shared yet</div>
        )}
      </div>
    </div>
  )
}
