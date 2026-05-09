try:
    from google import genai
except ImportError:
    genai = None


def create_genai_client(api_key: str):
    if genai is None:
        raise RuntimeError("google-genai is not installed.")

    return genai.Client(
        api_key=api_key,
        http_options={
            "client_args": {"trust_env": False},
            "async_client_args": {"trust_env": False},
        },
    )
