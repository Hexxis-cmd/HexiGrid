(() => {
  const DIRECT_ERROR = 'DIRECT_BROWSER_UNAVAILABLE';

  function cleanUrl(value) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch { throw new Error('Enter the complete provider API address.'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && location.protocol === 'http:')) throw new Error('Direct browser connections require HTTPS. Local HTTP works only from a local HTTP page.');
    if (url.username || url.password || url.hash) throw new Error('Do not put credentials or a fragment in the provider address.');
    return url.href.replace(/\/$/, '');
  }

  function headers(provider, secret, json = false) {
    const values = { accept: 'application/json' };
    if (json) values['content-type'] = 'application/json';
    if (provider.apiStyle === 'anthropic') {
      if (secret) values['x-api-key'] = secret;
      values['anthropic-version'] = '2023-06-01';
      values['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (provider.apiStyle === 'google-gemini') {
      if (secret) values['x-goog-api-key'] = secret;
    } else if (secret) values.authorization = `Bearer ${secret}`;
    return values;
  }

  async function requestJson(url, options, signalTimeout = 30000) {
    let response;
    try {
      response = await fetch(url, { ...options, mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(signalTimeout) });
    } catch (error) {
      const failure = new Error(navigator.onLine === false
        ? 'This device is offline. Reconnect and try again.'
        : 'This provider did not allow the browser to connect directly, or its address could not be reached. Check the address first; if it is correct, use a provider-supported browser key, a user-owned relay, or a paired HexiGrid host.');
      failure.code = DIRECT_ERROR;
      failure.cause = error;
      throw failure;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403 ? 'The provider rejected this key or its permissions.' : `The provider returned HTTP ${response.status}. Check that provider's status page and API address, then try again.`);
    }
    return body;
  }

  function modelRecords(provider, body) {
    const items = provider.apiStyle === 'google-gemini' ? body.models : body.data;
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const id = String(item?.id || item?.name || '').replace(/^models\//, '').trim();
      if (!id || /\s/.test(id) || id.length > 240) return null;
      return { id, label: String(item?.displayName || item?.name || item?.id || id).replace(/^models\//, '').slice(0, 240), pricing: item?.pricing || item?.cost || null };
    }).filter(Boolean).slice(0, 300);
  }

  async function discover(provider, secret) {
    const normalized = { ...provider, baseUrl: cleanUrl(provider.baseUrl) };
    const body = await requestJson(`${normalized.baseUrl}/models`, { headers: headers(normalized, secret) });
    const models = modelRecords(normalized, body);
    if (!models.length) throw new Error('The provider connected but did not return usable model IDs. Open Connection details and enter an exact model ID only if the provider documents it.');
    return { models, message: `Direct browser connection succeeded and reported ${models.length} model${models.length === 1 ? '' : 's'}.` };
  }

  function completionRequest(provider, secret, model, messages) {
    const baseUrl = cleanUrl(provider.baseUrl);
    const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
    const conversation = messages.filter((item) => item.role !== 'system');
    if (provider.apiStyle === 'anthropic') return { url: `${baseUrl}/messages`, body: { model, max_tokens: 4096, system, messages: conversation } };
    if (provider.apiStyle === 'google-gemini') return { url: `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, body: { systemInstruction: system ? { parts: [{ text: system }] } : undefined, contents: conversation.map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })), generationConfig: { maxOutputTokens: 4096 } } };
    if (provider.apiStyle === 'openai-responses') return { url: `${baseUrl}/responses`, body: { model, instructions: system || undefined, input: conversation } };
    return { url: `${baseUrl}/chat/completions`, body: { model, messages, stream: false } };
  }

  function parseCompletion(provider, body) {
    if (provider.apiStyle === 'anthropic') return { content: (body.content || []).filter((item) => item?.type === 'text').map((item) => item.text).join('\n'), inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens };
    if (provider.apiStyle === 'google-gemini') return { content: (body.candidates?.[0]?.content?.parts || []).map((item) => item?.text || '').join('\n'), inputTokens: body.usageMetadata?.promptTokenCount, outputTokens: body.usageMetadata?.candidatesTokenCount };
    if (provider.apiStyle === 'openai-responses') return { content: body.output_text || (body.output || []).flatMap((item) => item?.content || []).filter((item) => item?.type === 'output_text').map((item) => item.text).join('\n'), inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens };
    return { content: body.choices?.[0]?.message?.content, inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
  }

  async function complete(provider, secret, model, messages) {
    const request = completionRequest(provider, secret, model, messages);
    const body = await requestJson(request.url, { method: 'POST', headers: headers(provider, secret, true), body: JSON.stringify(request.body) }, 120000);
    const result = parseCompletion(provider, body);
    if (typeof result.content !== 'string' || !result.content.trim()) throw new Error('The provider returned no text. Choose a chat-capable model.');
    return result;
  }

  window.HexiGridBrowserProviders = Object.freeze({ DIRECT_ERROR, cleanUrl, discover, complete });
})();
