/**
 * SafeArea - компонент для безопасных отступов на мобильных устройствах
 * 
 * Учитывает системные элементы:
 * - iOS: notch, home indicator
 * - Android: status bar, navigation bar
 * - Telegram Web App: header, bottom bar
 * 
 * Использование:
 * <SafeArea top bottom>
 *   <YourContent />
 * </SafeArea>
 */
import React from 'react';

interface SafeAreaProps {
  children: React.ReactNode;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  className?: string;
}

export const SafeArea: React.FC<SafeAreaProps> = ({
  children,
  top = false,
  bottom = false,
  left = false,
  right = false,
  className = '',
}) => {
  const styles: React.CSSProperties = {};
  
  if (top) {
    styles.paddingTop = 'env(safe-area-inset-top, 0px)';
  }
  if (bottom) {
    styles.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  }
  if (left) {
    styles.paddingLeft = 'env(safe-area-inset-left, 0px)';
  }
  if (right) {
    styles.paddingRight = 'env(safe-area-inset-right, 0px)';
  }

  return (
    <div style={styles} className={className}>
      {children}
    </div>
  );
};

/**
 * SafeAreaTop - обертка для верхней части экрана
 */
export const SafeAreaTop: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => (
  <SafeArea top className={className}>
    {children}
  </SafeArea>
);

/**
 * SafeAreaBottom - обертка для нижней части экрана
 */
export const SafeAreaBottom: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => (
  <SafeArea bottom className={className}>
    {children}
  </SafeArea>
);

/**
 * SafeAreaAll - обертка для всего экрана
 */
export const SafeAreaAll: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => (
  <SafeArea top bottom left right className={className}>
    {children}
  </SafeArea>
);
