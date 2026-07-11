# 竞品监控系统

一套可独立运行的 Python 竞品监控工具，支持全量监控、每日扫描、交互流程梳理、完整流程框架四种模式。

## 功能特性

- **全量监控（weekly）**：搜索5个竞品最近7天动态，AI 分析变更并分类，生成竞品周报
- **新功能扫描（daily）**：搜索每个竞品最近2天动态，判断是否有新功能，输出扫描报告
- **交互流程梳理（flow）**：对指定竞品和功能，搜索教程/帮助文档，整理交互流程表
- **完整流程框架（framework）**：深度爬取产品站点，AI 分析6大章节（信息架构、用户旅程、决策点、异常处理、状态流转、跨功能关联），生成完整流程框架文档

### 默认监控竞品

| 竞品 | 官网 | 级别 |
|------|------|------|
| 创客贴 | chuangkit.com | T1 |
| 稿定设计 | gaoding.com | T1 |
| HeyGen | heygen.com | T1 |
| Higgsfield AI | higgsfield.ai | T2 |
| Riverside | riverside.com | T2 |

### 技术特性

- 支持多种搜索引擎后端：DuckDuckGo（免费）、Google Custom Search、Bing、SerpAPI
- 支持多种 LLM 后端：OpenAI、Claude（用于智能分析）
- LLM 不可用时自动降级为规则分析
- 完善的错误处理、重试机制和日志记录
- 所有报告以 Markdown 格式输出，同时保存 JSON 原始数据

## 安装

```bash
# 1. 进入项目目录
cd 竞品监控代码

# 2. 安装依赖
pip install -r requirements.txt
```

## 环境变量配置

### 搜索引擎配置

```bash
# 搜索引擎选择: duckduckgo(默认,免费) / google / bing / serpapi
export SEARCH_ENGINE=duckduckgo

# API Key（使用 google/bing/serpapi 时需要配置）
export SEARCH_API_KEY=your_search_api_key

# Google Custom Search 专用
export GOOGLE_CSE_ID=your_cse_id

# Bing Search 专用
export BING_ENDPOINT=https://api.bing.microsoft.com/v7.0/search
```

### LLM 配置

```bash
# LLM 提供商: openai(默认) / claude
export LLM_PROVIDER=openai

# API Key
export LLM_API_KEY=your_llm_api_key

# 模型选择
export LLM_MODEL=gpt-4o-mini                    # OpenAI 模型
export OPENAI_BASE_URL=https://api.openai.com/v1  # OpenAI Base URL（可替换为兼容 API）

# Claude 专用
export CLAUDE_MODEL=claude-sonnet-4-20250514
```

### 输出路径配置

```bash
# 输出根目录（默认为 ./output）
export OUTPUT_DIR=./output

# 自定义竞品配置文件（JSON 格式）
export COMPETITORS_CONFIG=./my_competitors.json
```

## 使用方法

### 1. 全量监控（生成竞品周报）

```bash
python main.py weekly
```

执行流程：
1. 搜索5个竞品最近7天的动态
2. 抓取重点页面详细内容
3. AI 分析变更并分类（功能更新/设计变更/定价调整等）
4. 评估每条变更的影响等级
5. 生成 Markdown 格式周报

输出文件：
- `output/weekly_reports/竞品周报_2024-01-15.md`
- `output/weekly_reports/weekly_data_2024-01-15.json`

### 2. 每日新功能扫描

```bash
python main.py daily
```

执行流程：
1. 搜索每个竞品最近2天的动态
2. AI 判断是否有新功能发布
3. 生成扫描报告

输出文件：
- `output/daily_scans/扫描报告_2024-01-15.md`
- `output/daily_scans/scan_data_2024-01-15.json`

### 3. 交互流程梳理

```bash
python main.py flow --competitor HeyGen --feature "AI Avatar"
```

执行流程：
1. 搜索目标竞品的教程/帮助文档
2. 抓取页面详细内容
3. AI 提取并整理操作步骤
4. 生成交互流程文档（含步骤表格）

输出文件：
- `output/interaction_flows/交互流程_HeyGen_AI_Avatar.md`
- `output/interaction_flows/flow_HeyGen_AI_Avatar.json`

### 4. 完整流程框架分析

```bash
# 分析单个产品
python main.py framework --url https://www.heygen.com --name "HeyGen"

# 不指定名称，自动从 URL 推断
python main.py framework --url https://app.jogg.ai

# 对所有默认竞品批量分析
python main.py framework --all
```

执行流程：
1. 深度爬取目标站点（BFS 策略，最多50页/3层深度）
2. 尝试获取 sitemap.xml 补充爬取
3. 提取导航结构和功能模块
4. AI 分6步分析：信息架构 → 用户旅程 → 决策点 → 异常处理 → 状态流转 → 跨功能关联
5. 生成完整流程框架 Markdown 文档 + JSON 数据

输出文件：
- `output/frameworks/HeyGen完整流程框架.md`
- `output/frameworks/HeyGen_framework_data.json`

#### 框架文档包含6大章节

| 章节 | 内容 |
|------|------|
| 一、产品整体信息架构 | 导航结构树、功能模块划分表、页面层级关系图 |
| 二、完整用户旅程 | 每个核心功能的详细操作步骤（正常流+异常流） |
| 三、关键决策点汇总 | 用户在流程中的决策点表格 |
| 四、异常处理流程 | 异常场景、触发条件、系统响应、恢复路径 |
| 五、数据流与状态流转 | 核心实体的状态转换列表 |
| 六、跨功能关联 | 功能间的关联关系表和关联矩阵 |

#### 爬取配置

```bash
# 调整最大爬取页面数（默认50）
export MAX_CRAWL_PAGES=80

# 调整最大爬取深度（默认3）
export MAX_CRAWL_DEPTH=4
```

### 通用选项

```bash
# 指定输出目录
python main.py weekly --output ./my_reports

# 详细日志模式
python main.py daily --verbose

# 查看帮助
python main.py --help
```

## 定时任务

### 使用内置调度器

```bash
# 启动定时调度器（默认每天09:00扫描，每周一10:00全量监控）
python scheduler.py

# 自定义时间
python scheduler.py --daily-time 08:30 --weekly-day friday --weekly-time 14:00

# 立即执行一次
python scheduler.py --now daily
python scheduler.py --now weekly
```

### 使用系统 crontab（Linux/Mac）

```bash
# 编辑 crontab
crontab -e

# 每天 9:00 执行扫描
0 9 * * * cd /path/to/竞品监控代码 && python main.py daily >> output/logs/cron.log 2>&1

# 每周一 10:00 执行全量监控
0 10 * * 1 cd /path/to/竞品监控代码 && python main.py weekly >> output/logs/cron.log 2>&1
```

### 使用 Windows 任务计划程序

1. 打开「任务计划程序」
2. 创建基本任务
3. 设置触发器（每日/每周）
4. 操作选择「启动程序」
5. 程序: `python`
6. 参数: `main.py daily`（或 `weekly`）
7. 起始位置: 项目目录路径

## 自定义竞品列表

创建 JSON 配置文件（如 `my_competitors.json`）：

```json
{
  "competitors": [
    {
      "name": "Canva",
      "url": "https://www.canva.com",
      "tier": "T1",
      "keywords": ["Canva new feature", "Canva update", "Canva AI"],
      "blog_url": "https://www.canva.com/blog",
      "changelog_url": "https://www.canva.com/changelog",
      "description": "全球领先的在线设计平台"
    },
    {
      "name": "Figma",
      "url": "https://www.figma.com",
      "tier": "T1",
      "keywords": ["Figma new feature", "Figma update"],
      "description": "协作式界面设计工具"
    }
  ]
}
```

使用方式：

```bash
export COMPETITORS_CONFIG=./my_competitors.json
python main.py weekly
```

## 输出目录结构

```
output/
├── weekly_reports/       # 竞品周报
│   ├── 竞品周报_2024-01-15.md
│   └── weekly_data_2024-01-15.json
├── daily_scans/          # 每日扫描报告
│   ├── 扫描报告_2024-01-15.md
│   └── scan_data_2024-01-15.json
├── interaction_flows/    # 交互流程文档
│   ├── 交互流程_HeyGen_AI_Avatar.md
│   └── flow_HeyGen_AI_Avatar.json
├── frameworks/           # 完整流程框架文档
│   ├── HeyGen完整流程框架.md
│   └── HeyGen_framework_data.json
└── logs/                 # 运行日志
    └── monitor_20240115.log
```

## 降级策略

当 LLM API 不可用时，系统自动降级为基于规则的分析：

| 功能 | LLM 模式 | 规则降级模式 |
|------|----------|-------------|
| 变更分类 | AI 语义理解分类 | 关键词匹配分类 |
| 影响评估 | AI 综合分析 | 基于类别的固定规则 |
| 新功能识别 | AI 判断 | 关键词匹配 |
| 交互流程 | AI 提取步骤 | 原始搜索结果展示 |
| 框架分析 | AI 6步深度分析 | 基于爬取数据的简单提取 |

搜索引擎同理，未配置 API Key 时默认使用免费的 DuckDuckGo。

## 项目结构

```
竞品监控代码/
├── config.py          # 配置文件（竞品列表、API keys、输出路径、爬取参数）
├── scraper.py         # 搜索和网页抓取模块
├── site_crawler.py    # 站点深度爬取模块（framework 模式专用）
├── analyzer.py        # AI 分析模块（含框架分析）
├── reporter.py        # 报告生成模块（含框架报告）
├── scheduler.py       # 定时任务调度
├── models.py          # 数据模型定义（含框架数据模型）
├── main.py            # CLI 入口（4种模式）
├── requirements.txt   # Python 依赖
└── README.md          # 使用说明
```

## 常见问题

**Q: 不配置任何 API Key 能运行吗？**
A: 可以。搜索引擎默认使用 DuckDuckGo（免费），LLM 不可用时降级为规则分析。但分析质量会下降。

**Q: 如何使用第三方 OpenAI 兼容 API？**
A: 设置 `OPENAI_BASE_URL` 环境变量为你的 API 地址，`LLM_MODEL` 为对应的模型名。

**Q: 如何只监控部分竞品？**
A: 创建自定义竞品配置文件，通过 `COMPETITORS_CONFIG` 环境变量指定。

**Q: 日志在哪里查看？**
A: 日志文件在 `output/logs/` 目录下，按日期命名。也可通过 `--verbose` 参数在终端查看详细日志。

## License

MIT
