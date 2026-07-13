"""
竞品监控 - 搜索和网页抓取模块

支持多种搜索引擎后端（Google Custom Search / Bing / SerpAPI / DuckDuckGo），
以及网页内容抓取功能。提供统一的接口供上层调用。
"""

import json
import time
import random
import logging
import requests
from typing import List, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

import config
from models import SearchEntry, Competitor

logger = logging.getLogger(__name__)

# User-Agent 轮换池，用于避免反爬限制
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


def _get_headers() -> dict:
    """生成带随机 User-Agent 的请求头"""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }


def _request_with_retry(url: str, method: str = "GET", **kwargs) -> Optional[requests.Response]:
    """
    带重试机制的 HTTP 请求。

    Args:
        url: 请求 URL
        method: HTTP 方法（GET/POST）
        **kwargs: 传递给 requests 的其他参数

    Returns:
        Response 对象，失败时返回 None
    """
    for attempt in range(config.MAX_RETRIES):
        try:
            headers = kwargs.pop("headers", _get_headers())
            timeout = kwargs.pop("timeout", config.FETCH_TIMEOUT)

            if method.upper() == "GET":
                resp = requests.get(url, headers=headers, timeout=timeout, **kwargs)
            else:
                resp = requests.post(url, headers=headers, timeout=timeout, **kwargs)

            resp.raise_for_status()
            if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp
        except requests.RequestException as e:
            logger.warning(f"请求失败（第 {attempt + 1} 次）: {url} - {e}")
            if attempt < config.MAX_RETRIES - 1:
                time.sleep(2 ** attempt)  # 指数退避
            else:
                logger.error(f"请求最终失败: {url}")
                return None
    return None


# =============================================================================
# 搜索引擎后端实现
# =============================================================================

def _search_duckduckgo(query: str, max_results: int) -> List[SearchEntry]:
    """
    DuckDuckGo 搜索（免费，无需 API Key）。
    使用 DuckDuckGo HTML 版本进行搜索。
    """
    entries = []
    try:
        # 使用 DuckDuckGo HTML 搜索
        search_url = "https://html.duckduckgo.com/html/"
        resp = _request_with_retry(
            search_url,
            method="POST",
            data={"q": query},
        )
        if not resp:
            return entries

        soup = BeautifulSoup(resp.text, "html.parser")
        results = soup.find_all("div", class_="result")

        for result in results[:max_results]:
            try:
                title_elem = result.find("a", class_="result__a")
                snippet_elem = result.find("a", class_="result__snippet")

                if title_elem:
                    title = title_elem.get_text(strip=True)
                    url = title_elem.get("href", "")
                    # DuckDuckGo 的链接可能是重定向格式
                    if "uddg=" in url:
                        from urllib.parse import unquote, parse_qs, urlparse
                        parsed = urlparse(url)
                        params = parse_qs(parsed.query)
                        url = unquote(params.get("uddg", [url])[0])

                    snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""

                    entries.append(SearchEntry(
                        title=title,
                        url=url,
                        snippet=snippet,
                        source="duckduckgo",
                    ))
            except Exception as e:
                logger.debug(f"解析 DuckDuckGo 结果时出错: {e}")
                continue

        logger.info(f"DuckDuckGo 搜索 '{query}' 返回 {len(entries)} 条结果")
    except Exception as e:
        logger.error(f"DuckDuckGo 搜索失败: {e}")

    return entries


def _search_google(query: str, max_results: int) -> List[SearchEntry]:
    """
    Google Custom Search API 搜索。
    需要配置 SEARCH_API_KEY 和 GOOGLE_CSE_ID。
    """
    entries = []
    api_key = config.SEARCH_API_KEY
    cse_id = config.GOOGLE_CSE_ID

    if not api_key or not cse_id:
        logger.error("Google Custom Search 需要配置 SEARCH_API_KEY 和 GOOGLE_CSE_ID")
        return entries

    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": api_key,
            "cx": cse_id,
            "q": query,
            "num": min(max_results, 10),  # Google 单次最多返回10条
        }

        resp = _request_with_retry(url, params=params)
        if not resp:
            return entries

        data = resp.json()
        items = data.get("items", [])

        for item in items:
            entries.append(SearchEntry(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source="google",
                published_date=item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time"),
            ))

        logger.info(f"Google 搜索 '{query}' 返回 {len(entries)} 条结果")
    except Exception as e:
        logger.error(f"Google 搜索失败: {e}")

    return entries


def _search_bing(query: str, max_results: int) -> List[SearchEntry]:
    """
    Bing Search API 搜索。
    需要配置 SEARCH_API_KEY。
    """
    entries = []
    api_key = config.SEARCH_API_KEY

    if not api_key:
        logger.error("Bing Search 需要配置 SEARCH_API_KEY")
        return entries

    try:
        headers = {
            "Ocp-Apim-Subscription-Key": api_key,
        }
        params = {
            "q": query,
            "count": min(max_results, 50),
            "mkt": "zh-CN",
        }

        resp = _request_with_retry(config.BING_ENDPOINT, headers=headers, params=params)
        if not resp:
            return entries

        data = resp.json()
        items = data.get("webPages", {}).get("value", [])

        for item in items:
            entries.append(SearchEntry(
                title=item.get("name", ""),
                url=item.get("url", ""),
                snippet=item.get("snippet", ""),
                source="bing",
                published_date=item.get("dateLastCrawled"),
            ))

        logger.info(f"Bing 搜索 '{query}' 返回 {len(entries)} 条结果")
    except Exception as e:
        logger.error(f"Bing 搜索失败: {e}")

    return entries


def _search_serpapi(query: str, max_results: int) -> List[SearchEntry]:
    """
    SerpAPI 搜索。
    需要配置 SEARCH_API_KEY。支持 Google 搜索结果。
    """
    entries = []
    api_key = config.SEARCH_API_KEY

    if not api_key:
        logger.error("SerpAPI 需要配置 SEARCH_API_KEY")
        return entries

    try:
        url = "https://serpapi.com/search.json"
        params = {
            "q": query,
            "api_key": api_key,
            "engine": "google",
            "num": min(max_results, 100),
            "hl": "zh-cn",
        }

        resp = _request_with_retry(url, params=params)
        if not resp:
            return entries

        data = resp.json()
        items = data.get("organic_results", [])

        for item in items[:max_results]:
            entries.append(SearchEntry(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source="serpapi",
                published_date=item.get("date"),
            ))

        logger.info(f"SerpAPI 搜索 '{query}' 返回 {len(entries)} 条结果")
    except Exception as e:
        logger.error(f"SerpAPI 搜索失败: {e}")

    return entries


# =============================================================================
# 搜索主入口
# =============================================================================

def search_competitor(name: str, keywords: List[str], days: int = 7) -> List[SearchEntry]:
    """
    搜索竞品动态，根据配置选择搜索引擎后端。

    Args:
        name: 竞品名称
        keywords: 搜索关键词列表
        days: 搜索最近 N 天的内容

    Returns:
        搜索结果列表（已去重）
    """
    all_entries: List[SearchEntry] = []
    seen_urls = set()

    # 选择搜索引擎后端
    search_fn = {
        "google": _search_google,
        "bing": _search_bing,
        "serpapi": _search_serpapi,
        "duckduckgo": _search_duckduckgo,
    }.get(config.SEARCH_ENGINE, _search_duckduckgo)

    logger.info(f"开始搜索竞品 [{name}]，搜索引擎: {config.SEARCH_ENGINE}，时间范围: {days}天")

    for keyword in keywords:
        # 添加时间限定后缀（对支持的搜索引擎有效）
        time_suffix = ""
        if days <= 1:
            time_suffix = " 今天"
        elif days <= 7:
            time_suffix = " 本周"
        elif days <= 30:
            time_suffix = " 本月"

        query = f"{keyword}{time_suffix}"
        entries = search_fn(query, config.MAX_SEARCH_RESULTS)

        for entry in entries:
            if entry.url not in seen_urls:
                seen_urls.add(entry.url)
                all_entries.append(entry)

        # 请求间隔，避免频率限制
        time.sleep(config.REQUEST_DELAY)

    logger.info(f"竞品 [{name}] 搜索完成，共获取 {len(all_entries)} 条不重复结果")
    return all_entries


# =============================================================================
# 网页抓取
# =============================================================================

def fetch_page(url: str) -> Optional[str]:
    """
    抓取网页正文内容。

    Args:
        url: 网页 URL

    Returns:
        页面正文文本，失败时返回 None
    """
    logger.debug(f"抓取网页: {url}")
    resp = _request_with_retry(url)
    if not resp:
        return None

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        # 移除 script 和 style 元素
        for elem in soup(["script", "style", "nav", "footer", "header"]):
            elem.decompose()

        # 尝试提取主要内容区域
        main_content = (
            soup.find("main") or
            soup.find("article") or
            soup.find("div", class_="content") or
            soup.find("div", class_="post-content") or
            soup.find("div", id="content") or
            soup.body
        )

        if main_content:
            text = main_content.get_text(separator="\n", strip=True)
        else:
            text = soup.get_text(separator="\n", strip=True)

        # 清理多余空行
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        text = "\n".join(lines)

        # 限制长度（避免过长内容影响 LLM 处理）
        if len(text) > 8000:
            text = text[:8000] + "\n...(内容已截断)"

        logger.debug(f"成功抓取网页，内容长度: {len(text)} 字符")
        return text
    except Exception as e:
        logger.error(f"解析网页失败: {url} - {e}")
        return None


def fetch_blog(url: str) -> List[SearchEntry]:
    """
    抓取博客/changelog 页面，提取文章列表。

    Args:
        url: 博客页面 URL

    Returns:
        文章条目列表
    """
    logger.info(f"抓取博客页面: {url}")
    entries = []

    resp = _request_with_retry(url)
    if not resp:
        return entries

    try:
        soup = BeautifulSoup(resp.text, "html.parser")

        # 查找文章链接（常见的博客结构）
        article_selectors = [
            "article a[href]",
            ".post-title a",
            ".blog-post a",
            ".entry-title a",
            "h2 a",
            "h3 a",
        ]

        seen_urls = set()
        for selector in article_selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get("href", "")
                if not href or href in seen_urls:
                    continue

                # 转为绝对 URL
                full_url = urljoin(url, href)
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)

                title = link.get_text(strip=True)
                if title and len(title) > 5:  # 过滤太短的标题
                    entries.append(SearchEntry(
                        title=title,
                        url=full_url,
                        snippet="",
                        source="blog",
                    ))

            if entries:  # 如果已找到文章，不再尝试其他选择器
                break

        logger.info(f"博客页面抓取完成，发现 {len(entries)} 篇文章")
    except Exception as e:
        logger.error(f"博客抓取失败: {url} - {e}")

    return entries


def enrich_entries_with_content(entries: List[SearchEntry], max_pages: int = 15) -> List[SearchEntry]:
    """
    为搜索结果补充页面内容（抓取前 N 个页面的正文）。

    Args:
        entries: 搜索结果列表
        max_pages: 最多抓取页面数量

    Returns:
        补充了内容的搜索结果列表
    """
    enriched = []
    fetched_count = 0

    for entry in entries:
        if fetched_count < max_pages and not entry.content:
            content = fetch_page(entry.url)
            if content:
                entry.content = content
                fetched_count += 1
            time.sleep(config.REQUEST_DELAY)
        enriched.append(entry)

    return enriched
