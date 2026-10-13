from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    azure_sql_connection_string: str | None = Field(
        default=None,
        validation_alias="AZURE_SQL_CONNECTION_STRING",
    )
    azure_sql_server: str | None = Field(
        default=None,
        validation_alias="AZURE_SQL_SERVER",
    )
    azure_sql_database: str | None = Field(
        default=None,
        validation_alias="AZURE_SQL_DATABASE",
    )
    azure_sql_username: str | None = Field(
        default=None,
        validation_alias="AZURE_SQL_USERNAME",
    )
    azure_sql_password: str | None = Field(
        default=None,
        validation_alias="AZURE_SQL_PASSWORD",
    )
    azure_sql_driver: str = Field(
        default="ODBC Driver 18 for SQL Server",
        validation_alias="AZURE_SQL_DRIVER",
    )
    azure_sql_trust_server_certificate: str = Field(
        default="no",
        validation_alias="AZURE_SQL_TRUST_SERVER_CERTIFICATE",
    )

    api_host: str = Field(default="127.0.0.1", validation_alias="API_HOST")
    api_port: int = Field(default=8000, validation_alias="API_PORT")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="CORS_ORIGINS",
    )
    azure_sql_max_rows: int = Field(default=0, validation_alias="AZURE_SQL_MAX_ROWS")

    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip() != ""
        ]

    def build_connection_string(self) -> str:
        if (
            self.azure_sql_connection_string is not None
            and self.azure_sql_connection_string.strip() != ""
        ):
            return self.azure_sql_connection_string.strip()

        missing = [
            name
            for name, value in [
                ("AZURE_SQL_SERVER", self.azure_sql_server),
                ("AZURE_SQL_DATABASE", self.azure_sql_database),
                ("AZURE_SQL_USERNAME", self.azure_sql_username),
                ("AZURE_SQL_PASSWORD", self.azure_sql_password),
            ]
            if value is None or str(value).strip() == ""
        ]

        if missing:
            raise ValueError(
                "Azure SQL is not configured. Set AZURE_SQL_CONNECTION_STRING "
                f"or provide: {', '.join(missing)}.",
            )

        server = self.azure_sql_server.strip()
        if not server.startswith("tcp:"):
            server = f"tcp:{server},1433"

        trust = self.azure_sql_trust_server_certificate.strip().lower()
        trust_flag = "yes" if trust in {"1", "true", "yes"} else "no"

        return (
            f"DRIVER={{{self.azure_sql_driver}}};"
            f"SERVER={server};"
            f"DATABASE={self.azure_sql_database.strip()};"
            f"UID={self.azure_sql_username.strip()};"
            f"PWD={self.azure_sql_password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate={trust_flag};"
            f"Connection Timeout=30;"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
