"""
Multi-LLM provider with automatic fallback.

Priority order: Anthropic -> OpenAI -> Google Gemini.
Only providers with valid API keys are available.
No new pip dependencies required — handles ImportError gracefully.
"""
import os
from abc import ABC, abstractmethod
from typing import Generator


class LLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def generate(self, prompt: str, model: str | None = None, max_tokens: int = 1500) -> str:
        """Generate a completion from a single prompt string."""
        ...

    @abstractmethod
    def stream(self, messages: list[dict], model: str | None = None, max_tokens: int = 1500) -> Generator[str, None, None]:
        """Stream text chunks from a list of messages [{role, content}]."""
        ...


# ── Anthropic ─────────────────────────────────────────────────────────────────

class AnthropicProvider(LLMProvider):
    """Wraps the Anthropic Python SDK (anthropic package)."""

    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str | None = None):
        import anthropic  # will raise ImportError if not installed
        self._key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not self._key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        self._client = anthropic.Anthropic(api_key=self._key)

    @property
    def name(self) -> str:
        return "anthropic"

    def generate(self, prompt: str, model: str | None = None, max_tokens: int = 1500) -> str:
        message = self._client.messages.create(
            model=model or self.DEFAULT_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    def stream(self, messages: list[dict], model: str | None = None, max_tokens: int = 1500) -> Generator[str, None, None]:
        with self._client.messages.stream(
            model=model or self.DEFAULT_MODEL,
            max_tokens=max_tokens,
            messages=messages,
        ) as s:
            for text in s.text_stream:
                yield text


# ── OpenAI ────────────────────────────────────────────────────────────────────

class OpenAIProvider(LLMProvider):
    """Wraps the OpenAI Python SDK (openai package)."""

    DEFAULT_MODEL = "gpt-4o"

    def __init__(self, api_key: str | None = None):
        import openai  # will raise ImportError if not installed
        self._key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not self._key:
            raise ValueError("OPENAI_API_KEY not set")
        self._client = openai.OpenAI(api_key=self._key)

    @property
    def name(self) -> str:
        return "openai"

    def generate(self, prompt: str, model: str | None = None, max_tokens: int = 1500) -> str:
        response = self._client.chat.completions.create(
            model=model or self.DEFAULT_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def stream(self, messages: list[dict], model: str | None = None, max_tokens: int = 1500) -> Generator[str, None, None]:
        response = self._client.chat.completions.create(
            model=model or self.DEFAULT_MODEL,
            max_tokens=max_tokens,
            messages=messages,
            stream=True,
        )
        for chunk in response:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content


# ── Google Gemini ─────────────────────────────────────────────────────────────

class GeminiProvider(LLMProvider):
    """Wraps the Google Generative AI SDK (google-generativeai package)."""

    DEFAULT_MODEL = "gemini-1.5-pro"

    def __init__(self, api_key: str | None = None):
        import google.generativeai as genai  # will raise ImportError if not installed
        self._key = api_key or os.environ.get("GOOGLE_API_KEY", "")
        if not self._key:
            raise ValueError("GOOGLE_API_KEY not set")
        genai.configure(api_key=self._key)
        self._genai = genai

    @property
    def name(self) -> str:
        return "gemini"

    def generate(self, prompt: str, model: str | None = None, max_tokens: int = 1500) -> str:
        m = self._genai.GenerativeModel(model or self.DEFAULT_MODEL)
        response = m.generate_content(
            prompt,
            generation_config=self._genai.GenerationConfig(max_output_tokens=max_tokens),
        )
        return response.text

    def stream(self, messages: list[dict], model: str | None = None, max_tokens: int = 1500) -> Generator[str, None, None]:
        m = self._genai.GenerativeModel(model or self.DEFAULT_MODEL)
        # Convert messages to Gemini format (concatenate into a single prompt)
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
            else:
                prompt_parts.append(f"User: {content}")
        combined = "\n\n".join(prompt_parts)
        response = m.generate_content(
            combined,
            generation_config=self._genai.GenerationConfig(max_output_tokens=max_tokens),
            stream=True,
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text


# ── Factory & fallback helpers ────────────────────────────────────────────────

# Provider classes in priority order
_PROVIDER_CLASSES = [
    AnthropicProvider,
    OpenAIProvider,
    GeminiProvider,
]


def get_llm_provider() -> LLMProvider:
    """Return the first available LLM provider (Anthropic preferred).

    Raises RuntimeError if no provider can be initialized.
    """
    errors = []
    for cls in _PROVIDER_CLASSES:
        try:
            return cls()
        except (ImportError, ValueError) as e:
            errors.append(f"{cls.__name__}: {e}")
    raise RuntimeError(
        "No LLM provider available. Install at least one SDK and set its API key.\n"
        + "\n".join(f"  - {err}" for err in errors)
    )


def generate_with_fallback(prompt: str, model: str | None = None, max_tokens: int = 1500) -> str:
    """Try each available provider in order until one succeeds.

    Args:
        prompt: The prompt text.
        model: Optional model override (provider-specific). If None, each provider
               uses its default model.
        max_tokens: Maximum tokens to generate.

    Returns:
        Generated text from the first provider that succeeds.

    Raises:
        RuntimeError: If all providers fail.
    """
    errors = []
    for cls in _PROVIDER_CLASSES:
        try:
            provider = cls()
        except (ImportError, ValueError):
            continue
        try:
            return provider.generate(prompt, model=None, max_tokens=max_tokens)
        except Exception as e:
            errors.append(f"{provider.name}: {e}")
            print(f"[llm_provider] {provider.name} failed: {e}")
            continue

    raise RuntimeError(
        "All LLM providers failed:\n" + "\n".join(f"  - {err}" for err in errors)
    )
