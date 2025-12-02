let sheetData = [];
let filteredData = [];
let currentDetail = null;
let debugMode = false;
let selectedCategory = 'all';

// Create particle effect
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 80;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Random size
        const size = Math.random() * 8 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        
        // Random animation delay
        particle.style.animationDelay = `${Math.random() * 20}s`;
        
        // Random animation duration
        particle.style.animationDuration = `${Math.random() * 20 + 10}s`;
        
        particlesContainer.appendChild(particle);
    }
}

// Update system time
function updateSystemTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('systemTime').textContent = timeString;
}

// Update system status
function updateSystemStatus(status, type = 'normal') {
    const statusElement = document.getElementById('systemStatus');
    statusElement.textContent = status;
    
    // Add color based on type
    statusElement.style.color = type === 'error' ? '#ff4444' : 
                               type === 'success' ? 'var(--accent-color)' : 
                               type === 'warning' ? '#ffaa00' : 
                               'var(--primary-color)';
}

// Show terminal output
function showTerminalOutput() {
    const terminal = document.getElementById('terminalOutput');
    terminal.style.display = 'block';
}

// Add line to terminal
function addTerminalLine(text, type = 'normal') {
    const terminal = document.getElementById('terminalOutput');
    const line = document.createElement('div');
    line.classList.add('terminal-line');
    
    let className = 'terminal-prompt';
    if (type === 'error') className = 'terminal-error';
    else if (type === 'success') className = 'terminal-success';
    else if (type === 'warning') className = 'terminal-warning';
    
    line.innerHTML = `<span class="${className}">SYSTEM></span> ${text}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

// Update debug info
function updateDebugInfo() {
    if (!debugMode) return;
    
    const debugInfo = document.getElementById('debugInfo');
    debugInfo.innerHTML = `
        <div>Total Data: ${sheetData.length}</div>
        <div>Filtered Data: ${filteredData.length}</div>
        <div>Current Detail: ${currentDetail ? currentDetail.title : 'None'}</div>
        <div>Cache: ${localStorage.getItem('cybersearch_data') ? 'Available' : 'Empty'}</div>
    `;
}

// Levenshtein distance algorithm for fuzzy matching
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Calculate similarity percentage
function calculateSimilarity(str1, str2) {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    return Math.round(((longer.length - distance) / longer.length) * 100);
}

// Enhanced fuzzy matching function
function fuzzyMatch(query, text) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Direct match (highest priority)
    if (textLower.includes(queryLower)) {
        return { match: true, score: 100, type: 'exact' };
    }
    
    // Split text into words
    const words = textLower.split(/\s+/);
    
    // Check each word for fuzzy match
    let bestMatch = { match: false, score: 0, type: 'none' };
    
    for (const word of words) {
        // Check if word starts with query
        if (word.startsWith(queryLower)) {
            const score = Math.round((queryLower.length / word.length) * 100);
            if (score > bestMatch.score) {
                bestMatch = { match: true, score, type: 'prefix' };
            }
        }
        
        // Check fuzzy similarity
        const similarity = calculateSimilarity(queryLower, word);
        if (similarity >= 60 && similarity > bestMatch.score) { // 60% similarity threshold
            bestMatch = { match: true, score: similarity, type: 'fuzzy' };
        }
        
        // Check if query is contained in word
        if (word.includes(queryLower)) {
            const score = Math.round((queryLower.length / word.length) * 90);
            if (score > bestMatch.score) {
                bestMatch = { match: true, score, type: 'contains' };
            }
        }
    }
    
    return bestMatch;
}

// Fetch data from Google Sheets with multiple fallback methods
async function fetchSheetData() {
    const sheetId = '1k5U_YwloyQsad7PT_DmXobkNycJ6bsV0zhE00TLmSIg';
    
    updateSystemStatus('MENGAMBIL DATA...', 'warning');
    addTerminalLine('Attempting to connect to database...', 'warning');
    
    // Method 1: Try to access the first sheet by gid=0
    try {
        addTerminalLine('Method 1: Accessing sheet by gid=0...', 'normal');
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=0`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Check if we got valid data
        if (text.includes('google.visualization.Query.setResponse')) {
            const json = JSON.parse(text.substring(47).slice(0, -2));
            const rows = json.table.rows;
            
            sheetData = [];
            for (let i = 0; i < rows.length; i++) {
                const titleCell = rows[i].c[0];
                const infoCell = rows[i].c[1];
                
                const title = titleCell && titleCell.v ? String(titleCell.v) : '';
                const info = infoCell && infoCell.v ? String(infoCell.v) : '';
                
                if (title) {
                    // Generate a random category for demo
                    const categories = ['network', 'security', 'system', 'database', 'app', 'tools'];
                    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                    
                    sheetData.push({ 
                        title: title.trim(), 
                        info: info.trim(),
                        category: randomCategory,
                        accessLevel: Math.floor(Math.random() * 3) + 1 // 1-3
                    });
                }
            }
            
            if (sheetData.length > 0) {
                addTerminalLine(`SUCCESS: Loaded ${sheetData.length} menu items from database`, 'success');
                updateSystemStatus('SISTEM ONLINE', 'success');
                localStorage.setItem('cybersearch_data', JSON.stringify(sheetData));
                localStorage.setItem('cybersearch_timestamp', new Date().toISOString());
                filteredData = [...sheetData];
                displayMenuItems();
                updateCategories();
                updateDebugInfo();
                return;
            }
        }
    } catch (error) {
        addTerminalLine(`Method 1 failed: ${error.message}`, 'error');
        console.error('Method 1 error:', error);
    }
    
    // Method 2: Try to access by sheet name "REPORTAN"
    try {
        addTerminalLine('Method 2: Accessing sheet by name "REPORTAN"...', 'normal');
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=REPORTAN`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Check if we got valid data
        if (text.includes('google.visualization.Query.setResponse')) {
            const json = JSON.parse(text.substring(47).slice(0, -2));
            const rows = json.table.rows;
            
            sheetData = [];
            for (let i = 0; i < rows.length; i++) {
                const titleCell = rows[i].c[0];
                const infoCell = rows[i].c[1];
                
                const title = titleCell && titleCell.v ? String(titleCell.v) : '';
                const info = infoCell && infoCell.v ? String(infoCell.v) : '';
                
                if (title) {
                    // Generate a random category for demo
                    const categories = ['network', 'security', 'system', 'database', 'app', 'tools'];
                    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                    
                    sheetData.push({ 
                        title: title.trim(), 
                        info: info.trim(),
                        category: randomCategory,
                        accessLevel: Math.floor(Math.random() * 3) + 1
                    });
                }
            }
            
            if (sheetData.length > 0) {
                addTerminalLine(`SUCCESS: Loaded ${sheetData.length} menu items from REPORTAN sheet`, 'success');
                updateSystemStatus('SISTEM ONLINE', 'success');
                localStorage.setItem('cybersearch_data', JSON.stringify(sheetData));
                localStorage.setItem('cybersearch_timestamp', new Date().toISOString());
                filteredData = [...sheetData];
                displayMenuItems();
                updateCategories();
                updateDebugInfo();
                return;
            }
        }
    } catch (error) {
        addTerminalLine(`Method 2 failed: ${error.message}`, 'error');
        console.error('Method 2 error:', error);
    }
    
    // Method 3: Try to get all sheets and access the first one
    try {
        addTerminalLine('Method 3: Getting all sheets...', 'normal');
        const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${sheetId}/public/basic?alt=json`;
        
        const response = await fetch(feedUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const feedJson = await response.json();
        if (feedJson.feed && feedJson.feed.entry && feedJson.feed.entry.length > 0) {
            // Get the first sheet
            const firstSheet = feedJson.feed.entry[0];
            const sheetName = firstSheet.title.$t;
            
            addTerminalLine(`Found sheet: ${sheetName}`, 'normal');
            
            // Now try to access this sheet
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
            
            const sheetResponse = await fetch(url);
            if (!sheetResponse.ok) {
                throw new Error(`HTTP error! status: ${sheetResponse.status}`);
            }
            
            const sheetText = await sheetResponse.text();
            
            // Check if we got valid data
            if (sheetText.includes('google.visualization.Query.setResponse')) {
                const json = JSON.parse(sheetText.substring(47).slice(0, -2));
                const rows = json.table.rows;
                
                sheetData = [];
                for (let i = 0; i < rows.length; i++) {
                    const titleCell = rows[i].c[0];
                    const infoCell = rows[i].c[1];
                    
                    const title = titleCell && titleCell.v ? String(titleCell.v) : '';
                    const info = infoCell && infoCell.v ? String(infoCell.v) : '';
                    
                    if (title) {
                        // Generate a random category for demo
                        const categories = ['network', 'security', 'system', 'database', 'app', 'tools'];
                        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                        
                        sheetData.push({ 
                            title: title.trim(), 
                            info: info.trim(),
                            category: randomCategory,
                            accessLevel: Math.floor(Math.random() * 3) + 1
                        });
                    }
                }
                
                if (sheetData.length > 0) {
                    addTerminalLine(`SUCCESS: Loaded ${sheetData.length} menu items from ${sheetName} sheet`, 'success');
                    updateSystemStatus('SISTEM ONLINE', 'success');
                    localStorage.setItem('cybersearch_data', JSON.stringify(sheetData));
                    localStorage.setItem('cybersearch_timestamp', new Date().toISOString());
                    filteredData = [...sheetData];
                    displayMenuItems();
                    updateCategories();
                    updateDebugInfo();
                    return;
                }
            }
        }
    } catch (error) {
        addTerminalLine(`Method 3 failed: ${error.message}`, 'error');
        console.error('Method 3 error:', error);
    }
    
    // Method 4: Try to load from cache
    try {
        addTerminalLine('Method 4: Loading from cache...', 'normal');
        const cachedData = localStorage.getItem('cybersearch_data');
        if (cachedData) {
            sheetData = JSON.parse(cachedData);
            const timestamp = localStorage.getItem('cybersearch_timestamp');
            addTerminalLine(`SUCCESS: Loaded ${sheetData.length} menu items from cache (${new Date(timestamp).toLocaleString()})`, 'success');
            updateSystemStatus('SISTEM ONLINE (OFFLINE)', 'warning');
            filteredData = [...sheetData];
            displayMenuItems();
            updateCategories();
            updateDebugInfo();
            return;
        }
    } catch (error) {
        addTerminalLine(`Method 4 failed: ${error.message}`, 'error');
        console.error('Method 4 error:', error);
    }
    
    // Method 5: Use sample data as last resort
    addTerminalLine('Method 5: Using sample data...', 'warning');
    sheetData = [
        { title: "NETWORK SCANNER", info: "Advanced network scanning tool with real-time monitoring. Detects active hosts, open ports, and vulnerabilities.", category: "network", accessLevel: 2 },
        { title: "SECURITY AUDIT", info: "Comprehensive security audit system for penetration testing and vulnerability assessment.", category: "security", accessLevel: 3 },
        { title: "SYSTEM DIAGNOSTIC", info: "Full system diagnostic tool with hardware analysis and performance metrics.", category: "system", accessLevel: 1 },
        { title: "DATABASE ENCRYPTOR", info: "Advanced database encryption module with multiple algorithms support.", category: "database", accessLevel: 3 },
        { title: "APP MONITOR", info: "Real-time application monitoring with alert system and performance tracking.", category: "app", accessLevel: 1 },
        { title: "CYBER TOOLKIT", info: "Collection of cybersecurity tools for various security operations.", category: "tools", accessLevel: 2 },
        { title: "FIREWALL ANALYZER", info: "Firewall configuration analyzer with rule optimization suggestions.", category: "network", accessLevel: 3 },
        { title: "ENCRYPTION MANAGER", info: "Manage encryption keys and certificates across the system.", category: "security", accessLevel: 2 },
        { title: "SYSTEM BACKUP", info: "Automated backup system with encryption and cloud sync options.", category: "system", accessLevel: 1 },
        { title: "QUERY OPTIMIZER", info: "Database query optimizer for improved performance and efficiency.", category: "database", accessLevel: 2 }
    ];
    
    addTerminalLine(`WARNING: Using ${sheetData.length} sample menu items`, 'warning');
    updateSystemStatus('SISTEM OFFLINE', 'error');
    filteredData = [...sheetData];
    displayMenuItems();
    updateCategories();
    updateDebugInfo();
}

// Display menu items in sidebar
function displayMenuItems() {
    const container = document.getElementById('sidebarMenuContainer');
    const loadingContainer = document.getElementById('loadingContainer');
    const noMenu = document.getElementById('noMenu');
    
    loadingContainer.style.display = 'none';
    
    if (filteredData.length === 0) {
        container.innerHTML = '';
        noMenu.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    noMenu.style.display = 'none';
    
    filteredData.forEach((item, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'sidebar-menu-item';
        menuItem.setAttribute('data-index', index);
        
        // Create access level indicator
        const accessLevels = ['', '⚡', '⚡⚡', '⚡⚡⚡'];
        
        menuItem.innerHTML = `
            <div class="menu-item-header">
                <div class="menu-item-category ${item.category}">${item.category.toUpperCase()}</div>
                <div class="menu-item-access access-${item.accessLevel}">${accessLevels[item.accessLevel]}</div>
            </div>
            <h3 class="menu-item-title">${item.title}</h3>
            <div class="menu-item-preview">${item.info.substring(0, 60)}${item.info.length > 60 ? '...' : ''}</div>
            <div class="menu-item-footer">
                <div class="menu-item-match">${item.matchType || 'MATCH'}</div>
                <div class="menu-item-id">ID: ${String(index + 1).padStart(3, '0')}</div>
            </div>
        `;
        
        menuItem.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            showDetail(filteredData[index]);
            
            // Highlight selected item
            document.querySelectorAll('.sidebar-menu-item').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
        });
        
        container.appendChild(menuItem);
    });
    
    // Add scroll glow effect
    addScrollGlowEffect();
}

// Show detail in main content
function showDetail(item) {
    currentDetail = item;
    const detailContent = document.getElementById('detailContent');
    
    // Generate random connection data for demo
    const connections = Math.floor(Math.random() * 100) + 1;
    const uptime = `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`;
    const securityLevel = Math.floor(Math.random() * 100);
    
    // Get icon based on category
    const categoryIcons = {
        network: '🌐',
        security: '🔒',
        system: '💻',
        database: '🗄️',
        app: '📱',
        tools: '🛠️'
    };
    
    const categoryIcon = categoryIcons[item.category] || '📄';
    
    detailContent.innerHTML = `
        <div class="detail-header">
            <div class="detail-category-badge ${item.category}">
                ${categoryIcon} ${item.category.toUpperCase()}
            </div>
            <div class="detail-status">
                <span class="status-dot active"></span> STATUS: ACTIVE
            </div>
        </div>
        
        <h1 class="detail-main-title">${item.title}</h1>
        
        <div class="detail-stats">
            <div class="stat">
                <div class="stat-label">ACCESS LEVEL</div>
                <div class="stat-value access-${item.accessLevel}">LEVEL ${item.accessLevel}</div>
            </div>
            <div class="stat">
                <div class="stat-label">CONNECTIONS</div>
                <div class="stat-value">${connections}</div>
            </div>
            <div class="stat">
                <div class="stat-label">UPTIME</div>
                <div class="stat-value">${uptime}</div>
            </div>
            <div class="stat">
                <div class="stat-label">SECURITY</div>
                <div class="stat-value">${securityLevel}%</div>
            </div>
        </div>
        
        <div class="detail-info">
            <h3 class="detail-section-title">DESCRIPTION</h3>
            <p class="detail-text">${item.info}</p>
        </div>
        
        <div class="detail-actions">
            <button class="action-button execute" id="executeButton">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                EXECUTE
            </button>
            <button class="action-button copy" id="copyButton">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                COPY DATA
            </button>
            <button class="action-button log" id="logButton">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                VIEW LOGS
            </button>
        </div>
        
        <div class="detail-terminal">
            <div class="terminal-header">
                <span class="terminal-title">SYSTEM OUTPUT</span>
                <span class="terminal-status">LIVE</span>
            </div>
            <div class="terminal-content" id="detailTerminal">
                <div class="terminal-line"><span class="terminal-prompt">></span> Loading module: ${item.title}</div>
                <div class="terminal-line"><span class="terminal-prompt">></span> Access level verified: ${item.accessLevel}</div>
                <div class="terminal-line"><span class="terminal-prompt">></span> Initializing security protocols...</div>
                <div class="terminal-line"><span class="terminal-prompt">></span> Connection established with ${connections} endpoints</div>
                <div class="terminal-line"><span class="terminal-prompt">></span> Module ready for execution</div>
            </div>
        </div>
        
        <div class="copy-success" id="copySuccess">Data copied to clipboard!</div>
    `;
    
    // Add event listeners for buttons
    document.getElementById('executeButton').addEventListener('click', executeModule);
    document.getElementById('copyButton').addEventListener('click', copyToClipboard);
    document.getElementById('logButton').addEventListener('click', viewLogs);
    
    // Update terminal output
    addTerminalLine(`Module accessed: ${item.title} (${item.category})`, 'success');
    updateDebugInfo();
    
    // Add scan effect
    addScanEffect();
}

// Execute module
function executeModule() {
    if (!currentDetail) return;
    
    addTerminalLine(`Executing module: ${currentDetail.title}`, 'warning');
    
    // Add execution line to detail terminal
    const terminal = document.getElementById('detailTerminal');
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.innerHTML = `<span class="terminal-prompt">></span> [EXECUTION] Module ${currentDetail.title} running...`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
    
    // Simulate execution
    setTimeout(() => {
        const line2 = document.createElement('div');
        line2.className = 'terminal-line';
        line2.innerHTML = `<span class="terminal-prompt">></span> [EXECUTION] Module completed successfully`;
        terminal.appendChild(line2);
        terminal.scrollTop = terminal.scrollHeight;
        
        addTerminalLine(`Module ${currentDetail.title} executed successfully`, 'success');
    }, 1500);
}

// Copy to clipboard
function copyToClipboard() {
    if (!currentDetail) return;
    
    navigator.clipboard.writeText(currentDetail.info).then(() => {
        // Show success message
        const successElement = document.getElementById('copySuccess');
        successElement.classList.add('show');
        
        // Add to terminal
        addTerminalLine(`Data copied to clipboard: ${currentDetail.info.substring(0, 50)}${currentDetail.info.length > 50 ? '...' : ''}`, 'success');
        
        // Hide success message after 2 seconds
        setTimeout(() => {
            successElement.classList.remove('show');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        addTerminalLine(`ERROR: Failed to copy text - ${err.message}`, 'error');
    });
}

// View logs
function viewLogs() {
    if (!currentDetail) return;
    
    addTerminalLine(`Opening logs for: ${currentDetail.title}`, 'normal');
    
    // Add log lines to detail terminal
    const terminal = document.getElementById('detailTerminal');
    const logCount = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < logCount; i++) {
        const logTypes = ['INFO', 'DEBUG', 'WARNING', 'SECURITY'];
        const randomType = logTypes[Math.floor(Math.random() * logTypes.length)];
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
        
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="terminal-prompt">></span> [LOG:${randomType}] ${timestamp} - Module operation ${i+1} completed`;
        terminal.appendChild(line);
    }
    
    terminal.scrollTop = terminal.scrollHeight;
}

// Enhanced filter menu items with fuzzy matching
function filterMenuItems() {
    const query = document.getElementById('filterInput').value.trim();
    
    if (query === '' && selectedCategory === 'all') {
        filteredData = sheetData.map(item => ({ ...item }));
    } else {
        const results = [];
        
        for (const item of sheetData) {
            // Check category filter
            if (selectedCategory !== 'all' && item.category !== selectedCategory) {
                continue;
            }
            
            // Check search query
            if (query !== '') {
                // Check title match
                const titleMatch = fuzzyMatch(query, item.title);
                
                // Check info match
                const infoMatch = fuzzyMatch(query, item.info);
                
                // Use the best match
                const bestMatch = titleMatch.score > infoMatch.score ? titleMatch : infoMatch;
                
                if (bestMatch.match) {
                    // Add match type and score to item
                    const enhancedItem = {
                        ...item,
                        matchScore: bestMatch.score,
                        matchType: bestMatch.type.toUpperCase()
                    };
                    results.push(enhancedItem);
                }
            } else {
                // If no query, just add item
                results.push({ ...item });
            }
        }
        
        // Sort by score (highest first) if there's a query
        if (query !== '') {
            results.sort((a, b) => b.matchScore - a.matchScore);
        }
        
        filteredData = results;
    }
    
    displayMenuItems();
    updateDebugInfo();
    
    if (query !== '' || selectedCategory !== 'all') {
        addTerminalLine(`Filter applied: "${query}" | Category: ${selectedCategory} (${filteredData.length} results)`, 'normal');
    }
}

// Update categories sidebar
function updateCategories() {
    const categoriesContainer = document.getElementById('categoriesContainer');
    
    // Get unique categories
    const categories = ['all', ...new Set(sheetData.map(item => item.category))];
    
    categoriesContainer.innerHTML = categories.map(category => {
        const count = category === 'all' 
            ? sheetData.length 
            : sheetData.filter(item => item.category === category).length;
            
        const categoryNames = {
            all: 'ALL MODULES',
            network: 'NETWORK',
            security: 'SECURITY',
            system: 'SYSTEM',
            database: 'DATABASE',
            app: 'APPLICATION',
            tools: 'TOOLS'
        };
        
        return `
            <div class="category-item ${category === selectedCategory ? 'active' : ''}" data-category="${category}">
                <span class="category-name">${categoryNames[category] || category.toUpperCase()}</span>
                <span class="category-count">${count}</span>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    categoriesContainer.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function() {
            selectedCategory = this.dataset.category;
            
            // Update active state
            document.querySelectorAll('.category-item').forEach(el => {
                el.classList.remove('active');
            });
            this.classList.add('active');
            
            filterMenuItems();
        });
    });
}

// Add scroll glow effect
function addScrollGlowEffect() {
    const container = document.getElementById('sidebarMenuContainer');
    
    container.addEventListener('scroll', function() {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Add glow effect when scrolling
        if (scrollTop > 10) {
            container.classList.add('scrolling');
        } else {
            container.classList.remove('scrolling');
        }
        
        // Add bottom glow when not at bottom
        if (scrollTop + clientHeight < scrollHeight - 10) {
            container.classList.add('more-content');
        } else {
            container.classList.remove('more-content');
        }
    });
}

// Add scan effect to detail content
function addScanEffect() {
    const detailContent = document.getElementById('detailContent');
    const scanLine = document.createElement('div');
    scanLine.className = 'scan-line';
    detailContent.appendChild(scanLine);
    
    // Remove after animation
    setTimeout(() => {
        if (scanLine.parentNode) {
            scanLine.parentNode.removeChild(scanLine);
        }
    }, 2000);
}

// Fetch data when page loads
window.onload = function() {
    createParticles();
    updateSystemTime();
    setInterval(updateSystemTime, 1000);
    showTerminalOutput();
    
    // Debug toggle
    document.getElementById('debugToggle').addEventListener('click', function() {
        debugMode = !debugMode;
        const debugPanel = document.getElementById('debugPanel');
        debugPanel.classList.toggle('show', debugMode);
        updateDebugInfo();
    });
    
    // Update debug info periodically
    setInterval(updateDebugInfo, 1000);
    
    // Filter input with debouncing
    let debounceTimer;
    document.getElementById('filterInput').addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterMenuItems, 300);
    });
    
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        const toggleIcon = this.querySelector('svg');
        
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
        
        // Change icon
        if (sidebar.classList.contains('collapsed')) {
            toggleIcon.innerHTML = '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>';
        } else {
            toggleIcon.innerHTML = '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>';
        }
    });
    
    // Fetch data
    fetchSheetData();
    
    // Add initial scan effect
    setTimeout(() => {
        addScanEffect();
    }, 1000);
    
    // Add random terminal updates
    setInterval(() => {
        if (Math.random() > 0.7) {
            const messages = [
                "System integrity check: PASSED",
                "Network traffic: STABLE",
                "Security protocols: ACTIVE",
                "Database connections: OPTIMAL",
                "All modules: ONLINE"
            ];
            
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            addTerminalLine(randomMessage, 'normal');
        }
    }, 10000);
};
