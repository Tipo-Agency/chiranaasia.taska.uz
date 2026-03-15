export const DEFAULT_AVATARS: string[] = [
  '/avatars/avatar01.png',
  '/avatars/avatar02.png',
  '/avatars/avatar03.png',
  '/avatars/avatar04.png',
  '/avatars/avatar05.png',
  '/avatars/avatar06.png',
  '/avatars/avatar07.png',
  '/avatars/avatar08.png',
  '/avatars/avatar09.png',
  '/avatars/avatar10.png',
  '/avatars/avatar11.png',
  '/avatars/avatar12.png',
  '/avatars/avatar13.png',
  '/avatars/avatar14.png',
  '/avatars/avatar15.png',
  '/avatars/avatar16.png',
  '/avatars/avatar17.png',
  '/avatars/avatar18.png',
  '/avatars/avatar19.png',
];

export function getDefaultAvatarForId(id: string | undefined | null): string {
  if (!id || DEFAULT_AVATARS.length === 0) return DEFAULT_AVATARS[0] || '';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const index = hash % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
}

export function getRandomDefaultAvatar(): string {
  if (!DEFAULT_AVATARS.length) return '';
  const index = Math.floor(Math.random() * DEFAULT_AVATARS.length);
  return DEFAULT_AVATARS[index];
}

