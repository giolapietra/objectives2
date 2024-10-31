import { generateQuietPrompt, substituteParams } from '../../../../script.js';
import { currentTask, currentObjective, objectivePrompts, checkCounter } from './state.js';
import { updateUiTaskList, setCurrentTask } from './ui.js';
import { waitUntilCondition } from '../../../utils.js';
import { is_group_generating, selected_group } from '../../../group-chats.js';
import { is_send_press } from '../../../../script.js';

function substituteParamsPrompts(content, substituteGlobal) {
    content = content.replace(/{{objective}}/gi, currentObjective?.description ?? '');
    content = content.replace(/{{task}}/gi, currentTask?.description ?? '');
    content = content.replace(/{{parent}}/gi, currentTask?.parent?.description ?? '');
    if (substituteGlobal) {
        content = substituteParams(content);
    }
    return content;
}

// Call Quiet Generate to create task list using character context, then convert to tasks. Should not be called much.
export async function generateTasks() {
    const prompt = substituteParamsPrompts(objectivePrompts.createTask, false);
    console.log('Generating tasks for objective with prompt');
    toastr.info('Generating tasks for objective', 'Please wait...');
    const taskResponse = await generateQuietPrompt(prompt);

    // Clear all existing objective tasks when generating
    currentObjective.children = [];
    const numberedListPattern = /^\d+\./;

    // Create tasks from generated task list
    for (const task of taskResponse.split('\n').map(x => x.trim())) {
        if (task.match(numberedListPattern) != null) {
            currentObjective.addTask(task.replace(numberedListPattern, '').trim());
        }
    }
    updateUiTaskList();
    setCurrentTask();
    console.info(`Response for Objective: '${currentObjective.description}' was \n'${taskResponse}', \nwhich created tasks \n${JSON.stringify(currentObjective.children.map(v => { return v.toSaveStateRecurse(); }), null, 2)} `);
    toastr.success(`Generated ${currentObjective.children.length} tasks`, 'Done!');
}

export async function markTaskCompleted() {
    if (!currentTask || !currentTask.description) {
        console.warn('No current task to complete');
        return;
    }
    console.info(`User determined task '${currentTask.description}' is completed.`);
    currentTask.completeTask();
}

// Call Quiet Generate to check if a task is completed
export async function checkTaskCompleted() {
    // Make sure there are tasks
    if (!currentTask || !currentTask.description) {
        console.debug('No current task to check');
        return;
    }

    try {
        // Wait for group to finish generating
        if (selected_group) {
            await waitUntilCondition(() => is_group_generating === false, 1000, 10);
        }
        // Another extension might be doing something with the chat, so wait for it to finish
        await waitUntilCondition(() => is_send_press === false, 30000, 10);
    } catch {
        console.debug('Failed to wait for group to finish generating');
        return;
    }

    $('#objective-counter').text(checkCounter);
    toastr.info('Checking for task completion.');

    const prompt = substituteParamsPrompts(objectivePrompts.checkTaskCompleted, false);
    const taskResponse = (await generateQuietPrompt(prompt)).toLowerCase();

    // Check response if task complete
    if (taskResponse.includes('true')) {
        console.info(`Character determined task '${currentTask.description}' is completed.`);
        currentTask.completeTask();
    } else if (!(taskResponse.includes('false'))) {
        console.warn(`checkTaskCompleted response did not contain true or false. taskResponse: ${taskResponse}`);
    } else {
        console.debug(`Checked task completion. taskResponse: ${taskResponse}`);
    }
}
