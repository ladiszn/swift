


// Monaco editor instances
let htmlEditor, cssEditor, jsEditor;

// Debounce function to delay execution
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

require(['vs/editor/editor.main'], function() {
    // Create Monaco editors
    htmlEditor = monaco.editor.create(document.getElementById('htmlEditor'), {
        value: '',
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true
    });

    cssEditor = monaco.editor.create(document.getElementById('cssEditor'), {
        value: '',
        language: 'css',
        theme: 'vs-dark',
        automaticLayout: true
    });

    jsEditor = monaco.editor.create(document.getElementById('jsEditor'), {
        value: '',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });

    // Set initial states based on local storage
    const wrapState = localStorage.getItem('wrap') !== 'false';
    const localStorageState = localStorage.getItem('localStorage') !== 'false';
    document.getElementById('toggleWrap').classList.toggle('active', wrapState);
    document.getElementById('toggleWrap').textContent = `Line Wrap: ${wrapState ? 'ON' : 'OFF'}`;
    document.getElementById('toggleLocalStorage').classList.toggle('active', localStorageState);
    document.getElementById('toggleLocalStorage').textContent = `Local Storage: ${localStorageState ? 'ON' : 'OFF'}`;
    htmlEditor.updateOptions({ wordWrap: wrapState ? 'on' : 'off' });
    cssEditor.updateOptions({ wordWrap: wrapState ? 'on' : 'off' });
    jsEditor.updateOptions({ wordWrap: wrapState ? 'on' : 'off' });

    if (localStorageState) {
        loadFromLocalStorage(); // Ensure local storage data is loaded
    }

    // Update preview and save to local storage
    const debouncedSave = debounce(saveToLocalStorage, 1000); // Save after 1 second of inactivity

    htmlEditor.onDidChangeModelContent(() => {
        updatePreview();
        debouncedSave();
    });
    cssEditor.onDidChangeModelContent(() => {
        updatePreview();
        debouncedSave();
    });
    jsEditor.onDidChangeModelContent(() => {
        updatePreview();
        debouncedSave();
         executeUserCode();
    });
    
// Modal handling
var publishBtn = document.getElementById('publishBtn');
var publishModal = document.getElementById('publishModal');
var closeModal = document.querySelector('.close');
var publishForm = document.getElementById('publishForm');
var thumbnailInput = document.getElementById('thumbnailInput');
var appTitle = document.getElementById('appTitle');
var appDescription = document.getElementById('appDescription');

publishBtn.addEventListener('click', function() {
    publishModal.style.display = 'block';
});

closeModal.addEventListener('click', function() {
    publishModal.style.display = 'none';
});

window.addEventListener('click', function(event) {
    if (event.target === publishModal) {
        publishModal.style.display = 'none';
    }
});

// Form submission
publishForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // Get form data
    var title = appTitle.value.trim();
    var description = appDescription.value.trim();

    if (!title || !description) {
        alert('Please provide both title and description.');
        return;
    }

    // Handle thumbnail upload
    var thumbnailFile = thumbnailInput.files[0];
    if (thumbnailFile) {
        var thumbnailRef = storage.ref('thumbnails/' + thumbnailFile.name);
        var uploadTask = thumbnailRef.put(thumbnailFile);

        uploadTask.on('state_changed',
            function(snapshot) {
                // Observe state change events such as progress, pause, and resume
            },
            function(error) {
                console.error('Upload failed:', error);
                alert('Thumbnail upload failed. Please try again.');
            },
            function() {
                // Handle successful uploads on complete
                uploadTask.snapshot.ref.getDownloadURL().then(function(thumbnailURL) {
                    // Handle HTML, CSS, and JS content
                    var htmlContent = htmlEditor.getValue();
                    var cssContent = cssEditor.getValue();
                    var jsContent = jsEditor.getValue();

                    // Save to Firestore
                    db.collection('apps').add({
                        title: title,
                        description: description,
                        thumbnailURL: thumbnailURL,
                        html: htmlContent,
                        css: cssContent,
                        js: jsContent,
                        createdAt: new Date()
                    }).then(function() {
                        alert('App submitted for review!');
                        publishModal.style.display = 'none';
                    }).catch(function(error) {
                        console.error('Error adding document: ', error);
                        alert('Failed to submit app. Please try again.');
                    });
                });
            }
        );
    } else {
        alert('Please select a thumbnail image.');
    }
});

    function executeUserCode() {
    // Clear the previous output
    customConsole.innerHTML = '';

    const jsCode = jsEditor.getValue();

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

    // Intercept console methods within the iframe
    iframeWindow.console.log = (...args) => logToCustomConsole('log', ...args);
    iframeWindow.console.warn = (...args) => logToCustomConsole('warn', ...args);
    iframeWindow.console.error = (...args) => logToCustomConsole('error', ...args);

    try {
        // Execute the user's JavaScript code within the iframe
        const script = iframeDocument.createElement('script');
        script.type = 'text/javascript';
        script.text = `
            try {
                ${jsCode}
            } catch (error) {
                console.error('Runtime error:', error.message);
            }
        `;
        iframeDocument.body.appendChild(script);
    } catch (error) {
        logToCustomConsole('error', 'Execution error:', error.message);
    }

    // Clean up by removing the iframe
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 1000);
}



});

const preview = document.getElementById('preview');
const tabButtons = document.querySelectorAll('.tab-button');
const editors = document.querySelectorAll('.editor');
const phone = document.getElementById('phone');
const fullscreenBtn = document.getElementById('fullscreenBtn');

function updatePreview() {
    const html = htmlEditor.getValue();
    const css = `<style>${cssEditor.getValue()}</style>`;
    const js = `<script>${jsEditor.getValue()}<\/script>`;
    const content = `${css}${html}${js}`;
    preview.contentDocument.open();
    preview.contentDocument.write(content);
    preview.contentDocument.close();
    console.log('Preview updated');
}

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        editors.forEach(editor => editor.classList.remove('active'));
        document.getElementById(button.dataset.target).classList.add('active');
    });
});

// Drag and drop functionality for phone preview
let isDragging = false;
let startX, startY, initialX, initialY;

phone.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

function startDrag(e) {
    if (window.innerWidth >= 768) { // Only allow dragging on desktop
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = phone.offsetLeft;
        initialY = phone.offsetTop;
    }
}

function drag(e) {
    if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        phone.style.left = `${initialX + dx}px`;
        phone.style.top = `${initialY + dy}px`;
    }
}

function stopDrag() {
    isDragging = false;
}

document.getElementById('toggleWrap').addEventListener('click', function() {
    const wrapButton = this;
    const isWrapped = wrapButton.classList.toggle('active');
    wrapButton.textContent = `Line Wrap: ${isWrapped ? 'ON' : 'OFF'}`;
    htmlEditor.updateOptions({ wordWrap: isWrapped ? 'on' : 'off' });
    cssEditor.updateOptions({ wordWrap: isWrapped ? 'on' : 'off' });
    jsEditor.updateOptions({ wordWrap: isWrapped ? 'on' : 'off' });
    localStorage.setItem('wrap', isWrapped);
    console.log(`Line Wrap: ${isWrapped ? 'ON' : 'OFF'}`);
});

document.getElementById('toggleLocalStorage').addEventListener('click', function() {
    const localStorageButton = this;
    const isSaving = localStorageButton.classList.toggle('active');
    localStorageButton.textContent = `Local Storage: ${isSaving ? 'ON' : 'OFF'}`;
    localStorage.setItem('localStorage', isSaving);
    if (isSaving) {
        loadFromLocalStorage();
    } else {
        saveToLocalStorage();
    }
    console.log(`Local Storage: ${isSaving ? 'ON' : 'OFF'}`);
});

function saveToLocalStorage() {
    console.log('Saving to local storage');
    localStorage.setItem('html', htmlEditor.getValue());
    localStorage.setItem('css', cssEditor.getValue());
    localStorage.setItem('js', jsEditor.getValue());
}

function loadFromLocalStorage() {
    console.log('Loading from local storage');
    const html = localStorage.getItem('html');
    const css = localStorage.getItem('css');
    const js = localStorage.getItem('js');
    if (html !== null) {
        htmlEditor.setValue(html);
        console.log('HTML loaded from local storage');
    }
    if (css !== null) {
        cssEditor.setValue(css);
        console.log('CSS loaded from local storage');
    }
    if (js !== null) {
        jsEditor.setValue(js);
        console.log('JS loaded from local storage');
    }
    updatePreview(); // Ensure preview updates after loading content
}

fullscreenBtn.addEventListener('click', () => {
    phone.classList.toggle('fullscreen');
    if (phone.classList.contains('fullscreen')) {
        phone.style.position = 'fixed';
        phone.style.top = '0';
        phone.style.left = '0';
        phone.style.width = '100%';
        phone.style.height = '100%';
        fullscreenBtn.textContent = 'Exit Full Screen';
        // Prevent dragging when in fullscreen mode
        phone.removeEventListener('mousedown', startDrag);
    } else {
        exitFullscreen();
        phone.addEventListener('mousedown', startDrag); // Re-enable dragging after exiting fullscreen
    }
});

// Exit fullscreen with Ctrl + F + M
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'm' && phone.classList.contains('fullscreen')) {
        exitFullscreen();
        phone.addEventListener('mousedown', startDrag); // Re-enable dragging after exiting fullscreen
    }
});

function exitFullscreen() {
    phone.classList.remove('fullscreen');
    phone.style.position = 'fixed';
    phone.style.top = '';
    phone.style.left = '';
    phone.style.width = '100%';
    phone.style.height = '50vh';
    phone.style.bottom = '0';
    fullscreenBtn.textContent = 'Full Screen';
    if (window.innerWidth >= 768) {
        phone.addEventListener('mousedown', startDrag); // Re-enable dragging after exiting fullscreen
    }
}

document.getElementById('menuButton').addEventListener('click', () => {
    const menuOptions = document.getElementById('menuOptions');
    menuOptions.style.display = menuOptions.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const zip = new JSZip();
    zip.file('index.html', htmlEditor.getValue());
    zip.file('index.css', cssEditor.getValue());
    zip.file('index.js', jsEditor.getValue());

    zip.generateAsync({ type: 'blob' }).then(function(content) {
        saveAs(content, 'code.zip');
    });
});

document.getElementById('openFileBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name;
            const reader = new FileReader();

            reader.onload = function(e) {
                const content = e.target.result;
                if (fileName.endsWith('.html')) {
                    htmlEditor.setValue(content);
                } else if (fileName.endsWith('.css')) {
                    cssEditor.setValue(content);
                } else if (fileName.endsWith('.js')) {
                    jsEditor.setValue(content);
                }
                updatePreview(); // Update the preview with the newly loaded content
            };

            reader.readAsText(file);
        }
    }
});

// Define logToCustomConsole function
function logToCustomConsole(type, ...args) {
    const customConsole = document.getElementById('customConsole');
    const messageElement = document.createElement('div');
    messageElement.className = `console-${type}`;
    
    const messageText = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return '[Object with circular reference]';
            }
        }
        return String(arg);
    }).join(' ');

    messageElement.textContent = messageText;
    customConsole.appendChild(messageElement);

    // Scroll to the bottom of the custom console
    customConsole.scrollTop = customConsole.scrollHeight;
}


// Use this function within executeUserCode
function executeUserCode() {
    const customConsole = document.getElementById('customConsole');
    customConsole.innerHTML = ''; // Clear previous output

    const jsCode = jsEditor.getValue();

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

    // Intercept console methods within the iframe
    iframeWindow.console.log = (...args) => logToCustomConsole('log', ...args);
    iframeWindow.console.warn = (...args) => logToCustomConsole('warn', ...args);
    iframeWindow.console.error = (...args) => logToCustomConsole('error', ...args);

    try {
        // Execute the user's JavaScript code within the iframe
        const script = iframeDocument.createElement('script');
        script.type = 'text/javascript';
        script.text = `
            try {
                ${jsCode}
            } catch (error) {
                console.error('Runtime error:', error.message);
            }
        `;
        iframeDocument.body.appendChild(script);
    } catch (error) {
        logToCustomConsole('error', 'Execution error:', error.message);
    }

    // Clean up by removing the iframe
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 1000);
}
 // Implement live preview reloading in scripts.js
document.getElementById('reloadPreviewBtn').addEventListener('click', () => {
  document.getElementById('preview').contentWindow.location.reload();
});
