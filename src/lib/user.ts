// 用户 token 管理（仅在客户端使用）

const USER_TOKEN_KEY = 'ai-image-user-token';

// 生成 UUID v4 格式的 token（36个字符，如 e83f0e63-38ee-4552-b65e-43ac9c011e40）
function generateToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
