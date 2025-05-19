import Image from "next/image";
import Link from "next/link";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-16rem)] w-full">
      {/* Left side - Auth form */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-8 px-4 py-12">
          <div className="mb-8">
            <Link href="/" className="flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">Wedding Pro</span>
            </Link>
          </div>
          {children}
        </div>
      </div>

      {/* Right side - Image and text */}
      <div className="hidden md:flex flex-1 bg-muted/30 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
        <div className="relative z-10 max-w-md space-y-6 text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 8V16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 12H16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Wedding Pro Manager</h2>
          <p className="text-muted-foreground">
            The complete platform for wedding professionals to manage staff, schedule events, and deliver exceptional service.
          </p>
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              "Wedding Pro Manager has transformed how we run our business. Highly recommended for any wedding professional."
            </p>
            <p className="text-sm font-medium mt-2">— Emily Rodriguez, Wedding Planner</p>
          </div>
        </div>
      </div>
    </div>
  );
}
