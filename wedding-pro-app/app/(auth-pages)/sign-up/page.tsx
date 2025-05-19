import { signUpAction } from "@/app/actions";
import { createOrganizationWithAdmin, employeeSelfSignup } from "@/app/user-management-actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function Signup(props: {
  searchParams: Promise<Message & { type?: string }>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  // Determine if this is an organization signup or employee signup
  const defaultTab = searchParams.type === "org" ? "organization" : "employee";

  return (
    <>
      <div className="flex flex-col min-w-80 max-w-md mx-auto">
        <h1 className="text-2xl font-medium text-center">Sign up</h1>
        <p className="text-sm text-foreground text-center mb-6">
          Already have an account?{" "}
          <Link className="text-primary font-medium underline" href="/sign-in">
            Sign in
          </Link>
        </p>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="employee">Employee</TabsTrigger>
          </TabsList>

          {/* Organization Signup Form */}
          <TabsContent value="organization">
            <form className="flex flex-col gap-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input 
                  id="orgName"
                  name="orgName" 
                  placeholder="Your Company Name" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="fullName">Your Full Name</Label>
                <Input 
                  id="fullName"
                  name="fullName" 
                  placeholder="John Doe" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  name="email" 
                  type="email"
                  placeholder="you@example.com" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input 
                  id="phoneNumber"
                  name="phoneNumber" 
                  placeholder="+1 (555) 123-4567" 
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Your password"
                  minLength={6}
                  required
                />
              </div>

              <SubmitButton 
                formAction={createOrganizationWithAdmin} 
                pendingText="Creating Organization..."
              >
                Create Organization
              </SubmitButton>
              <FormMessage message={searchParams} />
            </form>
          </TabsContent>

          {/* Employee Signup Form */}
          <TabsContent value="employee">
            <form className="flex flex-col gap-4">
              <div>
                <Label htmlFor="emp-fullName">Full Name</Label>
                <Input 
                  id="emp-fullName"
                  name="fullName" 
                  placeholder="John Doe" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="emp-email">Email</Label>
                <Input 
                  id="emp-email"
                  name="email" 
                  type="email"
                  placeholder="you@example.com" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="emp-phoneNumber">Phone Number</Label>
                <Input 
                  id="emp-phoneNumber"
                  name="phoneNumber" 
                  placeholder="+1 (555) 123-4567" 
                />
              </div>

              <div>
                <Label htmlFor="orgCode">Organization Code</Label>
                <Input 
                  id="orgCode"
                  name="orgCode" 
                  placeholder="Enter your organization code" 
                  required 
                />
              </div>

              <div>
                <Label htmlFor="emp-password">Password</Label>
                <Input
                  id="emp-password"
                  type="password"
                  name="password"
                  placeholder="Your password"
                  minLength={6}
                  required
                />
              </div>

              <SubmitButton 
                formAction={employeeSelfSignup} 
                pendingText="Signing up..."
              >
                Sign up
              </SubmitButton>
              <FormMessage message={searchParams} />
            </form>
          </TabsContent>
        </Tabs>
      </div>
      <SmtpMessage />
    </>
  );
}
