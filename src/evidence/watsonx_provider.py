"""IBM watsonx provider via OpenAI-compatible gateway, with OpenAI fallback.

Uses Railtracks OpenAICompatibleProvider pattern against the watsonx model gateway.
Never logs API keys. Validates env vars on init.
"""
import json
import logging
import os
from typing import Any, Dict, Optional

import requests

from . import config

logger = logging.getLogger(__name__)


class WatsonxProvider:
    """Calls IBM watsonx model gateway using OpenAI-compatible chat/completions API."""

    def __init__(self):
        if not config.IBM_CLOUD_APIKEY:
            raise RuntimeError("IBM_CLOUD_APIKEY not set")
        if not config.WATSONX_GATEWAY_URL:
            raise RuntimeError("WATSONX_GATEWAY_URL not set")
        self.api_key = config.IBM_CLOUD_APIKEY
        self.base_url = config.WATSONX_GATEWAY_URL.rstrip("/")
        self.model = config.WATSONX_MODEL_NAME
        logger.info(f"WatsonxProvider initialized: gateway={self.base_url}, model={self.model}")

    def chat(self, messages: list, temperature: float = 0.1, max_tokens: int = 2000) -> str:
        """Send a chat completion request to the watsonx gateway."""
        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            # Redact API key from error messages
            err_str = str(e)
            if self.api_key and len(self.api_key) > 8:
                err_str = err_str.replace(self.api_key, "[REDACTED]")
            logger.error(f"watsonx chat error: {err_str}")
            raise RuntimeError(f"watsonx call failed: {err_str}")


class OpenAIFallbackProvider:
    """Fallback using OpenAI API directly."""

    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        self.api_key = config.OPENAI_API_KEY
        self.model = "gpt-4o-mini"
        logger.info("OpenAIFallbackProvider initialized")

    def chat(self, messages: list, temperature: float = 0.1, max_tokens: int = 2000) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            err_str = str(e)
            if self.api_key and len(self.api_key) > 8:
                err_str = err_str.replace(self.api_key, "[REDACTED]")
            logger.error(f"OpenAI chat error: {err_str}")
            raise RuntimeError(f"OpenAI call failed: {err_str}")


_provider_instance = None


def get_llm_provider():
    """Return the best available LLM provider (watsonx preferred, OpenAI fallback)."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    # Try watsonx first
    if config.IBM_CLOUD_APIKEY and config.WATSONX_GATEWAY_URL:
        try:
            _provider_instance = WatsonxProvider()
            return _provider_instance
        except Exception as e:
            logger.warning(f"watsonx init failed, trying OpenAI: {e}")

    # Fallback to OpenAI
    if config.OPENAI_API_KEY:
        _provider_instance = OpenAIFallbackProvider()
        return _provider_instance

    raise RuntimeError("No LLM provider available. Set IBM_CLOUD_APIKEY+WATSONX_GATEWAY_URL or OPENAI_API_KEY.")
