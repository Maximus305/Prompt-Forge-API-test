"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'data';
  message: string;
}

interface Meta {
  status: number;
  statusText: string;
  duration: number;
  responseHeaders: Record<string, string>;
  sentBody: unknown;
}

const DEFAULT_BODY = JSON.stringify({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello, world!" }],
  max_tokens: 100
}, null, 2);

export default function PromptForge() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, type, message }]);
  };

  const handleSubmit = async () => {
    if (!apiUrl || !apiKey || !body) {
      setError('Please fill in all fields');
      return;
    }

    // Validate JSON
    try {
      JSON.parse(body);
    } catch {
      setError('Request body is not valid JSON');
      return;
    }

    setIsLoading(true);
    setError('');
    setResponse('');
    setLogs([]);

    addLog('info', `POST ${apiUrl}`);
    addLog('info', `Authorization: Bearer ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
    addLog('info', `Body: ${body.length} bytes`);
    addLog('info', 'Sending request...');

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiKey, body }),
      });

      const data = await res.json();
      const meta: Meta | undefined = data.meta;

      if (meta) {
        addLog(
          res.ok ? 'success' : 'error',
          `${meta.status} ${meta.statusText} (${meta.duration}ms)`
        );

        const headers = meta.responseHeaders;
        if (headers['content-type']) {
          addLog('info', `Content-Type: ${headers['content-type']}`);
        }
        if (headers['x-ratelimit-remaining']) {
          addLog('info', `Rate limit remaining: ${headers['x-ratelimit-remaining']}`);
        }
        if (headers['x-request-id']) {
          addLog('info', `Request ID: ${headers['x-request-id']}`);
        }

        addLog('info', 'Sent body:');
        addLog('data', JSON.stringify(meta.sentBody, null, 2));
      }

      if (!res.ok) {
        const errMsg = data.error || 'Request failed';
        addLog('error', errMsg);
      } else {
        addLog('success', 'Response received');
      }

      setResponse(JSON.stringify(data.result, null, 2));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      addLog('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-400';
      case 'data': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Prompt Forge
          </h1>
          <p className="mt-2 text-muted-foreground">
            Test API endpoints and see exactly what gets sent and received
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Inputs */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    API URL
                  </label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Request Body (JSON)
              </h2>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                spellCheck={false}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="mt-4 w-full"
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send Request'}
              </Button>

              {error && (
                <p className="mt-3 text-center text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          {/* Right: Activity Log + Response */}
          <div className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity Log
                </h2>
              </div>
              <div className="h-[300px] overflow-y-auto p-4 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground/50">
                    Send a request to see activity...
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/50">{log.time}</span>
                        {log.type === 'data' ? (
                          <pre className={`whitespace-pre-wrap break-all ${logColor(log.type)}`}>
                            {log.message}
                          </pre>
                        ) : (
                          <span className={logColor(log.type)}>{log.message}</span>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/50">
                          {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="animate-pulse text-muted-foreground">Waiting for response...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {response && (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="border-b px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Response Body
                  </h2>
                </div>
                <pre className="max-h-[400px] overflow-auto p-5 font-mono text-xs leading-relaxed text-foreground">
                  {response}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
