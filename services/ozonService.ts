import { OzonCredentials, OzonApiResponse, OzonPostingRequest, OzonPosting } from '../types';

const BASE_URL = '/api/ozon';

export const generateMockPostings = (count: number): OzonPosting[] => {
  const statuses = ['awaiting_packaging', 'awaiting_deliver', 'delivering', 'delivered'];
  const mockPostings: OzonPosting[] = [];
  const now = new Date();

  // Updated mock products with images
  const mockProducts = [
    { name: '无线蓝牙耳机 Pro (极光白)', offer_id: 'EAR-001-WHT', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&q=80' },
    { name: '智能运动手表 X (午夜黑, 44mm)', offer_id: 'WTC-002-BLK', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&q=80' },
    { name: '快充数据线 Type-C (红色, 2m)', offer_id: 'CBL-003-RED', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=150&q=80' },
    { name: '复古胶片相机 (银色机身)', offer_id: 'CAM-004-SLV', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150&q=80' },
    { name: '机械键盘 (RGB背光, 青轴)', offer_id: 'KBD-005-RGB', image: 'https://images.unsplash.com/photo-1587829741301-dc798b91a603?w=150&q=80' },
    { name: '纯棉T恤 (经典黑, XL码)', offer_id: 'TSH-006-XL', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=150&q=80' },
    { name: '运动跑鞋 (荧光绿, 42码)', offer_id: 'SHOE-007-42', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&q=80' },
    { name: '双肩背包 (深灰色, 20L)', offer_id: 'BAG-008-GRY', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=150&q=80' }
  ];

  for (let i = 0; i < count; i++) {
    const randomTime = new Date(now.getTime() - Math.random() * 15 * 24 * 60 * 60 * 1000); // Last 15 days
    const product = mockProducts[Math.floor(Math.random() * mockProducts.length)];
    const price = Math.floor(Math.random() * 2000) + 100;

    mockPostings.push({
      posting_number: `055${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 1000)}-${i}`,
      order_id: 123456 + i,
      order_number: `055${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 1000)}-${i}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      delivery_method: {
        id: 1,
        name: 'Ozon Rocket',
        warehouse_id: 101,
        warehouse: 'Main Warehouse',
        tpl_provider: 'Ozon',
        tpl_provider_id: 1
      },
      tracking_number: `TRACK${Math.floor(Math.random() * 100000)}`,
      tpl_integration_type: 'ozon',
      in_process_at: randomTime.toISOString(),
      shipment_date: new Date(randomTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      delivering_date: null,
      cancellation: {
        cancel_reason_id: 0,
        cancel_reason: '',
        cancellation_type: '',
        cancelled_after_ship: false,
        affect_cancellation_rating: false,
        cancellation_initiator: ''
      },
      customer: {
        customer_id: 100 + i,
        address_tail: null,
        phone: null,
        name: null
      },
      products: [
        {
          name: product.name,
          offer_id: product.offer_id,
          price: price.toString(),
          currency_code: 'RUB',
          quantity: 1,
          sku: 10000 + i,
          mandatory_mark: [],
          primary_image: product.image
        }
      ],
      analytics_data: {
        region: 'Moscow',
        city: 'Moscow',
        delivery_type: 'Courier',
        payment_type_group_name: 'Card',
        warehouse_id: 1,
        warehouse_name: 'Moscow Hub'
      },
      financial_data: {
        products: [{
            commission_amount: price * 0.1,
            commission_percent: 10,
            payout: price * 0.9,
            product_id: 10000 + i,
            old_price: price + 200,
            price: price,
            total_discount_value: 200,
            total_discount_percent: 10
        }]
      }
    });
  }
  return mockPostings.sort((a, b) => new Date(b.in_process_at).getTime() - new Date(a.in_process_at).getTime());
};

export const fetchOrders = async (credentials: OzonCredentials, dateFrom?: Date, dateTo?: Date, status?: string): Promise<OzonPosting[]> => {
  const toDate = dateTo || new Date();
  const fromDate = dateFrom || new Date();
  if (!dateFrom) {
      fromDate.setDate(toDate.getDate() - 7); // Default to 7 days
  }

  let allPostings: OzonPosting[] = [];
  let offset = 0;
  const limit = 1000;
  let hasNext = true;

  try {
    // Loop until has_next is false to get ALL data
    while (hasNext) {
        const requestBody: OzonPostingRequest = {
            dir: 'DESC',
            filter: {
                since: fromDate.toISOString(),
                to: toDate.toISOString(),
                ...(status ? { status: status } : {})
            },
            limit: limit,
            offset: offset,
            with: {
                analytics_data: true,
                barcodes: false,
                financial_data: true,
                translit: true
            }
        };

        const response = await fetch(`${BASE_URL}/v3/posting/fbs/list`, {
            method: 'POST',
            headers: {
                'Client-Id': credentials.clientId,
                'Api-Key': credentials.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorMsg = `Ozon API Error: ${response.status} ${response.statusText}`;
            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                try {
                    const errorJson = await response.json();
                    console.error("Ozon API Error details:", errorJson);
                    const mainError = errorJson.error || errorJson;
                    const code = mainError.code || '';
                    const message = mainError.message || JSON.stringify(mainError);
                    const details = mainError.details ? JSON.stringify(mainError.details) : '';
                    
                    if (code || message) {
                        errorMsg = `Ozon API Error (${code}): ${message} ${details}`;
                    }
                } catch (e) {
                    // Ignore
                }
            }
            throw new Error(`${errorMsg}. CORS might be blocking this request.`);
        }

        const data: OzonApiResponse = await response.json();
        const pagePostings = data.result.postings || [];
        
        // Accumulate results
        allPostings = [...allPostings, ...pagePostings];
        
        // Update pagination control
        hasNext = data.result.has_next;
        offset += limit;

        // Safety break to prevent infinite loops (e.g., if user has > 50k orders in 15 days)
        if (offset > 50000) {
            console.warn("Reached maximum safety pagination limit");
            break; 
        }
    }

    return allPostings;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const fetchPackageLabel = async (credentials: OzonCredentials, postingNumbers: string[]): Promise<Blob> => {
    // 1. Sanitize input to avoid INVALID_ARGUMENT (ensure all are strings and not empty)
    const cleanPostingNumbers = postingNumbers
        .map(id => String(id).trim())
        .filter(id => id.length > 0);

    if (cleanPostingNumbers.length === 0) {
        throw new Error("No valid posting numbers provided for label generation.");
    }

    // 2. Detect Mock Data to avoid sending garbage to real API
    // Mock IDs typically start with '055' in our generator
    const isMock = cleanPostingNumbers.some(id => id.startsWith('055-') || (id.startsWith('055') && id.includes('-')));
    
    if (isMock) {
        console.warn("Mock Data detected, returning placeholder PDF.");
        const mockContent = `[DEMO PDF]\nThis is a generated placeholder because these are mock orders.\n\nOrder IDs:\n${cleanPostingNumbers.join('\n')}`;
        return new Blob([mockContent], { type: 'text/plain' });
    }

    try {
        const response = await fetch(`${BASE_URL}/v2/posting/fbs/package-label`, {
            method: 'POST',
            headers: {
                'Client-Id': credentials.clientId,
                'Api-Key': credentials.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/pdf, application/json'
            },
            body: JSON.stringify({ posting_number: cleanPostingNumbers }),
        });

        const contentType = response.headers.get("content-type");

        if (!response.ok) {
            let errorMsg = `HTTP Error ${response.status}`;
            
            // Try to parse detailed JSON error from Ozon
            if (contentType && contentType.includes("application/json")) {
                try {
                    const errorJson = await response.json();
                    console.error("Ozon Label API Error details:", errorJson); 
                    
                    // Handle various Ozon error formats
                    // Format A: { error: { code: "...", message: "...", details: [...] } }
                    // Format B: { code: "...", message: "...", details: [...] }
                    const mainError = errorJson.error || errorJson;
                    const code = mainError.code || '';
                    const message = mainError.message || JSON.stringify(mainError);
                    const details = mainError.details ? JSON.stringify(mainError.details) : '';

                    if (code || message) {
                        errorMsg = `Ozon API Error (${code}): ${message} ${details}`;
                    } else {
                        errorMsg = JSON.stringify(errorJson);
                    }
                } catch (e) {
                    // Ignore parse error
                }
            } else {
                // Try reading text error
                try {
                   const text = await response.text();
                   if (text) errorMsg = `API Error: ${text}`;
                } catch (e) {}
            }
            throw new Error(errorMsg);
        }

        const blob = await response.blob();
        // Force type to application/pdf to ensure browser handles it correctly
        return new Blob([blob], { type: 'application/pdf' });
    } catch (error) {
        console.error("fetchPackageLabel failed:", error);
        // Throwing error allows the UI to display the specific message
        throw error;
    }
};