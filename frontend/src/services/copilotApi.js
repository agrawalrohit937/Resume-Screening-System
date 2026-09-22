/**
 * CareerShala Copilot v2 API Service
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
    let friendlyMessage = 'Failed to connect to AI Copilot.';
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
 * Fetch paginated list of user sessions
 */
export async function fetchSessions(cursor = null, limit = 20) {
  const headers = getAuthHeaders();
  let url = `${BASE}/copilot/sessions?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to load chat sessions');
  return await res.json();
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
 * Soft delete or remove a session
 */
export async function deleteSession(sessionId) {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/sessions/${sessionId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete session');
  return await res.json();
}

/**
 * Fetch full transcript messages for a session
 */
export async function fetchSessionMessages(sessionId, limit = 50) {
  if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
    return { messages: [] };
  }
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/sessions/${sessionId}/messages?limit=${limit}`, {
    headers,
  });
  if (!res.ok) throw new Error('Failed to load messages');
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

/**
 * Migrate legacy localStorage chat history into server sessions
 */
export async function migrateLocalStorage(messages) {
  if (!messages || !messages.length) return null;
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/migrate-local`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch durable user memory
 */
export async function fetchMemory() {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/memory`, { headers });
  if (!res.ok) return { memories: [] };
  return await res.json();
}

/**
 * Delete a specific learned memory
 */
export async function deleteMemory(key) {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE}/copilot/memory?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete memory');
  return await res.json();
}
