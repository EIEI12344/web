export function setupFetchInterceptor() {
  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let headers = new Headers(init?.headers);
    
    // Add token if it exists
    const token = localStorage.getItem('license_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    // Prevent overriding Content-Type if FormData (browser sets it with boundary)
    if (init?.body instanceof FormData) {
      headers.delete('Content-Type');
    }

    const modifiedInit: RequestInit = {
      ...init,
      headers
    };
    
    const response = await originalFetch(input, modifiedInit);
    
    // Global handling for 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem('license_token');
      // Only redirect if not already on auth pages to prevent infinite loops
      const path = window.location.pathname;
      if (!path.includes('/login') && !path.includes('/register')) {
        window.location.href = '/login';
      }
    }
    
    return response;
  };
}
