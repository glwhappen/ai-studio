import pg from 'pg';
const { Pool } = pg;

// PostgreSQL 连接配置
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// 查询构建器状态
interface WhereClause {
  column: string;
  operator: string;
  value: unknown;
  isNot?: boolean;
}

interface OrderClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

// 查询结果类型
interface ListResult {
  data: Record<string, unknown>[] | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

// 单条结果类型
interface SingleResult {
  data: Record<string, unknown> | null;
  error: { message: string; code?: string } | null;
}

// 查询构建器
interface QueryBuilder {
  select: (columns: string | string[]) => QueryBuilder;
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
  update: (data: Record<string, unknown>) => QueryBuilder;
  delete: () => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  range: (start: number, end: number) => QueryBuilder;
  single: () => Promise<SingleResult>;
  maybeSingle: () => Promise<SingleResult>;
  execute: () => Promise<ListResult>;
}

// 获取 PostgreSQL 连接配置
function getPostgresConfig(): PostgresConfig {
  let url = process.env.COZE_SUPABASE_URL || process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error('Database URL is not set. Please set COZE_SUPABASE_URL or DATABASE_URL in your environment variables.');
  }
  
  // 如果 URL 不包含协议，添加 postgresql:// 前缀
  if (!url.includes('://')) {
    url = `postgresql://${url}`;
  }
  
  // 解析 PostgreSQL 连接 URL
  try {
    const parsed = new URL(url);
    
    // 处理 http:// 格式（Docker Compose）
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port) || 5432,
        database: parsed.pathname.slice(1) || 'postgres',
        username: parsed.username || 'postgres',
        password: decodeURIComponent(parsed.password) || 'postgres',
        ssl: parsed.protocol === 'https:',
      };
    }
    
    // 处理 postgresql:// 或 postgres:// 格式
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.slice(1) || 'postgres',
      username: parsed.username || 'postgres',
      password: decodeURIComponent(parsed.password) || 'postgres',
      ssl: parsed.searchParams.get('sslmode') === 'require',
    };
  } catch {
    throw new Error(`Invalid database URL format: ${url}`);
  }
}

// 全局连接池
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const config = getPostgresConfig();
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// 创建查询构建器
function createQueryBuilder(table: string): QueryBuilder {
  const state: {
    columns: string[];
    wheres: WhereClause[];
    orders: OrderClause[];
    limitCount?: number;
    rangeStart?: number;
    rangeEnd?: number;
    insertData?: Record<string, unknown> | Record<string, unknown>[];
    updateData?: Record<string, unknown>;
    isDelete: boolean;
    needCount: boolean;
  } = {
    columns: ['*'],
    wheres: [],
    orders: [],
    isDelete: false,
    needCount: false,
  };
  
  // 构建 WHERE 子句，返回 SQL 和参数
  // paramIndex 是当前参数的起始索引（用于 UPDATE 等有前置参数的情况）
  const buildWhereClause = (paramStartIndex: number = 1): { sql: string; params: unknown[] } => {
    if (state.wheres.length === 0) {
      return { sql: '', params: [] };
    }
    
    const params: unknown[] = [];
    let paramIndex = paramStartIndex;
    
    const conditions = state.wheres.map(w => {
      const notPrefix = w.isNot ? 'NOT ' : '';
      
      // 处理 IS 操作符（用于 null 检查）
      if (w.operator === 'IS' || w.operator === 'is') {
        const sqlValue = w.value === null ? 'NULL' : String(w.value);
        if (w.isNot) {
          return `${w.column} IS NOT ${sqlValue}`;
        }
        return `${w.column} IS ${sqlValue}`;
      }
      
      // 处理 IN 操作符
      if (w.operator === 'IN') {
        const values = w.value as unknown[];
        const placeholders: string[] = [];
        values.forEach(v => {
          params.push(v);
          placeholders.push(`$${paramIndex++}`);
        });
        
        return `${notPrefix}${w.column} IN (${placeholders.join(', ')})`;
      }
      
      // 处理普通比较操作符
      params.push(w.value);
      return `${notPrefix}${w.column} ${w.operator} $${paramIndex++}`;
    });
    
    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      params,
    };
  };
  
  const execute = async (): Promise<ListResult> => {
    try {
      let query = '';
      const params: unknown[] = [];
      let finalCount: number | null = null;
      
      if (state.insertData) {
        const data = Array.isArray(state.insertData) ? state.insertData : [state.insertData];
        const columns = Object.keys(data[0]);
        const values = data.map((d, i) => 
          `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
        ).join(', ');
        params.push(...data.flatMap(d => columns.map(c => d[c])));
        
        query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values} RETURNING *`;
      } else if (state.updateData) {
        const setClauses = Object.keys(state.updateData).map((k, i) => `${k} = $${i + 1}`);
        const setValues = Object.values(state.updateData);
        const { sql: whereSql, params: whereParams } = buildWhereClause(setValues.length + 1);
        
        query = `UPDATE ${table} SET ${setClauses.join(', ')}${whereSql} RETURNING *`;
        params.push(...setValues, ...whereParams);
      } else if (state.isDelete) {
        const { sql: whereSql, params: whereParams } = buildWhereClause();
        
        query = `DELETE FROM ${table}${whereSql} RETURNING *`;
        params.push(...whereParams);
      } else {
        const { sql: whereSql, params: whereParams } = buildWhereClause();
        
        // 如果需要 count，先执行 count 查询
        if (state.needCount) {
          const countQuery = `SELECT COUNT(*) as count FROM ${table}${whereSql}`;
          const countRes = await getPool().query(countQuery, whereParams);
          finalCount = parseInt(countRes.rows[0]?.count || '0');
        }
        
        // 构建列选择
        const columns = state.columns.join(', ');
        
        // 构建 ORDER BY 子句
        const orderSql = state.orders.length > 0 
          ? ` ORDER BY ${state.orders.map(o => `${o.column} ${o.direction}`).join(', ')}`
          : '';
        
        // 构建 LIMIT 和 OFFSET
        let limitSql = '';
        if (state.limitCount !== undefined) {
          limitSql = ` LIMIT ${state.limitCount}`;
        }
        if (state.rangeStart !== undefined && state.rangeEnd !== undefined) {
          const limit = state.rangeEnd - state.rangeStart + 1;
          limitSql = ` LIMIT ${limit} OFFSET ${state.rangeStart}`;
        }
        
        query = `SELECT ${columns} FROM ${table}${whereSql}${orderSql}${limitSql}`;
        params.push(...whereParams);
      }
      
      const result = await getPool().query(query, params);
      
      return {
        data: result.rows,
        error: null,
        count: finalCount ?? result.rowCount,
      };
    } catch (err) {
      const error = err as Error;
      console.error('PostgreSQL query error:', error.message);
      return {
        data: null,
        error: { message: error.message, code: (error as { code?: string }).code },
        count: null,
      };
    }
  };
  
  const builder: QueryBuilder = {
    select: (columns: string | string[]) => {
      state.columns = typeof columns === 'string' 
        ? columns.split(',').map(c => c.trim())
        : columns;
      return builder;
    },
    
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
      state.insertData = data;
      return builder;
    },
    
    update: (data: Record<string, unknown>) => {
      state.updateData = data;
      return builder;
    },
    
    delete: () => {
      state.isDelete = true;
      return builder;
    },
    
    eq: (column: string, value: unknown) => {
      state.wheres.push({ column, operator: '=', value });
      return builder;
    },
    
    neq: (column: string, value: unknown) => {
      state.wheres.push({ column, operator: '!=', value });
      return builder;
    },
    
    in: (column: string, values: unknown[]) => {
      state.wheres.push({ column, operator: 'IN', value: values });
      return builder;
    },
    
    not: (column: string, operator: string, value: unknown) => {
      const opMap: Record<string, string> = {
        'eq': '!=',
        'neq': '=',
        'gt': '<=',
        'gte': '<',
        'lt': '>=',
        'lte': '>',
        'in': 'IN',
      };
      const mappedOp = opMap[operator] || operator;
      state.wheres.push({ column, operator: mappedOp, value, isNot: true });
      return builder;
    },
    
    is: (column: string, value: unknown) => {
      state.wheres.push({ column, operator: 'IS', value });
      return builder;
    },
    
    order: (column: string, options?: { ascending?: boolean }) => {
      state.orders.push({
        column,
        direction: options?.ascending === false ? 'DESC' : 'ASC',
      });
      return builder;
    },
    
    limit: (count: number) => {
      state.limitCount = count;
      return builder;
    },
    
    range: (start: number, end: number) => {
      state.rangeStart = start;
      state.rangeEnd = end;
      return builder;
    },
    
    single: async () => {
      state.limitCount = 1;
      const result = await execute();
      return {
        data: result.data?.[0] || null,
        error: result.error,
      };
    },
    
    maybeSingle: async () => {
      state.limitCount = 1;
      const result = await execute();
      return {
        data: result.data?.[0] || null,
        error: result.error,
      };
    },
    
    execute,
  };
  
  return builder;
}

// 创建 PostgreSQL 客户端
export function createPostgresClient() {
  return {
    from: (table: string) => createQueryBuilder(table),
    rpc: async (fn: string, _params?: Record<string, unknown>) => {
      // RPC 调用实现（简化版本）
      throw new Error(`RPC function ${fn} is not supported in PostgreSQL direct mode`);
    },
  };
}

// 导出类型
export type PostgresClient = ReturnType<typeof createPostgresClient>;
