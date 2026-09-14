import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadGuides() {
  const source = await readFile(new URL('../public/guide-content.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'guide-content.js' });
  return context.window.HEXIGRID_GUIDES;
}

test('plain-language guide covers every built-in connection path and recovery area', async () => {
  const guides = await loadGuides();
  for (const key of ['start','connections','openai','anthropic','gemini','huggingface','onDevice','ollama','lmstudio','compatibleApi','compatibleLocal','openCodeZen','cli','opencode','claudeCode','codex','ilands','personality','rooms','permissions','tasks','tools','backup','mobile','troubleshoot','selfIntegrate']) {
    assert.ok(guides[key], `missing guide: ${key}`);
    assert.ok(guides[key].steps.length >= 4, `guide needs complete steps: ${key}`);
    assert.ok(guides[key].troubleshooting.length >= 1, `guide needs failure help: ${key}`);
  }
});

test('every model connection has the same five-part zero-knowledge guide and current source links where applicable', async () => {
  const guides = await loadGuides();
  for (const key of ['openai','anthropic','gemini','huggingface','onDevice','ollama','lmstudio','compatibleApi','compatibleLocal','openCodeZen','cli','opencode','claudeCode','codex']) {
    const guide = guides[key];
    assert.ok(guide.basics?.what, `${key} must explain what it is`);
    assert.ok(guide.basics?.need, `${key} must explain prerequisites`);
    assert.ok(guide.basics?.cost, `${key} must explain costs and limits`);
    assert.ok(guide.steps.length >= 4, `${key} must explain HexiGrid setup`);
  }
  for (const key of ['openai','anthropic','gemini','huggingface','onDevice','ollama','lmstudio','compatibleApi','openCodeZen','opencode','claudeCode','codex']) {
    assert.ok(guides[key].officialLinks?.length, `${key} needs official current documentation`);
  }
  assert.match(guides.start.lead, /bridge/i);
});

test('AI self-integration prompt protects secrets and requires real verification', async () => {
  const prompt = (await loadGuides()).selfIntegrate.prompt;
  assert.match(prompt, /Never ask the user to paste a password, API key/i);
  assert.match(prompt, /HexiGrid > AI connections/i);
  assert.match(prompt, /Do not claim completion before verification/i);
  assert.match(prompt, /connect only when HexiGrid reports it installed and already authenticated/i);
  assert.match(prompt, /\/api\/agent-interface/);
  assert.match(prompt, /attempt direct browser HTTPS access first/i);
});
