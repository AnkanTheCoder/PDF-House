// State store for uploaded files
let fileQueue = [];

// DOM Element References
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const workspace = document.getElementById('workspace');
const fileList = document.getElementById('file-list');
const fileCountEl = document.getElementById('file-count');
const clearAllBtn = document.getElementById('clear-all');
const mergeBtn = document.getElementById('merge-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const outputFilenameInput = document.getElementById('output-filename');

// Trigger file input click
dropZone.addEventListener('click', () => fileInput.click());

// Drag and drop listeners
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50/50');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
  });
});

dropZone.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  handleFiles(files);
  fileInput.value = ''; // Reset input selection
});

// Process uploaded files and parse page counts
async function handleFiles(files) {
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      fileQueue.push({
        id: crypto.randomUUID(),
        file,
        bytes: arrayBuffer,
        pageCount
      });
    } catch (err) {
      alert(`Could not load "${file.name}". It may be encrypted or corrupted.`);
    }
  }
  renderUI();
}

// Render queue list and controls
function renderUI() {
  if (fileQueue.length === 0) {
    workspace.classList.add('hidden');
    return;
  }

  workspace.classList.remove('hidden');
  fileCountEl.textContent = fileQueue.length;
  fileList.innerHTML = '';

  fileQueue.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm';

    li.innerHTML = `
      <div class="flex items-center space-x-3 truncate">
        <div class="p-2 bg-indigo-100 text-indigo-600 rounded-md">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="truncate">
          <p class="font-medium text-slate-800 truncate">${escapeHtml(item.file.name)}</p>
          <p class="text-xs text-slate-400">${formatFileSize(item.file.size)} • ${item.pageCount} page${item.pageCount > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div class="flex items-center space-x-1">
        <button onclick="moveItem(${index}, -1)" ${index === 0 ? 'disabled class="opacity-30 cursor-not-allowed p-1"' : 'class="hover:bg-slate-200 p-1 rounded transition"'}>
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button onclick="moveItem(${index}, 1)" ${index === fileQueue.length - 1 ? 'disabled class="opacity-30 cursor-not-allowed p-1"' : 'class="hover:bg-slate-200 p-1 rounded transition"'}>
          <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button onclick="removeItem('${item.id}')" class="hover:bg-red-100 p-1 rounded text-red-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    `;

    fileList.appendChild(li);
  });
}

// Queue Manipulations
window.moveItem = (index, direction) => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= fileQueue.length) return;
  const temp = fileQueue[index];
  fileQueue[index] = fileQueue[targetIndex];
  fileQueue[targetIndex] = temp;
  renderUI();
};

window.removeItem = (id) => {
  fileQueue = fileQueue.filter(item => item.id !== id);
  renderUI();
};

clearAllBtn.addEventListener('click', () => {
  fileQueue = [];
  renderUI();
});

// PDF Merging Functionality
mergeBtn.addEventListener('click', async () => {
  if (fileQueue.length === 0) return;

  setLoading(true);

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (const item of fileQueue) {
      const srcDoc = await PDFLib.PDFDocument.load(item.bytes);
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    
    // Trigger download via Blob
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    let filename = outputFilenameInput.value.trim() || 'merged-document';
    if (!filename.endsWith('.pdf')) filename += '.pdf';

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert('An error occurred while merging the PDF files.');
  } finally {
    setLoading(false);
  }
});

// Utility Helpers
function setLoading(isLoading) {
  mergeBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Merging...';
    btnSpinner.classList.remove('hidden');
  } else {
    btnText.textContent = 'Merge & Download PDF';
    btnSpinner.classList.add('hidden');
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
