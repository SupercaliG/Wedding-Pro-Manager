import { Calendar, Users, Clock, MessageSquare, BarChart, Shield } from "lucide-react";

const features = [
  {
    icon: <Calendar className="h-8 w-8 text-primary" />,
    title: "Event Scheduling",
    description: "Easily manage and schedule all your wedding events in one place with our intuitive calendar interface."
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Staff Management",
    description: "Assign staff to events, track availability, and manage employee schedules efficiently."
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: "Real-time Updates",
    description: "Get instant notifications and updates on schedule changes, staff availability, and client requests."
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: "Secure Messaging",
    description: "Communicate securely with your team and clients through our encrypted messaging platform."
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary" />,
    title: "Business Analytics",
    description: "Track your business performance with detailed analytics and reporting tools."
  },
  {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: "Data Security",
    description: "Your data is protected with enterprise-grade security and regular backups."
  }
];

export default function FeaturesSection() {
  return (
    <div className="py-20 bg-background">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight">
          Everything You Need to Run Your Wedding Business
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
          Wedding Pro Manager provides all the tools you need to streamline your operations and deliver exceptional service.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="flex flex-col p-6 bg-card rounded-lg border border-border shadow-sm"
          >
            <div className="mb-4">{feature.icon}</div>
            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}