
import React, { useState } from 'react';
import { Bot, Link, Server, Copy, Check } from 'lucide-react';
import { User, Deal } from '../../types';

interface IntegrationSettingsProps {
  activeTab: string;
  currentUser?: User;
  onSaveDeal?: (deal: Deal) => void;
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ activeTab, currentUser, onSaveDeal }) => {
  const [copied, setCopied] = useState(false);

  const handleSimulateLead = (source: 'instagram' | 'site' | 'telegram') => {
      if (!onSaveDeal || !currentUser) return;
      onSaveDeal({
          id: `lead-${Date.now()}`,
          title: source === 'instagram' ? '@username: Цена?' : 'Заявка с сайта',
          amount: 0, currency: 'UZS', stage: 'new', source: source, assigneeId: currentUser.id, createdAt: new Date().toISOString()
      });
      alert('Тестовый лид создан в Воронке продаж!');
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const websiteScriptCode = `
<script>
async function sendLeadToTaska(data) {
  // TODO: замените URL на реальный адрес backend'а tipa.taska.uz
  const API_URL = "https://api.tipa.taska.uz/api/deals";
  const payload = {
    title: "Заявка: " + (data.name || "С сайта"),
    contactName: data.name,
    amount: data.amount || 0,
    currency: "UZS",
    stage: "new",
    source: "site",
  };
  
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
</script>
`.trim();

  const nodeServerCode = `
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// TODO: замените на реальный URL backend'а tipa.taska.uz
const API_URL = "https://api.tipa.taska.uz/api/deals";
const VERIFY_TOKEN = "my_secure_token";

// 1. Verify Webhook (Required by Meta)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receive Messages
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'instagram') {
    // TODO: достаньте текст сообщения и отправителя
    // Пример: создаём лид в backend'е
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Лид из Instagram',
        contactName: 'Instagram user',
        amount: 0,
        currency: 'UZS',
        stage: 'new',
        source: 'instagram',
      }),
    });
  }
  res.sendStatus(200);
});

`;

  if (activeTab === 'integrations') {
      return (
          <div className="space-y-6 max-w-3xl">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex gap-4">
                  <Bot className="text-blue-600 dark:text-blue-400 shrink-0" size={24}/>
                  <div>
                      <h3 className="font-bold text-blue-900 dark:text-blue-100">Интеграции</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Здесь настраиваются связи tipa.taska.uz с внешними системами: Telegram, сайт, Meta/Instagram.
                        Секретные токены и ключи хранятся только на сервере (в <code className="font-mono">.env</code> backend'а).
                      </p>
                  </div>
              </div>

              <div className="p-5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525] space-y-3">
                  <h4 className="font-bold text-gray-800 dark:text-white">1. Telegram‑бот для сотрудников (уведомления)</h4>
                  <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <li>Создайте бота через <b>@BotFather</b> и получите токен.</li>
                    <li>На сервере, в <code className="font-mono bg-gray-100 dark:bg-[#202020] px-1 rounded">apps/api/.env</code>, добавьте переменную вида <code className="font-mono bg-gray-100 dark:bg-[#202020] px-1 rounded">TELEGRAM_EMPLOYEE_BOT_TOKEN=...</code>.</li>
                    <li>Перезапустите backend (docker / systemd), чтобы новый токен подтянулся.</li>
                    <li>Все события, включённые во вкладке «Уведомления и роботы», будут уходить в этого бота.</li>
                  </ol>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Важно: токен **никогда** не вводится в браузере и не хранится в `localStorage`.
                  </p>
              </div>

              <div className="p-5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525] space-y-3">
                  <h4 className="font-bold text-gray-800 dark:text-white">2. Telegram‑бот для клиентов (лиды)</h4>
                  <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <li>Создайте отдельного бота для клиентов (чтобы не мешать служебные уведомления и заявки).</li>
                    <li>Пропишите токен в `.env` backend'а, например <code className="font-mono bg-gray-100 dark:bg-[#202020] px-1 rounded">TELEGRAM_CLIENT_BOT_TOKEN=...</code>.</li>
                    <li>Реализуйте обработку заявок в `apps/bot`, используя HTTP‑API backend'а (`/api/deals`).</li>
                  </ol>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    В этом разделе мы не храним токены — только описываем шаги. Весь код работы с Telegram лежит в `apps/bot`.
                  </p>
              </div>
          </div>
      );
  }

  if (activeTab === 'leads') {
      return (
          <div className="space-y-6 max-w-3xl">
              <div className="flex gap-3 mb-6">
                  <button onClick={() => handleSimulateLead('site')} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100 hover:bg-blue-100">Тест: Заявка с сайта</button>
                  <button onClick={() => handleSimulateLead('instagram')} className="px-4 py-2 bg-pink-50 text-pink-700 rounded-lg text-sm font-bold border border-pink-100 hover:bg-pink-100">Тест: Instagram</button>
              </div>

              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2 flex items-center gap-2"><Link size={20}/> Скрипт для сайта</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Вставьте этот код на ваш сайт (Tilda, WordPress), чтобы заявки автоматически попадали в систему.</p>
                  
                  <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{websiteScriptCode}
                      </pre>
                      <button onClick={() => copyToClipboard(websiteScriptCode)} className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-white transition-colors">
                          {copied ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  if (activeTab === 'meta') {
      return (
          <div className="space-y-6 max-w-3xl">
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2 flex items-center gap-2"><Server size={20}/> Сервер для Instagram (Node.js)</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Meta требует наличия HTTPS сервера для получения сообщений (Webhook). Вот готовый код для запуска.</p>
                  
                  <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{nodeServerCode}
                      </pre>
                      <button onClick={() => copyToClipboard(nodeServerCode)} className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-white transition-colors">
                          {copied ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
};
