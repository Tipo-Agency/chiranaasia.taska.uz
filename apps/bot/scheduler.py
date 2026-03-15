"""
Планировщик задач (ежедневные, еженедельные)
"""
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
except ImportError:
    # Fallback для синхронного планировщика
    from apscheduler.schedulers.blocking import BlockingScheduler as AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import pytz
import config
from firebase_client import firebase
from notifications import get_daily_reminder_message, get_weekly_report_message, get_successful_deal_message, get_group_daily_summary
from deals import get_won_deals_today

class TaskScheduler:
    """Планировщик задач для бота"""
    
    def __init__(self, bot_instance):
        self.bot = bot_instance
        self.scheduler = AsyncIOScheduler(timezone=pytz.timezone(config.DEFAULT_TIMEZONE))
        self.setup_jobs()
    
    def setup_jobs(self):
        """Настроить задачи планировщика"""
        # Ежедневное напоминание в 9:00 (личные)
        self.scheduler.add_job(
            self.send_daily_reminders,
            CronTrigger(hour=9, minute=0, timezone=config.DEFAULT_TIMEZONE),
            id='daily_reminder',
            name='Ежедневное напоминание о задачах'
        )
        
        # Ежедневная сводка в группу в 9:05
        self.scheduler.add_job(
            self.send_group_daily_summary,
            CronTrigger(hour=9, minute=5, timezone=config.DEFAULT_TIMEZONE),
            id='group_daily_summary',
            name='Ежедневная сводка в группу'
        )
        
        # Еженедельный отчет в понедельник в 9:00
        self.scheduler.add_job(
            self.send_weekly_report,
            CronTrigger(day_of_week=0, hour=9, minute=0, timezone=config.DEFAULT_TIMEZONE),
            id='weekly_report',
            name='Еженедельный отчет'
        )
    
    async def send_daily_reminders(self):
        """Отправить ежедневные напоминания всем пользователям"""
        try:
            users = firebase.get_all('users')
            for user in users:
                if user.get('isArchived'):
                    continue
                
                # Получаем telegram_user_id из настроек пользователя
                telegram_user_id = user.get('telegramUserId')
                if not telegram_user_id:
                    continue
                
                message = get_daily_reminder_message(user.get('id'))
                if message:
                    try:
                        await self.bot.send_message(
                            chat_id=telegram_user_id,
                            text=message
                        )
                    except Exception as e:
                        print(f"Error sending daily reminder to {telegram_user_id}: {e}")
        except Exception as e:
            print(f"Error in send_daily_reminders: {e}")
    
    async def send_group_daily_summary(self):
        """Отправить ежедневную сводку в групповой чат"""
        try:
            # Получаем настройки уведомлений
            notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
            if not notification_prefs:
                return
            
            # Проверяем, включена ли ежедневная сводка
            group_daily_summary = notification_prefs.get('groupDailySummary', {'telegramGroup': True})
            if not group_daily_summary.get('telegramGroup', True):
                print("Group daily summary is disabled in settings")
                return
            
            telegram_chat_id = notification_prefs.get('telegramGroupChatId')
            if not telegram_chat_id:
                print("No telegramGroupChatId in notification preferences")
                return
            
            message = get_group_daily_summary()
            if message:
                try:
                    await self.bot.send_message(
                        chat_id=telegram_chat_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    print(f"Group daily summary sent to {telegram_chat_id}")
                except Exception as e:
                    print(f"Error sending group daily summary to {telegram_chat_id}: {e}")
            else:
                print("No message to send for group daily summary")
        except Exception as e:
            print(f"Error in send_group_daily_summary: {e}")
    
    async def send_weekly_report(self):
        """Отправить еженедельный отчет в групповой чат"""
        try:
            # Получаем настройки уведомлений
            notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
            if not notification_prefs:
                return
            
            telegram_chat_id = notification_prefs.get('telegramGroupChatId')
            if not telegram_chat_id:
                return
            
            message = get_weekly_report_message()
            if message:
                try:
                    await self.bot.send_message(
                        chat_id=telegram_chat_id,
                        text=message
                    )
                except Exception as e:
                    print(f"Error sending weekly report to {telegram_chat_id}: {e}")
        except Exception as e:
            print(f"Error in send_weekly_report: {e}")
    
    def start(self):
        """Запустить планировщик"""
        self.scheduler.start()
        print("Task scheduler started")
    
    def stop(self):
        """Остановить планировщик"""
        self.scheduler.shutdown()
        print("Task scheduler stopped")
