"""
STAR框架分析Agent

分析用户的面试回答，使用STAR框架（Situation, Task, Action, Result）
进行评估，并提供改进建议和优化后的答案。
"""

import json
import logging
from typing import Dict, Any, Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


ANALYZER_PROMPT_TEMPLATE = """你是一位专业的面试教练，擅长使用STAR框架分析面试回答。

## 背景信息

候选人简历：
{resume_text}

目标职位要求：
{jd_text}

## 面试问题
{question}

## 候选人回答
{answer}

## 分析任务

请使用STAR框架分析这个回答，并提供详细反馈。

### STAR框架说明：
- **Situation（情境）**：描述了什么背景/场景？是否清晰具体？
- **Task（任务）**：明确了什么任务/目标？职责是否清楚？
- **Action（行动）**：采取了哪些具体行动？是否突出个人贡献？
- **Result（结果）**：取得了什么成果？是否有量化数据？

### 输出格式

请严格按照以下JSON格式输出（不要添加任何其他内容）：

```json
{{
  "star_analysis": {{
    "situation": {{
      "score": 0-10,
      "present": true/false,
      "feedback": "具体评价"
    }},
    "task": {{
      "score": 0-10,
      "present": true/false,
      "feedback": "具体评价"
    }},
    "action": {{
      "score": 0-10,
      "present": true/false,
      "feedback": "具体评价"
    }},
    "result": {{
      "score": 0-10,
      "present": true/false,
      "feedback": "具体评价"
    }}
  }},
  "overall_score": 0-100,
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议1", "改进建议2"],
  "suggested_answer": "基于STAR框架优化后的完整回答"
}}
```

注意：
1. 评分要客观公正，基于回答内容
2. 改进建议要具体可操作
3. 优化后的回答要保持候选人的真实经历，只优化表达方式和结构
4. 如果回答内容太短或无法分析，overall_score给较低分并在improvements中说明
"""


class AnalyzerAgent:
    """STAR框架分析Agent"""

    async def analyze(
        self,
        question: str,
        answer_transcript: str,
        resume_text: str = "",
        jd_text: str = ""
    ) -> Dict[str, Any]:
        """
        分析面试回答

        Args:
            question: 面试问题
            answer_transcript: 用户回答的转录文本
            resume_text: 简历文本（可选）
            jd_text: 职位描述（可选）

        Returns:
            包含STAR分析、评分、优缺点和改进建议的字典
        """
        # 截断文本避免token过多
        resume_text = llm_service.truncate_text(resume_text, 500) if resume_text else "未提供"
        jd_text = llm_service.truncate_text(jd_text, 500) if jd_text else "未提供"

        # 构建prompt
        prompt = ANALYZER_PROMPT_TEMPLATE.format(
            resume_text=resume_text,
            jd_text=jd_text,
            question=question,
            answer=answer_transcript
        )

        # 调用LLM
        messages = [{"role": "user", "content": prompt}]

        try:
            response = await llm_service.chat_completion(
                messages=messages,
                temperature=0.3,  # 降低温度以获得更稳定的输出
                max_tokens=2000
            )

            # 解析JSON响应
            result = self._parse_response(response)
            logger.info(f"STAR分析完成: overall_score={result.get('overall_score')}")
            return result

        except Exception as e:
            logger.error(f"STAR分析失败: {e}")
            return self._get_error_result(str(e))

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """解析LLM响应"""
        try:
            # 尝试提取JSON部分
            json_start = response.find("{")
            json_end = response.rfind("}") + 1

            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)

                # 验证必要字段
                if "star_analysis" in result and "overall_score" in result:
                    return self._normalize_result(result)

            # 如果解析失败，返回默认结构
            logger.warning(f"无法解析LLM响应为JSON: {response[:200]}...")
            return self._get_default_result(response)

        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析错误: {e}")
            return self._get_default_result(response)

    def _normalize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """标准化结果格式"""
        # 确保所有必要字段存在
        default_star = {
            "score": 0,
            "present": False,
            "feedback": ""
        }

        star_analysis = result.get("star_analysis", {})
        for key in ["situation", "task", "action", "result"]:
            if key not in star_analysis:
                star_analysis[key] = default_star.copy()
            else:
                # 确保每个STAR元素有所有字段
                for field, default in default_star.items():
                    if field not in star_analysis[key]:
                        star_analysis[key][field] = default

        return {
            "star_analysis": star_analysis,
            "overall_score": min(100, max(0, result.get("overall_score", 0))),
            "strengths": result.get("strengths", []),
            "improvements": result.get("improvements", []),
            "suggested_answer": result.get("suggested_answer", "")
        }

    def _get_default_result(self, raw_response: str) -> Dict[str, Any]:
        """获取默认结果（当解析失败时）"""
        return {
            "star_analysis": {
                "situation": {"score": 5, "present": True, "feedback": "需要进一步分析"},
                "task": {"score": 5, "present": True, "feedback": "需要进一步分析"},
                "action": {"score": 5, "present": True, "feedback": "需要进一步分析"},
                "result": {"score": 5, "present": True, "feedback": "需要进一步分析"}
            },
            "overall_score": 50,
            "strengths": ["回答完整"],
            "improvements": ["建议使用STAR框架重新组织回答"],
            "suggested_answer": "",
            "_raw_response": raw_response[:500]  # 保留原始响应用于调试
        }

    def _get_error_result(self, error: str) -> Dict[str, Any]:
        """获取错误结果"""
        return {
            "star_analysis": {
                "situation": {"score": 0, "present": False, "feedback": "分析失败"},
                "task": {"score": 0, "present": False, "feedback": "分析失败"},
                "action": {"score": 0, "present": False, "feedback": "分析失败"},
                "result": {"score": 0, "present": False, "feedback": "分析失败"}
            },
            "overall_score": 0,
            "strengths": [],
            "improvements": ["分析过程出错，请重试"],
            "suggested_answer": "",
            "_error": error
        }


# 全局实例
analyzer_agent = AnalyzerAgent()
