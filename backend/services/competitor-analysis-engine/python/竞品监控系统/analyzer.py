"""
竞品监控 - AI 分析模块

调用 LLM（OpenAI / Claude）进行智能分析，包括：
- 变更分类（功能更新/设计变更/定价调整等）
- 影响评估（高/中/低）
- 新功能识别
- 交互流程提取
当 LLM 不可用时，提供基于规则的降级方案。
"""

import json
import logging
import re
from typing import List, Dict, Optional, Tuple

import config
from models import (
    ChangeRecord, ChangeCategory, ImpactLevel,
    ScanResult, SearchEntry, InteractionFlow, InteractionStep,
)

logger = logging.getLogger(__name__)


# =============================================================================
# LLM 调用封装
# =============================================================================

def _call_llm(prompt: str, system_prompt: str = "") -> Optional[str]:
    """
    调用 LLM API，根据配置选择 OpenAI 或 Claude。

    Args:
        prompt: 用户提示
        system_prompt: 系统提示

    Returns:
        LLM 响应文本，失败时返回 None
    """
    if not config.LLM_API_KEY:
        logger.warning("未配置 LLM_API_KEY，跳过 AI 分析")
        return None

    try:
        if config.LLM_PROVIDER == "openai":
            return _call_openai(prompt, system_prompt)
        elif config.LLM_PROVIDER == "claude":
            return _call_claude(prompt, system_prompt)
        else:
            logger.error(f"不支持的 LLM 提供商: {config.LLM_PROVIDER}")
            return None
    except Exception as e:
        logger.error(f"LLM 调用失败: {e}")
        return None


def _call_openai(prompt: str, system_prompt: str) -> Optional[str]:
    """调用 OpenAI API"""
    import openai

    client = openai.OpenAI(
        api_key=config.LLM_API_KEY,
        base_url=config.OPENAI_BASE_URL,
    )

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=config.LLM_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=4000,
    )

    return response.choices[0].message.content


def _call_claude(prompt: str, system_prompt: str) -> Optional[str]:
    """调用 Claude API"""
    import anthropic

    client = anthropic.Anthropic(api_key=config.LLM_API_KEY)

    kwargs = {
        "model": config.CLAUDE_MODEL,
        "max_tokens": 4000,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        kwargs["system"] = system_prompt

    response = client.messages.create(**kwargs)
    return response.content[0].text


# =============================================================================
# 变更分析
# =============================================================================

def _entry_published_between(entry: SearchEntry, period_start: str = "", period_end: str = "") -> bool:
    published_date = (entry.published_date or "").strip()
    if not published_date or not period_start or not period_end:
        return False
    date_text = published_date[:10]
    return period_start <= date_text <= period_end


def analyze_changes(
    competitor_name: str,
    entries: List[SearchEntry],
    period_start: str = "",
    period_end: str = "",
) -> List[ChangeRecord]:
    """
    对竞品的搜索结果进行变更分析，分类并评估影响。
    优先使用 LLM 分析，不可用时降级为规则分析。

    Args:
        competitor_name: 竞品名称
        entries: 搜索结果列表

    Returns:
        变更记录列表
    """
    if not entries:
        logger.info(f"竞品 [{competitor_name}] 无搜索结果，跳过分析")
        return []

    period_entries = [
        entry for entry in entries
        if _entry_published_between(entry, period_start, period_end)
    ] if period_start and period_end else entries
    if not period_entries:
        return []

    # 准备分析素材
    analysis_material = _prepare_analysis_material(period_entries)

    # 尝试 LLM 分析
    if config.LLM_API_KEY:
        changes = _llm_analyze_changes(competitor_name, analysis_material)
        if changes:
            return changes

    # 降级为规则分析
    logger.info("使用规则分析作为降级方案")
    return _rule_based_analyze(competitor_name, period_entries)


def _prepare_analysis_material(entries: List[SearchEntry]) -> str:
    """将搜索结果整理为 LLM 可分析的文本格式"""
    material_parts = []
    for i, entry in enumerate(entries, 1):
        part = f"[{i}] 标题: {entry.title}\n"
        part += f"    URL: {entry.url}\n"
        if entry.snippet:
            part += f"    摘要: {entry.snippet}\n"
        if entry.content:
            # 截取部分内容
            content_preview = entry.content[:2000]
            part += f"    内容: {content_preview}\n"
        if entry.published_date:
            part += f"    日期: {entry.published_date}\n"
        material_parts.append(part)

    return "\n".join(material_parts)


def _llm_analyze_changes(competitor_name: str, material: str) -> Optional[List[ChangeRecord]]:
    """使用 LLM 进行变更分析（趋势模式识别+三维评分）"""
    system_prompt = """你是一个专业的竞品分析师。请根据提供的信息，分析竞品的最新动态和变化，识别趋势模式并做三维评分。

你需要：
1. 识别每一条有价值的变更/动态，归类到以下类别之一：
   feature_launch / ui_redesign / pricing / content / performance / bugfix / market
2. 识别跨条目的趋势模式（accelerating/stable/declining/new_pattern）
3. 对整体竞争态势做三维评分（1-10）：
   - activity_score: 竞品活跃度（发布频率、更新幅度）
   - threat_score: 竞争威胁度（对标自身产品的威胁程度）
   - opportunity_score: 机会窗口度（可借鉴或差异化反击的空间）
4. 给出建议深入分析的推荐目标

只基于提供的证据材料分析，无证据的信息标注 confidence 为 low。

请以 JSON 格式返回：
{
    "changes": [
        {
            "id": "CHG01",
            "category": "feature_launch|ui_redesign|pricing|content|performance|bugfix|market",
            "summary": "一句话摘要",
            "details": "详细说明（2-3句）",
            "evidence_indices": [1, 2],
            "confidence": "high|medium|low",
            "trend_signal": "accelerating|stable|declining|new_pattern"
        }
    ],
    "trend_patterns": [
        {
            "pattern": "趋势名称",
            "description": "趋势描述",
            "related_changes": ["CHG01", "CHG03"],
            "trajectory": "accelerating|stable|declining",
            "strategic_implication": "战略含义"
        }
    ],
    "scores": {
        "activity_score": 1-10,
        "threat_score": 1-10,
        "opportunity_score": 1-10,
        "rationale": "评分依据"
    },
    "recommended_deep_dive": [
        {
            "target": "建议深入分析的功能/流程",
            "reason": "推荐理由"
        }
    ],
    "summary": "周报总结（5-8句概括本周趋势）",
    "data_gaps": ["信息缺口"]
}

如果没有发现有价值的变更，返回空 changes 数组但仍需填写 scores 和 summary。
只返回 JSON，不要其他内容。"""

    prompt = f"请分析竞品「{competitor_name}」的以下搜索结果，识别最近的动态和变化：\n\n{material}"

    response = _call_llm(prompt, system_prompt)
    if not response:
        return None

    try:
        # 解析 JSON 响应
        response_text = response.strip()
        if response_text.startswith("```"):
            # 移除 markdown 代码块标记
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        result_data = json.loads(response_text)

        # 新格式：result_data 是一个对象，changes 是其中的数组
        if isinstance(result_data, dict) and "changes" in result_data:
            changes_data = result_data.get("changes", [])
            extra_data = {
                "trend_patterns": result_data.get("trend_patterns", []),
                "scores": result_data.get("scores", {}),
                "recommended_deep_dive": result_data.get("recommended_deep_dive", []),
                "weekly_summary": result_data.get("summary", ""),
                "data_gaps": result_data.get("data_gaps", []),
            }
        else:
            # 向后兼容：旧格式直接是数组
            changes_data = result_data if isinstance(result_data, list) else []
            extra_data = {}

        changes = []
        # 新类别映射
        category_map_new = {
            "feature_launch": ChangeCategory.FEATURE_UPDATE,
            "ui_redesign": ChangeCategory.DESIGN_CHANGE,
            "pricing": ChangeCategory.PRICING_CHANGE,
            "content": ChangeCategory.CONTENT_UPDATE,
            "performance": ChangeCategory.PERFORMANCE,
            "bugfix": ChangeCategory.BUG_FIX,
            "market": ChangeCategory.MARKET_MOVE,
        }
        # 旧类别映射（向后兼容）
        category_map_old = {
            "功能更新": ChangeCategory.FEATURE_UPDATE,
            "设计变更": ChangeCategory.DESIGN_CHANGE,
            "定价调整": ChangeCategory.PRICING_CHANGE,
            "内容更新": ChangeCategory.CONTENT_UPDATE,
            "市场动态": ChangeCategory.MARKET_MOVE,
            "缺陷修复": ChangeCategory.BUG_FIX,
            "性能优化": ChangeCategory.PERFORMANCE,
            "其他": ChangeCategory.OTHER,
        }
        category_map = {**category_map_new, **category_map_old}

        impact_map = {"高": ImpactLevel.HIGH, "中": ImpactLevel.MEDIUM, "低": ImpactLevel.LOW}

        for item in changes_data:
            category = category_map.get(item.get("category", "其他"), ChangeCategory.OTHER)
            impact = impact_map.get(item.get("impact", "中"), ImpactLevel.MEDIUM)
            # 新格式：confidence 映射为影响等级
            confidence = item.get("confidence", "")
            if not item.get("impact") and confidence:
                confidence_impact_map = {"high": ImpactLevel.HIGH, "medium": ImpactLevel.MEDIUM, "low": ImpactLevel.LOW}
                impact = confidence_impact_map.get(confidence, ImpactLevel.MEDIUM)

            # 获取来源 URL
            source_indices = item.get("source_indices", item.get("evidence_indices", []))

            change_record = ChangeRecord(
                competitor=competitor_name,
                category=category,
                summary=item.get("summary", ""),
                details=item.get("details", ""),
                impact=impact,
                impact_reason=item.get("impact_reason", ""),
            )
            # 将新增字段存入 structured_data
            change_record.structured_data = {
                "id": item.get("id", ""),
                "confidence": confidence,
                "trend_signal": item.get("trend_signal", ""),
                "evidence_indices": source_indices,
            }
            changes.append(change_record)

        # 将趋势、评分等附加数据存入第一个 ChangeRecord 的 structured_data（如果有的话）
        # 或者作为返回值的一部分——通过 caller 的 scan_result.structured_data 使用
        # 这里我们通过在 changes 列表上附加一个 _extra_data 属性来传递
        if extra_data and changes:
            changes[0].structured_data["trend_patterns"] = extra_data.get("trend_patterns", [])
            changes[0].structured_data["scores"] = extra_data.get("scores", {})
            changes[0].structured_data["recommended_deep_dive"] = extra_data.get("recommended_deep_dive", [])
            changes[0].structured_data["weekly_summary"] = extra_data.get("weekly_summary", "")
            changes[0].structured_data["data_gaps"] = extra_data.get("data_gaps", [])
        # 即使没有 changes，也将 extra_data 保存以便上层使用
        if extra_data:
            _llm_analyze_changes._last_extra_data = extra_data

        logger.info(f"LLM 分析完成，竞品 [{competitor_name}] 发现 {len(changes)} 条变更")
        return changes

    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"解析 LLM 分析结果失败: {e}")
        return None


def _rule_based_analyze(competitor_name: str, entries: List[SearchEntry]) -> List[ChangeRecord]:
    """
    基于规则的降级分析方案（当 LLM 不可用时使用）。
    通过关键词匹配进行分类。
    """
    changes = []

    # 关键词分类规则
    category_rules = {
        ChangeCategory.FEATURE_UPDATE: ["新功能", "feature", "update", "新增", "上线", "发布", "launch", "release"],
        ChangeCategory.DESIGN_CHANGE: ["设计", "UI", "UX", "界面", "视觉", "redesign", "外观"],
        ChangeCategory.PRICING_CHANGE: ["价格", "定价", "pricing", "收费", "套餐", "plan", "促销", "discount"],
        ChangeCategory.CONTENT_UPDATE: ["教程", "帮助", "文档", "guide", "tutorial", "blog"],
        ChangeCategory.MARKET_MOVE: ["融资", "合作", "partnership", "funding", "招聘", "hiring"],
        ChangeCategory.PERFORMANCE: ["性能", "速度", "优化", "performance", "speed"],
    }

    for entry in entries:
        text = f"{entry.title} {entry.snippet}".lower()

        # 匹配类别
        matched_category = ChangeCategory.OTHER
        for category, keywords in category_rules.items():
            if any(kw in text for kw in keywords):
                matched_category = category
                break

        # 简单影响评估
        high_impact_keywords = ["重大", "全新", "革命性", "revolutionary", "major", "重磅"]
        if any(kw in text for kw in high_impact_keywords):
            impact = ImpactLevel.HIGH
        elif matched_category in [ChangeCategory.FEATURE_UPDATE, ChangeCategory.PRICING_CHANGE]:
            impact = ImpactLevel.MEDIUM
        else:
            impact = ImpactLevel.LOW

        changes.append(ChangeRecord(
            competitor=competitor_name,
            category=matched_category,
            summary=entry.title,
            details=entry.snippet or "（详细内容需抓取页面获取）",
            impact=impact,
            impact_reason="基于规则分析",
            source_urls=[entry.url],
        ))

    return changes


# =============================================================================
# 影响评估
# =============================================================================

def assess_impact(change: ChangeRecord) -> Tuple[ImpactLevel, str]:
    """
    对单条变更记录进行影响评估。

    Args:
        change: 变更记录

    Returns:
        (影响等级, 评估原因) 元组
    """
    if config.LLM_API_KEY:
        system_prompt = "你是一个竞品影响评估专家。请评估以下竞品变更对自身产品的影响程度。"
        prompt = f"""请评估以下竞品变更的影响等级：

竞品: {change.competitor}
类别: {change.category.value}
摘要: {change.summary}
详情: {change.details}

影响等级标准：
- 高：直接影响竞争格局，需要立即关注和应对
- 中：有一定影响，需要在规划中考虑
- 低：影响较小，保持关注即可

请以 JSON 格式返回：
{{"impact": "高/中/低", "reason": "评估原因"}}
只返回 JSON。"""

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                response_text = response.strip()
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                data = json.loads(response_text)
                impact_map = {"高": ImpactLevel.HIGH, "中": ImpactLevel.MEDIUM, "低": ImpactLevel.LOW}
                return (
                    impact_map.get(data.get("impact", "中"), ImpactLevel.MEDIUM),
                    data.get("reason", "")
                )
            except Exception:
                pass

    # 降级：使用规则评估
    return (change.impact, "基于规则评估")


# =============================================================================
# 新功能扫描
# =============================================================================

def _entry_published_on(entry: SearchEntry, today: str) -> bool:
    """Return true only when a search entry carries an explicit date for today."""
    published_date = (entry.published_date or "").strip()
    if not published_date:
        return False
    return today in published_date[:10]


def scan_for_new_features(competitor_name: str, entries: List[SearchEntry], today: str = None) -> ScanResult:
    """
    扫描竞品是否有新功能发布。

    Args:
        competitor_name: 竞品名称
        entries: 搜索结果列表

    Returns:
        扫描结果
    """
    from datetime import datetime
    today = today or datetime.now().strftime("%Y-%m-%d")
    today_entries = [entry for entry in entries if _entry_published_on(entry, today)]
    scan_result = ScanResult(
        competitor=competitor_name,
        scan_date=today,
        has_new_features=False,
        entries=today_entries,
    )
    scan_result.evidence_count = len(today_entries)
    scan_result.evidence_quality = "partial" if today_entries else "none"
    scan_result.sources = _entry_sources(today_entries, "daily")
    scan_result.raw_data = _raw_entry_data(today_entries)
    scan_result.structured_data = {
        "scan_date": today,
        "entries": [entry.to_dict() for entry in today_entries],
        "new_features": [],
    }

    if not today_entries:
        scan_result.summary = f"今日未发现 [{competitor_name}] 明确的新功能信息"
        return scan_result

    if config.LLM_API_KEY:
        # LLM 分析
        material = _prepare_analysis_material(today_entries)
        system_prompt = """你是一个专业的竞品信号分析师。请分析以下搜索结果，全量采集竞品动态信号并标注置信度。

你需要识别以下6类信号：
1. feature_launch: 新功能发布/上线
2. pricing_change: 定价/套餐/促销变化
3. ui_redesign: 界面改版/视觉更新
4. content_update: 文档/帮助/博客内容更新
5. performance: 性能优化/速度提升
6. market_move: 融资/合作/招聘/市场活动

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

请以 JSON 格式返回：
{
    "signals": [
        {
            "id": "SIG01",
            "type": "feature_launch|pricing_change|ui_redesign|content_update|performance|market_move",
            "title": "一句话标题",
            "description": "2-3句详细说明",
            "evidence_urls": ["来源URL"],
            "confidence": "high|medium|low",
            "impact_assessment": {
                "user_impact": "对用户的影响",
                "competitive_threat": "high|medium|low",
                "opportunity": "high|medium|low"
            },
            "tags": ["标签1", "标签2"],
            "action_needed": "monitor|deep_dive|respond",
            "raw_date": "原始发布日期（如有）"
        }
    ],
    "market_sentiment": "整体市场情绪（积极/中性/消极）",
    "summary": "今日扫描总结（3-5句话概括趋势）",
    "data_gaps": ["信息缺口1", "信息缺口2"]
}
只返回 JSON。"""

        prompt = f"请分析竞品「{competitor_name}」的以下信息，判断是否有新功能：\n\n{material}"
        response = _call_llm(prompt, system_prompt)

        if response:
            try:
                response_text = response.strip()
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                data = json.loads(response_text)

                # 新格式：signals 数组
                signals = data.get("signals", [])
                if signals:
                    scan_result.has_new_features = True
                    scan_result.new_features = [s.get("title", "") for s in signals if s.get("title")]
                    scan_result.summary = data.get("summary", "")
                    # 将完整信号数据写入 structured_data
                    scan_result.structured_data["signals"] = signals
                    scan_result.structured_data["market_sentiment"] = data.get("market_sentiment", "")
                    scan_result.structured_data["data_gaps"] = data.get("data_gaps", [])
                else:
                    # 向后兼容旧格式
                    scan_result.has_new_features = data.get("has_new_features", False)
                    scan_result.new_features = data.get("new_features", [])
                    scan_result.summary = data.get("summary", "")
            except Exception as e:
                logger.error(f"解析新功能扫描结果失败: {e}")
    else:
        # 规则降级
        feature_keywords = ["新功能", "feature", "发布", "上线", "launch", "release", "新增", "更新"]
        found_features = []
        for entry in today_entries:
            text = f"{entry.title} {entry.snippet}".lower()
            if any(kw in text for kw in feature_keywords):
                found_features.append(entry.title)

        if found_features:
            scan_result.has_new_features = True
            scan_result.new_features = found_features[:5]
            scan_result.summary = f"发现 {len(found_features)} 条可能的新功能相关信息"
        else:
            scan_result.summary = f"未发现明确的新功能信息"

    scan_result.evidence_quality = "full" if scan_result.has_new_features and scan_result.evidence_count else (
        "partial" if scan_result.evidence_count else "none"
    )
    scan_result.structured_data["new_features"] = scan_result.new_features
    scan_result.structured_data["summary"] = scan_result.summary

    logger.info(
        f"新功能扫描完成 - [{competitor_name}]: "
        f"{'有新功能' if scan_result.has_new_features else '无新功能'}"
    )
    return scan_result


# =============================================================================
# 交互流程提取
# =============================================================================

def extract_interaction_flow(
    competitor_name: str,
    feature: str,
    entries: List[SearchEntry],
) -> InteractionFlow:
    """
    从搜索结果中提取竞品的交互流程。

    Args:
        competitor_name: 竞品名称
        feature: 功能名称
        entries: 搜索结果列表（应包含教程、帮助文档等）

    Returns:
        交互流程数据
    """
    flow = InteractionFlow(
        competitor=competitor_name,
        feature=feature,
        source_urls=[e.url for e in entries if e.url],
    )
    evidence = _judge_flow_feature_evidence(competitor_name, feature, entries)
    flow.evidence_status = evidence["status"]
    flow.evidence_reason = evidence["reason"]
    flow.similar_features = evidence["similar_features"]
    flow.evidence_quality = _evidence_quality_from_status(flow.evidence_status)
    analysis_allowed = bool(evidence.get("analysis_allowed", flow.evidence_status == "exact"))
    matched_entries = _matching_flow_entries(feature, entries) if flow.evidence_status == "exact" else list(evidence.get("supporting_entries", []))
    if flow.evidence_status == "exact" and not matched_entries:
        matched_entries = entries[:5]
    if flow.evidence_status == "similar" and analysis_allowed:
        flow.sources = _entry_sources(matched_entries, "composite")
    elif flow.evidence_status == "similar":
        flow.sources = _similar_feature_sources(flow.similar_features)
    else:
        flow.sources = _entry_sources(matched_entries, "exact")
    flow.evidence_count = len(flow.sources)
    flow.raw_data = _raw_entry_data(matched_entries) if analysis_allowed else _raw_similar_data(flow.similar_features)
    flow.structured_data = {
        "evidence_status": flow.evidence_status,
        "evidence_reason": flow.evidence_reason,
        "source_urls": flow.source_urls,
        "sources": flow.sources,
        "similar_features": flow.similar_features,
        "normalized_feature": evidence.get("normalized_feature", "unknown"),
        "evidence_mode": evidence.get("evidence_mode", "none"),
        "evidence_confidence": evidence.get("confidence", "none"),
        "analysis_allowed": analysis_allowed,
        "capability_signals": evidence.get("capability_signals", []),
        "steps": [],
    }
    if not analysis_allowed:
        if flow.evidence_status == "similar":
            names = "、".join([item.get("name", "") for item in flow.similar_features[:5] if item.get("name")])
            flow.flow_description = f"未找到「{competitor_name}」明确提供「{feature}」功能的证据；仅发现相似功能线索：{names or '待补采'}。"
        else:
            flow.flow_description = f"未找到「{competitor_name}」提供「{feature}」功能的公开证据。"
        logger.info(
            f"交互流程证据不足 - [{competitor_name}] [{feature}]: "
            f"{flow.evidence_status} / {flow.evidence_reason}"
        )
        return flow

    # 准备分析素材
    material_parts = []
    for i, entry in enumerate(entries, 1):
        part = f"[{i}] {entry.title}\n来源: {entry.url}\n"
        if entry.content:
            part += f"内容:\n{entry.content[:3000]}\n"
        elif entry.snippet:
            part += f"摘要: {entry.snippet}\n"
        material_parts.append(part)
    material = "\n---\n".join(material_parts)

    if config.LLM_API_KEY:
        system_prompt = """你是一位资深UX交互分析师。请根据提供的竞品信息，输出完整的页面交互分析文档。

输出 JSON 格式，包含以下部分：

{
    "flow_description": "流程概述（2-3句话，说明核心用户任务和主要路径）",
    "confidence": "full|partial|none",

    "page_overview": [
        {
            "page_id": "P01",
            "page_name": "页面名称",
            "page_type": "page|popup|drawer|overlay",
            "purpose": "页面目的（1句话）",
            "url": "页面URL（如有）",
            "evidence": "full|partial|inferred"
        }
    ],

    "page_flow": [
        {
            "step": "S1",
            "from_page": "P01",
            "to_page": "P02",
            "trigger": "用户操作描述",
            "condition": "前置条件（可选）",
            "evidence": "full|partial|inferred"
        }
    ],

    "state_machines": [
        {
            "entity": "核心实体名称",
            "states": [
                {"id": "ST0", "name": "初始态", "description": "描述"},
                {"id": "ST1", "name": "状态名", "description": "描述"}
            ],
            "transitions": [
                {"from": "ST0", "to": "ST1", "trigger": "触发操作", "condition": "条件（可选）"}
            ]
        }
    ],

    "popup_definitions": [
        {
            "popup_id": "P02",
            "name": "弹窗名称",
            "type": "dialog|drawer|toast|tooltip",
            "trigger": "触发条件",
            "content_summary": "弹窗内容概述",
            "actions": ["确认", "取消"]
        }
    ],

    "exception_states": [
        {
            "id": "E01",
            "page_id": "P01",
            "type": "error|empty|loading|timeout|validation",
            "scenario": "异常场景描述",
            "system_response": "系统处理方式",
            "recovery": "用户恢复路径"
        }
    ],

    "interaction_rules": [
        {
            "id": "IR01",
            "page_id": "P01",
            "trigger": "用户操作",
            "system_action": "系统响应",
            "reference": "关联的弹窗P编号或状态机ST编号（如有）"
        }
    ],

    "missing_info": ["根据现有证据无法确认的项目列表"]
}

要求：
- 每个元素必须标注 evidence 置信度（full=有直接证据, partial=部分证据推断, inferred=无证据推断）
- 无法确认的内容放入 missing_info，不要编造
- page_id 统一用 P01/P02... 编号，弹窗也共用 P 编号
- 状态机用 ST0/ST1... 编号，ST0 固定为初始态
- 主流程步骤用 S1/S2... 编号
- 交互规则用 IR01/IR02... 编号
- 异常状态用 E01/E02... 编号
- 编号必须前后一致：交互规则引用的弹窗/状态机编号必须在对应表中存在

只返回 JSON，不要其他内容。"""

        prompt = f"""请分析竞品「{competitor_name}」的「{feature}」功能的完整交互流程。

{material}

请输出完整的页面交互分析文档（JSON格式），包括：页面总览、页面流转、状态机、弹窗定义、异常状态、交互规则。"""

        response = _call_llm(prompt, system_prompt)

        if response:
            try:
                response_text = response.strip()
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                data = json.loads(response_text)
                flow.flow_description = data.get("flow_description", "")

                # 尝试解析新结构化 JSON
                new_format = "page_flow" in data or "page_overview" in data
                if new_format:
                    # 新格式：将 page_flow 映射为 InteractionStep 列表
                    for idx, pf in enumerate(data.get("page_flow", []), 1):
                        trigger = pf.get("trigger", "")
                        condition = pf.get("condition", "")
                        from_page = pf.get("from_page", "")
                        to_page = pf.get("to_page", "")
                        desc = f"{from_page} → {to_page}: {trigger}"
                        if condition:
                            desc += f"（前置: {condition}）"
                        flow.steps.append(InteractionStep(
                            step_number=idx,
                            description=desc,
                            ui_element=trigger,
                            expected_result=to_page,
                            notes=pf.get("evidence", ""),
                        ))
                    # 将新结构的完整数据存入 structured_data
                    flow.structured_data["confidence"] = data.get("confidence", "none")
                    flow.structured_data["page_overview"] = data.get("page_overview", [])
                    flow.structured_data["page_flow"] = data.get("page_flow", [])
                    flow.structured_data["state_machines"] = data.get("state_machines", [])
                    flow.structured_data["popup_definitions"] = data.get("popup_definitions", [])
                    flow.structured_data["exception_states"] = data.get("exception_states", [])
                    flow.structured_data["interaction_rules"] = data.get("interaction_rules", [])
                    flow.structured_data["missing_info"] = data.get("missing_info", [])
                else:
                    # 旧格式 fallback：直接解析 steps 列表
                    for step_data in data.get("steps", []):
                        flow.steps.append(InteractionStep(
                            step_number=step_data.get("step_number", 0),
                            description=step_data.get("description", ""),
                            ui_element=step_data.get("ui_element", ""),
                            expected_result=step_data.get("expected_result", ""),
                            notes=step_data.get("notes", ""),
                        ))
            except Exception as e:
                logger.error(f"解析交互流程失败: {e}")
    else:
        # 降级：简单整理
        prefix = f"{flow.evidence_reason} " if evidence.get("evidence_mode") == "composite" else ""
        flow.flow_description = f"{prefix}（LLM 不可用，以下为证据原始信息）"
        for i, entry in enumerate(matched_entries[:5] or entries[:5], 1):
            flow.steps.append(InteractionStep(
                step_number=i,
                description=entry.title,
                notes=entry.snippet,
            ))

    logger.info(f"交互流程提取完成 - [{competitor_name}] [{feature}]: {len(flow.steps)} 个步骤")
    flow.structured_data["steps"] = [step.to_dict() for step in flow.steps]
    return flow


def _normalize_evidence_text(value: str) -> str:
    """标准化证据文本，方便做保守匹配。"""
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()


FEATURE_INTENT_PATTERNS = [
    ("text_to_video", re.compile(r"(文生视频|文字(?:生成|转|变成)视频|文本(?:生成|转|变成)视频|text[ -]?to[ -]?video)", re.I)),
    ("image_to_video", re.compile(r"(图生视频|图片(?:生成|转|变成|做成)视频|照片(?:生成|转|变成|做成)视频|image[ -]?to[ -]?video)", re.I)),
    ("text_to_image", re.compile(r"(文生图|文字(?:生成|转)图片|文本(?:生成|转)图片|text[ -]?to[ -]?image)", re.I)),
    ("image_to_image", re.compile(r"(图生图|图片(?:生成|转)图片|image[ -]?to[ -]?image)", re.I)),
    ("video_generation", re.compile(r"(生视频|生成视频|视频生成|ai.{0,4}视频(?:生成|制作)|视频制作)", re.I)),
    ("image_generation", re.compile(r"(生图|生成图片|图片生成|生成图像|图像生成|ai绘图|智能绘图)", re.I)),
]


def _normalize_feature_intent(feature: str) -> str:
    """把用户侧近义功能词归一为稳定意图，不绑定具体竞品文案。"""
    text = _normalize_evidence_text(feature)
    for intent, pattern in FEATURE_INTENT_PATTERNS:
        if pattern.search(text):
            return intent
    return "unknown"


def _evidence_capability_signals(text: str) -> set:
    evidence_text = _normalize_evidence_text(text)
    signals = set()
    if not evidence_text:
        return signals

    if FEATURE_INTENT_PATTERNS[0][1].search(evidence_text):
        signals.update({"text_to_video", "video_generation_direct"})
    if FEATURE_INTENT_PATTERNS[1][1].search(evidence_text):
        signals.update({"image_to_video", "video_generation_direct"})
    if FEATURE_INTENT_PATTERNS[2][1].search(evidence_text):
        signals.update({"text_to_image", "image_generation"})
    if FEATURE_INTENT_PATTERNS[3][1].search(evidence_text):
        signals.update({"image_to_image", "image_generation"})
    if re.search(r"(生成.{0,8}视频|视频.{0,8}生成|一键成片|自动成片|智能成片)", evidence_text, re.I):
        signals.add("video_generation_direct")
    if re.search(r"(生成.{0,8}(图片|图像|图)|图片.{0,8}生成|图像.{0,8}生成|ai绘图|智能绘图)", evidence_text, re.I):
        signals.add("image_generation")
    if re.search(r"(视频剪辑|视频在线剪辑|视频编辑|在线编辑.{0,4}视频|剪辑.{0,4}视频)", evidence_text, re.I):
        signals.add("video_editing")
    if re.search(r"(视频模板|模板.{0,6}视频)", evidence_text, re.I):
        signals.add("video_template")
    return signals


def _feature_tokens(feature: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", str(feature or "").lower())
    return [token for token in tokens if token not in {"ai", "the", "and", "功能"}]


def _has_semantic_feature_evidence(feature: str, text: str) -> bool:
    """保守识别中文功能近义表达，避免把已抓到的公开证据误降级成相似线索。"""
    feature_text = _normalize_evidence_text(feature)
    evidence_text = _normalize_evidence_text(text)
    if not feature_text or not evidence_text:
        return False

    intent = _normalize_feature_intent(feature_text)
    signals = _evidence_capability_signals(evidence_text)
    if intent == "video_generation":
        return "video_generation_direct" in signals
    if intent == "text_to_video":
        return "text_to_video" in signals
    if intent == "image_to_video":
        return "image_to_video" in signals
    if intent in {"image_generation", "text_to_image", "image_to_image"}:
        expected = intent if intent != "image_generation" else "image_generation"
        return expected in signals

    if any(word in feature_text for word in ["数字人", "avatar", "头像", "形象"]):
        return bool(re.search(r"(数字人|虚拟人|avatar|头像|形象|分身)", evidence_text, re.I))

    return False


def _entry_text(entry: SearchEntry) -> str:
    return "\n".join([
        getattr(entry, "title", ""),
        getattr(entry, "snippet", ""),
        getattr(entry, "content", ""),
        getattr(entry, "url", ""),
    ])


def _evidence_quality_from_status(status: str) -> str:
    if status == "exact":
        return "full"
    if status == "similar":
        return "partial"
    return "none"


def _entry_supports_feature(feature: str, entry: SearchEntry) -> bool:
    text = _normalize_evidence_text(_entry_text(entry))
    feature_text = _normalize_evidence_text(feature)
    tokens = _feature_tokens(feature)
    return bool(
        (feature_text and feature_text in text) or
        (tokens and all(token in text for token in tokens)) or
        _has_semantic_feature_evidence(feature, text)
    )


def _matching_flow_entries(feature: str, entries: List[SearchEntry]) -> List[SearchEntry]:
    return [entry for entry in entries if _entry_supports_feature(feature, entry)]


def _entry_sources(entries: List[SearchEntry], source_type: str = "exact") -> List[Dict]:
    sources = []
    seen = set()
    for entry in entries[:12]:
        url = str(getattr(entry, "url", "") or "").strip()
        title = str(getattr(entry, "title", "") or "").strip()
        key = url or title
        if not key or key in seen:
            continue
        seen.add(key)
        sources.append({
            "title": title,
            "url": url,
            "type": source_type,
            "snippet": str(getattr(entry, "snippet", "") or "")[:240],
            "published_date": getattr(entry, "published_date", None),
        })
    return sources


def _similar_feature_sources(similar_features: List[Dict]) -> List[Dict]:
    sources = []
    for item in similar_features[:12]:
        sources.append({
            "title": str(item.get("name", "") or "").strip(),
            "url": str(item.get("url", "") or "").strip(),
            "type": "similar",
            "snippet": str(item.get("description", "") or "")[:240],
        })
    return [item for item in sources if item["title"] or item["url"]]


def _raw_entry_data(entries: List[SearchEntry]) -> str:
    parts = []
    for entry in entries[:8]:
        title = str(getattr(entry, "title", "") or "").strip()
        url = str(getattr(entry, "url", "") or "").strip()
        snippet = str(getattr(entry, "snippet", "") or getattr(entry, "content", "") or "").strip()
        parts.append(f"{title}\n{url}\n{snippet[:500]}".strip())
    return "\n---\n".join([part for part in parts if part])


def _raw_similar_data(similar_features: List[Dict]) -> str:
    parts = []
    for item in similar_features[:8]:
        parts.append(f"{item.get('name', '')}\n{item.get('url', '')}\n{item.get('description', '')}".strip())
    return "\n---\n".join([part for part in parts if part])


def _judge_flow_feature_evidence(competitor_name: str, feature: str, entries: List[SearchEntry]) -> Dict:
    """
    判断搜索结果是否真的支持「竞品拥有该功能」。
    没有明确证据时只能返回 not_found/similar，不能继续生成流程步骤。
    """
    feature_text = _normalize_evidence_text(feature)
    normalized_feature = _normalize_feature_intent(feature)
    tokens = _feature_tokens(feature)
    exact_entries = []
    similar_features = []
    signal_entries = {}
    ai_pattern = re.compile(r"(ai|aigc|智能|生成|设计|绘图|图片|视频|素材|文案|模板|头像|形象|数字人)", re.I)

    for entry in entries:
        text = _normalize_evidence_text(_entry_text(entry))
        if not text:
            continue
        for signal in _evidence_capability_signals(text):
            signal_entries.setdefault(signal, []).append(entry)
        has_exact_phrase = feature_text and feature_text in text
        has_all_tokens = bool(tokens) and all(token in text for token in tokens)
        has_semantic_evidence = _has_semantic_feature_evidence(feature, text)
        if has_exact_phrase or has_all_tokens or has_semantic_evidence:
            exact_entries.append(entry)
            continue
        title = getattr(entry, "title", "") or getattr(entry, "snippet", "")
        if ai_pattern.search(title or "") or ai_pattern.search(getattr(entry, "snippet", "") or ""):
            similar_features.append({
                "name": title[:80],
                "url": getattr(entry, "url", ""),
                "description": (getattr(entry, "snippet", "") or getattr(entry, "content", "") or "")[:180],
            })

    if exact_entries:
        return {
            "status": "exact",
            "reason": f"发现 {len(exact_entries)} 条结果明确包含目标功能「{feature}」。",
            "similar_features": [],
            "normalized_feature": normalized_feature,
            "evidence_mode": "direct",
            "confidence": "high",
            "analysis_allowed": True,
            "supporting_entries": exact_entries,
            "capability_signals": sorted(signal_entries.keys()),
        }

    composite_video_evidence = (
        normalized_feature == "video_generation" and
        "image_generation" in signal_entries and
        ({"video_editing", "video_template"} & set(signal_entries.keys()))
    )
    if composite_video_evidence:
        supporting_entries = []
        seen = set()
        for signal in ["image_generation", "video_editing", "video_template"]:
            for entry in signal_entries.get(signal, []):
                key = getattr(entry, "url", "") or getattr(entry, "title", "")
                if key and key not in seen:
                    seen.add(key)
                    supporting_entries.append(entry)
        composite_features = [{
            "name": getattr(entry, "title", "")[:80],
            "url": getattr(entry, "url", ""),
            "description": (getattr(entry, "snippet", "") or getattr(entry, "content", ""))[:180],
        } for entry in supporting_entries[:8]]
        return {
            "status": "similar",
            "reason": f"发现支持「{feature}」的高置信组合证据：AI 图片生成能力与视频编辑/视频模板链路同时存在；可继续分析，但目标功能的直接官方声明仍待补采。",
            "similar_features": composite_features,
            "normalized_feature": normalized_feature,
            "evidence_mode": "composite",
            "confidence": "high",
            "analysis_allowed": True,
            "supporting_entries": supporting_entries,
            "capability_signals": sorted(signal_entries.keys()),
        }
    if similar_features:
        return {
            "status": "similar",
            "reason": f"未发现目标功能「{feature}」的明确证据，仅发现 {len(similar_features)} 条相似 AI/设计能力线索。",
            "similar_features": similar_features[:8],
            "normalized_feature": normalized_feature,
            "evidence_mode": "related",
            "confidence": "medium",
            "analysis_allowed": False,
            "supporting_entries": [],
            "capability_signals": sorted(signal_entries.keys()),
        }
    return {
        "status": "not_found",
        "reason": f"搜索结果未包含目标功能「{feature}」的明确证据。",
        "similar_features": [],
        "normalized_feature": normalized_feature,
        "evidence_mode": "none",
        "confidence": "none",
        "analysis_allowed": False,
        "supporting_entries": [],
        "capability_signals": sorted(signal_entries.keys()),
    }


# =============================================================================
# 完整流程框架分析
# =============================================================================

def analyze_product_framework(
    product_name: str,
    product_url: str,
    crawled_pages: dict,
):
    """
    对产品执行完整流程框架分析，分 6 步调用 LLM 分析，
    每步对应框架文档的一个章节。

    Args:
        product_name: 产品名称
        product_url: 产品 URL
        crawled_pages: site_crawler 的输出 (CrawlResult 对象或 dict)

    Returns:
        ProductFramework 数据对象
    """
    from models import (
        ProductFramework, NavigationNode, FeatureModule,
        UserJourney, UserJourneyStep, DecisionPoint,
        ExceptionFlow, StateTransition, CrossFunctionLink,
    )

    logger.info(f"===== 开始产品框架分析: {product_name} =====")

    framework = ProductFramework(
        product_name=product_name,
        product_url=product_url,
    )

    # 提取爬取数据
    if hasattr(crawled_pages, "to_dict"):
        pages_data = crawled_pages.to_dict()
        nav_tree = getattr(crawled_pages, "navigation_tree", [])
        pages_dict = getattr(crawled_pages, "pages", {})
        crawler_features = getattr(crawled_pages, "features", []) or pages_data.get("features", [])
        sitemap_navigation = getattr(crawled_pages, "sitemap_navigation", []) or pages_data.get("sitemap_navigation", [])
        framework.total_pages_crawled = getattr(crawled_pages, "total_pages", 0)
        framework.source_urls = list(pages_dict.keys())[:180]
        total_sitemap_urls = len(getattr(crawled_pages, "sitemap_urls", []) or [])
    elif isinstance(crawled_pages, dict):
        pages_data = crawled_pages
        nav_tree = crawled_pages.get("navigation_tree", [])
        pages_dict = crawled_pages.get("pages", {})
        crawler_features = crawled_pages.get("features", []) or crawled_pages.get("crawler_features", [])
        sitemap_navigation = crawled_pages.get("sitemap_navigation", [])
        framework.total_pages_crawled = crawled_pages.get("total_pages", 0)
        framework.source_urls = list(pages_dict.keys())[:180] if isinstance(pages_dict, dict) else []
        total_sitemap_urls = int(crawled_pages.get("sitemap_urls_count", len(crawled_pages.get("sitemap_urls", []))) or 0)
    else:
        pages_data = {}
        nav_tree = []
        pages_dict = {}
        crawler_features = []
        sitemap_navigation = []
        total_sitemap_urls = 0

    framework.crawler_features = _normalize_feature_evidence(crawler_features)
    framework.sitemap_navigation = _normalize_navigation_evidence(sitemap_navigation)
    framework.page_evidence = _build_page_evidence(pages_dict)
    framework.evidence_count = (
        len(framework.crawler_features) +
        len(framework.sitemap_navigation) +
        len(framework.page_evidence)
    )
    coverage_data_gaps = []
    page_urls = {str(item.get("url", "")).rstrip("/") for item in framework.page_evidence if item.get("url")}
    sitemap_evidence_urls = set()

    def collect_navigation_urls(items):
        for item in items if isinstance(items, list) else []:
            url = str(item.get("url", "") or "").rstrip("/")
            if url:
                sitemap_evidence_urls.add(url)
            collect_navigation_urls(item.get("children", []))

    collect_navigation_urls(framework.sitemap_navigation)
    sitemap_only_urls = sorted(url for url in sitemap_evidence_urls if url not in page_urls)
    if framework.total_pages_crawled > len(framework.page_evidence):
        coverage_data_gaps.append(
            f"已爬取 {framework.total_pages_crawled} 个页面，但仅保留 {len(framework.page_evidence)} 个页面证据，剩余页面待补采"
        )
    if total_sitemap_urls > 200:
        coverage_data_gaps.append(
            f"Sitemap 发现 {total_sitemap_urls} 个 URL，本轮仅分析优先级最高的 200 个候选，其余待补采"
        )
    if sitemap_only_urls:
        coverage_data_gaps.append(
            f"Sitemap/站点地图中有 {len(sitemap_only_urls)} 个页面尚未抓取正文，已保留 URL 清单并标记待补采"
        )
    framework.evidence_quality = "full" if framework.page_evidence and (framework.crawler_features or framework.sitemap_navigation) and not coverage_data_gaps else (
        "partial" if framework.evidence_count else "none"
    )
    framework.sources = _framework_sources(framework.page_evidence, framework.source_urls)
    framework.raw_data = _framework_raw_data(framework.page_evidence, framework.crawler_features, framework.sitemap_navigation)
    framework.structured_data = {
        "crawler_features": framework.crawler_features,
        "sitemap_navigation": framework.sitemap_navigation,
        "page_evidence": framework.page_evidence,
        "total_pages_crawled": framework.total_pages_crawled,
        "total_sitemap_urls": total_sitemap_urls,
        "coverage_data_gaps": coverage_data_gaps,
    }

    # 构建分析素材
    analysis_material = _build_framework_material(
        pages_dict,
        nav_tree,
        framework.crawler_features,
        framework.sitemap_navigation,
    )

    # 步骤 1: 信息架构分析
    logger.info("步骤 1/6: 分析信息架构...")
    _analyze_information_architecture(
        framework,
        analysis_material,
        nav_tree,
        framework.crawler_features,
        framework.sitemap_navigation,
        pages_dict,
    )
    _ensure_framework_modules_from_evidence(
        framework,
        framework.crawler_features,
        framework.sitemap_navigation,
        pages_dict,
    )

    # 步骤 2: 用户旅程提取
    logger.info("步骤 2/6: 提取用户旅程...")
    _analyze_user_journeys(framework, analysis_material)

    # 步骤 3: 决策点识别
    logger.info("步骤 3/6: 识别决策点...")
    _analyze_decision_points(framework, analysis_material)

    # 步骤 4: 异常处理分析
    logger.info("步骤 4/6: 分析异常处理流程...")
    _analyze_exception_flows(framework, analysis_material)

    # 步骤 5: 状态流转建模
    logger.info("步骤 5/6: 建模状态流转...")
    _analyze_state_transitions(framework, analysis_material)

    # 步骤 6: 跨功能关联
    logger.info("步骤 6/6: 分析跨功能关联...")
    _analyze_cross_function_links(framework, analysis_material)

    framework.total_features_identified = len(framework.feature_modules)
    framework.structured_data["feature_modules"] = [module.to_dict() for module in framework.feature_modules]
    framework.structured_data["user_journeys"] = [journey.to_dict() for journey in framework.user_journeys]

    # 汇总所有步骤的 data_gaps
    all_data_gaps = []
    for gap_key in ["coverage_data_gaps", "info_arch_data_gaps", "journey_data_gaps", "decision_data_gaps",
                     "exception_data_gaps", "state_data_gaps", "cross_function_data_gaps"]:
        gaps = framework.structured_data.get(gap_key, [])
        if isinstance(gaps, list):
            all_data_gaps.extend(gaps)
    # 去重
    framework.structured_data["data_gaps"] = list(dict.fromkeys(all_data_gaps))

    # 生成可复用 UX 洞察
    reusable_insights = []
    # 从决策点提取洞察
    for dp in framework.decision_points:
        sd = getattr(dp, "structured_data", {}) or {}
        if sd.get("user_cognitive_load") == "high":
            reusable_insights.append(f"决策点「{dp.decision}」认知负荷高，建议简化选项或提供默认值")
        if sd.get("current_ux_quality") == "差":
            reusable_insights.append(f"决策点「{dp.decision}」当前UX质量差，需改进: {sd.get('improvement_suggestion', '')}")
    # 从异常流提取洞察
    for ef in framework.exception_flows:
        sd = getattr(ef, "structured_data", {}) or {}
        if sd.get("user_frustration_level") == "high":
            reusable_insights.append(f"异常「{ef.scenario}」用户挫败感高，需优化恢复路径")
    # 从跨功能关联提取洞察
    for cfl in framework.cross_function_links:
        sd = getattr(cfl, "structured_data", {}) or {}
        if sd.get("link_strength") == "strong" and sd.get("user_visibility") == "用户可见":
            reusable_insights.append(f"「{cfl.source_feature}」与「{cfl.target_feature}」强关联且用户可见，可考虑合并入口或统一交互模式")
    framework.structured_data["reusable_insights"] = reusable_insights

    logger.info(
        f"框架分析完成: {len(framework.feature_modules)} 个功能模块, "
        f"{len(framework.user_journeys)} 个用户旅程, "
        f"{len(framework.decision_points)} 个决策点, "
        f"{len(reusable_insights)} 条可复用洞察, "
        f"{len(framework.structured_data.get('data_gaps', []))} 个信息缺口"
    )

    return framework


def _page_field(page, field_name: str, default=""):
    if hasattr(page, field_name):
        return getattr(page, field_name)
    if isinstance(page, dict):
        return page.get(field_name, default)
    return default


def _normalize_feature_evidence(features) -> List[Dict]:
    """标准化爬虫识别出的功能证据。"""
    normalized = []
    seen = set()
    if not isinstance(features, list):
        return normalized
    for item in features:
        if isinstance(item, str):
            data = {"name": item}
        elif isinstance(item, dict):
            data = item
        else:
            continue
        name = str(data.get("name", "")).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        normalized.append({
            "name": name,
            "url": str(data.get("url", "")).strip(),
            "description": str(data.get("description", "")).strip(),
            "page_count": data.get("page_count", 1),
            "related_urls": data.get("related_urls", [])[:10] if isinstance(data.get("related_urls", []), list) else [],
        })
    return normalized[:200]


def _normalize_navigation_evidence(nav_items) -> List[Dict]:
    """标准化 sitemap 或 DOM 导航证据。"""
    if not isinstance(nav_items, list):
        return []
    normalized = []
    for item in nav_items[:200]:
        if not isinstance(item, dict):
            continue
        children = []
        for child in item.get("children", [])[:200] if isinstance(item.get("children", []), list) else []:
            if isinstance(child, dict):
                children.append({
                    "name": str(child.get("name", "")).strip(),
                    "url": str(child.get("url", "")).strip(),
                    "level": child.get("level", 1),
                    "node_type": child.get("node_type", "page"),
                    "children": [],
                })
        normalized.append({
            "name": str(item.get("name", "")).strip(),
            "url": str(item.get("url", "")).strip(),
            "level": item.get("level", 0),
            "node_type": item.get("node_type", "section"),
            "children": children,
        })
    return [item for item in normalized if item["name"]]


def _build_page_evidence(pages_dict, limit: int = 180) -> List[Dict]:
    """抽取页面级证据，供 JSON 和后端模型继续使用。"""
    evidence = []
    if not isinstance(pages_dict, dict):
        return evidence
    for url, page in list(pages_dict.items())[:limit]:
        features = _normalize_feature_evidence(_page_field(page, "features", []))
        evidence.append({
            "url": str(_page_field(page, "url", url) or url),
            "title": str(_page_field(page, "title", "") or ""),
            "content": str(_page_field(page, "content", "") or "")[:1200],
            "features": features[:12],
        })
    return evidence


def _framework_sources(page_evidence: List[Dict], source_urls: List[str]) -> List[Dict]:
    sources = []
    seen = set()
    for page in page_evidence[:180]:
        url = str(page.get("url", "") or "").strip()
        title = str(page.get("title", "") or "").strip()
        key = url or title
        if not key or key in seen:
            continue
        seen.add(key)
        sources.append({
            "title": title,
            "url": url,
            "type": "page",
            "snippet": str(page.get("content", "") or "")[:240],
        })
    for url in source_urls[:180]:
        text = str(url or "").strip()
        if text and text not in seen:
            seen.add(text)
            sources.append({"title": "", "url": text, "type": "page", "snippet": ""})
    return sources[:200]


def _framework_raw_data(page_evidence: List[Dict], crawler_features: List[Dict], sitemap_navigation: List[Dict]) -> str:
    parts = []
    if crawler_features:
        names = "、".join([item.get("name", "") for item in crawler_features[:100] if item.get("name")])
        if names:
            parts.append(f"爬虫识别功能：{names}")
    if sitemap_navigation:
        names = "、".join([item.get("name", "") for item in sitemap_navigation[:100] if item.get("name")])
        if names:
            parts.append(f"导航证据：{names}")
    for page in page_evidence[:40]:
        parts.append(f"{page.get('title', '')}\n{page.get('url', '')}\n{str(page.get('content', '') or '')[:800]}".strip())
    return "\n---\n".join([part for part in parts if part])


def _build_framework_material(pages_dict, nav_tree, crawler_features=None, sitemap_navigation=None) -> str:
    """构建框架分析的输入素材"""
    material_parts = []
    crawler_features = crawler_features or []
    sitemap_navigation = sitemap_navigation or []
    page_items = list(pages_dict.items())[:180] if isinstance(pages_dict, dict) else []

    # 页面索引放在最前面，确保后续导航或正文过长时仍保留完整可见页面名称和 URL。
    material_parts.append("=== 完整页面清单 ===")
    for i, (url, page) in enumerate(page_items):
        title = _page_field(page, "title", "")
        material_parts.append(f"- P{i+1:03d} {title} ({url})")

    # 导航结构
    if nav_tree:
        material_parts.append("=== 导航结构 ===")
        for item in nav_tree:
            indent = "  " * item.get("level", 0)
            material_parts.append(f"{indent}- {item.get('name', '')} ({item.get('url', '')})")
            for child in item.get("children", []):
                child_indent = "  " * child.get("level", 0)
                material_parts.append(f"{child_indent}  - {child.get('name', '')} ({child.get('url', '')})")

    if sitemap_navigation:
        material_parts.append("\n=== Sitemap 推断导航/功能入口 ===")
        for item in sitemap_navigation[:200]:
            material_parts.append(f"- {item.get('name', '')} ({item.get('url', '')})")
            for child in item.get("children", [])[:200]:
                material_parts.append(f"  - {child.get('name', '')} ({child.get('url', '')})")

    if crawler_features:
        material_parts.append("\n=== 爬虫识别功能入口 ===")
        for feature in crawler_features[:120]:
            detail = feature.get("description", "")
            url = feature.get("url", "")
            material_parts.append(f"- {feature.get('name', '')}: {detail} {url}".strip())

    if page_items:
        material_parts.append("\n=== 重点页面内容摘要 ===")
        for i, (url, page) in enumerate(page_items[:30]):
            if hasattr(page, "title"):
                title = page.title
                content = page.content[:1200] if page.content else ""
                features = [f.get("name", "") for f in getattr(page, "features", [])[:10]]
            elif isinstance(page, dict):
                title = page.get("title", "")
                content = page.get("content", "")[:1200]
                features = [f.get("name", "") for f in page.get("features", [])[:10]]
            else:
                continue

            part = f"\n[页面 {i+1}] {title}\nURL: {url}\n"
            if features:
                part += f"功能入口: {', '.join(features)}\n"
            part += f"内容:\n{content}\n"
            material_parts.append(part)

    material = "\n".join(material_parts)
    if len(material) > 80000:
        return material[:79900] + "\n[材料预算已达 80000 字符，完整页面索引已优先保留，更多正文待补采]"
    return material


def _analyze_information_architecture(
    framework,
    material,
    nav_tree,
    crawler_features=None,
    sitemap_navigation=None,
    pages_dict=None,
):
    """步骤1: 信息架构分析"""
    from models import NavigationNode, FeatureModule

    if config.LLM_API_KEY:
        system_prompt = """你是一位资深 UX 架构师和信息架构专家。请根据提供的产品网站数据，分析产品的信息架构。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

你需要输出 JSON 格式的结果，包含以下三个部分：

1. navigation_tree: 导航结构树（数组，每项包含 name, url, level, children, node_type, confidence）
   node_type 可选: "page", "feature", "section", "action"
   confidence 可选: "full"（有直接证据）, "partial"（部分推断）, "inferred"（无证据推断）

2. feature_modules: 功能模块列表（数组，每项包含 module_id, name, level, purpose, entry_path, prerequisite, complexity, confidence, data_sources）
   module_id 格式: M01, M02...
   level 格式: L1-首页核心, L1-二级导航, L2-子功能, L3-辅助功能 等
   complexity: ★☆☆☆☆ 到 ★★★★★
   confidence: "full"|"partial"|"inferred"
   data_sources: 说明该模块结论基于什么证据（如"导航栏直接出现"/"sitemap推断"/"页面内容推断"）

3. page_hierarchy: 页面层级关系（文本格式的树状图，用缩进和连接线表示）

4. data_gaps: 信息缺口列表（缺失的页面/模块/导航层级）

请以 JSON 格式返回：
{
    "navigation_tree": [...],
    "feature_modules": [...],
    "page_hierarchy": "树状图文本...",
    "data_gaps": ["缺失的页面/模块"]
}
只返回 JSON，不要其他内容。"""

        prompt = f"请分析以下产品的信息架构：\n\n{material}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    # 解析导航树
                    for item in data.get("navigation_tree", []):
                        framework.navigation_tree.append(
                            _dict_to_nav_node(item)
                        )

                    # 解析功能模块
                    for item in data.get("feature_modules", []):
                        module = FeatureModule(
                            module_id=item.get("module_id", f"M{len(framework.feature_modules)+1:02d}"),
                            name=item.get("name", ""),
                            level=item.get("level", ""),
                            purpose=item.get("purpose", ""),
                            entry_path=item.get("entry_path", ""),
                            prerequisite=item.get("prerequisite", ""),
                            complexity=item.get("complexity", ""),
                        )
                        # 将 confidence 和 data_sources 存入 structured_data
                        module.structured_data = {
                            "confidence": item.get("confidence", "inferred"),
                            "data_sources": item.get("data_sources", ""),
                        }
                        framework.feature_modules.append(module)

                    # 页面层级
                    framework.page_hierarchy = data.get("page_hierarchy", "")
                    # 存储 data_gaps
                    framework.structured_data["info_arch_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"信息架构分析完成: {len(framework.feature_modules)} 个功能模块")
                    return
            except Exception as e:
                logger.error(f"解析信息架构分析结果失败: {e}")

    # 降级方案：从爬取数据中提取
    _rule_based_information_architecture(
        framework,
        nav_tree,
        crawler_features or [],
        sitemap_navigation or [],
        pages_dict or {},
    )


def _add_feature_module_if_missing(framework, name: str, url: str = "", purpose: str = "", level: str = "L1-功能入口"):
    """避免同名功能模块重复进入框架。"""
    from models import FeatureModule

    clean_name = str(name or "").strip()
    if not clean_name:
        return
    existing = {item.name for item in framework.feature_modules}
    if clean_name in existing:
        return
    framework.feature_modules.append(FeatureModule(
        module_id=f"M{len(framework.feature_modules)+1:02d}",
        name=clean_name,
        level=level,
        purpose=purpose or f"基于爬虫证据识别的产品功能: {clean_name}",
        entry_path=url,
        structured_data={
            "confidence": "full" if url else "partial",
            "data_sources": ["公开页面 URL/导航入口"] if url else ["公开页面文本线索"],
        },
    ))


def _append_navigation_node(framework, item: Dict, default_type: str = "page"):
    """把导航证据追加为 NavigationNode。"""
    from models import NavigationNode

    node = NavigationNode(
        name=item.get("name", ""),
        url=item.get("url", ""),
        level=item.get("level", 0),
        node_type=item.get("node_type", default_type),
    )
    for child in item.get("children", []) if isinstance(item.get("children", []), list) else []:
        node.children.append(NavigationNode(
            name=child.get("name", ""),
            url=child.get("url", ""),
            level=child.get("level", 1),
            node_type=child.get("node_type", "feature"),
        ))
    if node.name:
        framework.navigation_tree.append(node)


def _ensure_page_hierarchy(framework):
    if framework.page_hierarchy and "LLM 不可用" not in framework.page_hierarchy:
        return
    lines = [framework.product_name or "产品"]
    for node in framework.navigation_tree[:180]:
        lines.append(f"├─ {node.name}")
        for child in node.children[:200]:
            lines.append(f"│  ├─ {child.name}")
    if len(lines) == 1:
        for module in framework.feature_modules[:120]:
            lines.append(f"├─ {module.name}")
    framework.page_hierarchy = "\n".join(lines)


def _ensure_framework_modules_from_evidence(framework, crawler_features, sitemap_navigation, pages_dict):
    """只把明确的功能证据并入模块；页面与 sitemap 栏目保留在独立页面清单。"""
    for feature in crawler_features[:120]:
        _add_feature_module_if_missing(
            framework,
            feature.get("name", ""),
            feature.get("url", ""),
            feature.get("description", ""),
            "L1-爬虫识别功能",
        )
    if not framework.feature_modules:
        gaps = framework.structured_data.setdefault("info_arch_data_gaps", [])
        message = "已获得页面/站点地图证据，但没有足够证据把页面判定为产品功能模块"
        if message not in gaps:
            gaps.append(message)
    _ensure_page_hierarchy(framework)


def _rule_based_information_architecture(framework, nav_tree, crawler_features=None, sitemap_navigation=None, pages_dict=None):
    """规则降级的信息架构分析"""
    from models import NavigationNode
    crawler_features = crawler_features or []
    sitemap_navigation = sitemap_navigation or []

    # 从导航树构建
    for item in nav_tree:
        _append_navigation_node(framework, item, "page")

    if not framework.navigation_tree:
        for item in sitemap_navigation[:120]:
            _append_navigation_node(framework, item, "section")

    # 生成简单功能模块
    _ensure_framework_modules_from_evidence(framework, crawler_features, sitemap_navigation, pages_dict or {})

    if not framework.page_hierarchy:
        framework.page_hierarchy = "(LLM 不可用，仅基于爬取数据生成)"


def _analyze_user_journeys(framework, material):
    """步骤2: 用户旅程提取"""
    from models import UserJourney, UserJourneyStep

    # 获取功能模块名称
    feature_names = [m.name for m in framework.feature_modules[:20]]

    if config.LLM_API_KEY and feature_names:
        system_prompt = """你是一位 UX 研究专家，擅长用户旅程地图绘制。请根据提供的产品信息，为每个已识别核心功能提取完整的用户旅程。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

每个用户旅程需要包含：
1. feature_name: 功能名称
2. entry_point: 入口位置
3. journey_id: 旅程编号（J01, J02...）
4. steps: 详细步骤列表（每项包含 step_id, description, ui_element, user_action, system_feedback, is_exception, confidence, evidence）
   step_id 格式: S1, S2...
   confidence: "full"（有直接证据）, "partial"（部分推断）, "inferred"（无证据推断）
   evidence: 说明该步骤结论基于什么证据
5. normal_flow: 正常流程步骤 ID 列表
6. branch_flows: 分支路径描述列表，说明触发条件和回到主路径的位置
7. exception_flows: 异常路径描述列表，说明系统响应和恢复路径
8. journey_confidence: 整体旅程的置信度（full/partial/inferred）

请以 JSON 格式返回：
{
    "user_journeys": [
        {
            "feature_name": "功能名称",
            "entry_point": "入口路径",
            "journey_id": "J01",
            "steps": [
                {
                    "step_id": "S1",
                    "description": "步骤描述",
                    "ui_element": "涉及的UI元素",
                    "user_action": "用户操作",
                    "system_feedback": "系统反馈",
                    "is_exception": false,
                    "confidence": "full|partial|inferred",
                    "evidence": "证据说明"
                }
            ],
            "normal_flow": ["S1", "S2"],
            "branch_flows": ["分支路径1：触发条件 → 分支步骤 → 回到主路径"],
            "exception_flows": ["异常流1描述"],
            "journey_confidence": "overall journey confidence"
        }
    ],
    "data_gaps": ["缺失的旅程信息"]
}
只返回 JSON。"""

        prompt = f"请为以下核心功能提取用户旅程，并逐项区分主路径、分支路径、异常路径：\n功能列表: {', '.join(feature_names)}\n\n产品数据:\n{material[:16000]}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    for journey_data in data.get("user_journeys", []):
                        journey = UserJourney(
                            feature_name=journey_data.get("feature_name", ""),
                            entry_point=journey_data.get("entry_point", ""),
                            normal_flow=journey_data.get("normal_flow", []),
                            exception_flows=journey_data.get("exception_flows", []),
                        )
                        # 存储新增的 journey_id 和 journey_confidence
                        journey.structured_data = {
                            "journey_id": journey_data.get("journey_id", ""),
                            "journey_confidence": journey_data.get("journey_confidence", "inferred"),
                            "branch_flows": journey_data.get("branch_flows", []),
                        }
                        for step_data in journey_data.get("steps", []):
                            step = UserJourneyStep(
                                step_id=step_data.get("step_id", ""),
                                description=step_data.get("description", ""),
                                ui_element=step_data.get("ui_element", ""),
                                user_action=step_data.get("user_action", ""),
                                system_feedback=step_data.get("system_feedback", ""),
                                is_exception=step_data.get("is_exception", False),
                            )
                            # 存储新增的 confidence 和 evidence
                            step.structured_data = {
                                "confidence": step_data.get("confidence", "inferred"),
                                "evidence": step_data.get("evidence", ""),
                            }
                            journey.steps.append(step)
                        framework.user_journeys.append(journey)
                    # 存储 data_gaps
                    framework.structured_data["journey_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"用户旅程提取完成: {len(framework.user_journeys)} 个旅程")
                    return
            except Exception as e:
                logger.error(f"解析用户旅程失败: {e}")

    # 降级方案
    for module in framework.feature_modules[:20]:
        journey = UserJourney(
            feature_name=module.name,
            entry_point=module.entry_path,
            normal_flow=["步骤1", "步骤2", "步骤3"],
            exception_flows=["(LLM 不可用，无法提取异常流)"],
        )
        journey.steps.append(UserJourneyStep(
            step_id="1",
            description=f"进入{module.name}功能",
        ))
        framework.user_journeys.append(journey)


def _analyze_decision_points(framework, material):
    """步骤3: 决策点识别"""
    from models import DecisionPoint

    if config.LLM_API_KEY:
        system_prompt = """你是一位产品设计师，擅长分析用户决策路径。请根据产品信息，识别用户在各个流程中需要做出的关键决策。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

请以 JSON 格式返回：
{
    "decision_points": [
        {
            "location": "决策所在的流程/页面",
            "decision": "用户需要做什么决策",
            "options": ["选项1", "选项2", "选项3"],
            "criteria": "用户做决策的依据",
            "ux_implication": "UX设计影响/建议",
            "decision_type": "选择|配置|确认|放弃",
            "user_cognitive_load": "high|medium|low",
            "current_ux_quality": "好|一般|差",
            "improvement_suggestion": "改进建议"
        }
    ],
    "data_gaps": ["信息缺口"]
}
只返回 JSON。"""

        prompt = f"请识别以下产品中的关键决策点：\n\n{material[:16000]}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    for dp_data in data.get("decision_points", []):
                        dp = DecisionPoint(
                            location=dp_data.get("location", ""),
                            decision=dp_data.get("decision", ""),
                            options=dp_data.get("options", []),
                            criteria=dp_data.get("criteria", ""),
                            ux_implication=dp_data.get("ux_implication", ""),
                        )
                        # 存储新增字段到 structured_data
                        dp.structured_data = {
                            "decision_type": dp_data.get("decision_type", ""),
                            "user_cognitive_load": dp_data.get("user_cognitive_load", ""),
                            "current_ux_quality": dp_data.get("current_ux_quality", ""),
                            "improvement_suggestion": dp_data.get("improvement_suggestion", ""),
                        }
                        framework.decision_points.append(dp)
                    # 存储 data_gaps
                    framework.structured_data["decision_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"决策点识别完成: {len(framework.decision_points)} 个决策点")
                    return
            except Exception as e:
                logger.error(f"解析决策点失败: {e}")

    # 降级
    framework.decision_points.append(DecisionPoint(
        location="(待分析)",
        decision="(LLM 不可用，无法识别决策点)",
    ))


def _analyze_exception_flows(framework, material):
    """步骤4: 异常处理分析"""
    from models import ExceptionFlow

    if config.LLM_API_KEY:
        system_prompt = """你是一位 QA 和异常处理专家。请根据产品信息，分析可能的异常场景及其处理方式。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

覆盖以下异常类型：
- error: 系统错误
- empty: 空状态（无数据）
- loading: 加载状态
- timeout: 超时
- validation: 输入验证

请以 JSON 格式返回：
{
    "exception_flows": [
        {
            "exception_id": "E01",
            "scenario": "异常场景描述",
            "trigger": "触发条件",
            "system_response": "系统响应方式",
            "recovery_path": "用户恢复路径",
            "error_type": "error/empty/loading/timeout/validation",
            "affected_pages": ["P01", "P02"],
            "user_frustration_level": "high|medium|low",
            "recovery_success_estimate": "预估恢复成功率（如90%）"
        }
    ],
    "data_gaps": ["信息缺口"]
}
只返回 JSON。"""

        prompt = f"请分析以下产品中可能的异常场景和处理方式：\n\n{material[:16000]}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    for ef_data in data.get("exception_flows", []):
                        ef = ExceptionFlow(
                            scenario=ef_data.get("scenario", ""),
                            trigger=ef_data.get("trigger", ""),
                            system_response=ef_data.get("system_response", ""),
                            recovery_path=ef_data.get("recovery_path", ""),
                            error_type=ef_data.get("error_type", ""),
                        )
                        # 存储新增字段到 structured_data
                        ef.structured_data = {
                            "exception_id": ef_data.get("exception_id", ""),
                            "affected_pages": ef_data.get("affected_pages", []),
                            "user_frustration_level": ef_data.get("user_frustration_level", ""),
                            "recovery_success_estimate": ef_data.get("recovery_success_estimate", ""),
                        }
                        framework.exception_flows.append(ef)
                    # 存储 data_gaps
                    framework.structured_data["exception_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"异常流程分析完成: {len(framework.exception_flows)} 个异常场景")
                    return
            except Exception as e:
                logger.error(f"解析异常流程失败: {e}")

    # 降级
    framework.exception_flows.append(ExceptionFlow(
        scenario="(待分析)",
        trigger="(LLM 不可用，无法分析异常流程)",
        system_response="",
        recovery_path="",
    ))


def _analyze_state_transitions(framework, material):
    """步骤5: 状态流转建模"""
    from models import StateTransition

    if config.LLM_API_KEY:
        system_prompt = """你是一位系统架构师，擅长状态机建模。请根据产品信息，识别核心实体的状态流转。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

核心实体可能包括：视频、数字人、用户账户、订单、任务 等。

请以 JSON 格式返回：
{
    "state_transitions": [
        {
            "transition_id": "TR01",
            "entity": "实体名称",
            "state_machine_id": "SM01",
            "from_state": "起始状态",
            "to_state": "目标状态",
            "trigger": "触发动作",
            "conditions": "前置条件（可选）",
            "confidence": "full|partial|inferred",
            "reversible": true/false
        }
    ],
    "data_gaps": ["信息缺口"]
}
只返回 JSON。"""

        prompt = f"请分析以下产品中核心实体的状态流转：\n\n{material[:16000]}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    for st_data in data.get("state_transitions", []):
                        st = StateTransition(
                            entity=st_data.get("entity", ""),
                            from_state=st_data.get("from_state", ""),
                            to_state=st_data.get("to_state", ""),
                            trigger=st_data.get("trigger", ""),
                            conditions=st_data.get("conditions", ""),
                        )
                        # 存储新增字段到 structured_data
                        st.structured_data = {
                            "transition_id": st_data.get("transition_id", ""),
                            "state_machine_id": st_data.get("state_machine_id", ""),
                            "confidence": st_data.get("confidence", "inferred"),
                            "reversible": st_data.get("reversible", None),
                        }
                        framework.state_transitions.append(st)
                    # 存储 data_gaps
                    framework.structured_data["state_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"状态流转建模完成: {len(framework.state_transitions)} 个转换")
                    return
            except Exception as e:
                logger.error(f"解析状态流转失败: {e}")

    # 降级
    framework.state_transitions.append(StateTransition(
        entity="(待分析)",
        from_state="(LLM 不可用)",
        to_state="(待分析)",
        trigger="(待分析)",
    ))


def _analyze_cross_function_links(framework, material):
    """步骤6: 跨功能关联分析"""
    from models import CrossFunctionLink

    feature_names = [m.name for m in framework.feature_modules[:40]]

    if config.LLM_API_KEY and feature_names:
        system_prompt = """你是一位产品架构师，擅长分析功能间的关联关系。请根据产品信息，分析各功能模块之间的关联。

只基于提供的证据材料分析，无证据的信息标注 confidence 为 inferred。

关联类型包括：
- 数据共享：两个功能共享某些数据
- 导航跳转：从一个功能可以跳转到另一个
- 依赖关系：一个功能依赖另一个功能的输出
- 流程串联：两个功能在用户流程中前后衔接

请以 JSON 格式返回：
{
    "cross_function_links": [
        {
            "link_id": "LNK01",
            "source_feature": "源功能",
            "target_feature": "目标功能",
            "relationship": "关联类型（数据共享/导航跳转/依赖关系/流程串联）",
            "description": "关联描述",
            "link_strength": "strong|medium|weak",
            "user_visibility": "用户可见|系统内部",
            "data_shared": ["共享的数据字段1", "共享的数据字段2"]
        }
    ],
    "data_gaps": ["信息缺口"]
}
只返回 JSON。"""

        prompt = f"请分析以下功能模块之间的关联关系：\n功能列表: {', '.join(feature_names)}\n\n产品数据:\n{material[:16000]}"

        response = _call_llm(prompt, system_prompt)
        if response:
            try:
                data = _parse_json_response(response)
                if data:
                    for cfl_data in data.get("cross_function_links", []):
                        cfl = CrossFunctionLink(
                            source_feature=cfl_data.get("source_feature", ""),
                            target_feature=cfl_data.get("target_feature", ""),
                            relationship=cfl_data.get("relationship", ""),
                            description=cfl_data.get("description", ""),
                        )
                        # 存储新增字段到 structured_data
                        cfl.structured_data = {
                            "link_id": cfl_data.get("link_id", ""),
                            "link_strength": cfl_data.get("link_strength", ""),
                            "user_visibility": cfl_data.get("user_visibility", ""),
                            "data_shared": cfl_data.get("data_shared", []),
                        }
                        framework.cross_function_links.append(cfl)
                    # 存储 data_gaps
                    framework.structured_data["cross_function_data_gaps"] = data.get("data_gaps", [])
                    logger.info(f"跨功能关联分析完成: {len(framework.cross_function_links)} 个关联")
                    return
            except Exception as e:
                logger.error(f"解析跨功能关联失败: {e}")

    # 降级
    framework.cross_function_links.append(CrossFunctionLink(
        source_feature="(待分析)",
        target_feature="(待分析)",
        relationship="(LLM 不可用，无法分析)",
        description="",
    ))


def _dict_to_nav_node(data: dict):
    """将字典转换为 NavigationNode（递归处理子节点）"""
    from models import NavigationNode

    children = []
    for child_data in data.get("children", []):
        if isinstance(child_data, dict):
            children.append(_dict_to_nav_node(child_data))

    return NavigationNode(
        name=data.get("name", ""),
        url=data.get("url", ""),
        level=data.get("level", 0),
        children=children,
        node_type=data.get("node_type", ""),
    )


def _parse_json_response(response: str) -> Optional[dict]:
    """解析 LLM 返回的 JSON 响应"""
    if not response:
        return None

    response_text = response.strip()

    # 移除 markdown 代码块
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        # 移除第一行和最后一行
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        response_text = "\n".join(lines)

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        # 尝试查找 JSON 块
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        logger.error("无法解析 LLM 返回的 JSON")
        return None
