"""
LLM Client Factory - Provides configured ChatGroq instance for workflows.
"""

import os
from langchain_groq import ChatGroq


def get_groq_client(model_name: str = "llama-3.3-70b-versatile", temperature: float = 0.7) -> ChatGroq:
    """
    Returns a configured ChatGroq client using environment settings or defaults.
    """
    api_key = os.getenv("GROQ_API_KEY")
    return ChatGroq(
        model_name=model_name,
        temperature=temperature,
        groq_api_key=api_key
    )
