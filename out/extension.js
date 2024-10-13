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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', 'api.env') });
// This method is called when your extension is activated
function activate(context) {
    // Register the "Explain Code" command
    let explainCode = vscode.commands.registerCommand('AK-CodePulse.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (selectedText.trim()) {
                // Display the selected code in a new panel
                const panel = vscode.window.createWebviewPanel('codePulseExplanation', 'Code Explanation', vscode.ViewColumn.Beside, {});
                panel.webview.html = `<html><body><pre>${selectedText}</pre></body></html>`;
            }
            else {
                vscode.window.showInformationMessage("Please select some code to explain.");
            }
        }
    });
    context.subscriptions.push(explainCode);
    // Set interval to analyze code every 30 seconds
    const interval = setInterval(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            // Process diagnostics
            const errors = diagnostics.filter(diag => diag.severity === vscode.DiagnosticSeverity.Error);
            if (errors.length > 0) {
                // Show the first error
                const firstError = errors[0];
                const lineNumber = firstError.range.start.line + 1;
                vscode.window.showErrorMessage(`Error on line ${lineNumber}: ${firstError.message}`);
            }
            else {
                // Provide a generic message
                vscode.window.showInformationMessage("Code looks great so far.");
            }
        }
    }, 30000); //30 seconds
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}
// Deactivation method
function deactivate() { }
//# sourceMappingURL=extension.js.map