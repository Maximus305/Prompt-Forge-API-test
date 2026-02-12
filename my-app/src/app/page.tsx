"use client"

import React, { useState, useEffect, useRef } from 'react';
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
}

interface Endpoint {
  id: string;
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  hasPromptId: boolean;
  hasBody: boolean;
  defaultBody?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'list-prompts',
    label: 'List Prompts',
    method: 'GET',
    path: '/api/v1/prompts',
    description: 'Retrieve all production prompts in your workspace.',
    hasPromptId: false,
    hasBody: false,
  },
  {
    id: 'get-prompt',
    label: 'Get Prompt',
    method: 'GET',
    path: '/api/v1/prompts/:id',
    description: 'Retrieve a specific prompt by ID.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'create-prompt',
    label: 'Create Prompt',
    method: 'POST',
    path: '/api/v1/prompts',
    description: 'Create a new prompt with a name and description.',
    hasPromptId: false,
    hasBody: true,
    defaultBody: JSON.stringify({ name: "My Prompt", description: "A new prompt" }, null, 2),
  },
  {
    id: 'update-prompt',
    label: 'Update Prompt',
    method: 'PUT',
    path: '/api/v1/prompts/:id',
    description: 'Update an existing prompt. Only include fields you want to change.',
    hasPromptId: true,
    hasBody: true,
    defaultBody: JSON.stringify({ description: "Updated description" }, null, 2),
  },
  {
    id: 'delete-prompt',
    label: 'Delete Prompt',
    method: 'DELETE',
    path: '/api/v1/prompts/:id',
    description: 'Permanently delete a prompt. This cannot be undone.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'compile-prompt',
    label: 'Compile Prompt',
    method: 'POST',
    path: '/api/v1/prompts/:id/compile',
    description: 'Compile a prompt by substituting variables with provided values.',
    hasPromptId: true,
    hasBody: true,
    defaultBody: JSON.stringify({ variables: { customer_name: "Jane", issue_type: "refund" } }, null, 2),
  },
  {
    id: 'prompt-parameters',
    label: 'Prompt Parameters',
    method: 'GET',
    path: '/api/v1/prompts/:id/parameters',
    description: 'Returns the parameter schema for a prompt.',
    hasPromptId: true,
    hasBody: false,
  },
  {
    id: 'list-tools',
    label: 'List Tools',
    method: 'GET',
    path: '/api/v1/tools',
    description: 'Retrieve all tool definitions in your workspace.',
    hasPromptId: false,
    hasBody: false,
  },
  {
    id: 'get-tool',
    label: 'Get Tool',
    method: 'GET',
    path: '/api/v1/tools/:id',
    description: 'Retrieve a specific tool definition by ID.',
    hasPromptId: true,
    hasBody: false,
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function PromptForge() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [resourceId, setResourceId] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBody(selectedEndpoint.defaultBody || '');
    setError('');
  }, [selectedEndpoint]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, type, message }]);
  };

  const buildUrl = () => {
    const base = baseUrl.replace(/\/+$/, '');
    let path = selectedEndpoint.path;
    if (selectedEndpoint.hasPromptId && resourceId) {
      path = path.replace(':id', resourceId);
    }
    return `${base}${path}`;
  };

  const handleSubmit = async () => {
    if (!baseUrl || !apiKey) {
      setError('Please enter a Base URL and API Key');
      return;
    }
    if (selectedEndpoint.hasPromptId && !resourceId) {
      setError('Please enter a resource ID');
      return;
    }
    if (selectedEndpoint.hasBody && !body) {
      setError('Please enter a request body');
      return;
    }

    const targetUrl = buildUrl();

    setIsLoading(true);
    setError('');
    setResponse('');
    setLogs([]);

    addLog('info', `${selectedEndpoint.method} ${targetUrl}`);
    addLog('info', `Authorization: Bearer ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
    if (selectedEndpoint.hasBody && body) {
      addLog('info', `Body: ${body.length} bytes`);
    }
    addLog('info', 'Sending request...');

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          apiKey,
          method: selectedEndpoint.method,
          body: selectedEndpoint.hasBody ? body : undefined,
        }),
      });

      const data = await res.json();
      const meta: Meta | undefined = data.meta;

      if (meta) {
        const isOk = meta.status >= 200 && meta.status < 300;
        addLog(
          isOk ? 'success' : 'error',
          `${meta.status} ${meta.statusText} (${meta.duration}ms)`
        );

        const h = meta.responseHeaders;
        if (h['x-ratelimit-remaining']) {
          addLog('info', `Rate limit: ${h['x-ratelimit-remaining']}/${h['x-ratelimit-limit'] || '?'} remaining`);
        }
        if (h['x-request-id']) {
          addLog('info', `Request ID: ${h['x-request-id']}`);
        }
      }

      if (data.error && !data.result) {
        addLog('error', data.error);
        setError(data.error);
      } else {
        addLog('success', 'Response received');
      }

      if (data.result) {
        setResponse(JSON.stringify(data.result, null, 2));
      }
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
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Prompt Forge API Tester
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Test your PromptForge API endpoints
          </p>
        </div>

        {/* Config Bar */}
        <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-app.vercel.app"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pf_your_api_key"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Endpoint picker + form */}
          <div className="space-y-4 lg:col-span-2">
            {/* Endpoint List */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Endpoints
                </h2>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {ENDPOINTS.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEndpoint(ep)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      selectedEndpoint.id === ep.id
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[ep.method]}`}>
                      {ep.method}
                    </span>
                    <span className="truncate">{ep.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Request Form */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                    {selectedEndpoint.method}
                  </span>
                  <code className="text-xs text-muted-foreground">{selectedEndpoint.path}</code>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{selectedEndpoint.description}</p>
              </div>

              <div className="space-y-3">
                {selectedEndpoint.hasPromptId && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {selectedEndpoint.id.includes('tool') ? 'Tool ID' : 'Prompt ID'}
                    </label>
                    <input
                      type="text"
                      value={resourceId}
                      onChange={(e) => setResourceId(e.target.value)}
                      placeholder={selectedEndpoint.id.includes('tool') ? 'tool_xyz789' : 'prompt_abc123'}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {selectedEndpoint.hasBody && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Request Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      spellCheck={false}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Sending...' : `Send ${selectedEndpoint.method} Request`}
                </Button>

                {error && (
                  <p className="text-center text-xs text-destructive">{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Log + Response */}
          <div className="space-y-4 lg:col-span-3">
            {/* Activity Log */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity Log
                </h2>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div ref={logRef} className="h-[200px] overflow-y-auto p-3 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground/40">Send a request to see activity...</p>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/40">{log.time}</span>
                        <span className={logColor(log.type)}>{log.message}</span>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground/40">
                          {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="animate-pulse text-muted-foreground">Waiting for response...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Response */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Response
                </h2>
              </div>
              <pre className="max-h-[450px] min-h-[200px] overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground">
                {response || <span className="text-muted-foreground/40">Response will appear here...</span>}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
