"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
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

interface PromptVariable {
  variableId: string;
  name: string;
  description: string | null;
  dataType: string;
  required: boolean;
}

interface CompileResponse {
  compiled: string;
  promptId: string;
  version: string;
  variables: string[];
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'compile-prompt',
    label: 'Compile Prompt',
    method: 'POST',
    path: '/api/v1/prompts/:id/compile',
    description: 'Compile a prompt by substituting variables with provided values.',
    hasPromptId: true,
    hasBody: true,
    defaultBody: JSON.stringify({ variables: {} }, null, 2),
  },
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

function CompileResponseView({ data, markdown, onToggleMarkdown }: { data: CompileResponse; markdown: boolean; onToggleMarkdown: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.compiled);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prompt</span>
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">{data.promptId}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Version</span>
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">v{data.version}</code>
        </div>
        {data.variables.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Variables</span>
            <div className="flex gap-1.5">
              {data.variables.map((v) => (
                <span key={v} className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-500/20">{v}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Markdown</span>
          <button
            onClick={onToggleMarkdown}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${markdown ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${markdown ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
          </button>
        </div>
      </div>

      {/* Compiled output */}
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute right-4 top-4 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {markdown ? (
          <div className="rounded-lg border bg-muted/30 p-6 pr-24 prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-[hsl(var(--secondary))] prose-pre:text-foreground prose-pre:border prose-pre:text-sm prose-code:text-foreground prose-code:bg-[hsl(var(--secondary))] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
            <Markdown>{data.compiled}</Markdown>
          </div>
        ) : (
          <pre className="rounded-lg border bg-muted/30 p-6 pr-24 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {data.compiled}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function PromptForge() {
  const [baseUrl, setBaseUrl] = useState('https://main.d2r2bhlvzb3q6.amplifyapp.com');
  const [apiKey, setApiKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [resourceId, setResourceId] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Compile-specific state
  const [parameters, setParameters] = useState<PromptVariable[]>([]);
  const [paramPromptName, setParamPromptName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [loadingParams, setLoadingParams] = useState(false);
  const [paramsLoaded, setParamsLoaded] = useState(false);
  const [paramsError, setParamsError] = useState('');
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [responseView, setResponseView] = useState<'formatted' | 'raw'>('formatted');
  const [logOpen, setLogOpen] = useState(false);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);

  const isCompile = selectedEndpoint.id === 'compile-prompt';

  useEffect(() => {
    setBody(selectedEndpoint.defaultBody || '');
    setError('');
    setCompileResult(null);
    setResponseView('formatted');
  }, [selectedEndpoint]);

  // Auto-fetch parameters when prompt ID changes on compile endpoint
  useEffect(() => {
    setParameters([]);
    setVariableValues({});
    setParamsLoaded(false);
    setParamsError('');

    if (isCompile && resourceId && apiKey && baseUrl) {
      const timer = setTimeout(() => {
        fetchParameters();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [resourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Sync variable form values into the body JSON
  useEffect(() => {
    if (isCompile && paramsLoaded) {
      const variables: Record<string, string> = {};
      for (const [key, val] of Object.entries(variableValues)) {
        if (val.trim()) variables[key] = val;
      }
      setBody(JSON.stringify({ variables }, null, 2));
    }
  }, [variableValues, isCompile, paramsLoaded]);

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

  const fetchParameters = useCallback(async () => {
    if (!baseUrl || !apiKey || !resourceId) {
      setParamsError('Enter Base URL, API Key, and Prompt ID first');
      return;
    }

    setLoadingParams(true);
    setParamsError('');

    try {
      const base = baseUrl.replace(/\/+$/, '');
      const targetUrl = `${base}/api/v1/prompts/${resourceId}/parameters`;

      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          apiKey,
          method: 'GET',
        }),
      });

      const data = await res.json();

      if (data.error && !data.result) {
        setParamsError(data.error);
        return;
      }

      const result = data.result;
      if (result?.data?.variables) {
        setParameters(result.data.variables);
        setParamPromptName(result.data.name || '');
        const initial: Record<string, string> = {};
        for (const v of result.data.variables) {
          initial[v.variableId] = '';
        }
        setVariableValues(initial);
        setParamsLoaded(true);
      } else if (result?.variables) {
        setParameters(result.variables);
        setParamPromptName(result.name || '');
        const initial: Record<string, string> = {};
        for (const v of result.variables) {
          initial[v.variableId] = '';
        }
        setVariableValues(initial);
        setParamsLoaded(true);
      } else {
        setParamsError('Unexpected response format');
      }
    } catch (err) {
      setParamsError(err instanceof Error ? err.message : 'Failed to fetch parameters');
    } finally {
      setLoadingParams(false);
    }
  }, [baseUrl, apiKey, resourceId]);

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
    setCompileResult(null);
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

        // Try to parse as compile response
        if (isCompile) {
          const r = data.result?.data || data.result;
          if (r?.compiled && typeof r.compiled === 'string') {
            setCompileResult({
              compiled: r.compiled,
              promptId: r.promptId || resourceId,
              version: r.version || '?',
              variables: r.variables || [],
            });
          }
        }
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left panel */}
      <div className="w-[420px] shrink-0 border-r flex flex-col bg-card overflow-hidden">
        {/* Header + Config */}
        <div className="px-5 pt-5 pb-4 border-b space-y-4">
          <h1 className="text-lg font-bold tracking-tight text-foreground">PromptForge API Tester</h1>
          <div className="flex gap-3">
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

        {/* Endpoint list */}
        <div className="border-b px-3 py-3">
          <h2 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endpoints</h2>
          <div className="space-y-0.5">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpoint(ep)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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

        {/* Request form - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <div className="flex items-center gap-2.5">
              <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
              <code className="text-sm text-muted-foreground">{selectedEndpoint.path}</code>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{selectedEndpoint.description}</p>
          </div>

          <div className="space-y-4">
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

            {/* Compile: Load Parameters button */}
            {isCompile && !paramsLoaded && (
              <div>
                <Button
                  variant="outline"
                  onClick={fetchParameters}
                  disabled={loadingParams || !resourceId}
                  className="w-full"
                >
                  {loadingParams ? 'Loading parameters...' : 'Load Prompt Parameters'}
                </Button>
                {paramsError && (
                  <p className="mt-1.5 text-xs text-destructive">{paramsError}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Fetches the prompt&apos;s input variables so you can fill them in
                </p>
              </div>
            )}

            {/* Compile: Variable form fields */}
            {isCompile && paramsLoaded && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Variables</h3>
                    {paramPromptName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{paramPromptName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setParamsLoaded(false); setParameters([]); setVariableValues({}); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reload
                  </button>
                </div>

                {parameters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">This prompt has no input variables.</p>
                ) : (
                  parameters.map((param) => (
                    <div key={param.variableId}>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-sm font-medium text-foreground">{param.name}</label>
                        {param.required && (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500 border border-red-500/20">
                            REQUIRED
                          </span>
                        )}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {param.dataType}
                        </span>
                      </div>
                      {param.description && (
                        <p className="text-xs text-muted-foreground mb-1.5">{param.description}</p>
                      )}
                      <input
                        type="text"
                        value={variableValues[param.variableId] || ''}
                        onChange={(e) => setVariableValues(prev => ({ ...prev, [param.variableId]: e.target.value }))}
                        placeholder={`Enter ${param.name}...`}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                    View request body JSON
                  </summary>
                  <pre className="mt-2 rounded-lg border bg-muted/30 p-3 font-mono text-xs text-foreground overflow-auto max-h-[150px]">
                    {body}
                  </pre>
                </details>
              </div>
            )}

            {/* Non-compile body textarea */}
            {selectedEndpoint.hasBody && !isCompile && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Request Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Compile: raw body fallback when params not loaded */}
            {isCompile && !paramsLoaded && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Or enter raw JSON body
                </summary>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </details>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Sending...' : `Send ${selectedEndpoint.method} Request`}
            </Button>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Response header */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Response
          </h2>
          <div className="flex items-center gap-2">
            {compileResult && response && (
              <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                <button
                  onClick={() => setResponseView('formatted')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    responseView === 'formatted' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setResponseView('raw')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    responseView === 'raw' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Raw JSON
                </button>
              </div>
            )}
            <button
              onClick={() => setLogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Activity Log
              {logs.length > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-foreground">
                  {logs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Response body - fills remaining space */}
        <div className="flex-1 overflow-auto">
          {compileResult && responseView === 'formatted' ? (
            <div className="p-6">
              <CompileResponseView data={compileResult} markdown={markdownEnabled} onToggleMarkdown={() => setMarkdownEnabled(prev => !prev)} />
            </div>
          ) : (
            <pre className="h-full p-6 font-mono text-sm leading-relaxed text-foreground">
              {response || <span className="text-muted-foreground/40">Response will appear here...</span>}
            </pre>
          )}
        </div>
      </div>

      {/* Activity Log Modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogOpen(false)}>
          <div className="w-full max-w-2xl mx-4 rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-foreground">Activity Log</h2>
              <div className="flex items-center gap-3">
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setLogOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            </div>
            <div ref={logRef} className="max-h-[400px] overflow-y-auto p-5 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground/40">No activity yet.</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="shrink-0 text-muted-foreground/40">{log.time}</span>
                      <span className={logColor(log.type)}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
