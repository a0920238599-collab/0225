import { OzonCredentials, OzonApiResponse, OzonPostingRequest, OzonPosting } from '../types';

const BASE_URL = '/api/ozon';

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
            throw new Error(`${errorMsg}`);
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