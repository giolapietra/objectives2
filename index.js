import { eventSource, event_types } from '../../../script.js';
import { registerSlashCommand } from '../../slash-commands.js';
import { dragElement } from '../../../scripts/RossAscends-mods.js';
import { loadMovingUIState } from '../../../scripts/power-user.js';
import { renderExtensionTemplateAsync } from '../../extensions.js';

// Import modules
import { ObjectiveTask } from './modules/ObjectiveTask.js';
import { resetState, loadSettings, debugObjectiveExtension } from './modules/state.js';
import { updateUiTaskList, setCurrentTask, onParentClick, onObjectiveTextFocusOut, onChatDepthInput, onCheckFrequencyInput, onHideTasksInput } from './modules/ui.js';
import { onEditPromptClick, defaultPrompts } from './modules/prompts.js';
import { generateTasks, markTaskCompleted, checkTaskCompleted } from './modules/tasks.js';

const MODULE_NAME = 'Objective';

function addManualTaskCheckUi() {
    const getWandContainer = () => $(document.getElementById('objective_wand_container') ?? document.getElementById('extensionsMenu'));
    const container = getWandContainer();
    container.append(`
        <div id="objective-task-manual-check-menu-item" class="list-group-item flex-container flexGap5">
            <div id="objective-task-manual-check" class="extensionsMenuExtensionButton fa-regular fa-square-check"/></div>
            Manual Task Check
        </div>`);
    container.append(`
        <div id="objective-task-complete-current-menu-item" class="list-group-item flex-container flexGap5">
            <div id="objective-task-complete-current" class="extensionsMenuExtensionButton fa-regular fa-list-check"/></div>
            Complete Current Task
        </div>`);
    $('#objective-task-manual-check-menu-item').attr('title', 'Trigger AI check of completed tasks').on('click', checkTaskCompleted);
    $('#objective-task-complete-current-menu-item').attr('title', 'Mark the current task as completed.').on('click', markTaskCompleted);
}

function doPopout(e) {
    const target = e.target;

    //repurposes the zoomed avatar template to server as a floating div
    if ($('#objectiveExtensionPopout').length === 0) {
        console.debug('did not see popout yet, creating');
        const originalHTMLClone = $(target).parent().parent().parent().find('.inline-drawer-content').html();
        const originalElement = $(target).parent().parent().parent().find('.inline-drawer-content');
        const template = $('#zoomed_avatar_template').html();
        const controlBarHtml = `<div class="panelControlBar flex-container">
        <div id="objectiveExtensionPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
        <div id="objectiveExtensionPopoutClose" class="fa-solid fa-circle-xmark hoverglow dragClose"></div>
    </div>`;
        const newElement = $(template);
        newElement.attr('id', 'objectiveExtensionPopout')
            .removeClass('zoomed_avatar')
            .addClass('draggable')
            .empty();
        originalElement.html('<div class="flex-container alignitemscenter justifyCenter wide100p"><small>Currently popped out</small></div>');
        newElement.append(controlBarHtml).append(originalHTMLClone);
        $('#movingDivs').append(newElement);
        $('#objectiveExtensionDrawerContents').addClass('scrollY');
        loadSettings();
        loadMovingUIState();

        $('#objectiveExtensionPopout').css('display', 'flex').fadeIn(animation_duration);
        dragElement(newElement);

        //setup listener for close button to restore extensions menu
        $('#objectiveExtensionPopoutClose').off('click').on('click', function () {
            $('#objectiveExtensionDrawerContents').removeClass('scrollY');
            const objectivePopoutHTML = $('#objectiveExtensionDrawerContents');
            $('#objectiveExtensionPopout').fadeOut(animation_duration, () => {
                originalElement.empty();
                originalElement.html(objectivePopoutHTML);
                $('#objectiveExtensionPopout').remove();
            });
            loadSettings();
        });
    } else {
        console.debug('saw existing popout, removing');
        $('#objectiveExtensionPopout').fadeOut(animation_duration, () => { $('#objectiveExtensionPopoutClose').trigger('click'); });
    }
}

jQuery(async () => {
    const settingsHtml = await renderExtensionTemplateAsync('third-party/Extension-Objective', 'settings');
    addManualTaskCheckUi();

    const getContainer = () => $(document.getElementById('objective_container') ?? document.getElementById('extensions_settings'));
    getContainer().append(settingsHtml);

    // Event handlers
    $(document).on('click', '#objective-generate', generateTasks);
    $(document).on('input', '#objective-chat-depth', onChatDepthInput);
    $(document).on('input', '#objective-check-frequency', onCheckFrequencyInput);
    $(document).on('click', '#objective-hide-tasks', onHideTasksInput);
    $(document).on('click', '#objective_prompt_edit', onEditPromptClick);
    $(document).on('click', '#objective-parent', onParentClick);
    $(document).on('focusout', '#objective-text', onObjectiveTextFocusOut);
    $(document).on('click', '#objectiveExtensionPopoutButton', function (e) {
        doPopout(e);
        e.stopPropagation();
    });

    $('#objective-parent').hide();
    loadSettings();

    // Event listeners
    eventSource.on(event_types.CHAT_CHANGED, () => {
        resetState();
    });

    eventSource.on(event_types.MESSAGE_SWIPED, () => {
        lastMessageWasSwipe = true;
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        if (currentChatId == undefined || jQuery.isEmptyObject(currentTask) || lastMessageWasSwipe) {
            lastMessageWasSwipe = false;
            return;
        }
        if ($('#objective-check-frequency').val() > 0) {
            // Check only at specified interval
            if (checkCounter <= 0) {
                checkTaskCompleted();
            }
            checkCounter -= 1;
        }
        setCurrentTask();
        $('#objective-counter').text(checkCounter);
    });

    registerSlashCommand('taskcheck', checkTaskCompleted, [], '– checks if the current task is completed', true, true);
});

// Make debug function available globally
window.debugObjectiveExtension = debugObjectiveExtension;
