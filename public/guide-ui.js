/* Guide cards, detailed help drawer, troubleshooting, and setup prompt. */
function renderGuide() {
  const agents = state.data.agents;
  const checks = [
    state.data.settings.owner?.displayName && state.data.settings.owner.displayName !== "Owner",
    availableModels().length > 0,
    agents.some((item) => item.personality || item.instructions),
    agents.some((item) => item.transport === "local-opencode" || item.ilandsAgentId),
    state.data.settings.setupAcknowledged
  ];
  const complete = checks.filter(Boolean).length;
  const percent = Math.round((complete / checks.length) * 100);
  $("#guideProgressRing").className = `progress-ring progress-${complete}`;
  $("#guideProgressRing").querySelector("strong").textContent = `${percent}%`;
  $("#guideProgressTitle").textContent = percent === 100 ? "Ready to explore" : complete < 2 ? "Getting started" : "Your control room is taking shape";
  $("#guideProgressText").textContent = percent === 100 ? "The basics are complete. Keep tuning profiles and permissions as your setup grows." : `${complete} of ${checks.length} basics complete. The next useful step is ${!checks[1] ? "checking your free models" : !checks[2] ? "shaping an agent personality" : "testing a connection"}.`;
  $("#guideGrid").innerHTML = Object.entries(guideTopics).map(([key, topic], index) => `<button class="guide-card" data-action="open-guide-topic" data-guide="${escapeHtml(key)}"><span class="guide-icon" data-icon="${escapeHtml(topic.icon || 'guide')}"></span><div><strong>${escapeHtml(topic.title)}</strong><p>${escapeHtml(topic.summary)}</p><small>${escapeHtml(topic.time || 'Step-by-step')}</small></div><span class="guide-number">${String(index + 1).padStart(2, '0')}</span></button>`).join('');
}

function openGuideTopic(key) {
  const topic = guideTopics[key] || guideTopics.start;
  $("#guideDrawerTitle").textContent = topic.title;
  const troubleshooting = topic.troubleshooting?.length ? `<section class="guide-troubleshooting"><h3>If something goes wrong</h3>${topic.troubleshooting.map(([problem, fix]) => `<details><summary>${escapeHtml(problem)}</summary><p>${escapeHtml(fix)}</p></details>`).join('')}</section>` : '';
  const prompt = topic.prompt ? `<section class="guide-prompt"><div><h3>Safe setup prompt</h3><p>Copy this into an AI assistant. Keep keys and sign-ins inside HexiGrid.</p></div><pre>${escapeHtml(topic.prompt)}</pre><button class="primary-button" data-action="copy-integration-prompt" data-guide="${escapeHtml(key)}"><span data-icon="copy"></span>Copy setup prompt</button></section>` : '';
  const links = topic.officialLinks?.length ? `<div class="integration-help-links">${topic.officialLinks.map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`).join('')}</div>` : '<p>Nothing to download or sign up for.</p>';
  const numberedGuide = topic.basics ? `<section class="guide-basics"><article><span>1</span><div><h3>What this is</h3><p>${escapeHtml(topic.basics.what)}</p></div></article><article><span>2</span><div><h3>What you need first</h3><p>${escapeHtml(topic.basics.need)}</p></div></article><article><span>3</span><div><h3>Exactly where to get it</h3>${links}</div></article></section><section class="guide-plug-in"><h3>4. Plug it into HexiGrid</h3><ol class="drawer-steps">${topic.steps.map(([title, body], index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div></li>`).join("")}</ol></section><section class="guide-cost"><span>5</span><div><h3>Cost and limits</h3><p>${escapeHtml(topic.basics.cost)}</p><small>Checked against the linked official pages: ${escapeHtml(topic.basics.checked || 'September 2026')}.</small></div></section>` : `<ol class="drawer-steps">${topic.steps.map(([title, body], index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div></li>`).join("")}</ol>${topic.officialLinks?.length ? `<section class="guide-official"><h3>Official source</h3>${links}</section>` : ''}`;
  $("#guideDrawerBody").innerHTML = `<p class="drawer-lead">${escapeHtml(topic.lead)}</p>${numberedGuide}${troubleshooting}${prompt}<div class="guide-note"><strong>Good to know</strong><p>${escapeHtml(topic.note)}</p></div>`;
  $("#guideDrawer").classList.remove("hidden");
  document.body.classList.add("overlay-open");
}

function closeGuideTopic() { $("#guideDrawer").classList.add("hidden"); document.body.classList.remove("overlay-open"); }
