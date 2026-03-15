import React from 'react';
import { X, Download, ExternalLink, File, Image as ImageIcon } from 'lucide-react';
import { isImageFile, isPdfFile } from '../utils/fileUtils';

interface FilePreviewModalProps {
  url: string;
  name: string;
  type: string;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ url, name, type, onClose }) => {
  const isImage = isImageFile(url, type);
  const isPdf = isPdfFile(url, type);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {isImage ? <ImageIcon size={20} /> : <File size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 dark:text-white truncate">{name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{type}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              download={name}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors"
              title="Скачать"
            >
              <Download size={18} />
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors"
              title="Открыть в новой вкладке"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-[#1e1e1e] p-4 flex items-center justify-center">
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-[calc(90vh-120px)] object-contain rounded-lg shadow-lg"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              className="w-full h-full min-h-[600px] rounded-lg border border-gray-200 dark:border-[#333]"
              title={name}
            />
          ) : (
            <div className="text-center py-12">
              <div className="p-6 bg-gray-200 dark:bg-[#333] rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                <File size={48} className="text-gray-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Предпросмотр недоступен для этого типа файла</p>
              <a
                href={url}
                download={name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Скачать файл
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

