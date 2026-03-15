import React, { useState, useEffect, useRef } from 'react';
import { PartnerLogo, News, Case, Tag } from '../../types';
import { api } from '../../backend/api';
import { uploadFile } from '../../services/localStorageService';
import { Plus, Edit2, Trash2, Image as ImageIcon, Globe, Tag as TagIcon, FileText, Briefcase, X, Check, Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, Quote, Monitor, Smartphone, Eye } from 'lucide-react';
import { Card } from '../ui';

interface SitesViewProps {
  currentUser: any;
}

type TabType = 'logos' | 'news' | 'cases' | 'tags';

export const SitesView: React.FC<SitesViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('logos');
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  
  // Editing
  const [editingLogo, setEditingLogo] = useState<PartnerLogo | null>(null);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logos, newsData, casesData, tagsData] = await Promise.all([
        api.partnerLogos.getAll(),
        api.news.getAll(),
        api.cases.getAll(),
        api.tags.getAll(),
      ]);
      setPartnerLogos(logos);
      setNews(newsData);
      setCases(casesData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading sites data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLogo = async (logo: PartnerLogo) => {
    try {
      const updated = editingLogo 
        ? partnerLogos.map(l => l.id === logo.id ? logo : l)
        : [...partnerLogos, logo];
      await api.partnerLogos.updateAll(updated);
      setPartnerLogos(updated);
      setShowLogoModal(false);
      setEditingLogo(null);
    } catch (error) {
      console.error('Error saving logo:', error);
      alert('Ошибка при сохранении логотипа');
    }
  };

  const handleSaveNews = async (newsItem: News) => {
    try {
      const updated = editingNews
        ? news.map(n => n.id === newsItem.id ? newsItem : n)
        : [...news, newsItem];
      await api.news.updateAll(updated);
      setNews(updated);
      setShowNewsModal(false);
      setEditingNews(null);
    } catch (error) {
      console.error('Error saving news:', error);
      alert('Ошибка при сохранении новости');
    }
  };

  const handleSaveCase = async (caseItem: Case) => {
    try {
      const updated = editingCase
        ? cases.map(c => c.id === caseItem.id ? caseItem : c)
        : [...cases, caseItem];
      await api.cases.updateAll(updated);
      setCases(updated);
      setShowCaseModal(false);
      setEditingCase(null);
    } catch (error) {
      console.error('Error saving case:', error);
      alert('Ошибка при сохранении кейса');
    }
  };

  const handleSaveTag = async (tag: Tag) => {
    try {
      const updated = editingTag
        ? tags.map(t => t.id === tag.id ? tag : t)
        : [...tags, tag];
      await api.tags.updateAll(updated);
      setTags(updated);
      setShowTagModal(false);
      setEditingTag(null);
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Ошибка при сохранении тега');
    }
  };

  const handleDeleteLogo = async (id: string) => {
    if (!confirm('Удалить логотип?')) return;
    try {
      const updated = partnerLogos.map(l => l.id === id ? { ...l, isArchived: true } : l);
      await api.partnerLogos.updateAll(updated);
      setPartnerLogos(updated);
    } catch (error) {
      console.error('Error deleting logo:', error);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm('Удалить новость?')) return;
    try {
      const updated = news.map(n => n.id === id ? { ...n, isArchived: true } : n);
      await api.news.updateAll(updated);
      setNews(updated);
    } catch (error) {
      console.error('Error deleting news:', error);
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (!confirm('Удалить кейс?')) return;
    try {
      const updated = cases.map(c => c.id === id ? { ...c, isArchived: true } : c);
      await api.cases.updateAll(updated);
      setCases(updated);
    } catch (error) {
      console.error('Error deleting case:', error);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Удалить тег?')) return;
    try {
      const updated = tags.map(t => t.id === id ? { ...t, isArchived: true } : t);
      await api.tags.updateAll(updated);
      setTags(updated);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-white dark:bg-[#191919]">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Управление сайтами</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Контент для tipa.uz</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Globe size={16} />
            <span>tipa.uz</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'logos' as TabType, label: 'Логотипы партнеров', icon: ImageIcon },
            { id: 'news' as TabType, label: 'Новости', icon: FileText },
            { id: 'cases' as TabType, label: 'Кейсы', icon: Briefcase },
            { id: 'tags' as TabType, label: 'Теги', icon: TagIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-6">
        {activeTab === 'logos' && (
          <LogosTab
            logos={partnerLogos}
            onAdd={() => { setEditingLogo(null); setShowLogoModal(true); }}
            onEdit={(logo) => { setEditingLogo(logo); setShowLogoModal(true); }}
            onDelete={handleDeleteLogo}
            onSave={handleSaveLogo}
            showModal={showLogoModal}
            onClose={() => { setShowLogoModal(false); setEditingLogo(null); }}
            editingLogo={editingLogo}
          />
        )}
        {activeTab === 'news' && (
          <NewsTab
            news={news}
            tags={tags}
            onAdd={() => { setEditingNews(null); setShowNewsModal(true); }}
            onEdit={(newsItem) => { setEditingNews(newsItem); setShowNewsModal(true); }}
            onDelete={handleDeleteNews}
            onSave={handleSaveNews}
            showModal={showNewsModal}
            onClose={() => { setShowNewsModal(false); setEditingNews(null); }}
            editingNews={editingNews}
          />
        )}
        {activeTab === 'cases' && (
          <CasesTab
            cases={cases}
            tags={tags}
            onAdd={() => { setEditingCase(null); setShowCaseModal(true); }}
            onEdit={(caseItem) => { setEditingCase(caseItem); setShowCaseModal(true); }}
            onDelete={handleDeleteCase}
            onSave={handleSaveCase}
            showModal={showCaseModal}
            onClose={() => { setShowCaseModal(false); setEditingCase(null); }}
            editingCase={editingCase}
          />
        )}
        {activeTab === 'tags' && (
          <TagsTab
            tags={tags}
            onAdd={() => { setEditingTag(null); setShowTagModal(true); }}
            onEdit={(tag) => { setEditingTag(tag); setShowTagModal(true); }}
            onDelete={handleDeleteTag}
            onSave={handleSaveTag}
            showModal={showTagModal}
            onClose={() => { setShowTagModal(false); setEditingTag(null); }}
            editingTag={editingTag}
          />
        )}
        </div>
      </div>
    </div>
  );
};

// Компоненты для каждой вкладки
interface LogosTabProps {
  logos: PartnerLogo[];
  onAdd: () => void;
  onEdit: (logo: PartnerLogo) => void;
  onDelete: (id: string) => void;
  onSave: (logo: PartnerLogo) => void;
  showModal: boolean;
  onClose: () => void;
  editingLogo: PartnerLogo | null;
}

const LogosTab: React.FC<LogosTabProps> = ({ logos, onAdd, onEdit, onDelete, onSave, showModal, onClose, editingLogo }) => {
  const activeLogos = logos.filter(logo => !logo.isArchived);
  
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Добавить логотип
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {activeLogos.map(logo => (
          <Card key={logo.id} padding="md" className="relative group">
            <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-[#333] rounded">
              {logo.logoUrl ? (
                <img src={logo.logoUrl} alt={logo.name} className="max-h-24 max-w-full object-contain" />
              ) : (
                <ImageIcon size={32} className="text-gray-400" />
              )}
            </div>
            <div className="mt-2">
              <h3 className="font-medium text-sm">{logo.name}</h3>
              <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(logo)} className="text-blue-600 hover:text-blue-700">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => onDelete(logo.id)} className="text-red-600 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {showModal && (
        <LogoModal
          logo={editingLogo}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </div>
  );
};

// Модальное окно для логотипа
const LogoModal: React.FC<{ logo: PartnerLogo | null; onSave: (logo: PartnerLogo) => void; onClose: () => void }> = ({ logo, onSave, onClose }) => {
  const [name, setName] = useState(logo?.name || '');
  const [websiteUrl, setWebsiteUrl] = useState(logo?.websiteUrl || '');
  const [order, setOrder] = useState(logo?.order || 0);
  const [logoUrl, setLogoUrl] = useState(logo?.logoUrl || '');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(file, 'sites/partner-logos/');
      setLogoUrl(result.url);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Ошибка при загрузке изображения');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!name || !logoUrl) {
      alert('Заполните все обязательные поля');
      return;
    }
    onSave({
      id: logo?.id || `logo-${Date.now()}`,
      name,
      logoUrl,
      websiteUrl: websiteUrl || undefined,
      order,
      createdAt: logo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#252525] rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{logo ? 'Редактировать' : 'Добавить'} логотип</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название партнера *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Логотип *</label>
            {logoUrl && (
              <div className="mb-2">
                <img src={logoUrl} alt="Preview" className="max-h-32 object-contain" />
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full"
            />
            {uploading && <div className="text-sm text-gray-500 mt-1">Загрузка...</div>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ссылка на сайт</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Порядок</label>
            <input
              type="number"
              value={order}
              onChange={e => setOrder(parseInt(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">Отмена</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

// NewsTab компонент
interface NewsTabProps {
  news: News[];
  tags: Tag[];
  onAdd: () => void;
  onEdit: (news: News) => void;
  onDelete: (id: string) => void;
  onSave: (news: News) => void;
  showModal: boolean;
  onClose: () => void;
  editingNews: News | null;
}

const NewsTab: React.FC<NewsTabProps> = ({ news, tags, onAdd, onEdit, onDelete, onSave, showModal, onClose, editingNews }) => {
  const activeNews = news.filter(item => !item.isArchived);
  
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Добавить новость
        </button>
      </div>
      <div className="space-y-4">
        {activeNews.map(item => (
          <Card key={item.id} padding="md" className="relative group">
            <div className="flex gap-4">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.title} className="w-32 h-32 object-cover rounded" />
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{item.title}</h3>
                    {item.excerpt && <p className="text-sm text-gray-500 mt-1">{item.excerpt}</p>}
                    <div className="flex gap-2 mt-2">
                      {item.tags.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag ? (
                          <span key={tagId} className="text-xs px-2 py-1 bg-gray-100 dark:bg-[#333] rounded">
                            {tag.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className={item.published ? 'text-green-600' : 'text-gray-400'}>
                        {item.published ? 'Опубликовано' : 'Черновик'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-700">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {showModal && (
        <NewsModal
          news={editingNews}
          tags={tags}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </div>
  );
};

// CasesTab компонент
interface CasesTabProps {
  cases: Case[];
  tags: Tag[];
  onAdd: () => void;
  onEdit: (caseItem: Case) => void;
  onDelete: (id: string) => void;
  onSave: (caseItem: Case) => void;
  showModal: boolean;
  onClose: () => void;
  editingCase: Case | null;
}

const CasesTab: React.FC<CasesTabProps> = ({ cases, tags, onAdd, onEdit, onDelete, onSave, showModal, onClose, editingCase }) => {
  const activeCases = cases.filter(caseItem => !caseItem.isArchived);
  
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Добавить кейс
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeCases.map(caseItem => (
          <Card key={caseItem.id} padding="md" className="relative group">
            {caseItem.imageUrl && (
              <img src={caseItem.imageUrl} alt={caseItem.title} className="w-full h-48 object-cover rounded mb-3" />
            )}
            <h3 className="font-bold text-lg mb-2">{caseItem.title}</h3>
            {caseItem.clientName && <p className="text-sm text-gray-500 mb-2">Клиент: {caseItem.clientName}</p>}
            <div className="flex gap-2 mb-2">
              {caseItem.websiteUrl && (
                <a href={caseItem.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                  🌐 Сайт
                </a>
              )}
              {caseItem.instagramUrl && (
                <a href={caseItem.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline">
                  📷 Instagram
                </a>
              )}
            </div>
            <div className="flex gap-2 mb-2">
              {caseItem.tags.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                return tag ? (
                  <span key={tagId} className="text-xs px-2 py-1 bg-gray-100 dark:bg-[#333] rounded">
                    {tag.name}
                  </span>
                ) : null;
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={caseItem.published ? 'text-green-600 text-xs' : 'text-gray-400 text-xs'}>
                {caseItem.published ? 'Опубликовано' : 'Черновик'}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(caseItem)} className="text-blue-600 hover:text-blue-700">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => onDelete(caseItem.id)} className="text-red-600 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {showModal && (
        <CaseModal
          caseItem={editingCase}
          tags={tags}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </div>
  );
};

// TagsTab компонент
interface TagsTabProps {
  tags: Tag[];
  onAdd: () => void;
  onEdit: (tag: Tag) => void;
  onDelete: (id: string) => void;
  onSave: (tag: Tag) => void;
  showModal: boolean;
  onClose: () => void;
  editingTag: Tag | null;
}

const TagsTab: React.FC<TagsTabProps> = ({ tags, onAdd, onEdit, onDelete, onSave, showModal, onClose, editingTag }) => {
  const activeTags = tags.filter(tag => !tag.isArchived);
  
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} />
          Добавить тег
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {activeTags.map(tag => (
          <Card key={tag.id} padding="md" className="relative group">
            <div className="flex items-center gap-2">
              {tag.color && (
                <div className="w-4 h-4 rounded" style={{ backgroundColor: tag.color }} />
              )}
              <span className="font-medium">{tag.name}</span>
            </div>
            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(tag)} className="text-blue-600 hover:text-blue-700">
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(tag.id)} className="text-red-600 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>
      {showModal && (
        <TagModal
          tag={editingTag}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </div>
  );
};

// NewsModal - модальное окно для новости с редактором
const NewsModal: React.FC<{ news: News | null; tags: Tag[]; onSave: (news: News) => void; onClose: () => void }> = ({ news, tags, onSave, onClose }) => {
  const [title, setTitle] = useState(news?.title || '');
  const [excerpt, setExcerpt] = useState(news?.excerpt || '');
  const [content, setContent] = useState(news?.content || '');
  const [imageUrl, setImageUrl] = useState(news?.imageUrl || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(news?.tags || []);
  const [published, setPublished] = useState(news?.published || false);
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && news) {
      editorRef.current.innerHTML = news.content || '<p>Начните писать здесь...</p>';
    }
  }, [news?.id]);

  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(file, 'sites/news/');
      setImageUrl(result.url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Ошибка при загрузке изображения');
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (!title) {
      alert('Заполните заголовок');
      return;
    }
    const finalContent = editorRef.current?.innerHTML || content || '';
    if (!finalContent || finalContent === '<p>Начните писать здесь...</p>' || finalContent.trim() === '') {
      alert('Заполните содержание');
      return;
    }
    onSave({
      id: news?.id || `news-${Date.now()}`,
      title,
      content: finalContent,
      excerpt,
      imageUrl: imageUrl || undefined,
      tags: selectedTags,
      published,
      publishedAt: published && !news?.publishedAt ? new Date().toISOString() : news?.publishedAt,
      createdAt: news?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#252525] rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{news ? 'Редактировать' : 'Добавить'} новость</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Заголовок *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Аннотация</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2"
              placeholder="Аннотация для превью"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Главное изображение</label>
            {imageUrl && (
              <div className="mb-2">
                <img src={imageUrl} alt="Preview" className="max-h-48 object-contain rounded" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full"
            />
            {uploading && <div className="text-sm text-gray-500 mt-1">Загрузка...</div>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Содержание *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    showPreview ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <Eye size={14} /> {showPreview ? 'Скрыть' : 'Показать'} предпросмотр
                </button>
                {showPreview && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('desktop')}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                        previewMode === 'desktop' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Monitor size={14} /> Десктоп
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('mobile')}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                        previewMode === 'mobile' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Smartphone size={14} /> Мобилка
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="bg-gray-100 dark:bg-gray-800 border-b px-2 py-1 flex items-center gap-1 flex-wrap">
                <ToolbarBtn icon={<Heading1 size={16}/>} onClick={() => execCmd('formatBlock', 'H1')} title="Заголовок 1"/>
                <ToolbarBtn icon={<Heading2 size={16}/>} onClick={() => execCmd('formatBlock', 'H2')} title="Заголовок 2"/>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <ToolbarBtn icon={<Bold size={16}/>} onClick={() => execCmd('bold')} title="Жирный"/>
                <ToolbarBtn icon={<Italic size={16}/>} onClick={() => execCmd('italic')} title="Курсив"/>
                <ToolbarBtn icon={<Underline size={16}/>} onClick={() => execCmd('underline')} title="Подчеркнутый"/>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <ToolbarBtn icon={<List size={16}/>} onClick={() => execCmd('insertUnorderedList')} title="Список"/>
                <ToolbarBtn icon={<ListOrdered size={16}/>} onClick={() => execCmd('insertOrderedList')} title="Нумерованный список"/>
                <ToolbarBtn icon={<Quote size={16}/>} onClick={() => execCmd('formatBlock', 'blockquote')} title="Цитата"/>
              </div>
              {/* Editor/Preview */}
              <div className="flex">
                <div className={`${showPreview ? 'w-1/2' : 'w-full'} border-r`}>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning={true}
                    onInput={(e) => {
                      if (editorRef.current) {
                        setContent(editorRef.current.innerHTML);
                      }
                    }}
                    className="min-h-[400px] p-4 outline-none text-gray-800 dark:text-gray-200"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                </div>
                {showPreview && previewMode === 'desktop' && (
                  <div className="w-1/2 p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-[400px]">
                    <div className="max-w-4xl mx-auto bg-white dark:bg-[#1a1a1a] p-6 rounded shadow">
                      {imageUrl && <img src={imageUrl} alt={title} className="w-full h-auto mb-4 rounded" />}
                      <h1 className="text-3xl font-bold mb-4">{title || 'Заголовок'}</h1>
                      {excerpt && <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{excerpt}</p>}
                      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content || '<p>Контент...</p>' }} />
                    </div>
                  </div>
                )}
                {showPreview && previewMode === 'mobile' && (
                  <div className="w-1/2 p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-[400px]">
                    <div className="max-w-sm mx-auto bg-white dark:bg-[#1a1a1a] p-4 rounded shadow">
                      {imageUrl && <img src={imageUrl} alt={title} className="w-full h-auto mb-3 rounded" />}
                      <h1 className="text-xl font-bold mb-3">{title || 'Заголовок'}</h1>
                      {excerpt && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{excerpt}</p>}
                      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content || '<p>Контент...</p>' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Теги</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded text-sm border transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-[#333] border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={e => setPublished(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="published" className="text-sm">Опубликовать</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">Отмена</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

// ToolbarBtn component
const ToolbarBtn: React.FC<{icon: React.ReactNode, onClick: () => void, title: string}> = ({ icon, onClick, title }) => (
  <button
    onClick={onClick}
    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
    title={title}
    type="button"
  >
    {icon}
  </button>
);

// CaseModal - модальное окно для кейса
const CaseModal: React.FC<{ caseItem: Case | null; tags: Tag[]; onSave: (caseItem: Case) => void; onClose: () => void }> = ({ caseItem, tags, onSave, onClose }) => {
  const [title, setTitle] = useState(caseItem?.title || '');
  const [excerpt, setExcerpt] = useState(caseItem?.excerpt || '');
  const [description, setDescription] = useState(caseItem?.description || '');
  const [imageUrl, setImageUrl] = useState(caseItem?.imageUrl || '');
  const [clientName, setClientName] = useState(caseItem?.clientName || '');
  const [websiteUrl, setWebsiteUrl] = useState(caseItem?.websiteUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(caseItem?.instagramUrl || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(caseItem?.tags || []);
  const [order, setOrder] = useState(caseItem?.order || 0);
  const [published, setPublished] = useState(caseItem?.published || false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTitle(caseItem?.title || '');
    setExcerpt(caseItem?.excerpt || '');
    setDescription(caseItem?.description || '');
    setImageUrl(caseItem?.imageUrl || '');
    setClientName(caseItem?.clientName || '');
    setWebsiteUrl(caseItem?.websiteUrl || '');
    setInstagramUrl(caseItem?.instagramUrl || '');
    setSelectedTags(caseItem?.tags || []);
    setOrder(caseItem?.order || 0);
    setPublished(caseItem?.published || false);
  }, [caseItem]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(file, 'sites/cases/');
      setImageUrl(result.url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Ошибка при загрузке изображения');
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (!title || !description) {
      alert('Заполните название и описание');
      return;
    }
    onSave({
      id: caseItem?.id || `case-${Date.now()}`,
      title,
      excerpt: excerpt || undefined,
      description,
      imageUrl: imageUrl || undefined,
      clientName: clientName || undefined,
      websiteUrl: websiteUrl || undefined,
      instagramUrl: instagramUrl || undefined,
      tags: selectedTags,
      order,
      published,
      createdAt: caseItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#252525] rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{caseItem ? 'Редактировать' : 'Добавить'} кейс</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Аннотация</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2"
              placeholder="Краткое описание кейса для превью"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Клиент (необязательно)</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Название клиента"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ссылка на сайт</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ссылка на Instagram</label>
              <input
                type="url"
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="https://instagram.com/username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Изображение</label>
            {imageUrl && (
              <div className="mb-2">
                <img src={imageUrl} alt="Preview" className="max-h-48 object-contain rounded" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full"
            />
            {uploading && <div className="text-sm text-gray-500 mt-1">Загрузка...</div>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Описание *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={10}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="HTML контент или обычный текст"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Теги</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded text-sm border transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-[#333] border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Порядок</label>
              <input
                type="number"
                value={order}
                onChange={e => setOrder(parseInt(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="casePublished"
                checked={published}
                onChange={e => setPublished(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="casePublished" className="text-sm">Опубликовать</label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">Отмена</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

// TagModal - модальное окно для тега
const TagModal: React.FC<{ tag: Tag | null; onSave: (tag: Tag) => void; onClose: () => void }> = ({ tag, onSave, onClose }) => {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || '#3B82F6');

  const handleSubmit = () => {
    if (!name) {
      alert('Введите название тега');
      return;
    }
    onSave({
      id: tag?.id || `tag-${Date.now()}`,
      name,
      color,
      createdAt: tag?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#252525] rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{tag ? 'Редактировать' : 'Добавить'} тег</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Цвет</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-16 h-10 border rounded"
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="flex-1 border rounded px-3 py-2 font-mono text-sm"
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded">Отмена</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
        </div>
      </div>
    </div>
  );
};
