import { Button } from '../ui/button';
import Link from 'next/link';

export default function CTASection() {
  return (
    <div className="py-12 md:py-20">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 md:p-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">
          Ready to Transform Your Wedding Business?
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Join thousands of wedding professionals who are streamlining their operations, 
          improving team collaboration, and delivering exceptional service to their clients.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/sign-up?type=org">Get Started Today</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}