import React, { useState, useEffect, useCallback } from 'react';
import { OzonCredentials, OzonPosting } from './types';
import { fetchOrders } from './services/ozonService';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import ProductLibrary from './components/ProductLibrary';
import { Menu, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<OzonCredentials | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings' | 'product_library'>('dashboard');
  const [orders, setOrders] = useState<OzonPosting[]>([]);
  const [toPackOrders, setToPackOrders] = useState<OzonPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Date Range State (Default: Last 7 Days)
  const [dateRange, setDateRange] = useState<{from: Date, to: Date}>(() => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 7);
      return { from, to };
  });

  // Custom Product Images (SKU -> URL)
  const [customImages, setCustomImages] = useState<Record<string, string>>({});

  // Initial load checks localStorage
  useEffect(() => {
    const savedCreds = localStorage.getItem('ozon_creds');
    if (savedCreds) {
      setCredentials(JSON.parse(savedCreds));
    } else {
      setCurrentView('settings');
    }

    const savedImages = localStorage.getItem('ozon_product_library');
    if (savedImages) {
        setCustomImages(JSON.parse(savedImages));
    }
  }, []);

  const loadData = useCallback(async (creds: OzonCredentials, range: {from: Date, to: Date}) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch orders for the selected date range (for stats/charts)
      const data = await fetchOrders(creds, range.from, range.to);
      setOrders(data);

      // 2. Fetch ALL recent orders (last 60 days) to filter client-side for "to pack"
      const wideFrom = new Date();
      wideFrom.setDate(wideFrom.getDate() - 60);
      const toPackData = await fetchOrders(creds, wideFrom, new Date());
      setToPackOrders(toPackData);

    } catch (error: any) {
      console.error("Failed to load orders", error);
      setError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when credentials change or are loaded
  useEffect(() => {
    if (credentials && currentView === 'dashboard') {
      loadData(credentials, dateRange);
    }
  }, [credentials, currentView, dateRange, loadData]);

  const handleSaveSettings = async (creds: OzonCredentials) => {
    setLoading(true);
    setError(null);
    try {
      // Test credentials by fetching 1 day of data
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 1);
      await fetchOrders(creds, from, to);
      
      // If successful, save and switch view
      setCredentials(creds);
      localStorage.setItem('ozon_creds', JSON.stringify(creds));
      setCurrentView('dashboard');
    } catch (err: any) {
      alert("登录失败，请检查 Client ID 和 API Key 是否正确。\n" + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLibrary = (newImages: Record<string, string>) => {
      setCustomImages(newImages);
      localStorage.setItem('ozon_product_library', JSON.stringify(newImages));
  };

  const handleLogout = () => {
    localStorage.removeItem('ozon_creds');
    setCredentials(null);
    setOrders([]);
    setToPackOrders([]);
    setError(null);
    setCurrentView('settings');
  };

  const getViewTitle = () => {
      switch(currentView) {
          case 'dashboard': return '销售概览';
          case 'product_library': return '产品图库';
          case 'settings': return '配置中心';
          default: return '';
      }
  };

  const getViewDesc = () => {
      switch(currentView) {
          case 'dashboard': return '欢迎回来，今日数据已更新';
          case 'product_library': return '管理本地产品图片映射，优化订单显示';
          case 'settings': return '管理您的 API 密钥和通知设置';
          default: return '';
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="font-bold text-slate-800">Ozon助手</span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-slate-100 rounded-md">
           <Menu size={20} className="text-slate-600"/>
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile) */}
      <div className={`md:block ${mobileMenuOpen ? 'block' : 'hidden'} fixed inset-0 z-40 md:static md:z-0 bg-slate-900/50 md:bg-transparent`}>
         <div className="md:hidden absolute right-4 top-4 text-white" onClick={() => setMobileMenuOpen(false)}>X</div>
         <Sidebar 
            currentView={currentView} 
            onChangeView={(view) => {
                setCurrentView(view);
                setMobileMenuOpen(false);
            }} 
            onLogout={handleLogout} 
         />
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 transition-all">
        {/* Dynamic Header based on View */}
        <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                {getViewTitle()}
            </h1>
            <p className="text-slate-500 mt-1">
                {getViewDesc()}
            </p>
        </header>

        {currentView === 'dashboard' && !credentials ? (
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
             <h2 className="text-xl font-semibold text-slate-800 mb-2">尚未配置 API</h2>
             <p className="text-slate-500 mb-6">请先配置 Ozon Client ID 和 API Key 以查看数据。</p>
             <button 
               onClick={() => setCurrentView('settings')}
               className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
             >
               去配置
             </button>
           </div>
        ) : (
            <>
                {currentView === 'dashboard' && error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-medium text-red-800">无法加载数据</h3>
                                <p className="text-sm text-red-600 mt-1">{error}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 ml-8">
                            <button 
                                onClick={() => loadData(credentials!, dateRange)}
                                className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-md text-sm hover:bg-red-50 font-medium"
                            >
                                重试
                            </button>
                        </div>
                    </div>
                )}

                {currentView === 'dashboard' && !error && (
                    <Dashboard 
                        orders={orders} 
                        toPackOrders={toPackOrders}
                        loading={loading} 
                        customImages={customImages} 
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                    />
                )}
                {currentView === 'product_library' && <ProductLibrary customImages={customImages} onSave={handleSaveLibrary} />}
                {currentView === 'settings' && <Settings onSave={handleSaveSettings} initialCreds={credentials || { clientId: '', apiKey: '' }} />}
            </>
        )}
      </main>
    </div>
  );
};

export default App;