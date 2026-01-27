/**
 * Academy Interview Assistant - Feedback Page Logic
 *
 * This script handles:
 * 1. Loading transcript from storage
 * 2. Analyzing transcript with Claude AI
 * 3. Loading candidates from Lever API
 * 4. Auto-matching candidates
 * 5. Submitting feedback to Lever
 * 6. Archiving to Gemini
 */

// Global state
let apiKeys = {};
let transcript = '';
let meetingTitle = '';
let attendees = [];
let meetingTimestamp = null;
let candidates = [];
let opportunities = [];
let feedbackTemplates = [];
let selectedCandidate = null;
let selectedOpportunity = null;
let selectedTemplate = null;
let analysisResult = null;

// DOM elements
const elements = {
  headerMeta: null,
  transcriptMeta: null,
  transcriptDisplay: null,
  manualPaste: null,
  manualTranscript: null,
  useManualTranscript: null,
  analysisLoading: null,
  reanalyzeBtn: null,
  candidateSelect: null,
  opportunitySelect: null,
  templateSelect: null,
  matchBadge: null,
  feedbackFields: null,
  formLoading: null,
  statusMessage: null,
  footerStatus: null,
  submitBtn: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Cache DOM elements
  Object.keys(elements).forEach(key => {
    elements[key] = document.getElementById(key);
  });

  try {
    // Load API keys
    apiKeys = await chrome.storage.local.get([
      'anthropicKey',
      'geminiKey',
      'leverKey',
      'leverUserId'
    ]);

    if (!apiKeys.anthropicKey || !apiKeys.leverKey) {
      showStatus('Please configure API keys in the extension settings first!', 'error');
      elements.footerStatus.textContent = 'API keys not configured';
      return;
    }

    // Load transcript from storage
    const { pendingTranscript } = await chrome.storage.local.get('pendingTranscript');

    if (pendingTranscript) {
      transcript = pendingTranscript.transcript || '';
      meetingTitle = pendingTranscript.meetingTitle || 'Untitled Meeting';
      attendees = pendingTranscript.attendees || [];
      meetingTimestamp = pendingTranscript.timestamp || Date.now();
    }

    // Update header
    updateHeader();

    // Display transcript
    displayTranscript();

    // Setup event listeners
    setupEventListeners();

    // Start parallel processes
    if (transcript) {
      // Show analysis loading
      elements.analysisLoading.style.display = 'flex';

      Promise.all([
        loadCandidates(),
        analyzeTranscript()
      ]).catch(error => {
        console.error('Error in parallel initialization:', error);
      });
    } else {
      // No transcript - show manual paste option
      elements.manualPaste.classList.add('visible');
      elements.transcriptDisplay.textContent = 'No transcript was automatically captured.';
      elements.transcriptDisplay.classList.add('empty');
      elements.formLoading.innerHTML = '<span style="color: #5f6368;">Paste a transcript to begin analysis</span>';

      // Still load candidates
      loadCandidates();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showStatus('Error initializing: ' + error.message, 'error');
  }
}

function updateHeader() {
  const date = meetingTimestamp ? new Date(meetingTimestamp).toLocaleDateString() : 'Today';
  elements.headerMeta.textContent = `${meetingTitle} - ${date}`;
}

function displayTranscript() {
  // Update metadata
  const metaHtml = `
    <div class="meta-item"><strong>Meeting:</strong> ${escapeHtml(meetingTitle)}</div>
    <div class="meta-item"><strong>Date:</strong> ${meetingTimestamp ? new Date(meetingTimestamp).toLocaleString() : 'Unknown'}</div>
    ${attendees.length > 0 ? `<div class="meta-item"><strong>Attendees:</strong> ${escapeHtml(attendees.join(', '))}</div>` : ''}
  `;
  elements.transcriptMeta.innerHTML = metaHtml;

  // Display transcript
  if (transcript) {
    elements.transcriptDisplay.textContent = transcript;
    elements.transcriptDisplay.classList.remove('empty');
  } else {
    elements.transcriptDisplay.textContent = 'No transcript captured. Use the manual paste option below.';
    elements.transcriptDisplay.classList.add('empty');
  }
}

function setupEventListeners() {
  // Manual transcript button
  elements.useManualTranscript.addEventListener('click', () => {
    const manualText = elements.manualTranscript.value.trim();
    if (manualText) {
      transcript = manualText;
      displayTranscript();
      elements.manualPaste.classList.remove('visible');
      elements.analysisLoading.style.display = 'flex';
      analyzeTranscript();
    } else {
      showStatus('Please paste a transcript first', 'error');
    }
  });

  // Re-analyze button
  elements.reanalyzeBtn.addEventListener('click', () => {
    elements.analysisLoading.style.display = 'flex';
    elements.reanalyzeBtn.style.display = 'none';
    analyzeTranscript();
  });

  // Candidate select
  elements.candidateSelect.addEventListener('change', onCandidateSelect);

  // Opportunity select
  elements.opportunitySelect.addEventListener('change', onOpportunitySelect);

  // Template select
  elements.templateSelect.addEventListener('change', onTemplateSelect);

  // Submit button
  elements.submitBtn.addEventListener('click', submitToLever);
}

// ============ Lever API Integration ============

async function loadCandidates() {
  try {
    elements.candidateSelect.innerHTML = '<option value="">Loading candidates...</option>';

    // Fetch opportunities with contact info expanded
    const response = await fetch('https://api.lever.co/v1/opportunities?limit=100&expand=contact', {
      headers: {
        'Authorization': `Basic ${btoa(apiKeys.leverKey + ':')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`);
    }

    const data = await response.json();
    candidates = data.data || [];

    // Populate dropdown
    elements.candidateSelect.innerHTML = '<option value="">Select a candidate...</option>';
    candidates.forEach((opp, index) => {
      const name = opp.contact?.name || 'Unknown';
      const position = opp.posting?.text || opp.name || 'No position';
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${name} - ${position}`;
      elements.candidateSelect.appendChild(option);
    });

    elements.candidateSelect.disabled = false;

    // Attempt auto-match
    autoMatchCandidate();

  } catch (error) {
    console.error('Error loading candidates:', error);
    elements.candidateSelect.innerHTML = '<option value="">Error loading candidates</option>';
    showStatus('Failed to load candidates from Lever: ' + error.message, 'error');
  }
}

function autoMatchCandidate() {
  if (candidates.length === 0) return;

  const matches = [];

  candidates.forEach((opp, index) => {
    const contact = opp.contact;
    if (!contact || !contact.name) return;

    const candidateName = contact.name.toLowerCase();
    const [firstName, ...lastNameParts] = contact.name.split(' ');
    const lastName = lastNameParts.join(' ');
    const firstNameLower = firstName.toLowerCase();
    const lastNameLower = lastName.toLowerCase();

    // Check meeting title
    const titleLower = meetingTitle.toLowerCase();
    const fullNameInTitle = titleLower.includes(candidateName);
    const partialNameInTitle = titleLower.includes(firstNameLower) &&
                               (lastNameLower === '' || titleLower.includes(lastNameLower));

    // Check attendees
    const attendeeMatch = attendees.some(attendee => {
      const attendeeLower = attendee.toLowerCase();
      return attendeeLower.includes(firstNameLower) &&
             (lastNameLower === '' || attendeeLower.includes(lastNameLower));
    });

    if (fullNameInTitle || partialNameInTitle || attendeeMatch) {
      matches.push({ index, name: contact.name, score: fullNameInTitle ? 3 : (partialNameInTitle ? 2 : 1) });
    }
  });

  // Sort by score
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 1) {
    // Single match - auto-select
    elements.candidateSelect.value = matches[0].index;
    showMatchBadge('success', `Auto-matched: ${matches[0].name}`);
    onCandidateSelect({ target: elements.candidateSelect });
  } else if (matches.length > 1) {
    // Multiple matches - highlight but don't auto-select
    showMatchBadge('warning', `${matches.length} potential matches - please select`);
    // Could highlight matching options in dropdown
  } else {
    // No match
    showMatchBadge('info', 'Please select the candidate');
  }
}

function showMatchBadge(type, text) {
  elements.matchBadge.className = `match-badge ${type}`;
  elements.matchBadge.textContent = text;
  elements.matchBadge.style.display = 'inline-flex';
}

async function onCandidateSelect(e) {
  const index = e.target.value;
  if (index === '') {
    selectedCandidate = null;
    elements.opportunitySelect.innerHTML = '<option value="">Select a candidate first</option>';
    elements.opportunitySelect.disabled = true;
    return;
  }

  selectedCandidate = candidates[index];

  // For Lever, each "opportunity" is already a candidate+position combo
  // So we just use the selected opportunity directly
  elements.opportunitySelect.innerHTML = '<option value="">Loading...</option>';

  // The opportunity is already selected, just show it
  const position = selectedCandidate.posting?.text || selectedCandidate.name || 'No position';
  elements.opportunitySelect.innerHTML = `<option value="0" selected>${position}</option>`;
  elements.opportunitySelect.disabled = false;
  selectedOpportunity = selectedCandidate;

  // Load feedback templates
  await loadFeedbackTemplates();

  validateForm();
}

async function onOpportunitySelect(e) {
  // In this simplified version, opportunity is same as candidate
  selectedOpportunity = selectedCandidate;
  validateForm();
}

async function loadFeedbackTemplates() {
  try {
    elements.templateSelect.innerHTML = '<option value="">Loading templates...</option>';

    const response = await fetch('https://api.lever.co/v1/feedback_templates', {
      headers: {
        'Authorization': `Basic ${btoa(apiKeys.leverKey + ':')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`);
    }

    const data = await response.json();
    feedbackTemplates = data.data || [];

    // Populate dropdown
    elements.templateSelect.innerHTML = '<option value="">Select a template...</option>';
    feedbackTemplates.forEach((template, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = template.text || template.name || 'Unnamed Template';
      elements.templateSelect.appendChild(option);
    });

    elements.templateSelect.disabled = false;

    // Try to auto-select an interview template
    const interviewTemplateIndex = feedbackTemplates.findIndex(t => {
      const name = (t.text || t.name || '').toLowerCase();
      return name.includes('interview') || name.includes('on-site') || name.includes('onsite');
    });

    if (interviewTemplateIndex >= 0) {
      elements.templateSelect.value = interviewTemplateIndex;
      onTemplateSelect({ target: elements.templateSelect });
    }

  } catch (error) {
    console.error('Error loading feedback templates:', error);
    elements.templateSelect.innerHTML = '<option value="">Error loading templates</option>';
  }
}

function onTemplateSelect(e) {
  const index = e.target.value;
  if (index === '') {
    selectedTemplate = null;
    return;
  }

  selectedTemplate = feedbackTemplates[index];
  validateForm();
}

// ============ Claude AI Analysis ============

async function analyzeTranscript() {
  if (!transcript) {
    console.log('No transcript to analyze');
    return;
  }

  try {
    elements.formLoading.style.display = 'flex';
    elements.formLoading.innerHTML = '<div class="spinner"></div><span>Analyzing transcript with AI...</span>';

    const prompt = buildAnalysisPrompt();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKeys.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON from response
    analysisResult = parseAnalysisResult(content);

    // Hide loading, show form
    elements.analysisLoading.style.display = 'none';
    elements.reanalyzeBtn.style.display = 'inline-flex';

    // Populate feedback form
    populateFeedbackForm();

  } catch (error) {
    console.error('Error analyzing transcript:', error);
    elements.analysisLoading.style.display = 'none';
    elements.reanalyzeBtn.style.display = 'inline-flex';
    elements.formLoading.innerHTML = `<span style="color: #d93025;">Analysis failed: ${error.message}</span>`;
    showStatus('AI analysis failed: ' + error.message, 'error');
  }
}

function buildAnalysisPrompt() {
  return `You are analyzing an interview transcript for a recruiting team at Academy, a design-led recruiting and staffing business.

Meeting Context:
- Meeting Title: ${meetingTitle}
- Date: ${meetingTimestamp ? new Date(meetingTimestamp).toLocaleDateString() : 'Unknown'}
- Attendees: ${attendees.join(', ') || 'Unknown'}

Transcript:
${transcript}

Analyze this interview and provide structured feedback in this exact JSON format:
{
  "rating": "one of: 4 - Strong Hire, 3 - Hire, 2 - No Hire, 1 - Strong No Hire",
  "strengths": "2-3 sentences about key strengths demonstrated in the interview",
  "concerns": "2-3 sentences about any concerns or areas for improvement",
  "technicalSkills": "List of specific technical skills, tools, or frameworks mentioned",
  "culturalFit": "Brief assessment of cultural fit and soft skills",
  "recommendation": "Clear recommendation on next steps",
  "keyQuotes": ["notable quote 1", "notable quote 2", "notable quote 3"],
  "alternativeRatings": [
    {"rating": "3 - Hire", "reasoning": "brief reason why this could also be appropriate"},
    {"rating": "2 - No Hire", "reasoning": "brief reason if you have concerns"}
  ]
}

Be objective and base your assessment only on what was discussed in the interview. Focus on:
- Specific examples and evidence from the conversation
- Technical competency demonstrated
- Communication and problem-solving approach
- Culture and team fit indicators

Respond with ONLY the JSON object, no additional text.`;
}

function parseAnalysisResult(content) {
  // Try to extract JSON from the response
  try {
    // First try direct parse
    return JSON.parse(content);
  } catch (e) {
    // Try to find JSON in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error('Failed to parse JSON from response:', e2);
      }
    }
  }

  // Return default structure if parsing fails
  return {
    rating: '3 - Hire',
    strengths: 'Unable to analyze transcript automatically. Please fill in manually.',
    concerns: '',
    technicalSkills: '',
    culturalFit: '',
    recommendation: '',
    keyQuotes: [],
    alternativeRatings: []
  };
}

function populateFeedbackForm() {
  if (!analysisResult) return;

  elements.formLoading.style.display = 'none';

  const formHtml = `
    <div class="form-group">
      <label for="ratingField">Overall Rating</label>
      <select id="ratingField">
        <option value="4 - Strong Hire" ${analysisResult.rating?.includes('4') ? 'selected' : ''}>4 - Strong Hire</option>
        <option value="3 - Hire" ${analysisResult.rating?.includes('3') ? 'selected' : ''}>3 - Hire</option>
        <option value="2 - No Hire" ${analysisResult.rating?.includes('2') ? 'selected' : ''}>2 - No Hire</option>
        <option value="1 - Strong No Hire" ${analysisResult.rating?.includes('1') ? 'selected' : ''}>1 - Strong No Hire</option>
      </select>
      ${analysisResult.alternativeRatings?.length > 0 ? `
        <div class="suggestion-chips">
          ${analysisResult.alternativeRatings.map(alt => `
            <button class="suggestion-chip" data-rating="${alt.rating}" title="${escapeHtml(alt.reasoning)}">
              ${alt.rating}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="form-group">
      <label for="strengthsField">Strengths</label>
      <textarea id="strengthsField" rows="3">${escapeHtml(analysisResult.strengths || '')}</textarea>
    </div>

    <div class="form-group">
      <label for="concernsField">Concerns</label>
      <textarea id="concernsField" rows="3">${escapeHtml(analysisResult.concerns || '')}</textarea>
    </div>

    <div class="form-group">
      <label for="technicalSkillsField">Technical Skills</label>
      <textarea id="technicalSkillsField" rows="2">${escapeHtml(analysisResult.technicalSkills || '')}</textarea>
    </div>

    <div class="form-group">
      <label for="culturalFitField">Cultural Fit</label>
      <textarea id="culturalFitField" rows="2">${escapeHtml(analysisResult.culturalFit || '')}</textarea>
    </div>

    <div class="form-group">
      <label for="recommendationField">Recommendation</label>
      <textarea id="recommendationField" rows="2">${escapeHtml(analysisResult.recommendation || '')}</textarea>
    </div>

    ${analysisResult.keyQuotes?.length > 0 ? `
      <div class="form-group">
        <label>Key Quotes (Reference)</label>
        <div class="key-quotes">
          ${analysisResult.keyQuotes.map(q => `<p>"${escapeHtml(q)}"</p>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  elements.feedbackFields.innerHTML = formHtml;

  // Add click handlers for suggestion chips
  elements.feedbackFields.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('ratingField').value = chip.dataset.rating;
    });
  });

  validateForm();
}

// ============ Form Validation & Submission ============

function validateForm() {
  const hasCandidate = selectedCandidate !== null;
  const hasTemplate = selectedTemplate !== null;
  const hasAnalysis = analysisResult !== null;

  const isValid = hasCandidate && hasTemplate && hasAnalysis;

  elements.submitBtn.disabled = !isValid;

  if (isValid) {
    elements.footerStatus.textContent = 'Ready to submit';
  } else {
    const missing = [];
    if (!hasCandidate) missing.push('candidate');
    if (!hasTemplate) missing.push('template');
    if (!hasAnalysis) missing.push('analysis');
    elements.footerStatus.textContent = `Missing: ${missing.join(', ')}`;
  }
}

async function submitToLever() {
  if (!selectedCandidate || !selectedTemplate) {
    showStatus('Please select a candidate and template', 'error');
    return;
  }

  try {
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Submitting...';

    // Gather form values
    const formData = {
      rating: document.getElementById('ratingField')?.value || '',
      strengths: document.getElementById('strengthsField')?.value || '',
      concerns: document.getElementById('concernsField')?.value || '',
      technicalSkills: document.getElementById('technicalSkillsField')?.value || '',
      culturalFit: document.getElementById('culturalFitField')?.value || '',
      recommendation: document.getElementById('recommendationField')?.value || ''
    };

    // Build feedback text (since Lever templates vary, we'll combine into notes)
    const feedbackText = `
Rating: ${formData.rating}

Strengths:
${formData.strengths}

Concerns:
${formData.concerns}

Technical Skills:
${formData.technicalSkills}

Cultural Fit:
${formData.culturalFit}

Recommendation:
${formData.recommendation}
    `.trim();

    // Submit to Lever
    const opportunityId = selectedCandidate.id;
    const response = await fetch(
      `https://api.lever.co/v1/opportunities/${opportunityId}/feedback?perform_as=${apiKeys.leverUserId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(apiKeys.leverKey + ':')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseTemplateId: selectedTemplate.id,
          text: feedbackText,
          completedAt: Date.now()
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Lever API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    // Success!
    showStatus('Feedback submitted successfully to Lever!', 'success');
    elements.submitBtn.textContent = 'Submitted!';
    elements.submitBtn.classList.remove('btn-success');
    elements.submitBtn.style.background = '#1e8e3e';

    // Store in Gemini (non-blocking)
    storeInGemini(formData).catch(err => {
      console.error('Gemini storage failed (non-blocking):', err);
    });

    // Clear pending transcript
    await chrome.storage.local.remove('pendingTranscript');

    // Prompt to close tab
    setTimeout(() => {
      if (confirm('Feedback submitted successfully! Close this tab?')) {
        window.close();
      }
    }, 1000);

  } catch (error) {
    console.error('Error submitting to Lever:', error);
    showStatus('Failed to submit feedback: ' + error.message, 'error');
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = 'Submit to Lever';
  }
}

async function storeInGemini(formData) {
  if (!apiKeys.geminiKey) {
    console.log('No Gemini API key configured, skipping archive');
    return;
  }

  const candidateName = selectedCandidate?.contact?.name || 'Unknown';
  const position = selectedCandidate?.posting?.text || 'Unknown Position';
  const date = new Date().toISOString().split('T')[0];

  const content = `
CANDIDATE: ${candidateName}
POSITION: ${position}
INTERVIEW DATE: ${date}
MEETING TITLE: ${meetingTitle}
ATTENDEES: ${attendees.join(', ')}
RATING: ${formData.rating}

STRENGTHS:
${formData.strengths}

CONCERNS:
${formData.concerns}

TECHNICAL SKILLS:
${formData.technicalSkills}

CULTURAL FIT:
${formData.culturalFit}

RECOMMENDATION:
${formData.recommendation}

FULL TRANSCRIPT:
${transcript}
  `.trim();

  // Upload to Gemini File API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKeys.geminiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file: {
          displayName: `${candidateName} - ${position} - ${date}`,
          mimeType: 'text/plain'
        },
        content: btoa(unescape(encodeURIComponent(content)))
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  console.log('Transcript archived to Gemini');
}

// ============ Utility Functions ============

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message visible ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      elements.statusMessage.classList.remove('visible');
    }, 5000);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
