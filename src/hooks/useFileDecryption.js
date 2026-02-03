import { useCallback } from 'react'
import { decryptAESKey, decryptFile, calculateFileHash } from '../utils/crypto'
import { getPrivateKey } from '../utils/crypto'
import api from '../api/axios'

/**
 * Hook for decrypting downloaded files
 */
export function useFileDecryption() {
  
  /**
   * Download and decrypt a file
   * @param {string} fileId - File ID to download
   * @param {string} userId - Current user ID
   * @param {Object} fileMeta - File metadata (contains encryption data)
   * @returns {Blob} Decrypted file blob
   */
  const downloadAndDecrypt = useCallback(async (fileId, userId, fileMeta) => {
    try {
      // Step 1: Download encrypted file
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const downloadUrl = `${api.defaults.baseURL}/files/download/${fileId}?token=${encodeURIComponent(token)}`
      
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error('Download failed')
      }

      const encryptedBlob = await response.blob()

      // If file is not encrypted, return as-is
      if (!fileMeta.isEncrypted) {
        return encryptedBlob
      }

      // Step 2: Get private key
      const privateKey = getPrivateKey(userId)
      if (!privateKey) {
        throw new Error('Private key not found. Cannot decrypt file.')
      }

      // Step 3: Decrypt AES key
      const aesKey = await decryptAESKey(fileMeta.encryptedAesKey, privateKey)

      // Step 4: Decrypt file
      const decryptedBlob = await decryptFile(encryptedBlob, aesKey, fileMeta.iv)

      // Step 5: Verify integrity
      if (fileMeta.fileHash) {
        const calculatedHash = await calculateFileHash(decryptedBlob)
        
        if (calculatedHash !== fileMeta.fileHash) {
          throw new Error('File integrity check failed! File may be corrupted or tampered.')
        }
      }

      return decryptedBlob
    } catch (error) {
      console.error('Decryption failed:', error)
      throw error
    }
  }, [])

  return {
    downloadAndDecrypt
  }
}
