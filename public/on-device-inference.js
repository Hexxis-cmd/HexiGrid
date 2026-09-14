(() => {
  const state = {
    module: null,
    engine: null,
    worker: null,
    modelId: '',
    loading: null,
    progress: null
  };

  function runtimeError(message, cause) {
    const error = new Error(message);
    if (cause) error.cause = cause;
    return error;
  }

  async function loadModule() {
    if (!state.module) state.module = import('/vendor/web-llm.js').catch((error) => {
      state.module = null;
      throw runtimeError('The on-device model engine could not load. Refresh HexiGrid and try again.', error);
    });
    return state.module;
  }

  async function getAdapter() {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) return null;
    if (!('gpu' in navigator) || typeof navigator.gpu?.requestAdapter !== 'function') return null;
    try { return await navigator.gpu.requestAdapter(); } catch { return null; }
  }

  async function capabilities() {
    const adapter = await getAdapter();
    return {
      supported: Boolean(adapter),
      webgpu: Boolean(adapter),
      secureContext: Boolean(window.isSecureContext || ['localhost', '127.0.0.1'].includes(location.hostname)),
      browser: navigator.userAgentData?.brands?.map((item) => item.brand).join(', ') || navigator.userAgent,
      reason: adapter ? '' : 'This browser does not expose a usable WebGPU adapter. Use a recent browser with hardware acceleration, or connect a cloud/local model instead.'
    };
  }

  function modelRecord(record) {
    const vram = Number(record.vram_required_MB);
    return {
      id: String(record.model_id),
      label: String(record.model_id).replace(/-MLC$/, '').replace(/-Instruct/, ' Instruct').replace(/-/g, ' '),
      vramRequiredMB: Number.isFinite(vram) && vram > 0 ? Math.round(vram * 100) / 100 : null,
      lowResource: record.low_resource_required === true,
      runtime: 'WebLLM',
      free: true,
      local: true,
      browser: true
    };
  }

  async function supportedModels() {
    const capabilitiesResult = await capabilities();
    if (!capabilitiesResult.supported) return { ...capabilitiesResult, models: [] };
    const webllm = await loadModule();
    return { ...capabilitiesResult, models: (webllm.prebuiltAppConfig?.model_list || []).map(modelRecord) };
  }

  function progressValue(value) {
    const text = String(value?.text || value?.stage || '').trim();
    const fraction = Number(value?.progress);
    return { text: text.slice(0, 240), progress: Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : null };
  }

  async function ensureEngine(modelId, onProgress) {
    if (!modelId) throw runtimeError('Choose an on-device model first.');
    const catalog = await supportedModels();
    if (!catalog.supported) throw runtimeError(catalog.reason);
    if (!catalog.models.some((item) => item.id === modelId)) throw runtimeError('That on-device model is not supported by this HexiGrid runtime. Refresh the model list.');
    if (state.engine && state.modelId === modelId) return state.engine;
    if (state.loading) await state.loading;
    if (state.engine && state.modelId === modelId) return state.engine;
    if (state.engine && state.modelId !== modelId) await unload();
    const webllm = await loadModule();
    state.worker = new Worker('/on-device-worker.js', { type: 'module', name: 'hexigrid-on-device-model' });
    state.progress = onProgress || null;
    state.loading = webllm.CreateWebWorkerMLCEngine(state.worker, modelId, {
      appConfig: webllm.prebuiltAppConfig,
      initProgressCallback: (value) => {
        const next = progressValue(value);
        state.progress?.(next);
        window.dispatchEvent(new CustomEvent('hexigrid:on-device-progress', { detail: next }));
      }
    }).then((engine) => {
      state.engine = engine;
      state.modelId = modelId;
      return engine;
    }).catch((error) => {
      state.worker?.terminate();
      state.worker = null;
      state.engine = null;
      state.modelId = '';
      throw runtimeError(error?.message || 'The browser could not load this model. Try a smaller model or another connection.', error);
    }).finally(() => { state.loading = null; state.progress = null; });
    return state.loading;
  }

  async function complete({ modelId, messages, signal, onProgress }) {
    if (!Array.isArray(messages) || !messages.length) throw runtimeError('The on-device request did not contain a conversation.');
    const engine = await ensureEngine(modelId, onProgress);
    const abort = () => { try { engine.interruptGenerate(); } catch {} };
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const stream = await engine.chat.completions.create({ messages, temperature: 0.7, max_tokens: 512, stream: true, stream_options: { include_usage: true } });
      let content = '';
      let usage = null;
      for await (const chunk of stream) {
        if (signal?.aborted) abort();
        content += chunk?.choices?.[0]?.delta?.content || '';
        if (chunk?.usage) usage = chunk.usage;
        onProgress?.({ text: content.slice(-240), progress: null, generating: true });
      }
      if (signal?.aborted) throw runtimeError('On-device generation was stopped.');
      if (!content.trim()) throw runtimeError('The on-device model returned no text. Try a smaller model or another connection.');
      return { content: content.trim().slice(0, 20000), inputTokens: Number.isSafeInteger(usage?.prompt_tokens) ? usage.prompt_tokens : null, outputTokens: Number.isSafeInteger(usage?.completion_tokens) ? usage.completion_tokens : null, modelId };
    } catch (error) {
      if (signal?.aborted) throw runtimeError('On-device generation was stopped.');
      throw runtimeError(error?.message || 'On-device generation failed. Try a smaller model or another connection.', error);
    } finally { signal?.removeEventListener('abort', abort); }
  }

  async function unload() {
    try { await state.engine?.unload?.(); } catch {}
    state.worker?.terminate();
    state.worker = null;
    state.engine = null;
    state.modelId = '';
    state.loading = null;
  }

  async function clearCache(modelId) {
    const webllm = await loadModule();
    if (!modelId || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,180}$/.test(modelId)) throw runtimeError('The browser model identifier is invalid.');
    if (state.modelId === modelId) await unload();
    await webllm.deleteModelAllInfoInCache(modelId, webllm.prebuiltAppConfig);
  }

  window.HexiGridOnDevice = Object.freeze({ capabilities, supportedModels, complete, unload, clearCache, activeModel: () => state.modelId });
})();
