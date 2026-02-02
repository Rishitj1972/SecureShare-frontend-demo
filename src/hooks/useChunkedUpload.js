import { useState, useCallback } from 'react'
import api from '../api/axios'
import crypto from 'crypto-js'

export function useChunkedUpload() {
  const [uploads, setUploads] = useState({}) // uploadId -> upload state

  const calculateChunkHash = useCallback((chunk) => {
    return crypto.SHA256(chunk).toString()
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

  const uploadFile = useCallback(async (file, receiverId) => {
    try {
      // Initialize upload
      const { uploadId, chunkSize, totalChunks } = await initUpload(file, receiverId)

      // Upload chunks sequentially
      for (let i = 1; i <= totalChunks; i++) {
        const start = (i - 1) * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        const chunkArrayBuffer = await chunk.arrayBuffer()
        const chunkUint8 = new Uint8Array(chunkArrayBuffer)

        await uploadChunk(uploadId, i, chunkUint8, totalChunks)
      }

      // Complete upload
      const fileBuffer = await file.arrayBuffer()
      const fileUint8 = new Uint8Array(fileBuffer)
      const fileHash = calculateChunkHash(fileUint8)

      const completeRes = await api.post('/files/chunked/complete', {
        uploadId,
        fileHash
      })

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
