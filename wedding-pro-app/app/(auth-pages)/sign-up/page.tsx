"use client";

import { signUpAction } from "@/app/actions"; // Assuming this is a general signup, not used by the specific forms below
import { createOrganizationWithAdmin } from "@/app/actions/user-management/organization-actions";
import { employeeSelfSignup } from "@/app/actions/user-management/employee-self-signup-action";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, User, Building, Mail, Phone, Lock } from "lucide-react";

// Validation schemas
const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "Email is required";
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  return null;
};

const validatePassword = (password: string): string | null => {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
};

const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value?.trim()) return `${fieldName} is required`;
  return null;
};

const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Phone is optional
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
    return "Please enter a valid phone number";
  }
  return null;
};

// Form field validation state interface
interface FieldValidation {
  error: string | null;
  touched: boolean;
}

interface FormValidation {
  [key: string]: FieldValidation;
}

export default function Signup() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [targetTab, setTargetTab] = useState<"org" | "employee" | "">("");
  
  // Loading states
  const [isOrgFormSubmitting, setIsOrgFormSubmitting] = useState(false);
  const [isEmployeeFormSubmitting, setIsEmployeeFormSubmitting] = useState(false);
  
  // Password visibility states
  const [showOrgPassword, setShowOrgPassword] = useState(false);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  
  // Form validation states
  const [orgFormValidation, setOrgFormValidation] = useState<FormValidation>({});
  const [employeeFormValidation, setEmployeeFormValidation] = useState<FormValidation>({});
  
  // Form refs for accessing form data
  const orgFormRef = useRef<HTMLFormElement>(null);
  const employeeFormRef = useRef<HTMLFormElement>(null);

  // Helper functions for validation
  const validateField = (
    fieldName: string,
    value: string,
    formType: 'org' | 'employee'
  ): string | null => {
    switch (fieldName) {
      case 'email':
      case 'emp-email':
        return validateEmail(value);
      case 'password':
      case 'emp-password':
        return validatePassword(value);
      case 'orgName':
        return validateRequired(value, 'Organization name');
      case 'fullName':
      case 'emp-fullName':
        return validateRequired(value, 'Full name');
      case 'phoneNumber':
      case 'emp-phoneNumber':
        return validatePhone(value);
      case 'orgCode':
        return validateRequired(value, 'Organization code');
      default:
        return null;
    }
  };

  const updateFieldValidation = (
    fieldName: string,
    value: string,
    formType: 'org' | 'employee',
    touched: boolean = true
  ) => {
    const error = validateField(fieldName, value, formType);
    const setValidation = formType === 'org' ? setOrgFormValidation : setEmployeeFormValidation;
    
    setValidation(prev => ({
      ...prev,
      [fieldName]: { error, touched }
    }));
  };

  const validateForm = (formData: FormData, formType: 'org' | 'employee'): boolean => {
    const fields = formType === 'org'
      ? ['orgName', 'fullName', 'email', 'password']
      : ['fullName', 'email', 'orgCode', 'password'];
    
    let isValid = true;
    const newValidation: FormValidation = {};
    
    fields.forEach(field => {
      const fieldName = formType === 'employee' && !field.startsWith('emp-') ? `emp-${field}` : field;
      const value = formData.get(field)?.toString() || '';
      const error = validateField(fieldName, value, formType);
      
      newValidation[fieldName] = { error, touched: true };
      if (error) isValid = false;
    });
    
    // Handle phone number validation (optional field)
    const phoneField = formType === 'org' ? 'phoneNumber' : 'emp-phoneNumber';
    const phoneValue = formData.get(formType === 'org' ? 'phoneNumber' : 'phoneNumber')?.toString() || '';
    const phoneError = validatePhone(phoneValue);
    newValidation[phoneField] = { error: phoneError, touched: true };
    if (phoneError) isValid = false;
    
    const setValidation = formType === 'org' ? setOrgFormValidation : setEmployeeFormValidation;
    setValidation(newValidation);
    
    return isValid;
  };

  // Enhanced form submission handlers
  const handleOrgFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsOrgFormSubmitting(true);
    
    try {
      const formData = new FormData(event.currentTarget);
      
      // Validate form
      if (!validateForm(formData, 'org')) {
        toast.error("Please fix the errors in the form");
        setIsOrgFormSubmitting(false);
        return;
      }
      
      // Don't show loading toast here since the server action redirects
      // The server action will redirect with success/error parameters
      // and the useEffect will handle showing the appropriate toast
      
      // Call the server action (this will redirect)
      await createOrganizationWithAdmin(formData);
      
      // We shouldn't reach this point since the server action redirects
      // If we do reach here, it means the redirect didn't happen as expected
      console.warn("Unexpected: Form submission completed without redirect");
      
    } catch (error) {
      // Only show error toast for actual client-side errors
      // Server-side errors should be handled via redirect parameters
      console.error("Client-side form submission error:", error);
      
      // Check if this is a network error or actual client error
      if (error instanceof Error) {
        if (error.message.includes('NEXT_REDIRECT')) {
          // This is actually a successful redirect, not an error
          console.log("Redirect successful, ignoring redirect 'error'");
          return;
        }
      }
      
      toast.error("An unexpected error occurred. Please try again.");
      setIsOrgFormSubmitting(false);
    }
    // Note: Don't set setIsOrgFormSubmitting(false) in finally block
    // since the redirect will unmount this component
  };

  const handleEmployeeFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsEmployeeFormSubmitting(true);
    
    try {
      const formData = new FormData(event.currentTarget);
      
      // Validate form
      if (!validateForm(formData, 'employee')) {
        toast.error("Please fix the errors in the form");
        setIsEmployeeFormSubmitting(false);
        return;
      }
      
      // Don't show loading toast here since the server action likely redirects
      // The server action will redirect with success/error parameters
      // and the useEffect will handle showing the appropriate toast
      
      // Call the server action (this will likely redirect)
      await employeeSelfSignup(formData);
      
      // We shouldn't reach this point if the server action redirects
      
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsEmployeeFormSubmitting(false);
    }
    // Note: Don't set setIsEmployeeFormSubmitting(false) in finally block
    // since the redirect will unmount this component
  };

  // Extract URL parameters
  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');
  const messageParam = searchParams.get('message');
  const typeParam = searchParams.get('type') as "org" | "employee" | null;

  useEffect(() => {
    // Clear any existing loading states when we get redirected back with results
    if (successParam || errorParam || messageParam) {
      setIsOrgFormSubmitting(false);
      setIsEmployeeFormSubmitting(false);
    }

    // Priority: success > error > message
    // If success parameter exists, prioritize it and ignore error
    if (successParam) {
      setMessage(successParam);
      setMessageType("success");
      setTargetTab(typeParam || "");
      // Show success toast
      toast.success(successParam, {
        duration: 6000,
        icon: <CheckCircle className="h-4 w-4" />,
      });
    } else if (errorParam) {
      setMessage(errorParam);
      setMessageType("error");
      setTargetTab(typeParam || "");
      // Show error toast
      toast.error(errorParam, {
        duration: 8000,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } else if (messageParam) {
      setMessage(messageParam);
      setMessageType("");
      setTargetTab(typeParam || "");
      // Show info toast
      toast.info(messageParam, {
        duration: 5000,
      });
    } else {
      // No message parameters, clear state
      setMessage("");
      setMessageType("");
      setTargetTab("");
    }
  }, [successParam, errorParam, messageParam, typeParam]);

  // Handle full-page generic messages first
  if (message && messageType === "" && !successParam && !errorParam) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={{ message }} />
      </div>
    );
  }
  
  // Enhanced FormField component with validation
  const FormField = ({
    id,
    name,
    type = "text",
    placeholder,
    required = false,
    validation,
    formType,
    icon: Icon,
    showPasswordToggle = false,
    showPassword = false,
    onTogglePassword
  }: {
    id: string;
    name: string;
    type?: string;
    placeholder: string;
    required?: boolean;
    validation: FieldValidation;
    formType: 'org' | 'employee';
    icon?: React.ComponentType<{ className?: string }>;
    showPasswordToggle?: boolean;
    showPassword?: boolean;
    onTogglePassword?: () => void;
  }) => {
    // Simplified - no real-time validation to prevent input interference
    // Validation will only happen on form submission

    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {placeholder}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <Input
            id={id}
            name={name}
            type={showPasswordToggle ? (showPassword ? "text" : "password") : type}
            placeholder={placeholder}
            required={required}
            className={`
              ${Icon ? 'pl-10' : 'pl-3'}
              ${showPasswordToggle ? 'pr-10' : 'pr-3'}
              ${validation.error && validation.touched
                ? 'border-red-500 focus-visible:ring-red-500'
                : 'border-input'
              }
            `}
            aria-invalid={validation.error && validation.touched ? 'true' : 'false'}
            aria-describedby={validation.error && validation.touched ? `${id}-error` : undefined}
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {validation.error && validation.touched && (
          <div id={`${id}-error`} className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {validation.error}
          </div>
        )}
      </div>
    );
  };

  const defaultTab = typeParam === "org" ? "organization" : "employee";

  // Determine which tabs should show the message
  let orgDisplayMessage: Message | null = null;
  let employeeDisplayMessage: Message | null = null;

  if (message && messageType) {
    const messageObj: Message = messageType === "success"
      ? { success: message }
      : { error: message };

    if (targetTab === 'org') {
      orgDisplayMessage = messageObj;
    } else if (targetTab === 'employee') {
      employeeDisplayMessage = messageObj;
    } else if (!targetTab) {
      // If no specific type, show on both tabs
      orgDisplayMessage = messageObj;
      employeeDisplayMessage = messageObj;
    }
  }

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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Create Organization
                </CardTitle>
                <CardDescription>
                  Set up your organization and create your admin account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  ref={orgFormRef}
                  className="flex flex-col gap-4"
                  onSubmit={handleOrgFormSubmit}
                >
                  <FormField
                    id="orgName"
                    name="orgName"
                    placeholder="Organization Name"
                    required
                    validation={orgFormValidation.orgName || { error: null, touched: false }}
                    formType="org"
                    icon={Building}
                  />

                  <FormField
                    id="fullName"
                    name="fullName"
                    placeholder="Your Full Name"
                    required
                    validation={orgFormValidation.fullName || { error: null, touched: false }}
                    formType="org"
                    icon={User}
                  />

                  <FormField
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email Address"
                    required
                    validation={orgFormValidation.email || { error: null, touched: false }}
                    formType="org"
                    icon={Mail}
                  />

                  <FormField
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="Phone Number (Optional)"
                    validation={orgFormValidation.phoneNumber || { error: null, touched: false }}
                    formType="org"
                    icon={Phone}
                  />

                  <FormField
                    id="password"
                    name="password"
                    placeholder="Password (min. 6 characters)"
                    required
                    validation={orgFormValidation.password || { error: null, touched: false }}
                    formType="org"
                    icon={Lock}
                    showPasswordToggle
                    showPassword={showOrgPassword}
                    onTogglePassword={() => setShowOrgPassword(!showOrgPassword)}
                  />

                  <Button
                    type="submit"
                    disabled={isOrgFormSubmitting}
                    className="w-full"
                  >
                    {isOrgFormSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Organization...
                      </>
                    ) : (
                      <>
                        <Building className="mr-2 h-4 w-4" />
                        Create Organization
                      </>
                    )}
                  </Button>
                  
                  {orgDisplayMessage && <FormMessage message={orgDisplayMessage} />}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Signup Form */}
          <TabsContent value="employee">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Join Organization
                </CardTitle>
                <CardDescription>
                  Create your employee account using an organization code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  ref={employeeFormRef}
                  className="flex flex-col gap-4"
                  onSubmit={handleEmployeeFormSubmit}
                >
                  <FormField
                    id="emp-fullName"
                    name="fullName"
                    placeholder="Your Full Name"
                    required
                    validation={employeeFormValidation['emp-fullName'] || { error: null, touched: false }}
                    formType="employee"
                    icon={User}
                  />

                  <FormField
                    id="emp-email"
                    name="email"
                    type="email"
                    placeholder="Email Address"
                    required
                    validation={employeeFormValidation['emp-email'] || { error: null, touched: false }}
                    formType="employee"
                    icon={Mail}
                  />

                  <FormField
                    id="emp-phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    placeholder="Phone Number (Optional)"
                    validation={employeeFormValidation['emp-phoneNumber'] || { error: null, touched: false }}
                    formType="employee"
                    icon={Phone}
                  />

                  <FormField
                    id="orgCode"
                    name="orgCode"
                    placeholder="Organization Code"
                    required
                    validation={employeeFormValidation.orgCode || { error: null, touched: false }}
                    formType="employee"
                    icon={Building}
                  />

                  <FormField
                    id="emp-password"
                    name="password"
                    placeholder="Password (min. 6 characters)"
                    required
                    validation={employeeFormValidation['emp-password'] || { error: null, touched: false }}
                    formType="employee"
                    icon={Lock}
                    showPasswordToggle
                    showPassword={showEmployeePassword}
                    onTogglePassword={() => setShowEmployeePassword(!showEmployeePassword)}
                  />

                  <Button
                    type="submit"
                    disabled={isEmployeeFormSubmitting}
                    className="w-full"
                  >
                    {isEmployeeFormSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <User className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                  
                  {employeeDisplayMessage && <FormMessage message={employeeDisplayMessage} />}
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <SmtpMessage />
    </>
  );
}
