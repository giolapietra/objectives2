import { callPopup, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { objectivePrompts } from './state.js';

export const defaultPrompts = {
    'createTask': 'Pause your roleplay. Please generate a numbered list of plain text tasks to complete an objective. The objective that you must make a numbered task list for is: "{{objective}}". The tasks created should take into account the character traits of {{char}}. These tasks may or may not involve {{user}} directly. Include the objective as the final task.',
    'checkTaskCompleted': 'Pause your roleplay. Determine if this task is completed: [{{task}}]. To do this, examine the most recent messages. Your response must only contain either true or false, and nothing else. Example output: true',
    'currentTask': 'Your current task is [{{task}}]. Balance existing roleplay with completing this task.',
};

export function onEditPromptClick() {
    let popupText = '';
    popupText += `
    <div class="objective_prompt_modal">
        <small>Edit prompts used by Objective for this session. You can use {{objective}} or {{task}} plus any other standard template variables. Save template to persist changes.</small>
        <br>
        <div>
            <label for="objective-prompt-generate">Generation Prompt</label>
            <textarea id="objective-prompt-generate" type="text" class="text_pole textarea_compact" rows="8"></textarea>
            <label for="objective-prompt-check">Completion Check Prompt</label>
            <textarea id="objective-prompt-check" type="text" class="text_pole textarea_compact" rows="8"></textarea>
            <label for="objective-prompt-extension-prompt">Injected Prompt</label>
            <textarea id="objective-prompt-extension-prompt" type="text" class="text_pole textarea_compact" rows="8"></textarea>
        </div>
        <div class="objective_prompt_block">
            <label for="objective-custom-prompt-select">Custom Prompt Select</label>
            <select id="objective-custom-prompt-select"><select>
        </div>
        <div class="objective_prompt_block">
            <input id="objective-custom-prompt-new" class="menu_button" type="submit" value="New Prompt" />
            <input id="objective-custom-prompt-save" class="menu_button" type="submit" value="Save Prompt" />
            <input id="objective-custom-prompt-delete" class="menu_button" type="submit" value="Delete Prompt" />
        </div>
    </div>`;
    callPopup(popupText, 'text');
    populateCustomPrompts();

    // Set current values
    $('#objective-prompt-generate').val(objectivePrompts.createTask);
    $('#objective-prompt-check').val(objectivePrompts.checkTaskCompleted);
    $('#objective-prompt-extension-prompt').val(objectivePrompts.currentTask);

    // Handle value updates
    $('#objective-prompt-generate').on('input', () => {
        objectivePrompts.createTask = $('#objective-prompt-generate').val();
    });
    $('#objective-prompt-check').on('input', () => {
        objectivePrompts.checkTaskCompleted = $('#objective-prompt-check').val();
    });
    $('#objective-prompt-extension-prompt').on('input', () => {
        objectivePrompts.currentTask = $('#objective-prompt-extension-prompt').val();
    });

    // Handle new
    $('#objective-custom-prompt-new').on('click', () => {
        newCustomPrompt();
    });

    // Handle save
    $('#objective-custom-prompt-save').on('click', () => {
        saveCustomPrompt();
    });

    // Handle delete
    $('#objective-custom-prompt-delete').on('click', () => {
        deleteCustomPrompt();
    });

    // Handle load
    $('#objective-custom-prompt-select').on('change', loadCustomPrompt);
}

async function newCustomPrompt() {
    const customPromptName = await callPopup('<h3>Custom Prompt name:</h3>', 'input');

    if (customPromptName == '') {
        toastr.warning('Please set custom prompt name to save.');
        return;
    }
    if (customPromptName == 'default') {
        toastr.error('Cannot save over default prompt');
        return;
    }
    extension_settings.objective.customPrompts[customPromptName] = {};
    Object.assign(extension_settings.objective.customPrompts[customPromptName], objectivePrompts);
    saveSettingsDebounced();
    populateCustomPrompts();
}

function saveCustomPrompt() {
    const customPromptName = $('#objective-custom-prompt-select').find(':selected').val();
    if (customPromptName == 'default') {
        toastr.error('Cannot save over default prompt');
        return;
    }
    Object.assign(extension_settings.objective.customPrompts[customPromptName], objectivePrompts);
    saveSettingsDebounced();
    populateCustomPrompts();
}

function deleteCustomPrompt() {
    const customPromptName = $('#objective-custom-prompt-select').find(':selected').val();

    if (customPromptName == 'default') {
        toastr.error('Cannot delete default prompt');
        return;
    }
    delete extension_settings.objective.customPrompts[customPromptName];
    saveSettingsDebounced();
    populateCustomPrompts();
    loadCustomPrompt();
}

function loadCustomPrompt() {
    const optionSelected = $('#objective-custom-prompt-select').find(':selected').val();
    Object.assign(objectivePrompts, extension_settings.objective.customPrompts[optionSelected]);

    $('#objective-prompt-generate').val(objectivePrompts.createTask);
    $('#objective-prompt-check').val(objectivePrompts.checkTaskCompleted);
    $('#objective-prompt-extension-prompt').val(objectivePrompts.currentTask);
}

function populateCustomPrompts() {
    // Populate saved prompts
    $('#objective-custom-prompt-select').empty();
    for (const customPromptName in extension_settings.objective.customPrompts) {
        const option = document.createElement('option');
        option.innerText = customPromptName;
        option.value = customPromptName;
        option.selected = customPromptName;
        $('#objective-custom-prompt-select').append(option);
    }
}
