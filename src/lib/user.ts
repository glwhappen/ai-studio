// 用户 token 管理（仅在客户端使用）

const USER_TOKEN_KEY = 'ai-image-user-token';

// 生成随机 token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 获取或创建用户 token
export function getOrCreateUserToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  let token = localStorage.getItem(USER_TOKEN_KEY);
  if (!token) {
    token = generateToken();
    localStorage.setItem(USER_TOKEN_KEY, token);
  }
  return token;
}

// 清除用户 token
export function clearUserToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_TOKEN_KEY);
  }
}
