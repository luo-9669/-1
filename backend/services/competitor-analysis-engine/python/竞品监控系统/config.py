"""
竞品监控 - 配置文件

集中管理所有配置项，包括竞品列表、API密钥、输出路径等。
API密钥通过环境变量配置，避免硬编码敏感信息。
"""

import os
from typing import List, Dict
from models import Competitor, CompetitorTier


# =============================================================================
# 环境变量配置
# =============================================================================

# 搜索引擎 API 配置
# 支持的搜索引擎: "google", "bing", "serpapi", "duckduckgo"(免费)
SEARCH_ENGINE: str = os.environ.get("SEARCH_ENGINE", "duckduckgo")
SEARCH_API_KEY: str = os.environ.get("SEARCH_API_KEY", "")

# Google Custom Search 专用配置
GOOGLE_CSE_ID: str = os.environ.get("GOOGLE_CSE_ID", "")

# Bing Search 专用配置
BING_ENDPOINT: str = os.environ.get("BING_ENDPOINT", "https://api.bing.microsoft.com/v7.0/search")

# LLM API 配置
# 支持的LLM: "openai", "claude"
LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "openai")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "gpt-4o-mini")

# Claude 专用配置
CLAUDE_MODEL: str = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514")

# OpenAI 专用配置（可配置 Base URL 以兼容第三方 API）
OPENAI_BASE_URL: str = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")


# =============================================================================
# 输出路径配置
# =============================================================================

OUTPUT_DIR: str = os.environ.get("OUTPUT_DIR", "./output")
WEEKLY_REPORT_DIR: str = os.path.join(OUTPUT_DIR, "weekly_reports")
DAILY_SCAN_DIR: str = os.path.join(OUTPUT_DIR, "daily_scans")
FLOW_DIR: str = os.path.join(OUTPUT_DIR, "interaction_flows")
FRAMEWORK_DIR: str = os.path.join(OUTPUT_DIR, "frameworks")
LOG_DIR: str = os.path.join(OUTPUT_DIR, "logs")


# =============================================================================
# 监控维度配置
# =============================================================================

# 全量监控 - 搜索天数范围
WEEKLY_DAYS: int = 7

# 每日扫描 - 搜索天数范围
DAILY_DAYS: int = 2

# 每个竞品最大搜索结果数
MAX_SEARCH_RESULTS: int = 15

# 网页抓取超时（秒）
FETCH_TIMEOUT: int = 30

# 请求重试次数
MAX_RETRIES: int = 3

# 请求间隔（秒），避免过于频繁
REQUEST_DELAY: float = 1.0


# =============================================================================
# 完整流程框架 - 爬取配置
# =============================================================================

# 最大爬取页面数
MAX_CRAWL_PAGES: int = int(os.environ.get("MAX_CRAWL_PAGES", "50"))

# 最大爬取深度
MAX_CRAWL_DEPTH: int = int(os.environ.get("MAX_CRAWL_DEPTH", "3"))


# =============================================================================
# 默认竞品列表
# =============================================================================

DEFAULT_COMPETITORS: List[Competitor] = [
    Competitor(
        name="创客贴",
        url="https://www.chuangkit.com",
        tier=CompetitorTier.T1,
        keywords=["创客贴 新功能", "创客贴 更新", "chuangkit new feature", "创客贴 AI"],
        blog_url="https://www.chuangkit.com/blog",
        description="国内领先的在线设计平台，提供海报、PPT、视频等设计工具",
    ),
    Competitor(
        name="稿定设计",
        url="https://www.gaoding.com",
        tier=CompetitorTier.T1,
        keywords=["稿定设计 新功能", "稿定设计 更新", "gaoding new feature", "稿定 AI"],
        blog_url="https://www.gaoding.com/blog",
        description="在线设计工具，专注商业设计的数字化解决方案",
    ),
    Competitor(
        name="HeyGen",
        url="https://www.heygen.com",
        tier=CompetitorTier.T1,
        keywords=["HeyGen new feature", "HeyGen update", "HeyGen AI avatar", "HeyGen changelog"],
        blog_url="https://www.heygen.com/blog",
        changelog_url="https://docs.heygen.com/changelog",
        description="AI数字人视频生成平台，提供数字人、视频翻译等功能",
    ),
    Competitor(
        name="Higgsfield AI",
        url="https://www.higgsfield.ai",
        tier=CompetitorTier.T2,
        keywords=["Higgsfield AI update", "Higgsfield new feature", "Higgsfield AI video"],
        blog_url="https://www.higgsfield.ai/blog",
        description="AI视频生成平台，专注于短视频创作",
    ),
    Competitor(
        name="Riverside",
        url="https://riverside.fm",
        tier=CompetitorTier.T2,
        keywords=["Riverside.fm update", "Riverside new feature", "Riverside changelog"],
        blog_url="https://riverside.fm/blog",
        changelog_url="https://riverside.fm/changelog",
        description="在线播客和视频会议录制平台，提供高质量音视频录制",
    ),
]


# =============================================================================
# 监控维度（用于全量分析时的分类指导）
# =============================================================================

MONITORING_DIMENSIONS: List[str] = [
    "功能更新：新增功能、功能改进、功能下线",
    "设计变更：UI/UX变化、品牌视觉调整",
    "定价调整：价格变化、套餐调整、促销活动",
    "内容更新：帮助文档、教程更新、社区内容",
    "市场动态：融资、合作、市场拓展、招聘信息",
    "性能优化：加载速度、稳定性改进",
    "技术架构：API变更、SDK更新、集成能力",
]


# =============================================================================
# 辅助函数
# =============================================================================

def get_competitors_from_config() -> List[Competitor]:
    """
    从配置获取竞品列表。
    如果存在自定义配置文件，则从文件加载；否则返回默认列表。
    """
    custom_config_path = os.environ.get("COMPETITORS_CONFIG", "")
    if custom_config_path and os.path.exists(custom_config_path):
        import json
        with open(custom_config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [Competitor.from_dict(c) for c in data.get("competitors", [])]
    return DEFAULT_COMPETITORS.copy()


def ensure_output_dirs():
    """确保所有输出目录存在"""
    for dir_path in [OUTPUT_DIR, WEEKLY_REPORT_DIR, DAILY_SCAN_DIR, FLOW_DIR, FRAMEWORK_DIR, LOG_DIR]:
        os.makedirs(dir_path, exist_ok=True)


def validate_config() -> List[str]:
    """
    验证配置是否完整，返回警告信息列表。
    不阻止运行，但会提示用户哪些功能可能受限。
    """
    warnings = []
    if not SEARCH_API_KEY and SEARCH_ENGINE != "duckduckgo":
        warnings.append(
            f"搜索引擎 '{SEARCH_ENGINE}' 需要配置 SEARCH_API_KEY 环境变量，"
            "当前将使用 DuckDuckGo 作为后备（免费但功能有限）"
        )
    if not LLM_API_KEY:
        warnings.append(
            "未配置 LLM_API_KEY，AI 分析功能将不可用，"
            "变更分析和影响评估将使用简单规则替代"
        )
    if SEARCH_ENGINE == "google" and not GOOGLE_CSE_ID:
        warnings.append("使用 Google Custom Search 需要配置 GOOGLE_CSE_ID 环境变量")
    return warnings
