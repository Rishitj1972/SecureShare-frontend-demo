import React, { memo } from 'react'
import { Menu } from '@headlessui/react'
import { EllipsisVerticalIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline'

function FileIcon({ mime }) {
  if (!mime) return <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-lg">?</div>
  if (mime.startsWith('image/')) return <div className="w-10 h-10 bg-gradient-to-br from-pink-300 to-yellow-300 rounded flex items-center justify-center text-lg">🖼️</div>
  if (mime.startsWith('video/')) return <div className="w-10 h-10 bg-gradient-to-br from-indigo-300 to-purple-300 rounded flex items-center justify-center text-lg">🎞️</div>
  if (mime.includes('pdf')) return <div className="w-10 h-10 bg-red-200 rounded flex items-center justify-center text-lg">📄</div>
  if (mime.startsWith('audio/')) return <div className="w-10 h-10 bg-blue-200 rounded flex items-center justify-center text-lg">🎵</div>
  if (mime.includes('word') || mime.includes('document')) return <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center text-lg">📝</div>
  if (mime.includes('sheet') || mime.includes('excel')) return <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center text-lg">📊</div>
  return <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-lg">📎</div>
}

const FileCard = memo(({ file, onDownload, onDelete, downloading }) => {
  const name = file.originalFileName || file.originalName || 'file'
  const sizeKB = file.fileSize ? `${Math.round(file.fileSize / 1024)} KB` : 'Unknown size'
  const time = file.createdAt ? new Date(file.createdAt).toLocaleString() : ''

  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <FileIcon mime={file.mimeType} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{name}</div>
            <div className="text-sm text-gray-500">
              {sizeKB}
              {time && <span className="ml-2 text-xs text-gray-400">• {time}</span>}
            </div>
            {file.isDownloaded && <div className="text-xs text-green-600 mt-1">✓ Downloaded</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onDownload(file._id)}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500 text-white rounded text-sm hover:bg-sky-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title={downloading ? 'Downloading...' : 'Download file'}
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            {onDelete && (
              <Menu as="div" className="relative">
                <Menu.Button className="p-2 rounded hover:bg-gray-100 transition-colors" title="More options">
                  <EllipsisVerticalIcon className="w-5 h-5 text-gray-600" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-lg">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this file? This cannot be undone.')) {
                            onDelete(file._id)
                          }
                        }}
                        className={`w-full text-left px-4 py-2 text-red-600 text-sm flex items-center gap-2 ${
                          active ? 'bg-red-50' : ''
                        }`}
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            )}
          </div>
        </div>
        {file.progress != null && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
              <div style={{ width: `${file.progress}%` }} className="h-2 bg-sky-500 transition-all" />
            </div>
            <div className="text-xs text-gray-500 mt-1">{file.progress}%</div>
          </div>
        )}
      </div>
    </div>
  )
})

FileCard.displayName = 'FileCard'

export default FileCard
      </div>
    </div>
  )
}  
