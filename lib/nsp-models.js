(function (root) {
  var MODELS = [
    { id: 'auto', provider: 'auto', model: '', label: 'Auto', note: 'Picks whatever is configured and answering' },
    { id: 'openai:gpt-4o-mini', provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'OpenAI, fastest of the paid ones' },
    { id: 'openai:gpt-4o', provider: 'openai', model: 'gpt-4o', label: 'GPT-4o', note: 'OpenAI, best answers, reads images' },
    { id: 'openai:gpt-4.1-mini', provider: 'openai', model: 'gpt-4.1-mini', label: 'GPT-4.1 mini', note: 'OpenAI, cheap and quick' },
    { id: 'groq:llama-3.3-70b-versatile', provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Groq, best answers' },
    { id: 'groq:llama-3.1-8b-instant', provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', note: 'Groq, fastest' },
    { id: 'gemini:gemini-2.5-flash', provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Google' },
    { id: 'gemini:gemini-2.0-flash', provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', note: 'Google, reads images' },
    { id: 'ollama:local', provider: 'ollama', model: '', label: 'Local model', note: 'Ollama on your machine' }
  ];

  function byId(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i];
    return MODELS[0];
  }

  function byProvider(provider) {
    var out = [];
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].provider === provider) out.push(MODELS[i]);
    return out;
  }

  root.NSP_MODELS = { list: MODELS, byId: byId, byProvider: byProvider, storageKey: 'nsp_selected_model' };
})(typeof self !== 'undefined' ? self : this);
