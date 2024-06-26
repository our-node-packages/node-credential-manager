import ReadlineManager from "../utils/ReadlineManager";
import { versions } from "../src/database/versions";
import { initializeGlobals } from "../utils/initializeGlobals";

let projectName = '';
let serviceName = '';
let secretName = '';
let decryptedSelection: boolean | null = null;

const performVersionAction = async (dbClient: any, action: string, mainMenuCallback: (dbClient: any) => Promise<void>, versionName: string = '', value: string = '') => {
    try {
        const params = { dbClient, projectName, serviceName, secretName, versionName, value, decrypted: decryptedSelection ?? false };
        //@ts-ignore
        const response = await versions[action](params);
        console.log(`${action.charAt(0).toUpperCase() + action.slice(1)} Status:`, JSON.stringify(response.status, null, 2));
        console.log(`${action.charAt(0).toUpperCase() + action.slice(1)} Message: Response:`, JSON.stringify(response.message, null, 2));
        console.log(response?.version?.value || response?.versions);

    } catch (error: any) {
        console.error(`An error occurred during ${action}:`, error.message);
    }

    if (action !== 'return') {
        await versionManagementMenu(dbClient, mainMenuCallback);
    }
};

export const versionManagementMenu = async (dbClient: any, mainMenuCallback: (dbClient: any) => Promise<void>) => {
    // Initialize globals only if they haven't been set yet
    if (!projectName || !serviceName || !secretName || decryptedSelection === null) {
        const globals = await initializeGlobals();
        // Check if the user decided to exit the initialization process
        if (globals) {
            ({ projectName, serviceName, secretName, decryptedSelection } = globals);
        } else {
            console.log("Initialization skipped or exited. Please ensure all global settings are properly set.");
            await mainMenuCallback(dbClient);
            return;
        }
    }

    console.log('\nVersion Management Menu:');
    console.log('1. List Versions');
    console.log('2. Add Version');
    console.log('3. Update Version');
    console.log('4. Delete Version');
    console.log('5. Rollback Version');
    console.log('6. Get Latest Version');
    console.log('7. Change Global Settings');
    console.log('8. Return to Main Menu');

    const choice = (await ReadlineManager.askQuestion('Enter your choice: ') as string).trim();
    if (choice === '8') {
        await mainMenuCallback(dbClient);
        return;
    } else if (choice === '7') {
        // Reinitialize globals anytime user selects to change global settings
        const globals = await initializeGlobals();
        if (globals) {
            ({ projectName, serviceName, secretName, decryptedSelection } = globals);
        } else {
            console.log("Global settings update was skipped or exited. Current settings remain unchanged.");
        }
        // Display the menu again regardless of whether the user updated the globals or exited
        await versionManagementMenu(dbClient, mainMenuCallback);
        return;
    }

    await handleVersionAction(choice, dbClient, mainMenuCallback);
};

const handleVersionAction = async (choice: string, dbClient: any, mainMenuCallback: (dbClient: any) => Promise<void>) => {
    const action = choiceToAction(choice);
    let versionName = '', value = '';
    switch (action) {
        case 'add':
        case 'update':
            versionName = (await ReadlineManager.askQuestion(
                'Enter version number (e.g., v1.0). It will be auto-incremented if not supplied: '
            ) as string).trim();
            value = (await ReadlineManager.askQuestion(
                'Enter version value (Note: This will be encrypted automatically using AES-256-CTR algorithm for database storage): '
            ) as string).trim();
            break;
        case 'delete':
            versionName = (await ReadlineManager.askQuestion(
                'Enter version number to delete (e.g., v1.0): '
            ) as string).trim();
            break;
    }

    await performVersionAction(dbClient, action, mainMenuCallback, versionName, value);
};

const choiceToAction = (choice: string) => {
    switch (choice) {
        case '1': return 'list';
        case '2': return 'add';
        case '3': return 'update';
        case '4': return 'delete';
        case '5': return 'rollback';
        case '6': return 'latest';
        default: throw new Error('Invalid choice for action mapping');
    }
};
