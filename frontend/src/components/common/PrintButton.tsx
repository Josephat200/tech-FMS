type PrintButtonProps = {
  label?: string;
};

export function PrintButton({ label = 'Print' }: PrintButtonProps) {
  return (
    <button className="btn ghost no-print" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
