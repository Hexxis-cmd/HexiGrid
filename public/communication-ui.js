/* Global natural-language guidance, examples, and preview. */
function renderCommunication(guide = state.data.settings.communicationGuide) {
  $("#communicationEnabled").checked = guide.enabled !== false;
  $("#communicationInstructions").value = guide.instructions || "";
  $("#communicationExamples").innerHTML = (guide.examples || []).map((example, index) => `<article class="example-card" data-example-index="${index}"><div class="example-number">${String(index + 1).padStart(2, "0")}</div><div class="example-fields"><label>Situation<input data-example-field="situation" value="${escapeHtml(example.situation)}" /></label><label>Avoid<textarea data-example-field="avoid" rows="2">${escapeHtml(example.avoid)}</textarea></label><label>Prefer<textarea data-example-field="prefer" rows="2">${escapeHtml(example.prefer)}</textarea></label></div><button class="mini-button example-remove" data-action="remove-communication-example" data-example-index="${index}" title="Remove example">×</button></article>`).join("") || `<div class="empty-state">No examples yet. Add one to show the style you want.</div>`;
}

function collectCommunicationGuide() {
  return {
    enabled: $("#communicationEnabled").checked,
    instructions: $("#communicationInstructions").value,
    examples: $$("[data-example-index]").map((card) => ({
      situation: card.querySelector('[data-example-field="situation"]').value,
      avoid: card.querySelector('[data-example-field="avoid"]').value,
      prefer: card.querySelector('[data-example-field="prefer"]').value
    }))
  };
}

async function saveCommunication() {
  await updateSettings({ communicationGuide: collectCommunicationGuide() }, "Communication style saved.");
}

function addCommunicationExample() {
  const guide = collectCommunicationGuide();
  if (guide.examples.length >= 30) return notify("You can keep up to 30 examples.", true);
  guide.examples.push({ situation: "", avoid: "", prefer: "" });
  renderCommunication(guide);
  $("[data-example-index]:last-child input")?.focus();
}

function removeCommunicationExample(index) {
  const guide = collectCommunicationGuide();
  guide.examples.splice(Number(index), 1);
  renderCommunication(guide);
}

async function previewCommunication() {
  const output = $("#communicationPreviewOutput");
  output.textContent = "Generating a local preview…";
  try {
    const response = await api("/api/communication/preview", { method: "POST", body: JSON.stringify({ message: $("#communicationPreviewInput").value, guide: collectCommunicationGuide() }) });
    output.textContent = response.content;
  } catch (error) { output.textContent = error.message; output.classList.add("error-message"); }
}
