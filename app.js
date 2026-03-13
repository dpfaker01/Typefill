// TypeFill Pro v6.0.0
const APP_VERSION='6.0.0 Pro';
const DB_NAME='TypeFillDB';
const DB_VERSION=5;
const STORE_TEMPLATES='templates';
const STORE_FOLDERS='folders';
const STORE_SETTINGS='settings';
let db=null;
let deferredPrompt=null;

// State object with editor lock state
const state={templates:[],folders:[],currentTemplateId:null,currentVariables:[],currentChoices:[],currentMaskedVariables:[],currentHashtags:[],darkMode:false,isPro:true,editorLocked:false};
let editingChoiceId=null;
let tempChoicesList=[];
let privacySelectedText='';
let varContainer=null;
let templateList=null;

// Prevent zoom
(function preventZoom(){
    let lastTouchEnd=0;
    document.addEventListener('touchend',function(e){const now=Date.now();if(now-lastTouchEnd<=300){e.preventDefault()}lastTouchEnd=now},{passive:false});
    document.addEventListener('touchmove',function(e){if(e.touches.length>1){e.preventDefault()}},{passive:false});
    document.addEventListener('touchstart',function(e){if(e.touches.length>1){e.preventDefault()}},{passive:false});
})();

// Database functions
async function initDatabase(){
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open(DB_NAME,DB_VERSION);
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{db=request.result;resolve(db)};
        request.onupgradeneeded=(event)=>{
            const database=event.target.result;
            if(!database.objectStoreNames.contains(STORE_TEMPLATES))database.createObjectStore(STORE_TEMPLATES,{keyPath:'id'});
            if(!database.objectStoreNames.contains(STORE_FOLDERS))database.createObjectStore(STORE_FOLDERS,{keyPath:'id'});
            if(!database.objectStoreNames.contains(STORE_SETTINGS))database.createObjectStore(STORE_SETTINGS,{keyPath:'key'});
        };
    });
}

const DataLayer={
    async saveTemplates(templates){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_TEMPLATES],'readwrite');const store=transaction.objectStore(STORE_TEMPLATES);store.clear();templates.forEach(t=>store.put(t));transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)})},
    async getTemplates(){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_TEMPLATES],'readonly');const store=transaction.objectStore(STORE_TEMPLATES);const request=store.getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})},
    async saveFolders(folders){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_FOLDERS],'readwrite');const store=transaction.objectStore(STORE_FOLDERS);store.clear();folders.forEach(f=>store.put(f));transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)})},
    async getFolders(){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_FOLDERS],'readonly');const store=transaction.objectStore(STORE_FOLDERS);const request=store.getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})},
    async saveSetting(key,value){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_SETTINGS],'readwrite');const store=transaction.objectStore(STORE_SETTINGS);store.put({key,value});transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)})},
    async getSetting(key){if(!db)await initDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction([STORE_SETTINGS],'readonly');const store=transaction.objectStore(STORE_SETTINGS);const request=store.get(key);request.onsuccess=()=>resolve(request.result?.value);request.onerror=()=>reject(request.error)})}
};

// Utility functions
function escapeHtml(text){if(!text)return'';const div=document.createElement('div');div.textContent=text;return div.innerHTML}

function customConfirm(message){
    return new Promise((resolve)=>{
        const overlay=document.createElement('div');
        overlay.className='custom-dialog-overlay';
        overlay.innerHTML=`<div class="custom-dialog-box"><div class="custom-dialog-header"><h3>Confirm</h3></div><div class="custom-dialog-message"><p>${escapeHtml(message)}</p></div><div class="custom-dialog-buttons"><button class="custom-dialog-btn custom-dialog-btn-cancel">Cancel</button><button class="custom-dialog-btn custom-dialog-btn-ok">OK</button></div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.custom-dialog-btn-cancel').onclick=()=>{overlay.remove();resolve(false)};
        overlay.querySelector('.custom-dialog-btn-ok').onclick=()=>{overlay.remove();resolve(true)};
    });
}

function customPrompt(message,defaultValue=''){
    return new Promise((resolve)=>{
        const overlay=document.createElement('div');
        overlay.className='custom-dialog-overlay';
        overlay.innerHTML=`<div class="custom-dialog-box"><div class="custom-dialog-header"><h3>Input</h3></div><div class="custom-dialog-message"><p>${escapeHtml(message)}</p></div><div class="custom-dialog-input-area"><input type="text" class="custom-dialog-input" value="${escapeHtml(defaultValue)}" placeholder="Enter value..."></div><div class="custom-dialog-buttons"><button class="custom-dialog-btn custom-dialog-btn-cancel">Cancel</button><button class="custom-dialog-btn custom-dialog-btn-ok">OK</button></div></div>`;
        document.body.appendChild(overlay);
        const input=overlay.querySelector('.custom-dialog-input');
        setTimeout(()=>input.focus(),100);
        overlay.querySelector('.custom-dialog-btn-cancel').onclick=()=>{overlay.remove();resolve(null)};
        overlay.querySelector('.custom-dialog-btn-ok').onclick=()=>{overlay.remove();resolve(input.value)};
        input.onkeydown=(e)=>{if(e.key==='Enter'){overlay.remove();resolve(input.value)}};
    });
}

// ===== FEATURE 1: Editor Lock/Unlock Mechanism =====
window.toggleEditorLock=function(){
    state.editorLocked=!state.editorLocked;
    const editor=document.getElementById('editor');
    const lockIcon=document.getElementById('lockIcon');
    const unlockIcon=document.getElementById('unlockIcon');
    const lockStatus=document.getElementById('lockStatusIndicator');
    
    if(state.editorLocked){
        // Lock the editor
        editor.contentEditable='false';
        editor.classList.add('editor-locked');
        lockIcon.classList.add('hidden');
        unlockIcon.classList.remove('hidden');
        lockStatus.classList.remove('hidden');
        // Hide action buttons
        document.querySelectorAll('.action-btn').forEach(btn=>btn.classList.add('action-btn-hidden'));
        showToast('Editor locked - Tokens still interactive');
    }else{
        // Unlock the editor
        editor.contentEditable='true';
        editor.classList.remove('editor-locked');
        lockIcon.classList.remove('hidden');
        unlockIcon.classList.add('hidden');
        lockStatus.classList.add('hidden');
        // Show action buttons
        document.querySelectorAll('.action-btn').forEach(btn=>btn.classList.remove('action-btn-hidden'));
        showToast('Editor unlocked');
    }
};

// ===== FEATURE 2: Quick Action Buttons =====
window.clearEditorText=async function(){
    const confirmed=await customConfirm('Clear all text from editor?');
    if(!confirmed)return;
    const editor=document.getElementById('editor');
    if(editor)editor.innerHTML='';
    state.currentVariables=[];
    state.currentChoices=[];
    state.currentMaskedVariables=[];
    state.currentHashtags=[];
    renderSidebar();
    renderHashtags();
    showToast('Editor cleared');
};

window.pasteEditorText=async function(){
    try{
        const text=await navigator.clipboard.readText();
        const editor=document.getElementById('editor');
        if(editor&&text){
            // Insert at cursor position or append
            const selection=window.getSelection();
            if(selection.rangeCount>0){
                const range=selection.getRangeAt(0);
                if(editor.contains(range.commonAncestorContainer)){
                    range.deleteContents();
                    range.insertNode(document.createTextNode(text));
                }else{
                    editor.textContent+=text;
                }
            }else{
                editor.textContent+=text;
            }
            showToast('Text pasted');
        }
    }catch(err){
        showToast('Paste failed - Check clipboard permissions');
    }
};

window.clearVariableInput=function(varId){
    const input=document.querySelector(`input[data-var-id="${varId}"]`);
    if(input){
        input.value='';
        updateVariable(varId,'');
        showToast('Variable cleared');
    }
};

window.pasteVariableInput=async function(varId){
    try{
        const text=await navigator.clipboard.readText();
        const input=document.querySelector(`input[data-var-id="${varId}"]`);
        if(input&&text){
            input.value=text;
            updateVariable(varId,text);
            showToast('Pasted');
        }
    }catch(err){
        showToast('Paste failed');
    }
};

// ===== FEATURE 3: Folder Sorting =====
window.sortFoldersAZ=async function(){
    state.folders.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    await persistState();
    renderTemplateList();
    showToast('Folders sorted A-Z');
};

window.sortFoldersZA=async function(){
    state.folders.sort((a,b)=>(b.name||'').localeCompare(a.name||''));
    await persistState();
    renderTemplateList();
    showToast('Folders sorted Z-A');
};

// ===== FEATURE 4: Sub-Folders Implementation =====
window.createSubFolder=async function(parentId){
    const name=await customPrompt('Enter sub-folder name:');
    if(!name)return;
    state.folders.push({
        id:'folder_'+Date.now(),
        name:name,
        parentId:parentId,
        createdAt:Date.now()
    });
    await persistState();
    renderTemplateList();
    showToast(`Sub-folder "${name}" created`);
};

// Helper to get root folders (no parent)
function getRootFolders(){
    return state.folders.filter(f=>!f.parentId);
}

// Helper to get child folders
function getChildFolders(parentId){
    return state.folders.filter(f=>f.parentId===parentId);
}

// Recursive folder rendering
function renderFolderRecursive(folder,depth=0){
    const folderTemplates=state.templates.filter(t=>t.folderId===folder.id);
    const childFolders=getChildFolders(folder.id);
    
    // Only render if has templates or child folders
    if(folderTemplates.length===0&&childFolders.length===0)return null;
    
    const details=document.createElement('details');
    details.className="group mb-2";
    details.dataset.folderId=folder.id;
    
    const summary=document.createElement('summary');
    summary.className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider p-2 hover:bg-slate-100 rounded cursor-pointer select-none dark:text-gray-400 dark:hover:bg-slate-800";
    
    const indentStyle=depth>0?`margin-left: ${depth * 12}px;`:'';
    
    summary.innerHTML=`
        <div class="flex items-center gap-2" style="${indentStyle}">
            <svg class="arrow w-3 h-3 text-gray-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            <span>${escapeHtml(folder.name)} <span class="text-gray-300 font-normal">(${folderTemplates.length})</span></span>
        </div>
        <div class="folder-actions flex gap-1">
            <button onclick="createSubFolder('${folder.id}',event)" class="text-gray-400 hover:text-indigo-500 p-1" title="Create sub-folder">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            </button>
            <button onclick="deleteFolder('${folder.id}',event)" class="text-gray-400 hover:text-red-500 p-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>`;
    
    const listDiv=document.createElement('div');
    listDiv.className=depth>0?"subfolder pl-2 border-l border-slate-200 ml-3 mt-1 space-y-1 dark:border-slate-700":"pl-2 border-l border-slate-200 ml-3 mt-1 space-y-1 dark:border-slate-700";
    
    // Add templates in this folder
    folderTemplates.forEach(t=>listDiv.appendChild(createTemplateItem(t)));
    
    // Recursively add child folders
    childFolders.forEach(childFolder=>{
        const childElement=renderFolderRecursive(childFolder,depth+1);
        if(childElement)listDiv.appendChild(childElement);
    });
    
    details.appendChild(summary);
    details.appendChild(listDiv);
    return details;
}

// Render template list with sub-folder support
function renderTemplateList(){
    if(!templateList)return;
    templateList.innerHTML='';
    
    const foldersWithTemplates=state.folders.filter(f=>state.templates.some(t=>t.folderId===f.id));
    if(foldersWithTemplates.length>0){
        document.getElementById('closeAllFoldersContainer')?.classList.remove('hidden');
    }else{
        document.getElementById('closeAllFoldersContainer')?.classList.add('hidden');
    }
    
    // Render root folders recursively
    const rootFolders=getRootFolders();
    rootFolders.forEach(folder=>{
        const folderElement=renderFolderRecursive(folder);
        if(folderElement)templateList.appendChild(folderElement);
    });
    
    // Uncategorized templates
    const uncategorized=state.templates.filter(t=>!t.folderId);
    if(uncategorized.length>0){
        const div=document.createElement('div');
        div.innerHTML='<div class="px-2 py-1 mt-2 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Uncategorized</div>';
        const listDiv=document.createElement('div');
        listDiv.className="space-y-1";
        uncategorized.forEach(t=>listDiv.appendChild(createTemplateItem(t)));
        div.appendChild(listDiv);
        templateList.appendChild(div);
    }
    
    if(state.templates.length===0){
        templateList.innerHTML='<div class="text-center mt-8 text-gray-400 dark:text-gray-500 p-4"><p class="text-sm mb-2">No templates yet</p><p class="text-xs opacity-75">Create your first template</p></div>';
    }
}

// Create template item
function createTemplateItem(t){
    const isActive=state.currentTemplateId===t.id;
    const div=document.createElement('div');
    div.className=`group flex justify-between items-center p-2 rounded cursor-pointer transition select-none touch-btn ${isActive?'bg-indigo-100 text-indigo-900 border border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800':'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300'}`;
    div.onclick=()=>{loadTemplateUI(t.id);if(window.innerWidth<768)toggleSidebar()};
    
    const varCount=t.variables?.length||0;
    const choiceCount=t.choices?.length||0;
    const maskedCount=t.maskedVariables?.length||0;
    let countsHtml='';
    if(varCount>0||choiceCount>0||maskedCount>0){
        countsHtml='<div class="flex gap-1 mt-1">';
        if(varCount>0)countsHtml+=`<span class="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded dark:bg-emerald-900 dark:text-emerald-300">${varCount} var</span>`;
        if(choiceCount>0)countsHtml+=`<span class="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded dark:bg-amber-900 dark:text-amber-300">${choiceCount} choice</span>`;
        if(maskedCount>0)countsHtml+=`<span class="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300" title="Privacy masked fields">🔒 ${maskedCount}</span>`;
        countsHtml+='</div>';
    }
    
    let hashtagsHtml='';
    if(t.hashtags&&t.hashtags.length>0){
        const displayTags=t.hashtags.slice(0,2);
        hashtagsHtml=`<div class="flex gap-1 mt-1">${displayTags.map(tag=>`<span class="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded dark:bg-indigo-900 dark:text-indigo-300">#${tag}</span>`).join('')}${t.hashtags.length>2?`<span class="text-xs text-gray-400">+${t.hashtags.length-2}</span>`:''}</div>`;
    }
    
    div.innerHTML=`<div class="flex-1 min-w-0"><span class="truncate text-sm font-medium block">${escapeHtml(t.name)}</span>${countsHtml}${hashtagsHtml}</div><div class="flex items-center gap-1 opacity-0 group-hover:opacity-100"><button onclick="moveTemplate('${t.id}',event)" class="text-gray-400 hover:text-indigo-600 p-1 touch-btn" title="Move to folder"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg></button><button onclick="removeTemplate('${t.id}',event)" class="text-gray-400 hover:text-red-500 p-1 touch-btn" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>`;
    return div;
}

// Initialize
document.addEventListener('DOMContentLoaded',async()=>{
    varContainer=document.getElementById('variablesContainer');
    templateList=document.getElementById('templateList');
    try{
        await initDatabase();
        await loadStateFromStorage();
        await loadTheme();
        const editor=document.getElementById('editor');
        if(state.templates.length===0){
            if(editor)editor.innerHTML=`Welcome to TypeFill!
Add hashtags below to organize your templates!`;
        }else{
            loadTemplateUI(state.templates[0].id);
        }
        renderTemplateList();
        setupInstallPrompt();
        checkForSWUpdates();
        setInterval(checkForSWUpdates,30*60*1000);
        const fileInput=document.getElementById('importFileInput');
        if(fileInput){
            fileInput.addEventListener('change',function(){handleImport(this)});
        }
        showToast('TypeFill v'+APP_VERSION+' Ready!');
    }catch(err){
        console.error('Initialization error:',err);
        showToast('Error loading app');
    }
});

// Setup install prompt
function setupInstallPrompt(){
    window.addEventListener('beforeinstallprompt',(e)=>{
        e.preventDefault();
        deferredPrompt=e;
        setTimeout(()=>{
            const banner=document.getElementById('installBanner');
            const dismissed=localStorage.getItem('installBannerDismissed');
            if(banner&&!dismissed&&!window.matchMedia('(display-mode: standalone)').matches){
                banner.classList.remove('hidden');
            }
        },3000);
    });
}

window.installPWA=async function(){
    if(deferredPrompt){
        deferredPrompt.prompt();
        const{outcome}=await deferredPrompt.userChoice;
        if(outcome==='accepted'){
            showToast('TypeFill installed!');
            document.getElementById('installBanner').classList.add('hidden');
        }
        deferredPrompt=null;
    }
};

window.dismissInstall=function(){
    document.getElementById('installBanner').classList.add('hidden');
    localStorage.setItem('installBannerDismissed','true');
};

// Theme functions
async function loadTheme(){
    try{
        const savedTheme=await DataLayer.getSetting('theme');
        if(savedTheme==='dark'||(!savedTheme&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
            enableDarkMode();
        }else{
            enableLightMode();
        }
    }catch(err){
        console.log('[TypeFill] Theme load error:',err);
    }
}

window.toggleTheme=function(){
    if(state.darkMode){
        enableLightMode();
        DataLayer.saveSetting('theme','light');
    }else{
        enableDarkMode();
        DataLayer.saveSetting('theme','dark');
    }
};

function enableDarkMode(){
    document.documentElement.classList.add('dark');
    state.darkMode=true;
    document.getElementById('sunIcon')?.classList.remove('hidden');
    document.getElementById('moonIcon')?.classList.add('hidden');
}

function enableLightMode(){
    document.documentElement.classList.remove('dark');
    state.darkMode=false;
    document.getElementById('sunIcon')?.classList.add('hidden');
    document.getElementById('moonIcon')?.classList.remove('hidden');
}

// State management
async function loadStateFromStorage(){
    try{
        const[templates,folders]=await Promise.all([DataLayer.getTemplates(),DataLayer.getFolders()]);
        state.templates=templates||[];
        state.folders=folders||[];
    }catch(err){
        console.error('[TypeFill] Storage load error:',err);
    }
}

async function persistState(){
    try{
        await Promise.all([DataLayer.saveTemplates(state.templates),DataLayer.saveFolders(state.folders)]);
        console.log('[TypeFill] State persisted');
    }catch(err){
        console.error('[TypeFill] Save error:',err);
        showToast('Failed to save data');
    }
}

// UI toggles
window.toggleSidebar=function(){
    document.getElementById('sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('open');
};

window.toggleVariablesPanel=function(){
    document.getElementById('variablesPanel')?.classList.toggle('hidden');
    document.getElementById('variablesOverlay')?.classList.toggle('open');
};

function showToast(message,duration=3000){
    const toast=document.getElementById('toast');
    if(toast){
        toast.textContent=message;
        toast.classList.add('show');
        setTimeout(()=>toast.classList.remove('show'),duration);
    }
}

window.closeAllFolders=function(){
    document.querySelectorAll('#templateList details').forEach(d=>d.open=false);
    showToast('All folders closed');
};

// Search
window.toggleSearch=function(){
    const modal=document.getElementById('searchModal');
    if(modal.classList.contains('open')){
        modal.classList.remove('open');
    }else{
        modal.classList.add('open');
        setTimeout(()=>document.getElementById('globalSearchInput')?.focus(),100);
    }
};

window.performGlobalSearch=function(query){
    const resultsContainer=document.getElementById('globalSearchResults');
    if(!query||query.trim().length===0){
        resultsContainer.innerHTML='<div class="p-8 text-center text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><p class="text-sm">Type to search all templates</p></div>';
        return;
    }
    const normalizedQuery=query.toLowerCase().trim();
    const results=[];
    state.templates.forEach(template=>{
        let matches=[];
        let matchType='';
        if(template.name&&template.name.toLowerCase().includes(normalizedQuery)){
            matches.push({field:'name',text:template.name});
            matchType='name';
        }
        if(template.hashtags&&template.hashtags.length>0){
            template.hashtags.forEach(tag=>{
                if(tag.toLowerCase().includes(normalizedQuery)){
                    matches.push({field:'hashtag',text:tag});
                    matchType='hashtag';
                }
            });
        }
        if(template.html){
            let htmlContent=template.html;
            if(template.maskedVariables&&template.maskedVariables.length>0){
                template.maskedVariables.forEach(mv=>{
                    if(mv.actualValue){
                        const escapedValue=mv.actualValue.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
                        const regex=new RegExp(escapedValue,'g');
                        htmlContent=htmlContent.replace(regex,`[${mv.label}]`);
                    }
                });
            }
            const tempDiv=document.createElement('div');
            tempDiv.innerHTML=htmlContent;
            tempDiv.querySelectorAll('.masked-token').forEach(token=>{
                const mv=template.maskedVariables?.find(m=>m.id===token.dataset.maskId);
                token.textContent=`[${mv?.label||'hidden'}]`;
            });
            const plainText=tempDiv.textContent||tempDiv.innerText;
            let isSearchingForMaskedValue=false;
            if(template.maskedVariables&&template.maskedVariables.length>0){
                template.maskedVariables.forEach(mv=>{
                    if(mv.actualValue&&mv.actualValue.toLowerCase().includes(normalizedQuery)){
                        isSearchingForMaskedValue=true;
                    }
                });
            }
            if(!isSearchingForMaskedValue&&plainText.toLowerCase().includes(normalizedQuery)){
                const index=plainText.toLowerCase().indexOf(normalizedQuery);
                const start=Math.max(0,index-40);
                const end=Math.min(plainText.length,index+query.length+40);
                matches.push({field:'content',text:(start>0?'...':'')+plainText.substring(start,end)+(end<plainText.length?'...':'')});
                if(!matchType)matchType='content';
            }
        }
        if(template.maskedVariables&&template.maskedVariables.length>0){
            template.maskedVariables.forEach(mv=>{
                if(mv.label&&mv.label.toLowerCase().includes(normalizedQuery)){
                    matches.push({field:'masked_label',text:`[${mv.label}]`});
                    if(!matchType)matchType='masked_label';
                }
            });
        }
        if(matches.length>0){
            results.push({template,matches,matchType});
        }
    });
    if(results.length===0){
        resultsContainer.innerHTML='<div class="p-8 text-center text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p class="text-sm">No results found</p></div>';
        return;
    }
    let html='';
    results.forEach(result=>{
        const{template,matches}=result;
        const folder=state.folders.find(f=>f.id===template.folderId);
        const maskedCount=template.maskedVariables?.length||0;
        html+=`<div class="search-result-item" onclick="selectSearchResult('${template.id}')"><div class="flex items-start gap-3"><div class="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg"><svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div class="flex-1 min-w-0"><div class="font-medium text-gray-900 dark:text-white truncate">${escapeHtml(template.name)}${maskedCount>0?`<span class="text-xs text-red-400 ml-2">🔒 ${maskedCount}</span>`:''}</div>${folder?`<div class="text-xs text-gray-400 mt-0.5">📁 ${escapeHtml(folder.name)}</div>`:''}</div></div></div>`;
    });
    resultsContainer.innerHTML=html;
};

window.selectSearchResult=function(templateId){
    toggleSearch();
    loadTemplateUI(templateId);
    if(window.innerWidth<768)toggleSidebar();
};

// Hashtags
window.handleHashtagInput=function(event){
    if(event.key==='Enter'||event.key===','){
        event.preventDefault();
        addHashtag(event.target.value);
        event.target.value='';
    }
};

window.addHashtag=function(tag){
    let cleanTag=tag.trim().toLowerCase().replace(/^#/,'').replace(/[^a-z0-9_-]/g,'');
    if(cleanTag.length===0||cleanTag.length>30)return;
    if(state.currentHashtags.includes(cleanTag)){
        showToast('Hashtag already exists');
        return;
    }
    state.currentHashtags.push(cleanTag);
    renderHashtags();
};

window.removeHashtag=function(tag){
    state.currentHashtags=state.currentHashtags.filter(t=>t!==tag);
    renderHashtags();
};

function renderHashtags(){
    const container=document.getElementById('templateHashtags');
    if(!container)return;
    if(state.currentHashtags.length===0){
        container.innerHTML='<span class="text-xs text-gray-400">No tags yet</span><input type="text" class="hashtag-input" placeholder="Add hashtag..." onkeydown="handleHashtagInput(event)" maxlength="30">';
        return;
    }
    container.innerHTML=state.currentHashtags.map(tag=>`<span class="hashtag" onclick="searchByHashtag('${tag}')">#${escapeHtml(tag)}<button onclick="event.stopPropagation();removeHashtag('${tag}')" class="ml-1 opacity-0 group-hover:opacity-100">x</button></span>`).join('')+'<input type="text" class="hashtag-input" placeholder="Add hashtag..." onkeydown="handleHashtagInput(event)" maxlength="30">';
}

window.searchByHashtag=function(tag){
    toggleSearch();
    document.getElementById('globalSearchInput').value=tag;
    performGlobalSearch(tag);
};

// Variables
window.makeVariableFromSelection=function(){
    const selection=window.getSelection();
    const text=selection.toString().trim();
    if(!text){
        showToast('Please highlight text first');
        return;
    }
    let parent=selection.anchorNode?.parentElement;
    const editor=document.getElementById('editor');
    while(parent&&parent!==editor){
        if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
            showToast('Text is already a variable, choice, or masked field');
            return;
        }
        parent=parent.parentElement;
    }
    createVariable(text);
    showToast('Variable created!');
};

function createVariable(selectedText){
    const varId='var_'+Date.now()+'_'+Math.floor(Math.random()*1000);
    safeGlobalReplace(selectedText,varId);
    state.currentVariables.push({id:varId,label:selectedText,value:selectedText});
    renderSidebar();
    updateActionButtons('');
}

function safeGlobalReplace(searchText,varId){
    const editor=document.getElementById('editor');
    if(!editor)return;
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,null,false);
    const nodesToReplace=[];
    while(walker.nextNode()){
        const node=walker.currentNode;
        if(node.nodeValue.includes(searchText)){
            let parent=node.parentElement,isInToken=false;
            while(parent&&parent!==editor){
                if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
                    isInToken=true;
                    break;
                }
                parent=parent.parentElement;
            }
            if(!isInToken)nodesToReplace.push(node);
        }
    }
    nodesToReplace.forEach(node=>{
        const fragment=document.createDocumentFragment();
        node.nodeValue.split(searchText).forEach((part,i)=>{
            fragment.appendChild(document.createTextNode(part));
            if(i<node.nodeValue.split(searchText).length-1){
                const span=document.createElement('span');
                span.className='token';
                span.dataset.id=varId;
                span.textContent=searchText;
                fragment.appendChild(span);
            }
        });
        if(node.parentNode)node.parentNode.replaceChild(fragment,node);
    });
}

// Choices
window.makeChoicesFromSelection=function(){
    const selection=window.getSelection();
    const text=selection.toString().trim();
    if(!text){
        showToast('Please highlight text first');
        return;
    }
    let parent=selection.anchorNode?.parentElement;
    const editor=document.getElementById('editor');
    while(parent&&parent!==editor){
        if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
            showToast('Text is already a variable, choice, or masked field');
            return;
        }
        parent=parent.parentElement;
    }
    openChoicesModal(text);
};

window.openChoicesModal=function(originalText){
    editingChoiceId='choice_'+Date.now()+'_'+Math.floor(Math.random()*1000);
    tempChoicesList=[{id:Date.now(),text:originalText,isOriginal:true}];
    document.getElementById('choicesOriginalWord').textContent=originalText;
    renderChoicesList();
    document.getElementById('choicesModal').classList.add('open');
};

window.closeChoicesModal=function(){
    document.getElementById('choicesModal').classList.remove('open');
    editingChoiceId=null;
    tempChoicesList=[];
};

window.addNewChoice=function(){
    tempChoicesList.push({id:Date.now(),text:'',isOriginal:false});
    renderChoicesList();
    setTimeout(()=>document.querySelectorAll('#choicesList input')[document.querySelectorAll('#choicesList input').length-1]?.focus(),100);
};

window.removeChoice=function(id){
    if(tempChoicesList.find(c=>c.id===id)?.isOriginal){
        showToast('Cannot remove the original option');
        return;
    }
    tempChoicesList=tempChoicesList.filter(c=>c.id!==id);
    renderChoicesList();
};

window.updateChoiceText=function(id,text){
    const choice=tempChoicesList.find(c=>c.id===id);
    if(choice)choice.text=text;
};

function renderChoicesList(){
    document.getElementById('choicesList').innerHTML=tempChoicesList.map((c,i)=>`<div class="choice-item"><span class="text-xs text-gray-400 w-6">${i+1}.</span>${c.isOriginal?'<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Original</span>':''}<input type="text" value="${escapeHtml(c.text)}" placeholder="Enter option..." oninput="updateChoiceText(${c.id},this.value)" class="dark:text-white">${!c.isOriginal?`<button onclick="removeChoice(${c.id})" class="remove-btn"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`:''}</div>`).join('');
}

window.saveChoices=function(){
    const validChoices=tempChoicesList.filter(c=>c.text.trim());
    if(validChoices.length<2){
        showToast('Add at least one more option');
        return;
    }
    const originalText=tempChoicesList.find(c=>c.isOriginal)?.text;
    createChoiceToken(originalText,validChoices.map(c=>c.text),editingChoiceId);
    state.currentChoices.push({id:editingChoiceId,original:originalText,options:validChoices.map(c=>c.text),selected:originalText});
    closeChoicesModal();
    renderSidebar();
    showToast('Choices created!');
};

function createChoiceToken(originalText,options,choiceId){
    const editor=document.getElementById('editor');
    if(!editor)return;
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,null,false);
    const nodesToReplace=[];
    while(walker.nextNode()){
        const node=walker.currentNode;
        if(node.nodeValue.includes(originalText)){
            let parent=node.parentElement,isInToken=false;
            while(parent&&parent!==editor){
                if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
                    isInToken=true;
                    break;
                }
                parent=parent.parentElement;
            }
            if(!isInToken)nodesToReplace.push(node);
        }
    }
    nodesToReplace.forEach(node=>{
        const fragment=document.createDocumentFragment();
        node.nodeValue.split(originalText).forEach((part,i)=>{
            fragment.appendChild(document.createTextNode(part));
            if(i<node.nodeValue.split(originalText).length-1){
                const span=document.createElement('span');
                span.className='choice-token';
                span.dataset.id=choiceId;
                span.dataset.options=JSON.stringify(options);
                span.textContent=originalText;
                span.addEventListener('click',(e)=>{e.stopPropagation();e.preventDefault();showChoiceDropdown(e,choiceId);});
                span.addEventListener('touchend',(e)=>{if(e.cancelable){e.preventDefault();showChoiceDropdown(e,choiceId);}},{passive:false});
                fragment.appendChild(span);
            }
        });
        if(node.parentNode)node.parentNode.replaceChild(fragment,node);
    });
}

// Choice dropdown
function showChoiceDropdown(event,choiceId){
    const choice=state.currentChoices.find(c=>c.id===choiceId);
    if(!choice)return;
    
    // Remove existing dropdown
    document.querySelectorAll('.choice-dropdown').forEach(d=>d.remove());
    
    const dropdown=document.createElement('div');
    dropdown.className='choice-dropdown';
    dropdown.innerHTML=choice.options.map(opt=>`<div class="choice-option ${opt===choice.selected?'selected':''}" onclick="selectChoiceOption('${choiceId}','${escapeHtml(opt)}')">${escapeHtml(opt)}</div>`).join('');
    
    const rect=event.target.getBoundingClientRect();
    dropdown.style.top=`${rect.bottom+window.scrollY+5}px`;
    dropdown.style.left=`${Math.min(rect.left,window.innerWidth-150)}px`;
    
    document.body.appendChild(dropdown);
    
    // Close on click outside
    setTimeout(()=>{
        document.addEventListener('click',function closeDropdown(e){
            if(!dropdown.contains(e.target)){
                dropdown.remove();
                document.removeEventListener('click',closeDropdown);
            }
        });
    },100);
}

window.selectChoiceOption=function(choiceId,option){
    const choice=state.currentChoices.find(c=>c.id===choiceId);
    if(choice){
        choice.selected=option;
        document.querySelectorAll(`.choice-token[data-id="${choiceId}"]`).forEach(t=>t.textContent=option);
    }
    document.querySelectorAll('.choice-dropdown').forEach(d=>d.remove());
};

// Privacy modal
window.openPrivacyModal=function(){
    const selection=window.getSelection();
    const text=selection.toString().trim();
    if(!text){
        showToast('Please highlight text first');
        return;
    }
    let parent=selection.anchorNode?.parentElement;
    const editor=document.getElementById('editor');
    while(parent&&parent!==editor){
        if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
            showToast('Text is already a variable, choice, or masked field');
            return;
        }
        parent=parent.parentElement;
    }
    privacySelectedText=text;
    document.getElementById('privacySelectedText').textContent=text;
    document.getElementById('privacyLabelInput').value='';
    document.getElementById('privacyModal').classList.add('open');
};

window.closePrivacyModal=function(){
    document.getElementById('privacyModal').classList.remove('open');
    privacySelectedText='';
};

window.applyPrivacyMask=function(){
    const label=document.getElementById('privacyLabelInput').value.trim()||'hidden';
    const maskId='mask_'+Date.now()+'_'+Math.floor(Math.random()*1000);
    
    createMaskedToken(privacySelectedText,maskId,label);
    state.currentMaskedVariables.push({id:maskId,label:label,actualValue:privacySelectedText});
    closePrivacyModal();
    renderSidebar();
    showToast('Privacy mask applied!');
};

function createMaskedToken(originalText,maskId,label){
    const editor=document.getElementById('editor');
    if(!editor)return;
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,null,false);
    const nodesToReplace=[];
    while(walker.nextNode()){
        const node=walker.currentNode;
        if(node.nodeValue.includes(originalText)){
            let parent=node.parentElement,isInToken=false;
            while(parent&&parent!==editor){
                if(parent.classList?.contains('token')||parent.classList?.contains('choice-token')||parent.classList?.contains('masked-token')){
                    isInToken=true;
                    break;
                }
                parent=parent.parentElement;
            }
            if(!isInToken)nodesToReplace.push(node);
        }
    }
    nodesToReplace.forEach(node=>{
        const fragment=document.createDocumentFragment();
        node.nodeValue.split(originalText).forEach((part,i)=>{
            fragment.appendChild(document.createTextNode(part));
            if(i<node.nodeValue.split(originalText).length-1){
                const span=document.createElement('span');
                span.className='masked-token';
                span.dataset.maskId=maskId;
                span.textContent=`[${label}]`;
                span.addEventListener('click',(e)=>{e.stopPropagation();copyMaskedValue(maskId);});
                span.addEventListener('touchend',(e)=>{if(e.cancelable){e.preventDefault();copyMaskedValue(maskId);}},{passive:false});
                fragment.appendChild(span);
            }
        });
        if(node.parentNode)node.parentNode.replaceChild(fragment,node);
    });
}

window.copyMaskedValue=function(maskId){
    const maskedVar=state.currentMaskedVariables.find(m=>m.id===maskId);
    if(maskedVar){
        navigator.clipboard.writeText(maskedVar.actualValue).then(()=>{
            document.querySelectorAll(`.masked-token[data-mask-id="${maskId}"]`).forEach(t=>{t.classList.add('copied');setTimeout(()=>t.classList.remove('copied'),1500);});
            showToast('Hidden value copied!');
        }).catch(()=>showToast('Copy failed'));
    }
};

window.copyMaskedValueFromSidebar=function(maskId,btn){
    const maskedVar=state.currentMaskedVariables.find(m=>m.id===maskId);
    if(maskedVar){
        navigator.clipboard.writeText(maskedVar.actualValue).then(()=>{
            btn.classList.add('copied');
            btn.textContent='Copied!';
            setTimeout(()=>{btn.classList.remove('copied');btn.textContent='Copy';},1500);
            showToast('Hidden value copied!');
        }).catch(()=>showToast('Copy failed'));
    }
};

window.deleteMaskedVariable=function(maskId){
    const maskedVar=state.currentMaskedVariables.find(m=>m.id===maskId);
    document.querySelectorAll(`.masked-token[data-mask-id="${maskId}"]`).forEach(token=>{
        const text=document.createTextNode(maskedVar?.actualValue||token.textContent);
        if(token.parentNode)token.parentNode.replaceChild(text,token);
    });
    state.currentMaskedVariables=state.currentMaskedVariables.filter(m=>m.id!==maskId);
    renderSidebar();
    showToast('Mask removed');
};

// Folder management
window.createFolder=async function(){
    const name=await customPrompt('Enter folder name:');
    if(!name)return;
    state.folders.push({id:'folder_'+Date.now(),name:name,createdAt:Date.now()});
    await persistState();
    renderTemplateList();
    showToast(`Folder "${name}" created`);
};

window.deleteFolder=async function(id,e){
    if(e)e.stopPropagation();
    const confirmed=await customConfirm('Delete folder? Templates will be uncategorized. Sub-folders will also be removed.');
    if(!confirmed)return;
    
    // Recursively delete sub-folders
    function deleteFolderRecursive(folderId){
        const childFolders=getChildFolders(folderId);
        childFolders.forEach(child=>deleteFolderRecursive(child.id));
        state.folders=state.folders.filter(f=>f.id!==folderId);
        state.templates.forEach(t=>{if(t.folderId===folderId)delete t.folderId;});
    }
    
    deleteFolderRecursive(id);
    await persistState();
    renderTemplateList();
    showToast('Folder deleted');
};

// Sidebar rendering
function renderSidebar(){
    if(!varContainer)return;
    varContainer.innerHTML='';
    
    // Masked variables section
    if(state.currentMaskedVariables.length>0){
        const maskedSection=document.createElement('div');
        maskedSection.className='masked-section';
        maskedSection.innerHTML=`<div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><span class="text-xs font-bold text-red-600 uppercase dark:text-red-400">Private Fields</span></div><span class="text-xs text-red-400">${state.currentMaskedVariables.length} masked</span></div><p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Tap to copy hidden values. Values never shown on screen.</p>`;
        state.currentMaskedVariables.forEach(m=>{
            const div=document.createElement('div');
            div.className='masked-item';
            div.innerHTML=`<svg class="lock-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><span class="label" title="${escapeHtml(m.label)}">[${escapeHtml(m.label)}]</span><button onclick="copyMaskedValueFromSidebar('${m.id}',this)" class="copy-btn">Copy</button><button onclick="deleteMaskedVariable('${m.id}')" class="text-xs text-red-400 hover:text-red-600 touch-btn p-1 ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>`;
            maskedSection.appendChild(div);
        });
        varContainer.appendChild(maskedSection);
    }
    
    // Variables section with quick action buttons
    if(state.currentVariables.length>0){
        const varSection=document.createElement('div');
        varSection.innerHTML='<div class="text-xs font-bold text-emerald-600 uppercase mb-2 dark:text-emerald-400">Variables</div>';
        state.currentVariables.forEach(v=>{
            const div=document.createElement('div');
            div.className='bg-white p-3 rounded shadow-sm border border-gray-200 mb-2 dark:bg-slate-800 dark:border-slate-700';
            div.innerHTML=`<div class="flex justify-between items-center mb-1"><label class="text-xs font-bold text-gray-500 uppercase truncate dark:text-gray-400" title="${escapeHtml(v.label)}">${escapeHtml(v.label)}</label><div class="flex items-center gap-1"><button onclick="clearVariableInput('${v.id}')" class="quick-action-btn bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-600 dark:text-gray-300" title="Clear">Clear</button><button onclick="pasteVariableInput('${v.id}')" class="quick-action-btn bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-600 dark:text-gray-300" title="Paste">Paste</button><button onclick="deleteVariable('${v.id}')" class="text-xs text-red-400 hover:text-red-600 touch-btn p-1">Unlink</button></div></div><input type="text" data-var-id="${v.id}" value="${escapeHtml(v.value)}" oninput="updateVariable('${v.id}',this.value)" class="w-full bg-emerald-50 border border-emerald-200 text-gray-800 text-sm rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200" placeholder="Replacement...">`;
            varSection.appendChild(div);
        });
        varContainer.appendChild(varSection);
    }
    
    // Choices section
    if(state.currentChoices.length>0){
        const choiceSection=document.createElement('div');
        choiceSection.innerHTML='<div class="text-xs font-bold text-amber-600 uppercase mb-2 mt-4 dark:text-amber-400">Choices</div>';
        state.currentChoices.forEach(c=>{
            const div=document.createElement('div');
            div.className='bg-amber-50 p-3 rounded shadow-sm border border-amber-200 mb-2 dark:bg-amber-900/30 dark:border-amber-800';
            div.innerHTML=`<div class="flex justify-between items-center mb-1"><label class="text-xs font-bold text-amber-700 uppercase truncate dark:text-amber-400" title="${escapeHtml(c.original)}">${escapeHtml(c.original)}</label><button onclick="deleteChoice('${c.id}')" class="text-xs text-red-400 hover:text-red-600 touch-btn p-1">Unlink</button></div><div class="flex flex-wrap gap-1 mt-1">${c.options.map(opt=>`<span class="text-xs px-2 py-1 rounded ${opt===c.selected?'bg-amber-500 text-white':'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}">${escapeHtml(opt)}</span>`).join('')}</div>`;
            choiceSection.appendChild(div);
        });
        varContainer.appendChild(choiceSection);
    }
    
    // Empty state
    if(state.currentVariables.length===0&&state.currentChoices.length===0&&state.currentMaskedVariables.length===0){
        varContainer.innerHTML='<div class="text-center mt-12 text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg><p class="text-sm">Highlight text to create</p><p class="text-xs mt-1">Variables, Choices, or Privacy Masks</p></div>';
    }
}

// Update variable
window.updateVariable=function(id,newValue){
    document.querySelectorAll(`.token[data-id="${id}"]`).forEach(t=>t.textContent=newValue);
    const v=state.currentVariables.find(x=>x.id===id);
    if(v)v.value=newValue;
};

window.deleteVariable=function(id){
    document.querySelectorAll(`.token[data-id="${id}"]`).forEach(t=>{
        if(t.parentNode)t.parentNode.replaceChild(document.createTextNode(t.textContent),t);
    });
    state.currentVariables=state.currentVariables.filter(x=>x.id!==id);
    renderSidebar();
};

window.deleteChoice=function(id){
    const choice=state.currentChoices.find(c=>c.id===id);
    document.querySelectorAll(`.choice-token[data-id="${id}"]`).forEach(t=>{
        if(t.parentNode)t.parentNode.replaceChild(document.createTextNode(choice?.original||t.textContent),t);
    });
    state.currentChoices=state.currentChoices.filter(c=>c.id!==id);
    renderSidebar();
    showToast('Choice removed');
};

// Template management
window.saveCurrentTemplate=async function(){
    let name=state.templates.find(t=>t.id===state.currentTemplateId)?.name||"New Template";
    name=await customPrompt("Template Name:",name);
    if(!name)return;
    const editor=document.getElementById('editor');
    const template={
        id:state.currentTemplateId||Date.now().toString(),
        name:name,
        html:editor?editor.innerHTML:'',
        variables:state.currentVariables,
        choices:state.currentChoices,
        maskedVariables:state.currentMaskedVariables,
        hashtags:state.currentHashtags,
        folderId:state.templates.find(t=>t.id===state.currentTemplateId)?.folderId,
        updatedAt:Date.now()
    };
    const existingIndex=state.templates.findIndex(t=>t.id===template.id);
    if(existingIndex>=0)state.templates[existingIndex]=template;
    else state.templates.push(template);
    state.currentTemplateId=template.id;
    await persistState();
    renderTemplateList();
    showToast("Saved!");
    if(window.innerWidth<768)toggleSidebar();
};

window.createNew=async function(){
    if((state.currentVariables.length>0||state.currentChoices.length>0||state.currentMaskedVariables.length>0)){
        const confirmed=await customConfirm("Discard current changes?");
        if(!confirmed)return;
    }
    state.currentTemplateId=null;
    state.currentVariables=[];
    state.currentChoices=[];
    state.currentMaskedVariables=[];
    state.currentHashtags=[];
    const editor=document.getElementById('editor');
    if(editor)editor.innerHTML='';
    // Reset lock state when creating new
    state.editorLocked=false;
    if(editor){
        editor.contentEditable='true';
        editor.classList.remove('editor-locked');
    }
    document.getElementById('lockIcon')?.classList.remove('hidden');
    document.getElementById('unlockIcon')?.classList.add('hidden');
    document.getElementById('lockStatusIndicator')?.classList.add('hidden');
    document.querySelectorAll('.action-btn').forEach(btn=>btn.classList.remove('action-btn-hidden'));
    renderSidebar();
    renderHashtags();
    renderTemplateList();
    showToast("New template started");
};

window.removeTemplate=async function(id,e){
    if(e)e.stopPropagation();
    const confirmed=await customConfirm("Delete this template?");
    if(!confirmed)return;
    state.templates=state.templates.filter(t=>t.id!==id);
    await persistState();
    if(state.currentTemplateId===id)createNew();
    else renderTemplateList();
};

// Load template UI
window.loadTemplateUI=function(id){
    const template=state.templates.find(t=>t.id===id);
    if(!template)return;
    state.currentTemplateId=id;
    state.currentVariables=JSON.parse(JSON.stringify(template.variables||[]));
    state.currentChoices=JSON.parse(JSON.stringify(template.choices||[]));
    state.currentMaskedVariables=JSON.parse(JSON.stringify(template.maskedVariables||[]));
    state.currentHashtags=JSON.parse(JSON.stringify(template.hashtags||[]));
    const editor=document.getElementById('editor');
    if(editor){
        editor.innerHTML=template.html||'';
        // Re-attach event listeners for tokens
        editor.querySelectorAll('.token').forEach(t=>{
            t.addEventListener('click',function(){const input=document.querySelector(`input[data-var-id="${t.dataset.id}"]`);if(input)input.focus();});
        });
        // Re-attach event listeners for choice tokens
        editor.querySelectorAll('.choice-token').forEach(t=>{
            t.addEventListener('click',(e)=>{e.stopPropagation();e.preventDefault();showChoiceDropdown(e,t.dataset.id);});
            t.addEventListener('touchend',(e)=>{if(e.cancelable){e.preventDefault();showChoiceDropdown(e,t.dataset.id);}},{passive:false});
        });
        // Re-attach event listeners for masked tokens
        editor.querySelectorAll('.masked-token').forEach(t=>{
            t.addEventListener('click',(e)=>{e.stopPropagation();copyMaskedValue(t.dataset.maskId);});
            t.addEventListener('touchend',(e)=>{if(e.cancelable){e.preventDefault();copyMaskedValue(t.dataset.maskId);}},{passive:false});
        });
    }
    // Reset lock state when loading template
    state.editorLocked=false;
    if(editor){
        editor.contentEditable='true';
        editor.classList.remove('editor-locked');
    }
    document.getElementById('lockIcon')?.classList.remove('hidden');
    document.getElementById('unlockIcon')?.classList.add('hidden');
    document.getElementById('lockStatusIndicator')?.classList.add('hidden');
    document.querySelectorAll('.action-btn').forEach(btn=>btn.classList.remove('action-btn-hidden'));
    renderSidebar();
    renderHashtags();
    renderTemplateList();
};

// Move template
window.moveTemplate=async function(templateId,e){
    if(e)e.stopPropagation();
    const folderNames=state.folders.map(f=>f.name).join(' | ');
    const input=await customPrompt(`Enter folder name (${folderNames}) or leave empty for none:`);
    if(input===null)return;
    const template=state.templates.find(t=>t.id===templateId);
    if(!template)return;
    if(input.trim()===''){
        delete template.folderId;
    }else{
        let folder=state.folders.find(f=>f.name.toLowerCase()===input.toLowerCase());
        if(!folder){
            folder={id:'folder_'+Date.now(),name:input,createdAt:Date.now()};
            state.folders.push(folder);
        }
        template.folderId=folder.id;
    }
    await persistState();
    renderTemplateList();
    showToast('Template moved');
};

// Update action buttons visibility
function updateActionButtons(text){
    const varBtn=document.getElementById('makeVarBtn');
    const choiceBtn=document.getElementById('makeChoicesBtn');
    const privacyBtn=document.getElementById('applyPrivacyBtn');
    const mobileVarBtn=document.getElementById('mobileMakeVarBtn');
    const mobileChoiceBtn=document.getElementById('mobileMakeChoicesBtn');
    const mobilePrivacyBtn=document.getElementById('mobilePrivacyBtn');
    
    const shouldShow=text&&text.trim()&&!state.editorLocked;
    
    if(shouldShow){
        [varBtn,choiceBtn,privacyBtn,mobileVarBtn,mobileChoiceBtn,mobilePrivacyBtn].forEach(btn=>btn?.classList.remove('hidden'));
    }else{
        [varBtn,choiceBtn,privacyBtn,mobileVarBtn,mobileChoiceBtn,mobilePrivacyBtn].forEach(btn=>btn?.classList.add('hidden'));
    }
}

// Copy final text
window.copyFinalText=function(){
    const editor=document.getElementById('editor');
    if(!editor)return;
    const clone=editor.cloneNode(true);
    clone.querySelectorAll('.token').forEach(t=>{
        const id=t.dataset.id;
        const v=state.currentVariables.find(x=>x.id===id);
        t.replaceWith(document.createTextNode(v?v.value:t.textContent));
    });
    clone.querySelectorAll('.choice-token').forEach(t=>{
        const id=t.dataset.id;
        const c=state.currentChoices.find(x=>x.id===id);
        t.replaceWith(document.createTextNode(c?c.selected:t.textContent));
    });
    clone.querySelectorAll('.masked-token').forEach(t=>{
        const maskId=t.dataset.maskId;
        const m=state.currentMaskedVariables.find(x=>x.id===maskId);
        t.replaceWith(document.createTextNode(m?m.actualValue:t.textContent));
    });
    const text=clone.textContent||clone.innerText;
    navigator.clipboard.writeText(text).then(()=>showToast('Copied to clipboard!')).catch(()=>showToast('Copy failed'));
};

// Import/Export
function handleImport(input){
    const file=input.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async(e)=>{
        try{
            const data=JSON.parse(e.target.result);
            // Backward compatibility - handle both old and new formats
            if(data.templates)state.templates=data.templates;
            if(data.folders){
                // Migrate folders to support parentId if not present
                state.folders=data.folders.map(f=>({
                    ...f,
                    parentId:f.parentId||null // Ensure parentId exists
                }));
            }
            await persistState();
            renderTemplateList();
            if(state.templates.length>0)loadTemplateUI(state.templates[0].id);
            showToast('Imported successfully!');
        }catch(err){
            showToast('Import failed: Invalid JSON');
        }
        input.value='';
    };
    reader.readAsText(file);
}

window.exportData=function(){
    const data={
        app:'TypeFill',
        version:APP_VERSION,
        templates:state.templates,
        folders:state.folders,
        exportedAt:new Date().toISOString()
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`typefill-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported!');
};

// Editor event listeners
const editor=document.getElementById('editor');
const floater=document.getElementById('floater');
if(editor){
    editor.addEventListener('mouseup',()=>{const text=window.getSelection().toString().trim();updateActionButtons(text);});
    editor.addEventListener('keyup',()=>{const text=window.getSelection().toString().trim();updateActionButtons(text);});
    editor.addEventListener('touchend',()=>{setTimeout(()=>{const text=window.getSelection().toString().trim();updateActionButtons(text);},100);});
}
if(floater&&editor){
    const rect=editor.getBoundingClientRect();
    floater.style.top=`${rect.top+10}px`;
    floater.style.left=`${rect.left+10}px`;
}

// Service worker
if('serviceWorker'in navigator){
    navigator.serviceWorker.register('./sw.js').then(reg=>{
        console.log('[TypeFill] SW registered:',reg.scope);
    }).catch(err=>{
        console.log('[TypeFill] SW registration failed:',err);
    });
}

// Check for SW updates
function checkForSWUpdates(){
    if('serviceWorker'in navigator){
        navigator.serviceWorker.ready.then(reg=>{
            reg.update();
        });
    }
}
