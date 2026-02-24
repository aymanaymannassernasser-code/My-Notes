// --- v1.8 CONFIGURATION ---
const SUPABASE_URL = 'https://xttgzogmvtamcmjkjwrt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dGd6b2dtdnRhbWNtamtqd3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYyMDUsImV4cCI6MjA4NzQ3MjIwNX0.v3X2I5yhUJCwINanvO0ksXNwsbjypKiQxx8n-jBeRAQ';

// Create the Supabase Client (named 'db' to prevent collisions)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTopicId = null;

// --- INITIALIZATION ---
async function init() {
    const listEl = document.getElementById('categoryList');
    
    // Fetch notes from Supabase
    const { data: notes, error } = await db.from('notes').select('*');
    
    if (error) {
        listEl.innerHTML = `<div style="padding:15px; color:red;">Database Error: ${error.message}</div>`;
        return;
    }

    if (notes && notes.length > 0) {
        renderCategories(notes);
    } else {
        listEl.innerHTML = `
            <div style="padding:15px;">
                <strong>No notes found.</strong><br>
                Please go to your Supabase Dashboard, open the "notes" table, and insert a row manually to get started.
            </div>`;
    }
}

function renderCategories(notes) {
    const list = document.getElementById('categoryList');
    list.innerHTML = notes.map(n => `
        <div class="category-item" onclick="openNote('${n.topic_id}')">
            <strong>${n.title}</strong><br>
            <small style="color: #888;">${n.category || 'Uncategorized'}</small>
        </div>
    `).join('');
}

// --- OPEN A NOTE ---
async function openNote(topicId) {
    currentTopicId = topicId;
    
    // Fetch the specific note content
    const { data } = await db.from('notes').select('*').eq('topic_id', topicId).single();
    
    if (data) {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('contentArea').classList.remove('hidden');
        document.getElementById('noteContent').innerHTML = `<h2>${data.title}</h2><div>${data.content || 'No content yet.'}</div>`;
        
        // As soon as the note opens, fetch any files attached to it
        fetchFiles(topicId); 
    }
}

function closeNote() {
    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('contentArea').classList.add('hidden');
    currentTopicId = null;
}

// --- FILE VAULT LOGIC (UPLOAD & DOWNLOAD) ---

const fileSelector = document.getElementById('fileSelector');
const uploadBtn = document.getElementById('uploadBtn');
const fileNameDisplay = document.getElementById('selectedFileName');

// 1. User selects a file
fileSelector.addEventListener('change', () => {
    if(fileSelector.files[0]) {
        fileNameDisplay.innerText = fileSelector.files[0].name;
        uploadBtn.disabled = false; // Enable the upload button
    }
});

// 2. User clicks "Upload to Cloud" (v1.8.1 Patch)
uploadBtn.addEventListener('click', async () => {
    const file = fileSelector.files[0];
    if (!file || !currentTopicId) return;

    // --- THE FIX: Clean the file name ---
    // Remove spaces and parentheses which cause "Invalid Key" errors in cloud storage
    let safeFileName = file.name.replace(/\s+/g, '_').replace(/[()]/g, '');
    
    // We store files in a folder named after the topic_id
    const path = `${currentTopicId}/${safeFileName}`;
    
    uploadBtn.innerText = "Uploading...";
    uploadBtn.disabled = true;

    // Send file to Supabase Bucket named 'knowledge-vault'
    const { data, error } = await db.storage.from('knowledge-vault').upload(path, file, {
        upsert: true // Overwrites if the file already exists
    });
    
    if (error) {
        alert("Upload Error: " + error.message);
    } else {
        alert("Success! File saved to cloud.");
        fileNameDisplay.innerText = "No file chosen";
        fileSelector.value = ""; // Clear input
        fetchFiles(currentTopicId); // Refresh the list so the new file shows up
    }
    
    uploadBtn.innerText = "2. Upload to Cloud";
    uploadBtn.disabled = false; // Re-enable for the next upload
});

// 3. App checks for files in the cloud
async function fetchFiles(topicId) {
    const listEl = document.getElementById('fileList');
    listEl.innerHTML = "<li>Loading files...</li>";

    // Ask Supabase for all files in this topic's folder
    const { data, error } = await db.storage.from('knowledge-vault').list(topicId);
    
    if (error) {
        listEl.innerHTML = `<li style="color:red;">Error loading files: ${error.message}</li>`;
        return;
    }

    // Remove empty placeholder files Supabase sometimes creates
    const validFiles = data.filter(file => file.name !== '.emptyFolderPlaceholder');

    if (validFiles.length === 0) {
        listEl.innerHTML = "<li>No files uploaded for this topic yet.</li>";
        return;
    }

    // Build the UI list with Download Buttons
    listEl.innerHTML = validFiles.map(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return `
            <li class="file-item ext-${ext}">
                <span>${file.name}</span>
                <button class="btn-ui" onclick="downloadFile('${file.name}')">📥 Download</button>
            </li>
        `;
    }).join('');
}

// 4. User clicks "Download"
async function downloadFile(fileName) {
    const path = `${currentTopicId}/${fileName}`;
    
    // Ask Supabase for the secure download link
    const { data, error } = await db.storage.from('knowledge-vault').download(path);
    
    if (error) {
        alert("Download failed: " + error.message);
        return;
    }

    if (data) {
        // Create a temporary link in the browser and click it automatically
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

// Start the app
window.onload = init;