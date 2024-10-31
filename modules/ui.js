import { getContext } from '../../../extensions.js';
import { substituteParams } from '../../../../script.js';
import { currentTask, currentObjective, taskTree, objectivePrompts, saveState, checkCounter } from './state.js';
import { getTaskById } from './ObjectiveTask.js';

// Populate UI task list
export function updateUiTaskList() {
    $('#objective-tasks').empty();

    // Show button to navigate back to parent objective if parent exists
    if (currentObjective) {
        if (currentObjective.parentId !== '') {
            $('#objective-parent').show();
        } else {
            $('#objective-parent').hide();
        }
    }

    $('#objective-text').val(currentObjective.description);
    if (currentObjective.children.length > 0) {
        // Show tasks if there are any to show
        for (const task of currentObjective.children) {
            task.addUiElement();
        }
    } else {
        // Show button to add tasks if there are none
        $('#objective-tasks').append(`
        <input id="objective-task-add-first" type="button" class="menu_button" value="Add Task">
        `);
        $('#objective-task-add-first').on('click', () => {
            currentObjective.addTask('');
            setCurrentTask();
            updateUiTaskList();
        });
    }
}

function getNextIncompleteTaskRecurse(task) {
    if (task.completed === false // Return task if incomplete
        && task.children.length === 0 // Ensure task has no children, it's subtasks will determine completeness
        && task.parentId !== ''  // Must have parent id. Only root task will be missing this and we dont want that
    ) {
        return task;
    }
    for (const childTask of task.children) {
        if (childTask.completed === true) { // Don't recurse into completed tasks
            continue;
        }
        const foundTask = getNextIncompleteTaskRecurse(childTask);
        if (foundTask != null) {
            return foundTask;
        }
    }
    return null;
}

function substituteParamsPrompts(content, substituteGlobal) {
    content = content.replace(/{{objective}}/gi, currentObjective?.description ?? '');
    content = content.replace(/{{task}}/gi, currentTask?.description ?? '');
    content = content.replace(/{{parent}}/gi, currentTask?.parent?.description ?? '');
    if (substituteGlobal) {
        content = substituteParams(content);
    }
    return content;
}

// Set a task in extensionPrompt context. Defaults to first incomplete
export function setCurrentTask(taskId = null, skipSave = false) {
    const context = getContext();

    // TODO: Should probably null this rather than set empty object
    currentTask = {};

    // Find the task, either next incomplete, or by provided taskId
    if (taskId === null) {
        currentTask = getNextIncompleteTaskRecurse(taskTree) || {};
    } else {
        currentTask = getTaskById(taskId, taskTree);
    }

    // Don't just check for a current task, check if it has data
    const description = currentTask.description || null;
    if (description) {
        const extensionPromptText = substituteParamsPrompts(objectivePrompts.currentTask, true);

        // Remove highlights
        $('.objective-task').css({ 'border-color': '', 'border-width': '' });
        // Highlight current task
        let highlightTask = currentTask;
        while (highlightTask.parentId !== '') {
            if (highlightTask.descriptionSpan) {
                highlightTask.descriptionSpan.css({ 'border-color': 'yellow', 'border-width': '2px' });
            }
            const parent = getTaskById(highlightTask.parentId, taskTree);
            highlightTask = parent;
        }

        // Update the extension prompt
        context.setExtensionPrompt('Objective', extensionPromptText, 1, $('#objective-chat-depth').val());
        console.info(`Current task in context.extensionPrompts.Objective is ${JSON.stringify(context.extensionPrompts.Objective)}`);
    } else {
        context.setExtensionPrompt('Objective', '');
        console.info('No current task');
    }

    // Save state if not skipping
    if (!skipSave) {
        saveState();
    }
}

export function onParentClick() {
    currentObjective = getTaskById(currentObjective.parentId, taskTree);
    updateUiTaskList();
    setCurrentTask();
}

export function onObjectiveTextFocusOut() {
    if (currentObjective) {
        currentObjective.description = $('#objective-text').val();
        saveState();
    }
}

export function onChatDepthInput() {
    saveState();
    setCurrentTask(); // Ensure extension prompt is updated
}

export function onCheckFrequencyInput() {
    checkCounter = $('#objective-check-frequency').val();
    $('#objective-counter').text(checkCounter);
    saveState();
}

export function onHideTasksInput() {
    $('#objective-tasks').prop('hidden', $('#objective-hide-tasks').prop('checked'));
    saveState();
}
