(() => {
  function clean(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function browserAgentMessages({ agent, room, settings, memories = [] }) {
    const ownerMemories = memories
      .filter((memory) => memory.agentId === agent.id)
      .sort((left, right) => Number(right.importance || 0) - Number(left.importance || 0) || new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 60);
    const examples = settings?.communicationGuide?.examples?.filter((example) => example?.user && example?.agent).slice(0, 20) || [];
    const communication = settings?.communicationGuide?.enabled !== false ? [
      'Communication style:',
      clean(settings?.communicationGuide?.instructions, 'Use natural, clear language. Match the owner’s level of detail and do not repeat yourself.'),
      examples.length ? `Examples of the desired feel (do not copy them as scripts):\n${examples.map((example) => `Owner: ${clean(example.user)}\nAgent: ${clean(example.agent)}`).join('\n\n')}` : ''
    ].filter(Boolean).join('\n') : '';
    const system = [
      `You are ${clean(agent.name, 'an agent')}, a local agent profile in HexiGrid.`,
      agent.personality ? `Personality:\n${agent.personality}` : 'Personality: not configured yet.',
      agent.instructions ? `Standing instructions:\n${agent.instructions}` : 'Standing instructions: be helpful, concise, and honest about uncertainty.',
      agent.rules ? `Rules and boundaries:\n${agent.rules}` : 'Rules: do not claim to have used tools or changed external systems unless HexiGrid confirms it.',
      ownerMemories.length ? `Owner-managed memory:\n${ownerMemories.map((memory) => `- [${clean(memory.category, 'general')}] ${clean(memory.content)}`).join('\n')}` : 'Owner-managed memory: none yet.',
      communication,
      `Current work mode: ${clean(settings?.workMode, 'converse')}.`,
      settings?.activeGoal?.title ? `Current shared goal: ${settings.activeGoal.title}` : 'There is no active shared goal.',
      agent.transport === 'ilands-runner'
        ? 'This profile has an iLands Runner identity, but this HexiGrid conversation stays local and is not delivered to iLands. Never claim that it reached iLands.'
        : 'This is a local model conversation. Never claim to have used an external tool unless a verified receipt is present.',
      'Other named agents in the transcript are real participants. Respond to their ideas directly and avoid needless repetition.',
      'Reply as this agent only.'
    ].filter(Boolean).join('\n\n');
    const history = (room.messages || []).slice(-18).map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.role === 'user' ? message.content : `${clean(message.author, 'Agent')}: ${message.content}`
    }));
    return [{ role: 'system', content: system }, ...history];
  }

  async function completeTurn({ agent, room, settings, memories, modelId, signal, onProgress }) {
    if (!window.HexiGridOnDevice?.complete) throw new Error('The browser model engine is unavailable. Refresh the page or choose another connection.');
    return window.HexiGridOnDevice.complete({
      modelId,
      messages: browserAgentMessages({ agent, room, settings, memories }),
      signal,
      onProgress
    });
  }

  window.HexiGridBrowserChat = Object.freeze({ browserAgentMessages, completeTurn });
})();
