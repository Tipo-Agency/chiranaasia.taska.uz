import { api } from '../backend/api';
import { Deal, SalesFunnel } from '../types';
import { instagramService } from './instagramService';

interface SyncResult {
  newDeals: Deal[];
  updatedDeals: Deal[];
  errors: string[];
}

/**
 * Сервис для синхронизации лидов из различных источников (Instagram, Telegram и т.д.)
 */
export const leadSyncService = {
  /**
   * Синхронизация лидов из Instagram для конкретной воронки
   */
  async syncInstagramLeads(funnelId: string): Promise<SyncResult> {
    const result: SyncResult = {
      newDeals: [],
      updatedDeals: [],
      errors: [],
    };

    try {
      const funnels = api.funnels.getAll();
      const funnel = funnels.find(f => f.id === funnelId);
      
      if (!funnel || !funnel.sources?.instagram?.enabled) {
        return result;
      }

      const config = funnel.sources.instagram;
      if (!config.instagramAccountId || !config.accessToken) {
        result.errors.push('Instagram не настроен: отсутствуют Account ID или Access Token');
        return result;
      }

      // Получаем все существующие сделки для этой воронки
      const existingDeals = api.deals.getAll().filter(d => d.funnelId === funnelId);
      
      // Получаем conversations (чаты)
      const lastSyncAt = config.lastSyncAt;
      const conversations = await instagramService.getConversations(
        config.instagramAccountId,
        config.accessToken,
        lastSyncAt
      );

      // Обрабатываем каждый conversation
      for (const conversation of conversations) {
        try {
          // Проверяем, существует ли уже сделка для этого conversation
          const existingDeal = existingDeals.find(d => d.telegramChatId === conversation.id);
          
          // Получаем сообщения из conversation
          const messages = await instagramService.getMessages(conversation.id, config.accessToken!);
          
          if (messages.length === 0) continue;

          // Если сделка уже существует, обновляем комментарии
          if (existingDeal) {
            const existingCommentIds = (existingDeal.comments || []).map(c => c.id);
            const newMessages = messages.filter(msg => 
              !existingCommentIds.includes(`cm-${msg.id}`)
            );

            if (newMessages.length > 0) {
              const newComments = newMessages.map(msg => ({
                id: `cm-${msg.id}`,
                text: msg.message || '[Вложение]',
                authorId: msg.from.id,
                createdAt: msg.created_time,
                type: 'telegram_in' as const,
              }));

              const updatedDeal: Deal = {
                ...existingDeal,
                comments: [...(existingDeal.comments || []), ...newComments],
              };

              result.updatedDeals.push(updatedDeal);
            }
          } else {
            // Создаем новую сделку
            // Находим первого этапа воронки
            const firstStage = funnel.stages[0];
            if (!firstStage) {
              result.errors.push(`Воронка ${funnel.name} не имеет этапов`);
              continue;
            }

            // Назначаем на первого пользователя (можно улучшить логику назначения)
            const users = api.users.getAll();
            const defaultAssigneeId = users[0]?.id || '';

            const newDeal = instagramService.convertConversationToDeal(
              conversation,
              messages,
              funnelId,
              firstStage.id,
              defaultAssigneeId
            );

            result.newDeals.push(newDeal);
          }
        } catch (error: any) {
          result.errors.push(`Ошибка при обработке conversation ${conversation.id}: ${error.message}`);
          console.error('Error processing Instagram conversation:', error);
        }
      }

      // Обновляем lastSyncAt в воронке
      if (conversations.length > 0 || result.newDeals.length > 0 || result.updatedDeals.length > 0) {
        const updatedFunnel: SalesFunnel = {
          ...funnel,
          sources: {
            ...funnel.sources,
            instagram: {
              ...config,
              lastSyncAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date().toISOString(),
        };
        // Обновляем воронку через updateAll
        const allFunnels = api.funnels.getAll();
        const updatedFunnels = allFunnels.map(f => f.id === funnelId ? updatedFunnel : f);
        api.funnels.updateAll(updatedFunnels);
      }

    } catch (error: any) {
      result.errors.push(`Ошибка синхронизации Instagram: ${error.message}`);
      console.error('Error syncing Instagram leads:', error);
    }

    return result;
  },

  /**
   * Синхронизация всех воронок с подключенным Instagram
   */
  async syncAllInstagramFunnels(): Promise<SyncResult> {
    const result: SyncResult = {
      newDeals: [],
      updatedDeals: [],
      errors: [],
    };

    const funnels = await api.funnels.getAll();
    const instagramFunnels = funnels.filter(f => f.sources?.instagram?.enabled);

    for (const funnel of instagramFunnels) {
      const funnelResult = await this.syncInstagramLeads(funnel.id);
      result.newDeals.push(...funnelResult.newDeals);
      result.updatedDeals.push(...funnelResult.updatedDeals);
      result.errors.push(...funnelResult.errors);
    }

    return result;
  },
};

