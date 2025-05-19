"use client";

import HeroSection from "@/components/landing/hero-section";
import FeaturesSection from "@/components/landing/features-section";
import TestimonialsSection from "@/components/landing/testimonials-section";
import CTASection from "@/components/landing/cta-section";

export default function Home() {
  return (
    <div className="w-full">
      {/* Full-width hero section */}
      <HeroSection />
      
      {/* Constrained width content sections */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FeaturesSection />
        <TestimonialsSection />
        <CTASection />
      </div>
    </div>
  );
}
