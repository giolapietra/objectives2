import { chat_metadata, saveMetadataDebounced } from '../../../../script.js';
import { getContext, extension_settings } from '../../../extensions.js';
import { ObjectiveTask } from './ObjectiveTask.js';
import { defaultPrompts } from './prompts.js';
import { updateUiTaskList, setCurrentTask } from './ui.js';

export let taskTree = null;
export let globalTasks = [];
export let currentChatId = '';
export let currentObjective = null;
export let currentTask = null;
export let checkCounter = 0;
export let lastMessageWasSwipe = false;
export let objectivePrompts = { ...defaultPrompts };

const defaultSettings = {
    currentObjectiveId: null,
    taskTree: null,
    chatDepth: 2,
    checkFrequency: 3,
    hideTasks: false,
    prompts: defaultPrompts,
};

export function saveState() {
    const context = getContext();

    if (currentChatId == '') {
        currentChatId = context.chatId;
    }

    chat_metadata['objective'] = {
        currentObjectiveId: currentObjective.id,
        taskTree: taskTree.toSaveStateRecurse(),
        checkFrequency: $('#objective-check-frequency').val(),
        chatDepth: $('#objective-chat-depth').val(),
        hideTasks: $('#objective-hide-tasks').prop('checked'),
        prompts: objectivePrompts,
    };

    saveMetadataDebounced();
}

function loadTaskChildrenRecurse(savedTask) {
    let tempTaskTree = new ObjectiveTask({
        id: savedTask.id,
        description: savedTask.description,
        completed: savedTask.completed,
        parentId: savedTask.parentId,
    });
    for (const task of savedTask.children) {
        const childTask = loadTaskChildrenRecurse(task);
        tempTaskTree.children.push(childTask);
    }
    return tempTaskTree;
}

export function resetState() {
    lastMessageWasSwipe = false;
    loadSettings();
}

export function loadSettings() {
    // Load/Init settings for chatId
    currentChatId = getContext().chatId;

    // Reset Objectives and Tasks in memory
    taskTree = null;
    currentObjective = null;

    // Init extension settings
    if (Object.keys(extension_settings.objective).length === 0) {
        Object.assign(extension_settings.objective, { 'customPrompts': { 'default': defaultPrompts } });
    }

    // Generate a temporary chatId if none exists
    if (currentChatId == undefined) {
        currentChatId = 'no-chat-id';
    }

    // Migrate existing settings
    if (currentChatId in extension_settings.objective) {
        // TODO: Remove this soon
        chat_metadata['objective'] = extension_settings.objective[currentChatId];
        delete extension_settings.objective[currentChatId];
    }

    if (!('objective' in chat_metadata)) {
        Object.assign(chat_metadata, { objective: defaultSettings });
    }

    // Migrate legacy flat objective to new objectiveTree and currentObjective
    if ('objective' in chat_metadata.objective) {
        // Create root objective from legacy objective
        taskTree = new ObjectiveTask({ id: 0, description: chat_metadata.objective.objective });
        currentObjective = taskTree;

        // Populate root objective tree from legacy tasks
        if ('tasks' in chat_metadata.objective) {
            let idIncrement = 0;
            taskTree.children = chat_metadata.objective.tasks.map(task => {
                idIncrement += 1;
                return new ObjectiveTask({
                    id: idIncrement,
                    description: task.description,
                    completed: task.completed,
                    parentId: taskTree.id,
                });
            });
        }
        saveState();
        delete chat_metadata.objective.objective;
        delete chat_metadata.objective.tasks;
    } else {
        // Load Objectives and Tasks (Normal path)
        if (chat_metadata.objective.taskTree) {
            taskTree = loadTaskChildrenRecurse(chat_metadata.objective.taskTree);
        }
    }

    // Make sure there's a root task
    if (!taskTree) {
        taskTree = new ObjectiveTask({ id: 0, description: $('#objective-text').val() });
    }

    currentObjective = taskTree;
    checkCounter = chat_metadata['objective'].checkFrequency;
    objectivePrompts = chat_metadata['objective'].prompts || { ...defaultPrompts };

    // Update UI elements
    $('#objective-counter').text(checkCounter);
    $('#objective-text').text(taskTree.description);
    updateUiTaskList();
    $('#objective-chat-depth').val(chat_metadata['objective'].chatDepth);
    $('#objective-check-frequency').val(chat_metadata['objective'].checkFrequency);
    $('#objective-hide-tasks').prop('checked', chat_metadata['objective'].hideTasks);
    $('#objective-tasks').prop('hidden', $('#objective-hide-tasks').prop('checked'));
    setCurrentTask(null, true);
}

// Dump core state for debugging
export function debugObjectiveExtension() {
    console.log(JSON.stringify({
        'currentTask': currentTask,
        'currentObjective': currentObjective,
        'taskTree': taskTree.toSaveStateRecurse(),
        'chat_metadata': chat_metadata['objective'],
        'extension_settings': extension_settings['objective'],
        'prompts': objectivePrompts,
    }, null, 2));
}
