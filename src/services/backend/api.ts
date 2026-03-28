export const BASE_URL = process.env.SERVER_URL;
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  token?: string; // Token is optional
  isFormData?: boolean; // Flag to indicate if FormData is being used
};

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    token,
    isFormData = false,
  } = options;

  // Set up the headers
  const requestHeaders: Record<string, string> = {
    ...headers, // Include any custom headers
  };

  // If token exists, add the Authorization header
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // If body is FormData, don't set 'Content-Type' header (it will be handled by the browser)
  if (!isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = 'Something went wrong';

    try {
      const errorData = await response.json();

      // backend uses "detail"
      if (errorData?.detail) {
        message = errorData.detail;
      }
    } catch {
      const text = await response.text();
      message = text || message;
    }

    throw new Error(message);
  }

  return response.json();
}

export const apiService = {
  get: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(
    endpoint: string,
    body: any,
    isFormData: boolean = false,
    token?: string,
  ) => request<T>(endpoint, { method: 'POST', body, token, isFormData }),

  put: <T>(endpoint: string, body: any, token?: string) =>
    request<T>(endpoint, { method: 'PUT', body, token }),

  delete: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'DELETE', token }),
};
