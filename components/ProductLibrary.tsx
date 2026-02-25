import React, { useState } from 'react';
import { Save, Trash2, Eye, EyeOff, Info, Upload, Image as ImageIcon, X } from 'lucide-react';

interface ProductLibraryProps {
  customImages: Record<string, string>;
  onSave: (images: Record<string, string>) => void;
}

const ProductLibrary: React.FC<ProductLibraryProps> = ({ customImages, onSave }) => {
  const [inputText, setInputText] = useState('');
  const [showPreviews, setShowPreviews] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImport = () => {
    if (!inputText.trim()) return;

    const lines = inputText.split('\n');
    const newImages = { ...customImages };
    let count = 0;

    lines.forEach(line => {
      // Split by tab (Excel copy), comma, or multiple spaces
      const parts = line.trim().split(/[\t,]+/);
      if (parts.length >= 2) {
        const sku = parts[0].trim();
        const url = parts[1].trim();
        if (sku && url && url.startsWith('http')) {
          newImages[sku] = url;
          count++;
        }
      }
    });

    onSave(newImages);
    setInputText('');
    alert(`成功导入/更新了 ${count} 个产品的图片链接`);
  };

  const handleDelete = (sku: string) => {
    const newImages = { ...customImages };
    delete newImages[sku];
    onSave(newImages);
  };

  const handleClearAll = () => {
      if(window.confirm('确定要清空所有自定义图片库吗？此操作无法撤销。')) {
          onSave({});
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Import Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
            <Upload size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">批量导入产品图片</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
             <label className="block text-sm font-medium text-slate-700">
                粘贴数据 (格式: SKU <span className="text-slate-400 mx-1">|</span> 图片链接)
                <span className="block text-xs text-slate-500 font-normal mt-1">支持直接从 Excel/表格 复制两列数据。第一列为 SKU，第二列为图片 URL。</span>
             </label>
             <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full h-48 p-4 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                placeholder={`123456\thttps://example.com/image1.jpg\n789012\thttps://example.com/image2.jpg`}
             />
             <div className="flex gap-3">
                <button 
                    onClick={handleImport}
                    disabled={!inputText.trim()}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    <Save size={18}/> 确认导入
                </button>
             </div>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 text-sm text-slate-600 space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><Info size={16}/> 说明</h4>
              <p>在此处维护您的本地产品图库。当订单中的 SKU 与此处的 SKU 匹配时，系统将在订单列表中优先显示您配置的图片。</p>
              <ul className="list-disc pl-5 space-y-1">
                  <li>SKU 必须精确匹配。</li>
                  <li>图片链接必须以 http 或 https 开头。</li>
                  <li>数据仅存储在您的本地浏览器中，清除缓存可能会丢失数据。</li>
              </ul>
              <div className="pt-4 border-t border-slate-200">
                  <p className="font-bold text-slate-800 mb-2">当前图库统计</p>
                  <p>已收录 SKU 数量: <span className="text-purple-600 font-bold text-lg">{Object.keys(customImages).length}</span></p>
              </div>
          </div>
        </div>
      </div>

      {/* Library List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">已存图库列表</h3>
              <div className="flex gap-3">
                  <button 
                    onClick={() => setShowPreviews(!showPreviews)}
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${showPreviews ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                      {showPreviews ? <Eye size={14}/> : <EyeOff size={14}/>}
                      {showPreviews ? '关闭预览' : '开启预览'}
                  </button>
                  {Object.keys(customImages).length > 0 && (
                    <button 
                        onClick={handleClearAll}
                        className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                        <Trash2 size={14}/> 清空图库
                    </button>
                  )}
              </div>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            {Object.keys(customImages).length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                    <ImageIcon size={48} className="mx-auto mb-3 opacity-20"/>
                    <p>暂无数据，请在上方导入</p>
                </div>
            ) : (
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-3 w-48">SKU</th>
                            <th className="px-6 py-3">图片链接 / 预览</th>
                            <th className="px-6 py-3 w-24 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {Object.entries(customImages).map(([sku, url]) => (
                            <tr key={sku} className="hover:bg-slate-50">
                                <td className="px-6 py-3 font-mono font-bold text-slate-700">{sku}</td>
                                <td className="px-6 py-3">
                                    {showPreviews ? (
                                        <div 
                                            className="w-16 h-16 border border-slate-200 rounded bg-white p-1 cursor-pointer hover:border-blue-400 transition-colors"
                                            onClick={() => setPreviewImage(url)}
                                        >
                                            <img src={url} alt={sku} className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-md" title={url}>
                                            {url}
                                        </a>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button onClick={() => handleDelete(sku)} className="text-slate-400 hover:text-red-600 transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
          </div>
      </div>

      {/* Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                >
                    <X size={24}/>
                </button>
                <img 
                    src={previewImage} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} // Prevent close on image click
                />
            </div>
        </div>
      )}

    </div>
  );
};

export default ProductLibrary;