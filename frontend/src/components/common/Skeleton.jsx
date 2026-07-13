export default function Skeleton({ className = '', count = 1, style }) {
  return (
    <div className="space-y-2" style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="skeleton w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-4 w-5/6 rounded" />
      </div>
    </div>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

export function WelcomeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="skeleton w-20 h-20 rounded-2xl" />
      <div className="space-y-2 text-center">
        <div className="skeleton h-8 w-80 mx-auto rounded" />
        <div className="skeleton h-5 w-60 mx-auto rounded" />
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
