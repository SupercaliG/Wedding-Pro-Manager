import { QuoteIcon } from 'lucide-react';

const testimonials = [
  {
    content: "Wedding Pro Manager has completely transformed how we manage our wedding planning business. The staff scheduling feature alone has saved us countless hours.",
    author: "Sarah Johnson",
    role: "Wedding Planner, Elegant Events"
  },
  {
    content: "As a wedding photographer, coordinating with planners and venues used to be a nightmare. This platform has made communication seamless and efficient.",
    author: "Michael Chen",
    role: "Lead Photographer, Capture Moments"
  },
  {
    content: "The ability to track employee availability and assign tasks has streamlined our operations. Our team is more productive and our clients are happier.",
    author: "Jessica Williams",
    role: "CEO, Divine Weddings"
  }
];

export default function TestimonialsSection() {
  return (
    <div className="py-12 md:py-20 bg-muted/50">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">
          Trusted by Wedding Professionals
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
          See what our customers have to say about Wedding Pro Manager.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        {testimonials.map((testimonial, index) => (
          <div 
            key={index} 
            className="flex flex-col p-6 bg-card rounded-lg border border-border shadow-sm"
          >
            <QuoteIcon className="h-8 w-8 text-primary/60 mb-4" />
            <p className="flex-grow text-muted-foreground italic mb-6">"{testimonial.content}"</p>
            <div>
              <p className="font-semibold">{testimonial.author}</p>
              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}