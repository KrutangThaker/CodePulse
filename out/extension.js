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
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
async function getFetch() {
    const { default: fetch } = await import('node-fetch');
    return fetch;
}
// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', 'api.env') });
// This method is called when your extension is activated
function activate(context) {
    // Data structures to store previous errors and recent edits
    const previousErrors = new Set();
    const recentEdits = new Map(); // Map line numbers to timestamps
    // Register the "Explain Code" command
    let explainCode = vscode.commands.registerCommand('alex-krutang-codepulse.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (selectedText.trim()) {
                // Call your GPT-4 Mini API to explain the code
                const explanation = await getExplanationFromAPI(selectedText);
                if (explanation) {
                    // Display the explanation in a new panel
                    const panel = vscode.window.createWebviewPanel('codePulseExplanation', 'Code Explanation', vscode.ViewColumn.Beside, {});
                    panel.webview.html = `<html><body><pre>${explanation}</pre></body></html>`;
                }
                else {
                    vscode.window.showErrorMessage("Could not generate an explanation.");
                }
            }
            else {
                vscode.window.showInformationMessage("Please select some code to explain.");
            }
        }
    });
    context.subscriptions.push(explainCode);
    // Set up listener for document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0)
            return; // No changes
        const timestamp = Date.now();
        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            for (let line = startLine; line <= endLine; line++) {
                recentEdits.set(line, timestamp);
            }
        }
        // Clean up old entries in recentEdits (older than 5 seconds)
        const fiveSecondsAgo = timestamp - 5000;
        for (const [line, editTime] of recentEdits) {
            if (editTime < fiveSecondsAgo) {
                recentEdits.delete(line);
            }
        }
    });
    // Set interval to analyze code every 30 seconds
    const interval = setInterval(async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            // Process diagnostics
            const validErrors = [];
            const currentTime = Date.now();
            const fiveSecondsAgo = currentTime - 5000;
            for (const diagnostic of diagnostics) {
                // Ignore non-error diagnostics (e.g., warnings)
                if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
                    continue;
                }
                const lineNumber = diagnostic.range.start.line;
                const errorKey = `${lineNumber}:${diagnostic.message}`;
                // Ignore if error was previously shown
                if (previousErrors.has(errorKey)) {
                    continue;
                }
                // Ignore if error was caused by recent typing
                const lastEditTime = recentEdits.get(lineNumber);
                if (lastEditTime && lastEditTime >= fiveSecondsAgo) {
                    continue;
                }
                validErrors.push({ errorKey, lineNumber, message: diagnostic.message });
            }
            if (validErrors.length > 0) {
                // Show the first valid error
                const firstError = validErrors.shift(); // Added '!' here
                previousErrors.add(firstError.errorKey);
                vscode.window.showErrorMessage(`Error on line ${firstError.lineNumber + 1}: ${firstError.message}`);
                // For remaining valid errors, list line numbers
                if (validErrors.length > 0) {
                    const lineNumbers = validErrors.map(err => err.lineNumber + 1);
                    vscode.window.showInformationMessage(`Additional errors on lines: ${lineNumbers.join(', ')}`);
                }
            }
            else {
                // No valid errors, provide a tip
                await provideTip(document.getText());
            }
            // Clean up recentEdits
            for (const [line, editTime] of recentEdits) {
                if (editTime < fiveSecondsAgo) {
                    recentEdits.delete(line);
                }
            }
        }
    }, 30000); // 30 seconds
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}
// Function to call GPT-4 Mini API for code explanation
async function getExplanationFromAPI(codeSnippet) {
    const apiKey = process.env.GPT4_API_KEY; // Securely handle API key
    const apiEndpoint = "https://api.openai.com/v1/chat/completions"; // Correct endpoint for chat-based API
    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return null;
    }
    const fetch = await getFetch();
    if (!fetch)
        return null; // Check if fetch was successfully loaded
    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-2024-07-18", // Specify the model
                messages: [{ role: "user", content: codeSnippet }], // Use the 'messages' format
            })
        });
        const result = await response.json(); // Get the result
        // Type guard to check if result has the expected structure
        if (result && typeof result === 'object' && 'choices' in result) {
            const choices = result.choices;
            // Check if choices exist and return the appropriate message
            if (Array.isArray(choices) && choices.length > 0) {
                return choices[0].message.content; // Access the content directly
            }
        }
        return "Could not generate an explanation.";
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error fetching explanation: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
// Function to provide a helpful tip
async function provideTip(codeSnippet) {
    const apiKey = process.env.GPT4_API_KEY;
    const apiEndpoint = "https://api.openai.com/v1/chat/completions";
    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return;
    }
    const fetch = await getFetch();
    if (!fetch)
        return;
    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-2024-07-18", // Specify the model
                messages: [{ role: "user", content: `Provide a helpful tip for the following code, focusing on areas like reducing time complexity, improving code organization, or identifying redundant expressions:\n\n${codeSnippet}` }],
                max_tokens: 150 // Adjust as necessary
            })
        });
        const result = await response.json();
        if (result.choices && result.choices.length > 0) {
            const tip = result.choices[0].message.content;
            if (tip && tip.trim()) {
                vscode.window.showInformationMessage(`CodePulse Tip: ${tip}`);
            }
            else {
                vscode.window.showInformationMessage("Code looks great so far.");
            }
        }
        else {
            vscode.window.showInformationMessage("Code looks great so far.");
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error fetching tip: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Deactivation method
function deactivate() { }
//# sourceMappingURL=extension.js.map