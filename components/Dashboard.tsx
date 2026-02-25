import React, { useMemo, useState, useEffect, useRef } from 'react';
import { OzonPosting, OzonCredentials } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps, Legend } from 'recharts';
import { Package, TrendingUp, DollarSign, Loader2, Box, Printer, Layers, CheckCircle, Search, Filter, X, Eye, FileText, ClipboardList, CheckSquare, Image as ImageIcon, Download, Calendar, BarChart2 } from 'lucide-react';
import { fetchPackageLabel } from '../services/ozonService';

interface DashboardProps {
  orders: OzonPosting[];
  toPackOrders: OzonPosting[];
  loading: boolean;
  customImages: Record<string, string>;
  dateRange: { from: Date, to: Date };
  onDateRangeChange: (range: { from: Date, to: Date }) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm text-blue-600">
          销售额: ¥ {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ orders, toPackOrders, loading, customImages, dateRange, onDateRangeChange }) => {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'smart_group'>('list');
  const [trendProduct, setTrendProduct] = useState<{sku: number, name: string} | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // 1. Main Status Filter
  const [filterStatus, setFilterStatus] = useState<'all' | 'packed' | 'unpacked'>('all');
  
  // 2. Sub-filter for 'Unpacked' tab: Internal Processing Status
  const [processedFilter, setProcessedFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  
  // 3. Search Query
  const [searchQuery, setSearchQuery] = useState('');

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<{url: string, title: string} | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // Status Persistence: Packed
  const [packedOrderIds, setPackedOrderIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ozon_packed_orders');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Status Persistence: Internal Processed
  const [processedOrderIds, setProcessedOrderIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ozon_processed_orders');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('ozon_packed_orders', JSON.stringify(Array.from(packedOrderIds)));
  }, [packedOrderIds]);

  useEffect(() => {
    localStorage.setItem('ozon_processed_orders', JSON.stringify(Array.from(processedOrderIds)));
  }, [processedOrderIds]);

  // Auto-pack logic
  useEffect(() => {
    if (orders.length === 0 && toPackOrders.length === 0) return;
    setPackedOrderIds(prev => {
        const next = new Set(prev);
        let changed = false;
        const allOrders = [...orders, ...toPackOrders];
        allOrders.forEach(order => {
            const status = order.status.toLowerCase();
            if (['delivering', 'delivered', 'cancelled'].includes(status)) {
                if (!next.has(order.posting_number)) {
                    next.add(order.posting_number);
                    changed = true;
                }
            }
        });
        return changed ? next : prev;
    });
  }, [orders, toPackOrders]);

  const getCredentials = (): OzonCredentials | null => {
      const saved = localStorage.getItem('ozon_creds');
      return saved ? JSON.parse(saved) : null;
  };

  // Helper to get image URL (Custom > API)
  const getProductImage = (sku: number | string, apiImage?: string) => {
      const skuStr = sku.toString();
      return customImages[skuStr] || apiImage;
  };

  // ---------------- Filtering Logic ----------------
  // Note: filteredOrders is defined above in the new logic block
  // We need to remove the old definition to avoid duplication/conflict if I pasted it above.
  // Wait, I replaced the whole block above including filteredOrders? 
  // No, I replaced 'Stats calculation' ... 'Smart Groups'.
  // But 'filteredOrders' was BEFORE 'Stats calculation' in the original file (lines 96-120).
  // I need to be careful.
  
  // Let's check the original file structure again.
  // Line 96: const filteredOrders = useMemo(() => { ...
  // Line 123: const stats = useMemo(() => { ...
  // Line 152: const smartGroups = useMemo(() => { ...

  // My previous replacement chunk replaced from 'Stats calculation' to 'Smart Groups'.
  // It INCLUDED 'filteredOrders' logic inside it? No.
  
  // I should replace 'filteredOrders' logic separately or include it.
  // In the original file, 'filteredOrders' comes BEFORE 'stats'.
  
  // Let's restructure the replacement to be safe.
  // I will replace the block from `const filteredOrders = ...` down to `const smartGroups = ...` end.


  // Stats calculation
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    // To Pack Count: awaiting_packaging AND awaiting_deliver are "to pack" (unless locally packed)
    const toPackCount = toPackOrders.filter(o => {
        const status = o.status.toLowerCase();
        const isToPackStatus = ['awaiting_packaging', 'awaiting_deliver'].includes(status);
        return isToPackStatus && !packedOrderIds.has(o.posting_number);
    }).length;
    
    const totalRevenue = orders.reduce((acc, order) => {
      const orderTotal = order.financial_data?.products.reduce((sum, p) => sum + p.price, 0) || 
                         order.products.reduce((sum, p) => sum + parseFloat(p.price), 0);
      return acc + orderTotal;
    }, 0);
    
    const salesByDate = orders.reduce((acc, order) => {
      const date = order.in_process_at.split('T')[0];
      const orderTotal = order.financial_data?.products.reduce((sum, p) => sum + p.price, 0) || 
                         order.products.reduce((sum, p) => sum + parseFloat(p.price), 0);
      if (!acc[date]) acc[date] = 0;
      acc[date] += orderTotal;
      return acc;
    }, {} as Record<string, number>);

    // Generate chart data based on selected date range
    const chartData = [];
    const currentDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const monthDay = dateStr.substring(5); // MM-DD
        chartData.push({ 
            date: monthDay, 
            fullDate: dateStr,
            amount: salesByDate[dateStr] || 0 
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return { totalOrders, totalRevenue, chartData, toPackCount };
  }, [orders, toPackOrders, dateRange, packedOrderIds]);

  // Product Trend Calculation
  const productTrendData = useMemo(() => {
      if (!trendProduct) return [];
      
      const trend: Record<string, number> = {};
      const currentDate = new Date(dateRange.from);
      const endDate = new Date(dateRange.to);
      
      // Initialize 0 for all days
      while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          trend[dateStr] = 0;
          currentDate.setDate(currentDate.getDate() + 1);
      }

      // Fill data
      orders.forEach(o => {
          const date = o.in_process_at.split('T')[0];
          const p = o.products.find(prod => prod.sku === trendProduct.sku);
          if (p && trend[date] !== undefined) {
              trend[date] += p.quantity;
          }
      });

      return Object.entries(trend)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, qty]) => ({ date: date.substring(5), qty }));
  }, [orders, trendProduct, dateRange]);

  // ---------------- Filtering Logic ----------------
  const filteredOrders = useMemo(() => {
    // Determine source data based on filter
    let sourceData = orders;
    if (filterStatus === 'unpacked') {
        sourceData = toPackOrders;
    }

    return sourceData.filter(order => {
        const isPacked = packedOrderIds.has(order.posting_number);
        const status = order.status.toLowerCase();
        const isToPackStatus = ['awaiting_packaging', 'awaiting_deliver'].includes(status);

        if (filterStatus === 'packed') {
            // Show only packed orders (either locally packed OR not in "to pack" status)
            if (!isPacked && isToPackStatus) return false;
        }
        
        if (filterStatus === 'unpacked') {
            // Show only unpacked orders (NOT locally packed AND is in "to pack" status)
            if (isPacked || !isToPackStatus) return false;

            const isProcessed = processedOrderIds.has(order.posting_number);
            if (processedFilter === 'processed' && !isProcessed) return false;
            if (processedFilter === 'unprocessed' && isProcessed) return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchOrder = order.posting_number.toLowerCase().includes(q);
            const matchProduct = order.products.some(p => 
                p.sku.toString().includes(q) || 
                p.offer_id.toLowerCase().includes(q) || 
                p.name.toLowerCase().includes(q)
            );
            if (!matchOrder && !matchProduct) return false;
        }
        return true;
    });
  }, [orders, toPackOrders, packedOrderIds, processedOrderIds, filterStatus, processedFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, processedFilter, searchQuery, viewMode]);

  const paginatedOrders = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Smart Groups
  const smartGroups = useMemo(() => {
      const groups: Record<string, { product: any, orders: OzonPosting[] }> = {};
      
      // Smart groups should use toPackOrders if we are focusing on packing tasks
      // Or maybe just filter from filteredOrders?
      // The user wants "Smart Grouping (Single Item Unpacked)"
      // So we should use toPackOrders as base.
      
      toPackOrders.forEach(order => {
          const isPacked = packedOrderIds.has(order.posting_number);
          const status = order.status.toLowerCase();
          const isToPackStatus = ['awaiting_packaging', 'awaiting_deliver'].includes(status);
          
          let matchesSearch = true;
          if (searchQuery.trim()) {
             const q = searchQuery.toLowerCase().trim();
             const matchOrder = order.posting_number.toLowerCase().includes(q);
             const matchProduct = order.products.some(p => p.sku.toString().includes(q) || p.offer_id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
             matchesSearch = matchOrder || matchProduct;
          }

          if (order.products.length === 1 && !isPacked && isToPackStatus && matchesSearch) {
              const product = order.products[0];
              const key = product.offer_id;
              if (!groups[key]) groups[key] = { product, orders: [] };
              groups[key].orders.push(order);
          }
      });
      return Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);
  }, [toPackOrders, packedOrderIds, searchQuery]);

  const toggleSelectAll = () => {
      if (selectedOrders.size === filteredOrders.length) setSelectedOrders(new Set());
      else setSelectedOrders(new Set(filteredOrders.map(o => o.posting_number)));
  };

  const toggleSelect = (id: string) => {
      const newSelected = new Set(selectedOrders);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setSelectedOrders(newSelected);
  };

  // Generic Download Helper
  const triggerDownload = (blobUrl: string, filename: string) => {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFetchLabels = async (ids: string[], mode: 'print' | 'download') => {
      const creds = getCredentials();
      if (!creds || ids.length === 0) return;
      setDownloading(true);
      try {
          const blob = await fetchPackageLabel(creds, ids);
          const url = window.URL.createObjectURL(blob);
          
          if (mode === 'print') {
             // Open Modal for Preview & Print
             setPreviewBlobUrl(url);
          } else {
             // Direct Download
             triggerDownload(url, `Ozon_Labels_${new Date().toISOString().slice(0,10)}.pdf`);
             // Cleanup url after small delay to ensure download starts
             setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          }
      } catch (e: any) {
          console.error("Fetch labels failed", e);
          alert(`面单获取失败: ${e.message || "请检查网络、API配置或CORS限制"}`);
      } finally {
          setDownloading(false);
      }
  };

  const performActualPrint = () => {
      if (printFrameRef.current) {
          // Some browsers need focus before print
          printFrameRef.current.contentWindow?.focus();
          printFrameRef.current.contentWindow?.print();
      }
  };

  const togglePackedStatus = (ids: string[], status: boolean) => {
      const newPacked = new Set(packedOrderIds);
      ids.forEach(id => {
          if (status) newPacked.add(id);
          else newPacked.delete(id);
      });
      setPackedOrderIds(newPacked);
      if (ids.length > 1) setSelectedOrders(new Set());
  };

  const toggleProcessedStatus = (ids: string[], status: boolean) => {
      const newProcessed = new Set(processedOrderIds);
      ids.forEach(id => {
          if (status) newProcessed.add(id);
          else newProcessed.delete(id);
      });
      setProcessedOrderIds(newProcessed);
  };

  const handleExport = (idsToExport: string[]) => {
      if (idsToExport.length === 0) return;
      const items = orders.filter(o => idsToExport.includes(o.posting_number));
      const headers = ['订单号', 'Ozon状态', '打包状态', '处理进度', '商品名称 (含规格)', '货号 (Offer ID)', 'SKU', '数量', '金额'];
      const rows = items.map(o => {
          const isPacked = packedOrderIds.has(o.posting_number) ? '已打包' : '未打包';
          const isProcessed = processedOrderIds.has(o.posting_number) ? '已处理' : '未处理';
          const name = o.products.map(p => p.name).join('; ');
          const offerId = o.products.map(p => p.offer_id).join('; ');
          const sku = o.products.map(p => p.sku).join('; ');
          const qty = o.products.map(p => p.quantity).join('; ');
          const price = o.products.reduce((acc, p) => acc + parseFloat(p.price), 0).toFixed(2);
          return [o.posting_number, o.status, isPacked, isProcessed, `"${name.replace(/"/g, '""')}"`, offerId, sku, qty, price].join(',');
      });
      const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `Ozon订单导出_${new Date().toISOString().slice(0,10)}.csv`);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-medium">正在同步 Ozon 数据...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Date Range Picker */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Calendar size={20} className="text-blue-600"/>
              <span>数据统计周期</span>
          </div>
          <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.from.toISOString().split('T')[0]}
                onChange={(e) => onDateRangeChange({ ...dateRange, from: new Date(e.target.value) })}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                value={dateRange.to.toISOString().split('T')[0]}
                onChange={(e) => onDateRangeChange({ ...dateRange, to: new Date(e.target.value) })}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
          </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex justify-between items-start">
            <div><p className="text-blue-100 text-sm font-medium mb-1">总销售额</p><h3 className="text-3xl font-bold">¥ {stats.totalRevenue.toLocaleString()}</h3></div>
            <div className="bg-white/20 p-2 rounded-lg"><DollarSign size={24}/></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm mb-1">总订单数</p><h3 className="text-3xl font-bold">{stats.totalOrders}</h3></div>
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Package size={24} /></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
           <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm mb-1">待打包</p><h3 className="text-3xl font-bold text-orange-600">{stats.toPackCount}</h3></div>
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Box size={24} /></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
           <div className="flex justify-between items-start">
            <div><p className="text-slate-500 text-sm mb-1">平均客单价</p><h3 className="text-3xl font-bold text-slate-800">¥ {stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders).toLocaleString() : 0}</h3></div>
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><TrendingUp size={24} /></div>
          </div>
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 size={20} className="text-blue-600"/>
              每日销售趋势
          </h3>
          <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `¥${value}`}/>
                      <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}}/>
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-4 border-b border-slate-200">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Box size={18} /> 所有订单
          </button>
          <button onClick={() => setViewMode('smart_group')} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${viewMode === 'smart_group' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Layers size={18} /> 智能合单 (仅限单品未打包)
          </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         {/* Toolbar */}
         <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-4">
             {/* Top Row: Search and Status Tabs */}
             <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    {/* Status Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 self-start">
                        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>全部</button>
                        <button onClick={() => setFilterStatus('unpacked')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === 'unpacked' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>待打包</button>
                        <button onClick={() => setFilterStatus('packed')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === 'packed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>已打包</button>
                    </div>

                    {/* Sub-Filter for Unpacked */}
                    {filterStatus === 'unpacked' && (
                        <div className="flex items-center gap-2 text-sm bg-blue-50/50 p-1 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-left-2 duration-200">
                             <span className="text-xs text-blue-400 font-bold px-2 flex gap-1 items-center"><Filter size={10}/> 筛选:</span>
                             <button onClick={() => setProcessedFilter('all')} className={`px-2 py-1 text-[10px] rounded transition-colors ${processedFilter === 'all' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:bg-white/50'}`}>全部</button>
                             <button onClick={() => setProcessedFilter('unprocessed')} className={`px-2 py-1 text-[10px] rounded transition-colors ${processedFilter === 'unprocessed' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-slate-500 hover:bg-white/50'}`}>未处理</button>
                             <button onClick={() => setProcessedFilter('processed')} className={`px-2 py-1 text-[10px] rounded transition-colors ${processedFilter === 'processed' ? 'bg-white text-green-600 shadow-sm font-bold' : 'text-slate-500 hover:bg-white/50'}`}>已处理</button>
                        </div>
                    )}
                </div>

                {/* Search Bar */}
                <div className="relative w-full lg:w-80">
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索 订单号 / SKU / 货号 / 名称..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
             </div>
             
             {/* Action Buttons (Bulk Ops) */}
             {viewMode === 'list' && (
                 <div className="flex items-center gap-2 pt-2 border-t border-slate-50 overflow-x-auto pb-1">
                    <button onClick={() => handleExport(Array.from(selectedOrders))} disabled={selectedOrders.size === 0} className="shrink-0 flex items-center justify-center gap-2 text-xs bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 font-medium transition-colors">
                        <FileText size={14} /> 导出详情
                    </button>
                    <button onClick={() => togglePackedStatus(Array.from(selectedOrders), true)} disabled={selectedOrders.size === 0} className="shrink-0 flex items-center justify-center gap-2 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50 font-medium transition-colors">
                        <CheckCircle size={14} /> 批量设为已打包
                    </button>
                    <button onClick={() => handleFetchLabels(Array.from(selectedOrders), 'download')} disabled={selectedOrders.size === 0 || downloading} className="shrink-0 flex items-center justify-center gap-2 text-xs bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 font-medium transition-colors">
                         {downloading ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                        下载选中面单
                    </button>
                    <button onClick={() => handleFetchLabels(Array.from(selectedOrders), 'print')} disabled={selectedOrders.size === 0 || downloading} className="shrink-0 flex items-center justify-center gap-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm transition-colors">
                        {downloading ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14} />}
                        打印选中面单
                    </button>
                 </div>
             )}
         </div>

        {/* List View Content */}
        {viewMode === 'list' ? (
            <div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                    <th className="px-6 py-3 w-12"><input type="checkbox" checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length} onChange={toggleSelectAll} className="rounded border-slate-300 text-blue-600"/></th>
                    <th className="px-6 py-3 w-28">打包状态</th>
                    {filterStatus === 'unpacked' && <th className="px-6 py-3 w-28">内部处理</th>}
                    <th className="px-6 py-3">订单号</th>
                    <th className="px-6 py-3 w-[450px]">商品信息 (名称/规格/货号/SKU)</th>
                    <th className="px-6 py-3">金额 (¥)</th>
                    <th className="px-6 py-3 text-right">操作</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {paginatedOrders.length > 0 ? (
                    paginatedOrders.map((order) => {
                    const price = order.products.reduce((s, p) => s + parseFloat(p.price), 0);
                    const isSelected = selectedOrders.has(order.posting_number);
                    const isPacked = packedOrderIds.has(order.posting_number);
                    const isProcessed = processedOrderIds.has(order.posting_number);
                    
                    return (
                    <tr key={order.posting_number} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.posting_number)} className="rounded border-slate-300 text-blue-600"/></td>
                    <td className="px-6 py-4">
                        {isPacked ? (
                            <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">已打包</span>
                        ) : ['awaiting_packaging', 'awaiting_deliver'].includes(order.status.toLowerCase()) ? (
                            <span className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">待打包</span>
                        ) : (
                            <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">非待打包</span>
                        )}
                        <div className="mt-1 text-[10px] text-slate-400 font-mono uppercase">
                            {order.status.toLowerCase() === 'awaiting_packaging' ? '等待备货' : 
                             order.status.toLowerCase() === 'awaiting_deliver' ? '等待发运' : 
                             order.status.toLowerCase() === 'delivering' ? '运输中' : 
                             order.status.toLowerCase() === 'delivered' ? '已送达' : 
                             order.status.toLowerCase() === 'cancelled' ? '已取消' : order.status}
                        </div>
                    </td>
                    
                    {filterStatus === 'unpacked' && (
                        <td className="px-6 py-4">
                            <button 
                                onClick={() => toggleProcessedStatus([order.posting_number], !isProcessed)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                    isProcessed 
                                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-300 hover:text-blue-500'
                                }`}
                            >
                                {isProcessed ? <CheckSquare size={10} /> : <ClipboardList size={10} />}
                                {isProcessed ? '已处理' : '未处理'}
                            </button>
                        </td>
                    )}

                    <td className="px-6 py-4 font-mono text-slate-600 text-xs">{order.posting_number}</td>
                    <td className="px-6 py-4">
                        <div className="space-y-3">
                        {order.products.map((p, idx) => {
                            // Logic to determine which image to show: Custom Library > API Image
                            const finalImage = getProductImage(p.sku, p.primary_image);
                            return (
                            <div key={idx} className="flex gap-4 border-b border-slate-100 last:border-0 pb-3 last:pb-0 items-start">
                                {/* Product Image - Click to Enlarge */}
                                <div 
                                    className="w-16 h-16 shrink-0 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-zoom-in group relative"
                                    onClick={() => finalImage && setEnlargedImage({ url: finalImage, title: p.name })}
                                >
                                    {finalImage ? (
                                        <>
                                          <img src={finalImage} alt={p.name} className="w-full h-full object-contain" />
                                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                             <Eye size={16} className="text-white drop-shadow-md"/>
                                          </div>
                                        </>
                                    ) : (
                                        <ImageIcon size={20} className="text-slate-300" />
                                    )}
                                </div>
                                {/* Product Details - Enhanced Visibility */}
                                <div className="flex flex-col gap-2 flex-1 min-w-0">
                                    <span className="text-slate-800 font-bold text-sm leading-normal whitespace-pre-wrap break-words">{p.name}</span>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                            货号: <span className="font-bold text-slate-800">{p.offer_id}</span>
                                        </span>
                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                            SKU: <span className="font-bold text-slate-800">{p.sku}</span>
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setTrendProduct({sku: p.sku, name: p.name})}
                                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 mt-1 font-medium w-fit"
                                    >
                                        <TrendingUp size={12}/> 查看动销趋势
                                    </button>
                                </div>
                            </div>
                        )})}
                        </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">¥ {price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                             <button onClick={() => handleFetchLabels([order.posting_number], 'print')} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg" title="打印预览"><Printer size={16} /></button>
                             <button onClick={() => togglePackedStatus([order.posting_number], !isPacked)} className={`p-2 rounded-lg ${isPacked ? 'text-slate-400' : 'text-green-600 hover:bg-green-50'}`} title={isPacked ? "撤销打包" : "标记打包"}><CheckCircle size={16} /></button>
                        </div>
                    </td>
                    </tr>
                )})
                ) : (
                    <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                            <Search size={32} className="opacity-20"/>
                            <p>没有找到匹配的订单</p>
                            </div>
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                <div className="text-sm text-slate-500">
                    显示 {filteredOrders.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} 共 {filteredOrders.length} 条
                </div>
                <div className="flex items-center gap-4">
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="border border-slate-300 rounded-md text-sm px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value={10}>10 条/页</option>
                        <option value={20}>20 条/页</option>
                        <option value={50}>50 条/页</option>
                        <option value={100}>100 条/页</option>
                    </select>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm disabled:opacity-50 hover:bg-white bg-white transition-colors text-slate-600"
                        >
                            上一页
                        </button>
                        <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[3rem] text-center">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm disabled:opacity-50 hover:bg-white bg-white transition-colors text-slate-600"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
            </div>
        ) : (
          /* Smart Grouping View - ONLY SHOW UNPACKED */
          <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3 text-blue-800 text-sm shadow-sm">
                  <Layers size={18} className="text-blue-600 shrink-0"/>
                  <p className="font-medium">智能合单仅展示“单品且尚未打包”的订单。标记为已打包或进入运输中的订单将自动移出此视图。</p>
              </div>

              {smartGroups.length > 0 ? (
                  smartGroups.map((group, index) => {
                    const finalImage = getProductImage(group.product.sku, group.product.primary_image);
                    return (
                    <div key={group.product.offer_id + index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-blue-300 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-6 flex-1">
                                {/* Product Image in Group */}
                                <div 
                                    className="w-24 h-24 shrink-0 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center cursor-zoom-in group relative"
                                    onClick={() => finalImage && setEnlargedImage({ url: finalImage, title: group.product.name })}
                                >
                                    {finalImage ? (
                                        <>
                                            <img src={finalImage} alt={group.product.name} className="w-full h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Eye size={24} className="text-white drop-shadow-md"/>
                                            </div>
                                        </>
                                    ) : (
                                        <ImageIcon size={32} className="text-slate-300" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 text-lg mb-2 leading-tight">{group.product.name}</h4>
                                    <div className="flex flex-wrap gap-3 text-xs text-slate-600 mb-3 uppercase tracking-wide">
                                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">货号: <span className="font-bold font-mono">{group.product.offer_id}</span></span>
                                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">SKU: <span className="font-bold font-mono">{group.product.sku}</span></span>
                                    </div>
                                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded font-bold text-xs">共 {group.orders.length} 单待处理</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                                <button 
                                    onClick={() => handleExport(group.orders.map(o => o.posting_number))}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-xs"
                                >
                                    <FileText size={14} /> 导出详情
                                </button>
                                <button 
                                    onClick={() => togglePackedStatus(group.orders.map(o => o.posting_number), true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all text-xs"
                                >
                                    <CheckCircle size={14} /> 全部标记打包
                                </button>
                                <button 
                                    onClick={() => handleFetchLabels(group.orders.map(o => o.posting_number), 'print')}
                                    disabled={downloading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:border-blue-600 hover:text-blue-600 text-slate-700 rounded-lg font-bold text-xs"
                                >
                                    {downloading ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14} />}
                                    批量打印面单 ({group.orders.length})
                                </button>
                            </div>
                        </div>
                    </div>
                  )})
              ) : (
                <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-slate-200 text-slate-400">
                    <Package size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>当前没有符合筛选条件的单品合单订单</p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Images */}
      {enlargedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setEnlargedImage(null)}>
            <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center">
                <button 
                    onClick={() => setEnlargedImage(null)}
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                >
                    <X size={32}/>
                </button>
                <img 
                    src={enlargedImage.url} 
                    alt="Full View" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl mb-4"
                    onClick={(e) => e.stopPropagation()} 
                />
                <p className="text-white text-lg font-bold text-center bg-black/50 px-4 py-2 rounded-full">{enlargedImage.title}</p>
            </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {previewBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-2 rounded-lg text-white"><Eye size={20}/></div>
                      <div><h3 className="font-bold text-slate-800">面单打印预览</h3><p className="text-xs text-slate-500">确认信息无误后，可下载PDF存档或直接打印</p></div>
                  </div>
                  <button onClick={() => setPreviewBlobUrl(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
              </div>
              <div className="flex-1 bg-slate-200 p-6 relative">
                  <iframe ref={printFrameRef} src={previewBlobUrl} className="w-full h-full rounded-lg shadow-inner bg-white" title="Print Frame"/>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                  <button onClick={() => setPreviewBlobUrl(null)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl">取消</button>
                  <button 
                    onClick={() => triggerDownload(previewBlobUrl, `Ozon_Labels_${new Date().toISOString().slice(0,10)}.pdf`)}
                    className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl flex items-center gap-2"
                  >
                    <Download size={18} /> 下载 PDF
                  </button>
                  <button onClick={performActualPrint} className="px-8 py-2.5 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-md flex items-center gap-2"><Printer size={18}/>确认打印</button>
              </div>
           </div>
        </div>
      )}

      {/* Product Trend Modal */}
      {trendProduct && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-bold text-slate-800">产品动销趋势</h3>
                          <p className="text-xs text-slate-500 mt-1">{trendProduct.name}</p>
                      </div>
                      <button onClick={() => setTrendProduct(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={productTrendData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10}/>
                                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}}/>
                                  <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    labelStyle={{color: '#64748b', marginBottom: '4px'}}
                                  />
                                  <Legend />
                                  <Line type="monotone" dataKey="qty" name="销量 (件)" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="mt-4 text-center text-xs text-slate-400">
                          统计周期: {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;