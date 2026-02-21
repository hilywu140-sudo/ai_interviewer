from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Database
    database_url: str

    # LLM APIs
    openai_api_key: str
    anthropic_api_key: str
    deepseek_api_key: str
    deepseek_base_url: str = "https://api.deepseek.com"
    default_llm_provider: str = "deepseek"

    # Qwen (通义千问)
    qwen_api_key: Optional[str] = None
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_supervisor_model: str = "qwen3-8b"  # Supervisor 使用的千问模型

    # LangSmith (可选)
    langsmith_api_key: Optional[str] = None
    langsmith_project: str = "ai-interview-coach"
    langsmith_tracing: bool = True  # 是否启用追踪

    # Aliyun ASR
    aliyun_access_key_id: str
    aliyun_access_key_secret: str
    aliyun_oss_bucket: str
    aliyun_oss_endpoint: str

    # DashScope (百炼平台 - 通义千问ASR)
    dashscope_api_key: str
    dashscope_asr_model: str = "qwen3-asr-flash-realtime"
    dashscope_asr_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"

    # Audio Storage
    audio_storage_path: str = "./audio_files"  # 本地音频存储路径

    # Application
    app_env: str = "development"
    secret_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # JWT 认证
    jwt_secret_key: Optional[str] = None  # 如果不设置，使用 secret_key
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # 阿里云邮件推送
    aliyun_dm_account_name: Optional[str] = None  # 发信地址
    aliyun_dm_from_alias: Optional[str] = None  # 发信人昵称

    # Supabase 认证
    supabase_url: Optional[str] = None
    supabase_jwt_secret: Optional[str] = None

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # 忽略 .env 中未定义的字段


settings = Settings()
