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
    // Set interval to analyze code every 30 seconds
    const interval = setInterval(async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const documentText = editor.document.getText();
            await analyzeCode(documentText);
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
// Function to analyze the full code every 30 seconds
async function analyzeCode(codeSnippet) {
    const apiKey = process.env.GPT4_API_KEY;
    const apiEndpoint = "https://api.openai.com/v1/chat/completions"; // Ensure you're using the correct endpoint
    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return;
    }
    const fetch = await getFetch();
    if (!fetch)
        return; // Check if fetch was successfully loaded
    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4", // Specify the model
                messages: [{ role: "user", content: `Analyze the following code and provide tips:\n\n${codeSnippet}` }],
                max_tokens: 150 // Adjust as necessary
            })
        });
        // Updated response parsing
        const result = await response.json(); // No type assertion needed here
        if (result.choices && result.choices.length > 0) {
            const tips = result.choices[0].message.content; // Get the content of the first choice
            if (tips) {
                vscode.window.showInformationMessage(`CodePulse Tip: ${tips}`);
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error analyzing code: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Deactivation method
function deactivate() { }
//# sourceMappingURL=extension.js.map