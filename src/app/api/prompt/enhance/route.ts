import { NextRequest, NextResponse } from 'next/server';

// 默认提示词模板
const DEFAULT_ENHANCE_SYSTEM_PROMPT = `你是一个专业的AI图片生成提示词优化专家。你的任务是优化用户提供的提示词，使其更适合AI图片生成。

优化规则：
1. 保持原有提示词的核心意图和主题不变
2. 添加更多视觉细节描述，如光影、构图、氛围、材质等
3. 添加艺术风格、画质、视角等专业术语
4. 使提示词更加具体和明确，减少歧义
5. 输出的提示词应该更容易让AI理解和生成高质量图片
6. 直接输出优化后的提示词，不要有任何解释或额外文字
7. 输出语言与输入语言保持一致`;

const DEFAULT_ENHANCE_USER_PROMPT = `请优化以下图片生成提示词，使其更加详细和专业，但不要改变原本的意思：

{{prompt}}`;

const DEFAULT_REWRITE_SYSTEM_PROMPT = `你是一个专业的AI图片生成提示词改写专家。你的任务是根据用户的修改指令来改写提示词。

改写规则：
1. 严格遵循用户的修改指令
2. 保留提示词中未被要求修改的部分
3. 改写后的提示词应该更加清晰和具体
4. 直接输出改写后的提示词，不要有任何解释或额外文字
5. 输出语言与输入语言保持一致`;

const DEFAULT_REWRITE_USER_PROMPT = `请根据以下修改指令改写提示词：

原提示词：
{{prompt}}

修改指令：
{{instruction}}`;

// 默认 LLM 配置
const DEFAULT_BASE_URL = 'https://ai.nflow.red';
const DEFAULT_MODEL = 'gpt-4o-mini';

// AI优化提示词 - 丰富细节，不改变原意
export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      mode, 
      instruction,
      // 用户自定义模板
      enhanceSystemPrompt,
      enhanceUserPrompt,
      rewriteSystemPrompt,
      rewriteUserPrompt,
      // 用户自定义 LLM 配置
      llmBaseUrl,
      llmApiKey,
      llmModel,
    } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: '缺少提示词' }, { status: 400 });
    }
    
    // 确定使用的配置
    const baseUrl = llmBaseUrl || DEFAULT_BASE_URL;
    const model = llmModel || DEFAULT_MODEL;
    
    let systemPrompt: string;
    let userPrompt: string;
    
    if (mode === 'enhance') {
      // AI优化模式：丰富细节
      systemPrompt = enhanceSystemPrompt || DEFAULT_ENHANCE_SYSTEM_PROMPT;
      const userTemplate = enhanceUserPrompt || DEFAULT_ENHANCE_USER_PROMPT;
      userPrompt = userTemplate.replace(/\{\{prompt\}\}/g, prompt);
    } else {
      // AI改写模式：根据用户指令修改
      if (!instruction) {
        return NextResponse.json({ error: '缺少修改指令' }, { status: 400 });
      }
      
      systemPrompt = rewriteSystemPrompt || DEFAULT_REWRITE_SYSTEM_PROMPT;
      const userTemplate = rewriteUserPrompt || DEFAULT_REWRITE_USER_PROMPT;
      userPrompt = userTemplate
        .replace(/\{\{prompt\}\}/g, prompt)
        .replace(/\{\{instruction\}\}/g, instruction);
    }
    
    // 构建 API 请求
    const apiUrl = `${baseUrl}/v1/chat/completions`;
    
    // 如果用户提供了 API Key，使用用户的；否则使用环境变量中的默认 Key
    const apiKey = llmApiKey || process.env.OPENAI_API_KEY || 'sk-V7ZFfhmndbAQXklSz2IC7gV68WGggGC5nxnlv0cXRq6ob3DN';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API error:', errorText);
      return NextResponse.json(
        { error: `模型调用失败: ${response.status}` },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return NextResponse.json({ 
      success: true, 
      enhancedPrompt: content.trim() 
    });
  } catch (error) {
    console.error('Enhance prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '优化失败' },
      { status: 500 }
    );
  }
}
