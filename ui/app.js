const { ipcRenderer } = require('electron');

let selectedDate = new Date().toISOString().split('T')[0];
let activeView = 'month';
let tasks = [];
let isResizing = false;
let startY = 0;
let startHeight = 0;
let startX = 0;
let startWidth = 0;
let currentDock = 'bottom';

// Side panel states
let leftPanelCollapsed = true;
let rightPanelCollapsed = true;
let debugPanelVisible = false;
let debugUpdateInterval = null;

// Mini Calendar navigation states
let miniCalMonth = new Date().getMonth();
let miniCalYear = new Date().getFullYear();

// 💬 RESPONSE & CHAT SYSTEM
function setResponse(message) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.value = message;
    sendChat();
}

function addChatMessage(text, type) {
    const box = document.getElementById('chatBox');
    if (!box) return;

    const message = document.createElement('div');
    message.className = `chatMessage ${type}`;
    message.innerText = text;
    box.appendChild(message);
    box.scrollTop = box.scrollHeight;
}

async function loadChatHistory() {
    try {
        let history = [];
        let callSuccessful = false;

        if (localStorage.getItem('token')) {
            try {
                history = await apiCall('/api/chat/history');
                callSuccessful = true;
            } catch (e) {
                console.warn("Failed to load chat history from cloud.");
            }
        }

        if (!callSuccessful) {
            history = await ipcRenderer.invoke('get-chat-history', 50);
        }

        const box = document.getElementById('chatBox');
        if (!box) return;

        box.innerHTML = '';

        if (history && history.length > 0) {
            history.forEach(chat => {
                if (chat.userInput) addChatMessage(chat.userInput, 'user');
                if (chat.aiResponse) addChatMessage(chat.aiResponse, 'ai');
            });
        } else {
            addChatMessage('Hi — I can help you plan your week, move events, or protect focus time.', 'ai');
        }
    } catch (e) {
        console.error('Failed to load chat history:', e);
        addChatMessage('Hi — I can help you plan your week, move events, or protect focus time.', 'ai');
    }
}

// 🔄 LOAD TASKS
async function loadTasks() {
    const selected = new Date(selectedDate);
    const startDate = new Date(selected);
    startDate.setDate(startDate.getDate() - 45);
    const endDate = new Date(selected);
    endDate.setDate(endDate.getDate() + 45);
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    let loaded = [];
    try {
        loaded = await ipcRenderer.invoke('get-tasks-range', start, end);
    } catch (e) {
        console.error('Failed to load local tasks:', e);
        loaded = [];
    }

    tasks = Array.isArray(loaded) ? loaded.filter(task => task && task.text && task.date) : [];
    renderCalendar();
    renderMiniCalendar();
    updateTodayPanel();
}

// 🔍 CALENDAR LAYER FILTERING
function isLayerChecked(layerName) {
    const checkbox = document.querySelector(`input[data-layer="${layerName}"]`);
    return checkbox ? checkbox.checked : true;
}

function getTasksByDate(dateKey) {
    return tasks.filter(task => {
        if (task.date !== dateKey) return false;
        // Check if the calendar layer is active
        const calendar = task.calendar || 'personal';
        const formattedCalendar = calendar.charAt(0).toUpperCase() + calendar.slice(1).toLowerCase();
        return isLayerChecked(formattedCalendar);
    });
}

function getTaskColorClass(task) {
    const calendar = task.calendar || 'personal';
    return calendar.toLowerCase();
}

function createEventChip(task) {
    const chip = document.createElement('div');
    const colorClass = getTaskColorClass(task);
    const isCompleted = task.completed === 1 || task.completed === true;
    chip.className = `eventChip ${colorClass}${isCompleted ? ' completed' : ''}`;
    
    // Checkbox toggle element
    const checkbox = document.createElement('span');
    checkbox.className = `taskCheckboxIcon${isCompleted ? ' checked' : ''}`;
    checkbox.innerText = isCompleted ? '✓' : '';
    
    checkbox.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            if (isCompleted) {
                await ipcRenderer.invoke('uncomplete-task', task.id || task.text);
            } else {
                await ipcRenderer.invoke('complete-task', task.id || task.text);
            }
            await loadTasks();
            await updateLifeContinuityUI();
        } catch (err) {
            console.error("Failed to toggle task completion:", err);
        }
    };
    
    const label = document.createElement('span');
    label.className = 'eventLabel';
    label.innerText = task.calendar || 'Personal';

    const textSpan = document.createElement('span');
    textSpan.className = 'eventTextContent';
    textSpan.innerText = task.text;
    
    chip.appendChild(checkbox);
    chip.appendChild(label);
    chip.appendChild(textSpan);

    // Click handler to open the Focus Timer & Action Center
    chip.ondblclick = () => {
        openEventActionModal(task);
    };
    return chip;
}

// 📅 CALENDAR RENDERING
function renderCalendar() {
    const header = document.getElementById('calendarGridHeader');
    const grid = document.getElementById('calendarGrid');
    if (!header || !grid) return;

    const selected = new Date(selectedDate);
    const month = selected.getMonth();
    const year = selected.getFullYear();

    header.innerHTML = '';
    grid.innerHTML = '';

    document.getElementById('currentDate').innerText = formatCurrentLabel(selectedDate, activeView);

    // Render Event Summary
    const dayTasks = getTasksByDate(selectedDate);
    const summaryText = document.getElementById('eventSummaryText');
    if (summaryText) {
        const activeLayers = ['Personal', 'Study', 'Family', 'Routine', 'Focus'].filter(isLayerChecked).join(', ');
        summaryText.innerText = `${dayTasks.length} event${dayTasks.length === 1 ? '' : 's'} (${activeLayers})`;
    }

    if (activeView === 'month') {
        header.innerHTML = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<div>${day}</div>`).join('');
        grid.className = 'calendarGrid monthGrid';
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'dayCell empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateKey = new Date(year, month, day).toISOString().split('T')[0];
            const cell = document.createElement('div');
            const isSelected = dateKey === selectedDate;
            cell.className = `dayCell${isSelected ? ' selected' : ''}`;
            cell.onclick = () => {
                selectedDate = dateKey;
                document.getElementById('datePicker').value = formatDateString(selectedDate);
                renderCalendar();
                updateTodayPanel();
            };

            const headerSection = document.createElement('div');
            headerSection.className = 'dayHeader';
            headerSection.innerHTML = `<div class="dayNumber">${day}</div><div class="dayWeek">${new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'short' })}</div>`;

            const eventsSection = document.createElement('div');
            eventsSection.className = 'dayEvents';
            const cellTasks = getTasksByDate(dateKey);
            if (cellTasks.length) {
                cellTasks.slice(0, 3).forEach(task => eventsSection.appendChild(createEventChip(task)));
            }

            cell.appendChild(headerSection);
            cell.appendChild(eventsSection);
            grid.appendChild(cell);
        }
    } else if (activeView === 'day') {
        header.innerHTML = '';
        grid.className = 'calendarGrid dayGrid';

        const dateKey = selectedDate;
        const cell = document.createElement('div');
        cell.className = 'dayCell selected';

        const headerSection = document.createElement('div');
        headerSection.className = 'dayHeader';
        const date = new Date(dateKey);
        headerSection.innerHTML = `<div class="dayNumber">${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}</div><div class="dayWeek">${date.toLocaleDateString('default', { weekday: 'long' })}</div>`;

        const eventsSection = document.createElement('div');
        eventsSection.className = 'dayEvents';
        const cellTasks = getTasksByDate(dateKey);
        if (cellTasks.length) {
            cellTasks.forEach(task => eventsSection.appendChild(createEventChip(task)));
        } else {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'noEventsMsg';
            emptyMsg.innerText = 'No events scheduled for today.';
            eventsSection.appendChild(emptyMsg);
        }

        cell.appendChild(headerSection);
        cell.appendChild(eventsSection);
        grid.appendChild(cell);
    } else if (activeView === 'week') {
        header.innerHTML = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<div>${day}</div>`).join('');
        grid.className = 'calendarGrid weekGrid';
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        for (let i = 0; i < 7; i++) {
            const cellDate = new Date(weekStart);
            cellDate.setDate(weekStart.getDate() + i);
            const dateKey = cellDate.toISOString().split('T')[0];
            const cell = document.createElement('div');
            cell.className = 'dayCell';
            if (dateKey === selectedDate) cell.classList.add('selected');
            cell.onclick = () => {
                selectedDate = dateKey;
                document.getElementById('datePicker').value = formatDateString(selectedDate);
                renderCalendar();
                updateTodayPanel();
            };

            const headerSection = document.createElement('div');
            headerSection.className = 'dayHeader';
            headerSection.innerHTML = `<div class="dayNumber">${cellDate.getDate()}</div><div class="dayWeek">${cellDate.toLocaleDateString('en-US', { weekday: 'short' })}</div>`;

            const eventsSection = document.createElement('div');
            eventsSection.className = 'dayEvents';
            const cellTasks = getTasksByDate(dateKey);
            if (cellTasks.length) {
                cellTasks.forEach(task => eventsSection.appendChild(createEventChip(task)));
            } else {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'noEventsMsg';
                emptyMsg.innerText = 'No events';
                eventsSection.appendChild(emptyMsg);
            }

            cell.appendChild(headerSection);
            cell.appendChild(eventsSection);
            grid.appendChild(cell);
        }
    } else if (activeView === 'agenda') {
        header.innerHTML = '';
        grid.className = 'calendarGrid agendaList';
        const agendaTasks = tasks.filter(task => {
            const calendar = task.calendar || 'personal';
            const formattedCalendar = calendar.charAt(0).toUpperCase() + calendar.slice(1).toLowerCase();
            return isLayerChecked(formattedCalendar);
        }).sort((a, b) => a.date.localeCompare(b.date));
        
        agendaTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'dayCell';
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'dayHeader';
            dayHeader.innerHTML = `
                <div class="dayNumber">${new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div class="dayWeek">${new Date(task.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
            `;
            item.appendChild(dayHeader);
            
            const chip = createEventChip(task);
            item.appendChild(chip);
            
            grid.appendChild(item);
        });
        
        if (!agendaTasks.length) {
            const emptyState = document.createElement('div');
            emptyState.className = 'dayCell';
            emptyState.innerText = 'Nothing on the agenda. Add a task or enable more calendar layers.';
            grid.appendChild(emptyState);
        }
    } else if (activeView === 'focus') {
        header.innerHTML = '';
        grid.className = 'calendarGrid focusList';
        const focusTasks = tasks.filter(task => {
            const isFocus = (task.calendar && task.calendar.toLowerCase() === 'focus') || task.text.toLowerCase().includes('focus');
            return isFocus && isLayerChecked('Focus');
        });
        
        focusTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'dayCell';
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'dayHeader';
            dayHeader.innerHTML = `
                <div class="dayNumber">${new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div class="dayWeek">Focus Mode</div>
            `;
            item.appendChild(dayHeader);
            
            const chip = createEventChip(task);
            item.appendChild(chip);
            
            grid.appendChild(item);
        });
        
        if (!focusTasks.length) {
            const emptyState = document.createElement('div');
            emptyState.className = 'dayCell';
            emptyState.innerText = 'Only focus layer and top priority items are shown to protect attention.';
            grid.appendChild(emptyState);
        }
    }
}

function updateViewSelection(view) {
    activeView = view;
    document.querySelectorAll('.viewButton').forEach(button => {
        button.classList.toggle('active', button.dataset.view === view);
    });
    renderCalendar();
}

function formatCurrentLabel(dateString, view) {
    const date = new Date(dateString);
    if (view === 'day') {
        return `Agenda · ${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    }
    if (view === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    }
    if (view === 'agenda') {
        return `Agenda · ${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    }
    if (view === 'focus') {
        return `Focus · ${date.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    }
    return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
}

function formatDateString(isoString) {
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ➕ ADD TASK
async function addTask() {
    const input = document.getElementById('taskInput');
    const categorySelect = document.getElementById('taskCategory');
    if (!input) return;

    const text = input.value.trim();
    const calendar = categorySelect ? categorySelect.value : 'personal';

    if (!text) {
        addChatMessage('Tell me what to add to the calendar and I’ll schedule it.', 'ai');
        return;
    }

    const visSelect = document.getElementById('taskVisibilitySelect');
    const visibility = visSelect ? visSelect.value : 'private';
    const checkedPeers = [];
    if (visibility === 'shared_specific') {
        document.querySelectorAll('input[name="task_peer"]:checked').forEach(cb => {
            checkedPeers.push(cb.value);
        });
    }

    try {
        await ipcRenderer.invoke('add-task', { text, date: selectedDate, calendar, visibility, shared_with: checkedPeers });
    } catch (e) {
        console.error('Failed to add local task:', e);
    }

    input.value = '';
    // Uncheck and reset
    document.querySelectorAll('input[name="task_peer"]').forEach(cb => cb.checked = false);
    if (visSelect) visSelect.value = 'private';
    toggleTaskSharedPeers();

    addChatMessage(`Added “${text}” to ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, 'ai');
    await loadTasks();
    await updateJarvisSuggestions();
}

async function addLeftTask() {
    const input = document.getElementById('leftTaskInput');
    const categorySelect = document.getElementById('leftTaskCategory');
    if (!input) return;

    const text = input.value.trim();
    const calendar = categorySelect ? categorySelect.value : 'personal';

    if (!text) return;

    const visSelect = document.getElementById('leftTaskVisibilitySelect');
    const visibility = visSelect ? visSelect.value : 'private';
    const checkedPeers = [];
    if (visibility === 'shared_specific') {
        document.querySelectorAll('input[name="left_task_peer"]:checked').forEach(cb => {
            checkedPeers.push(cb.value);
        });
    }

    try {
        await ipcRenderer.invoke('add-task', { text, date: selectedDate, calendar, visibility, shared_with: checkedPeers });
    } catch (e) {
        console.error('Failed to add local left task:', e);
    }

    input.value = '';
    // Uncheck and reset
    document.querySelectorAll('input[name="left_task_peer"]').forEach(cb => cb.checked = false);
    if (visSelect) visSelect.value = 'private';
    toggleLeftTaskSharedPeers();

    addChatMessage(`Added “${text}” to ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, 'ai');
    await loadTasks();
    await updateJarvisSuggestions();
}

// 📅 MINI CALENDAR RENDER & NAVIGATION
function renderMiniCalendar() {
    const grid = document.getElementById('miniCalendarGrid');
    const title = document.getElementById('miniCalTitle');
    if (!grid || !title) return;

    grid.innerHTML = '';
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    title.innerText = `${monthNames[miniCalMonth]} ${miniCalYear}`;

    const firstDay = new Date(miniCalYear, miniCalMonth, 1).getDay();
    const totalDays = new Date(miniCalYear, miniCalMonth + 1, 0).getDate();

    // Empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'miniCalCell empty';
        grid.appendChild(empty);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        const dateKey = new Date(miniCalYear, miniCalMonth, day).toISOString().split('T')[0];
        const isActive = dateKey === selectedDate;
        
        cell.className = `miniCalCell${isActive ? ' active' : ''}`;
        cell.innerText = day;
        cell.onclick = () => {
            selectedDate = dateKey;
            document.getElementById('datePicker').value = formatDateString(selectedDate);
            renderCalendar();
            updateTodayPanel();
            renderMiniCalendar();
        };
        grid.appendChild(cell);
    }
}

function changeMiniMonth(offset) {
    miniCalMonth += offset;
    if (miniCalMonth < 0) {
        miniCalMonth = 11;
        miniCalYear -= 1;
    } else if (miniCalMonth > 11) {
        miniCalMonth = 0;
        miniCalYear += 1;
    }
    renderMiniCalendar();
}

// 📋 RIGHT PANEL DATA
function findTaskByText(queryText) {
    const q = queryText.toLowerCase().trim();
    if (!q) return null;
    let match = tasks.find(t => t.text.toLowerCase() === q);
    if (!match) {
        match = tasks.find(t => t.text.toLowerCase().includes(q));
    }
    return match;
}

function updateTodayPanel() {
    const list = document.getElementById('todayEventList');
    if (!list) return;

    list.innerHTML = '';
    const dayTasks = getTasksByDate(selectedDate);

    dayTasks.forEach(task => {
        const isCompleted = task.completed === 1 || task.completed === true;
        const item = document.createElement('div');
        item.className = `todayEventItem${isCompleted ? ' completed' : ''}`;
        item.style.cursor = 'pointer';
        item.style.position = 'relative';
        item.style.paddingLeft = '30px'; // Space for checkbox
        
        const color = getTaskColorClass(task);
        let indicatorColor = '#3f75ff';
        if (color === 'study') indicatorColor = '#10b981';
        if (color === 'family') indicatorColor = '#ef4444';
        if (color === 'routine') indicatorColor = '#64748b';
        if (color === 'focus') indicatorColor = '#8b5cf6';

        // Checkbox toggle element
        const checkbox = document.createElement('span');
        checkbox.className = `taskCheckboxIcon${isCompleted ? ' checked' : ''}`;
        checkbox.style.color = indicatorColor;
        checkbox.style.position = 'absolute';
        checkbox.style.left = '8px';
        checkbox.style.top = '50%';
        checkbox.style.transform = 'translateY(-50%)';
        checkbox.innerText = isCompleted ? '✓' : '';
        checkbox.onclick = async (e) => {
            e.stopPropagation();
            try {
                if (isCompleted) {
                    await ipcRenderer.invoke('uncomplete-task', task.id || task.text);
                } else {
                    await ipcRenderer.invoke('complete-task', task.id || task.text);
                }
                await loadTasks();
                await updateLifeContinuityUI();
            } catch (err) {
                console.error("Failed to toggle task completion:", err);
            }
        };

        const textSpan = document.createElement('span');
        textSpan.innerText = task.text;
        if (isCompleted) {
            textSpan.style.textDecoration = 'line-through';
            textSpan.style.color = 'var(--text-muted)';
        }

        item.appendChild(checkbox);
        item.appendChild(textSpan);

        item.ondblclick = () => {
            openEventActionModal(task);
        };
        list.appendChild(item);
    });

    if (!dayTasks.length) {
        const empty = document.createElement('div');
        empty.className = 'todayEventItem';
        empty.style.color = 'var(--text-muted)';
        empty.innerText = 'No events today.';
        list.appendChild(empty);
    }
}

// 💬 CHAT PARSER & IPC ROUTING
function computeRelativeDate(days) {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function parseChatCommand(message) {
    const command = message.toLowerCase();

    // Check complete/done
    const completeMatch = message.match(/\b(?:complete|done|finish|cross off|check off)\s+(?:task|event|session)?\s*(.+)/i);
    if (completeMatch) {
        const queryText = completeMatch[1].trim();
        const found = findTaskByText(queryText);
        if (found) {
            return { type: 'complete', task: found };
        }
        return { type: 'complete', text: queryText };
    }

    // Check uncomplete/undone
    const uncompleteMatch = message.match(/\b(?:uncomplete|undone|uncross|uncheck|undo complete|undo check)\s+(?:task|event|session)?\s*(.+)/i);
    if (uncompleteMatch) {
        const queryText = uncompleteMatch[1].trim();
        const found = findTaskByText(queryText);
        if (found) {
            return { type: 'uncomplete', task: found };
        }
        return { type: 'uncomplete', text: queryText };
    }

    // Check delete/remove
    const deleteMatch = message.match(/\b(?:delete|remove|cancel|discard)\s+(?:task|event|session)?\s*(.+)/i);
    if (deleteMatch) {
        const queryText = deleteMatch[1].trim();
        const found = findTaskByText(queryText);
        if (found) {
            return { type: 'delete', task: found };
        }
        return { type: 'delete', text: queryText };
    }

    if (/\b(add|create|schedule|book)\b/.test(command)) {
        const possibleDate = command.includes('tomorrow') ? computeRelativeDate(1) : command.includes('today') ? selectedDate : selectedDate;
        const text = message.replace(/.*?(?:add|create|schedule|book)\s*/i, '').trim();
        let calendar = 'personal';
        if (command.includes('study')) calendar = 'study';
        if (command.includes('family')) calendar = 'family';
        if (command.includes('routine')) calendar = 'routine';
        if (command.includes('focus')) calendar = 'focus';

        if (text) {
            return { type: 'create', text, date: possibleDate, calendar };
        }
    }

    if (/\b(show|view|open)\b.*\b(personal|study|family|routine|focus)\b/.test(command)) {
        const layer = ['personal', 'study', 'family', 'routine', 'focus'].find(layer => command.includes(layer));
        return layer ? { type: 'toggleLayer', layer } : null;
    }

    if (/\b(plan|review|schedule|organize)\b/.test(command)) {
        return { type: 'review' };
    }

    return null;
}

async function toggleLayer(layerName) {
    const normalized = layerName.charAt(0).toUpperCase() + layerName.slice(1).toLowerCase();
    const checkbox = document.querySelector(`input[data-layer="${normalized}"]`);
    if (!checkbox) return `I couldn’t find the ${normalized} layer.`;
    checkbox.checked = !checkbox.checked;
    renderCalendar();
    return `${checkbox.checked ? 'Enabled' : 'Disabled'} ${normalized} layer.`;
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    addChatMessage(message, 'user');
    input.value = '';

    const command = parseChatCommand(message);
    if (command?.type === 'create') {
        await ipcRenderer.invoke('add-task', { text: command.text, date: command.date, calendar: command.calendar });
        await loadTasks();
        addChatMessage(`Okay. I added “${command.text}” on ${new Date(command.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, 'ai');
        return;
    }

    if (command?.type === 'complete') {
        const identifier = command.task ? (command.task.id || command.task.text) : command.text;
        const text = command.task ? command.task.text : command.text;
        await ipcRenderer.invoke('complete-task', identifier);
        await loadTasks();
        await updateLifeContinuityUI();
        addChatMessage(`Marked task “${text}” as completed. ✓`, 'ai');
        return;
    }

    if (command?.type === 'uncomplete') {
        const identifier = command.task ? (command.task.id || command.task.text) : command.text;
        const text = command.task ? command.task.text : command.text;
        await ipcRenderer.invoke('uncomplete-task', identifier);
        await loadTasks();
        await updateLifeContinuityUI();
        addChatMessage(`Marked task “${text}” as incomplete.`, 'ai');
        return;
    }

    if (command?.type === 'delete') {
        const identifier = command.task ? (command.task.id || command.task.text) : command.text;
        const text = command.task ? command.task.text : command.text;
        await ipcRenderer.invoke('delete-task', identifier);
        await loadTasks();
        await updateLifeContinuityUI();
        addChatMessage(`Removed event “${text}” from calendar.`, 'ai');
        return;
    }

    if (command?.type === 'toggleLayer') {
        addChatMessage(await toggleLayer(command.layer), 'ai');
        return;
    }

    if (command?.type === 'review') {
        const visibleTasks = tasks.filter(task => task.date === selectedDate);
        addChatMessage(`I found ${visibleTasks.length} item${visibleTasks.length === 1 ? '' : 's'} on ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. What should I do next?`, 'ai');
        return;
    }

    let responseText = '';
    let response = null;
    let callSuccessful = false;

    if (localStorage.getItem('token')) {
        try {
            response = await apiCall('/api/chat', 'POST', { input: message, selectedDate, activeView, taskCount: tasks.length });
            responseText = response?.response || 'I’m here. Let’s start fresh.';
            callSuccessful = true;
        } catch (e) {
            console.warn("Direct Supabase Chat failed, falling back to local orchestrator.");
        }
    }

    if (!callSuccessful) {
        response = await ipcRenderer.invoke('ai-response', { userInput: message, selectedDate, activeView, taskCount: tasks.length });
        responseText = response?.response || 'I’m here. Let’s start fresh.';
        await ipcRenderer.invoke('save-chat', message, responseText).catch(() => {});
    }

    addChatMessage(responseText, 'ai');

    // Refresh memory UI elements on new interaction
    await updateLifeContinuityUI();
    await updateMemoryCardsUI();
    await updateIdentityTimelineUI();
    await updateJarvisSuggestions();

    if (response && response.state && response.state.proposal) {
        renderProposalCard(response.state.proposal);
    }
}

// 🧠 COGNITIVE DIAGNOSTICS CONTROL
async function updateDebugPanel() {
    if (!debugPanelVisible) return;
    try {
        const diagnostics = await ipcRenderer.invoke('get-complete-diagnostics');
        if (!diagnostics) return;

        // Diagnostics summary
        document.getElementById('debugQuickSummary').innerHTML = formatDebugData({
            'Mode': diagnostics.debug?.cognitiveMode || 'N/A',
            'Risk Level': diagnostics.health?.overallRisk?.level || 'N/A',
            'Consistency': diagnostics.identity?.consistency || 'N/A',
            'Emotion': diagnostics.emotional?.current || 'N/A',
            'Intensity': diagnostics.emotional?.intensity || 'N/A'
        });

        // Emotional State
        document.getElementById('debugEmotional').innerHTML = formatDebugData({
            'Current State': diagnostics.emotional?.current,
            'Intensity': diagnostics.emotional?.intensity,
            'Trend': diagnostics.emotional?.trend,
            'Memory Length': diagnostics.emotional?.memory?.length || 0
        });

        // Identity
        document.getElementById('debugIdentity').innerHTML = formatDebugData({
            'Stability': diagnostics.identity?.stability,
            'Consistency': diagnostics.identity?.consistency,
            'Anchor Count': diagnostics.identity?.personalityAnchors?.length || 0,
            'Tone Drift': diagnostics.identity?.toneDrift
        });

        // Memory
        document.getElementById('debugMemory').innerHTML = formatDebugData({
            'Total Memories': diagnostics.memory?.totalMemories,
            'Short Term': diagnostics.memory?.byType?.shortTerm?.count || 0,
            'Long Term': diagnostics.memory?.byType?.longTerm?.count || 0,
            'Core': diagnostics.memory?.byType?.coreIdentity?.count || 0
        });

        // Presence
        document.getElementById('debugPresence').innerHTML = formatDebugData({
            'Pacing': diagnostics.presence?.pacing,
            'Attention Focus': diagnostics.presence?.attentionFocus,
            'Silence Gap': diagnostics.presence?.silenceGap,
            'Rhythm': diagnostics.presence?.interactionRhythm
        });

        // Recursion Safety
        document.getElementById('debugRecursion').innerHTML = formatDebugData({
            'Loop Detected': diagnostics.recursion?.loopDetected,
            'Depth': diagnostics.recursion?.loopDepth,
            'Trigger Count': diagnostics.recursion?.triggerCount
        });

        // Compression
        document.getElementById('debugCompression').innerHTML = formatDebugData({
            'Compression Ratio': diagnostics.compression?.ratio,
            'Active Tokens': diagnostics.compression?.activeTokens,
            'Last Pruned': new Date(diagnostics.compression?.lastPruned || Date.now()).toLocaleTimeString()
        });

        // Health
        const healthIssues = diagnostics.health?.issues || [];
        document.getElementById('debugHealth').innerHTML = formatDebugData({
            'Status': diagnostics.health?.status,
            'Warnings': diagnostics.health?.warnings?.length || 0,
            'Errors': diagnostics.health?.errors?.length || 0,
            'Issues': healthIssues.length > 0 ? healthIssues.join(', ') : 'None'
        }, healthIssues.length > 0 ? 'warning' : 'success');

        // Debug Info
        const potentialIssues = diagnostics.debug?.potentialIssues || [];
        document.getElementById('debugDebug').innerHTML = formatDebugData({
            'Mode': diagnostics.debug?.cognitiveMode,
            'Next Action': diagnostics.debug?.nextRecommendedAction,
            'Potential Issues': potentialIssues.length > 0 
                ? potentialIssues.map(i => `${i.severity}: ${i.issue}`).join('\n')
                : 'None detected'
        }, potentialIssues.length > 0 ? 'warning' : 'info');

    } catch (error) {
        console.error('Debug panel update error:', error);
    }
}

function formatDebugData(data, statusClass = 'info') {
    let html = '';
    for (const [key, value] of Object.entries(data)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
        html += `<div><strong>${key}:</strong> ${displayValue}</div>`;
    }
    return `<div class="${statusClass}">${html}</div>`;
}

function toggleDebugPanel() {
    debugPanelVisible = !debugPanelVisible;
    const panel = document.getElementById('debugPanel');
    if (!panel) return;
    
    panel.classList.toggle('visible', debugPanelVisible);
    
    if (debugPanelVisible) {
        updateDebugPanel();
        debugUpdateInterval = setInterval(updateDebugPanel, 2000);
    } else {
        clearInterval(debugUpdateInterval);
    }
}

async function updateObservatoryUI() {
    const pane = document.getElementById('tab-insights');
    if (!pane || !pane.classList.contains('active')) return;

    try {
        const stats = await ipcRenderer.invoke('get-observatory-telemetry');
        if (!stats) return;

        // AI Activity
        document.getElementById('obsMsgCount').innerText = stats.messagesProcessed;
        document.getElementById('obsActiveAgent').innerText = stats.activeAgent;
        document.getElementById('obsAvgLatency').innerText = `${stats.avgLatency}ms`;
        document.getElementById('obsTokens').innerText = stats.totalTokens;

        // Sync Activity
        document.getElementById('obsSyncStatus').innerText = stats.syncStatus === 'Online' ? '● Online' : '○ Offline';
        document.getElementById('obsSyncStatus').style.color = stats.syncStatus === 'Online' ? '#10b981' : '#ef4444';
        document.getElementById('obsSyncLatency').innerText = `${stats.avgSyncLatency}ms`;
        document.getElementById('obsConflicts').innerText = stats.conflictsResolved;
        document.getElementById('obsLastSync').innerText = stats.lastSyncTime;

        // Calendar Activity
        document.getElementById('obsEventsCreated').innerText = stats.eventsCreated;
        document.getElementById('obsEventsCompleted').innerText = stats.eventsCompleted;
        document.getElementById('obsFocusHours').innerText = `${stats.focusHours} hrs`;

        // User Activity
        document.getElementById('obsDailyGoal').innerText = stats.dailyGoal;
        document.getElementById('obsTaskRate').innerText = `${stats.taskRate}%`;
        document.getElementById('obsStreak').innerText = stats.streak;

        // Cognitive Profile Activity
        const profile = await ipcRenderer.invoke('get-adaptive-cognitive-profile');
        if (profile) {
            document.getElementById('obsBestFocus').innerText = profile.best_focus_time || 'N/A';
            document.getElementById('obsLowEnergy').innerText = profile.low_energy_time || 'N/A';
            document.getElementById('obsFocusSession').innerText = `${profile.preferred_session_length || 45} mins`;
            
            const triggers = profile.stress_triggers || [];
            document.getElementById('obsTriggers').innerText = triggers.length > 0 ? triggers.join(', ') : 'None';
        }

    } catch (e) {
        console.error('Failed to update Observatory UI:', e);
    }
}

async function recalculateProfileUI() {
    const btn = document.getElementById('recalcProfileBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Recalculating...';
    }
    try {
        const profile = await ipcRenderer.invoke('recalculate-cognitive-profile');
        if (profile) {
            document.getElementById('obsBestFocus').innerText = profile.best_focus_time || 'N/A';
            document.getElementById('obsLowEnergy').innerText = profile.low_energy_time || 'N/A';
            document.getElementById('obsFocusSession').innerText = `${profile.preferred_session_length || 45} mins`;
            
            const triggers = profile.stress_triggers || [];
            document.getElementById('obsTriggers').innerText = triggers.length > 0 ? triggers.join(', ') : 'None';
            
            alert('Cognitive profile recalculated successfully!');
        }
    } catch (e) {
        alert('Failed to recalculate cognitive profile: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Recalculate Profile';
        }
    }
}
window.recalculateProfileUI = recalculateProfileUI;

// 🎛️ SIDEBAR / PANEL TOGGLES
function toggleLeftPanel() {
    leftPanelCollapsed = !leftPanelCollapsed;
    const panel = document.getElementById('calendarLeftPanel');
    if (panel) {
        panel.classList.toggle('collapsed', leftPanelCollapsed);
    }
    // Main quick add bar visibility toggles based on sidebar state
    const mainQuickAdd = document.getElementById('mainQuickAddBar');
    if (mainQuickAdd) {
        mainQuickAdd.style.display = leftPanelCollapsed ? 'flex' : 'none';
    }
}

function toggleRightPanel() {
    rightPanelCollapsed = !rightPanelCollapsed;
    const panel = document.getElementById('calendarRightPanel');
    if (panel) {
        panel.classList.toggle('collapsed', rightPanelCollapsed);
    }
}

// 🔄 WINDOW ONLOAD & LISTENERS
window.onload = () => {
    // Set date input value
    document.getElementById('datePicker').value = formatDateString(selectedDate);
    
    // View switching buttons
    document.querySelectorAll('.viewButton').forEach(button => {
        button.addEventListener('click', () => updateViewSelection(button.dataset.view));
    });

    // Month Navigation
    document.getElementById('prevMonth').onclick = () => changeMonth(-1);
    document.getElementById('nextMonth').onclick = () => changeMonth(1);

    // Collapsible Sidebar Toggles
    const menuToggle = document.getElementById('menuToggle');
    const toggleMenuBtn = document.getElementById('toggleMenuBtn');
    if (menuToggle) menuToggle.onclick = toggleLeftPanel;
    if (toggleMenuBtn) toggleMenuBtn.onclick = toggleLeftPanel;

    const togglePanelBtn = document.getElementById('togglePanelBtn');
    if (togglePanelBtn) togglePanelBtn.onclick = toggleRightPanel;

    const toggleDebugBtn = document.getElementById('toggleDebugBtn');
    if (toggleDebugBtn) toggleDebugBtn.onclick = toggleDebugPanel;

    // Right Panel Tabs Toggling
    document.querySelectorAll('.rightPanelTab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.rightPanelTab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tabPane').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetPane = document.getElementById(`tab-${tab.dataset.tab}`);
            if (targetPane) targetPane.classList.add('active');

            if (tab.dataset.tab === 'insights') {
                await updateObservatoryUI();
            } else if (tab.dataset.tab === 'reflection') {
                await updateReflectionUI();
                await updateMemoryCardsUI();
                await updateLifeContinuityUI();
                await updateIdentityTimelineUI();
            } else if (tab.dataset.tab === 'goals') {
                await updateGoalsUI();
            } else if (tab.dataset.tab === 'notes') {
                await updateNotesUI();
            } else if (tab.dataset.tab === 'people') {
                await updatePeopleUI();
            }
        });
    });

    // Periodically update Observatory UI (2-second interval)
    setInterval(updateObservatoryUI, 2000);

    // Layer checkboxes rendering triggers
    document.querySelectorAll('.layerPill input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            renderCalendar();
        });
    });

    // Mini Calendar Buttons
    document.getElementById('miniPrevMonth').onclick = () => changeMiniMonth(-1);
    document.getElementById('miniNextMonth').onclick = () => changeMiniMonth(1);

    // Splitter Pane Resizer
    document.getElementById('splitter').addEventListener('mousedown', startResize);
    window.addEventListener('mousemove', resizePane);
    window.addEventListener('mouseup', stopResize);

    // Load past chat history from DB
    loadChatHistory();

    // Enter key submit on chat input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                sendChat();
            }
        });
    }

    // Make functions globally accessible for inline HTML calls
    window.toggleDebugPanel = toggleDebugPanel;
    window.setResponse = setResponse;
    window.sendChat = sendChat;
    window.addTask = addTask;
    window.addLeftTask = addLeftTask;
    window.toggleDock = toggleDock;
    window.selectProfile = selectProfile;
    window.submitAuth = submitAuth;
    window.logoutAuth = logoutAuth;
    window.toggleAuthMode = toggleAuthMode;
    window.loginWithGoogle = loginWithGoogle;
    window.submitJournal = submitJournal;
    window.triggerEditReflection = triggerEditReflection;
    window.triggerDeleteReflection = triggerDeleteReflection;
    window.submitCreateGoal = submitCreateGoal;
    window.triggerDeleteGoal = triggerDeleteGoal;
    window.triggerAddProject = triggerAddProject;
    window.triggerAddSubject = triggerAddSubject;
    window.triggerUpdateMastery = triggerUpdateMastery;

    window.toggleNoteSharedPeers = toggleNoteSharedPeers;
    window.toggleTaskSharedPeers = toggleTaskSharedPeers;
    window.toggleLeftTaskSharedPeers = toggleLeftTaskSharedPeers;
    window.toggleJarvisWhy = toggleJarvisWhy;
    window.dismissJarvisSuggestion = dismissJarvisSuggestion;

    // Initialize personalization settings
    initializeSettings();

    // Start loading
    loadTasks();
};

function changeMonth(offset) {
    const date = new Date(selectedDate);
    date.setMonth(date.getMonth() + offset);
    selectedDate = date.toISOString().split('T')[0];
    document.getElementById('datePicker').value = formatDateString(selectedDate);
    
    // Sync mini-calendar month display
    miniCalMonth = date.getMonth();
    miniCalYear = date.getFullYear();

    renderCalendar();
    renderMiniCalendar();
    updateTodayPanel();
}

function startResize(event) {
    isResizing = true;
    if (currentDock === 'bottom') {
        startY = event.clientY;
        startHeight = document.querySelector('.calendarWorkspace').getBoundingClientRect().height;
    } else {
        startX = event.clientX;
        startWidth = document.querySelector('.calendarWorkspace').getBoundingClientRect().width;
    }
}

function resizePane(event) {
    if (!isResizing) return;
    const calendar = document.querySelector('.calendarWorkspace');
    const chat = document.querySelector('.chatWorkspace');
    
    if (currentDock === 'bottom') {
        const delta = event.clientY - startY;
        const total = calendar.parentElement.getBoundingClientRect().height - 12;
        const newHeight = Math.min(Math.max(startHeight + delta, total * 0.4), total * 0.85);
        calendar.style.flex = `0 0 ${newHeight}px`;
        calendar.style.width = '';
        chat.style.flex = '1';
        chat.style.width = '';
    } else {
        const delta = event.clientX - startX;
        const total = calendar.parentElement.getBoundingClientRect().width - 12;
        const newWidth = Math.min(Math.max(startWidth + delta, total * 0.4), total * 0.8);
        calendar.style.flex = `0 0 ${newWidth}px`;
        calendar.style.height = '';
        chat.style.flex = '1';
        chat.style.height = '';
    }
}

function stopResize() {
    isResizing = false;
}

function toggleDock() {
    const mainShell = document.querySelector('.mainShell');
    const calendar = document.querySelector('.calendarWorkspace');
    const chat = document.querySelector('.chatWorkspace');
    
    if (currentDock === 'bottom') {
        currentDock = 'right';
        mainShell.classList.add('dock-right');
        calendar.style.flex = '0 0 65%';
        chat.style.flex = '1';
    } else {
        currentDock = 'bottom';
        mainShell.classList.remove('dock-right');
        calendar.style.flex = '0 0 70%';
        chat.style.flex = '1';
    }
}

// ========================================
// ⚙️ SETTINGS & PERSONALIZATION LOGIC
// ========================================

const THEMES = {
    light: {
        '--bg-app': '#f4f6fa',
        '--bg-panel': '#ffffff',
        '--bg-chat-box': '#f8fafc',
        '--border-color': '#e2e8f0',
        '--text-main': '#1e293b',
        '--text-muted': '#64748b'
    },
    dark: {
        '--bg-app': '#0f172a',
        '--bg-panel': '#1e293b',
        '--bg-chat-box': '#0f172a',
        '--border-color': '#334155',
        '--text-main': '#f8fafc',
        '--text-muted': '#94a3b8'
    },
    ocean: {
        '--bg-app': '#f0fdfa',
        '--bg-panel': '#ffffff',
        '--bg-chat-box': '#f4fbf9',
        '--border-color': '#ccfbf1',
        '--text-main': '#0f766e',
        '--text-muted': '#14b8a6'
    },
    sunset: {
        '--bg-app': '#fff7ed',
        '--bg-panel': '#ffffff',
        '--bg-chat-box': '#fffaf5',
        '--border-color': '#ffedd5',
        '--text-main': '#c2410c',
        '--text-muted': '#f97316'
    },
    emerald: {
        '--bg-app': '#f0fdf4',
        '--bg-panel': '#ffffff',
        '--bg-chat-box': '#f4fcf7',
        '--border-color': '#dcfce7',
        '--text-main': '#15803d',
        '--text-muted': '#22c55e'
    },
    violet: {
        '--bg-app': '#faf5ff',
        '--bg-panel': '#ffffff',
        '--bg-chat-box': '#fdfaff',
        '--border-color': '#f3e8ff',
        '--text-main': '#6d28d9',
        '--text-muted': '#a855f7'
    }
};

const ACCENTS = {
    blue: {
        '--cal-personal': '#3f75ff',
        '--cal-personal-soft': '#edf2ff'
    },
    emerald: {
        '--cal-personal': '#10b981',
        '--cal-personal-soft': '#ecfdf5'
    },
    orange: {
        '--cal-personal': '#f97316',
        '--cal-personal-soft': '#fff7ed'
    },
    purple: {
        '--cal-personal': '#a855f7',
        '--cal-personal-soft': '#faf5ff'
    },
    red: {
        '--cal-personal': '#ef4444',
        '--cal-personal-soft': '#fef2f2'
    }
};

function applyTheme(themeId) {
    const theme = THEMES[themeId] || THEMES.light;
    localStorage.setItem('theme', themeId);
    
    // Apply all variables on root
    for (const [key, value] of Object.entries(theme)) {
        document.documentElement.style.setProperty(key, value);
    }
    
    // Update active class in theme options UI
    document.querySelectorAll('.themeOption').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === themeId);
    });

    // Sync to SQLite
    ipcRenderer.invoke('set-sync-meta', 'app_theme', themeId).catch(err => {
        console.error("Failed to store app_theme in sync_meta:", err);
    });
}

function applyAccent(accentId) {
    const accent = ACCENTS[accentId] || ACCENTS.blue;
    localStorage.setItem('accent', accentId);
    
    // Apply all variables on root
    for (const [key, value] of Object.entries(accent)) {
        document.documentElement.style.setProperty(key, value);
    }
    
    // Update active class in accent options UI
    document.querySelectorAll('.accentOption').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.accent === accentId);
    });

    // Sync to SQLite
    ipcRenderer.invoke('set-sync-meta', 'app_accent', accentId).catch(err => {
        console.error("Failed to store app_accent in sync_meta:", err);
    });
}

function setAppName(name) {
    if (!name) name = "Chrono";
    localStorage.setItem('appName', name);
    
    // Update Document Title
    document.title = name;
    
    // Update Brand Icon
    const brandIcon = document.getElementById('brandIcon');
    if (brandIcon) brandIcon.innerText = name.charAt(0).toUpperCase();
    
    // Update Chat Title
    const chatTitle = document.querySelector('.chatTitle');
    if (chatTitle) chatTitle.innerText = name + ' AI';
    
    // Update Chat Input Placeholder
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = `Message ${name}...`;
    }

    // Sync settings appNameInput text box
    const appNameInput = document.getElementById('appNameInput');
    if (appNameInput && appNameInput.value !== name) {
        appNameInput.value = name;
    }

    // Sync to SQLite
    ipcRenderer.invoke('set-sync-meta', 'app_name', name).catch(err => {
        console.error("Failed to store app_name in sync_meta:", err);
    });
}

async function selectProfile(profileId) {
    try {
        let success = false;
        if (localStorage.getItem('token')) {
            try {
                await apiCall('/api/profiles/me', 'PUT', { cognitiveStyle: profileId });
                success = true;
            } catch (e) {
                console.warn("Failed to update profile style in the cloud.");
            }
        }
        
        // Save locally for offline fallback compatibility
        const result = await ipcRenderer.invoke('set-cognitive-profile', profileId);
        if (success || (result && result.success)) {
            // Update active class in profile UI
            document.querySelectorAll('.profileOption').forEach(opt => {
                const isActive = opt.dataset.profile === profileId;
                opt.classList.toggle('active', isActive);
                const pill = opt.querySelector('.profilePill');
                if (pill) {
                    pill.innerText = isActive ? 'Active' : (opt.dataset.profile === 'adaptive' ? 'Active' : (opt.dataset.profile === 'architect' ? 'Analytical' : (opt.dataset.profile === 'observer' ? 'Observation' : 'Gentle')));
                }
            });
        }
    } catch (e) {
        console.error("Failed to select profile:", e);
    }
}

async function loadCognitiveProfile() {
    try {
        const profileState = await ipcRenderer.invoke('get-cognitive-profile');
        if (profileState && profileState.activeProfile) {
            const profileId = profileState.activeProfile;
            document.querySelectorAll('.profileOption').forEach(opt => {
                const isActive = opt.dataset.profile === profileId;
                opt.classList.toggle('active', isActive);
                const pill = opt.querySelector('.profilePill');
                if (pill) {
                    pill.innerText = isActive ? 'Active' : (opt.dataset.profile === 'adaptive' ? 'Active' : (opt.dataset.profile === 'architect' ? 'Analytical' : (opt.dataset.profile === 'observer' ? 'Observation' : 'Gentle')));
                }
            });
        }
    } catch (e) {
        console.error("Failed to load cognitive profile:", e);
    }
}

function showSettingsView(show) {
    const calendarHeader = document.querySelector('.calendarHeader');
    const calendarControls = document.querySelector('.calendarControls');
    const calendarContent = document.querySelector('.calendarContent');
    const settingsContent = document.getElementById('settingsContent');
    const cloudContent = document.getElementById('cloudContent');
    
    if (show) {
        if (calendarHeader) calendarHeader.style.display = 'none';
        if (calendarControls) calendarControls.style.display = 'none';
        if (calendarContent) calendarContent.style.display = 'none';
        if (settingsContent) settingsContent.style.display = 'flex';
        if (cloudContent) cloudContent.style.display = 'none';
        updateSettingsFrontsUI();
    } else {
        if (calendarHeader) calendarHeader.style.display = 'flex';
        if (calendarControls) calendarControls.style.display = 'flex';
        if (calendarContent) calendarContent.style.display = 'flex';
        if (settingsContent) settingsContent.style.display = 'none';
        if (cloudContent) cloudContent.style.display = 'none';
    }
}

function showCloudView(show) {
    const calendarHeader = document.querySelector('.calendarHeader');
    const calendarControls = document.querySelector('.calendarControls');
    const calendarContent = document.querySelector('.calendarContent');
    const settingsContent = document.getElementById('settingsContent');
    const cloudContent = document.getElementById('cloudContent');
    
    if (show) {
        if (calendarHeader) calendarHeader.style.display = 'none';
        if (calendarControls) calendarControls.style.display = 'none';
        if (calendarContent) calendarContent.style.display = 'none';
        if (settingsContent) settingsContent.style.display = 'none';
        if (cloudContent) cloudContent.style.display = 'flex';
    } else {
        if (calendarHeader) calendarHeader.style.display = 'flex';
        if (calendarControls) calendarControls.style.display = 'flex';
        if (calendarContent) calendarContent.style.display = 'flex';
        if (settingsContent) settingsContent.style.display = 'none';
        if (cloudContent) cloudContent.style.display = 'none';
    }
}

function setupSideNav() {
    const navItems = document.querySelectorAll('.sideNavItem');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.dataset.nav;
            if (target === 'settings') {
                showSettingsView(true);
            } else if (target === 'cloud') {
                showCloudView(true);
                updateCloudPanelUI();
            } else {
                showSettingsView(false);
                showCloudView(false);
                if (target === 'today') {
                    selectedDate = new Date().toISOString().split('T')[0];
                    document.getElementById('datePicker').value = formatDateString(selectedDate);
                    loadTasks();
                } else if (target === 'goals') {
                    if (rightPanelCollapsed) toggleRightPanel();
                    const goalsTab = document.querySelector('.rightPanelTab[data-tab="goals"]');
                    if (goalsTab) goalsTab.click();
                } else if (target === 'routines') {
                    const routineCheckbox = document.querySelector('input[data-layer="Routine"]');
                    if (routineCheckbox) {
                        routineCheckbox.checked = !routineCheckbox.checked;
                        renderCalendar();
                    }
                }
            }
        });
    });
}

async function initializeSettings() {
    // Setup Settings theme/accent click listeners
    document.querySelectorAll('.themeOption').forEach(opt => {
        opt.addEventListener('click', () => applyTheme(opt.dataset.theme));
    });

    document.querySelectorAll('.accentOption').forEach(opt => {
        opt.addEventListener('click', () => applyAccent(opt.dataset.accent));
    });

    document.querySelectorAll('.profileOption').forEach(opt => {
        opt.addEventListener('click', () => selectProfile(opt.dataset.profile));
    });

    // Load values from SQLite if local storage is missing them, to restore preferences
    let savedTheme = localStorage.getItem('theme');
    let savedAccent = localStorage.getItem('accent');
    let savedAppName = localStorage.getItem('appName');
    let savedUserName = localStorage.getItem('userName');
    let savedUserEmail = localStorage.getItem('userEmail');

    try {
        if (!savedTheme) {
            const dbTheme = await ipcRenderer.invoke('get-sync-meta', 'app_theme');
            if (dbTheme) savedTheme = dbTheme;
        }
        if (!savedAccent) {
            const dbAccent = await ipcRenderer.invoke('get-sync-meta', 'app_accent');
            if (dbAccent) savedAccent = dbAccent;
        }
        if (!savedAppName) {
            const dbAppName = await ipcRenderer.invoke('get-sync-meta', 'app_name');
            if (dbAppName) savedAppName = dbAppName;
        }
        if (!savedUserName) {
            const dbUserName = await ipcRenderer.invoke('get-sync-meta', 'user_name');
            if (dbUserName) savedUserName = dbUserName;
        }
        if (!savedUserEmail) {
            const dbUserEmail = await ipcRenderer.invoke('get-sync-meta', 'user_email');
            if (dbUserEmail) savedUserEmail = dbUserEmail;
        }
    } catch (e) {
        console.error("Failed to read preferences from SQLite sync_meta:", e);
    }

    savedTheme = savedTheme || 'light';
    savedAccent = savedAccent || 'blue';
    savedAppName = savedAppName || 'Chrono';
    savedUserName = savedUserName || 'Planner';
    savedUserEmail = savedUserEmail || '';

    // Set up settings input values and register change listeners
    const appNameInput = document.getElementById('appNameInput');
    if (appNameInput) {
        appNameInput.value = savedAppName;
        appNameInput.addEventListener('input', (e) => {
            setAppName(e.target.value.trim());
        });
    }

    const userNameInput = document.getElementById('userNameInput');
    if (userNameInput) {
        userNameInput.value = savedUserName;
        userNameInput.addEventListener('input', (e) => {
            setUserName(e.target.value.trim());
        });
    }

    const userEmailInput = document.getElementById('userEmailInput');
    if (userEmailInput) {
        userEmailInput.value = savedUserEmail;
        userEmailInput.addEventListener('input', (e) => {
            setUserEmail(e.target.value.trim());
        });
    }

    // Prefill the cloud account auth forms
    const authEmailInput = document.getElementById('authEmailInput');
    if (authEmailInput && !authEmailInput.value) {
        authEmailInput.value = savedUserEmail;
    }
    const authNameInput = document.getElementById('authNameInput');
    if (authNameInput && !authNameInput.value) {
        authNameInput.value = savedUserName;
    }

    // Apply settings to system states
    applyTheme(savedTheme);
    applyAccent(savedAccent);
    setAppName(savedAppName);
    setUserName(savedUserName);
    setUserEmail(savedUserEmail);

    loadCognitiveProfile();
    setupSideNav();
    checkOnboarding();
}

// Onboarding Helper Functions
let onboardingTheme = 'light';
let onboardingAccent = 'blue';
let onboardingProfile = 'adaptive';

function checkOnboarding() {
    const obComplete = localStorage.getItem('onboardingComplete');
    if (obComplete === 'true') {
        return;
    }
    
    // Show onboarding screen
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
    
    // Bind onboarding themes
    document.querySelectorAll('.obThemeOption').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.obThemeOption').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            onboardingTheme = opt.dataset.theme;
            applyTheme(onboardingTheme);
        });
    });
    
    // Bind onboarding accents
    document.querySelectorAll('.obAccentOption').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.obAccentOption').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            onboardingAccent = opt.dataset.accent;
            applyAccent(onboardingAccent);
            
            // Live update onboarding Welcome logo background
            const obLogo = document.getElementById('obLogo');
            if (obLogo) {
                obLogo.style.background = `var(--cal-personal)`;
            }
        });
    });
    
    // Bind onboarding app name renaming to update the logo letter dynamically
    const obAppNameInput = document.getElementById('obAppNameInput');
    if (obAppNameInput) {
        obAppNameInput.addEventListener('input', (e) => {
            const val = e.target.value.trim() || 'Chrono';
            const obLogo = document.getElementById('obLogo');
            if (obLogo) {
                obLogo.innerText = val.charAt(0).toUpperCase();
            }
            setAppName(val);
        });
    }

    // Bind onboarding profiles list
    document.querySelectorAll('.obProfileOption').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.obProfileOption').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            onboardingProfile = opt.dataset.profile;
        });
    });
}

function setUserName(name) {
    if (!name) name = "Planner";
    localStorage.setItem('userName', name);
    
    // Update Greeting in sidebar
    const greetingEl = document.getElementById('userGreeting');
    if (greetingEl) {
        greetingEl.innerText = `Hello, ${name}`;
    }
    
    // Update Settings input text box
    const userNameInput = document.getElementById('userNameInput');
    if (userNameInput && userNameInput.value !== name) {
        userNameInput.value = name;
    }

    // Sync to SQLite
    ipcRenderer.invoke('set-sync-meta', 'user_name', name).catch(err => {
        console.error("Failed to store user_name in sync_meta:", err);
    });
}

function setUserEmail(email) {
    if (!email) email = "";
    localStorage.setItem('userEmail', email);
    
    // Sync Settings input text box
    const userEmailInput = document.getElementById('userEmailInput');
    if (userEmailInput && userEmailInput.value !== email) {
        userEmailInput.value = email;
    }
    
    // Sync Auth Email input text box
    const authEmailInput = document.getElementById('authEmailInput');
    if (authEmailInput && authEmailInput.value !== email) {
        authEmailInput.value = email;
    }

    // Sync to SQLite
    ipcRenderer.invoke('set-sync-meta', 'user_email', email).catch(err => {
        console.error("Failed to store user_email in sync_meta:", err);
    });
}

async function submitOnboarding() {
    const userNameVal = document.getElementById('obUserNameInput').value.trim() || 'Planner';
    const userEmailVal = document.getElementById('obUserEmailInput') ? document.getElementById('obUserEmailInput').value.trim() : '';
    const appNameVal = document.getElementById('obAppNameInput').value.trim() || 'Chrono';
    const obUseCloud = document.getElementById('obUseCloud') ? document.getElementById('obUseCloud').checked : true;
    
    // Save to settings
    setUserName(userNameVal);
    setUserEmail(userEmailVal);
    setAppName(appNameVal);
    applyTheme(onboardingTheme);
    applyAccent(onboardingAccent);
    
    // Save cloud preference
    localStorage.setItem('useCloud', obUseCloud ? 'true' : 'false');
    try {
        await ipcRenderer.invoke('set-use-cloud', obUseCloud);
    } catch (e) {
        console.error("Failed to invoke set-use-cloud:", e);
    }
    
    // Select profile
    await selectProfile(onboardingProfile);
    
    // Mark complete
    localStorage.setItem('onboardingComplete', 'true');
    
    // Hide onboarding modal cleanly with fadeOut transition
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.classList.add('fadeOut');
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.classList.remove('fadeOut');
        }, 400);
    }
    
    // Send a welcoming message to chat feed
    addChatMessage(`Hello ${userNameVal}! Welcome to your rebranded ${appNameVal} workspace. I have set your cognitive pacing to ${onboardingProfile === 'adaptive' ? 'Adaptive' : (onboardingProfile === 'architect' ? 'Analytical Systems' : 'Guided Companion')}. How can I assist you today?`, 'ai');
}

window.submitOnboarding = submitOnboarding;
window.setUserName = setUserName;
window.setUserEmail = setUserEmail;
window.setAppName = setAppName;

// ========================================
// ☁️ CLOUD PLATFORM & AUTHENTICATION INTEGRATION
// ========================================

let authMode = 'login';

async function apiCall(endpoint, method = 'GET', body = null) {
    try {
        return await ipcRenderer.invoke('cloud-api-call', { endpoint, method, body });
    } catch (e) {
        console.warn(`Direct Supabase IPC call failed: ${endpoint}`, e.message);
        throw e;
    }
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    const nameGroup = document.getElementById('authNameGroup');
    const cardTitle = document.getElementById('authCardTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');

    if (authMode === 'register') {
        if (nameGroup) nameGroup.style.display = 'block';
        if (cardTitle) cardTitle.innerText = 'Create Account';
        if (submitBtn) submitBtn.innerText = 'Register';
        if (toggleText) toggleText.innerText = 'Already have a cloud account? Sign in.';
    } else {
        if (nameGroup) nameGroup.style.display = 'none';
        if (cardTitle) cardTitle.innerText = 'Sign In';
        if (submitBtn) submitBtn.innerText = 'Sign In';
        if (toggleText) toggleText.innerText = "Don't have a cloud account? Register here.";
    }
}

async function submitAuth() {
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const displayName = document.getElementById('authNameInput').value.trim();

    if (!email || !password || (authMode === 'register' && !displayName)) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const body = authMode === 'login' ? { email, password } : { email, password, displayName };
        
        const data = await apiCall(endpoint, 'POST', body);
        if (data && data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.displayName);
            setUserName(data.displayName);
            
            // Set auth token inside SQLite sync engine metadata
            await ipcRenderer.invoke('set-auth-token', data.token, data.userId);
            
            // Clear inputs
            document.getElementById('authEmailInput').value = '';
            document.getElementById('authPasswordInput').value = '';
            const nInput = document.getElementById('authNameInput');
            if (nInput) nInput.value = '';
            
            updateCloudPanelUI();
            await loadTasks();
            await loadChatHistory();
            
            alert(authMode === 'login' ? "Logged in successfully!" : "Account registered successfully!");
        }
    } catch (e) {
        alert(`Authentication failed: ${e.message}`);
    }
}

async function loginWithGoogle() {
    const obGoogleBtn = document.getElementById('obGoogleLoginBtn');
    const settingsGoogleBtn = document.getElementById('settingsGoogleLoginBtn');
    const obText = document.getElementById('obGoogleLoginText');
    const settingsText = document.getElementById('settingsGoogleLoginText');

    // Show loading state
    if (obGoogleBtn) {
        obGoogleBtn.disabled = true;
        obGoogleBtn.style.opacity = '0.7';
    }
    if (settingsGoogleBtn) {
        settingsGoogleBtn.disabled = true;
        settingsGoogleBtn.style.opacity = '0.7';
    }
    if (obText) obText.innerText = 'Checking browser...';
    if (settingsText) settingsText.innerText = 'Checking browser...';

    try {
        const result = await ipcRenderer.invoke('google-login');
        if (result && result.success) {
            // Update localStorage
            localStorage.setItem('token', result.token);
            localStorage.setItem('userName', result.displayName);
            localStorage.setItem('userEmail', result.email);

            // Update UI fields in Onboarding welcome screen
            const obUserNameInput = document.getElementById('obUserNameInput');
            const obUserEmailInput = document.getElementById('obUserEmailInput');
            const obUseCloud = document.getElementById('obUseCloud');

            if (obUserNameInput) obUserNameInput.value = result.displayName;
            if (obUserEmailInput) obUserEmailInput.value = result.email;
            if (obUseCloud) obUseCloud.checked = true;

            // Apply username and email changes locally
            setUserName(result.displayName);
            setUserEmail(result.email);

            // Update button texts to success state
            if (obText) obText.innerText = `✓ Linked: ${result.displayName}`;
            if (settingsText) settingsText.innerText = `✓ Signed in: ${result.displayName}`;

            if (obGoogleBtn) obGoogleBtn.style.background = '#e6fffa';
            if (obGoogleBtn) obGoogleBtn.style.borderColor = '#319795';
            if (settingsGoogleBtn) settingsGoogleBtn.style.background = '#e6fffa';
            if (settingsGoogleBtn) settingsGoogleBtn.style.borderColor = '#319795';

            // Update cloud panel and reload database items immediately
            updateCloudPanelUI();
            await loadTasks();
            await loadChatHistory();
        }
    } catch (e) {
        console.error("Google authentication failed:", e);
        alert(`Google authentication failed: ${e.message}`);
        
        // Reset buttons to original state
        if (obGoogleBtn) {
            obGoogleBtn.disabled = false;
            obGoogleBtn.style.opacity = '1';
        }
        if (settingsGoogleBtn) {
            settingsGoogleBtn.disabled = false;
            settingsGoogleBtn.style.opacity = '1';
        }
        if (obText) obText.innerText = 'Sign in with Google';
        if (settingsText) settingsText.innerText = 'Sign in with Google';
    }
}

async function logoutAuth() {
    localStorage.removeItem('token');
    await ipcRenderer.invoke('set-auth-token', null);
    updateCloudPanelUI();
    loadTasks();
    loadChatHistory();
}

function updateCloudPanelUI() {
    const token = localStorage.getItem('token');
    const authCard = document.getElementById('authCard');
    const profileCard = document.getElementById('profileCard');
    const profileNameVal = document.getElementById('profileNameVal');

    if (token) {
        if (authCard) authCard.style.display = 'none';
        if (profileCard) profileCard.style.display = 'block';
        if (profileNameVal) profileNameVal.innerText = localStorage.getItem('userName') || 'User';
    } else {
        if (authCard) authCard.style.display = 'block';
        if (profileCard) profileCard.style.display = 'none';
    }
}

// 📝 REFLECTION PANEL UI UPDATE
async function updateReflectionUI() {
    try {
        const reflections = await ipcRenderer.invoke('get-daily-reflections');
        const container = document.getElementById('reflectionTimeline');
        const narrativeEl = document.getElementById('reflectionNarrative');
        const completionRateEl = document.getElementById('reflectionCompletionRate');
        const primaryEmotionEl = document.getElementById('reflectionPrimaryEmotion');
        const journalInput = document.getElementById('journalInput');

        if (!reflections || reflections.length === 0) {
            if (container) container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px 0;">No reflection events today. Complete tasks or chat to generate.</div>';
            return;
        }

        const latest = reflections[0];
        if (narrativeEl) narrativeEl.innerText = latest.narrative;
        if (completionRateEl) completionRateEl.innerText = `${latest.taskCompletionRate || 0}%`;
        if (primaryEmotionEl) primaryEmotionEl.innerText = latest.primaryEmotion || 'calm';
        if (journalInput) journalInput.value = latest.journalEntry || '';

        if (container) {
            container.innerHTML = '';
            if (latest.timeline && latest.timeline.length > 0) {
                latest.timeline.forEach(node => {
                    const el = document.createElement('div');
                    el.className = `timelineNode ${node.type || 'info'}`;
                    el.innerHTML = `
                        <div class="timelineTime">${node.time}</div>
                        <div class="timelineContent">
                            <div class="timelineText">${node.text}</div>
                            ${node.response ? `<div class="timelineSub">${node.response}</div>` : ''}
                        </div>
                    `;
                    container.appendChild(el);
                });
            } else {
                container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px 0;">Timeline empty.</div>';
            }
        }
    } catch (e) {
        console.error("Failed to load reflections:", e);
    }
}

async function submitJournal() {
    const journalInput = document.getElementById('journalInput');
    if (!journalInput) return;
    const text = journalInput.value.trim();
    if (!text) {
        alert("Please write down your thoughts before saving.");
        return;
    }

    try {
        await ipcRenderer.invoke('save-reflection-journal', selectedDate, text);
        alert("Journal entry saved shame-free!");
        await updateReflectionUI();
    } catch (e) {
        alert(`Failed to save journal entry: ${e.message}`);
    }
}

// 📅 INTENT ENGINE PROPOSAL RENDERING
function renderProposalCard(proposal) {
    const box = document.getElementById('chatBox');
    if (!box) return;

    const card = document.createElement('div');
    card.className = 'proposalCard';
    
    let actionsHtml = '';
    proposal.actions.forEach(action => {
        let label = '';
        if (action.type === 'move') {
            label = `Shift "${action.text}" to ${action.newDate}`;
        } else if (action.type === 'shrink') {
            label = `Shorten "${action.text}" (${action.originalDuration}m → ${action.newDuration}m)`;
        } else if (action.type === 'add') {
            label = `Schedule: "${action.text}" (${action.calendar})`;
        } else if (action.type === 'delete') {
            label = `Cancel: "${action.text}"`;
        }
        actionsHtml += `<div class="proposalActionItem">• ${label}</div>`;
    });

    const confidencePct = Math.round((proposal.confidence || 0.85) * 100);
    const reasonText = proposal.reason || 'Heuristic engine correlation match.';

    let bulletsHtml = '';
    if (proposal.reasoning_bullets && proposal.reasoning_bullets.length > 0) {
        const items = proposal.reasoning_bullets.map(b => `<div class="reasoningBullet">${b}</div>`).join('');
        bulletsHtml = `<div class="proposalReasoningList" style="margin-top: 10px; display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border-color); padding-top: 8px;">${items}</div>`;
    }

    card.innerHTML = `
        <div class="proposalCardTitle">📅 Adjust Schedule?</div>
        <div class="proposalConfidenceBadge" style="font-size: 11px; margin-bottom: 10px; padding: 4px 8px; background: rgba(63,117,255,0.08); border-radius: 6px; color: var(--cal-personal); font-weight: 600;">
            Confidence: ${confidencePct}% — ${reasonText}
        </div>
        <div class="proposalActionsList">${actionsHtml}</div>
        ${bulletsHtml}
        <div class="proposalButtons" style="margin-top: 14px;">
            <button class="primary smallBtn" id="applyProposalBtn">Apply Adjustments</button>
            <button class="headerButton smallBtn" id="rejectProposalBtn">Keep Calendar</button>
        </div>
    `;

    box.appendChild(card);
    box.scrollTop = box.scrollHeight;

    const applyBtn = card.querySelector('#applyProposalBtn');
    applyBtn.onclick = async () => {
        applyBtn.disabled = true;
        applyBtn.innerText = 'Applying...';
        try {
            const res = await ipcRenderer.invoke('apply-intent-proposals', proposal.actions);
            applyBtn.innerText = 'Applied! ✓';
            applyBtn.style.background = '#10b981';
            applyBtn.style.borderColor = '#10b981';
            
            const undoGroupId = res.actionId;
            
            card.querySelector('.proposalButtons').innerHTML = `
                <div style="color:var(--text-muted);font-size:12px;font-weight:600;padding-top:4px;display:flex;justify-content:space-between;align-items:center;width:100%;">
                    <span>Applied! ✓</span>
                    <button class="headerButton smallBtn" id="undoActionBtn" style="padding: 4px 10px; font-size: 11px; border-color: var(--cal-personal); color: var(--cal-personal);">↩ Undo Last Shift</button>
                </div>
            `;
            
            const undoBtn = card.querySelector('#undoActionBtn');
            undoBtn.onclick = async () => {
                undoBtn.disabled = true;
                undoBtn.innerText = 'Undoing...';
                try {
                    await ipcRenderer.invoke('undo-cognitive-action', undoGroupId);
                    card.querySelector('.proposalButtons').innerHTML = '<div style="color:var(--text-muted);font-size:12px;font-weight:600;">Undone successfully! ✓</div>';
                    addChatMessage("Calendar reverted shame-free. Focus blocks restored.", 'ai');
                    await loadTasks();
                } catch (e) {
                    undoBtn.disabled = false;
                    undoBtn.innerText = '↩ Undo Last Shift';
                    alert(`Failed to undo: ${e.message}`);
                }
            };

            addChatMessage("Calendar updated shame-free! Focus blocks adjusted.", 'ai');
            await loadTasks();
        } catch (e) {
            applyBtn.disabled = false;
            applyBtn.innerText = 'Apply Adjustments';
            alert(`Failed to apply adjustments: ${e.message}`);
        }
    };

    const rejectBtn = card.querySelector('#rejectProposalBtn');
    rejectBtn.onclick = () => {
        card.querySelector('.proposalButtons').innerHTML = '<div style="color:var(--text-muted);font-size:12px;font-weight:600;padding-top:4px;">Calendar kept as-is.</div>';
    };
}

async function triggerEditReflection() {
    const narrativeEl = document.getElementById('reflectionNarrative');
    if (!narrativeEl) return;
    
    const originalText = narrativeEl.innerText;
    const newText = prompt("Edit Daily Reflection Narrative:", originalText);
    
    if (newText === null) return;
    if (newText.trim() === '') {
        alert("Reflection narrative cannot be blank.");
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('edit-reflection', selectedDate, newText.trim());
        if (result.success) {
            alert("Reflection updated successfully!");
            await updateReflectionUI();
        } else {
            alert(`Failed to edit reflection: ${result.error}`);
        }
    } catch (e) {
        alert(`Failed to edit reflection: ${e.message}`);
    }
}

async function triggerDeleteReflection() {
    if (!confirm("Are you sure you want to delete today's daily reflection? This cannot be undone.")) return;
    
    try {
        const result = await ipcRenderer.invoke('delete-reflection', selectedDate);
        if (result.success) {
            alert("Reflection deleted successfully!");
            await updateReflectionUI();
        } else {
            alert(`Failed to delete reflection: ${result.error}`);
        }
    } catch (e) {
        alert(`Failed to delete reflection: ${e.message}`);
    }
}

// ========================================
// 🎯 GOALS & STUDY MASTERY UI WIRING
// ========================================

async function updateGoalsUI() {
    try {
        const container = document.getElementById('goalsListContainer');
        if (!container) return;
        container.innerHTML = '';
        
        const goals = await ipcRenderer.invoke('get-goals');
        if (!goals || goals.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px 0;text-align:center;">No goals created yet. Use the form above to add your first goal anchor!</div>';
            return;
        }

        goals.forEach(goal => {
            const goalCard = document.createElement('div');
            goalCard.className = 'goalItemCard';
            
            const dateStr = goal.target_date ? `Target: ${goal.target_date}` : 'No target date';
            
            let projectsHtml = '';
            (goal.projects || []).forEach(proj => {
                let subjectsHtml = '';
                (proj.subjects || []).forEach(subj => {
                    const masteryVal = subj.mastery ? subj.mastery.mastery : 0.0;
                    const pct = Math.round(masteryVal * 100);
                    subjectsHtml += `
                        <div class="subjectItem" onclick="triggerUpdateMastery('${subj.id}')" title="Click to update study score/mastery" style="cursor: pointer; margin-bottom: 6px;">
                            <div class="subjectHeader">
                                <span class="subjectName">📚 ${subj.name}</span>
                                <span class="subjectMasteryText" style="font-weight: 700; color: var(--cal-personal);">${pct}% Mastery</span>
                            </div>
                            <div class="masteryBar" style="width: 100%; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; margin-top: 4px;">
                                <div class="masteryFill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--cal-personal) 0%, #10b981 100%); border-radius: 3px; transition: width 0.4s ease;"></div>
                            </div>
                        </div>
                    `;
                });

                projectsHtml += `
                    <div class="projectItem" style="margin-top: 10px;">
                        <div class="projectHeader" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span class="projectTitle" style="font-size: 12px; font-weight: 600; color: var(--text-main);">📂 ${proj.title}</span>
                            <button class="tinyLink" onclick="triggerAddSubject('${proj.id}')">+ Add Subject</button>
                        </div>
                        <div class="projectSubjectsList" style="padding-left: 10px;">
                            ${subjectsHtml || '<div style="color:var(--text-muted);font-size:11px;">No study subjects.</div>'}
                        </div>
                    </div>
                `;
            });

            goalCard.innerHTML = `
                <div class="goalItemHeader" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 class="goalTitle" style="font-size: 13px; font-weight: 700; color: var(--text-main); margin: 0;">🎯 ${goal.title}</h4>
                        <div class="goalMeta" style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-top: 2px;">${dateStr} ${goal.description ? `— ${goal.description}` : ''}</div>
                    </div>
                    <button class="goalDeleteBtn" onclick="triggerDeleteGoal('${goal.id}')" title="Delete Goal" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.7;">×</button>
                </div>
                <div class="goalProjectsList" style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px; padding-left: 8px; border-left: 2.5px solid var(--border-color);">
                    ${projectsHtml}
                    <div style="margin-top: 6px;">
                        <button class="tinyLink" onclick="triggerAddProject('${goal.id}')">+ Add Project</button>
                    </div>
                </div>
            `;
            container.appendChild(goalCard);
        });
    } catch (e) {
        console.error("Failed to update Goals UI:", e);
    }
}

async function submitCreateGoal() {
    const titleInput = document.getElementById('newGoalTitle');
    const descInput = document.getElementById('newGoalDesc');
    const dateInput = document.getElementById('newGoalDate');
    
    if (!titleInput) return;
    const title = titleInput.value.trim();
    const desc = descInput ? descInput.value.trim() : '';
    const targetDate = dateInput ? dateInput.value : '';

    if (!title) {
        alert("Please enter a goal title.");
        return;
    }

    try {
        const res = await ipcRenderer.invoke('add-goal', title, desc, targetDate);
        if (res.success) {
            titleInput.value = '';
            if (descInput) descInput.value = '';
            if (dateInput) dateInput.value = '';
            await updateGoalsUI();
        } else {
            alert("Failed to create goal: " + res.error);
        }
    } catch (e) {
        alert("Failed to create goal: " + e.message);
    }
}

async function triggerDeleteGoal(goalId) {
    if (!confirm("Are you sure you want to delete this goal? This will hide its projects and subjects.")) return;
    try {
        await ipcRenderer.invoke('delete-goal', goalId);
        await updateGoalsUI();
    } catch (e) {
        alert("Failed to delete goal: " + e.message);
    }
}

async function triggerAddProject(goalId) {
    const title = prompt("Enter Project Title (e.g. Embedded Labs):");
    if (!title || !title.trim()) return;
    const desc = prompt("Enter Description (optional):") || '';
    try {
        await ipcRenderer.invoke('add-project', goalId, title.trim(), desc.trim());
        await updateGoalsUI();
    } catch (e) {
        alert("Failed to add project: " + e.message);
    }
}

async function triggerAddSubject(projectId) {
    const name = prompt("Enter Subject Name (e.g. ARM Assembly / Interrupts):");
    if (!name || !name.trim()) return;
    try {
        await ipcRenderer.invoke('add-subject', projectId, name.trim());
        await updateGoalsUI();
    } catch (e) {
        alert("Failed to add subject: " + e.message);
    }
}

async function triggerUpdateMastery(subjectId) {
    const input = prompt("Update subject learning metrics:\n- Enter a quiz score from 0 to 100 (e.g. 85)\n- Or enter a raw mastery percentage from 0.0 to 1.0 (e.g. 0.75)");
    if (!input || !input.trim()) return;
    const val = parseFloat(input.trim());
    if (isNaN(val)) {
        alert("Please enter a valid numeric value.");
        return;
    }

    let mastery = 0.0;
    let quizScore = null;

    if (val >= 0.0 && val <= 1.0 && input.includes('.')) {
        mastery = val;
    } else if (val >= 0 && val <= 100) {
        quizScore = val;
        mastery = val / 100;
    } else {
        alert("Invalid range. Quiz scores must be 0-100, raw mastery must be 0.0-1.0.");
        return;
    }

    try {
        await ipcRenderer.invoke('update-subject-mastery', subjectId, mastery, quizScore);
        await updateGoalsUI();
    } catch (e) {
        alert("Failed to update mastery: " + e.message);
    }
}

// Listen to realtime database updates from the main process
ipcRenderer.on('realtime-db-update', async (event, data) => {
    console.log(`🔔 Realtime Database Update Event for: ${data.table}`);
    if (data.table === 'events' || data.table === 'tasks' || data.table === 'calendars') {
        await loadTasks();
    }
});

// ========================================
// 🧠 CHRONO OS PHASE 5B - 9 UI CONTROLLERS
// ========================================

let activeNoteId = null;
let activePeerId = null;

// 📝 NOTES TAB CONTROLLER
async function updateNotesUI() {
    try {
        const container = document.getElementById('notesListContainer');
        if (!container) return;
        container.innerHTML = '';

        const notes = await ipcRenderer.invoke('get-notes');
        if (!notes || notes.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0;text-align:center;">No notes saved yet. Type a note above to capture context.</div>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'noteItemCard';
            card.style.background = 'rgba(255,255,255,0.02)';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '8px';
            card.style.padding = '10px';
            card.style.marginBottom = '8px';
            card.style.position = 'relative';

            let visText = '🔒 Private';
            if (note.visibility === 'shared_group') visText = '👥 Shared Group';
            else if (note.visibility === 'shared_specific') visText = '👤 Shared Specific';
            
            const sharedWithEscaped = JSON.stringify(note.shared_with || []).replace(/"/g, '&quot;');

            let linkedHtml = '';
            if (note.goal_title || note.project_title || note.subject_name) {
                const tags = [];
                if (note.goal_title) tags.push(`🎯 Goal: ${note.goal_title}`);
                if (note.project_title) tags.push(`📂 Project: ${note.project_title}`);
                if (note.subject_name) tags.push(`📚 Subject: ${note.subject_name}`);
                linkedHtml = `<div class="noteLinks" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">` +
                    tags.map(t => `<span style="font-size:10px; padding:2px 6px; background:rgba(63,117,255,0.08); border-radius:4px; color:var(--cal-personal); font-weight:600;">${t}</span>`).join('') +
                    `</div>`;
            }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h5 style="margin:0; font-size:13px; font-weight:700; color:var(--text-main); cursor:pointer;" onclick="loadNoteToEditor('${note.id}', \`${note.title.replace(/'/g, "\\'")}\`, \`${(note.content || '').replace(/'/g, "\\'")}\`, '${note.visibility}', '${sharedWithEscaped}')">${note.title}</h5>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span style="font-size:10px; color:var(--text-muted);">${visText}</span>
                        <button onclick="triggerDeleteNote('${note.id}')" style="background:none; border:none; color:#ef4444; font-size:13px; cursor:pointer; opacity:0.7;">🗑️</button>
                    </div>
                </div>
                <p style="margin:6px 0 0 0; font-size:12px; color:var(--text-muted); line-height:1.4;">${note.content || 'No description.'}</p>
                ${linkedHtml}
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Failed to load notes UI:", e);
    }
}

function loadNoteToEditor(noteId, title, content, visibility, sharedWithJson) {
    activeNoteId = noteId;
    document.getElementById('noteTitleInput').value = title;
    document.getElementById('noteContentInput').value = content;
    document.getElementById('noteVisibilitySelect').value = visibility;
    toggleNoteSharedPeers();

    let sharedWith = [];
    try {
        sharedWith = JSON.parse(sharedWithJson);
    } catch (e) {}

    document.querySelectorAll('input[name="note_peer"]').forEach(cb => {
        cb.checked = sharedWith.includes(cb.value);
    });

    const labelDetails = document.getElementById('noteLinkedDetails');
    if (labelDetails) {
        labelDetails.style.display = 'block';
        labelDetails.innerText = '✏️ Currently Editing Mode Active';
    }
}

async function submitSaveNote() {
    const titleInput = document.getElementById('noteTitleInput');
    const contentInput = document.getElementById('noteContentInput');
    const visSelect = document.getElementById('noteVisibilitySelect');
    
    if (!titleInput) return;
    const title = titleInput.value.trim();
    const content = contentInput ? contentInput.value.trim() : '';
    const visibility = visSelect ? visSelect.value : 'private';

    if (!title) {
        alert("Please enter a note title.");
        return;
    }

    const checkedPeers = [];
    if (visibility === 'shared_specific') {
        document.querySelectorAll('input[name="note_peer"]:checked').forEach(cb => {
            checkedPeers.push(cb.value);
        });
    }

    try {
        if (activeNoteId) {
            await ipcRenderer.invoke('edit-note', activeNoteId, title, content, visibility, checkedPeers, 5, 5);
        } else {
            await ipcRenderer.invoke('add-note', title, content, visibility, checkedPeers, 5, 5);
        }
        clearNoteEditor();
        await updateNotesUI();
        await updateLifeContinuityUI();
        await updateJarvisSuggestions();
    } catch (e) {
        alert("Failed to save note: " + e.message);
    }
}

function clearNoteEditor() {
    activeNoteId = null;
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteContentInput').value = '';
    document.getElementById('noteVisibilitySelect').value = 'private';
    toggleNoteSharedPeers();
    document.querySelectorAll('input[name="note_peer"]').forEach(cb => cb.checked = false);
    const labelDetails = document.getElementById('noteLinkedDetails');
    if (labelDetails) labelDetails.style.display = 'none';
}

async function triggerDeleteNote(noteId) {
    if (!confirm("Are you sure you want to delete this thought/note?")) return;
    try {
        await ipcRenderer.invoke('delete-note', noteId);
        if (activeNoteId === noteId) clearNoteEditor();
        await updateNotesUI();
        await updateLifeContinuityUI();
    } catch (e) {
        alert("Failed to delete note: " + e.message);
    }
}

// 💾 MEMORY OS SUBTABS CONTROLLER
function switchMemorySubTab(subtab) {
    document.querySelectorAll('.subTabBtn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subtab);
        btn.style.color = btn.dataset.subtab === subtab ? 'var(--text-main)' : 'var(--text-muted)';
        btn.style.fontWeight = btn.dataset.subtab === subtab ? '600' : '500';
    });

    document.querySelectorAll('.memorySubPane').forEach(pane => {
        pane.style.display = pane.id === `memPane-${subtab}` ? 'block' : 'none';
    });

    if (subtab === 'preservation') {
        updateMemoryPreservationUI();
    }
}

// 💾 MEMORY CARDS RENDERING
async function updateMemoryCardsUI() {
    try {
        const container = document.getElementById('memoryCardsContainer');
        if (!container) return;
        container.innerHTML = '';

        const cards = await ipcRenderer.invoke('get-memory-cards');
        if (!cards || cards.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0;text-align:center;">No memory cards generated yet. Study topics to record cards.</div>';
            return;
        }

        cards.forEach(card => {
            const el = document.createElement('div');
            el.className = 'memoryCardItem';
            el.style.background = 'linear-gradient(135deg, rgba(63,117,255,0.03) 0%, rgba(16,185,129,0.03) 100%)';
            el.style.border = '1px solid var(--border-color)';
            el.style.borderRadius = '10px';
            el.style.padding = '12px';
            el.style.marginBottom = '10px';

            const goalsHtml = card.goalsCreated.length > 0
                ? card.goalsCreated.map(g => `<span style="font-size:10px; margin-right:4px; padding:2px 6px; background:rgba(16,185,129,0.08); border-radius:4px; color:#10b981; font-weight:600;">🎯 ${g}</span>`).join('')
                : '<span style="font-size:10px; color:var(--text-muted);">None created</span>';

            const milestonesHtml = card.milestones.map(m => `<div style="font-size:11px; margin-top:4px; color:var(--text-main); font-weight:500;">📌 ${m}</div>`).join('');

            el.innerHTML = `
                <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-bottom:8px; border-bottom:1px dashed var(--border-color); padding-bottom:4px;">${card.title}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div style="font-size:11px; color:var(--text-muted);">Studied: <strong style="color:var(--text-main); font-size:12px;">${card.studyHours} hrs</strong></div>
                    <div style="font-size:11px; color:var(--text-muted);">Tasks Finished: <strong style="color:var(--text-main); font-size:12px;">${card.tasksCompleted}</strong></div>
                </div>
                <div style="margin-top:6px;">
                    <div style="font-size:10px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">GOALS STARTED</div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">${goalsHtml}</div>
                </div>
                <div style="margin-top:8px;">
                    <div style="font-size:10px; color:var(--text-muted); font-weight:600; margin-bottom:2px;">MILESTONES</div>
                    ${milestonesHtml}
                </div>
            `;
            container.appendChild(el);
        });
    } catch (e) {
        console.error("Failed to load Memory Cards UI:", e);
    }
}

// 💾 MEMORY SEARCH CONTROLLER
async function triggerMemorySearch() {
    const input = document.getElementById('memorySearchInput');
    const container = document.getElementById('memorySearchResults');
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) {
        container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding-top:10px;">Enter search term above.</div>';
        return;
    }

    container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding-top:10px;">Searching memory database...</div>';

    try {
        const results = await ipcRenderer.invoke('search-memories', query);
        container.innerHTML = '';

        if (!results || results.length === 0) {
            container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding-top:10px;">No matching memories found.</div>';
            return;
        }

        results.forEach(res => {
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.02)';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '6px';
            card.style.padding = '8px 10px';
            card.style.fontSize = '12px';

            let typeBadgeColor = '#3f75ff';
            if (res.type === 'note') typeBadgeColor = '#8b5cf6';
            if (res.type === 'chat') typeBadgeColor = '#10b981';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong style="color:var(--text-main);">${res.title}</strong>
                    <span style="font-size:9px; padding:2px 6px; background:${typeBadgeColor}15; color:${typeBadgeColor}; border-radius:4px; font-weight:700;">${res.type.toUpperCase()}</span>
                </div>
                <div style="color:var(--text-muted); line-height:1.4; word-break:break-word;">${res.content}</div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:4px; text-align:right;">${res.date}</div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Search memory error:", e);
    }
}

// 💾 LIFE CONTINUITY DASHBOARD
async function updateLifeContinuityUI() {
    try {
        const data = await ipcRenderer.invoke('get-life-continuity');
        if (!data) return;

        // Helper mapper to render list items
        const renderList = (elementId, array) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.innerHTML = '';
            if (array.length === 0) {
                el.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No records compiled.</div>';
                return;
            }
            array.forEach(item => {
                const node = document.createElement('div');
                node.style.padding = '2px 0';
                node.innerText = item;
                el.appendChild(node);
            });
        };

        renderList('continuityMattered', data.whatMattered);
        renderList('continuityChanged', data.whatChanged);
        renderList('continuityForgetting', data.whatForgetting);
        renderList('continuityWho', data.whoMatters);
        renderList('continuityProgress', data.whatProgress);

        const focusEl = document.getElementById('continuityFocus');
        if (focusEl) {
            focusEl.innerText = data.whatFocusNext || 'Complete study items to compute recommendation.';
        }

        // Narrative Engine
        try {
            const narrative = await ipcRenderer.invoke('get-monthly-narrative');
            const narrativeEl = document.getElementById('narrativeEngineText');
            if (narrativeEl && narrative) {
                narrativeEl.innerText = narrative;
            }
        } catch (e) {
            console.error("Failed to load narrative:", e);
        }

        // Continuity Index
        try {
            const indexData = await ipcRenderer.invoke('get-continuity-index');
            if (indexData) {
                const badge = document.getElementById('overallContinuityIndexBadge');
                if (badge) badge.innerText = `${indexData.overallIndex || 0}/100`;

                const setScore = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = `${val || 0}%`;
                };

                const subs = indexData.subScores || {};
                setScore('indexScoreLearning', subs.learning);
                setScore('indexScoreProjects', subs.goals);
                setScore('indexScoreHealth', subs.health);
                setScore('indexScoreRelationships', subs.relationships);
                setScore('indexScoreReflection', subs.reflection);
                setScore('indexScoreValues', subs.values);
            }
        } catch (e) {
            console.error("Failed to load continuity index:", e);
        }

        // Continuity State Machine
        try {
            const stateData = await ipcRenderer.invoke('get-continuity-state');
            if (stateData) {
                const badge = document.getElementById('continuityStateBadge');
                if (badge) {
                    badge.innerText = stateData.state || 'Maintaining';
                    if (stateData.state === 'Overloaded') {
                        badge.style.color = '#ef4444';
                        badge.style.background = 'rgba(239,68,68,0.1)';
                    } else if (stateData.state === 'Recovering') {
                        badge.style.color = '#3f75ff';
                        badge.style.background = 'rgba(63,117,255,0.1)';
                    } else if (stateData.state === 'Exploring') {
                        badge.style.color = '#a855f7';
                        badge.style.background = 'rgba(168,85,247,0.1)';
                    } else if (stateData.state === 'Building') {
                        badge.style.color = '#f59e0b';
                        badge.style.background = 'rgba(245,158,11,0.1)';
                    } else {
                        badge.style.color = '#10b981';
                        badge.style.background = 'rgba(16,185,129,0.1)';
                    }
                }
                const exp = document.getElementById('continuityStateExplanation');
                if (exp) exp.innerText = stateData.explanation || '';
            }
        } catch (e) {
            console.error("Failed to load continuity state:", e);
        }

        // Personal OS Style
        try {
            const osData = await ipcRenderer.invoke('get-personal-os');
            if (osData) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = val || 'N/A';
                };
                setVal('personalOSFocus', osData.focusStyle);
                setVal('personalOSPlanning', osData.planningStyle);
                setVal('personalOSReview', osData.reviewStyle);
                setVal('personalOSPeak', osData.peakHours);
            }
        } catch (e) {
            console.error("Failed to load Personal OS profile:", e);
        }

        // Trust & Reliability
        try {
            const trustData = await ipcRenderer.invoke('get-trust-reliability');
            if (trustData) {
                const setValColor = (id, val, isSuccess) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.innerText = val;
                        el.style.color = isSuccess ? '#10b981' : '#ef4444';
                    }
                };
                setValColor('trustDataIntegrity', trustData.dataIntegrity, trustData.dataIntegrity === 'Healthy');
                setValColor('trustSyncHealth', trustData.syncHealth, trustData.syncHealth === 'Synched');
                setValColor('trustBackupStatus', trustData.backupStatus, trustData.backupStatus === 'Secured');
                
                const covEl = document.getElementById('trustMemoryCoverage');
                if (covEl) {
                    covEl.innerText = `${trustData.memoryCoverage || 100}%`;
                    covEl.style.color = trustData.memoryCoverage >= 80 ? '#10b981' : '#f59e0b';
                }
            }
        } catch (e) {
            console.error("Failed to load Trust dashboard metrics:", e);
        }

        // 1. Cognitive Fronts Monitor
        try {
            const frontsData = await ipcRenderer.invoke('get-cognitive-fronts');
            const frontsList = document.getElementById('cognitiveFrontsList');
            if (frontsList && frontsData) {
                frontsList.innerHTML = '';
                if (!frontsData.activeFronts || frontsData.activeFronts.length === 0) {
                    frontsList.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No active fronts recorded this week.</div>';
                } else {
                    frontsData.activeFronts.forEach(front => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.justifyContent = 'space-between';
                        row.style.alignItems = 'center';
                        row.style.padding = '4px 6px';
                        row.style.background = front.status === 'High Load' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)';
                        row.style.border = '1px solid ' + (front.status === 'High Load' ? '#fca5a5' : 'var(--border-color)');
                        row.style.borderRadius = '6px';
                        row.style.marginBottom = '4px';
                        row.innerHTML = `
                            <strong>${front.name}</strong>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:10px; padding:2px 6px; border-radius:4px; font-weight:700; background:${front.status === 'High Load' ? '#ef444420' : 'rgba(63,117,255,0.15)'}; color:${front.status === 'High Load' ? '#ef4444' : 'var(--cal-personal)'};">${front.status}</span>
                                <span style="color:var(--text-muted); font-size:10px;">Load: ${front.loadScore}</span>
                            </div>
                        `;
                        frontsList.appendChild(row);
                    });
                }
            }
        } catch (e) {
            console.error("Failed to update fronts UI:", e);
        }

        // 2. Expansion vs Completion Monitor
        try {
            const expData = await ipcRenderer.invoke('get-expansion-metrics');
            const expContent = document.getElementById('expansionMetricsContent');
            if (expContent && expData) {
                const ratio = expData.createdCount / (expData.completedCount + 1);
                let badgeColor = '#10b981';
                if (expData.expansionRisk === 'High') badgeColor = '#ef4444';
                else if (expData.expansionRisk === 'Moderate') badgeColor = '#f59e0b';

                expContent.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span>Expansion Risk Level:</span>
                        <strong style="padding:2px 6px; border-radius:4px; color:${badgeColor}; background:${badgeColor}20; font-size:10px; font-weight:700;">${expData.expansionRisk.toUpperCase()} RISK</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:10px;">
                        <span>Tasks Created (30d): <strong>${expData.createdCount}</strong></span>
                        <span>Tasks Completed (30d): <strong>${expData.completedCount}</strong></span>
                    </div>
                    <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">
                        Commitment Ratio: <strong>${ratio.toFixed(2)}x</strong> ${ratio >= 3.0 ? '(High project accretion detected)' : ''}
                    </div>
                `;
            }
        } catch (e) {
            console.error("Failed to update expansion UI:", e);
        }

        // 3. Values Alignment Layer
        try {
            const alignData = await ipcRenderer.invoke('get-values-alignment');
            const alignContent = document.getElementById('valuesAlignmentContent');
            if (alignContent && alignData) {
                alignContent.innerHTML = '';
                if (alignData.length === 0) {
                    alignContent.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No values alignment computed yet.</div>';
                } else {
                    alignData.forEach(val => {
                        const alignColor = val.alignmentScore >= 40 ? '#10b981' : 'var(--text-muted)';
                        const barColor = val.alignmentScore >= 40 ? '#10b981' : 'var(--cal-personal)';
                        alignContent.innerHTML += `
                            <div style="margin-bottom: 6px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                    <span>${val.value}</span>
                                    <strong style="color:${alignColor};">${val.alignmentScore}% (${val.priorityStatus})</strong>
                                </div>
                                <div style="width:100%; height:4px; background:var(--border-color); border-radius:2px; overflow:hidden;">
                                    <div style="width:${val.alignmentScore}%; height:100%; background:${barColor};"></div>
                                </div>
                            </div>
                        `;
                    });
                }
            }
        } catch (e) {
            console.error("Failed to update values UI:", e);
        }

        // 4. Loop Detections & Intervention Selector
        try {
            const loopsData = await ipcRenderer.invoke('get-loop-detections');
            const loopsList = document.getElementById('loopDetectionsList');
            if (loopsList && loopsData) {
                loopsList.innerHTML = '';
                if (loopsData.length === 0) {
                    loopsList.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No cognitive loops detected in your notes.</div>';
                } else {
                    loopsData.forEach(loop => {
                        const row = document.createElement('div');
                        row.style.padding = '8px';
                        row.style.background = 'rgba(239,68,68,0.04)';
                        row.style.border = '1px solid rgba(239,68,68,0.2)';
                        row.style.borderRadius = '6px';
                        row.style.marginBottom = '6px';
                        row.style.display = 'flex';
                        row.style.flexDirection = 'column';
                        row.style.gap = '4px';
                        
                        row.innerHTML = `
                            <strong style="color:#ef4444; font-size:11px;">⚠️ Loop: "${loop.topic}"</strong>
                            <div style="font-size:10px; color:var(--text-main); line-height: 1.3;">${loop.promptText}</div>
                            <div style="display:flex; gap:6px; margin-top:4px; align-items:center;">
                                <select id="status-${loop.topic}" style="padding: 2px 4px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main);">
                                    <option value="active" ${loop.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="no_new_development" ${loop.status === 'no_new_development' ? 'selected' : ''}>No Development</option>
                                    <option value="archived" ${loop.status === 'archived' ? 'selected' : ''}>Archived</option>
                                </select>
                                <select id="action-${loop.topic}" style="padding: 2px 4px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main);">
                                    <option value="schedule_review" ${loop.resolutionAction === 'schedule_review' ? 'selected' : ''}>Schedule Review</option>
                                    <option value="archive_topic" ${loop.resolutionAction === 'archive_topic' ? 'selected' : ''}>Archive Topic</option>
                                    <option value="continue_reflection" ${loop.resolutionAction === 'continue_reflection' ? 'selected' : ''}>Continue Reflection</option>
                                </select>
                                <button class="primary" onclick="applyLoopIntervention('${loop.topic}')" style="padding: 2px 6px; font-size: 10px; border-radius: 4px; cursor: pointer;">Apply</button>
                            </div>
                        `;
                        loopsList.appendChild(row);
                    });
                }
            }
        } catch (e) {
            console.error("Failed to update loop detections UI:", e);
        }

    } catch (e) {
        console.error("Failed to load Life Continuity UI data:", e);
    }
}

// 👥 RELATIONSHIP OS TAB CONTROLLER
function drawRelationshipGraph(peers) {
    const svg = document.getElementById('relationshipSvg');
    if (!svg) return;
    svg.innerHTML = '';

    const centerX = 130;
    const centerY = 130;
    const radius = 75;

    // Center Node (Me / Alena)
    const centerG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    centerG.setAttribute("class", "center-node");

    const centerRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerRing.setAttribute("cx", centerX);
    centerRing.setAttribute("cy", centerY);
    centerRing.setAttribute("r", 26);
    centerRing.setAttribute("fill", "rgba(63, 117, 255, 0.1)");
    centerRing.setAttribute("stroke", "var(--cal-personal)");
    centerRing.setAttribute("stroke-width", "1.5");
    centerG.appendChild(centerRing);

    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerCircle.setAttribute("cx", centerX);
    centerCircle.setAttribute("cy", centerY);
    centerCircle.setAttribute("r", 20);
    centerCircle.setAttribute("fill", "var(--cal-personal)");
    centerG.appendChild(centerCircle);

    const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText.setAttribute("x", centerX);
    centerText.setAttribute("y", centerY + 4);
    centerText.setAttribute("text-anchor", "middle");
    centerText.setAttribute("fill", "#ffffff");
    centerText.style.fontSize = "11px";
    centerText.style.fontWeight = "bold";
    centerText.style.fontFamily = "var(--font-primary)";
    centerText.textContent = "ME";
    centerG.appendChild(centerText);

    const centerLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerLabel.setAttribute("x", centerX);
    centerLabel.setAttribute("y", centerY + 38);
    centerLabel.setAttribute("text-anchor", "middle");
    centerLabel.setAttribute("fill", "var(--text-main)");
    centerLabel.style.fontSize = "10px";
    centerLabel.style.fontWeight = "bold";
    centerLabel.style.fontFamily = "var(--font-primary)";
    centerLabel.textContent = "Alena";
    centerG.appendChild(centerLabel);

    const displayPeers = (peers || []).slice(0, 5);
    displayPeers.forEach((peer, i) => {
        const angle = (i * 2 * Math.PI) / displayPeers.length - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Link color (Growing = Green, Declining/Drifting = Red, Stable/Other = Amber)
        let linkColor = '#f59e0b';
        if (peer.continuityTrend === 'Growing') {
            linkColor = '#10b981';
        } else if (peer.continuityTrend === 'Declining' || peer.continuityTrend === 'Drifting') {
            linkColor = '#ef4444';
        }

        // Link thickness based on activity weight
        let strokeWidth = '2';
        if (peer.sharedCount >= 5 || peer.frequency >= 4) {
            strokeWidth = '4';
        } else if (peer.sharedCount <= 1 && peer.frequency === 0) {
            strokeWidth = '1';
        }

        // Edge line
        const edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        edge.setAttribute("x1", centerX);
        edge.setAttribute("y1", centerY);
        edge.setAttribute("x2", x);
        edge.setAttribute("y2", y);
        edge.setAttribute("stroke", linkColor);
        edge.setAttribute("stroke-width", strokeWidth);
        edge.setAttribute("stroke-opacity", "0.6");
        edge.setAttribute("stroke-dasharray", peer.continuityTrend === 'Declining' || peer.continuityTrend === 'Drifting' ? "3,3" : "none");
        svg.appendChild(edge);

        // Peer Node Group
        const peerG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        peerG.style.cursor = 'pointer';
        peerG.onclick = () => openPeerDetails(peer.id);

        const peerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        peerCircle.setAttribute("cx", x);
        peerCircle.setAttribute("cy", y);
        peerCircle.setAttribute("r", 15);
        peerCircle.setAttribute("fill", "rgba(30, 41, 59, 0.9)");
        peerCircle.setAttribute("stroke", "var(--border-color)");
        peerCircle.setAttribute("stroke-width", "1.5");
        peerG.appendChild(peerCircle);

        // Hover reactions
        peerG.onmouseenter = () => {
            peerCircle.setAttribute("r", "18");
            peerCircle.setAttribute("stroke", "var(--cal-personal)");
            edge.setAttribute("stroke-opacity", "1.0");
        };
        peerG.onmouseleave = () => {
            peerCircle.setAttribute("r", "15");
            peerCircle.setAttribute("stroke", "var(--border-color)");
            edge.setAttribute("stroke-opacity", "0.6");
        };

        const emojiText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        emojiText.setAttribute("x", x);
        emojiText.setAttribute("y", y + 4);
        emojiText.setAttribute("text-anchor", "middle");
        emojiText.style.fontSize = "12px";
        emojiText.textContent = peer.display_picture || '👤';
        peerG.appendChild(emojiText);

        // Label offset radially outwards
        const offset = 26;
        const lx = centerX + (radius + offset) * Math.cos(angle);
        const ly = centerY + (radius + offset) * Math.sin(angle) + 3;

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", lx);
        label.setAttribute("y", ly);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", "var(--text-main)");
        label.style.fontSize = "9px";
        label.style.fontWeight = "600";
        label.style.fontFamily = "var(--font-primary)";
        label.textContent = peer.name;
        peerG.appendChild(label);

        svg.appendChild(peerG);
    });

    svg.appendChild(centerG);
}

async function updatePeopleUI() {
    try {
        const container = document.getElementById('peopleListContainer');
        if (!container) return;
        container.innerHTML = '';

        const peers = await ipcRenderer.invoke('get-relationships');
        if (!peers || peers.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0;text-align:center;">No relationships found.</div>';
            return;
        }

        // Draw Interactive Visual Graph
        drawRelationshipGraph(peers);

        // Populating peer cards list
        peers.forEach(peer => {
            const card = document.createElement('div');
            card.className = 'peopleCard';
            card.style.background = 'rgba(255,255,255,0.02)';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '8px';
            card.style.padding = '10px 12px';
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '12px';
            card.style.cursor = 'pointer';
            card.onclick = () => openPeerDetails(peer.id);

            card.innerHTML = `
                <div style="font-size:24px; width:40px; height:40px; background:rgba(255,255,255,0.03); border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">${peer.display_picture || '👤'}</div>
                <div style="flex:1;">
                    <h5 style="margin:0; font-size:13px; font-weight:700; color:var(--text-main);">${peer.name}</h5>
                    <span style="font-size:11px; color:var(--text-muted);">${peer.role || 'Peer'}</span>
                </div>
                <div style="font-size:11px; color:var(--cal-personal); font-weight:600;">View Profile →</div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Failed to update people UI:", e);
    }
}

async function openPeerDetails(relationshipId) {
    activePeerId = relationshipId;
    const detailsContainer = document.getElementById('peerDetailsContainer');
    const listContainer = document.getElementById('peopleListContainer');
    
    if (!detailsContainer || !listContainer) return;
    
    listContainer.style.display = 'none';
    detailsContainer.style.display = 'block';

    try {
        const details = await ipcRenderer.invoke('get-relationship-details', relationshipId);
        if (!details || !details.peer) return;

        document.getElementById('peerDetailsName').innerText = `${details.peer.display_picture || '👤'} ${details.peer.name} Profile`;

        const trendEl = document.getElementById('peerContinuityTrend');
        if (trendEl) {
            trendEl.innerText = details.peer.continuityTrend || 'Stable';
            trendEl.style.color = details.peer.continuityTrend === 'Growing' ? '#10b981' : (details.peer.continuityTrend === 'Declining' ? '#ef4444' : 'var(--text-main)');
        }
        const recEl = document.getElementById('peerReciprocity');
        if (recEl) recEl.innerText = details.peer.reciprocity || 'Balanced';
        
        const freqEl = document.getElementById('peerInteractionsFrequency');
        if (freqEl) freqEl.innerText = details.peer.frequency || '0';
        
        const goalsCountEl = document.getElementById('peerSharedGoalsCount');
        if (goalsCountEl) goalsCountEl.innerText = details.peer.sharedGoalsCount || '0';

        // Compile and sort all shared events, goals, and milestones chronologically
        const timelineItems = [];

        function getParsedTime(dateStr) {
            if (!dateStr) return 0;
            const parsed = Date.parse(dateStr);
            return isNaN(parsed) ? 0 : parsed;
        }

        if (details.sharedEvents) {
            details.sharedEvents.forEach(ev => {
                timelineItems.push({
                    type: 'event',
                    title: ev.text,
                    date: ev.date,
                    time: ev.start_time || 'All Day',
                    sortDate: ev.date,
                    icon: '📅'
                });
            });
        }

        if (details.sharedGoals) {
            details.sharedGoals.forEach(gl => {
                timelineItems.push({
                    type: 'goal',
                    title: gl.title,
                    date: gl.target_date || 'No Target Date',
                    time: '',
                    sortDate: gl.target_date,
                    icon: '🎯'
                });
            });
        }

        if (details.milestones) {
            details.milestones.forEach(m => {
                timelineItems.push({
                    type: 'milestone',
                    title: m.title,
                    date: m.date || 'No Date',
                    time: '',
                    sortDate: m.date,
                    icon: '🏆'
                });
            });
        }

        // Sort chronologically descending (newest first)
        timelineItems.sort((a, b) => getParsedTime(b.sortDate) - getParsedTime(a.sortDate));

        const feedEl = document.getElementById('peerTimelineFeed');
        if (feedEl) {
            feedEl.innerHTML = '';
            if (timelineItems.length === 0) {
                feedEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:11px;">No relational continuity logged yet.</div>';
            } else {
                timelineItems.forEach(item => {
                    const row = document.createElement('div');
                    row.style.position = 'relative';
                    row.style.padding = '8px 10px';
                    row.style.background = 'rgba(255,255,255,0.02)';
                    row.style.border = '1px solid var(--border-color)';
                    row.style.borderRadius = '8px';
                    row.style.display = 'flex';
                    row.style.alignItems = 'flex-start';
                    row.style.gap = '8px';
                    row.style.marginBottom = '6px';
                    
                    // Bullet dot on the left thread
                    const bullet = document.createElement('div');
                    bullet.style.position = 'absolute';
                    bullet.style.left = '-19px'; // Align with the border-left line
                    bullet.style.top = '14px';
                    bullet.style.width = '8px';
                    bullet.style.height = '8px';
                    bullet.style.borderRadius = '50%';
                    bullet.style.background = item.type === 'event' ? 'var(--cal-personal)' : (item.type === 'goal' ? '#eab308' : '#10b981');
                    bullet.style.border = '2px solid var(--t-bg)';
                    row.appendChild(bullet);

                    row.innerHTML += `
                        <div style="font-size:14px; margin-top:2px;">${item.icon}</div>
                        <div style="flex:1;">
                            <div style="font-weight:600; color:var(--text-main); font-size:11px;">${item.title}</div>
                            <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">
                                ${item.date}${item.time ? ' @ ' + item.time : ''}
                            </div>
                        </div>
                    `;
                    feedEl.appendChild(row);
                });
            }
        }

    } catch (e) {
        console.error("Failed to load peer details:", e);
    }
}

function closePeerDetails() {
    activePeerId = null;
    document.getElementById('peerDetailsContainer').style.display = 'none';
    document.getElementById('peopleListContainer').style.display = 'grid';
}

async function autoScheduleStudyGap(subjectName) {
    if (!subjectName) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const taskText = `Review ${subjectName} (Active Recall)`;
    try {
        const result = await ipcRenderer.invoke('add-task', {
            text: taskText,
            date: todayStr,
            calendar: 'Study',
            visibility: 'private'
        });
        if (result && result.added) {
            alert(`Auto-Scheduled: "${taskText}" added to your study calendar for today!`);
            if (typeof loadTasks === 'function') {
                await loadTasks();
            }
            dismissJarvisSuggestion();
        }
    } catch (e) {
        console.error("Failed to auto-schedule study gap:", e);
        alert(`Failed to auto-schedule study session: ${e.message}`);
    }
}

async function submitJointSession() {
    const titleInput = document.getElementById('jointSessionTitle');
    const dateInput = document.getElementById('jointSessionDate');
    const timeInput = document.getElementById('jointSessionTime');

    if (!titleInput || !dateInput || !timeInput || !activePeerId) return;

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const startTime = timeInput.value;

    if (!title) {
        alert("Please enter a session title.");
        return;
    }
    if (!date) {
        alert("Please select a study session date.");
        return;
    }

    try {
        await ipcRenderer.invoke('schedule-joint-session', activePeerId, title, date, startTime, 90);
        titleInput.value = '';
        dateInput.value = '';
        await openPeerDetails(activePeerId);
        await loadTasks();
        await updateLifeContinuityUI();
        alert("Joint study session scheduled and visibility marked as shared! ✓");
    } catch (e) {
        alert("Failed to schedule joint session: " + e.message);
    }
}

async function submitConnectPeer() {
    const nameInput = document.getElementById('newPeerName');
    const emailInput = document.getElementById('newPeerEmail');
    const userIdInput = document.getElementById('newPeerUserId');
    const roleSelect = document.getElementById('newPeerRole');

    if (!nameInput || !emailInput || !userIdInput || !roleSelect) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const peerUserId = userIdInput.value.trim();
    const role = roleSelect.value;

    if (!name || !email || !peerUserId) {
        alert("Please enter peer name, email, and User ID.");
        return;
    }

    try {
        const res = await ipcRenderer.invoke('connect-peer', name, role, email, peerUserId);
        if (res.success) {
            nameInput.value = '';
            emailInput.value = '';
            userIdInput.value = '';
            alert(`Connected to external peer "${name}" successfully! ✓`);
            await updatePeopleUI();
        } else {
            alert(`Failed to connect peer: ${res.error}`);
        }
    } catch (e) {
        alert(`Failed to connect peer: ${e.message}`);
    }
}

window.submitConnectPeer = submitConnectPeer;

// 📡 OFFLINE STATUS CONTROLLER
function updateOfflineBadge() {
    const badge = document.getElementById('offlineBadge');
    const obsSync = document.getElementById('obsSyncStatus');
    
    if (navigator.onLine) {
        if (badge) badge.style.display = 'none';
        if (obsSync) {
            obsSync.innerText = '● Online';
            obsSync.style.color = '#10b981';
        }
    } else {
        if (badge) badge.style.display = 'inline-flex';
        if (obsSync) {
            obsSync.innerText = '○ Offline';
            obsSync.style.color = '#ef4444';
        }
    }
}

// Wire network loss listeners
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);

// Attach globally for onload triggers or HTML bindings
window.switchMemorySubTab = switchMemorySubTab;
window.updateMemoryCardsUI = updateMemoryCardsUI;
window.triggerMemorySearch = triggerMemorySearch;
window.updateLifeContinuityUI = updateLifeContinuityUI;
window.updateNotesUI = updateNotesUI;
window.submitSaveNote = submitSaveNote;
window.clearNoteEditor = clearNoteEditor;
window.triggerDeleteNote = triggerDeleteNote;
window.updatePeopleUI = updatePeopleUI;
window.openPeerDetails = openPeerDetails;
window.closePeerDetails = closePeerDetails;
window.submitJointSession = submitJointSession;
window.loadNoteToEditor = loadNoteToEditor;
window.autoScheduleStudyGap = autoScheduleStudyGap;

// Append trigger to existing window.onload to initialize badge and defaults
const existingOnload = window.onload;
window.onload = () => {
    if (existingOnload) existingOnload();
    updateOfflineBadge();
    
    // Set default date picker for joint study scheduling to tomorrow
    const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const jointDatePicker = document.getElementById('jointSessionDate');
    if (jointDatePicker) jointDatePicker.value = tom;

    // Load initial counts for dashboard
    updateLifeContinuityUI();

    // Populate selective sharing selectors
    populatePeerSelectors();

    // Load proactive suggestions
    updateJarvisSuggestions();

    // Context Resurrection Greeting on startup
    (async () => {
        try {
            const resurrection = await ipcRenderer.invoke('get-context-resurrection');
            if (resurrection && resurrection.greeting && resurrection.elapsedDays >= 1) {
                const card = document.getElementById('contextResurrectionCard');
                const textEl = document.getElementById('contextResurrectionText');
                if (card && textEl) {
                    textEl.innerText = resurrection.greeting;
                    card.style.display = 'block';
                }
            }
        } catch (e) {
            console.error("Failed to load context resurrection on startup:", e);
        }
    })();

    // Poll for new suggestions periodically
    setInterval(updateJarvisSuggestions, 30000);
};

// ========================================
// 🧠 GRANULAR SHARING & JARVIS UI HELPER FUNCTIONS
// ========================================

async function populatePeerSelectors() {
    try {
        const peers = await ipcRenderer.invoke('get-relationships');
        const noteList = document.getElementById('noteSharedPeersList');
        const taskList = document.getElementById('taskSharedPeersList');
        const leftTaskList = document.getElementById('leftTaskSharedPeersList');
        
        if (noteList) noteList.innerHTML = '';
        if (taskList) taskList.innerHTML = '';
        if (leftTaskList) leftTaskList.innerHTML = '';

        (peers || []).forEach(peer => {
            if (noteList) {
                const label = document.createElement('label');
                label.style.display = 'inline-flex';
                label.style.alignItems = 'center';
                label.style.gap = '4px';
                label.style.fontSize = '11px';
                label.style.cursor = 'pointer';
                label.innerHTML = `<input type="checkbox" name="note_peer" value="${peer.id}"> ${peer.display_picture || '👤'} ${peer.name}`;
                noteList.appendChild(label);
            }
            if (taskList) {
                const label = document.createElement('label');
                label.style.display = 'inline-flex';
                label.style.alignItems = 'center';
                label.style.gap = '4px';
                label.style.fontSize = '11px';
                label.style.cursor = 'pointer';
                label.innerHTML = `<input type="checkbox" name="task_peer" value="${peer.id}"> ${peer.name}`;
                taskList.appendChild(label);
            }
            if (leftTaskList) {
                const label = document.createElement('label');
                label.style.display = 'inline-flex';
                label.style.alignItems = 'center';
                label.style.gap = '4px';
                label.style.fontSize = '10px';
                label.style.cursor = 'pointer';
                label.innerHTML = `<input type="checkbox" name="left_task_peer" value="${peer.id}"> ${peer.name}`;
                leftTaskList.appendChild(label);
            }
        });
    } catch(e) {
        console.error("Failed to populate peer selectors:", e);
    }
}

function toggleNoteSharedPeers() {
    const vis = document.getElementById('noteVisibilitySelect').value;
    const container = document.getElementById('noteSharedPeersContainer');
    if (container) {
        container.style.display = vis === 'shared_specific' ? 'flex' : 'none';
    }
}

function toggleTaskSharedPeers() {
    const vis = document.getElementById('taskVisibilitySelect').value;
    const container = document.getElementById('taskSharedPeersContainer');
    if (container) {
        container.style.display = vis === 'shared_specific' ? 'flex' : 'none';
    }
}

function toggleLeftTaskSharedPeers() {
    const vis = document.getElementById('leftTaskVisibilitySelect').value;
    const container = document.getElementById('leftTaskSharedPeersContainer');
    if (container) {
        container.style.display = vis === 'shared_specific' ? 'flex' : 'none';
    }
}

// 🧠 IDENTITY TIMELINE RENDERING
async function updateIdentityTimelineUI() {
    try {
        const narrativesEl = document.getElementById('identityTimelineNarratives');
        if (!narrativesEl) return;
        
        const cards = await ipcRenderer.invoke('get-memory-cards');
        if (!cards || cards.length === 0) {
            narrativesEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No narrative timeline compiled yet.</div>';
            return;
        }

        narrativesEl.innerHTML = '';
        cards.forEach(card => {
            if (card.identityNarrative) {
                const item = document.createElement('div');
                item.style.padding = '8px';
                item.style.background = 'rgba(255,255,255,0.02)';
                item.style.border = '1px solid var(--border-color)';
                item.style.borderRadius = '6px';
                item.style.marginBottom = '6px';
                item.innerHTML = `
                    <strong style="color:var(--cal-personal); font-size:11px; display:block; margin-bottom:2px;">${card.title} Narrative</strong>
                    <div style="font-size:11px; color:var(--text-main); font-weight:500;">${card.identityNarrative}</div>
                    ${card.consolidationText ? `<div style="font-size:10px; color:var(--text-muted); margin-top:4px; font-style:italic;">Consolidation: ${card.consolidationText}</div>` : ''}
                `;
                narrativesEl.appendChild(item);
            }
        });
    } catch (e) {
        console.error("Failed to load Identity Timeline UI:", e);
    }
}

// 🤖 JARVIS PROACTIVE SUGGESTIONS RENDERING
let currentJarvisSuggestion = null;

async function updateJarvisSuggestions() {
    try {
        const container = document.getElementById('jarvisSuggestionsContainer');
        if (!container) return;

        const suggestions = await ipcRenderer.invoke('get-jarvis-suggestions');
        if (!suggestions || suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        currentJarvisSuggestion = suggestions[0];
        document.getElementById('jarvisSuggestionText').innerText = currentJarvisSuggestion.text;
        
        // Reset explanation collapse state
        document.getElementById('jarvisWhyDetails').style.display = 'none';
        document.getElementById('jarvisWhyBtn').innerText = 'Why?';

        // Auto-schedule button behavior for study gaps
        const autoScheduleBtn = document.getElementById('jarvisAutoScheduleBtn');
        if (autoScheduleBtn) {
            if (currentJarvisSuggestion.type === 'study_gap') {
                autoScheduleBtn.style.display = 'inline-block';
                autoScheduleBtn.onclick = () => autoScheduleStudyGap(currentJarvisSuggestion.subjectName);
            } else {
                autoScheduleBtn.style.display = 'none';
            }
        }

        container.style.display = 'block';
    } catch (e) {
        console.error("Failed to update JARVIS suggestions:", e);
    }
}

function toggleJarvisWhy() {
    const panel = document.getElementById('jarvisWhyDetails');
    const btn = document.getElementById('jarvisWhyBtn');
    if (!panel || !currentJarvisSuggestion) return;

    if (panel.style.display === 'none') {
        const details = currentJarvisSuggestion.explanation_details || {};
        document.getElementById('whyTrigger').innerText = details.triggerCondition || 'N/A';
        document.getElementById('whyLastActive').innerText = details.lastEventDate || 'N/A';
        document.getElementById('whyDeadline').innerText = details.upcomingDeadline || 'N/A';
        document.getElementById('whyRec').innerText = details.recommendation || 'N/A';

        panel.style.display = 'flex';
        btn.innerText = 'Hide Details';
    } else {
        panel.style.display = 'none';
        btn.innerText = 'Why?';
    }
}

function dismissJarvisSuggestion() {
    const container = document.getElementById('jarvisSuggestionsContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// 📊 WEEKLY CONTINUITY AUDIT MODAL CONTROLLERS
async function openWeeklyAuditModal() {
    try {
        const audit = await ipcRenderer.invoke('get-weekly-audit');
        if (!audit) return;

        const populateList = (elementId, array, fallbackText) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.innerHTML = '';
            if (!array || array.length === 0) {
                el.innerHTML = `<li style="color:var(--text-muted); font-style:italic;">${fallbackText}</li>`;
            } else {
                array.forEach(item => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '2px';
                    li.innerText = item;
                    el.appendChild(li);
                });
            }
        };

        populateList('auditMattered', audit.whatMattered, 'No high-importance tasks completed this week.');
        populateList('auditChanged', audit.whatChanged, 'No changes in subject mastery recorded.');
        populateList('auditProgressed', audit.whatProgressed, 'No tasks linked to projects completed.');
        populateList('auditStalled', audit.whatStalled, 'No overdue tasks remaining.');
        populateList('auditPreserved', audit.whatPreserved, 'No routines completed.');
        populateList('auditReleased', audit.whatReleased, 'No goals completed or released.');

        const modal = document.getElementById('weeklyAuditOverlay');
        if (modal) {
            modal.style.display = 'flex';
        }
    } catch(e) {
        console.error("Failed to load weekly audit:", e);
        alert("Failed to load weekly audit: " + e.message);
    }
}

function closeWeeklyAuditModal() {
    const modal = document.getElementById('weeklyAuditOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 💬 COMMUNICATION DRAFT EVALUATOR
async function evaluateCommDraft() {
    const input = document.getElementById('commDraftInput');
    const resultDiv = document.getElementById('commDraftResult');
    const modeSelect = document.getElementById('tCommDraftMode');
    
    if (!input || !resultDiv) return;
    const text = input.value.trim();
    if (!text) {
        alert("Please enter a draft message to evaluate.");
        return;
    }

    const mode = modeSelect ? modeSelect.value : 'concise';

    try {
        const res = await ipcRenderer.invoke('evaluate-draft-communication', text);
        const translated = await ipcRenderer.invoke('translate-expression-bandwidth', text, mode);
        resultDiv.style.display = 'block';
        
        let intensityColor = '#10b981';
        if (res.emotionalIntensity === 'High') intensityColor = '#ef4444';
        else if (res.emotionalIntensity === 'Moderate') intensityColor = '#f59e0b';

        let actionColor = 'var(--cal-personal)';
        if (res.action.includes('Save Draft')) actionColor = '#ef4444';
        else if (res.action === 'Compress') actionColor = '#f59e0b';

        resultDiv.innerHTML = `
            <div style="font-weight:700; margin-bottom:4px; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:2px; display:flex; justify-content:space-between;">
                <span>Evaluation Result:</span>
                <span style="color:${actionColor}; font-weight:700;">${res.action.toUpperCase()}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:2px; font-size:10px; color:var(--text-muted); margin-bottom:6px;">
                <span>Length: <strong>${res.characterCount}</strong> chars (<strong>${res.wordCount}</strong> words)</span>
                <span>Intensity: <strong style="color:${intensityColor};">${res.emotionalIntensity}</strong></span>
            </div>
            <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px;">
                <span style="font-weight:700; font-size:10px; color:var(--cal-personal); display:block; margin-bottom:2px;">Translated Mode Draft:</span>
                <div style="font-size:11px; line-height:1.4; color:var(--text-main); font-family:monospace; background:rgba(0,0,0,0.1); padding:4px 6px; border-radius:4px; word-break:break-all; white-space:pre-wrap;">${translated}</div>
            </div>
        `;
    } catch (e) {
        console.error("Failed to evaluate communication draft:", e);
        alert("Failed to evaluate draft: " + e.message);
    }
}

// Bind new functions globally
window.openWeeklyAuditModal = openWeeklyAuditModal;
window.closeWeeklyAuditModal = closeWeeklyAuditModal;
window.evaluateCommDraft = evaluateCommDraft;

async function applyLoopIntervention(topic) {
    const status = document.getElementById(`status-${topic}`).value;
    const action = document.getElementById(`action-${topic}`).value;
    try {
        const res = await ipcRenderer.invoke('resolve-loop-intervention', topic, status, action);
        if (res && res.success) {
            alert(`Intervention applied for loop: ${topic}`);
            await updateLifeContinuityUI();
            await loadTasks();
        } else {
            alert(`Failed to apply intervention: ${res ? res.error : 'Unknown error'}`);
        }
    } catch (e) {
        alert(`Failed to apply intervention: ${e.message}`);
    }
}

async function updateMemoryPreservationUI() {
    try {
        const list = await ipcRenderer.invoke('get-memory-preservation-scores');
        const container = document.getElementById('memoryPreservationList');
        if (!container) return;
        container.innerHTML = '';
        if (!list || list.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No tasks or notes available for preservation.</div>';
            return;
        }

        list.forEach(item => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '6px';
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.border = '1px solid var(--border-color)';
            row.style.borderRadius = '6px';
            row.style.marginBottom = '4px';

            const selectId = `preserve-select-${item.id}`;
            row.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; max-width:65%;">
                    <span style="font-weight:600; font-size:11px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${item.title}</span>
                    <span style="font-size:9px; color:var(--text-muted); text-transform:uppercase;">${item.type}</span>
                </div>
                <select id="${selectId}" onchange="changePreservationState('${item.id}', '${item.type}')" style="padding: 2px 4px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; color: var(--text-main);">
                    <option value="Preserve" ${item.preservationState === 'Preserve' ? 'selected' : ''}>Preserve</option>
                    <option value="Compress" ${item.preservationState === 'Compress' ? 'selected' : ''}>Compress</option>
                    <option value="Archive" ${item.preservationState === 'Archive' ? 'selected' : ''}>Archive</option>
                    <option value="Discard" ${item.preservationState === 'Discard' ? 'selected' : ''}>Discard</option>
                </select>
            `;
            container.appendChild(row);
        });
    } catch (e) {
        console.error("Failed to load preservation scores:", e);
    }
}

async function changePreservationState(id, type) {
    const select = document.getElementById(`preserve-select-${id}`);
    if (!select) return;
    const newState = select.value;
    try {
        const res = await ipcRenderer.invoke('update-memory-preservation', id, type, newState);
        if (res && res.success) {
            console.log(`Preservation state updated to ${newState} for ${type} ${id}`);
        } else {
            alert(`Failed to update preservation state: ${res ? res.error : 'Unknown error'}`);
        }
    } catch (e) {
        console.error("Failed to update preservation state:", e);
    }
}

async function updateSettingsFrontsUI() {
    try {
        const fronts = await ipcRenderer.invoke('get-configurable-fronts');
        const container = document.getElementById('settingsFrontsList');
        if (!container) return;
        container.innerHTML = '';
        if (!fronts || fronts.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">No fronts available.</div>';
            return;
        }
        fronts.forEach(f => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            div.style.padding = '2px 0';
            const checkboxId = `front-chk-${f.id}`;
            div.innerHTML = `
                <input type="checkbox" id="${checkboxId}" ${f.active === 1 ? 'checked' : ''} onchange="toggleFrontCategory('${f.id}')" />
                <label for="${checkboxId}" style="cursor:pointer; font-weight: 500; font-size:11px;">${f.name}</label>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error("Failed to load settings fronts:", e);
    }
}

async function toggleFrontCategory(id) {
    const chk = document.getElementById(`front-chk-${id}`);
    if (!chk) return;
    try {
        const res = await ipcRenderer.invoke('update-front-category', id, chk.checked);
        if (res && res.success) {
            console.log(`Front category ${id} set to active: ${chk.checked}`);
            await updateLifeContinuityUI();
        } else {
            alert(`Failed to update front category: ${res ? res.error : 'Unknown error'}`);
        }
    } catch (e) {
        console.error("Failed to toggle front category:", e);
    }
}

// Bind to window
window.applyLoopIntervention = applyLoopIntervention;
window.updateMemoryPreservationUI = updateMemoryPreservationUI;
window.changePreservationState = changePreservationState;
window.updateSettingsFrontsUI = updateSettingsFrontsUI;
window.toggleFrontCategory = toggleFrontCategory;

// ========================================
// ⏱️ EVENT ACTION CENTER & FOCUS TIMER
// ========================================

let activeTimerTask = null;
let activeTimerInterval = null;
let activeTimerSecondsLeft = 0;
let activeTimerDurationTotal = 0;
let activeTimerState = 'idle'; // 'idle', 'running', 'paused'

function openEventActionModal(task) {
    activeTimerTask = task;
    
    // Set UI title
    const titleEl = document.getElementById('eaTaskText');
    if (titleEl) titleEl.innerText = task.text;
    
    const subEl = document.getElementById('eaTaskSub');
    if (subEl) subEl.innerText = `Calendar: ${task.calendar || 'Personal'} | Visibility: ${task.visibility || 'private'}`;
    
    const completeBtn = document.getElementById('eaCompleteBtn');
    if (completeBtn) {
        if (task.completed) {
            completeBtn.innerText = 'Mark Incomplete';
            completeBtn.style.background = '#f59e0b';
        } else {
            completeBtn.innerText = 'Mark Completed';
            completeBtn.style.background = '#10b981';
        }
    }

    // If it's a different task than what we were tracking, reset timer
    if (!activeTimerTask || activeTimerTask.id !== task.id) {
        resetEATimer();
    } else {
        updateEATimerDisplay();
        updateTimerControlBtnUI();
    }
    
    const modal = document.getElementById('eventActionModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEventActionModal() {
    const modal = document.getElementById('eventActionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function actionCompleteTask() {
    if (!activeTimerTask) return;
    const confirmMsg = activeTimerTask.completed ? `Mark "${activeTimerTask.text}" as incomplete?` : `Mark "${activeTimerTask.text}" as completed?`;
    if (confirm(confirmMsg)) {
        stopTimerInterval();
        if (activeTimerTask.completed) {
            await ipcRenderer.invoke('uncomplete-task', activeTimerTask.id || activeTimerTask.text);
        } else {
            await ipcRenderer.invoke('complete-task', activeTimerTask.text);
        }
        closeEventActionModal();
        await loadTasks();
        await updateLifeContinuityUI();
    }
}

async function actionDeleteTask() {
    if (!activeTimerTask) return;
    if (confirm(`Permanently delete event "${activeTimerTask.text}"?`)) {
        stopTimerInterval();
        await ipcRenderer.invoke('delete-task', activeTimerTask.id || activeTimerTask.text);
        closeEventActionModal();
        await loadTasks();
    }
}

function setEATimerPreset(seconds) {
    stopTimerInterval();
    activeTimerSecondsLeft = seconds;
    activeTimerDurationTotal = seconds;
    activeTimerState = 'paused';
    updateEATimerDisplay();
    updateTimerControlBtnUI();
}

function toggleEATimer() {
    if (activeTimerState === 'running') {
        // Pause timer
        stopTimerInterval();
        activeTimerState = 'paused';
        ipcRenderer.invoke('stop-timer');
    } else {
        // Start timer
        if (activeTimerSecondsLeft <= 0) {
            // Default to 25 minutes (1500 seconds)
            activeTimerSecondsLeft = 1500;
            activeTimerDurationTotal = 1500;
        }
        activeTimerState = 'running';
        ipcRenderer.invoke('start-timer');
        activeTimerInterval = setInterval(tickEATimer, 1000);
    }
    updateTimerControlBtnUI();
}

function stopTimerInterval() {
    if (activeTimerInterval) {
        clearInterval(activeTimerInterval);
        activeTimerInterval = null;
    }
}

function resetEATimer() {
    stopTimerInterval();
    activeTimerSecondsLeft = 0;
    activeTimerDurationTotal = 0;
    activeTimerState = 'idle';
    updateEATimerDisplay();
    updateTimerControlBtnUI();
}

async function tickEATimer() {
    if (activeTimerSecondsLeft > 0) {
        activeTimerSecondsLeft--;
        updateEATimerDisplay();
        
        if (activeTimerSecondsLeft === 0) {
            stopTimerInterval();
            activeTimerState = 'idle';
            updateTimerControlBtnUI();
            
            const autoComplete = document.getElementById('eaAutoCompleteCheck').checked;
            const autoRemove = document.getElementById('eaAutoRemoveCheck').checked;
            
            // Stop backend timer and get duration
            const duration = await ipcRenderer.invoke('stop-timer');
            
            alert(`⏱️ Focus session completed for: "${activeTimerTask.text}"!\nDuration: ${Math.round(duration)} seconds.`);
            
            if (autoRemove) {
                await ipcRenderer.invoke('delete-task', activeTimerTask.id || activeTimerTask.text);
            } else if (autoComplete) {
                await ipcRenderer.invoke('complete-task', activeTimerTask.text);
            }
            
            closeEventActionModal();
            await loadTasks();
        }
    }
}

function updateEATimerDisplay() {
    const mins = Math.floor(activeTimerSecondsLeft / 60);
    const secs = activeTimerSecondsLeft % 60;
    const displayStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const displayEl = document.getElementById('eaTimerDisplay');
    if (displayEl) displayEl.innerText = displayStr;
}

function updateTimerControlBtnUI() {
    const btn = document.getElementById('eaTimerControlBtn');
    if (!btn) return;
    if (activeTimerState === 'running') {
        btn.innerText = 'Pause Focus';
        btn.style.background = '#f59e0b';
    } else {
        btn.innerText = 'Start Focus';
        btn.style.background = 'var(--cal-personal)';
    }
}

// Bind action center to window
window.openEventActionModal = openEventActionModal;
window.closeEventActionModal = closeEventActionModal;
window.actionCompleteTask = actionCompleteTask;
window.actionDeleteTask = actionDeleteTask;
window.setEATimerPreset = setEATimerPreset;
window.toggleEATimer = toggleEATimer;
window.resetEATimer = resetEATimer;

// ========================================
// 🚀 AUTO-UPDATE CONTROLLER
// ========================================

async function triggerUpdateCheck() {
    const statusEl = document.getElementById('obsUpdateStatus');
    if (statusEl) statusEl.innerText = 'Checking...';
    try {
        await ipcRenderer.invoke('check-for-updates');
    } catch (e) {
        if (statusEl) statusEl.innerText = 'Check Failed';
        console.error("Failed to check for updates:", e);
    }
}

// Listen for updates from main process autoUpdater
ipcRenderer.on('auto-update-status', (event, info) => {
    const statusEl = document.getElementById('obsUpdateStatus');
    if (statusEl) {
        statusEl.innerText = info.status || 'Idle';
        if (info.error) {
            statusEl.title = info.error;
            statusEl.style.color = '#ef4444';
        } else {
            statusEl.removeAttribute('title');
            if (info.status.includes('available') || info.status.includes('downloaded') || info.status.includes('Downloading')) {
                statusEl.style.color = '#f59e0b';
            } else if (info.status.includes('up to date')) {
                statusEl.style.color = '#10b981';
            } else {
                statusEl.style.color = 'var(--text-main)';
            }
        }
    }
});

window.triggerUpdateCheck = triggerUpdateCheck;



