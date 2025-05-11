import Link from 'next/link';

export function AppFooter() {
  return (
    <footer className="py-6 px-6 border-t bg-card text-muted-foreground">
      <div className="container mx-auto text-center text-sm">
        <p>&copy; {new Date().getFullYear()} AetherChat. All rights reserved.</p>
        <div className="mt-2 space-x-4">
          <Link href="mailto:support@aetherchat.com" className="hover:text-primary">
            support@aetherchat.com
          </Link>
          <span className="text-border">|</span>
          <Link href="tel:+1234567890" className="hover:text-primary">
            Hotline: (123) 456-7890
          </Link>
          <span className="text-border">|</span>
          <Link href="/policies" className="hover:text-primary">
            Policies
          </Link>
        </div>
      </div>
    </footer>
  );
}
