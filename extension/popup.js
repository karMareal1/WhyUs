// WhyUs Extension - Popup Script

let currentResume = null;
let backendUrl = 'http://localhost:3000';

// DOM elements
const questionInput = document.getElementById('question');
const companyInput = document.getElementById('company');
const roleInput = document.getElementById('role');
const detectSelectionBtn = document.getElementById('detectSelection');
const detectCompanyBtn = document.getElementById('detectCompany');
const resumeFileInput = document.getElementById('resumeFile');
const uploadResumeBtn = document.getElementById('uploadResumeBtn');
const resumeStatus = document.getElementById('resumeStatus');
const generateBtn = document.getElementById('generateBtn');
const statusDiv = document.getElementById('status');
const resultsSection = document.getElementById('resultsSection');
const draftText = document.getElementById('draftText');
const copyBtn = document.getElementById('copyBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const wordCountBadge = document.getElementById('wordCount');
const qualityScoreBadge = document.getElementById('qualityScore');
const qualityFeedback = document.getElementById('qualityFeedback');
const feedbackContent = document.getElementById('feedbackContent');
const metadataContent = document.getElementById('metadataContent');
const backendUrlInput = document.getElementById('backendUrl');
const saveSettingsBtn = document.getElementById('saveSettings');
const savedResumesDiv = document.getElementById('savedResumes');
const savedResumeSelect = document.getElementById('savedResumeSelect');
const useSavedResumeBtn = document.getElementById('useSavedResume');
const deleteSavedResumeBtn = document.getElementById('deleteSavedResume');

// Load settings
chrome.storage.local.get(['backendUrl', 'savedResumes'], (data) => {
  if (data.backendUrl) {
    backendUrl = data.backendUrl;
    backendUrlInput.value = backendUrl;
  }
  if (data.savedResumes && data.savedResumes.length > 0) {
    populateSavedResumes(data.savedResumes);
    savedResumesDiv.style.display = 'block';
  }
});

// Event listeners
detectSelectionBtn.addEventListener('click', detectSelectedText);
detectCompanyBtn.addEventListener('click', detectCompany);
uploadResumeBtn.addEventListener('click', () => resumeFileInput.click());
resumeFileInput.addEventListener('change', handleResumeUpload);
generateBtn.addEventListener('click', generateAnswer);
copyBtn.addEventListener('click', copyToClipboard);
regenerateBtn.addEventListener('click', generateAnswer);
saveSettingsBtn.addEventListener('click', saveSettings);
useSavedResumeBtn.addEventListener('click', useSavedResume);
deleteSavedResumeBtn.addEventListener('click', deleteSavedResume);

// Input validation
[questionInput, companyInput].forEach(input => {
  input.addEventListener('input', validateForm);
});

// Detect selected text from page
async function detectSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
    
    if (result && result.text) {
      questionInput.value = result.text;
      showStatus('Selected text detected!', 'success', 2000);
      validateForm();
    } else {
      showStatus('No text selected on the page', 'error', 3000);
    }
  } catch (error) {
    showStatus('Could not detect selection. Try manually copying the text.', 'error', 3000);
  }
}

// Auto-detect company name from page
async function detectCompany() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Try to extract company name from URL or page title
    const url = new URL(tab.url);
    const hostname = url.hostname.replace('www.', '');
    
    // Common job application domains
    const jobSites = ['linkedin.com', 'greenhouse.io', 'lever.co', 'workday.com', 'myworkdayjobs.com'];
    
    if (jobSites.some(site => hostname.includes(site))) {
      // Try to get company from page title
      const title = tab.title;
      const match = title.match(/(.+?)\s*[-|]/);
      if (match) {
        companyInput.value = match[1].trim();
        showStatus('Company detected from page!', 'success', 2000);
        validateForm();
        return;
      }
    }
    
    // Fallback: use domain name
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      const company = domainParts[domainParts.length - 2];
      companyInput.value = company.charAt(0).toUpperCase() + company.slice(1);
      showStatus('Company guessed from URL', 'success', 2000);
      validateForm();
    } else {
      showStatus('Could not auto-detect company. Please enter manually.', 'error', 3000);
    }
  } catch (error) {
    showStatus('Auto-detection failed. Please enter company name manually.', 'error', 3000);
  }
}

// Handle resume upload
async function handleResumeUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showStatus('Resume file too large. Maximum 5MB.', 'error', 3000);
    return;
  }

  const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
    showStatus('Invalid file type. Please upload PDF, DOCX, or TXT.', 'error', 3000);
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    currentResume = {
      name: file.name,
      data: base64,
      type: fileExt,
      uploadedAt: new Date().toISOString()
    };

    resumeStatus.textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;
    resumeStatus.classList.add('success');
    
    // Save to storage
    saveResumeToStorage(currentResume);
    
    validateForm();
  } catch (error) {
    showStatus('Error reading resume file', 'error', 3000);
    console.error(error);
  }
}

// Generate answer
async function generateAnswer() {
  const question = questionInput.value.trim();
  const company = companyInput.value.trim();
  const role = roleInput.value.trim();

  if (!question || !company || !currentResume) {
    showStatus('Please fill in all required fields', 'error', 3000);
    return;
  }

  generateBtn.disabled = true;
  resultsSection.style.display = 'none';
  showStatus('Generating your answer... This may take 5-15 seconds.', 'loading');

  try {
    const response = await fetch(`${backendUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        companyName: company,
        role: role || null,
        resumeData: currentResume.data,
        resumeFileType: currentResume.type
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      displayResults(result);
      showStatus('Draft generated successfully!', 'success', 3000);
    } else {
      throw new Error(result.error || 'Generation failed');
    }

  } catch (error) {
    console.error('Generation error:', error);
    showStatus(`Error: ${error.message}. Make sure the backend server is running.`, 'error', 5000);
  } finally {
    generateBtn.disabled = false;
  }
}

// Display results
function displayResults(result) {
  resultsSection.style.display = 'block';
  draftText.textContent = result.draft;

  // Word count
  const wordCount = result.metadata?.wordCount || result.draft.split(/\s+/).length;
  wordCountBadge.textContent = `${wordCount} words`;

  // Quality score
  const score = result.critique?.genericnessScore || 5;
  let scoreClass = 'good';
  let scoreText = 'Specific';
  
  if (score > 6) {
    scoreClass = 'error';
    scoreText = 'Too Generic';
  } else if (score > 4) {
    scoreClass = 'warning';
    scoreText = 'Could be More Specific';
  }
  
  qualityScoreBadge.textContent = scoreText;
  qualityScoreBadge.className = `badge ${scoreClass}`;

  // Quality feedback
  if (!result.critique?.approved || result.critique?.templatedPhrasing?.length > 0 || result.critique?.unsupportedClaims?.length > 0) {
    const feedback = [];
    
    if (result.critique?.templatedPhrasing?.length > 0) {
      feedback.push(`<strong>Generic phrases detected:</strong> ${result.critique.templatedPhrasing.join(', ')}`);
    }
    
    if (result.critique?.unsupportedClaims?.length > 0) {
      feedback.push(`<strong>Unsupported claims:</strong> ${result.critique.unsupportedClaims.join(', ')}`);
    }

    if (!result.critique?.approved) {
      feedback.push('<strong>Note:</strong> This draft could be improved. Consider regenerating or editing manually.');
    }

    if (feedback.length > 0) {
      feedbackContent.innerHTML = '<ul><li>' + feedback.join('</li><li>') + '</li></ul>';
      qualityFeedback.style.display = 'block';
    } else {
      qualityFeedback.style.display = 'none';
    }
  } else {
    qualityFeedback.style.display = 'none';
  }

  // Metadata
  metadataContent.textContent = JSON.stringify(result.metadata, null, 2);

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Copy to clipboard
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(draftText.textContent);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    showStatus('Failed to copy to clipboard', 'error', 2000);
  }
}

// Save settings
function saveSettings() {
  const url = backendUrlInput.value.trim();
  if (url) {
    backendUrl = url;
    chrome.storage.local.set({ backendUrl: url }, () => {
      showStatus('Settings saved!', 'success', 2000);
    });
  }
}

// Resume storage
function saveResumeToStorage(resume) {
  chrome.storage.local.get(['savedResumes'], (data) => {
    const saved = data.savedResumes || [];
    // Keep only last 3 resumes
    saved.unshift(resume);
    const limited = saved.slice(0, 3);
    
    chrome.storage.local.set({ savedResumes: limited }, () => {
      populateSavedResumes(limited);
      savedResumesDiv.style.display = 'block';
    });
  });
}

function populateSavedResumes(resumes) {
  savedResumeSelect.innerHTML = '<option value="">-- Select saved resume --</option>';
  resumes.forEach((resume, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${resume.name} (${new Date(resume.uploadedAt).toLocaleDateString()})`;
    savedResumeSelect.appendChild(option);
  });
}

function useSavedResume() {
  const index = savedResumeSelect.value;
  if (index === '') return;

  chrome.storage.local.get(['savedResumes'], (data) => {
    const resume = data.savedResumes[index];
    if (resume) {
      currentResume = resume;
      resumeStatus.textContent = `✓ ${resume.name} (saved)`;
      resumeStatus.classList.add('success');
      validateForm();
    }
  });
}

function deleteSavedResume() {
  const index = savedResumeSelect.value;
  if (index === '') return;

  chrome.storage.local.get(['savedResumes'], (data) => {
    const resumes = data.savedResumes || [];
    resumes.splice(index, 1);
    
    chrome.storage.local.set({ savedResumes: resumes }, () => {
      if (resumes.length > 0) {
        populateSavedResumes(resumes);
      } else {
        savedResumesDiv.style.display = 'none';
      }
      showStatus('Resume deleted', 'success', 2000);
    });
  });
}

// Validation
function validateForm() {
  const isValid = questionInput.value.trim() && 
                  companyInput.value.trim() && 
                  currentResume;
  generateBtn.disabled = !isValid;
}

// Utilities
function showStatus(message, type, duration = 0) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  if (duration > 0) {
    setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, duration);
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
