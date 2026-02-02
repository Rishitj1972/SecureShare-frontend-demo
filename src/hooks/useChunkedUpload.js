import { useState, useCallback } from 'react'
import api from '../api/axios'
import CryptoJS from 'crypto-js'

export function useChunkedUpload() {
  const [uploads, setUploads] = useState({}) // uploadId -> upload state

  const calculateChunkHash = useCallback((chunk) => {
    // Convert Uint8Array to hex string for hashing
    const wordArray = CryptoJS.lib.WordArray.create(chunk)
    return CryptoJS.SHA256(wordArray).toString()
  }, [])

  const initUpload = useCallback(async (file, receiverId) => {
    try {
      const res = await api.post('/files/chunked/init', {
        filename: file.name,
        fileSize: file.size,
        receiver: receiverId,
        mimeType: file.type
      })

      const { uploadId, chunkSize, totalChunks } = res.data

      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          uploadId,
          file,
          chunkSize,
          totalChunks,
          uploadedChunks: [],
          progress: 0,
          status: 'initializing',
          error: null,
          startTime: Date.now()
        }
      }))

      return { uploadId, chunkSize, totalChunks }
    } catch (error) {
      throw error
    }
  }, [])

  const uploadChunk = useCallback(async (uploadId, chunkNumber, chunkData, totalChunks) => {
    try {
      const formData = new FormData()
      const blob = new Blob([chunkData])
      const chunkHash = calculateChunkHash(chunkData)

      formData.append('chunk', blob, `chunk_${chunkNumber}`)
      formData.append('uploadId', uploadId)
      formData.append('chunkNumber', chunkNumber)
      formData.append('totalChunks', totalChunks)
      formData.append('chunkHash', chunkHash)

      const res = await api.post('/files/chunked/upload-chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const uploadedChunks = res.data.uploadedChunks || []
      
      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          ...prev[uploadId],
          uploadedChunks: uploadedChunks,
          progress: Math.round((uploadedChunks.length / totalChunks) * 100),
          status: 'uploading'
        }
      }))

      return res.data
    } catch (error) {
      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          ...prev[uploadId],
          error: error.response?.data?.message || error.message,
          status: 'error'
        }
      }))
      throw error
    }
  }, [calculateChunkHash])

  const uploadFile = useCallback(async (file, receiverId, onProgress) => {
    try {
      // Initialize upload
      const { uploadId, chunkSize, totalChunks } = await initUpload(file, receiverId)

      let completedChunks = 0

      // Upload chunks in parallel (4 at a time for better performance)
      const PARALLEL_UPLOADS = 4
      for (let i = 1; i <= totalChunks; i += PARALLEL_UPLOADS) {
        const batch = []
        for (let j = 0; j < PARALLEL_UPLOADS && i + j <= totalChunks; j++) {
          const chunkNum = i + j
          const start = (chunkNum - 1) * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const chunk = file.slice(start, end)

          const chunkArrayBuffer = await chunk.arrayBuffer()
          const chunkUint8 = new Uint8Array(chunkArrayBuffer)

          batch.push(
            uploadChunk(uploadId, chunkNum, chunkUint8, totalChunks).then(() => {
              completedChunks++
              const progress = Math.round((completedChunks / totalChunks) * 100)
              if (onProgress) onProgress(progress)
            })
          )
        }
        
        // Wait for all chunks in batch to complete
        await Promise.all(batch)
      }

      // Complete upload - send file hash for verification
      if (onProgress) onProgress(95) // Show 95% while completing
      const fileBuffer = await file.arrayBuffer()
      const fileUint8 = new Uint8Array(fileBuffer)
      const fileHash = calculateChunkHash(fileUint8)

      const completeRes = await api.post('/files/chunked/complete', {
        uploadId,
        fileHash
      })

      if (onProgress) onProgress(100) // Show 100% when done

      setUploads(prev => ({
        ...prev,
        [uploadId]: {
          ...prev[uploadId],
          status: 'completed',
          fileId: completeRes.data.fileId
        }
      }))

      return { success: true, fileId: completeRes.data.fileId, uploadId }
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }, [initUpload, uploadChunk, calculateChunkHash])

  const getUploadStatus = useCallback(async (uploadId) => {
    try {
      const res = await api.get(`/files/chunked/status/${uploadId}`)
      return res.data
    } catch (error) {
      throw error
    }
  }, [])

  const cancelUpload = useCallback(async (uploadId) => {
    try {
      await api.delete(`/files/chunked/${uploadId}`)
      setUploads(prev => {
        const updated = { ...prev }
        delete updated[uploadId]
        return updated
      })
    } catch (error) {
      throw error
    }
  }, [])

  return {
    uploads,
    uploadFile,
    initUpload,
    uploadChunk,
    getUploadStatus,
    cancelUpload
  }
}
