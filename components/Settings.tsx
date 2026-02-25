import React, { useState } from 'react';
import { OzonCredentials } from '../types';
import { Key, Save, Lock, Info } from 'lucide-react';

interface SettingsProps {
  onSave: (creds: OzonCredentials) => void;
  initialCreds: OzonCredentials;
}

const Settings: React.FC<SettingsProps> = ({ onSave, initialCreds }) => {
  const [clientId, setClientId] = useState(initialCreds.clientId);
  const [apiKey, setApiKey] = useState(initialCreds.apiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ clientId, apiKey });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      
      {/* API Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Key size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Ozon API 配置</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
            <input
              type="text"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="例如: 123456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key (管理权限或报告权限)</label>
            <div className="relative">
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                placeholder="例如: xxxxx-xxxx-xxxx-xxxx"
              />
              <Lock className="absolute right-3 top-2.5 text-slate-400" size={16} />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 mt-2">
             <Info size={16} className="text-blue-500 mt-0.5 shrink-0"/>
             <p className="text-xs text-slate-500">
               您的密钥仅存储在本地浏览器中，用于直接与 Ozon API 进行安全通信。
             </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Save size={18} />
            保存配置并同步数据
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;