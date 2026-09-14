export function agentInterfaceManifest({ version, standalone = false } = {}) {
  return {
    product: 'HexiGrid',
    schemaVersion: '1.0',
    appVersion: version || '0.0.1',
    interface: 'agent-control-surface',
    presentation: { human: '/', agent: '/agent-interface.html', machine: '/api/agent-interface' },
    security: {
      authenticationRequired: true,
      csrfRequiredForBrowserMutations: true,
      secretsAcceptedInChat: false,
      permissionBypassAvailable: false,
      rule: 'Every action uses the same work-mode, approval, connector, plugin, and device policy checks as the human interface.'
    },
    operatingRules: [
      'Read the current snapshot before proposing or taking an action.',
      'Never request, display, log, or place a password, API key, token, cookie, recovery phrase, or private credential in a prompt.',
      'Tell the human to enter credentials only in the visible AI connections or credential dialog.',
      'Do not claim success until the action response succeeds and the resulting Activity receipt is present.',
      'Do not change work mode or approval profile merely to bypass a denied action.',
      'Stop for human input at sign-in, consent, payment, identity selection, new permissions, or an approval prompt.'
    ],
    resources: {
      snapshot: { method: 'GET', path: '/api/bootstrap', description: 'Current safe dashboard state; credential values are excluded.' },
      agents: { method: 'GET', path: '/api/agents', description: 'Agent profiles visible to this workspace.' },
      models: { method: 'GET', path: '/api/models', description: 'Connected and currently discovered model routes.' },
      sessions: { method: 'GET', path: '/api/auth/sessions', description: 'Owner-visible local sessions.' }
    },
    actions: {
      updateSettings: { method: 'PATCH', path: '/api/settings', contentType: 'application/json', fields: ['workMode', 'approvalPolicy', 'model', 'activeGoal', 'subagents', 'communicationGuide'] },
      createAgent: { method: 'POST', path: '/api/agents', contentType: 'application/json', required: ['name'], optional: ['accountLabel', 'personality', 'instructions', 'rules', 'model', 'tags'] },
      updateAgent: { method: 'PATCH', path: '/api/agents/{agentId}', contentType: 'application/json' },
      createRoom: { method: 'POST', path: '/api/rooms', contentType: 'application/json', required: ['name'] },
      updateRoom: { method: 'PATCH', path: '/api/rooms/{roomId}', contentType: 'application/json', optional: ['name', 'description', 'agentIds'] },
      sendRoomMessage: { method: 'POST', path: '/api/rooms/{roomId}/messages', contentType: 'application/json', required: ['content'], optional: ['agentIds'] },
      testProvider: { method: 'POST', path: '/api/providers/{providerId}/test', contentType: 'application/json', note: 'Credential creation remains a human credential-entry action.' },
      emergencyStop: { method: 'POST', path: '/api/emergency/stop', contentType: 'application/json', body: {} }
    },
    platform: { standaloneBrowser: Boolean(standalone), unavailableActionsMustReturn: { status: 409, field: 'platformUnavailable' } }
  };
}
