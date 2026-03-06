from dataclasses import asdict, dataclass

from openai import APIConnectionError, APIError, APITimeoutError, AuthenticationError, OpenAI

from app.settings import Settings, get_settings


CONNECTIVITY_PROMPT = "What is 2 + 2? Reply with digits only."


class AIConfigurationError(RuntimeError):
    pass


class AIConnectivityError(RuntimeError):
    pass


@dataclass(frozen=True)
class AIConnectivityResult:
    model: str
    prompt: str
    response: str


def create_openai_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)


def run_connectivity_check(
    client: OpenAI,
    model: str,
    prompt: str = CONNECTIVITY_PROMPT,
) -> AIConnectivityResult:
    try:
        result = client.responses.create(model=model, input=prompt)
    except (APIConnectionError, APIError, APITimeoutError, AuthenticationError) as error:
        message = getattr(error, "message", str(error))
        raise AIConnectivityError(f"OpenAI connectivity check failed: {message}") from error

    response_text = result.output_text.strip()
    if not response_text:
        raise AIConnectivityError("OpenAI returned an empty response.")

    return AIConnectivityResult(model=model, prompt=prompt, response=response_text)


def check_openai_connectivity(settings: Settings | None = None) -> dict[str, str]:
    current_settings = settings or get_settings()

    if not current_settings.openai_api_key:
        raise AIConfigurationError(
            "OPENAI_API_KEY is not configured. Add it to the environment or project root .env file."
        )

    client = create_openai_client(current_settings.openai_api_key)
    return asdict(run_connectivity_check(client, current_settings.openai_model))
