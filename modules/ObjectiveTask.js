import { saveState, taskTree, currentTask, currentObjective } from './state.js';
import { updateUiTaskList, setCurrentTask } from './ui.js';

// Return the task and index or throw an error
export function getTaskById(taskId, taskTree) {
    if (taskId == null) {
        throw 'Null task id';
    }
    return getTaskByIdRecurse(taskId, taskTree);
}

function getTaskByIdRecurse(taskId, task) {
    if (task.id == taskId) {
        return task;
    }
    for (const childTask of task.children) {
        const foundTask = getTaskByIdRecurse(taskId, childTask);
        if (foundTask != null) {
            return foundTask;
        }
    }
    return null;
}

export function getHighestTaskIdRecurse(task) {
    let nextId = task.id;

    for (const childTask of task.children) {
        const childId = getHighestTaskIdRecurse(childTask);
        if (childId > nextId) {
            nextId = childId;
        }
    }
    return nextId;
}

export class ObjectiveTask {
    id;
    description;
    completed;
    parentId;
    children;

    // UI Elements
    taskHtml;
    descriptionSpan;
    completedCheckbox;
    deleteTaskButton;
    addTaskButton;
    moveUpBotton;
    moveDownButton;

    constructor({ id = undefined, description, completed = false, parentId = '' }) {
        this.description = description;
        this.parentId = parentId;
        this.children = [];
        this.completed = completed;

        // Generate a new ID if none specified
        if (id == undefined) {
            this.id = getHighestTaskIdRecurse(taskTree) + 1;
        } else {
            this.id = id;
        }
    }

    // Accepts optional index. Defaults to adding to end of list.
    addTask(description, index = null) {
        index = index != null ? index : index = this.children.length;
        this.children.splice(index, 0, new ObjectiveTask(
            { description: description, parentId: this.id },
        ));
        saveState();
    }

    getIndex() {
        if (this.parentId !== null) {
            const parent = getTaskById(this.parentId, taskTree);
            const index = parent.children.findIndex(task => task.id === this.id);
            if (index === -1) {
                throw `getIndex failed: Task '${this.description}' not found in parent task '${parent.description}'`;
            }
            return index;
        } else {
            throw `getIndex failed: Task '${this.description}' has no parent`;
        }
    }

    // Used to set parent to complete when all child tasks are completed
    checkParentComplete() {
        let all_completed = true;
        if (this.parentId !== '') {
            const parent = getTaskById(this.parentId, taskTree);
            for (const child of parent.children) {
                if (!child.completed) {
                    all_completed = false;
                    break;
                }
            }
            if (all_completed) {
                parent.completed = true;
                console.info(`Parent task '${parent.description}' completed after all child tasks completed.`);
            } else {
                parent.completed = false;
            }
        }
    }

    // Complete the current task, setting next task to next incomplete task
    completeTask() {
        this.completed = true;
        console.info(`Task successfully completed: ${JSON.stringify(this.description)}`);
        this.checkParentComplete();
        setCurrentTask();
        updateUiTaskList();
    }

    // Add a single task to the UI and attach event listeners for user edits
    addUiElement() {
        const template = `
        <div id="objective-task-label-${this.id}" class="flex1 checkbox_label alignItemsCenter">
            <input id="objective-task-complete-${this.id}" type="checkbox">
            <span class="text_pole objective-task" style="display: block" id="objective-task-description-${this.id}" contenteditable>${this.description}</span>
            <div id="objective-task-delete-${this.id}" class="objective-task-button fa-solid fa-xmark fa-fw fa-lg" title="Delete Task"></div>
            <div id="objective-task-add-${this.id}" class="objective-task-button fa-solid fa-plus fa-fw fa-lg" title="Add Task"></div>
            <div id="objective-task-add-branch-${this.id}" class="objective-task-button fa-solid fa-code-fork fa-fw fa-lg" title="Branch Task"></div>
            <div id="objective-task-move-up-${this.id}" class="objective-task-button fa-solid fa-arrow-up fa-fw fa-lg" title="Move Up"></div>
            <div id="objective-task-move-down-${this.id}" class="objective-task-button fa-solid fa-arrow-down fa-fw fa-lg" title="Move Down"></div>
        </div><br>
        `;

        // Add the filled out template
        $('#objective-tasks').append(template);

        this.completedCheckbox = $(`#objective-task-complete-${this.id}`);
        this.descriptionSpan = $(`#objective-task-description-${this.id}`);
        this.addButton = $(`#objective-task-add-${this.id}`);
        this.deleteButton = $(`#objective-task-delete-${this.id}`);
        this.taskHtml = $(`#objective-task-label-${this.id}`);
        this.branchButton = $(`#objective-task-add-branch-${this.id}`);
        this.moveUpButton = $(`objective-task-move-up-${this.id}`);
        this.moveDownButton = $(`objective-task-move-down-${this.id}`);

        // Handle sub-task forking style
        if (this.children.length > 0) {
            this.branchButton.css({ 'color': '#33cc33' });
        } else {
            this.branchButton.css({ 'color': '' });
        }

        const parent = getTaskById(this.parentId, taskTree);
        if (parent) {
            let index = parent.children.indexOf(this);
            if (index < 1) {
                $(`#objective-task-move-up-${this.id}`).removeClass('fa-arrow-up');
            } else {
                $(`#objective-task-move-up-${this.id}`).addClass('fa-arrow-up');
                $(`#objective-task-move-up-${this.id}`).on('click', () => (this.onMoveUpClick()));
            }

            if (index === (parent.children.length - 1)) {
                $(`#objective-task-move-down-${this.id}`).removeClass('fa-arrow-down');
            } else {
                $(`#objective-task-move-down-${this.id}`).addClass('fa-arrow-down');
                $(`#objective-task-move-down-${this.id}`).on('click', () => (this.onMoveDownClick()));
            }
        }
        // Add event listeners and set properties
        $(`#objective-task-complete-${this.id}`).prop('checked', this.completed);
        $(`#objective-task-complete-${this.id}`).on('click', () => (this.onCompleteClick()));
        $(`#objective-task-description-${this.id}`).on('keyup', () => (this.onDescriptionUpdate()));
        $(`#objective-task-description-${this.id}`).on('focusout', () => (this.onDescriptionFocusout()));
        $(`#objective-task-delete-${this.id}`).on('click', () => (this.onDeleteClick()));
        $(`#objective-task-add-${this.id}`).on('click', () => (this.onAddClick()));
        this.branchButton.on('click', () => (this.onBranchClick()));
    }

    onBranchClick() {
        currentObjective = this;
        updateUiTaskList();
        setCurrentTask();
    }

    complete(completed) {
        this.completed = completed;
        this.children.forEach(child => child.complete(completed));
    }

    onCompleteClick() {
        this.complete(this.completedCheckbox.prop('checked'));
        this.checkParentComplete();
        setCurrentTask();
    }

    onDescriptionUpdate() {
        this.description = this.descriptionSpan.text();
    }

    onDescriptionFocusout() {
        setCurrentTask();
    }

    onDeleteClick() {
        const index = this.getIndex();
        const parent = getTaskById(this.parentId, taskTree);
        parent.children.splice(index, 1);
        updateUiTaskList();
        setCurrentTask();
    }

    onMoveUpClick() {
        const parent = getTaskById(this.parentId, taskTree);
        const index = parent.children.indexOf(this);
        if (index != 0) {
            let temp = parent.children[index - 1];
            parent.children[index - 1] = parent.children[index];
            parent.children[index] = temp;

            updateUiTaskList();
            if (currentTask) {
                setCurrentTask(currentTask.taskId);
            }
        }
    }

    onMoveDownClick() {
        const parent = getTaskById(this.parentId, taskTree);
        const index = parent.children.indexOf(this);
        if (index < (parent.children.length - 1)) {
            let temp = parent.children[index + 1];
            parent.children[index + 1] = parent.children[index];
            parent.children[index] = temp;

            updateUiTaskList();
            setCurrentTask();
        }
    }

    onAddClick() {
        const index = this.getIndex();
        const parent = getTaskById(this.parentId, taskTree);
        parent.addTask('', index + 1);
        updateUiTaskList();
        setCurrentTask();
    }

    toSaveStateRecurse() {
        let children = [];
        if (this.children.length > 0) {
            for (const child of this.children) {
                children.push(child.toSaveStateRecurse());
            }
        }
        return {
            'id': this.id,
            'description': this.description,
            'completed': this.completed,
            'parentId': this.parentId,
            'children': children,
        };
    }
}
