import React, { useState, useRef } from 'react'
import { useChunkedUpload } from '../hooks/useChunkedUpload'

export default function FileUpload({ recipientId, onUploadComplete }) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [currentUploadId, setCurrentUploadId] = useState(null)
  const { uploadFile, cancelUpload } = useChunkedUpload()

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadError(null)
      setUploadProgress(0)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSec) => {
    return formatFileSize(bytesPerSec) + '/s'
  }

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h`
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file')
      return
    }

    if (!recipientId) {
      setUploadError('Please select a recipient')
      return
    }

    setIsUploading(true)
    setUploadError(null)
    setUploadProgress(0)

    const startTime = Date.now()
    const startSize = 0

    try {
      // Note: In production, you'd want to update progress in real-time
      // For now, we'll do a simple progress tracking
      const uploadResult = await uploadFile(selectedFile, recipientId, (progress) => {
        setUploadProgress(progress)
      })

      setCurrentUploadId(uploadResult.uploadId)

      if (uploadResult.success) {
        const endTime = Date.now()
        const totalTime = (endTime - startTime) / 1000 // seconds
        const avgSpeed = selectedFile.size / totalTime

        setUploadProgress(100)
        setUploadSpeed(avgSpeed)
        setTimeRemaining(0)

        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''

        onUploadComplete?.({
          fileId: uploadResult.fileId,
          filename: selectedFile.name,
          size: selectedFile.size,
          uploadTime: totalTime,
          avgSpeed
        })

        setTimeout(() => {
          setUploadProgress(0)
          setUploadSpeed(0)
        }, 2000)
      }
    } catch (error) {
      const errorMsg = error.message || 'Upload failed'
      if (errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
        setUploadError(null) // Don't show error for user-initiated cancellation
      } else {
        setUploadError(errorMsg)
      }
    } finally {
      setIsUploading(false)
      setCurrentUploadId(null)
    }
  }

  const handleCancel = async () => {
    if (currentUploadId) {
      try {
        await cancelUpload(currentUploadId)
        setUploadError(null)
        setUploadProgress(0)
        setUploadSpeed(0)
        setTimeRemaining(null)
      } catch (error) {
        console.error('Error cancelling upload:', error)
      }
    }
  }

  return (
    <div className="file-upload-container p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Upload File</h3>

      {uploadError && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {uploadError}
        </div>
      )}

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="w-full"
        />
      </div>

      {selectedFile && (
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <div className="font-medium">{selectedFile.name}</div>
          <div className="text-sm text-gray-600">
            Size: {formatFileSize(selectedFile.size)}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          {uploadSpeed > 0 && (
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Speed: {formatSpeed(uploadSpeed)}</span>
              {timeRemaining && <span>Time remaining: {formatTime(timeRemaining)}</span>}
            </div>
          )}
        </div>
      )}

      {uploadProgress === 100 && !isUploading && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          ✓ Upload completed successfully!
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="flex-1 btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
        {isUploading && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
