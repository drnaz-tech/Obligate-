import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { RuleLabel } from '@/components/dossier/Dossier';

export default function NotFound() {
  return (
    <>
      <PageMeta title="Page Not Found" description="" />
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <RuleLabel>File not found</RuleLabel>
        <h1 className="mt-2 text-balance font-display text-3xl uppercase tracking-wide text-foreground md:text-4xl">
          No such file
        </h1>
        <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
          This page may have been shelved or never existed. Check the address, or go back to the
          bureau.
        </p>
        <Button asChild className="mt-6 font-mono text-[12px] uppercase tracking-[0.11em]">
          <Link to="/">Back to the bureau</Link>
        </Button>
      </div>
    </>
  );
}
