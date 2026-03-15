import React, { useState, useEffect, useRef } from 'react';
import { Doc } from '../types';
import { ArrowLeft, Save, Download, Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, Quote } from 'lucide-react';

interface DocEditorProps {
  doc: Doc;
  onSave: (id: string, content: string, title: string) => void;
  onBack: () => void;
}

const DocEditor: React.FC<DocEditorProps> = ({ doc, onSave, onBack }) => {
  const [title, setTitle] = useState(doc.title);
  const [isSaved, setIsSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initialContentRef = useRef<string>('');
  const initialTitleRef = useRef<string>('');

  useEffect(() => {
    // Initialize content
    if (editorRef.current) {
        const content = doc.content || '<p>Начните писать здесь...</p>';
        editorRef.current.innerHTML = content;
        initialContentRef.current = content;
        initialTitleRef.current = doc.title;
    }
  }, [doc.id]);

  useEffect(() => {
    if (isSaved) {
        const timer = setTimeout(() => setIsSaved(false), 2000);
        return () => clearTimeout(timer);
    }
  }, [isSaved]);

  const hasChanges = (): boolean => {
    if (!editorRef.current) return false;
    return editorRef.current.innerHTML !== initialContentRef.current || title !== initialTitleRef.current;
  };

  const handleBack = () => {
    if (hasChanges()) {
      if (window.confirm('Есть несохраненные изменения. Сохранить перед выходом?')) {
        handleSave();
        onBack();
      } else {
        onBack();
      }
    } else {
      onBack();
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        onSave(doc.id, content, title);
        setIsSaved(true);
        initialContentRef.current = content;
        initialTitleRef.current = title;
        // Закрываем документ после сохранения
        setTimeout(() => {
          onBack();
        }, 300);
    }
  };

  const handleDownload = () => {
    if (!editorRef.current) return;
    
    // Simple HTML to Text for now, or just download the HTML
    const content = `
    <html>
        <head><title>${title}</title></head>
        <body>
            <h1>${title}</h1>
            ${editorRef.current.innerHTML}
        </body>
    </html>`;
    
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `${title}.html`;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] dark:bg-[#121212] overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] px-4 py-2 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
            <button 
                onClick={handleBack}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-full transition-colors"
                title="Назад"
            >
                <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="font-bold text-lg text-gray-800 dark:text-white border-none p-0 focus:ring-0 placeholder-gray-300 dark:placeholder-gray-500 bg-transparent w-64 lg:w-96"
                    placeholder="Название документа..."
                />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    {isSaved ? 'Сохранено в облако' : 'Несохраненные изменения'}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md text-sm transition-colors"
            >
                <Download size={16} /> <span className="hidden sm:inline">Экспорт</span>
            </button>
            <button 
                onClick={handleSave}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all shadow-sm ${isSaved ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
                <Save size={16} /> {isSaved ? 'Сохранено' : 'Сохранить'}
            </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] px-4 py-2 flex items-center justify-center gap-1 shrink-0 shadow-sm z-10 overflow-x-auto">
         <ToolbarBtn icon={<Heading1 size={18}/>} onClick={() => execCmd('formatBlock', 'H1')} title="Заголовок 1"/>
         <ToolbarBtn icon={<Heading2 size={18}/>} onClick={() => execCmd('formatBlock', 'H2')} title="Заголовок 2"/>
         <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-2"></div>
         <ToolbarBtn icon={<Bold size={18}/>} onClick={() => execCmd('bold')} title="Жирный"/>
         <ToolbarBtn icon={<Italic size={18}/>} onClick={() => execCmd('italic')} title="Курсив"/>
         <ToolbarBtn icon={<Underline size={18}/>} onClick={() => execCmd('underline')} title="Подчеркнутый"/>
         <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-2"></div>
         <ToolbarBtn icon={<List size={18}/>} onClick={() => execCmd('insertUnorderedList')} title="Список"/>
         <ToolbarBtn icon={<ListOrdered size={18}/>} onClick={() => execCmd('insertOrderedList')} title="Нумерованный список"/>
         <ToolbarBtn icon={<Quote size={18}/>} onClick={() => execCmd('formatBlock', 'blockquote')} title="Цитата"/>
      </div>

      {/* Editor Area (A4 Paper Style) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 cursor-text" onClick={() => editorRef.current?.focus()}>
         <div className="max-w-[816px] mx-auto min-h-[1056px] bg-white dark:bg-[#1a1a1a] shadow-lg rounded-sm p-8 sm:p-16 mb-8 transition-shadow hover:shadow-xl">
            <div 
                ref={editorRef}
                contentEditable
                className="editor-content w-full h-full outline-none text-gray-800 dark:text-gray-200"
                suppressContentEditableWarning={true}
            />
         </div>
      </div>
    </div>
  );
};

const ToolbarBtn: React.FC<{icon: React.ReactNode, onClick: () => void, title: string}> = ({icon, onClick, title}) => (
    <button 
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333] rounded transition-colors"
        title={title}
    >
        {icon}
    </button>
);

export default DocEditor;