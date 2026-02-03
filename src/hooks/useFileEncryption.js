import { useCallback, useRef } from 'react'
import { 
  generateAESKey, 
  encryptFile, 
  encryptAESKey, 
  calculateFileHash 
} from '../utils/crypto'
import api from '../api/axios'

/**
 * Hook for encrypting files before upload
 * Zero-knowledge encryption workflow
 */
export function useFileEncryption() {
  const encryptionCache = useRef({}) // Store encryption data temporarily

  /**
   * Encrypt a file before upload
   * @param {File} file - Original file to encrypt
   * @param {string} receiverPublicKey - Receiver's RSA public key
   * @returns {Object} Encryption data needed for upload
   */
  const encryptFileForUpload = useCallback(async (file, receiverPublicKey) => {
    try {
      // Step 1: Generate random AES key
      const aesKey = await generateAESKey()

      // Step 2: Calculate SHA-256 hash of original file (for integrity)
      const fileHash = await calculateFileHash(file)

      // Step 3: Encrypt file with AES
      const { encryptedData, iv } = await encryptFile(file, aesKey)

      // Step 4: Encrypt AES key with receiver's RSA public key
      const encryptedAesKey = await encryptAESKey(aesKey, receiverPublicKey)

      // Create encrypted file blob with original file metadata
      const encryptedFile = new File(
        [encryptedData], 
        file.name,
        { type: file.type }
      )

      // Cache encryption data
      const encryptionId = `${Date.now()}_${Math.random()}`
      encryptionCache.current[encryptionId] = {
        encryptedAesKey,
        iv,
        fileHash,
        originalSize: file.size,
        originalName: file.name,
        originalType: file.type
      }

      return {
        encryptedFile,
        encryptionId,
        encryptedAesKey,
        iv,
        fileHash
      }
    } catch (error) {
      console.error('File encryption failed:', error)
      throw error
    }
  }, [])

  /**
   * Get cached encryption data
   */
  const getEncryptionData = useCallback((encryptionId) => {
    return encryptionCache.current[encryptionId]
  }, [])

  /**
   * Clear encryption cache
   */
  const clearEncryptionData = useCallback((encryptionId) => {
    delete encryptionCache.current[encryptionId]
  }, [])

  /**
   * Fetch receiver's public key
   */
  const getReceiverPublicKey = useCallback(async (receiverId) => {
    try {
      const response = await api.get(`/users/${receiverId}`)
      return response.data.rsaPublicKey
    } catch (error) {
      throw new Error('Failed to fetch receiver public key')
    }
  }, [])

  return {
    encryptFileForUpload,
    getEncryptionData,
    clearEncryptionData,
    getReceiverPublicKey
  }
}
