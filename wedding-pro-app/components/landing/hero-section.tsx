"use client";

import { Button } from "@/components/ui/button";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import Link from "next/link";

export default function HeroSection() {
  return (
    <div className="relative">
      <div className="absolute inset-0 z-10">
        <HeroGeometric 
          badge="Wedding Pro Manager"
          title1="Streamline Your"
          title2="Wedding Business"
        />
      </div>
      
      {/* Overlay content with CTA buttons */}
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center">
        <div className="mt-[60vh] flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" variant="default" className="bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20">
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-white/80 border-white/20 hover:bg-white/10 hover:text-white">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}