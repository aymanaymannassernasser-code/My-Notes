const SUPABASE_URL = 'https://xttgzogmvtamcmjkjwrt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dGd6b2dtdnRhbWNtamtqd3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTYyMDUsImV4cCI6MjA4NzQ3MjIwNX0.v3X2I5yhUJCwINanvO0ksXNwsbjypKiQxx8n-jBeRAQ';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTopicId = null;

// Initial Load
async function init() {
    const { data: notes } = await supabase.from('notes').select('*');
    renderCategories(notes || []);
}

function renderCategories(notes) {
    const list = document.getElementById('categoryList');
    list.innerHTML = notes.map(n => `
        <div class="category-item" onclick="openNote('${n.topic_id}')" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <strong>${n.title}</strong>
        </div>
    `).join('');
}

async function openNote(topicId) {
    currentTopicId = topicId;
    const { data } = await supabase.from('notes').select('*').eq('topic_id', topicId).single();
    
    if (data) {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('contentArea').classList.remove('hidden');
        document.getElementById('noteContent').innerHTML = `<h2>${data.title}</h2><p>${data.content}</p>`;
        fetchFiles(topicId); // Load files for this topic
    }
}

// FILE VAULT LOGIC
const fileSelector = document.getElementById('fileSelector');
const uploadBtn = document.getElementById('uploadBtn');

fileSelector.addEventListener('change', () => {
    if(fileSelector.files[0]) {
        document.getElementById('selectedFileName').innerText = fileSelector.files[0].name;
        uploadBtn.disabled = false;
    }
});

uploadBtn.addEventListener('click', async () => {
    const file = fileSelector.files[0];
    const path = `${currentTopicId}/${file.name}`;
    
    uploadBtn.innerText = "Uploading...";
    const { data, error } = await supabase.storage.from('knowledge-vault').upload(path, file);
    
    if (error) alert("Error: " + error.message);
    else {
        alert("Success!");
        fetchFiles(currentTopicId);
    }
    uploadBtn.innerText = "Upload to Cloud";
    uploadBtn.disabled = true;
});

async function fetchFiles(topicId) {
    const { data, error } = await supabase.storage.from('knowledge-vault').list(topicId);
    const listEl = document.getElementById('fileList');
    
    if (data) {
        listEl.innerHTML = data.map(file => {
            const ext = file.name.split('.').pop();
            return `
                <li class="file-item ext-${ext}">
                    <span>${file.name}</span>
                    <button class="btn-ui" onclick="downloadFile('${file.name}')">Download</button>
                </li>
            `;
        }).join('');
    }
}

async function downloadFile(fileName) {
    const { data } = await supabase.storage.from('knowledge-vault').download(`${currentTopicId}/${fileName}`);
    if (data) {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
    }
}

function closeNote() {
    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('contentArea').classList.add('hidden');
}

window.onload = init;