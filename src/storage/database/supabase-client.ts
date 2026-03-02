import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createPostgresClient } from './postgres-client';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

// 检测是否应该使用 Supabase REST API（而不是 PostgreSQL 直连）
// Supabase REST API 地址格式：
// - https://xxx.supabase.co (官方 Supabase Cloud)
// - https://xxx.supabase.in (官方 Supabase Cloud 备用域名)
// - https://xxx.supabase2.aidap-global.xxx.volces.com (火山引擎托管)
// - 其他 https:// 开头的 Supabase 兼容地址
function shouldUseSupabaseRestApi(url: string): boolean {
  // 如果是 PostgreSQL 连接字符串，使用 PostgreSQL 客户端
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return false;
  }
  
  // 如果是 http:// 且包含端口 5432，使用 PostgreSQL 客户端
  if (url.startsWith('http://') && url.includes(':5432')) {
    return false;
  }
  
  // 如果是 https:// 开头，使用 Supabase REST API
  // 包括：supabase.co, supabase.in, supabase2.aidap-global.volces.com 等
  if (url.startsWith('https://')) {
    return true;
  }
  
  // 其他情况（如 http://postgres:5432/db），使用 PostgreSQL 客户端
  return false;
}

function loadEnv(): void {
  // 如果环境变量已经设置，直接返回
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
    envLoaded = true;
    return;
  }

  // 尝试从 dotenv 加载（本地开发或自部署环境）
  try {
    require('dotenv').config();
    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      envLoaded = true;
      return;
    }
  } catch {
    // dotenv not available
  }

  // 尝试从 Coze workload identity 获取（Coze 环境下）
  try {
    const { execSync } = require('child_process');
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail - 非 Coze 环境
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set. Please set it in your environment variables or .env file.');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set. Please set it in your environment variables or .env file.');
  }

  return { url, anonKey };
}

// 缓存客户端实例
let _supabaseClient: SupabaseClient | null = null;

// 数据库客户端类型（Supabase 或 PostgreSQL）
type DatabaseClient = SupabaseClient | ReturnType<typeof createPostgresClient>;

// 获取数据库客户端（自动检测 Supabase Cloud 或纯 PostgreSQL）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseClient(token?: string): any {
  const { url, anonKey } = getSupabaseCredentials();
  
  // 判断是否使用 Supabase REST API
  if (shouldUseSupabaseRestApi(url)) {
    // 使用 Supabase Cloud REST API
    if (!_supabaseClient) {
      _supabaseClient = createClient(url, anonKey, {
        db: {
          timeout: 60000,
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    
    if (token) {
      return createClient(url, anonKey, {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        db: {
          timeout: 60000,
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    
    return _supabaseClient;
  }
  
  // 使用纯 PostgreSQL 连接
  return createPostgresClient();
}

export { loadEnv, getSupabaseCredentials, getSupabaseClient };
