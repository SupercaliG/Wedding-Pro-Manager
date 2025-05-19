'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react';

interface SafetyNumberVerificationProps {
  recipientId: string;
  recipientName: string;
  safetyNumber: string;
  onVerify: (isVerified: boolean) => Promise<void>;
  isVerified?: boolean;
}

/**
 * Component for verifying safety numbers between users
 * This helps prevent man-in-the-middle attacks in encrypted communication
 */
export function SafetyNumberVerification({
  recipientId,
  recipientName,
  safetyNumber,
  onVerify,
  isVerified = false,
}: SafetyNumberVerificationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'verified' | 'mismatch'>(
    isVerified ? 'verified' : 'unverified'
  );
  const [copied, setCopied] = useState(false);

  // Format safety number for display (groups of 4 digits)
  const formattedSafetyNumber = safetyNumber
    .replace(/\s/g, '')
    .match(/.{1,4}/g)
    ?.join(' ') || safetyNumber;

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (verified: boolean) => {
    try {
      setIsVerifying(true);
      await onVerify(verified);
      setVerificationStatus(verified ? 'verified' : 'mismatch');
    } catch (error) {
      console.error('Failed to verify safety number:', error);
    } finally {
      setIsVerifying(false);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`flex items-center gap-1 ${
            verificationStatus === 'verified' 
              ? 'text-green-600 hover:text-green-700' 
              : verificationStatus === 'mismatch' 
                ? 'text-red-600 hover:text-red-700'
                : 'text-gray-600 hover:text-gray-700'
          }`}
        >
          {verificationStatus === 'verified' ? (
            <ShieldCheck className="h-4 w-4" />
          ) : verificationStatus === 'mismatch' ? (
            <ShieldAlert className="h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          <span className="text-xs">
            {verificationStatus === 'verified' 
              ? 'Verified' 
              : verificationStatus === 'mismatch'
                ? 'Verification Failed'
                : 'Verify Identity'}
          </span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Safety Number</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Verify your conversation with {recipientName} is secure by comparing this safety number with the one they see.
          </p>
          
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Safety Number</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCopy} 
                className="h-8 px-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            <div className="font-mono text-lg break-all">
              {formattedSafetyNumber}
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Ask {recipientName} to share their safety number with you. If the numbers match, your conversation is secure.
          </p>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => handleVerify(false)} 
              disabled={isVerifying}
            >
              Numbers Don't Match
            </Button>
            <Button 
              onClick={() => handleVerify(true)} 
              disabled={isVerifying}
            >
              Numbers Match
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}