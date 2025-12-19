export interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  return (
    <div
      className={`px-md py-sm bg-[rgba(255,100,100,0.1)] border border-[rgba(255,100,100,0.3)] rounded text-[#ff6b6b] text-[0.85rem] ${className}`}
    >
      {message}
    </div>
  );
}
