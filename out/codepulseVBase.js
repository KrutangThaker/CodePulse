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
//successful trial 1 of basis of using gpt api from vscode, simplicity sake
const vscode = __importStar(require("vscode"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
//add to readme: how the user would connect their own api token here in a blank "api.env" file
dotenv.config({ path: path.join(__dirname, '..', 'api.env') });
//making function to be flagged to run when the extension is run/activateed
function activate(context) {
    // Register the "Explain Code" command
    let explainCode = vscode.commands.registerCommand('alex-krutang-atharva-codepulse.explainCode', async () => {
        const editor = vscode.window.activeTextEditor; //read it and open popups in window
        if (editor) {
            const selection = editor.selection; //using a defined "editor.selection" to get user parsed
            const selectedText = editor.document.getText(selection); //for a specific user query for certain code we want to grab what they've copied/highlighted in their vscode window
            if (selectedText.trim()) {
                // Display the selected code in vs codes new panel
                const panel = vscode.window.createWebviewPanel('codePulseExplanation', //includes our gpt api 
                'Code Explanation', //explains the code
                vscode.ViewColumn.Beside, //vscode side column
                {});
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
            const document = editor.document; //we want to incorporate this such that we can prevent it from using gpt api tokens (stop excess payment) if the code is sitting idle/unedited?
            //doesnt work for now but to be improved later
            const diagnostics = vscode.languages.getDiagnostics(document.uri); //base comparison
            // Process diagnostics
            const errors = diagnostics.filter(diag => diag.severity === vscode.DiagnosticSeverity.Error);
            if (errors.length > 0) {
                // Show the first error
                const firstError = errors[0];
                const lineNumber = firstError.range.start.line + 1;
                vscode.window.showErrorMessage(`Error on line ${lineNumber}: ${firstError.message}`); //error msg in vscode takes priority over "showmessage"
            }
            else {
                //print something that dopesnt 
                vscode.window.showInformationMessage("Code looks great so far.");
            }
        }
    }, 30000); //30 seconds per pulse
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}
// Deactivation method
function deactivate() { }
//# sourceMappingURL=codepulseVBase.js.map