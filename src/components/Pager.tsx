type Props = {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  label: string;
};

export function Pager({ page, pages, onChange, label }: Props) {
  const total = Math.max(pages, 1);
  return (
    <div className="pager" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="前のページ"
      >
        ←
      </button>
      <span>
        {page + 1} / {total}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= total - 1}
        aria-label="次のページ"
      >
        →
      </button>
    </div>
  );
}
