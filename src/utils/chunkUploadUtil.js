/**
 * Frontend Chunk Upload Utility
 * 
 * Strategy:
 * - Split selected file into 5MB chunks using Blob.slice
 * - Upload chunks sequentially
 * - Track upload progress
 * - Retry failed chunks
 */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

/**
 * Split file into chunks
 * @param {File} file - The file to split
 * @returns {Array<Blob>} Array of file chunks
 */
export const splitFileIntoChunks = (file) => {
  const chunks = [];
  let start = 0;

  // Split selected file into 5MB chunks using Blob.slice
  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    chunks.push(chunk);
    start = end;
  }

  return chunks;
};

/**
 * Upload chunks sequentially with retry logic
 * @param {string} fileId - Unique file identifier
 * @param {Array<Blob>} chunks - Array of file chunks
 * @param {number} totalChunks - Total number of chunks
 * @param {Function} onProgress - Progress callback
 * @param {Object} api - Axios instance
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Upload result
 */
export const uploadChunksSequentially = async (
  fileId,
  chunks,
  totalChunks,
  onProgress,
  api,
  maxRetries = 3
) => {
  const uploadResults = [];

  // Upload chunks sequentially to maintain order
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    let retryCount = 0;
    let uploaded = false;

    // Retry failed chunks
    while (retryCount < maxRetries && !uploaded) {
      try {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);
        formData.append('chunkIndex', chunkIndex);
        formData.append('totalChunks', totalChunks);

        const response = await api.post('/files/upload-chunk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Track upload progress
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        onProgress?.(progress, chunkIndex + 1, totalChunks);

        uploadResults.push({
          chunkIndex,
          status: 'success',
          data: response.data
        });

        uploaded = true;
      } catch (error) {
        retryCount++;

        if (retryCount >= maxRetries) {
          uploadResults.push({
            chunkIndex,
            status: 'failed',
            error: error.message,
            retries: retryCount
          });
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
  }

  // Check if all chunks uploaded successfully
  const failedChunks = uploadResults.filter(r => r.status === 'failed');

  return {
    fileId,
    totalChunks,
    uploadedChunks: uploadResults.filter(r => r.status === 'success').length,
    failedChunks: failedChunks.length,
    success: failedChunks.length === 0,
    results: uploadResults
  };
};

/**
 * Get current upload progress for a file
 * @param {string} fileId - File identifier
 * @param {Object} api - Axios instance
 * @returns {Promise<Object>} Upload status
 */
export const getUploadProgress = async (fileId, api) => {
  try {
    const response = await api.get(`/files/upload-status/${fileId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get upload progress: ${error.message}`);
  }
};

/**
 * Trigger merge of uploaded chunks
 * @param {string} fileId - File identifier
 * @param {string} fileName - Original file name
 * @param {string} receiverId - Receiver user ID
 * @param {Object} api - Axios instance
 * @returns {Promise<Object>} Merge result with final file metadata
 */
export const triggerChunkMerge = async (fileId, fileName, receiverId, api) => {
  try {
    const response = await api.post('/files/merge-chunks', {
      fileId,
      fileName,
      receiver: receiverId
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to merge chunks: ${error.message}`);
  }
};

/**
 * Cancel ongoing chunk upload
 * @param {string} fileId - File identifier
 * @param {Object} api - Axios instance
 * @returns {Promise<Object>} Cancel result
 */
export const cancelChunkUpload = async (fileId, api) => {
  try {
    const response = await api.delete(`/files/cancel-upload/${fileId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to cancel upload: ${error.message}`);
  }
};

export default {
  splitFileIntoChunks,
  uploadChunksSequentially,
  getUploadProgress,
  triggerChunkMerge,
  cancelChunkUpload,
  CHUNK_SIZE
};
