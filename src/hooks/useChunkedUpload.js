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
      
      // chunkData can be Blob or Uint8Array
      const blob = chunkData instanceof Blob ? chunkData : new Blob([chunkData])
      
      // Skip hash calculation for very large chunks (> 20MB) to avoid memory issues
      let chunkHash = null
      if (blob.size <= 20 * 1024 * 1024) {
        // For small chunks, calculate hash
        const arrayBuffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)
        chunkHash = calculateChunkHash(uint8)
      }

      formData.append('chunk', blob, `chunk_${chunkNumber}`)
      formData.append('uploadId', uploadId)
      formData.append('chunkNumber', chunkNumber)
      formData.append('totalChunks', totalChunks)
      if (chunkHash) {
        formData.append('chunkHash', chunkHash)
      }

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
      // Dynamic chunk sizing based on file size
      let dynamicChunkSize = 5 * 1024 * 1024; // Default 5MB for small files
      let parallelUploads = 2; // Default 2 parallel for small files

      const fileSizeInMB = file.size / (1024 * 1024);

      if (fileSizeInMB < 50) {
        // Small files: 5MB chunks, 2 parallel
        dynamicChunkSize = 5 * 1024 * 1024;
        parallelUploads = 2;
      } else if (fileSizeInMB < 500) {
        // Medium files: 25MB chunks, 4 parallel
        dynamicChunkSize = 25 * 1024 * 1024;
        parallelUploads = 4;
      } else {
        // Large files: 50MB chunks, 6 parallel
        dynamicChunkSize = 50 * 1024 * 1024;
        parallelUploads = 6;
      }

      // Initialize upload
      const { uploadId, chunkSize, totalChunks } = await initUpload(file, receiverId)

      let completedChunks = 0

      // Upload chunks in parallel with dynamic count
      for (let i = 1; i <= totalChunks; i += parallelUploads) {
        const batch = []
        for (let j = 0; j < parallelUploads && i + j <= totalChunks; j++) {
          const chunkNum = i + j
          const start = (chunkNum - 1) * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const chunk = file.slice(start, end)

          // Use Blob directly instead of arrayBuffer to avoid memory issues with large chunks
          batch.push(
            uploadChunk(uploadId, chunkNum, chunk, totalChunks)
              .then(() => {
                completedChunks++
                const progress = Math.round((completedChunks / totalChunks) * 95) // Reserve 95-100% for finalization
                if (onProgress) onProgress(progress)
              })
              .catch((err) => {
                console.error(`Failed to upload chunk ${chunkNum}:`, err)
                throw err
              })
          )
        }
        
        // Wait for all chunks in batch to complete
        await Promise.all(batch)
      }

      // Complete upload - backend will verify integrity from assembled file
      if (onProgress) onProgress(96) // Show 96% while completing
      const completeRes = await api.post('/files/chunked/complete', {
        uploadId,
        fileHash: null // Backend will calculate hash from assembled file
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
  }, [initUpload, uploadChunk])

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
