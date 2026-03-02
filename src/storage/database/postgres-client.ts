import postgres from 'postgres';

// PostgreSQL 连接配置
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// 查询结果类型
type QueryResult<T = unknown> = Promise<{ data: T | null; error: Error | null }>;

// 批量查询结果类型（包含 count）
interface ListResult<T = unknown> {
  data: T[] | null;
  error: Error | null;
  count?: number | null;
}

// 查询构建器接口（模拟 Supabase）
interface QueryBuilder {
  select: (columns?: string) => QueryBuilder;
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
  offset: (count: number) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  single: () => QueryResult;
  maybeSingle: () => QueryResult;
  then: (resolve: (result: ListResult) => void) => void;
}

// 全局连接实例
let _sql: postgres.Sql | null = null;

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
      password: decodeURIComponent(parsed.password) || '',
      ssl: parsed.searchParams.get('sslmode') === 'require',
    };
  } catch (parseError) {
    console.error('[DB] Failed to parse database URL:', url, parseError);
    throw new Error(`Invalid database URL format: ${url}. Expected format: postgresql://user:password@host:port/database`);
  }
}

// 获取数据库连接
function getSqlConnection(): postgres.Sql {
  if (!_sql) {
    const config = getPostgresConfig();
    console.log(`[DB] Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);
    
    _sql = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.ssl ? 'prefer' : false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
      onnotice: (notice) => {
        console.log('[DB] Notice:', notice.message);
      },
    });
  }
  return _sql;
}

// 创建查询构建器
function createQueryBuilder(sql: postgres.Sql, table: string): QueryBuilder {
  type WhereClause = {
    column: string;
    operator: string;
    value: unknown;
    isNot?: boolean;
  };
  
  const state: {
    columns: string[];
    wheres: WhereClause[];
    orders: { column: string; direction: 'ASC' | 'DESC' }[];
    limitCount?: number;
    offsetCount?: number;
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
        const placeholders = values.map(() => {
          params.push(null); // 占位，下面会重新填充
          return `$${paramIndex++}`;
        });
        // 清空并重新填充 params
        const startIndex = params.length - values.length;
        params.splice(startIndex, values.length, ...values);
        
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
      let countResult: number | null = null;
      
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
          const countRes = await sql.unsafe(countQuery, whereParams as postgres.ParameterOrJSON<never>[]);
          countResult = Number((countRes[0] as unknown as { count: string | bigint }).count);
        }
        
        let orderSql = '';
        if (state.orders.length > 0) {
          orderSql = ` ORDER BY ${state.orders.map(o => `${o.column} ${o.direction}`).join(', ')}`;
        }
        
        let limitSql = '';
        if (state.limitCount) {
          limitSql = ` LIMIT ${state.limitCount}`;
        }
        
        let offsetSql = '';
        if (state.offsetCount) {
          offsetSql = ` OFFSET ${state.offsetCount}`;
        }
        
        query = `SELECT ${state.columns.join(', ')} FROM ${table}${whereSql}${orderSql}${limitSql}${offsetSql}`;
        params.push(...whereParams);
      }
      
      const result = await sql.unsafe(query, params as postgres.ParameterOrJSON<never>[]);
      return { data: result as unknown[], error: null, count: countResult };
    } catch (error) {
      console.error('[DB] Query error:', error);
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  };
  
  const builder: QueryBuilder = {
    select: (columns?: string) => {
      state.columns = columns ? columns.split(',').map(c => c.trim()) : ['*'];
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
    
    offset: (count: number) => {
      state.offsetCount = count;
      return builder;
    },
    
    range: (from: number, to: number) => {
      state.offsetCount = from;
      state.limitCount = to - from + 1;
      state.needCount = true;
      return builder;
    },
    
    single: async () => {
      state.limitCount = 1;
      const result = await execute();
      if (result.error) {
        return { data: null, error: result.error };
      }
      if (!result.data || result.data.length === 0) {
        return { data: null, error: new Error('No rows found') };
      }
      return { data: result.data[0], error: null };
    },
    
    maybeSingle: async () => {
      state.limitCount = 1;
      const result = await execute();
      if (result.error) {
        return { data: null, error: result.error };
      }
      return { data: result.data?.[0] ?? null, error: null };
    },
    
    then: (resolve) => {
      execute().then(resolve);
    },
  };
  
  return builder;
}

// 数据库客户端接口
interface DatabaseClient {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
}

// 获取数据库客户端
function getPostgresClient(): DatabaseClient {
  const sql = getSqlConnection();
  
  return {
    from: (table: string) => createQueryBuilder(sql, table),
    
    rpc: async (fn: string, params?: Record<string, unknown>) => {
      try {
        const sql = getSqlConnection();
        
        const paramNames = params ? Object.keys(params) : [];
        const paramValues = params ? Object.values(params) : [];
        
        const query = `SELECT * FROM ${fn}(${paramNames.map((_, i) => `$${i + 1}`).join(', ')})`;
        const result = await sql.unsafe(query, paramValues as postgres.ParameterOrJSON<never>[]);
        
        return { data: result[0], error: null };
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
  };
}

export { getPostgresClient, getSqlConnection };
