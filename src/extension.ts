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
    const previousErrors = new Set<string>();
    const recentEdits = new Map<number, number>();
    let tipDescriptions: string[] = [];
    let hasTypedSinceLastPulse = false;

    // Register the "Explain Code" command
    const explainCode = vscode.commands.registerCommand('alex-krutang-codepulse.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (selectedText.trim()) {
                const explanation = await getExplanationFromAPI(selectedText);
                if (explanation) {
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
                                        white-space: pre-wrap;
                                        word-wrap: break-word;
                                    }
                                    body {
                                        padding: 10px;
                                        font-family: sans-serif;
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

    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) return;

        const timestamp = Date.now();
        hasTypedSinceLastPulse = true;

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            for (let line = startLine; line <= endLine; line++) {
                recentEdits.set(line, timestamp);
            }
        }

        const fiveSecondsAgo = timestamp - 5000;
        for (const [line, editTime] of recentEdits) {
            if (editTime < fiveSecondsAgo) {
                recentEdits.delete(line);
            }
        }
    });

    const interval = setInterval(async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const diagnostics = vscode.languages.getDiagnostics(document.uri);

            const currentErrorKeys = new Set<string>();
            const validErrors = [];
            const currentTime = Date.now();
            const fiveSecondsAgo = currentTime - 5000;

            for (const diagnostic of diagnostics) {
                if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
                    continue;
                }

                const lineNumber = diagnostic.range.start.line;
                const errorKey = `${lineNumber}:${diagnostic.message}`;

                currentErrorKeys.add(errorKey);

                if (previousErrors.has(errorKey)) {
                    continue;
                }

                const lastEditTime = recentEdits.get(lineNumber);
                if (lastEditTime && lastEditTime >= fiveSecondsAgo) {
                    continue;
                }

                validErrors.push({ errorKey, lineNumber, message: diagnostic.message });
            }

            previousErrors.forEach((errorKey) => {
                if (!currentErrorKeys.has(errorKey)) {
                    previousErrors.delete(errorKey);
                }
            });

            if (validErrors.length > 0) {
                const firstError = validErrors.shift()!;
                previousErrors.add(firstError.errorKey);

                vscode.window.showErrorMessage(`Error on line ${firstError.lineNumber + 1}: ${firstError.message}`);

                if (validErrors.length > 0) {
                    const lineNumbers = validErrors.map(err => err.lineNumber + 1);
                    vscode.window.showInformationMessage(`Additional errors on lines: ${lineNumbers.join(', ')}`);
                }
            } else {
                if (hasTypedSinceLastPulse) {
                    await provideTip(document.getText(), tipDescriptions);
                    hasTypedSinceLastPulse = false;
                }
            }

            for (const [line, editTime] of recentEdits) {
                if (editTime < fiveSecondsAgo) {
                    recentEdits.delete(line);
                }
            }
        }
    }, 30000); // 30 seconds

    context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

async function getExplanationFromAPI(codeSnippet: string): Promise<string | null> {
    const apiKey = process.env.GPT4_API_KEY;
    const apiEndpoint = "https://api.openai.com/v1/chat/completions";

    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return null;
    }

    const fetch = await getFetch();
    if (!fetch) return null;

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-2024-07-18",
                messages: [
                    {
                        role: "user",
                        content: `Explain the following code in a concise manner. If you provide code, do not include comments:\n\n${codeSnippet}`
                    }
                ]
            })
        });

        const result = await response.json();

        if (result && typeof result === 'object' && 'choices' in result) {
            const choices = result.choices;

            if (Array.isArray(choices) && choices.length > 0) {
                return choices[0].message.content;
            }
        }

        return "Could not generate an explanation.";
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching explanation: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

async function provideTip(codeSnippet: string, tipDescriptions: string[]): Promise<void> {
    const apiKey = process.env.GPT4_API_KEY;
    const apiEndpoint = "https://api.openai.com/v1/chat/completions";

    if (!apiKey) {
        vscode.window.showErrorMessage("GPT-4 API key is not set. Please add it to your .env file.");
        return;
    }

    const fetch = await getFetch();
    if (!fetch) return;

    let prompt = `Provide a helpful tip for the following code. Start your response with a 5-word description of the tip, followed by a detailed explanation.`;

    if (tipDescriptions.length > 0) {
        const descriptionsList = tipDescriptions.join('; ');
        prompt += ` Do not give tips on these areas: ${descriptionsList}.`;
    }

    prompt += `\n\nHere is the code:\n\n${codeSnippet}`;

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-2024-07-18",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 200
            })
        });

        const result = await response.json() as GPTApiResponse;

        if (result.choices && result.choices.length > 0) {
            const tip = result.choices[0].message.content;
            if (tip && tip.trim()) {
                const words = tip.trim().split(/\s+/);
                const description = words.slice(0, 5).join(' ');
                tipDescriptions.push(description);

                if (tipDescriptions.length > 10) {
                    tipDescriptions.shift();
                }

                vscode.window.showInformationMessage(`CodePulse Tip: ${tip}`);
            } else {
                vscode.window.showInformationMessage("Code looks great so far.");
            }
        } else {
            vscode.window.showInformationMessage("Code looks great so far.");
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching tip: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {}
