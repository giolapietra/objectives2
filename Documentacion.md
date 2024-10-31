# Documentación del Código de la Extensión Objective

Esta documentación describe la funcionalidad de cada parte del archivo `index.js` de la extensión **Objective** para SillyTavern. La extensión tiene como objetivo gestionar tareas y objetivos en un contexto de chat, proporcionando una interfaz que permite a los usuarios trabajar en tareas definidas mientras interactúan en el chat.

## Importaciones y Dependencias

```javascript
import { chat_metadata, callPopup, saveSettingsDebounced, is_send_press } from '../../../../script.js';
import { getContext, extension_settings, saveMetadataDebounced, renderExtensionTemplateAsync } from '../../../extensions.js';
import {
    substituteParams,
    eventSource,
    event_types,
    generateQuietPrompt,
    animation_duration
} from '../../../../script.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { waitUntilCondition } from '../../../utils.js';
import { is_group_generating, selected_group } from '../../../group-chats.js';
import { dragElement } from '../../../../scripts/RossAscends-mods.js';
import { loadMovingUIState } from '../../../../scripts/power-user.js';
```
Estas importaciones proporcionan acceso a diferentes funciones y objetos, como manejo de metadatos del chat, promesas, elementos de interfaz de usuario, y herramientas de extensión.

- `chat_metadata`: Contiene información relevante sobre el chat actual.
- `callPopup()`: Muestra un popup en la interfaz.
- `saveSettingsDebounced()`: Guarda configuraciones con un retraso.
- `generateQuietPrompt()`: Utilizado para generar tareas o respuestas sin interrumpir la conversación.

## Variables Globales

```javascript
let taskTree = null;
let globalTasks = [];
let currentChatId = '';
let currentObjective = null;
let currentTask = null;
let checkCounter = 0;
let lastMessageWasSwipe = false;
```
Estas variables se usan para almacenar el estado actual de las tareas y los objetivos:
- `taskTree`: Almacena la estructura jerárquica de todas las tareas.
- `globalTasks`: Almacena una lista de todas las tareas globales.
- `currentChatId`: Identificador del chat actual.
- `currentObjective`: Referencia al objetivo actual en el que se está trabajando.
- `currentTask`: Referencia a la tarea actual.
- `checkCounter`: Contador para verificar cuándo comprobar si una tarea está completa.
- `lastMessageWasSwipe`: Indica si el último mensaje fue "swipeado" (eliminado o descartado).

## Prompts Predeterminados

```javascript
const defaultPrompts = {
    'createTask': 'Pause your roleplay. Please generate a numbered list of plain text tasks to complete an objective. The objective that you must make a numbered task list for is: "{{objective}}". The tasks created should take into account the character traits of {{char}}. These tasks may or may not involve {{user}} directly. Include the objective as the final task.',
    'checkTaskCompleted': 'Pause your roleplay. Determine if this task is completed: [{{task}}]. To do this, examine the most recent messages. Your response must only contain either true or false, and nothing else. Example output: true',
    'currentTask': 'Your current task is [{{task}}]. Balance existing roleplay with completing this task.',
};

let objectivePrompts = defaultPrompts;
```
`defaultPrompts` contiene las plantillas de texto predeterminadas que se utilizan para generar y verificar tareas. Estas plantillas se usan cuando se interactúa con la IA para que ésta sepa cuál es el objetivo y las tareas asignadas.

## Funciones de Gestión de Tareas

### `getTaskById(taskId)`

```javascript
function getTaskById(taskId) {
    if (taskId == null) {
        throw 'Null task id';
    }
    return getTaskByIdRecurse(taskId, taskTree);
}
```
Esta función devuelve la tarea correspondiente al `taskId` proporcionado. Llama a la función `getTaskByIdRecurse()` para buscar recursivamente la tarea dentro del `taskTree`.

### `generateTasks()`

```javascript
async function generateTasks() {
    const prompt = substituteParamsPrompts(objectivePrompts.createTask, false);
    console.log('Generating tasks for objective with prompt');
    toastr.info('Generating tasks for objective', 'Please wait...');
    const taskResponse = await generateQuietPrompt(prompt);

    currentObjective.children = [];
    const numberedListPattern = /^\d+\./;

    for (const task of taskResponse.split('\n').map(x => x.trim())) {
        if (task.match(numberedListPattern) != null) {
            currentObjective.addTask(task.replace(numberedListPattern, '').trim());
        }
    }
    updateUiTaskList();
    setCurrentTask();
    toastr.success(`Generated ${currentObjective.children.length} tasks`, 'Done!');
}
```
Esta función genera una lista de tareas para un objetivo particular utilizando un prompt para la IA. Divide la respuesta generada en diferentes tareas y las almacena en `currentObjective.children`. Finalmente, actualiza la interfaz de usuario y selecciona la tarea actual.

### `markTaskCompleted()`

```javascript
async function markTaskCompleted() {
    console.info(`User determined task '${currentTask.description} is completed.`);
    currentTask.completeTask();
}
```
Marca la tarea actual como completada y llama al método `completeTask()` de la clase `ObjectiveTask` para actualizar su estado.

### `checkTaskCompleted()`

```javascript
async function checkTaskCompleted() {
    if (jQuery.isEmptyObject(currentTask)) {
        return;
    }

    try {
        if (selected_group) {
            await waitUntilCondition(() => is_group_generating === false, 1000, 10);
        }
        await waitUntilCondition(() => is_send_press === false, 30000, 10);
    } catch {
        console.debug('Failed to wait for group to finish generating');
        return;
    }

    checkCounter = $('#objective-check-frequency').val();
    toastr.info('Checking for task completion.');

    const prompt = substituteParamsPrompts(objectivePrompts.checkTaskCompleted, false);
    const taskResponse = (await generateQuietPrompt(prompt)).toLowerCase();

    if (taskResponse.includes('true')) {
        currentTask.completeTask();
    } else if (!(taskResponse.includes('false'))) {
        console.warn(`checkTaskCompleted response did not contain true or false. taskResponse: ${taskResponse}`);
    }
}
```
Verifica si la tarea actual ha sido completada solicitando a la IA que evalúe el último mensaje del chat. Utiliza `generateQuietPrompt()` para generar la respuesta, que debería ser "true" o "false".

## Clase `ObjectiveTask`

### Definición de la Clase

```javascript
class ObjectiveTask {
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

        if (id == undefined) {
            this.id = getHighestTaskIdRecurse(taskTree) + 1;
        } else {
            this.id = id;
        }
    }
    ...
}
```
La clase `ObjectiveTask` define la estructura de una tarea, que incluye atributos como `id`, `description`, `completed`, `parentId` y `children`. También gestiona elementos de la UI para permitir la manipulación de tareas por parte del usuario.

### Métodos Importantes

- **`addTask(description, index = null)`**: Añade una nueva sub-tarea a la lista de hijos (`children`) de la tarea actual.
- **`completeTask()`**: Marca la tarea como completada, actualiza la interfaz y ajusta el estado de las tareas padres, si es necesario.
- **`addUiElement()`**: Añade los elementos HTML de la tarea a la interfaz de usuario y les asigna eventos, como marcar la tarea como completada o eliminarla.

## Prompts Personalizados

### `onEditPromptClick()`

```javascript
function onEditPromptClick() {
    let popupText = '';
    popupText += `
    <div class="objective_prompt_modal">
        <small>Edit prompts used by Objective for this session. You can use {{objective}} or {{task}} plus any other standard template variables. Save template to persist changes.</small>
        <br>
        ...
    </div>`;
    callPopup(popupText, 'text');
    populateCustomPrompts();
    ...
}
```
Esta función muestra un modal que permite a los usuarios editar los prompts utilizados por la extensión para generar y verificar tareas. También asigna eventos para guardar, crear y eliminar prompts personalizados.

## Gestión del Estado

### `saveState()`

```javascript
function saveState() {
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
```
Esta función guarda el estado actual del objetivo, incluyendo su ID, las tareas, la frecuencia de verificación y la configuración de la interfaz. Utiliza `saveMetadataDebounced()` para evitar guardar el estado en exceso.

### `loadSettings()`

```javascript
function loadSettings() {
    currentChatId = getContext().chatId;
    taskTree = null;
    currentObjective = null;
    ...
    if (chat_metadata.objective.taskTree) {
        taskTree = loadTaskChildrenRecurse(chat_metadata.objective.taskTree);
    }
    currentObjective = taskTree;
    checkCounter = chat_metadata['objective'].checkFrequency;
    ...
    updateUiTaskList();
}
```
Carga el estado guardado del objetivo y las tareas del chat actual. Inicializa variables, establece `taskTree` y `currentObjective`, y luego actualiza la lista de tareas en la interfaz de usuario.

## Eventos del Chat

### `eventSource.on(event_types.CHAT_CHANGED, () => { ... })`

```javascript
eventSource.on(event_types.CHAT_CHANGED, () => {
    resetState();
});
```
Este evento se activa cuando cambia el chat actual. Llama a `resetState()` para restablecer el estado y actualizar el contexto de la extensión.

## Configuración de Settings.html

El archivo `settings.html` define la interfaz de configuración de la extensión Objective.

```html
<div id="objective_contents" class="objective-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <div class="flex-container alignitemscenter margin0">
                <b data-i18n="ext_obj_title">Objective</b>
                <i id="objectiveExtensionPopoutButton" class="fa-solid fa-window-restore menu_button margin0"></i>
            </div>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div id="objectiveExtensionDrawerContents">
                <label for="objective-text"><small>Enter an objective and generate tasks. The AI will attempt to complete tasks autonomously</small></label>
                <textarea id="objective-text" type="text" class="text_pole textarea_compact" rows="4"></textarea>
                <div class="objective_block flex-container">
                    <input id="objective-generate" class="menu_button" type="submit" value="Auto-Generate Tasks" />
                    <label class="checkbox_label"><input id="objective-hide-tasks" type="checkbox"> Hide Tasks</label>
                </div>
                <div id="objective-parent" class="objective_block flex-container">
                    <i class="objective-task-button fa-solid fa-circle-left fa-2x" title="Go to Parent"></i>
                    <small>Go to parent task</small>
                </div>
                <div id="objective-tasks"> </div>
                <div class="objective_block margin-bot-10px">
                    <div class="objective_block objective_block_control flex1 flexFlowColumn">
                        <label for="objective-chat-depth">Position in Chat</label>
                        <input id="objective-chat-depth" class="text_pole widthUnset" type="number" min="0" max="99" />
                    </div>
                    <br>
                    <div class="objective_block objective_block_control flex1">
                        <label for="objective-check-frequency">Task Check Frequency</label>
                        <input id="objective-check-frequency" class="text_pole widthUnset" type="number" min="0" max="99" />
                        <small>(0 = disabled)</small>
                    </div>
                </div>
                <span> Messages until next AI task completion check <span id="objective-counter">0</span></span>
                <div class="objective_block flex-container">
                    <input id="objective_prompt_edit" class="menu_button" type="submit" value="Edit Prompts" />
                </div>
                <hr class="sysHR">
                <div class="objective_block flex-container">
                    <input id="objective-export" class="menu_button" type="submit" value="Export Tasks" />
                    <input id="objective-import" class="menu_button" type="file" />
                </div>
            </div>
        </div>
    </div>
</div>
```

### Descripción de Elementos HTML
- **`#objective_contents`**: Contiene todos los elementos relacionados con la extensión.
- **`#objective-text`**: Textarea donde el usuario puede ingresar el objetivo principal.
- **`#objective-generate`**: Botón que permite a la IA generar automáticamente una lista de tareas.
- **`#objective-hide-tasks`**: Checkbox que permite ocultar o mostrar las tareas generadas.
- **`#objective-parent`**: Permite al usuario navegar a la tarea padre de la tarea actual.
- **`#objective-chat-depth`**: Input para definir la posición en el chat en la que se deben insertar las respuestas de la IA.
- **`#objective-check-frequency`**: Input que controla la frecuencia con la que la IA verifica si una tarea ha sido completada.
- **`#objective_prompt_edit`**: Botón que permite editar los prompts personalizados.
- **`#objective-export`**: Botón que permite exportar las tareas actuales como un archivo JSON.
- **`#objective-import`**: Input que permite importar un archivo JSON para cargar tareas previas.

Este archivo HTML es referenciado y manipulado por el archivo `index.js` para reflejar cambios en la interfaz según las acciones realizadas en la extensión.

## Añadir Funcionalidades de Exportar e Importar en `index.js`

### Funciones de Exportar e Importar Tareas
En la extensión **Objective**, cuando el usuario ingresa un objetivo y se generan tareas, estos datos se almacenan en un conjunto de estructuras dentro del código que se gestionan mediante el estado de la aplicación, específicamente en objetos como `currentObjective` y `taskTree`.

### Almacenamiento de Objetivos y Tareas

1. **Objetivo Actual (`currentObjective`)**:
   - El objetivo que ingresa el usuario en el campo de texto `#objective-text` se guarda en el objeto `currentObjective`.
   - Este objetivo luego se convierte en el "nodo raíz" del `taskTree`, que representa la jerarquía de tareas relacionadas con este objetivo.

2. **Estructura de Tareas (`taskTree`)**:
   - Las tareas generadas para alcanzar el objetivo se almacenan en un árbol de tareas (`taskTree`).
   - Cada nodo del `taskTree` es una instancia de la clase `ObjectiveTask`, que incluye atributos como `id`, `description`, `completed`, `parentId`, y `children`.
   - Cuando se genera una lista de tareas (a través del botón "Auto-Generate Tasks"), cada tarea se añade como un hijo (`children`) del `currentObjective` dentro del `taskTree`.

3. **Metadatos del Chat (`chat_metadata`)**:
   - Para que los datos persistan y puedan ser recuperados en futuras interacciones, se almacenan en `chat_metadata`.
   - La función `saveState()` se encarga de actualizar `chat_metadata` con la estructura de tareas actual (`taskTree`), el objetivo actual (`currentObjectiveId`), la frecuencia de verificación (`checkFrequency`), y otras configuraciones de la extensión.
   - De esta manera, incluso cuando se cambia de sesión de chat, los datos persisten y pueden cargarse nuevamente con la función `loadSettings()`.

4. **Interfaz de Usuario (UI) y Relación con el Estado**:
   - Cuando el usuario interactúa con la interfaz (añadiendo o completando tareas), estos cambios se reflejan inmediatamente en el estado interno de la aplicación (principalmente `taskTree` y `currentObjective`).
   - Además, la interfaz de usuario se actualiza para mostrar el estado más reciente de las tareas mediante la función `updateUiTaskList()`, que repuebla la lista visible de tareas en el DOM.

**Exportar Tareas**
```javascript
function exportTasks() {
    const dataStr = JSON.stringify(taskTree, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'tasks_export.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}
```
Esta función convierte el árbol de tareas (`taskTree`) a una cadena JSON y la descarga como un archivo `.json` para que el usuario la guarde.

**Importar Tareas**
```javascript
function importTasks(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        try {
            const importedTasks = JSON.parse(contents);
            // Aquí se debería validar el objeto JSON antes de asignarlo
            taskTree = importedTasks;
            updateUiTaskList();
            saveState(); // Guardar el estado una vez importado
            toastr.success('Tasks imported successfully', 'Success');
        } catch (error) {
            toastr.error('Error parsing JSON file', 'Import Failed');
        }
    };
    reader.readAsText(file);
}
```
Esta función permite al usuario cargar un archivo `.json` y restaurar el árbol de tareas desde los datos contenidos en él.

### Asignar Funciones a los Controles de la UI

En `index.js`, se deben asignar estas funciones a los botones correspondientes en `settings.html`:

```javascript
$(document).on('click', '#objective-export', exportTasks);
$(document).on('change', '#objective-import', importTasks);
```

### Resumen

Este código gestiona los objetivos y tareas en el contexto de un chat, permitiendo a los usuarios interactuar con tareas específicas mientras participan en el chat. Utiliza prompts para guiar el comportamiento de la IA y facilita la gestión de las tareas mediante una interfaz que permite agregarlas, completarlas y eliminarlas. Las funciones relacionadas con el estado aseguran la persistencia entre sesiones y la correcta integración con el sistema de chat.

Con la adición de las funcionalidades de exportar e importar, los usuarios pueden guardar el progreso de sus tareas y restaurarlo según lo necesiten, mejorando así la portabilidad y la facilidad de uso de la extensión.




