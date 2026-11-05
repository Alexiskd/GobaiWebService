export function CommentForm({ value, placeholder, label, busy, onChange, onSubmit }) {
  const submit = () => { if (!busy && value.trim()) onSubmit(); };
  return (
    <div className="contribution-comment-form">
      <input
        value={value}
        maxLength={1000}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="send"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
      />
      <button type="button" disabled={busy || !value.trim()} onClick={submit}>{label}</button>
    </div>
  );
}
