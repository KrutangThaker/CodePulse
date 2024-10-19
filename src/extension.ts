import * as vscode from 'vscode';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Define the expected response structure
interface GPTApiResponse {
    choices?: {
        message: {
            content: string; // This holds the explanation or tips
        };
    }[];
}

async function getFetch() {
    const { default: fetch } = await import('node-fetch');
    return fetch;
}

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', 'api.env') });

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
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
                    const panel = vscode.window.createWebviewPanel(
                        'codePulseExplanation',
                        'Code Explanation',
                        vscode.ViewColumn.Beside,
                        {}
                    );
                    panel.webview.html = `
                        <html>
                            <head>
                                <style>
                                    pre {
                                        white-space: pre-wrap;       /* Wraps the text */
                                        word-wrap: break-word;       /* Breaks long words */
                                    }
                                    body {
                                        padding: 10px;              /* Adds padding for better readability */
                                        font-family: sans-serif;    /* Optional: Sets a default font */
                                    }
                                </style>
                            </head>
                            <body>
                                <pre>${explanation}</pre>
                            </body>
                        </html>
                    `;
                } else {
                    vscode.window.showErrorMessage("Could not generate an explanation.");
                }
            } else {
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
async function getExplanationFromAPI(codeSnippet: string): Promise<string | null> {
    const apiKey = process.env.GPT4_API_KEY; // Securely handle API key
    const apiEndpoint = "https://api.openai.com/v1/chat/completions"; // Correct endpoint for chat-based API

    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return null;
    }

    const fetch = await getFetch();
    if (!fetch) return null; // Check if fetch was successfully loaded

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
async function analyzeCode(codeSnippet: string) {
    const apiKey = process.env.GPT4_API_KEY;
    const apiEndpoint = "https://api.openai.com/v1/chat/completions"; // Ensure you're using the correct endpoint

    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return;
    }

    const fetch = await getFetch();
    if (!fetch) return; // Check if fetch was successfully loaded

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
        const result = await response.json() as GPTApiResponse; // No type assertion needed here

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
export function deactivate() {}
