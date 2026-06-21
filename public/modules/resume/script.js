const startBtn = document.getElementById('startBtn');
const chatSection = document.getElementById('chatSection');
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const welcomeSection = document.querySelector('.welcome');

let currentSession = null;

// Helper: Append a message to the chat
function appendMessage(sender, text, isHtml = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (isHtml) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }
  
  msgDiv.appendChild(bubble);
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Helper: Show quick replies
function showQuickReplies(replies) {
  if (!replies || replies.length === 0) return;
  const container = document.createElement('div');
  container.className = 'quick-replies';
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '0.5rem';
  container.style.margin = '0.5rem 0';
  
  replies.forEach(reply => {
    const btn = document.createElement('button');
    btn.className = 'secondary-btn';
    btn.textContent = reply;
    btn.onclick = () => {
      userInput.value = reply;
      sendMessage();
    };
    container.appendChild(btn);
  });
  
  messagesDiv.appendChild(container);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Start Session
startBtn.addEventListener('click', async () => {
  welcomeSection.classList.add('hidden');
  chatSection.classList.remove('hidden');
  
  try {
    // Attempt to start a session. We'll use a placeholder API call or mock it if no auth yet.
    // Assuming the user is logged in and cookie is sent.
    const res = await fetch('/api/learner/resume-builder/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      currentSession = data.session;
      
      // Auto-send the first trigger to get Panda's welcome
      sendMessage('', true);
    } else {
      appendMessage('panda', 'Oops! Please log in first to build your resume.');
    }
  } catch (e) {
    console.error(e);
    appendMessage('panda', 'Something went wrong starting your session.');
  }
});

// Send Message
async function sendMessage(overrideText = null, isInitial = false) {
  const text = overrideText !== null ? overrideText : userInput.value.trim();
  if (!text && !isInitial) return;
  
  if (!isInitial) {
    appendMessage('user', text);
    userInput.value = '';
    
    // Remove old quick replies
    const oldReplies = document.querySelectorAll('.quick-replies');
    oldReplies.forEach(r => r.remove());
  }

  try {
    const res = await fetch('/api/learner/resume-builder/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: text })
    });
    
    if (res.ok) {
      const data = await res.json();
      appendMessage('panda', data.reply);
      showQuickReplies(data.quickReplies);
      
      if (data.next_step === 'preview' || data.next_step === 'final') {
        showPreview(data.draft);
      }
    } else {
      appendMessage('panda', 'Sorry, I had trouble understanding that.');
    }
  } catch (e) {
    console.error(e);
    appendMessage('panda', 'Network error. Let’s try again.');
  }
}

sendBtn.addEventListener('click', () => sendMessage());
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Show Preview / Save UI
function showPreview(draft) {
  // Simple representation for now
  const previewHtml = `
    <div style="background: white; padding: 1rem; border-radius: 8px; margin-top: 1rem; color: #333;">
      <h3>Resume Preview</h3>
      <p><strong>Name:</strong> ${draft.personal_name || 'N/A'}</p>
      <p><strong>Target Role:</strong> ${draft.target_role || 'N/A'}</p>
      <p><strong>Skills:</strong> ${draft.skills || 'N/A'}</p>
      <p><strong>Experience:</strong> ${draft.experience_details || 'N/A'}</p>
      <p><strong>Education:</strong> ${draft.education || 'N/A'}</p>
      <hr style="margin: 1rem 0;" />
      <button id="saveResumeBtn" class="primary-btn">Save Resume</button>
      <button id="downloadPdfBtn" class="secondary-btn" style="display:none;">Download PDF</button>
    </div>
  `;
  appendMessage('panda', previewHtml, true);
  
  document.getElementById('saveResumeBtn').addEventListener('click', async () => {
    // Call save API
    const saveRes = await fetch('/api/learner/resume-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draft.target_role ? `${draft.target_role} Resume` : 'My Resume',
        target_role: draft.target_role,
        template_key: 'simple',
        resume_data: draft
      })
    });
    
    if (saveRes.ok) {
      const savedData = await saveRes.json();
      alert('Resume saved!');
      const downloadBtn = document.getElementById('downloadPdfBtn');
      downloadBtn.style.display = 'inline-block';
      downloadBtn.onclick = () => {
        window.location.href = `/api/learner/resume-builder/${savedData.resumeId}/pdf?template=simple`;
      };
    }
  });
}
