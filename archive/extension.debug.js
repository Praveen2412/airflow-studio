"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Airflow Extension');
    outputChannel.show();
    try {
        outputChannel.appendLine('[1/7] Starting activation...');
        console.log('[Airflow] Starting activation...');
        outputChannel.appendLine('[2/7] Importing Logger...');
        const { Logger } = require('./utils/logger');
        outputChannel.appendLine('[2/7] ✓ Logger imported');
        outputChannel.appendLine('[3/7] Initializing Logger...');
        Logger.initialize(context);
        Logger.info('Logger initialized');
        outputChannel.appendLine('[3/7] ✓ Logger initialized');
        outputChannel.appendLine('[4/7] Importing ServerManager...');
        const { ServerManager } = require('./managers/ServerManager');
        outputChannel.appendLine('[4/7] ✓ ServerManager imported');
        outputChannel.appendLine('[5/7] Importing Providers...');
        const { ServersTreeProvider } = require('./providers/ServersTreeProvider');
        const { DagsTreeProvider } = require('./providers/DagsTreeProvider');
        const { AdminTreeProvider } = require('./providers/AdminTreeProvider');
        outputChannel.appendLine('[5/7] ✓ Providers imported');
        outputChannel.appendLine('[6/7] Creating instances...');
        const serverManager = new ServerManager(context);
        const serversTreeProvider = new ServersTreeProvider(serverManager);
        const dagsTreeProvider = new DagsTreeProvider(serverManager);
        const adminTreeProvider = new AdminTreeProvider(serverManager);
        outputChannel.appendLine('[6/7] ✓ Instances created');
        outputChannel.appendLine('[7/7] Registering providers...');
        context.subscriptions.push(vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider), vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider), vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider));
        outputChannel.appendLine('[7/7] ✓ Providers registered');
        outputChannel.appendLine('=== ACTIVATION SUCCESSFUL ===');
        Logger.info('=== ACTIVATION SUCCESSFUL ===');
        vscode.window.showInformationMessage('Airflow Extension Activated!');
    }
    catch (error) {
        const errorMsg = `ACTIVATION FAILED: ${error.message}\n${error.stack}`;
        outputChannel.appendLine(errorMsg);
        console.error('[Airflow] ACTIVATION FAILED:', error);
        vscode.window.showErrorMessage(`Airflow activation failed: ${error.message}`);
        throw error;
    }
}
function deactivate() {
    console.log('[Airflow] Deactivated');
}
//# sourceMappingURL=extension.debug.js.map