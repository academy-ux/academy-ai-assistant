/**
 * Academy Interview Assistant - Feedback Page Logic
 *
 * Fetches transcript from Google Drive (via Google Meet's auto-transcription)
 * then analyzes with Claude and submits to Lever.
 */

// Global state
let apiKeys = {};
let transcript = '';
let transcriptFileName = '';
let meetingTitle = '';
let meetingCode = '';
let meetingTimestamp = null;
let candidates = [];
let feedbackTemplates = [];
let selectedCandidate = null;
let selectedOpportunity = null;
let selectedTemplate = null;
let analysisResult = null;

// Transcript fetch configuration
const INITIAL_WAIT = 30; // seconds before first attempt
const RETRY_INTERVAL = 15; // seconds between retries
const MAX_RETRIES = 6; // total retries after initial wait
let countdownValue = INITIAL_WAIT;
let countdownInterval = null;
let retryCount = 0;

// DOM elements
const elements = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Cache DOM elements
  const elementIds = [
    'headerMeta', 'waitingState', 'countdown', 'retryBtn',
    'transcriptContainer', 'transcriptMeta', 'transcriptDisplay',
    'transcriptSource', 'transcriptStatus',
    'candidateSelect', 'opportunitySelect', 'templateSelect',
    'matchBadge', 'feedbackFields', 'formLoading',
    'statusMessage', 'footerStatus', 'submitBtn'
  ];

  elementIds.forEach(id => {
    elements[id] = document.getElementById(id);
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
      showTranscriptStatus('Please configure API keys in the extension settings first!', 'error');
      elements.footerStatus.textContent = 'API keys not configured';
      return;
    }

    // Load meeting info from storage
    const { pendingMeeting } = await chrome.storage.local.get('pendingMeeting');

    if (pendingMeeting) {
      meetingCode = pendingMeeting.meetingCode || '';
      meetingTitle = pendingMeeting.meetingTitle || '';
      meetingTimestamp = pendingMeeting.timestamp || Date.now();
    }

    // Update header
    updateHeader();

    // Setup event listeners
    setupEventListeners();

    // Start loading candidates in parallel
    loadCandidates();

    // Start countdown and fetch transcript
    startTranscriptFetch();

  } catch (error) {
    console.error('Initialization error:', error);
    showTranscriptStatus('Error initializing: ' + error.message, 'error');
  }
}

function updateHeader() {
  const date = meetingTimestamp ? new Date(meetingTimestamp).toLocaleDateString() : 'Today';
  const title = meetingTitle || meetingCode || 'Interview';
  elements.headerMeta.textContent = `${title} - ${date}`;
}

function setupEventListeners() {
  // Retry button
  elements.retryBtn.addEventListener('click', () => {
    elements.retryBtn.style.display = 'none';
    fetchTranscript();
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

// ============ Transcript Fetching ============

function startTranscriptFetch() {
  countdownValue = INITIAL_WAIT;
  updateCountdown();

  countdownInterval = setInterval(() => {
    countdownValue--;
    updateCountdown();

    if (countdownValue <= 0) {
      clearInterval(countdownInterval);
      fetchTranscript();
    }
  }, 1000);
}

function updateCountdown() {
  elements.countdown.textContent = countdownValue;
}

async function fetchTranscript() {
  elements.waitingState.querySelector('h3').textContent = 'Searching Google Drive for transcript...';
  elements.countdown.style.display = 'none';
  elements.waitingState.querySelector('.spinner-large').style.display = 'block';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchTranscript',
      meetingTitle: meetingTitle,
      meetingCode: meetingCode
    });

    if (response.success && response.transcript) {
      // Success! Display transcript
      transcript = response.transcript;
      transcriptFileName = response.fileName || 'Google Meet Transcript';

      displayTranscript();

      // Start AI analysis
      analyzeTranscript();

    } else {
      // Not found - retry or show manual option
      handleTranscriptNotFound(response.error);
    }

  } catch (error) {
    console.error('Error fetching transcript:', error);
    handleTranscriptNotFound(error.message);
  }
}

function handleTranscriptNotFound(errorMessage) {
  retryCount++;

  if (retryCount <= MAX_RETRIES) {
    // Show retry countdown
    elements.waitingState.querySelector('h3').textContent = 'Transcript not ready yet...';
    elements.countdown.style.display = 'block';
    countdownValue = RETRY_INTERVAL;
    updateCountdown();

    countdownInterval = setInterval(() => {
      countdownValue--;
      updateCountdown();

      if (countdownValue <= 0) {
        clearInterval(countdownInterval);
        fetchTranscript();
      }
    }, 1000);

    elements.retryBtn.style.display = 'inline-flex';
    elements.retryBtn.textContent = `Retry Now (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`;

  } else {
    // Max retries reached - show error
    elements.waitingState.innerHTML = `
      <div style="color: #d93025; font-size: 48px; margin-bottom: 16px;">!</div>
      <h3>Could not find transcript</h3>
      <p style="margin-bottom: 16px;">${errorMessage || 'No transcript found in Google Drive.'}</p>
      <p style="font-size: 13px; color: #5f6368;">
        Make sure Google Meet transcription was enabled for this meeting.<br>
        Transcripts are saved to your Google Drive after the meeting ends.
      </p>
      <button class="btn btn-primary retry-btn" onclick="location.reload()">
        Try Again
      </button>
    `;
  }
}

function displayTranscript() {
  // Hide waiting state, show transcript
  elements.waitingState.style.display = 'none';
  elements.transcriptContainer.style.display = 'block';

  // Update source indicator
  elements.transcriptSource.textContent = 'From Google Drive';

  // Update metadata
  const metaHtml = `
    <div class="meta-item"><strong>File:</strong> ${escapeHtml(transcriptFileName)}</div>
    <div class="meta-item"><strong>Meeting:</strong> ${escapeHtml(meetingTitle || meetingCode || 'Unknown')}</div>
    <div class="meta-item"><strong>Date:</strong> ${meetingTimestamp ? new Date(meetingTimestamp).toLocaleString() : 'Today'}</div>
  `;
  elements.transcriptMeta.innerHTML = metaHtml;

  // Display transcript
  elements.transcriptDisplay.textContent = transcript;

  // Update form loading state
  elements.formLoading.innerHTML = '<div class="spinner"></div><span>Analyzing transcript with AI...</span>';
}

// ============ Lever API Integration ============

async function loadCandidates() {
  try {
    elements.candidateSelect.innerHTML = '<option value="">Loading candidates...</option>';

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

    // Attempt auto-match once we have transcript
    if (transcript) {
      autoMatchCandidate();
    }

  } catch (error) {
    console.error('Error loading candidates:', error);
    elements.candidateSelect.innerHTML = '<option value="">Error loading candidates</option>';
    showStatus('Failed to load candidates from Lever: ' + error.message, 'error');
  }
}

function autoMatchCandidate() {
  if (candidates.length === 0) return;

  const matches = [];
  const searchText = (meetingTitle + ' ' + transcriptFileName + ' ' + transcript.substring(0, 500)).toLowerCase();

  candidates.forEach((opp, index) => {
    const contact = opp.contact;
    if (!contact || !contact.name) return;

    const candidateName = contact.name.toLowerCase();
    const [firstName, ...lastNameParts] = contact.name.split(' ');
    const lastName = lastNameParts.join(' ');
    const firstNameLower = firstName.toLowerCase();
    const lastNameLower = lastName.toLowerCase();

    // Check in meeting title, filename, and transcript
    const fullNameMatch = searchText.includes(candidateName);
    const partialNameMatch = searchText.includes(firstNameLower) &&
                             (lastNameLower === '' || searchText.includes(lastNameLower));

    if (fullNameMatch) {
      matches.push({ index, name: contact.name, score: 3 });
    } else if (partialNameMatch) {
      matches.push({ index, name: contact.name, score: 2 });
    }
  });

  // Sort by score
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 1) {
    elements.candidateSelect.value = matches[0].index;
    showMatchBadge('success', `Auto-matched: ${matches[0].name}`);
    onCandidateSelect({ target: elements.candidateSelect });
  } else if (matches.length > 1) {
    showMatchBadge('warning', `${matches.length} potential matches`);
  } else {
    showMatchBadge('info', 'Please select candidate');
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

  const position = selectedCandidate.posting?.text || selectedCandidate.name || 'No position';
  elements.opportunitySelect.innerHTML = `<option value="0" selected>${position}</option>`;
  elements.opportunitySelect.disabled = false;
  selectedOpportunity = selectedCandidate;

  await loadFeedbackTemplates();
  validateForm();
}

function onOpportunitySelect(e) {
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

    elements.templateSelect.innerHTML = '<option value="">Select a template...</option>';
    feedbackTemplates.forEach((template, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = template.text || template.name || 'Unnamed Template';
      elements.templateSelect.appendChild(option);
    });

    elements.templateSelect.disabled = false;

    // Auto-select interview template
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
  selectedTemplate = index !== '' ? feedbackTemplates[index] : null;
  validateForm();
}

// ============ Claude AI Analysis ============

async function analyzeTranscript() {
  if (!transcript) return;

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

    analysisResult = parseAnalysisResult(content);
    populateFeedbackForm();

    // Try auto-matching candidate now that we have the transcript analyzed
    if (!selectedCandidate) {
      autoMatchCandidate();
    }

  } catch (error) {
    console.error('Error analyzing transcript:', error);
    elements.formLoading.innerHTML = `<span style="color: #d93025;">Analysis failed: ${error.message}</span>`;
    showStatus('AI analysis failed: ' + error.message, 'error');
  }
}

function buildAnalysisPrompt() {
  return `You are analyzing an interview transcript for a recruiting team at Academy, a design-led recruiting and staffing business.

Meeting: ${meetingTitle || meetingCode || 'Interview'}
Date: ${meetingTimestamp ? new Date(meetingTimestamp).toLocaleDateString() : 'Today'}

Transcript:
${transcript}

Analyze this interview and provide structured feedback in this exact JSON format:
{
  "rating": "one of: 4 - Strong Hire, 3 - Hire, 2 - No Hire, 1 - Strong No Hire",
  "strengths": "2-3 sentences about key strengths demonstrated",
  "concerns": "2-3 sentences about concerns or areas for improvement",
  "technicalSkills": "List of technical skills, tools, or frameworks mentioned",
  "culturalFit": "Brief assessment of cultural fit and soft skills",
  "recommendation": "Clear recommendation on next steps",
  "keyQuotes": ["notable quote 1", "notable quote 2", "notable quote 3"],
  "alternativeRatings": [
    {"rating": "alternative rating", "reasoning": "brief reason"}
  ]
}

Be objective. Focus on specific examples from the conversation. Respond with ONLY the JSON object.`;
}

function parseAnalysisResult(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {}
    }
  }

  return {
    rating: '3 - Hire',
    strengths: 'Unable to parse analysis. Please fill in manually.',
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
        <label>Key Quotes</label>
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

    const formData = {
      rating: document.getElementById('ratingField')?.value || '',
      strengths: document.getElementById('strengthsField')?.value || '',
      concerns: document.getElementById('concernsField')?.value || '',
      technicalSkills: document.getElementById('technicalSkillsField')?.value || '',
      culturalFit: document.getElementById('culturalFitField')?.value || '',
      recommendation: document.getElementById('recommendationField')?.value || ''
    };

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

    showStatus('Feedback submitted successfully to Lever!', 'success');
    elements.submitBtn.textContent = 'Submitted!';
    elements.submitBtn.style.background = '#1e8e3e';

    // Store in Gemini (non-blocking)
    storeInGemini(formData).catch(err => {
      console.error('Gemini storage failed:', err);
    });

    // Clear pending meeting
    await chrome.storage.local.remove('pendingMeeting');

    setTimeout(() => {
      if (confirm('Feedback submitted! Close this tab?')) {
        window.close();
      }
    }, 1000);

  } catch (error) {
    console.error('Error submitting to Lever:', error);
    showStatus('Failed to submit: ' + error.message, 'error');
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = 'Submit to Lever';
  }
}

async function storeInGemini(formData) {
  if (!apiKeys.geminiKey) return;

  const candidateName = selectedCandidate?.contact?.name || 'Unknown';
  const position = selectedCandidate?.posting?.text || 'Unknown Position';
  const date = new Date().toISOString().split('T')[0];

  const content = `
CANDIDATE: ${candidateName}
POSITION: ${position}
DATE: ${date}
MEETING: ${meetingTitle || meetingCode}
RATING: ${formData.rating}

STRENGTHS:
${formData.strengths}

CONCERNS:
${formData.concerns}

TECHNICAL SKILLS:
${formData.technicalSkills}

RECOMMENDATION:
${formData.recommendation}

TRANSCRIPT:
${transcript}
  `.trim();

  await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKeys.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: {
          displayName: `${candidateName} - ${position} - ${date}`,
          mimeType: 'text/plain'
        },
        content: btoa(unescape(encodeURIComponent(content)))
      })
    }
  );
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

function showTranscriptStatus(message, type) {
  const el = elements.transcriptStatus;
  el.textContent = message;
  el.className = `status-message visible ${type}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
