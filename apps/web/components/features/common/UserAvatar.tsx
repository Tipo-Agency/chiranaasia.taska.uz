/**
 * UserAvatar - аватар пользователя
 * 
 * Зачем отдельно:
 * - Переиспользуется везде где показываются пользователи
 * - Единый стиль аватаров
 * - Поддержка разных размеров
 */
import React from 'react';
import { User } from '../../../types';
import { getDefaultAvatarForId } from '../../../constants/avatars';

interface UserAvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

const AVATAR_BG_COLORS = ['bg-blue-500', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-500'];

function getAvatarBgColor(name: string): string {
  const code = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_BG_COLORS[code % AVATAR_BG_COLORS.length];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  showName = false,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (!user?.name) return null;
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user.avatar || getDefaultAvatarForId(user.id);
  const showInitials = !avatarUrl || imgFailed;
  const bgColor = getAvatarBgColor(user.name);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full ${showInitials ? `${bgColor} text-white` : ''}
          flex items-center justify-center
          font-semibold shrink-0
        `}
      >
        {avatarUrl && !imgFailed ? (
          <img
            src={avatarUrl}
            alt={user.name}
            className="w-full h-full rounded-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          initials
        )}
      </div>
      {showName && (
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {user.name}
        </span>
      )}
    </div>
  );
};
