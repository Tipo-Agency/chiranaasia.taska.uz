
import React, { useState } from 'react';
import { User, Role } from '../types';
import { X, User as UserIcon, Mail, Phone, Send, LogOut, Settings, AtSign } from 'lucide-react';
import { getDefaultAvatarForId } from '../constants/avatars';

interface ProfileModalProps {
  user: User;
  onSave: (updatedUser: User) => void;
  onClose: () => void;
  onOpenSettings: (tab: string) => void;
  onLogout: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onSave, onClose, onOpenSettings, onLogout }) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525]">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Профиль сотрудника
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333] transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
             <img 
                src={user.avatar || getDefaultAvatarForId(user.id)} 
                className="w-24 h-24 rounded-full border-4 border-gray-50 dark:border-[#444] shadow-sm object-cover object-center mb-3" 
                alt="avatar"
             />
             <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
             <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full mt-1 border border-blue-100 dark:border-blue-800">
                 {user.role === Role.ADMIN ? 'Администратор' : 'Сотрудник'}
             </span>
          </div>

          <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm p-3 bg-gray-50 dark:bg-[#303030] rounded-lg">
                  <AtSign size={16} className="text-gray-400"/>
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{user.login || 'Нет логина'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm p-3 bg-gray-50 dark:bg-[#303030] rounded-lg">
                  <Mail size={16} className="text-gray-400"/>
                  <span className="text-gray-700 dark:text-gray-300">{user.email || 'Нет email'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm p-3 bg-gray-50 dark:bg-[#303030] rounded-lg">
                  <Phone size={16} className="text-gray-400"/>
                  <span className="text-gray-700 dark:text-gray-300">{user.phone || 'Нет телефона'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm p-3 bg-gray-50 dark:bg-[#303030] rounded-lg">
                  <Send size={16} className="text-gray-400"/>
                  <span className="text-gray-700 dark:text-gray-300">{user.telegram || 'Нет telegram'}</span>
              </div>
          </div>

          <div className="pt-6 mt-2 flex flex-col gap-3">
             <button 
                onClick={() => { onClose(); onOpenSettings('profile'); }} 
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2"
             >
                 <Settings size={16}/> Редактировать профиль
             </button>
             <button 
                onClick={onLogout} 
                className="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
             >
                 <LogOut size={16}/> Выйти из системы
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
