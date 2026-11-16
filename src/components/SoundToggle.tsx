import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setSfxEnabled, sfxEnabled, subscribeSound } from '@/lib/sfx';

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(() => sfxEnabled());

  useEffect(() => subscribeSound(() => setOn(sfxEnabled())), []);

  return (
    <button
      type="button"
      data-silent
      onClick={() => setSfxEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? 'Sound on — turn off' : 'Sound off — turn on'}
      title={on ? 'Sound on' : 'Sound off'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors',
        on
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {on ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
    </button>
  );
}
