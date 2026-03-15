import { Deal, Comment, SalesFunnel } from '../types';

interface InstagramConversation {
  id: string;
  participants: { id: string; username?: string; name?: string }[];
  updated_time: string;
}

interface InstagramMessage {
  id: string;
  from: { id: string; username?: string; name?: string };
  to: { id: string };
  message?: string;
  created_time: string;
  attachments?: { image_url?: string; video_url?: string }[];
}

interface InstagramUser {
  id: string;
  username?: string;
  name?: string;
}

/**
 * Сервис для работы с Instagram через Meta Graph API
 */
export const instagramService = {
  /**
   * Получить список conversations (чатов) для Instagram аккаунта
   */
  async getConversations(
    accountId: string,
    accessToken: string,
    since?: string
  ): Promise<InstagramConversation[]> {
    try {
      const sinceParam = since ? `&since=${since}` : '';
      const url = `https://graph.facebook.com/v18.0/${accountId}/conversations?fields=id,participants,updated_time${sinceParam}&access_token=${accessToken}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram conversations:', error);
      throw error;
    }
  },

  /**
   * Получить сообщения из conversation
   */
  async getMessages(
    conversationId: string,
    accessToken: string
  ): Promise<InstagramMessage[]> {
    try {
      const url = `https://graph.facebook.com/v18.0/${conversationId}/messages?fields=id,from,to,message,created_time,attachments&access_token=${accessToken}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram messages:', error);
      throw error;
    }
  },

  /**
   * Отправить сообщение в Instagram
   */
  async sendMessage(
    accountId: string,
    userId: string,
    message: string,
    accessToken: string
  ): Promise<{ id: string }> {
    try {
      const url = `https://graph.facebook.com/v18.0/${accountId}/messages`;
      
      const formData = new FormData();
      formData.append('recipient', JSON.stringify({ id: userId }));
      formData.append('message', JSON.stringify({ text: message }));
      formData.append('access_token', accessToken);
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending Instagram message:', error);
      throw error;
    }
  },

  /**
   * Получить информацию о пользователе Instagram
   */
  async getUserInfo(
    userId: string,
    accessToken: string
  ): Promise<InstagramUser | null> {
    try {
      const url = `https://graph.facebook.com/v18.0/${userId}?fields=id,username,name&access_token=${accessToken}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        // Если пользователь не найден, возвращаем null
        if (response.status === 404) return null;
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching Instagram user info:', error);
      return null;
    }
  },

  /**
   * Обновить долгосрочный токен доступа
   */
  async refreshAccessToken(
    currentToken: string,
    appId: string,
    appSecret: string
  ): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    try {
      const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error refreshing Instagram access token:', error);
      throw error;
    }
  },

  /**
   * Получить Instagram Business Account ID из Facebook Page ID
   */
  async getInstagramAccountId(
    pageId: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const url = `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Instagram API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.instagram_business_account?.id || null;
    } catch (error) {
      console.error('Error fetching Instagram account ID:', error);
      return null;
    }
  },

  /**
   * Преобразовать Instagram conversation в Deal
   */
  convertConversationToDeal(
    conversation: InstagramConversation,
    messages: InstagramMessage[],
    funnelId: string,
    firstStageId: string,
    assigneeId: string
  ): Deal {
    const firstMessage = messages[0];
    const participant = conversation.participants.find(p => p.id !== conversation.id.split('_')[0]);
    const username = participant?.username || participant?.name || 'unknown';
    const contactName = participant?.name || username;
    
    const comments: Comment[] = messages.map(msg => ({
      id: `cm-${msg.id}`,
      text: msg.message || '[Вложение]',
      authorId: msg.from.id,
      createdAt: msg.created_time,
      type: 'telegram_in' as const, // Используем тот же тип для Instagram сообщений
    }));

    return {
      id: `deal-ig-${conversation.id}`,
      title: `Лид из Instagram: ${username}`,
      contactName: contactName,
      amount: 0,
      currency: 'UZS',
      stage: firstStageId,
      funnelId: funnelId,
      source: 'instagram',
      telegramChatId: conversation.id, // Используем conversation.id для идентификации чата
      telegramUsername: username.startsWith('@') ? username : `@${username}`,
      assigneeId: assigneeId,
      createdAt: firstMessage?.created_time || new Date().toISOString(),
      notes: firstMessage?.message || '',
      comments: comments,
    };
  },
};

