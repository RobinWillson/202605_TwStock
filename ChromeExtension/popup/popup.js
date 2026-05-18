// TwStock Extension - Main Popup Controller

document.addEventListener('DOMContentLoaded', function () {
  console.log("TwStock Popup DOM Content Loaded");
  addEventListeners();
  setupAccordionBehavior();
});

/**
 * Ensures mutual exclusivity on accordions while allowing the active one to be fully toggled shut.
 */
function setupAccordionBehavior() {
  const toggles = document.querySelectorAll('.accordion-toggle');
  toggles.forEach(toggle => {
    toggle.addEventListener('change', function () {
      if (this.checked) {
        // Close all other accordions
        toggles.forEach(other => {
          if (other !== this) {
            other.checked = false;
          }
        });
      }
    });
  });
}

function addEventListeners() {
  // Project 1: TradeHistory
  document.getElementById('btn-fetch-HN-history').addEventListener('click', (e) => {
    e.stopPropagation();
    handleScriptExecution("02_TradeHistory", "Fetch HN History");
  });


  // Project 2: BasicData
  document.getElementById('btn-fetch-basic').addEventListener('click', (e) => {
    e.stopPropagation();
    handleScriptExecution("project_2", "Fetch Basic");
  });
  document.getElementById('btn-save-basic').addEventListener('click', (e) => {
    e.stopPropagation();
    handleScriptExecution("project_2", "Save Basic");
  });

  // Project 3: DailyData
  document.getElementById('btn-fetch-daily').addEventListener('click', (e) => {
    e.stopPropagation();
    handleScriptExecution("project_3", "Fetch Daily");
  });
  document.getElementById('btn-save-daily').addEventListener('click', (e) => {
    e.stopPropagation();
    handleScriptExecution("project_3", "Save Daily");
  });
}

/**
 * Handles executing the requested background project script on the active tab context
 * @param {string} projectId The project directory (e.g. "project_1")
 * @param {string} actionName The clicked action name
 */
async function handleScriptExecution(projectId, actionName) {
  displayStatus(`Triggering ${actionName}...`);

  // Show premium loading spinner
  if (window.HoldOn) {
    HoldOn.open({
      theme: 'sk-rect',
      message: `Running ${actionName}...`,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      textColor: "#ffffff"
    });
  }

  try {
    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error("No active tab found.");
    }

    console.log(`Executing /background/${projectId}/background.js on tab: ${tab.id}`);

    // Store action in local storage for background script to read
    await chrome.storage.local.set({ currentAction: actionName });

    // 2. Build files to inject (safely resolve local credentials)
    const filesToInject = [];
    if (projectId === "02_TradeHistory") {
      filesToInject.push(`/background/${projectId}/config.js`);
    }
    filesToInject.push(`/background/${projectId}/background.js`);

    // 3. Inject scripts
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: filesToInject
    });

    // Simulate completion delay for loading display feel
    await new Promise(resolve => setTimeout(resolve, 800));

    displayStatus(`Successfully executed ${actionName}!`);
  } catch (error) {
    console.error("Execution error: ", error);
    displayStatus(`Error: ${error.message}`);
  } finally {
    if (window.HoldOn) {
      HoldOn.close();
    }
  }
}

/**
 * Displays user message inside the toast-alert style status block
 * @param {string} msg 
 */
function displayStatus(msg) {
  const panel = document.getElementById('statusMsgPanel');
  const textEl = document.getElementById('statusMsg');

  if (panel && textEl) {
    textEl.textContent = msg;
    panel.classList.remove('hidden');
  }
}
