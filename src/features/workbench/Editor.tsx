import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
monaco.languages.register({ id: 'latex' });
monaco.languages.setMonarchTokensProvider('latex', {
  tokenizer: {
    root: [
      [/%.*$/, 'comment'],
      [/\\[a-zA-Z@]+|\\./, 'keyword'],
      [/[{}[\]]/, 'delimiter.bracket'],
      [/\$\$?|[&_^]/, 'operator'],
    ],
  },
});
// Bundle the editor locally so research file contents never depend on a CDN.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export default function FileEditor({
  value,
  path,
  onChange,
}: {
  value: string;
  path: string;
  onChange: (value: string) => void;
}) {
  const extension = path.split('.').pop();
  const language =
    (
      { md: 'markdown', py: 'python', tex: 'latex', bib: 'latex', json: 'json' } as Record<
        string,
        string
      >
    )[extension || ''] || 'plaintext';
  return (
    <Editor
      height="60vh"
      language={language}
      value={value}
      onChange={(v) => onChange(v || '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
        tabSize: 4,
      }}
    />
  );
}
