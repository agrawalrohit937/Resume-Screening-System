/**
 * CareerMitra chat API service
 * Handles durable server sessions, SSE typed streaming, feedback, and memory.
 */

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

function getAuthHeaders() {
  let token = localStorage.getItem('access_token');
  if (!token) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        token = value;
        break;
      }
    }
  }

  const tenantId = localStorage.getItem('tenant_id') || 'default';
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Streams chat responses from POST /api/v1/copilot/v2/chat
 * Decodes typed SSE events: session, status, tool_call, tool_result, ui_card, citation, token, suggestions, usage, navigate, done, error.
 */
export async function streamChatV2({
  message,
  sessionId = null,
  quickAction = null,
  forceRefresh = false,
  onEvent,
  signal = null,
}) {
  const headers = getAuthHeaders();
  const response = await fetch(`${BASE}/copilot/v2/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      session_id: sessionId,
      quick_action: quickAction,
      force_refresh: forceRefresh,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    let friendlyMessage = 'Failed to connect to CareerMitra.';
    try {
      const errJson = JSON.parse(errText);
      if (errJson.detail) {
        friendlyMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      if (errText) friendlyMessage = errText;
    }
    throw new Error(friendlyMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) {
        // Comment or ping heartbeat
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const eventData = JSON.parse(jsonStr);
          if (onEvent) {
            onEvent(eventData);
          }
        } catch (e) {
          console.warn('Failed to parse Copilot SSE line:', jsonStr, e);
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    try {
      const eventData = JSON.parse(buffer.trim().slice(6));
      if (onEvent) onEvent(eventData);
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Create a new session
 */
export async function createSession(title = 'New Conversation') {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return await res.json();
}

/**
 * Submit feedback on an assistant message (1 = thumbs up, -1 = thumbs down)
 */
export async function submitMessageFeedback(messageId, rating, comment = null) {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/messages/${messageId}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating, comment }),
  });
  if (!res.ok) throw new Error('Failed to record feedback');
  return await res.json();
}
