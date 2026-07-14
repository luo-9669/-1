"""
竞品监控 - 数据模型定义

定义系统中使用的所有数据结构，使用 Python dataclass 实现。
包括竞品、变更记录、扫描结果、周报等核心模型。
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class CompetitorTier(Enum):
    """竞品级别分类"""
    T1 = "T1"  # 核心竞品
    T2 = "T2"  # 次要竞品
    T3 = "T3"  # 潜在竞品


class ChangeCategory(Enum):
    """变更分类"""
    FEATURE_UPDATE = "功能更新"
    DESIGN_CHANGE = "设计变更"
    PRICING_CHANGE = "定价调整"
    CONTENT_UPDATE = "内容更新"
    MARKET_MOVE = "市场动态"
    BUG_FIX = "缺陷修复"
    PERFORMANCE = "性能优化"
    OTHER = "其他"


class ImpactLevel(Enum):
    """影响等级"""
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class Competitor:
    """竞品数据模型"""
    name: str                          # 竞品名称
    url: str                           # 官网地址
    tier: CompetitorTier               # 竞品级别
    keywords: List[str] = field(default_factory=list)  # 搜索关键词
    blog_url: Optional[str] = None     # 博客/changelog 页面
    changelog_url: Optional[str] = None  # 更新日志页面
    description: str = ""              # 竞品简介

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "name": self.name,
            "url": self.url,
            "tier": self.tier.value,
            "keywords": self.keywords,
            "blog_url": self.blog_url,
            "changelog_url": self.changelog_url,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Competitor":
        """从字典创建实例"""
        return cls(
            name=data["name"],
            url=data["url"],
            tier=CompetitorTier(data.get("tier", "T2")),
            keywords=data.get("keywords", []),
            blog_url=data.get("blog_url"),
            changelog_url=data.get("changelog_url"),
            description=data.get("description", ""),
        )


@dataclass
class SearchEntry:
    """搜索结果条目"""
    title: str                         # 标题
    url: str                           # 链接
    snippet: str = ""                  # 摘要
    source: str = ""                   # 来源
    published_date: Optional[str] = None  # 发布日期
    content: str = ""                  # 抓取到的页面内容

    def to_dict(self) -> Dict:
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "source": self.source,
            "published_date": self.published_date,
            "content": self.content,
        }


@dataclass
class ChangeRecord:
    """变更记录模型"""
    competitor: str                    # 竞品名称
    category: ChangeCategory           # 变更分类
    summary: str                       # 变更摘要
    details: str                       # 详细信息
    impact: ImpactLevel = ImpactLevel.MEDIUM  # 影响等级
    impact_reason: str = ""            # 影响评估原因
    source_urls: List[str] = field(default_factory=list)  # 信息来源
    discovered_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            "competitor": self.competitor,
            "category": self.category.value,
            "summary": self.summary,
            "details": self.details,
            "impact": self.impact.value,
            "impact_reason": self.impact_reason,
            "source_urls": self.source_urls,
            "discovered_at": self.discovered_at,
        }


@dataclass
class ScanResult:
    """每日扫描结果模型"""
    competitor: str                    # 竞品名称
    scan_date: str                     # 扫描日期
    has_new_features: bool             # 是否有新功能
    entries: List[SearchEntry] = field(default_factory=list)  # 搜索结果
    new_features: List[str] = field(default_factory=list)     # 新功能列表
    summary: str = ""                  # 扫描摘要
    evidence_quality: str = "none"      # full/partial/none
    evidence_count: int = 0             # 可用于生成的证据数量
    sources: List[Dict] = field(default_factory=list)  # 标准化来源
    raw_data: str = ""                  # 原始证据摘要
    structured_data: Dict = field(default_factory=dict)  # 结构化证据

    def to_dict(self) -> Dict:
        return {
            "competitor": self.competitor,
            "scan_date": self.scan_date,
            "has_new_features": self.has_new_features,
            "entries": [e.to_dict() for e in self.entries],
            "new_features": self.new_features,
            "summary": self.summary,
            "evidence_quality": self.evidence_quality,
            "evidence_count": self.evidence_count,
            "sources": self.sources,
            "raw_data": self.raw_data,
            "structured_data": self.structured_data,
        }


@dataclass
class InteractionStep:
    """交互流程步骤"""
    step_number: int                   # 步骤序号
    description: str                   # 步骤描述
    ui_element: str = ""              # 涉及的 UI 元素
    expected_result: str = ""          # 预期结果
    notes: str = ""                    # 备注

    def to_dict(self) -> Dict:
        return {
            "step_number": self.step_number,
            "description": self.description,
            "ui_element": self.ui_element,
            "expected_result": self.expected_result,
            "notes": self.notes,
        }


@dataclass
class InteractionFlow:
    """交互流程模型"""
    competitor: str                    # 竞品名称
    feature: str                       # 功能名称
    flow_description: str = ""         # 流程概述
    steps: List[InteractionStep] = field(default_factory=list)  # 步骤列表
    source_urls: List[str] = field(default_factory=list)       # 信息来源
    evidence_status: str = "unknown"   # exact/similar/not_found/unknown
    evidence_reason: str = ""          # 证据判断说明
    similar_features: List[Dict] = field(default_factory=list)  # 相似功能线索
    evidence_quality: str = "none"      # full/partial/none
    evidence_count: int = 0             # 可用于生成的证据数量
    sources: List[Dict] = field(default_factory=list)  # 标准化来源
    raw_data: str = ""                  # 原始证据摘要
    structured_data: Dict = field(default_factory=dict)  # 结构化证据
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            "competitor": self.competitor,
            "feature": self.feature,
            "flow_description": self.flow_description,
            "steps": [s.to_dict() for s in self.steps],
            "source_urls": self.source_urls,
            "evidence_status": self.evidence_status,
            "evidence_reason": self.evidence_reason,
            "similar_features": self.similar_features,
            "evidence_quality": self.evidence_quality,
            "evidence_count": self.evidence_count,
            "sources": self.sources,
            "raw_data": self.raw_data,
            "structured_data": self.structured_data,
            "generated_at": self.generated_at,
        }


@dataclass
class WeeklyReport:
    """竞品周报模型"""
    report_date: str                   # 报告日期
    period_start: str                  # 监控起始日期
    period_end: str                    # 监控结束日期
    changes: List[ChangeRecord] = field(default_factory=list)  # 所有变更记录
    summary: str = ""                  # 周报摘要
    key_highlights: List[str] = field(default_factory=list)    # 重点事项
    recommendations: List[str] = field(default_factory=list)   # 建议
    evidence_quality: str = "none"      # full/partial/none
    evidence_count: int = 0             # 可用于生成的证据数量
    sources: List[Dict] = field(default_factory=list)  # 标准化来源
    raw_data: str = ""                  # 原始证据摘要
    structured_data: Dict = field(default_factory=dict)  # 结构化证据
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            "report_date": self.report_date,
            "period_start": self.period_start,
            "period_end": self.period_end,
            "changes": [c.to_dict() for c in self.changes],
            "summary": self.summary,
            "key_highlights": self.key_highlights,
            "recommendations": self.recommendations,
            "evidence_quality": self.evidence_quality,
            "evidence_count": self.evidence_count,
            "sources": self.sources,
            "raw_data": self.raw_data,
            "structured_data": self.structured_data,
            "generated_at": self.generated_at,
        }


# =============================================================================
# 完整流程框架（Framework）数据模型
# =============================================================================

@dataclass
class NavigationNode:
    """导航节点"""
    name: str
    url: str = ""
    level: int = 0
    children: List["NavigationNode"] = field(default_factory=list)
    node_type: str = ""  # "page", "feature", "section", "action"

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "url": self.url,
            "level": self.level,
            "children": [c.to_dict() for c in self.children],
            "node_type": self.node_type,
        }


@dataclass
class FeatureModule:
    """功能模块"""
    module_id: str  # 如 M01
    name: str
    level: str  # 如 L1-核心功能
    purpose: str
    entry_path: str = ""
    prerequisite: str = ""
    complexity: str = ""  # ★☆☆☆☆ ~ ★★★★★
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "module_id": self.module_id,
            "name": self.name,
            "level": self.level,
            "purpose": self.purpose,
            "entry_path": self.entry_path,
            "prerequisite": self.prerequisite,
            "complexity": self.complexity,
            "structured_data": self.structured_data,
        }


@dataclass
class UserJourneyStep:
    """用户旅程步骤"""
    step_id: str  # 如 1a, 1b
    description: str
    ui_element: str = ""
    user_action: str = ""
    system_feedback: str = ""
    is_exception: bool = False
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "step_id": self.step_id,
            "description": self.description,
            "ui_element": self.ui_element,
            "user_action": self.user_action,
            "system_feedback": self.system_feedback,
            "is_exception": self.is_exception,
            "structured_data": self.structured_data,
        }


@dataclass
class UserJourney:
    """用户旅程"""
    feature_name: str
    entry_point: str
    steps: List[UserJourneyStep] = field(default_factory=list)
    normal_flow: List[str] = field(default_factory=list)
    exception_flows: List[str] = field(default_factory=list)
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "feature_name": self.feature_name,
            "entry_point": self.entry_point,
            "steps": [s.to_dict() for s in self.steps],
            "normal_flow": self.normal_flow,
            "exception_flows": self.exception_flows,
            "structured_data": self.structured_data,
        }


@dataclass
class DecisionPoint:
    """决策点"""
    location: str  # 在哪个流程/页面
    decision: str  # 用户需要做什么决策
    options: List[str] = field(default_factory=list)
    criteria: str = ""  # 决策依据
    ux_implication: str = ""  # UX 影响
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "location": self.location,
            "decision": self.decision,
            "options": self.options,
            "criteria": self.criteria,
            "ux_implication": self.ux_implication,
            "structured_data": self.structured_data,
        }


@dataclass
class ExceptionFlow:
    """异常处理流程"""
    scenario: str  # 异常场景
    trigger: str  # 触发条件
    system_response: str  # 系统响应
    recovery_path: str  # 恢复路径
    error_type: str = ""  # error/empty/loading/timeout/validation
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "scenario": self.scenario,
            "trigger": self.trigger,
            "system_response": self.system_response,
            "recovery_path": self.recovery_path,
            "error_type": self.error_type,
            "structured_data": self.structured_data,
        }


@dataclass
class StateTransition:
    """状态流转"""
    entity: str  # 实体名称（如"视频"、"数字人"）
    from_state: str
    to_state: str
    trigger: str  # 触发动作
    conditions: str = ""  # 前置条件
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "entity": self.entity,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "trigger": self.trigger,
            "conditions": self.conditions,
            "structured_data": self.structured_data,
        }


@dataclass
class CrossFunctionLink:
    """跨功能关联"""
    source_feature: str
    target_feature: str
    relationship: str  # 数据共享/导航跳转/依赖关系
    description: str
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "source_feature": self.source_feature,
            "target_feature": self.target_feature,
            "relationship": self.relationship,
            "description": self.description,
            "structured_data": self.structured_data,
        }


@dataclass
class ProductFramework:
    """产品完整流程框架"""
    product_name: str
    product_url: str
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # 6大章节
    navigation_tree: List[NavigationNode] = field(default_factory=list)
    feature_modules: List[FeatureModule] = field(default_factory=list)
    page_hierarchy: str = ""  # 文本格式的页面层级

    user_journeys: List[UserJourney] = field(default_factory=list)
    decision_points: List[DecisionPoint] = field(default_factory=list)
    exception_flows: List[ExceptionFlow] = field(default_factory=list)
    state_transitions: List[StateTransition] = field(default_factory=list)
    cross_function_links: List[CrossFunctionLink] = field(default_factory=list)

    # 元信息
    total_pages_crawled: int = 0
    total_features_identified: int = 0
    source_urls: List[str] = field(default_factory=list)
    crawler_features: List[Dict] = field(default_factory=list)
    sitemap_navigation: List[Dict] = field(default_factory=list)
    page_evidence: List[Dict] = field(default_factory=list)
    evidence_quality: str = "none"
    evidence_count: int = 0
    sources: List[Dict] = field(default_factory=list)
    raw_data: str = ""
    structured_data: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "product_name": self.product_name,
            "product_url": self.product_url,
            "generated_at": self.generated_at,
            "navigation_tree": [n.to_dict() for n in self.navigation_tree],
            "feature_modules": [m.to_dict() for m in self.feature_modules],
            "page_hierarchy": self.page_hierarchy,
            "user_journeys": [j.to_dict() for j in self.user_journeys],
            "decision_points": [d.to_dict() for d in self.decision_points],
            "exception_flows": [e.to_dict() for e in self.exception_flows],
            "state_transitions": [s.to_dict() for s in self.state_transitions],
            "cross_function_links": [c.to_dict() for c in self.cross_function_links],
            "total_pages_crawled": self.total_pages_crawled,
            "total_features_identified": self.total_features_identified,
            "source_urls": self.source_urls,
            "crawler_features": self.crawler_features,
            "sitemap_navigation": self.sitemap_navigation,
            "page_evidence": self.page_evidence,
            "evidence_quality": self.evidence_quality,
            "evidence_count": self.evidence_count,
            "sources": self.sources,
            "raw_data": self.raw_data,
            "structured_data": self.structured_data,
        }
